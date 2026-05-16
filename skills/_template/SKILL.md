---
name: my-skill-name
description: One sentence describing what this skill does AND when to use it. Be specific about trigger phrases. Make sure to use this skill whenever the user mentions [X], [Y], or [Z], even if they don't explicitly ask for a "[skill name]".
# Visibility flags — uncomment when applicable. See write-a-skill for decision rules.
# disable-model-invocation: true   # Skill has destructive external side effects (deploy / git commit / send messages). Forces explicit user invocation; Claude can't auto-fire.
# user-invocable: false            # Service skill, only invoked by other skills. Hidden from /menu so users don't trip over internal machinery.
---

# My Skill Name

A short paragraph explaining what this skill is and when it applies.

## Contract

**Inputs:** <what the skill takes — user trigger phrase, target scope, args>
**Outputs:** <what it produces — report sections, file writes, side effects>
**Invokes:** <other skills this delegates to during its workflow, or `(none)`>
**Invoked by:** <skills that hand off here, plus the user phrases in `When to use`>

## When to use this skill

- Trigger condition 1
- Trigger condition 2
- Trigger condition 3

## Workflow

Step-by-step guidance for Claude on how to handle the task.

1. First, do X.
2. Then, do Y.
3. Finally, do Z.

When delegating to another skill, announce it inline:

> Phase N — invoking `<skill-name>` with:
>   <arg>: <value>
>   <arg>: <value>

On completion:

> `<skill-name>` returned: <one-line summary>.

## Examples

### Example 1: [scenario]

**User:** "..."

**Claude:** [what the ideal response looks like]

## Notes

Any caveats, edge cases, or things to watch out for.
