# 끝없는 광산 (Campfire Chronicle: mining)

A browser pixel-art mining game. A miner by the campfire digs down an endless
9-wide shaft until the pickaxe's durability runs out, then comes back to the
surface with stone, ore, gems and treasure chests. Player-facing text is Korean.

The folder keeps its old name; the game was rebuilt from the earlier idle RPG
(see git history up to `485ea8e`). Art is original and drawn in code: chibi
characters with a 1px outline (`ol()` in `js/sprites.js`), procedural block tiles.

## Play

- Open `dist/play.html` in a browser (no server needed), or
- serve the folder (`python3 -m http.server`) and open `index.html` (dev build with ES modules).

Controls: hold ← ↓ → (buttons, arrow keys, or press the block next to the miner) to dig
that way; **자동** mines on its own toward the best nearby ore; **🔥** (space) starts a
6-second frenzy when the gauge is full. **귀환** ends a run early and keeps the loot.

## Systems

| System | Notes |
|---|---|
| Runs | Start at any 25-floor checkpoint up to your best floor. One swing = 1 durability. Gravity, side digging, auto miner, frenzy gauge |
| Endless depth | A new ore every 100 floors (구리 → 철 → 은 → 금 → 사파이어 → 미스릴 → 아다만타이트 → 오리할콘 → 에테르 → 태초석); block HP ×3 per 100 floors; layer colours cycle and darken past 1000F |
| Blocks | rock, hard rock, ore, gem ore (보석), treasure chest |
| 제작 | Stat upgrades with stone (공격, 내구, 속도, 행운; uncapped) and 5 gear slots (곡괭이, 헬멧, 갑옷, 장화, 랜턴) crafted tier by tier from each ore |
| 어빌리티 | 9 abilities in 5 tiers (폭탄, 화염구, 번개, 냉기, 다이너마이트, 드릴, 메테오, 블랙홀, 초신성), auto-cast every N swings, learned and levelled to 5 with gems |
| 유물 | 19 relics in 4 rarities from treasure chests (opened at the base). Duplicates level a relic up to Lv 10 (1/3/6/10/…/55 copies); maxed duplicates turn into gems |
| 마을 | 6 buildings, Lv 1-10: 대장간, 식당, 제련소, 보물 창고, 행상인의 집, 광부 오두막 (idle stone and ore, also while the page is closed) |
| 미션 | 5 mission ladders with gem and chest rewards |
| Save | Browser storage, plus a per-viewer cloud save when published as an artifact; export/import. A run in progress is banked when the tab closes |

## Layout

```
page.html / css/game.css   portrait 9:16 stage, HUD, panels
js/data.js       ores, layers, gear, upgrades, abilities, relics, buildings, missions
js/engine.js     pure game logic (no DOM), shared with the simulator
js/rng.js        seeded RNG
js/sprites.js    pixel grids, ol() outline, icons, bitmap font
js/render.js     block tiles, mine view, ability effects, surface camp
js/ui.js         base screen, run HUD and controls, panels, modals
js/main.js       boot, loops, input, save, idle payout
build.mjs        bundles everything into dist/*.html
sim/simulate.mjs balance check: greedy auto miner (node sim/simulate.mjs [hours])
```

## Balance (sim, greedy auto play with no time between runs)

100F ≈ 30 min, 500F ≈ 2 h, 1000F ≈ 8 h, then slow endless progress (≈1370F at 70 h).
Real players take longer. Latest output: `sim/last-run.txt`.

## Debug

Open the page with `#debug` to expose `window.__cc` (game, renderer, ui).
