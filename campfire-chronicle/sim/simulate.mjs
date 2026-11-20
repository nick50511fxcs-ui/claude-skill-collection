// Headless balance check: an auto-miner that spends everything greedily after each run.
// Prints play time against the deepest floor, gear and relics.   node sim/simulate.mjs [hours]
import { Game, newState, hpAt } from '../js/engine.js';
import { GEAR_SLOTS, ABILITIES, BUILDINGS, MISSIONS, ORES } from '../js/data.js';
import { writeFileSync } from 'node:fs';

const hours = Number(process.argv[2] || 30);
const g = new Game(newState(12345));
const DT = 0.1;
const lines = [];
let next = 0.25, play = 0;
const log = () => {
  const s = g.s;
  const relics = Object.values(s.relics).reduce((a, r) => a + r.lv, 0);
  lines.push(`${play.toFixed(2).padStart(6)}h  deepest ${String(s.stats.deepest).padStart(5)}  runs ${String(s.stats.runs).padStart(4)}  gear ${GEAR_SLOTS.map(k => s.gear[k]).join('/')}  up ${Object.values(s.up).join('/')}  abil ${ABILITIES.filter(a => s.abil[a.id]).length}  relicLv ${relics}  town ${BUILDINGS.map(b => s.town[b.id] || 0).join('/')}  atk ${g.d.atk.toFixed(0)} dur ${g.d.dur}`);
};
const spend = () => {
  let any = true;
  while (any) {
    any = false;
    for (const m of MISSIONS) while (g.claim(m.id)) any = true;
    while (g.openChest()) any = true;
    for (const k of GEAR_SLOTS) if (g.craft(k)) any = true;
    for (const a of ABILITIES) if (g.learn(a.id)) any = true;
    for (const b of BUILDINGS) if (g.build(b.id)) any = true;
    const ups = ['atk', 'dur', 'spd', 'luck'].sort((a, b) => g.upgradeCostOf(a).stone - g.upgradeCostOf(b).stone);
    if (g.buyUpgrade(ups[0])) any = true;
  }
};
while (play < hours) {
  // Start from the deepest checkpoint whose blocks the pickaxe can still break quickly.
  const opts = g.startOptions();
  const pick = opts.filter(f => hpAt(f) < g.d.atk * 1.5).at(-1) ?? 0;
  g.startRun(pick);
  while (!g.run.over) { g.advance(DT); g.events.length = 0; }
  play += (g.run.t + 5) / 3600;
  g.leaveRun();
  spend();
  if (play >= next) { log(); next *= 1.5; }
}
log();
const out = lines.join('\n');
console.log(out);
writeFileSync(new URL('./last-run.txt', import.meta.url), out + '\n' + ORES.map(o => `${o.name} ${g.s.res[o.id]}`).join(', ') + '\n');
