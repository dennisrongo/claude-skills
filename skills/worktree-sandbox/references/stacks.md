# Stack recipes

The example config ships one placeholder service, `app`. Replace it with the services the repo
runs, taking commands and ports from the repo's own scripts (`package.json`, `Makefile`,
`Procfile`, `docker-compose.yml`, launch profiles, README). The sandbox only works when each
service listens on the port the other services and the frontend already expect.

## Filling in one service

| Question | Goes in |
|---|---|
| Which runtime and version does the repo use (CI config, `.nvmrc`, `.tool-versions`, SDK files)? | `image` |
| Which folder does it start from? | `workdir` |
| What installs dependencies and starts it in watch/dev mode? | `command` |
| Which port does it listen on? | `port` |
| Which folders are generated (dependencies, build output, virtualenvs)? | `volumes` |
| Where does its package manager cache downloads? | `caches` |

Recipes below, in no particular order of preference. Combine them: services in one stack reach
each other on `localhost`.

## Single web app (Node: Vite, Next.js, and similar)

```json
"web": {
  "image": "node:20",
  "command": "npm ci && npm run dev",
  "port": 5173,
  "volumes": ["node_modules", ".next"],
  "caches": { "npm": "/root/.npm" }
}
```

## Go API

```json
"api": {
  "image": "golang:1.23",
  "command": "go run ./cmd/server",
  "port": 8080,
  "caches": { "gomod": "/go/pkg/mod", "gobuild": "/root/.cache/go-build" }
}
```

## .NET API + Node frontend

```json
"services": {
  "api": {
    "image": "mcr.microsoft.com/dotnet/sdk:8.0",
    "workdir": "src/Api",
    "command": "dotnet watch run --no-launch-profile --urls http://localhost:5000",
    "port": 5000,
    "env": { "ASPNETCORE_ENVIRONMENT": "Development", "DOTNET_WATCH_SUPPRESS_LAUNCH_BROWSER": "1" },
    "volumes": ["bin", "obj"],
    "caches": { "nuget": "/root/.nuget/packages" }
  },
  "web": {
    "image": "node:20",
    "workdir": "web",
    "command": "npm ci && npm run dev",
    "port": 3000,
    "volumes": ["node_modules"],
    "caches": { "npm": "/root/.npm" }
  }
}
```

`--no-launch-profile` makes `dotnet` ignore `launchSettings.json` instead of needing it edited.

## Debugging a .NET service from VS Code

Install `vsdbg` once into a shared cache and run the service without `dotnet watch` (a restart
drops the attached debugger):

```json
"api": {
  "image": "mcr.microsoft.com/dotnet/sdk:8.0",
  "workdir": "src/Api",
  "command": "[ -x /vsdbg/vsdbg ] || curl -sSL https://aka.ms/getvsdbgsh | bash /dev/stdin -v latest -l /vsdbg; dotnet run --no-launch-profile -c Debug",
  "port": 5000,
  "env": { "ASPNETCORE_ENVIRONMENT": "Development", "ASPNETCORE_URLS": "http://+:5000" },
  "volumes": ["bin", "obj"],
  "caches": { "nuget": "/root/.nuget/packages", "vsdbg": "/vsdbg" }
}
```

On the machine running VS Code, point a Docker context at the Docker host and attach through it:

```
docker context create <name> --docker host=ssh://<user>@<host>
```

```json
{
  "name": "Attach to api",
  "type": "coreclr",
  "request": "attach",
  "processId": "${command:pickRemoteProcess}",
  "pipeTransport": {
    "pipeProgram": "docker",
    "pipeArgs": ["--context", "<name>", "exec", "-i", "<project>-api-1"],
    "debuggerPath": "/vsdbg/vsdbg",
    "pipeCwd": "${workspaceFolder}"
  },
  "sourceFileMap": { "/src": "${workspaceFolder}" }
}
```

Keep this configuration in a workspace file outside the repo. Breakpoints bind only when the
checkout on the Docker host is at the same commit as the one open in VS Code. `<project>` is
`wt-<branch>` as shown by `docker ps`.

## Legacy gulp / bower frontend

```json
"web": {
  "image": "node:14",
  "workdir": "client",
  "command": "npm install && npx bower install --allow-root && npx gulp serve",
  "port": 3000,
  "env": { "BROWSER": "none" },
  "volumes": ["node_modules", "bower_components"],
  "caches": { "npm": "/root/.npm" }
}
```

Older gulp setups often need an older Node; match what the repo's CI or `.nvmrc` uses. If the
gulpfile opens a browser, it fails quietly inside the container, which is harmless.

## Python API (FastAPI / Django) + Postgres

```json
"db": {
  "image": "postgres:16",
  "mount": false,
  "port": 5432,
  "env": { "POSTGRES_PASSWORD": "dev", "POSTGRES_DB": "app" },
  "volumes": ["/var/lib/postgresql/data"]
},
"api": {
  "image": "python:3.12",
  "command": "pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000",
  "port": 8000,
  "env": { "DATABASE_URL": "postgresql://postgres:dev@localhost:5432/app" },
  "caches": { "pip": "/root/.cache/pip" }
}
```

Each stack gets its own database, so branches with different migrations don't collide. Note the
database host is `localhost`: every service shares the stack's namespace.

## Ruby on Rails

```json
"web": {
  "image": "ruby:3.3",
  "command": "bundle install && bin/rails server -b 0.0.0.0 -p 3000",
  "port": 3000,
  "caches": { "gems": "/usr/local/bundle" }
}
```
