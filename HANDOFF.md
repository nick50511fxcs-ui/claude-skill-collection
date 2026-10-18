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
- Art redraw done on branch `claude/vigilant-pascal-3eeqx2` (continues `claude/elegant-knuth-75u6c9`): chibi hero (stand / step / crouch, `HERO_HAND` grip), clone palette, all monsters at native 1x size, new boss sprites (treant, knight, eye, `frogking`, `yetiking`), animals, wisp fairy, outlined tools and bow, crown, a few icons. Outlines come from `ol()` in `js/sprites.js`.
- Monsters no longer scale 2x; giant/ancient variants draw at 2x. `MONSTERS.*.scale` was removed.
- Published artifact (update in place by URL): https://claude.ai/artifact/Vv7YCsw5NTuJmTHicER4tt. Publish `dist/campfire-chronicle.html` with capabilities `{db:{}, user:{}}`.
- Design doc artifact: https://claude.ai/artifact/W9yBrgS9HYepRrcRoYnrwk (rev 34).
- Build: `cd campfire-chronicle && node build.mjs` produces `dist/play.html`, `dist/campfire-chronicle.html`, and `index.html`. Sim: `node sim/simulate.mjs`.

## Next steps
- Station props (rocks, trees, bushes, cauldron in `js/render.js`) could get the same outline treatment.
- `drawAmbient` in `js/render.js` is never called (dead code).

## Notes
- The user writes in Korean and wants concise Korean replies. Fixes go in priority order when they number them.
- Login (ID/password) is still pending: the user must pick Firebase Auth or Supabase Auth and a host. Don't build insecure client-only auth.
- `[hidden]` needs the global `display:none!important` rule (already in css). Hit flashes must use `silhouette()`, not filled rectangles.
