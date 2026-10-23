param(
  [int]$Seconds = 60,
  [string]$OutFile
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class PointerSample {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
}
'@

[PointerSample]::SetCursorPos(300, 300) | Out-Null
$positions = @{}
$foreground = [ordered]@{}
$end = (Get-Date).AddSeconds($Seconds)

while ((Get-Date) -lt $end) {
  $p = [System.Windows.Forms.Cursor]::Position
  $positions["$($p.X),$($p.Y)"] = 1

  $handle = [PointerSample]::GetForegroundWindow()
  $title = New-Object System.Text.StringBuilder 256
  [void][PointerSample]::GetWindowText($handle, $title, 256)
  $owner = 0
  [void][PointerSample]::GetWindowThreadProcessId($handle, [ref]$owner)
  $process = try { (Get-Process -Id $owner -ErrorAction Stop).ProcessName } catch { '?' }
  $key = "$process | $($title.ToString())"
  if (-not $foreground.Contains($key)) { $foreground[$key] = Get-Date -Format HH:mm:ss.fff }

  Start-Sleep -Milliseconds 25
}

$report = @(
  "distinct cursor positions: $($positions.Count) -> $($positions.Keys -join ' | ')"
  "distinct foreground windows: $($foreground.Count)"
) + ($foreground.GetEnumerator() | ForEach-Object { "  $($_.Value)  $($_.Key)" })

if ($OutFile) { $report | Set-Content -Path $OutFile } else { $report }
