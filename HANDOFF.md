# Handoff (2026-10-14)

## Goal
- Keep the user's Claude skills in this public repo so they work in every cloud session.
- Side project: product web page for the company gasket line (LEAKBLOK Premium P200),
  aimed at overseas promotion.

## Decisions
- Repo is a plugin marketplace; skills in `skills/`; default branch `master`; repo stays public.
  Never commit company photos, logos, specs or the product page here.
- Everything committed is in English; cap of 50 skills; merge PRs only when the user asks.
- task-observer loads only via `/task`. No CLAUDE.md for now.
- Page languages: EN/JA/ZH(Simplified)/KO; auto by browser language, `?lang=xx`, saved choice.
- Fluid-flow effect: pure CSS layers over the install photo, always playing (also under
  reduced motion), no "hover to see" caption. It is an animation, not a video.

## Current state
- Live page (private artifact, owner only until shared via its Share menu):
  https://claude.ai/artifact/Xi7TAmVCaERS6y1qxb3TZP — v3. To edit in a new session, read
  it with the Artifact tool (`action: read`), change the saved file, republish with that `url`.
- The user holds `leakblok-p200-v3.html` and `leakblok-site-patch.zip` (build.py, i18n.py
  copy for all languages, i18n.js, body.html, gen_assets.js, pre-rendered mask/texture).
  Build: `node gen_assets.js <v1.html>` then `python3 build.py <v1.html> <out.html>`, where
  v1 is the original single-file build. The older `leakblok-site-source.zip` is outdated.
- Mobile fixes done: vertical swipe scrolls past the 3D viewer, tighter hero, photo
  fallback when JS/WebGL is missing. Verified only in headless Chromium, not real devices.
- Branch `claude/sleepy-johnson-3s1aqg` (no PR): inspiration references for
  design-taste-frontend. Pre-existing CI failure: `claude-mem` plugin name is rejected
  (reserved "claude-" prefix).

## Next steps
1. Ask whether the flow now plays on the user's real PC and phone (v2 did not).
2. Fill placeholders ("[Copy TBD]" lines, spec values, contact info) in all four languages;
   get JA/ZH wording checked by a native speaker.
3. Public hosting: Cloudflare Pages or Netlify (free); a custom domain is optional.
4. Ask whether sheets ship rolled or flat; maybe drop the "drag to rotate" hint too.
5. Skill candidates (not logged; no persistent task-observer store exists, repo is public):
   internal product-page workflow, open-source page-i18n skill, mobile QA rules for
   design-taste-frontend (no scroll trap on 3D, compositor animations over canvas loops).

## Notes
- User request with /new: (no extra text)
- The user works only in cloud sessions, is token-conscious, prefers plain Korean in chat.
- Do not invent product specs or claims; mark unknowns as placeholders.
- Image generation is not available; visuals come from the user's photos or 3D code.
