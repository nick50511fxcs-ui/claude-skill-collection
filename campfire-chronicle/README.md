# Campfire Chronicle (모닥불 연대기)

An idle pixel-art RPG for the browser about a single adventurer. The hero fights
until out of stamina, then rests at a campfire and works a life skill (mining,
woodcutting, foraging, fishing, hunting, alchemy). Life-skill levels are never
lost on rebirth and permanently strengthen combat. Every action rolls for loot,
down to 0.0001% primordial drops. Player-facing text is Korean.

Visual direction follows Legends of Idleon (side-view pixel scenes, navy panels,
slot grids, bottom command bar); all art here is original and drawn in code.
Characters use a chibi anime style (big head and eyes, 1px black outline added by `ol()` in
`js/sprites.js`) with every sprite drawn at native size on one pixel grid; bosses have their own
large sprites. Style references (not copied) are in `art-refs/`.

## Play

- Open `dist/play.html` in a browser (no server needed), or
- serve the folder (`python3 -m http.server`) and open `index.html` (dev build that loads the ES modules directly).

Progress autosaves every 10 minutes and whenever the tab is hidden or closed (browser storage, plus the
viewer's claude.ai cloud save when published as an artifact). The **저장** button saves at once.
Use **설정 → 내보내기** to keep a backup string; browsers may clear site data.

## What is in the MVP

| System | Status |
|---|---|
| Campfire cycle (fight → tired → camp + life skill → fight), "life focus" toggle | done |
| Active play: skill dock (switch activity in one click), combat skills (strike / heal / rage, keys 1-3, auto-cast at combat Lv 100), click the monster for extra hits, a chance event per life skill (weak spot, timing bar, bite, hidden herbs, running target, stirring), a wandering wisp with gifts, fever gauge (x2 speed for 30 s) | done |
| 1-on-1 duel combat: opponent drops in, both sides lunge, knockback, hit flash on the sprite, hero HP bar, spotlight | done |
| Each life skill has its own place per spot (mine shafts, crystal cave, meteor crater, forests, swamp, alpine, fairy garden, stream to deep sea, hunting grounds, alchemy workshop); clones show their own place | done |
| Gear goes to a bag (40 slots); equip / unequip / sell by hand, opt-in auto-equip, upgrade dot on the character button | done |
| Combat: 3 regions × 10 floors + endless tower (31+), unique bosses every 10 floors (warning banner, boss HP bar, slam every 4th hit), elites every 5 floors, first-kill gear reward, golden / giant / ancient variants | done |
| Guided tutorial (10 steps, replayable from settings) and one-time tips; life skills unlock in a chain | done |
| Region walls that slow instead of stop: poison fog (stamina ×2.5), ice (attack speed −40%), countered by life skills or potions | done |
| 7 leveled tasks (combat mastery + 6 life skills), uncapped levels, tool tier every 100, awakenings at 250/500/750, master at 1000 | done |
| 5 spots per gathering skill, each drawn differently (crystal cave, meteor crater, world tree, deep sea, unicorn ...), seasonal fish, fish weight records | done |
| Alchemy: 10 recipes, potions auto-used per fight, permanent elixirs, great success / miracle / failure, secret recipe | done |
| Rarity: common → primordial (0.0001%), luck stat with cap, sqrt luck on myth/primordial, soft pity, stacking primordials | done |
| Rebirth (ash, 3 perk trees, clone slots, all permanent), memory cards (1 of 3 per life), permanent +5% character XP per rebirth, past-life recall (x5 XP and at least 20% of a level per kill until 95% of the best level; back in ~25 min) | done |
| Offline progress with no cap (long absences compute in one-day chunks behind a progress note), "return journal" report, replay of big drops | done |
| 234 items (5 per spot, 8 rares per skill, boss trophies, 8 seasonal fish, 21 alchemy products), gear affixes; codex with permanent bonuses, hall of fame, log, export / import, seeded RNG stored in the save | done |
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
| Floor 21 (rebirth unlocked) | 2.2 h |
| First rebirth | 3.3 h |
| First myth / legend / primordial | 3.3 h / 27 h / 11 days |
| Gathering skills at Lv 430 / 1000 / 1660 (bot with maxed rebirth perks) | 30 / ~88 / 180 days |
| Best floor | 134 (30 d), 292 (180 d), 339 (365 d) |
| Codex 233/234 | 1 year |

## Debug

Open the page with `#debug` to expose `window.__cc` (game, renderer, ui), e.g.
`__cc.game().fastForward(3600)` or `__cc.renderer.queueFx({ tier: 6, id: 's_prim' })`.
