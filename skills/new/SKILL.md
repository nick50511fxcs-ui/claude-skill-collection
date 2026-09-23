---
name: new
description: Saves a short handoff note to the repo when a conversation gets long, then prints a one-line starter for continuing in a new session.
disable-model-invocation: true
argument-hint: "[anything the note must include (optional)]"
---

# /new — save a handoff note, continue in a new session

Every reply re-reads the whole conversation, so long sessions get expensive.
Save only the essentials, and let the new session read just the note.

## 1. Write the note

**Overwrite** (never append to) `HANDOFF.md` at the root of the current git
repository (not under `.claude/`, which needs extra write approval). Keep it under 50 lines, in English, recording outcomes rather
than the conversation.

```markdown
# Handoff (YYYY-MM-DD)

## Goal
- What this work is trying to achieve, in one or two lines

## Decisions
- What was decided and why (so it is not re-litigated)

## Current state
- What is done; related PRs, branches, file paths

## Next steps
- What to do next, in order

## Notes
- What was tried and failed; user preferences and constraints
```

- Always include what the user typed after the command: $ARGUMENTS
- Never write tokens, passwords, API keys or personal contact details.

## 2. Save

If on the default branch (`main`/`master`), first create a branch with
`git switch -c claude/handoff` — never commit the note to the default branch.
If already on a work branch, use it.

```bash
git add HANDOFF.md
git commit -m "Update handoff note"
git push -u origin "$(git branch --show-current)"
```

- Retry the push only on network errors. If it still fails, show the note's
  content in the chat so the user can paste it into the new session.

## 3. Tell the user how to continue

New cloud sessions start on the default branch, so name the branch that holds
the note. Show **one line to copy**, in the user's language, equivalent to:

> Read `HANDOFF.md` on the `<branch>` branch and continue from there.

Then tell the user to open a new session and paste that line.
