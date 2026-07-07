---
name: azure-devops
description: Work with an Azure DevOps org via the az CLI — query sprint/assigned work items with WIQL, read a work item's description AND download+view its embedded screenshots, publish branches, and create PRs with configured house defaults (required reviewers, auto-complete, work item linked, one PR per repo). Reads org/project/reviewer settings from `.claude/azure-devops.json` and offers to create it on first use. Use this skill whenever the user says "pull my tasks", "my sprint work items", "what's assigned to me", "read task 12345", "read the work item", "get the screenshots from the work item", "create a PR", "publish the branch and create a PR", "link the PR to the work item", "set auto-complete", or mentions "azure devops", "az boards", "az repos" — even if they don't explicitly say "azure-devops skill". Do not use for GitHub repos (use gh) or for local git-only operations.
---

# Azure DevOps

Proven az-CLI workflows for Azure DevOps: work-item reading with screenshot attachments, WIQL queries, and PR creation with configured house defaults. All org-specific values come from config — never hardcode them.

## When to use this skill

- "pull my tasks" / "what's assigned to me" / "my sprint N work items"
- "read task 12345" / "does the work item have screenshots?"
- "publish the branch and create a PR" / "create a PR with required reviewers"
- "link the PR to the work item" / "set the PRs to auto-complete"

## Step 0 — Resolve configuration

Read `.claude/azure-devops.json` in the project root (fall back to `~/.claude/azure-devops.json`). Expected shape:

```json
{
  "organization": "https://dev.azure.com/<org>",
  "project": "<project-name>",
  "projectId": "<project GUID — optional, speeds up attachment downloads>",
  "targetBranch": "develop",
  "requiredReviewers": [
    { "name": "<display name>", "id": "<identity GUID>" }
  ],
  "prTitlePattern": "#<id> (<SCOPE>) <description>",
  "azPath": "az"
}
```

If the file is missing: get org/project from `az devops configure -l` if defaults are set, otherwise ask the user once, then **offer to write the config file** so this interview never repeats. Reviewer GUIDs can be resolved later via the identity-GUID recipe below. If `az` is not on PATH, ask for (or locate) the full path to `az.cmd`/`az` and store it as `azPath`.

## Workflow

### Query work items

1. Open items assigned to the user:
   `az boards query --wiql "SELECT [System.Id], [System.WorkItemType], [System.Title], [System.State], [System.IterationPath] FROM WorkItems WHERE [System.AssignedTo] = @Me AND [System.State] NOT IN ('Closed', 'Removed', 'Done') ORDER BY [System.ChangedDate] DESC" -o table`
2. Sprint filter: add `AND [System.IterationPath] = '<project>\Sprint <N>'` (include all states for a full sprint picture).

### Read a work item (text + screenshots)

1. `az boards work-item show --id <N> -o json` — parse the JSON; the description is HTML in `fields.'System.Description'`. Add `--expand relations` for linked items.
2. Extract attachment GUIDs from the description HTML: regex `attachments/([0-9a-f-]{36})\?fileName=([^"&]+)`.
3. Download each: `az devops invoke --area wit --resource attachments --route-parameters project=<projectId-or-name> id=<guid> --query-parameters fileName=image.png download=true --accept-media-type application/octet-stream --out-file <scratchpad>/imgN.png -o none`, then Read the images to view them. Associate each image with its position in the description text when reporting.

### Publish branch + create PR (apply ALL configured house defaults)

1. `git push -u origin <branch>` (only with user approval; never push unasked).
2. One PR per repo for multi-repo work items; descriptions cross-reference the sibling PRs and state any deploy-order coupling (e.g. DB schema first).
3. Create: `az repos pr create --repository <name> --source-branch <branch> --target-branch <targetBranch> --title "<per prTitlePattern>" --description <text> --work-items <id> -o json`.
4. Required reviewers from config. If `--reviewers <email>` fails (identity-resolution auth gap), PUT directly per reviewer:
   `az devops invoke --area git --resource pullRequestReviewers --route-parameters project=<project> repositoryId=<repoName> pullRequestId=<id> reviewerId=<guid> --http-method PUT --api-version 6.0 --in-file <body.json>` with body `{"vote": 0, "isRequired": true}`.
5. `az repos pr update --id <id> --auto-complete true`.
6. Verify: `az repos pr show --id <id>` → reviewers have `isRequired=true`; `az repos pr work-item list --id <id>` shows the work item. A step you did not verify is "not done", never "done".

### Resolve a person's identity GUID (when email resolution fails)

WIQL `WHERE [System.AssignedTo] = '<Display Name>'` → take any returned item → `az boards work-item show` → `fields.'System.AssignedTo'.id`. Offer to persist newly resolved GUIDs into the config file.

## Examples

### Example 1: sprint tasks

**User:** "pull my tasks for sprint 42"

**Claude:** reads config, runs the WIQL with the IterationPath filter, presents a table of ID/title/state, offers to read details of any item.

### Example 2: work item with screenshots

**User:** "read task 12345 — does it have screenshots?"

**Claude:** shows title/state/description summary, extracts attachment GUIDs, downloads all images via `az devops invoke`, views them, and reports what each shows in context of the description text.

### Example 3: multi-repo PR

**User:** "publish the branches and create PRs"

**Claude:** pushes each repo's feature branch, creates one PR per repo per the configured title pattern targeting the configured branch with the work item linked, sets all configured required reviewers (GUID PUT fallback if emails fail), enables auto-complete, verifies, and reports PR URLs.

## Anti-patterns

- ❌ Hardcoding org names, project names, GUIDs, or reviewer identities in commands you suggest saving — everything org-specific belongs in `.claude/azure-devops.json`.
- ❌ Passing JMESPath `--query` strings with embedded quotes from PowerShell — the az.cmd batch wrapper mangles them. Use `-o json` and parse with `ConvertFrom-Json` (or `-o table`) and filter in PowerShell.
- ❌ `--api-version 5.1-preview.1` on `az devops invoke` — it only accepts plain floats (`5.1`, `6.0`, `7.1`).
- ❌ Piping az output straight into `ConvertFrom-Json` — stderr warnings pollute it. Capture `2>&1 | Out-String` and regex-check (e.g. for `"pullRequestId"`) before parsing.
- ❌ Using `az rest` when auth is PAT-based — it requires a full `az login`.
- ❌ Creating a single PR for a multi-repo work item, or omitting configured reviewers/auto-complete/work-item link.
- ✅ Config-driven values, JSON-out + programmatic parsing, house PR defaults every time, verify after every mutation.

## Notes

- If a call fails with "requires user authentication", it's a PAT scope gap — name the missing scope (Identity Read for email resolution, Member Entitlement for user list) rather than retrying variants.
- Attachment downloads work with a plain PAT via `az devops invoke`; browser-only URLs (`https://dev.azure.com/...attachments/...`) are not fetchable directly.
- On Windows, `az` may not be on PATH — the config's `azPath` should then hold the full path to `az.cmd`, invoked from PowerShell as `& "<azPath>" ...`.
