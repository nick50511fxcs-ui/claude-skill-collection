# Handoff (2026-10-18)

## Goal
- `campfire-chronicle/` is now "끝없는 광산", a portrait pixel mining game (rebuilt from the old idle RPG at the user's request, from concept screenshots of a mobile mining game). Endless shaft, resources → upgrades and gear, relics with permanent effects that level up on duplicates.

## Current state
- Branch `claude/vigilant-pascal-3eeqx2`. New data/engine/render/ui/main/css/page; sprites.js kept (hero, icons, `ol()`), plus ability/gear icons.
- Balance via `node sim/simulate.mjs [hours]` (greedy auto miner): 1000F ≈ 8 h sim time.
- Published artifact (update in place): https://claude.ai/artifact/Vv7YCsw5NTuJmTHicER4tt. Publish `dist/campfire-chronicle.html` (keeps capabilities db + user). Cloud save doc is now `data/users/<id>/mine`; local key `campfire-mine-save-v1` (old RPG saves are not migrated).

## Next steps (ideas, not requested yet)
- Village banner scenes like the concept's 마을 list; monsters in the mine; more abilities per tier; sound.
- Old sprites (monsters, animals, tools other than pick) in `js/sprites.js` are unused now.

## Notes
- The user writes in Korean and wants concise Korean replies. Fixes go in priority order when they number them.
- Login (ID/password) is still pending: the user must pick Firebase Auth or Supabase Auth and a host. Don't build insecure client-only auth.
- `[hidden]` needs the global `display:none!important` rule (already in css). Hit flashes must use `silhouette()`, not filled rectangles.
