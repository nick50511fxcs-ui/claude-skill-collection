# Handoff (2026-09-23)

## Goal
- Keep the user's Claude skills in this public GitHub repo so they work in every
  cloud session (claude.ai/code) and on any machine, with low token overhead.

## Decisions
- The repo is a Claude Code plugin marketplace; skills live in `skills/`. Default branch is `master`.
- Cloud setup script (already saved in the user's environment):
  `git clone --depth 1 https://github.com/nick50511fxcs-ui/claude-skill-collection.git /tmp/skills && bash /tmp/skills/install.sh --copy --with-headroom || true`
- The repo must stay **public**: the setup script has no GitHub credentials (a private repo failed with exit 128).
- task-observer is **not** auto-started (it costs ~15k tokens per session and cloud logs reset per session).
  It is turned on on demand with `/task`. The upstream feedback report was drafted, and the user chose not to file it.
- Cap of 50 skills (`scripts/check-skills.sh` plus the `check-skills` CI on every PR).
- Everything committed is in **English**; CI fails on Korean text outside vendored skills and HANDOFF.md.
- Headroom is installed as `headroom-ai[mcp]` (~430MB), not `[all]` (~7GB).
- OmniRoute is not installed: it sends prompts to third-party models.
- No CLAUDE.md for now (the user agreed it is not needed).
- Merge PRs only when the user asks.

## Current state
- Merged: PR #1 (marketplace, task-observer, installers), #3 (README setup notes),
  #4 (`/task` shortcut), #5 (`skill-intake` skill, 50-skill cap and CI).
- Closed without merging: PR #2 (task-observer autostart).
- **Open: PR #6** on branch `claude/peaceful-davinci-14ymag`, CI green.
  It adds the `/new` skill, the long-conversation reminder hook (100k tokens) and the English-only convention.
  This note is committed on that branch.

## Next steps
1. Merge PR #6 when the user says so. After that, new cloud sessions get `/new` and the reminder automatically.
2. Parked, per the user: build small custom skills for their repeated work tasks (e.g. online-store product pages).

## Notes
- User request with /new: "지금까지 대화 핵심들만 요약해서 저장해줘" (summarize only the key points so far).
- The user works only in cloud sessions: no always-on local PC, and Remote Control is not an option.
- The user is token-conscious and prefers plain-language Korean explanations in chat.
- `.claude/` writes trigger an approval prompt; that is why the note lives at the repo root.
- Windows (`install.ps1`) is untested and does not register the reminder hook.
