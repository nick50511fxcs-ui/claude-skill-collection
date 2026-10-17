# Campfire Chronicle (모닥불 연대기)

An idle pixel-art RPG for the browser about a single adventurer. The hero fights
until out of stamina, then rests at a campfire and works a life skill (mining,
woodcutting, foraging, fishing, hunting, alchemy). Life-skill levels are never
lost on rebirth and permanently strengthen combat. Every action rolls for loot,
down to 0.0001% primordial drops. Player-facing text is Korean.

Visual direction follows Legends of Idleon (side-view pixel scenes, navy panels,
slot grids, bottom command bar); all art here is original and drawn in code.

## Play

- Open `dist/play.html` in a browser (no server needed), or
- serve the folder (`python3 -m http.server`) and open `index.html` (dev build that loads the ES modules directly).

Progress is saved to `localStorage` every 10 seconds. Use **설정 → 내보내기** to keep a backup string;
browsers may clear site data.

## What is in the MVP

| System | Status |
|---|---|
| Campfire cycle (fight → tired → camp + life skill → fight), "life focus" toggle | done |
| Combat: 3 regions × 10 floors + endless tower (31+), unique bosses every 10 floors (warning banner, boss HP bar, slam every 4th hit), elites every 5 floors, first-kill gear reward, golden / giant / ancient variants | done |
| Guided tutorial (10 steps, replayable from settings) and one-time tips; life skills unlock in a chain | done |
| Region walls that slow instead of stop: poison fog (stamina ×2.5), ice (attack speed −40%), countered by life skills or potions | done |
| 7 leveled tasks (combat mastery + 6 life skills), uncapped levels, tool tier every 100, awakenings at 250/500/750, master at 1000 | done |
| 5 spots per gathering skill, each drawn differently (crystal cave, meteor crater, world tree, deep sea, unicorn ...), seasonal fish, fish weight records | done |
| Alchemy: 10 recipes, potions auto-used per fight, permanent elixirs, great success / miracle / failure, secret recipe | done |
| Rarity: common → primordial (0.0001%), luck stat with cap, sqrt luck on myth/primordial, soft pity, stacking primordials | done |
| Rebirth (ash, 3 perk trees, clone slots), memory cards (1 of 3 per life) | done |
| Offline progress with no cap (long absences compute in one-day chunks behind a progress note), "return journal" report, replay of big drops | done |
| Codex with permanent bonuses, hall of fame, log, export / import, seeded RNG stored in the save | done |
| Second and third prestige layers, crafting gear from materials, cooking, cloud save, sound | not yet |

## Layout

```
index.html          dev page (ES modules)
page.html           shared markup used by the build
css/game.css        all styles
js/data.js          items, skills, spots, recipes, monsters, regions, perks
js/engine.js        pure game logic (no DOM), shared with the simulator
js/rng.js           seeded RNG
js/sprites.js       pixel art grids, icon templates, bitmap font
js/render.js        canvas scenes, stations, effects
js/ui.js            panels, bar, toasts, modals
js/main.js          boot, loops, save, offline catch-up
build.mjs           bundles everything into dist/*.html
sim/simulate.mjs    balance simulator (runs the real engine for a simulated year)
sim/last-run.txt    latest simulator output
```

## Build and balance

```bash
node build.mjs                 # -> dist/play.html, dist/campfire-chronicle.html, index.html
node sim/simulate.mjs          # 1-year run, ~90 s
node sim/simulate.mjs --days 7 # quick check
```

The simulator uses an "always online, sensible idle player" policy, so its times
are a lower bound for real players. Key results of the last run
(`sim/last-run.txt`):

| Milestone | Simulated time |
|---|---|
| One skill to Lv 1000, focused (life-focus mode, no bonuses) | 116 days (target: 3-4 months) |
| All six life skills unlocked (mining 10 -> wood 10 -> forage 15 -> fish 15 -> hunt 20 -> alchemy) | < 1 day |
| Floor 21 (rebirth unlocked) | 1.8 h |
| First rebirth | 4.3 h |
| First legend / myth / primordial | 5.2 h / 41 h / 5.5 days |
| Gathering skills at Lv 400 / 1000 / 1600 (bot with maxed rebirth perks) | 30 / ~92 / 180 days |
| Best floor | 132 (30 d), 254 (180 d), 292 (365 d) |
| Codex 128/129 | 1 year |

## Debug

Open the page with `#debug` to expose `window.__cc` (game, renderer, ui), e.g.
`__cc.game().fastForward(3600)` or `__cc.renderer.queueFx({ tier: 6, id: 's_prim' })`.
