# Handoff (2026-10-02)

## Goal
- Keep the user's Claude skills in this public repo so they work in every cloud session.
- Side project: a product web page for the user's company gasket line (built outside the repo).

## Decisions
- Repo is a Claude Code plugin marketplace; skills live in `skills/`; default branch `master`.
- Repo stays **public** (the setup script clones it without credentials). Never commit company
  photos, logos, specs or the product page here; keep them in the session scratchpad only.
- Everything committed is in English; cap of 50 skills; merge PRs only when the user asks.
- task-observer loads only via `/task`. No CLAUDE.md for now.
- SiteSee (sitesee.co) and Varchive (varchive.ai) are design references, not skills.
  Both domains were added to the environment's custom network allowlist.

## Current state
- Branch `claude/sleepy-johnson-3s1aqg` (pushed, no PR yet): adds
  `skills/design-taste-frontend/references/inspiration.md` + a one-line pointer in its
  SKILL.md (local change recorded in `UPSTREAM.txt`).
- Pre-existing failure: `scripts/check-skills.sh` -> `claude plugin validate` rejects the
  marketplace plugin name `claude-mem` (reserved "claude-" prefix). Not fixed yet.
- Product page: single-file HTML with three.js (bundled inline). The user holds the files:
  the built HTML and `leakblok-site-source.zip` (src/app.js, template.html, build.py, img/).
  Build: `npm i three@0.160.0 esbuild` then `python3 build.py`.
- Page features: rotatable 3D gasket and thick sheet roll (unroll button/slider, 3t/1.5t),
  installation photo with hover fluid-flow effect, white company logo in header and footer.
- v2 (2026-10-02): built by patching the v1 HTML with `leakblok-site-patch.zip`
  (`python3 build.py <v1.html> <out.html>`), so the original source zip is now outdated.
  Adds EN/JA/ZH/KO switcher (auto by browser language, `?lang=xx`, saved choice; copy in
  `i18n.py`), fluid flow redone as CSS layers (no per-frame JS), mobile fixes (vertical
  swipe scrolls past the 3D viewer, tighter hero, photo fallback when JS/WebGL is missing).
- The user could not get the "infinite loading on hover" bug to show up here; the
  rewrite removes the old canvas loop that most likely caused it.

## Next steps
1. If the user wants a PR for the inspiration-references branch, fix the `claude-mem`
   name first so CI passes.
2. Product page: fill in placeholders the user must supply ("[문구 확인 필요]" copy, spec
   values, contact link); swap in high-res photos and an official white logo if given.
3. Confirm the JA/ZH wording with a native speaker; host the page (static hosting such as
   Cloudflare Pages or Netlify; a custom domain is optional).
4. Ask whether sheets ship rolled or flat; if flat, start the sheet view unrolled.
5. Parked: small custom skills for repeated work tasks (e.g. product pages); a design
   vocabulary skill from SiteSee picks (user likes calm, premium dark layouts such as
   Prepd; dislikes busy layouts such as F37 Foundry).

## Notes
- User request with /new: (no extra text)
- The user works only in cloud sessions, is token-conscious, prefers plain Korean in chat.
- Do not invent product specs or performance claims; mark unknowns as placeholders.
- Headless Chromium here renders WebGL at ~5 fps; animations must be time-based, not per-frame.
- Image generation is not available; product visuals come from the user's photos or 3D code.
