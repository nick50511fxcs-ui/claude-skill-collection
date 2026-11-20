# Handoff (2026-11-20)

## Goal
- Keep the user's Claude skills in this public GitHub repo so they work in every
  cloud session (claude.ai/code) and on any machine, with low token overhead.
- This session: pick useful items from GitHub weekly/monthly trending for the user's work
  (games, documents, PPT/Word design) and add them.

## Decisions
- Repo is a plugin marketplace; skills live in `skills/`. Default branch is `master`. Keep it **public**.
- Plugins/tools with hooks or binaries are registered in `.claude-plugin/marketplace.json` (not copied);
  plain skills are copied with `UPSTREAM.txt`. Optional installs via `install.sh` flags.
- Cloud setup script (saved on the "Claude Skill" environment, changed through `update_environment` approval cards):
  `git clone ... /tmp/skills && bash /tmp/skills/install.sh --copy --with-headroom --with-impeccable --with-hallmark --with-stitch || true`
- From now on, propose environment changes (hosts, setup script) with `update_environment` and let the user approve; secrets are entered by the user in the environment's Network secrets.
- pixelfx: the upstream "Publish it on Patch" section (curl | sh CLI install) was removed on purpose (user will not publish); re-apply when updating.
- `claude-mem` entry renamed to `session-memory` (names starting with `claude-` are reserved); the `--with-claude-mem` flag name is unchanged.
- modern-web-guidance is only documented in `docs/external-tools.md` (npm CLI, mandatory-on-every-web-task skill): not installed.
- Not added: last30days-skill (user excluded), cloudflare/security-audit-skill, doc-coauthoring (no license file), docx/pptx/pdf/xlsx (built in).
- Merge PRs only when the user asks.

## Current state
- Merged: #11 (theme-factory, canvas-design, webapp-testing skills; plugins astryx, chrome-devtools-mcp, impeccable, hallmark, plannotator registered),
  #12 (session-memory rename, `--with-stitch`, stitch-design/stitch-utilities entries), #13 (pixelfx skill). No open PRs.
- 12 skills (cap 50). `claude plugin validate` and `scripts/check-skills.sh` pass.
- Stitch: MCP `https://stitch.googleapis.com/mcp`, key header `X-Goog-Api-Key`. The key is a Network secret on the environment (never in the repo);
  authenticated `list_projects` returned HTTP 200 via curl. `install.sh --with-stitch` registers the MCP with a placeholder header.

## Next steps
1. In a fresh session, verify the setup script worked: `claude plugin list` (impeccable, hallmark, stitch-design, stitch-utilities) and `claude mcp get stitch`.
2. Decide whether to keep both `hallmark` and `impeccable` alongside `design-taste-frontend` (all three overlap).
3. Parked: small custom skills for repeated work tasks (e.g. online-store product pages).

## Notes
- The user pasted a Stitch API key in chat once; it should be rotated and the environment secret updated.
- Allowed hosts added to the environment: stitch.withgoogle.com, stitch.google.com.
- Force-push is denied in this environment; when the work branch has old merged history, merge it with `git merge -s ours FETCH_HEAD` and push normally.
- Plannotator is registered but needs a browser UI and a `curl | bash` binary install; probably impractical in cloud sessions.
- The user works only in cloud sessions (desktop app) and prefers plain-language Korean explanations.
- User text after /new: none.
