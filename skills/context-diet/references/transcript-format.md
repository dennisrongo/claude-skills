# Transcript format the scan relies on

Observed in Claude Code session transcripts. Key names and value types only; no real values. Read this when `scan` prints `FORMAT UNRECOGNIZED`. Do not open a transcript yourself (they are private): ask the user whether their recent sessions still record a `skill_listing` attachment, and have them report attachment type names only.

## Layout

- `~/.claude/projects/<project>/<session-id>.jsonl`: one session, one JSON object per line.
- `~/.claude/projects/<project>/<session-id>/subagents/agent-<id>.jsonl`: a subagent's transcript. Its records carry the parent's `sessionId`, so a use inside one counts for the parent session and the file never adds to the session count.
- Lines can be malformed or blank; skip them.

## Records the scan reads

Top level: `type`, `timestamp`, `cwd`, `sessionId`, `message`, `attachment`.

| Record | What the scan takes |
|---|---|
| `type: "assistant"`, `message.content[]` blocks with `type: "tool_use"` | `name: "Skill"` → `input.skill`; `name: "Agent"` (or `"Task"`) → `input.subagent_type`; `name: "mcp__<server>__<tool>"` → the server |
| `type: "user"` | a `<command-name>/name</command-name>` tag inside `message.content` (a string, or text blocks) is a slash command |
| `type: "attachment"` | the `attachment` object below |

Attachment types (`attachment.type`) and the keys used:

| Type | Keys | Use |
|---|---|---|
| `skill_listing` | `names[]`, `content` (string), `skillCount`, `isInitial` | what skills were advertised; `content` lines are `- <name>: <description>` or a bare `- <name>` when the listing is at its size cap |
| `agent_listing_delta` | `addedTypes[]`, `addedLines[]` (parallel arrays), `removedTypes[]`, `isInitial` | agents advertised |
| `mcp_instructions_delta` | `addedNames[]`, `addedBlocks[]` (parallel), `removedNames[]` | servers that ship instructions |
| `deferred_tools_delta` | `addedNames[]`, `addedLines[]` (parallel), `needsAuthMcpServers[]`, `failedMcpServers[]` (strings or objects with `name`) | `mcp__<server>__<tool>` names reveal servers with no instructions; also servers that did not connect |
| `hook_success` | `hookEvent`, `hookName`, `command`, `stdout`, `exitCode`, `durationMs` | size is `stdout` (`content` is empty); only `SessionStart` output becomes context |
| `invoked_skills` | `skills[]` | skills invoked; element shape not observed (empty in the samples), the reader accepts a string or an object with `name` |
| `model` | `identity.modelId`, `identity.marketingName`, `text` | the model a session ran on |

Every array above can be missing on a given record. Guard every read.

## Names

- Skill and agent names from a plugin are `<plugin>:<name>`; personal and project skills have no prefix.
- MCP server names differ by source: a listed server is `plugin:<plugin>:<server>`, its tool prefix is `mcp__plugin_<plugin>_<server>__`. Normalize both by replacing every non-alphanumeric run with `_` before comparing.

## Plugins on disk

- `~/.claude/plugins/installed_plugins.json`: `{ version, plugins: { "<name>@<marketplace>": [ { scope, installPath, version, ... } ] } }`.
- Under `installPath`: `.claude-plugin/plugin.json` (`name`, `version`, `description`, optionally `mcpServers`), `hooks/hooks.json` (`{ hooks: { <Event>: [ { matcher?, hooks: [ { type, command } ] } ] } }`), `.mcp.json`, `skills/<name>/SKILL.md`, `agents/`. Agent files do not always live in `agents/`, so the scan reads agents from the transcript listing instead.
- `~/.claude/settings.json`: `enabledPlugins` (`{ "<name>@<marketplace>": true|false }`) and `hooks` in the same shape as `hooks.json`'s `hooks`.

## Seen but not used

Assistant records also carry `attributionSkill`, `attributionPlugin`, `attributionMcpServer`, `attributionMcpTool` and `attributionAgent`. Their meaning is unconfirmed, so the scan does not treat them as evidence.
