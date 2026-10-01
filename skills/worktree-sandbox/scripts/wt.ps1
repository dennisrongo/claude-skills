#!/usr/bin/env pwsh
<#
.SYNOPSIS
  wt - run each git worktree in its own sandboxed Docker stack (your services + a dedicated Chromium).

.DESCRIPTION
  Nothing is written to the application repo. Config and per-branch state live in ~/.wt
  (override with the WT_HOME environment variable).

.EXAMPLE
  wt init
  wt up feature/new-login
  wt ls
  wt claude feature/new-login -- -p "smoke test the login page"
  wt down feature/new-login -Purge
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)][string]$Command = 'help',
    [Parameter(Position = 1)][string]$Branch,
    [switch]$NoBuild,
    [switch]$Purge,
    [switch]$Follow,
    [switch]$NoOpen,
    [string]$Service,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$Rest
)

$ErrorActionPreference = 'Stop'

$SkillRoot    = Split-Path -Parent $PSScriptRoot
$BrowserCtx   = Join-Path $SkillRoot 'docker/browser'
$ExampleCfg   = Join-Path $SkillRoot 'assets/config.example.json'
$WtHome       = if ($env:WT_HOME) { $env:WT_HOME } else { Join-Path $HOME '.wt' }
$ConfigPath   = Join-Path $WtHome 'config.json'
$SlotsPath    = Join-Path $WtHome 'slots.json'
$OverrideFile = Join-Path $WtHome 'compose.override.yml'
$Reserved     = @{ Names = @('net', 'browser'); Ports = @(5900, 7900, 9222, 9223) }


function Expand-HomePath([string]$Path) {
    if ($Path -and $Path.StartsWith('~')) { return Join-Path $HOME $Path.Substring(1).TrimStart('/', '\') }
    return $Path
}

function Get-Config {
    if (-not (Test-Path $ConfigPath)) { throw "No config at $ConfigPath. Run: wt init" }
    $cfg = Get-Content $ConfigPath -Raw | ConvertFrom-Json
    $cfg.repoRoot     = Expand-HomePath $cfg.repoRoot
    $cfg.worktreeRoot = Expand-HomePath $cfg.worktreeRoot
    if (-not (Test-Path $cfg.repoRoot)) { throw "repoRoot not found: $($cfg.repoRoot)" }
    if (-not $cfg.services) { throw "config.json has no services. See assets/config.example.json" }
    foreach ($svc in $cfg.services.PSObject.Properties) {
        if ($svc.Name -notmatch '^[a-z0-9][a-z0-9_-]*$') { throw "Service name '$($svc.Name)' must be lowercase letters, digits, - or _" }
        if ($Reserved.Names -contains $svc.Name) { throw "Service name '$($svc.Name)' is reserved by the sandbox" }
        if (-not $svc.Value.image) { throw "Service '$($svc.Name)' has no image" }
        if ($svc.Value.source -and -not (Test-Path (Expand-HomePath $svc.Value.source))) { throw "Service '$($svc.Name)' source not found: $($svc.Value.source)" }
        if ($svc.Value.repo -and $svc.Value.source) { throw "Service '$($svc.Name)' sets both repo and source; use one" }
        if ($svc.Value.repo -and -not (Test-Path (Expand-HomePath $svc.Value.repo))) { throw "Service '$($svc.Name)' repo not found: $($svc.Value.repo)" }
        if ("$($svc.Value.image) $($svc.Value.command)" -match '<[^>]+>') {
            throw "Service '$($svc.Name)' still has placeholder values in $ConfigPath. Fill in image and command (recipes: references/stacks.md)"
        }
        if ($svc.Value.port -and ($Reserved.Ports -contains [int]$svc.Value.port)) { throw "Service '$($svc.Name)' uses port $($svc.Value.port), reserved by the sandbox (5900, 7900, 9222, 9223)" }
    }
    return $cfg
}

function Get-SafeName([string]$Name) {
    $safe = ($Name.ToLowerInvariant() -replace '[^a-z0-9]+', '-').Trim('-')
    if ($safe.Length -gt 40) { $safe = $safe.Substring(0, 40).TrimEnd('-') }
    return $safe
}

function Get-ProjectName([string]$B) { "wt-$(Get-SafeName $B)" }

function Get-StateDir([string]$B) {
    $dir = Join-Path (Join-Path $WtHome 'stacks') (Get-SafeName $B)
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    return $dir
}

function Write-LfFile([string]$Path, [string[]]$Lines) {
    [System.IO.File]::WriteAllText($Path, (($Lines -join "`n") + "`n"))
}

function Resolve-Branch {
    if ($Branch) { return $Branch }
    $current = git rev-parse --abbrev-ref HEAD 2>$null
    if ($LASTEXITCODE -eq 0 -and $current -and $current -ne 'HEAD') { return $current.Trim() }
    if ($env:WT_BRANCH) { return $env:WT_BRANCH }
    throw 'Not inside a worktree on a branch. Pass a branch: wt <command> <branch>'
}


function Get-Slots {
    $map = @{}
    if (Test-Path $SlotsPath) {
        $json = Get-Content $SlotsPath -Raw | ConvertFrom-Json
        if ($json) { $json.PSObject.Properties | ForEach-Object { $map[$_.Name] = [int]$_.Value } }
    }
    return $map
}

function Save-Slots([hashtable]$Map) {
    New-Item -ItemType Directory -Force -Path $WtHome | Out-Null
    Write-LfFile $SlotsPath @(($Map | ConvertTo-Json))
}

function Get-Slot($Cfg, [string]$B, [switch]$Allocate) {
    $slots = Get-Slots
    if ($slots.ContainsKey($B)) { return $slots[$B] }
    if (-not $Allocate) { return $null }
    $used = @($slots.Values)
    for ($i = 1; $i -le $Cfg.slots.max; $i++) {
        if ($used -notcontains $i) { $slots[$B] = $i; Save-Slots $slots; return $i }
    }
    throw "No free slots (max $($Cfg.slots.max)). Free one with: wt down <branch> -Purge"
}

function Get-Ports($Cfg, [int]$Slot) {
    [pscustomobject]@{
        View = $Cfg.slots.viewBase + $Slot
        Cdp  = $Cfg.slots.cdpBase + $Slot
    }
}


function Get-WorktreePath($Cfg, [string]$B, [switch]$Create, [string]$RepoRoot, [string]$Folder, [string]$Base) {
    if (-not $RepoRoot) { $RepoRoot = $Cfg.repoRoot }
    if (-not $Folder) { $Folder = Get-SafeName $B }
    $path = $null
    foreach ($line in (git -C $RepoRoot worktree list --porcelain)) {
        if ($line -like 'worktree *') { $path = $line.Substring(9) }
        elseif ($line -eq "branch refs/heads/$B") { return $path }
    }
    if (-not $Create) { return $null }

    $target = Join-Path $Cfg.worktreeRoot $Folder
    New-Item -ItemType Directory -Force -Path $Cfg.worktreeRoot | Out-Null
    git -C $RepoRoot show-ref --verify --quiet "refs/heads/$B"
    if ($LASTEXITCODE -eq 0) {
        git -C $RepoRoot worktree add $target $B | Out-Host
    } else {
        git -C $RepoRoot show-ref --verify --quiet "refs/remotes/origin/$B"
        if ($LASTEXITCODE -eq 0) { git -C $RepoRoot worktree add --track -b $B $target "origin/$B" | Out-Host }
        elseif ($Base) {
            git -C $RepoRoot show-ref --verify --quiet "refs/remotes/origin/$Base"
            $start = if ($LASTEXITCODE -eq 0) { "origin/$Base" } else { $Base }
            git -C $RepoRoot worktree add -b $B $target $start | Out-Host
        }
        else { git -C $RepoRoot worktree add -b $B $target | Out-Host }
    }
    if ($LASTEXITCODE -ne 0) { throw "git worktree add failed for '$B' in $RepoRoot" }
    return $target
}

function Get-ServiceWorktrees($Cfg, [string]$B, [switch]$Create) {
    $paths = @{}
    foreach ($prop in $Cfg.services.PSObject.Properties) {
        if (-not $prop.Value.repo) { continue }
        $base = if ($prop.Value.base) { $prop.Value.base } else { 'develop' }
        $found = Get-WorktreePath $Cfg $B -Create:$Create -RepoRoot (Expand-HomePath $prop.Value.repo) -Folder "$(Get-SafeName $B)-$($prop.Name)" -Base $base
        if ($found) { $paths[$prop.Name] = $found }
    }
    return $paths
}


function Get-ComposeArgs([string]$B) {
    $composeFile = Join-Path (Get-StateDir $B) 'compose.json'
    if (-not (Test-Path $composeFile)) { throw "No stack for '$B'. Run: wt up $B" }
    $a = @('compose', '-p', (Get-ProjectName $B), '-f', $composeFile)
    if (Test-Path $OverrideFile) { $a += @('-f', $OverrideFile) }
    return $a
}

function Invoke-Compose([string]$B, [string[]]$ComposeArgs) {
    $base = Get-ComposeArgs $B
    & docker @base @ComposeArgs
    if ($LASTEXITCODE -ne 0) { throw "docker compose $($ComposeArgs -join ' ') failed (exit $LASTEXITCODE)" }
}

function Get-RunningServices([string]$B) {
    try { $base = Get-ComposeArgs $B } catch { return @() }
    try { $out = & docker @base ps --status running --services 2>$null } catch { return @() }
    if ($LASTEXITCODE -ne 0) { return @() }
    return @($out | Where-Object { $_ })
}

function Test-StackPort([string]$B, [int]$Port) {
    # The browser container (Debian + bash) shares the stack namespace, so /dev/tcp probes localhost there.
    $base = Get-ComposeArgs $B
    & docker @base exec -T browser bash -c "exec 3<>/dev/tcp/127.0.0.1/$Port" 2>$null | Out-Null
    return ($LASTEXITCODE -eq 0)
}

function Test-Cdp([int]$Port) {
    try { Invoke-RestMethod "http://127.0.0.1:$Port/json/version" -TimeoutSec 2 | Out-Null; return $true }
    catch { return $false }
}

function Repair-Ownership([string]$Path) {
    if ($IsWindows -or -not $Path -or -not (Test-Path $Path)) { return }
    $uid = (id -u).Trim(); $gid = (id -g).Trim()
    & docker run --rm -v "${Path}:/src" alpine:3.20 chown -R "${uid}:${gid}" /src 2>$null | Out-Null
}

function ConvertTo-ComposeLiteral($Value) {
    # Compose interpolates $VAR everywhere; escape so commands and env reach the container verbatim.
    return ("$Value" -replace '\$', '$$$$')
}

function Get-VolumeKey([string]$Svc, [string]$Path) { "$Svc-$((Get-SafeName $Path))" }

function New-ComposeModel($Cfg, [int]$Slot, [string]$WtPath, [hashtable]$Extra = @{}) {
    $ports = Get-Ports $Cfg $Slot
    $services = [ordered]@{
        net = [ordered]@{
            image   = 'alpine:3.20'
            command = @('sleep', 'infinity')
            init    = $true
            ports   = @("127.0.0.1:$($ports.View):7900", "127.0.0.1:$($ports.Cdp):9222")
        }
    }
    $volumes = [ordered]@{ browser_profile = @{} }

    foreach ($prop in $Cfg.services.PSObject.Properties) {
        $name = $prop.Name; $svc = $prop.Value
        $mount = if ($null -eq $svc.mount) { $true } else { [bool]$svc.mount }
        $workdir = if ($svc.workdir) { ($svc.workdir -replace '\\', '/').Trim('/') } else { '' }
        $base = if ($workdir) { "/src/$workdir" } else { '/src' }

        $def = [ordered]@{ image = $svc.image; network_mode = 'service:net'; depends_on = @('net') }
        if ($mount) { $def.working_dir = $base }
        elseif ($workdir.StartsWith('/')) { $def.working_dir = $workdir }
        if ($svc.command) {
            $def.command = if ($svc.command -is [array]) { @($svc.command | ForEach-Object { ConvertTo-ComposeLiteral $_ }) }
                           else { @('sh', '-c', (ConvertTo-ComposeLiteral $svc.command)) }
        }

        $envMap = [ordered]@{}
        if ($svc.env) { foreach ($e in $svc.env.PSObject.Properties) { $envMap[$e.Name] = ConvertTo-ComposeLiteral $e.Value } }
        if ($Cfg.polling) {
            foreach ($k in 'CHOKIDAR_USEPOLLING', 'WATCHPACK_POLLING', 'DOTNET_USE_POLLING_FILE_WATCHER') { $envMap[$k] = 'true' }
        }
        if ($envMap.Count) { $def.environment = $envMap }

        $mounts = @()
        $hostSource = if ($svc.repo) { $Extra[$name] } elseif ($svc.source) { Expand-HomePath $svc.source } else { $WtPath }
        if ($mount) { $mounts += "${hostSource}:/src" }
        foreach ($v in @($svc.volumes)) {
            if (-not $v) { continue }
            $key = Get-VolumeKey $name $v
            $target = if ($v.StartsWith('/')) { $v } else { "$base/$($v.Trim('/'))" }
            $mounts += "${key}:$target"; $volumes[$key] = @{}
        }
        if ($svc.caches) {
            foreach ($c in $svc.caches.PSObject.Properties) {
                $key = "wt-cache-$(Get-SafeName $c.Name)"
                $mounts += "${key}:$($c.Value)"; $volumes[$key] = @{ external = $true }
            }
        }
        if ($mounts.Count) { $def.volumes = $mounts }
        $services[$name] = $def
    }

    $browserEnv = [ordered]@{ START_URL = (ConvertTo-ComposeLiteral $Cfg.browser.startUrl); SCREEN = '1440x900x24' }
    if ($Cfg.browser.flags) { $browserEnv.CHROMIUM_FLAGS = ConvertTo-ComposeLiteral $Cfg.browser.flags }
    $services.browser = [ordered]@{
        build        = $BrowserCtx
        image        = 'wt-sandbox-browser:latest'
        network_mode = 'service:net'
        depends_on   = @('net')
        shm_size     = '2gb'
        environment  = $browserEnv
        volumes      = @('browser_profile:/profile')
    }
    return [ordered]@{ services = $services; volumes = $volumes }
}

function Write-StackFiles($Cfg, [string]$B, [int]$Slot, [string]$WtPath, [hashtable]$Extra = @{}) {
    $state = Get-StateDir $B
    $ports = Get-Ports $Cfg $Slot
    $model = New-ComposeModel $Cfg $Slot $WtPath $Extra
    Write-LfFile (Join-Path $state 'compose.json') @(($model | ConvertTo-Json -Depth 12))

    $cdpUrl = "http://127.0.0.1:$($ports.Cdp)"
    $pw  = @('-y', '@playwright/mcp@latest', '--cdp-endpoint', $cdpUrl)
    $cdt = @('-y', 'chrome-devtools-mcp@latest', "--browser-url=$cdpUrl")
    $servers = if ($IsWindows) {
        [ordered]@{
            playwright        = @{ command = 'cmd'; args = @('/c', 'npx') + $pw }
            'chrome-devtools' = @{ command = 'cmd'; args = @('/c', 'npx') + $cdt }
        }
    } else {
        [ordered]@{
            playwright        = @{ command = 'npx'; args = $pw }
            'chrome-devtools' = @{ command = 'npx'; args = $cdt }
        }
    }
    Write-LfFile (Join-Path $state 'mcp.json') @((@{ mcpServers = $servers } | ConvertTo-Json -Depth 6))
    return $ports
}

function Get-CacheVolumes($Cfg) {
    $names = @()
    foreach ($prop in $Cfg.services.PSObject.Properties) {
        if ($prop.Value.caches) { foreach ($c in $prop.Value.caches.PSObject.Properties) { $names += "wt-cache-$(Get-SafeName $c.Name)" } }
    }
    return $names | Select-Object -Unique
}

function Open-Path([string]$Path) {
    if ($IsWindows) { Start-Process $Path; return }
    if ($IsMacOS) { & open $Path; return }
    if (Get-Command wslview -ErrorAction SilentlyContinue) { & wslview $Path; return }
    if (Get-Command explorer.exe -ErrorAction SilentlyContinue) { & explorer.exe (wslpath -w $Path); return }
    if (Get-Command xdg-open -ErrorAction SilentlyContinue) { & xdg-open $Path; return }
    Write-Host "Open this file in a browser: $Path"
}


function Invoke-Init {
    New-Item -ItemType Directory -Force -Path $WtHome | Out-Null
    if (Test-Path $ConfigPath) { Write-Host "Config already exists: $ConfigPath"; return }
    Copy-Item $ExampleCfg $ConfigPath
    Write-Host "Created $ConfigPath"
    Write-Host 'Edit repoRoot, worktreeRoot, browser.startUrl and services (see references/setup.md), then: wt up <branch>'
}

function Invoke-Up {
    $cfg = Get-Config
    $b = Resolve-Branch
    $wtPath = Get-WorktreePath $cfg $b -Create
    $slot = Get-Slot $cfg $b -Allocate
    foreach ($v in (Get-CacheVolumes $cfg)) { docker volume create $v | Out-Null }
    $extra = Get-ServiceWorktrees $cfg $b -Create
    $ports = Write-StackFiles $cfg $b $slot $wtPath $extra

    $upArgs = @('up', '-d', '--remove-orphans')
    if (-not $NoBuild) { $upArgs += '--build' }
    Invoke-Compose $b $upArgs

    Write-Host "`nWaiting for the browser..." -NoNewline
    $deadline = (Get-Date).AddSeconds(120)
    while (-not (Test-Cdp $ports.Cdp) -and (Get-Date) -lt $deadline) { Start-Sleep 2; Write-Host '.' -NoNewline }
    Write-Host ''
    Write-Host "Branch   : $b (slot $slot)"
    Write-Host "Worktree : $wtPath"
    Write-Host "Live view: http://localhost:$($ports.View)/vnc.html?autoconnect=true&resize=scale"
    Write-Host "CDP      : http://127.0.0.1:$($ports.Cdp)"
    Write-Host 'Package restores can take a few minutes on first run. A service is up only when wt ls says so.'
}

function Invoke-Down {
    $cfg = Get-Config
    $b = Resolve-Branch
    Repair-Ownership (Get-WorktreePath $cfg $b)
    $downArgs = @('down', '--remove-orphans')
    if ($Purge) { $downArgs += '--volumes' }
    Invoke-Compose $b $downArgs
    if ($Purge) {
        $slots = Get-Slots; $slots.Remove($b); Save-Slots $slots
        Remove-Item -Recurse -Force (Get-StateDir $b)
        Write-Host "Purged '$b' (volumes, browser profile, slot). The git worktree itself is untouched."
    }
}

function Invoke-Ls {
    $cfg = Get-Config
    $slots = Get-Slots
    if ($slots.Count -eq 0) { Write-Host 'No stacks. Start one with: wt up <branch>'; return }
    $rows = foreach ($b in ($slots.Keys | Sort-Object { $slots[$_] })) {
        $s = $slots[$b]; $p = Get-Ports $cfg $s
        $running = Get-RunningServices $b
        $probe = $running -contains 'browser'
        $health = foreach ($prop in $cfg.services.PSObject.Properties) {
            $n = $prop.Name
            $state = if (-not ($running -contains $n)) { '-' }
                     elseif (-not $prop.Value.port) { 'running' }
                     elseif ($probe -and (Test-StackPort $b ([int]$prop.Value.port))) { 'up' }
                     else { 'starting' }
            "${n}:$state"
        }
        [pscustomobject]@{
            Slot   = $s
            Branch = $b
            Health = if ($running.Count) { $health -join ' ' } else { 'stopped' }
            View   = "http://localhost:$($p.View)"
            CDP    = "http://127.0.0.1:$($p.Cdp)"
        }
    }
    $rows | Format-Table -AutoSize
}

function Invoke-Which {
    $cfg = Get-Config
    $b = Resolve-Branch
    $slot = Get-Slot $cfg $b
    if (-not $slot) { Write-Host "No stack for '$b'. Run: wt up $b"; return }
    $p = Get-Ports $cfg $slot
    [pscustomobject]@{
        Branch    = $b
        Slot      = $slot
        Worktree  = Get-WorktreePath $cfg $b
        ServiceWorktrees = (@((Get-ServiceWorktrees $cfg $b).GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" })) -join '; '
        Running   = (Get-RunningServices $b) -join ','
        AppUrl    = "$($cfg.browser.startUrl)  (open inside the stack browser)"
        LiveView  = "http://localhost:$($p.View)/vnc.html?autoconnect=true&resize=scale"
        Cdp       = "http://127.0.0.1:$($p.Cdp)"
        McpConfig = Join-Path (Get-StateDir $b) 'mcp.json'
    } | Format-List
}

function Invoke-Logs {
    $b = Resolve-Branch
    $logArgs = @('logs', '--tail', '200')
    if ($Follow) { $logArgs += '-f' }
    if ($Service) { $logArgs += $Service }
    Invoke-Compose $b $logArgs
}

function Invoke-Claude {
    $cfg = Get-Config
    $b = Resolve-Branch
    $wtPath = Get-WorktreePath $cfg $b
    if (-not $wtPath) { throw "No worktree for '$b'. Run: wt up $b" }
    $slot = Get-Slot $cfg $b
    $mcp = Join-Path (Get-StateDir $b) 'mcp.json'
    if (-not $slot -or -not (Test-Path $mcp)) { throw "No stack for '$b'. Run: wt up $b" }
    $p = Get-Ports $cfg $slot
    $env:WT_BRANCH   = $b
    $env:WT_SLOT     = "$slot"
    $env:WT_CDP_URL  = "http://127.0.0.1:$($p.Cdp)"
    $env:WT_VIEW_URL = "http://localhost:$($p.View)"
    Push-Location $wtPath
    try { & claude --mcp-config $mcp @Rest } finally { Pop-Location }
}

function Invoke-Dashboard {
    $cfg = Get-Config
    $slots = Get-Slots
    $tiles = foreach ($b in ($slots.Keys | Sort-Object { $slots[$_] })) {
        $p = Get-Ports $cfg $slots[$b]
        $name = [System.Net.WebUtility]::HtmlEncode($b)
        $src = "http://localhost:$($p.View)/vnc.html?autoconnect=true&amp;resize=scale&amp;reconnect=true"
        "<figure><figcaption><b>$name</b> &middot; slot $($slots[$b]) &middot; <a href=`"$src`" target=`"_blank`">open</a></figcaption><iframe src=`"$src`"></iframe></figure>"
    }
    if (-not $tiles) { $tiles = '<p>No running stacks. Start one with <code>wt up &lt;branch&gt;</code>, then re-run <code>wt dashboard</code>.</p>' }
    $html = @"
<!doctype html>
<html><head><meta charset="utf-8"><title>wt sandboxes</title>
<style>
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
  body { margin: 0; padding: 12px; background: Canvas; color: CanvasText; }
  h1 { font-size: 16px; margin: 0 0 12px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(560px, 1fr)); gap: 12px; }
  figure { margin: 0; border: 1px solid color-mix(in srgb, CanvasText 20%, transparent); border-radius: 8px; overflow: hidden; }
  figcaption { padding: 6px 10px; font-size: 13px; }
  iframe { width: 100%; aspect-ratio: 16 / 10; border: 0; display: block; }
</style></head>
<body><h1>wt sandboxes &middot; generated $(Get-Date -Format 'yyyy-MM-dd HH:mm')</h1>
<div class="grid">
$($tiles -join "`n")
</div></body></html>
"@
    New-Item -ItemType Directory -Force -Path $WtHome | Out-Null
    $out = Join-Path $WtHome 'dashboard.html'
    Write-LfFile $out @($html)
    Write-Host "Dashboard: $out"
    if (-not $NoOpen) { Open-Path $out }
}

function Invoke-Reload {
    $cfg = Get-Config
    $b = Resolve-Branch
    $slot = Get-Slot $cfg $b
    if (-not $slot) { throw "No stack for '$b'. Run: wt up $b" }
    $cdp = "http://127.0.0.1:$((Get-Ports $cfg $slot).Cdp)"
    $stale = @((Invoke-WebRequest "$cdp/json/list" -UseBasicParsing).Content | ConvertFrom-Json | Where-Object type -eq 'page')
    Invoke-RestMethod -Method Put -Uri "$cdp/json/new?$($cfg.browser.startUrl)" | Out-Null
    Start-Sleep 2
    foreach ($tab in $stale) { Invoke-RestMethod "$cdp/json/close/$($tab.id)" | Out-Null }
    Write-Host "Reloaded $($cfg.browser.startUrl) in slot $slot"
}

function Show-Help {
    @'
wt - one sandboxed stack (your services + a dedicated Chromium) per git worktree

  wt init                                   create ~/.wt/config.json
  wt up [branch] [-NoBuild]                 create worktree if needed, assign slot, start stack
  wt ls                                     list slots, health, live-view and CDP URLs
  wt which [branch]                         details for the current (or given) worktree
  wt logs [branch] [-Service <name>|browser] [-Follow]
  wt claude [branch] [-- <claude args>]     start Claude Code wired to that slot's browser
  wt dashboard [-NoOpen]                    page tiling every stack's live view (tiles reconnect when a stack restarts)
  wt reload [branch]                        reopen the start page (after services finish starting)
  wt down [branch] [-Purge]                 stop stack; -Purge drops volumes, profile and slot
  wt chown [branch]                         give container-written worktree files back to you

Branch defaults to the current worktree's branch. Nothing is written to the repo.
'@ | Write-Host
}

switch ($Command.ToLowerInvariant()) {
    'init'      { Invoke-Init }
    'up'        { Invoke-Up }
    'down'      { Invoke-Down }
    'ls'        { Invoke-Ls }
    'which'     { Invoke-Which }
    'logs'      { Invoke-Logs }
    'claude'    { Invoke-Claude }
    'dashboard' { Invoke-Dashboard }
    'reload'    { Invoke-Reload }
    'chown'     { $c = Get-Config; Repair-Ownership (Get-WorktreePath $c (Resolve-Branch)) }
    default     { Show-Help }
}
