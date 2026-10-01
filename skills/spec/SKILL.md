---
name: spec
description: Keep the user's personal profile (career spec, skills, preferences) in a private file that loads only on demand. /spec save <spec>, /spec show, /spec clear, or /spec <request> to run a request with the profile.
disable-model-invocation: true
argument-hint: "save <spec> | show | clear | <request that needs your profile>"
---

# /spec — personal profile, loaded only when asked

The profile lives in `~/.claude/profile.md`. Claude Code does **not** load that
file automatically, so it costs no tokens in sessions that do not use it. It is
read only when the user types `/spec ...`.

Input: $ARGUMENTS

## Modes (decided by the first word of the input)

- **save `<spec>`** → save the profile (below).
- **show** → print `~/.claude/profile.md`, or say there is none and how to save one.
- **clear** → delete `~/.claude/profile.md`. In cloud sessions, also remind the user to remove the snippet from the Setup script.
- **empty input** → explain the four modes in one short list and stop.
- **anything else** → treat the input as a request that needs the profile
  (e.g. job search, company comparison, cover letter, interview prep). Read
  `~/.claude/profile.md` first; if it is missing, ask the user to run
  `/spec save <spec>` and stop. Then carry out the request using the profile.
  For a job or company search, cite a source link for each company and flag
  anything that could not be verified as current.

## Saving

1. **Strip sensitive data before writing.** Never store: resident registration
   number or any national ID, phone number, exact home address, email, account
   or card numbers, passwords. If the input contains any, drop them and tell the
   user what was left out.
2. **Normalize into this structure**, keeping the user's language. Omit
   sections with no information; do not invent anything.
   ```markdown
   # About me
   ## Summary          (one or two lines: who I am, what I am looking for)
   ## Education
   ## Experience       (role, organization, period, one-line outcome each)
   ## Skills & certifications
   ## Languages        (with test scores if given)
   ## Preferences      (target roles, industries, company size, region, salary, work style)
   ```
3. **Write** `~/.claude/profile.md`, replacing any previous version.
4. **Never write the profile into CLAUDE.md, AGENTS.md or any repository file**
   (this skill collection is public), and never commit or push it.
5. Show the saved profile and ask the user to correct anything wrong.

## Making it survive cloud sessions

If `CLAUDE_CODE_REMOTE=true`, the container's home directory is discarded when
the session ends. After saving, also give the user a ready-to-paste snippet for
their environment's **Setup script** (cloud environment menu in the session
title bar → Edit → Setup script), placed after any existing lines:

```bash
mkdir -p ~/.claude && cat > ~/.claude/profile.md <<'PROFILE_EOF'
<the exact saved profile>
PROFILE_EOF
```

Tell them: this only writes the file at session start; it is not read into the
conversation, so it costs no tokens until they type `/spec`. The setup script
is stored in their own environment settings, not in a repository. To update,
run `/spec save` again and replace the snippet. On a local machine (CLI or
desktop app) no extra step is needed.
