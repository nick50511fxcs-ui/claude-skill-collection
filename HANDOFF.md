# Handoff (2026-10-18)

## Goal
- "모닥불 연대기" (Campfire Chronicle): a Korean web idle RPG in `campfire-chronicle/` (one hero, rebirth, 6 life skills, 1v1 duels, year-long play).
- **Open request from the user:** "지금 도트는 인간 같지 않아 … 해당 이미지들 참고하여 게임 내 도트 전부 다 바꿔줘". Redraw ALL in-game pixel art in the style of the reference images.

## Decisions
- Reference images are in `campfire-chronicle/art-refs/` (3.png, 4.png, 5.png, 6.webp). Their style: chibi anime characters about 2.5 heads tall, a 1px black outline, big expressive eyes, detailed hair, clean pastel or saturated palettes, small feet, and a soft ground shadow. Draw ORIGINAL characters in that style; do not copy any character from the images (Blue Archive and similar are third-party IP).
- Art is drawn in code as pixel grids in `js/sprites.js` and rendered on a 384×216 canvas by `js/render.js`, with `sprite()`, `silhouette()` for hit flashes, and `drawRotated`. Keep that pipeline unless a larger sprite size needs changes in render.
- The hero should look human: the current `HERO` is 16×24, so the redraw probably needs about 24×32 with a face, eyes, hair, and outline. Update `HERO_LEG`, `HERO_STEP`, `HERO_CROUCH*`, `CLONE_PAL`, and every pose used by the stations (mine, chop, forage, fish, hunt, stir).
- Monsters, bosses, animals, stations and icons should be restyled to match: black outline and cute-but-menacing faces.
- Engine/data are done and balanced (sim: Lv 1000 in 116 days for one focused skill, codex 233/234 at 1 year). Do not rebalance while doing art.

## Current state
- Branch `claude/elegant-knuth-75u6c9`, last feature commit `b4f0b36` (active play, skill dock, 234 items, prior art pass).
- Published artifact (update in place by URL): https://claude.ai/artifact/Vv7YCsw5NTuJmTHicER4tt. Publish `dist/campfire-chronicle.html` with capabilities `{db:{}, user:{}}`.
- Design doc artifact: https://claude.ai/artifact/W9yBrgS9HYepRrcRoYnrwk (rev 34).
- Build: `cd campfire-chronicle && node build.mjs` produces `dist/play.html`, `dist/campfire-chronicle.html`, and `index.html`. Sim: `node sim/simulate.mjs`.

## Next steps
1. Look at `art-refs/`, then redraw the hero (all poses) and the clone palette in `js/sprites.js`. Adjust offsets in `js/render.js` for the new size.
2. Redraw the monsters, bosses (treant, knight, eye, and the others in data `MONSTERS`), animals, and the wisp in the same style.
3. Restyle the stations and item icons if time allows.
4. Build, then check with Playwright screenshots (Chromium at `/opt/pw-browsers`, Playwright from the global npm root, `#debug` exposes `window.__cc`). Make sure there are no console errors.
5. Commit, push, republish the artifact, and update the README art line. Reply in Korean.

## Notes
- The user writes in Korean and wants concise Korean replies. Fixes go in priority order when they number them.
- Login (ID/password) is still pending: the user must pick Firebase Auth or Supabase Auth and a host. Don't build insecure client-only auth.
- `[hidden]` needs the global `display:none!important` rule (already in css). Hit flashes must use `silhouette()`, not filled rectangles.
