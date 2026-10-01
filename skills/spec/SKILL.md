---
name: spec
description: Save the user's personal profile (career spec, skills, preferences) to user-level CLAUDE.md so every session knows it without being told. Type /spec <your spec>, /spec show, or /spec clear.
disable-model-invocation: true
argument-hint: "<your spec in any language> | show | clear"
---

# /spec — remember who the user is in every session

Claude Code's equivalent of Codex's "write my spec into AGENTS.md": the profile
goes into the user-level memory file `~/.claude/CLAUDE.md`, which Claude Code
loads at the start of every session in every project.

Input: $ARGUMENTS

## Modes

- **show** → print the current profile block from `~/.claude/CLAUDE.md` (or say there is none).
- **clear** → remove the profile block (everything between the markers, markers included). Leave the rest of the file untouched.
- **anything else** → treat it as the user's spec and save it (below). If the input is empty, ask the user to paste their spec (resume, CV text, or a free-form description) and stop.

## Saving

1. **Strip sensitive data before writing.** Never store: resident registration
   number or any national ID, phone number, exact home address, email, account
   or card numbers, passwords. If the input contains any, drop them and tell the
   user what was left out.
2. **Normalize into this structure**, keeping the user's language. Omit
   sections with no information; do not invent anything. Keep it under ~60 lines,
   since it is loaded into every session.
   ```markdown
   <!-- profile:start (managed by /spec) -->
   # About me
   ## Summary          (one or two lines: who I am, what I am looking for)
   ## Education
   ## Experience       (role, organization, period, one-line outcome each)
   ## Skills & certifications
   ## Languages        (with test scores if given)
   ## Preferences      (target roles, industries, company size, region, salary, work style)
   ## How to work with me  (language to answer in, tone, anything the user asked for)
   <!-- profile:end -->
   ```
3. **Write it.** Create `~/.claude/CLAUDE.md` if missing. If a block between
   `<!-- profile:start` and `<!-- profile:end -->` already exists, replace it;
   otherwise append it. Never touch anything outside the markers.
4. **Never write the profile into a repository file** (including this skill
   collection, which is public), and never commit or push it.
5. Show the user the saved block and ask them to correct anything wrong.

## Making it stick in cloud sessions

If `CLAUDE_CODE_REMOTE=true`, the container's home directory is discarded when
the session ends, so `~/.claude/CLAUDE.md` does not survive. After saving, also
give the user a ready-to-paste snippet for their environment's **Setup script**
(cloud environment menu in the session title bar → Edit → Setup script), placed
after any existing lines:

```bash
mkdir -p ~/.claude && cat >> ~/.claude/CLAUDE.md <<'PROFILE_EOF'
<the exact saved block, markers included>
PROFILE_EOF
```

Tell them: every new session in that environment then starts with the profile;
the setup script is stored in their own environment settings, not in a
repository; to update the profile later, run `/spec` again and replace the
snippet. On a local machine (CLI or desktop app) no extra step is needed.
