// Balance simulator: runs the real engine (js/engine.js) for a simulated year
// with a simple "idle player" policy and prints progression checkpoints.
//
//   node sim/simulate.mjs            # full report (1 year, ~1-2 min)
//   node sim/simulate.mjs --days 30  # shorter run
//   node sim/simulate.mjs --json     # machine-readable output
import { Game, newState, xpNeed, ACTION_TIME, toolTier, pity as pityFn } from '../js/engine.js';
import { TIERS, TIER_P, SPOT_LV, SPOT_XP, SPOTS, RECIPES, SKILLS, PERKS, ITEMS } from '../js/data.js';

const args = process.argv.slice(2);
const DAYS = Number(args[args.indexOf('--days') + 1]) || (args.includes('--days') ? 30 : 365);
const JSON_OUT = args.includes('--json');
const SEED = 20261014;

// ---------- 1. Analytic: time for one skill to reach a level (focused, 24h/day) ----------
function timeToLevel(target, xpMult = 1) {
  let t = 0;
  for (let lv = 1; lv < target; lv++) {
    const spot = SPOT_LV.filter(l => lv >= l).length - 1;
    const speed = 1 + 0.1 * toolTier(lv);
    t += (xpNeed(lv) / (SPOT_XP[spot] * xpMult)) * (ACTION_TIME / speed);
  }
  return t;
}
const fmt = sec => {
  if (sec < 3600) return `${Math.round(sec / 60)}분`;
  if (sec < 86400 * 2) return `${(sec / 3600).toFixed(1)}시간`;
  return `${(sec / 86400).toFixed(1)}일`;
};
const levelTable = [10, 50, 100, 250, 500, 750, 1000].map(lv => ({
  lv, base: timeToLevel(lv), boosted: timeToLevel(lv, 1.5),
}));

// ---------- 2. Analytic: expected wait per tier ----------
const actionsPerDay = 86400 / ACTION_TIME;
const tierTable = TIER_P.map((p, i) => (p ? { tier: TIERS[i].name, p, days: 1 / p / actionsPerDay } : null)).filter(Boolean);

// ---------- 3. Monte Carlo: chance of no primordial in a year with/without pity ----------
function noDropChance(share, pity, runs = 4000) {
  const actions = Math.floor(actionsPerDay * 365 * share);
  const p = TIER_P[6];
  const e = 1 / p;
  let miss = 0;
  for (let r = 0; r < runs; r++) {
    let dry = 0, got = false;
    // Walk in chunks: before 1.5x expected the per-action chance is flat.
    const flat = pity ? Math.min(actions, Math.floor(1.5 * e)) : actions;
    if (Math.random() < 1 - Math.pow(1 - p, flat)) got = true;
    dry = flat;
    while (!got && dry < actions) {
      const chunk = Math.min(5000, actions - dry);
      const mult = pityFn(dry / e);
      if (Math.random() < 1 - Math.pow(1 - p * mult, chunk)) got = true;
      dry += chunk;
    }
    if (!got) miss++;
  }
  return miss / runs;
}
const pityTable = [1, 0.5, 0.2].map(share => ({
  share, noPity: noDropChance(share, false), pity: noDropChance(share, true),
}));

// ---------- 4. Full engine run with an idle-player policy ----------
const START = Date.UTC(2026, 0, 1);
const s = newState(SEED);
const g = new Game(s, { clock: () => START + s.time * 1000, quiet: true, simStep: 1 });

const GATHER = ['mining', 'wood', 'forage', 'fish', 'hunt'];
let lastBest = 0, lastBestAt = 0, lifeStart = 0, firstRebirthAt = null, firstFloor20 = null;
const firstTier = {};

function policy() {
  const sk = s.skills;
  // Spots: always the best unlocked one.
  for (const k of GATHER) s.spots[k] = SPOT_LV.filter(l => sk[k].lv >= l).length - 1;
  // Alchemy target: the best recipe it can learn; send gatherers back to the
  // spots that produce whatever input is running low.
  const target = RECIPES.filter(r => !r.secret && sk.alchemy.lv >= r.lv && (!r.max || g.crafted(r) < r.max)).sort((a, b) => b.lv - a.lv)[0];
  if (target) {
    for (const id in target.in) {
      if ((s.items[id] || 0) >= target.in[id] * 5) continue;
      const k = ITEMS[id].skill;
      if (!SPOTS[k]) continue;
      const spot = SPOTS[k].findIndex(sp => sp.items.includes(id));
      if (spot >= 0 && spot < SPOT_LV.filter(l => sk[k].lv >= l).length) s.spots[k] = spot;
    }
  }
  const craftable = RECIPES.filter(r => g.canCraft(r)).sort((a, b) => b.lv - a.lv);
  if (craftable.length) s.recipe = craftable[0].id;
  // Slots: lowest gather skills; alchemy takes a slot when it has materials.
  const order = [...GATHER].sort((a, b) => sk[a].lv - sk[b].lv);
  const wantAlch = craftable.length > 0 && sk.alchemy.lv < Math.max(...GATHER.map(k => sk[k].lv)) * 0.8;
  const pickList = wantAlch ? ['alchemy', ...order] : order;
  s.slots.forEach((slot, i) => { if (slot.k !== pickList[i]) g.setSlotSkill(i, pickList[i]); });
  // Rebirth when progress stalls for an hour.
  const c = s.char;
  if (c.maxFloor > lastBest) { lastBest = c.maxFloor; lastBestAt = s.time; }
  if (c.maxFloor >= 21 && firstFloor20 === null) firstFloor20 = s.time;
  if (g.canRebirth() && s.time - lastBestAt > 3600 && s.time - lifeStart > 1800) {
    g.rebirth();
    if (firstRebirthAt === null) firstRebirthAt = s.time;
    g.chooseMemory(s.rb.choices[0]);
    let bought = true;
    while (bought) {
      bought = false;
      const ids = Object.keys(PERKS).filter(id => !PERKS[id].max || (s.rb.perks[id] || 0) < PERKS[id].max);
      ids.sort((a, b) => (PERKS[a].base * PERKS[a].grow ** (s.rb.perks[a] || 0)) - (PERKS[b].base * PERKS[b].grow ** (s.rb.perks[b] || 0)));
      for (const id of ids) if (g.buyPerk(id)) { bought = true; break; }
    }
    lastBest = 0;
    lastBestAt = s.time;
    lifeStart = s.time;
  }
  for (const id in s.codex) {
    const t = ITEMS[id].tier;
    if (t >= 4 && firstTier[t] === undefined) firstTier[t] = s.time;
  }
}

const checkpoints = [1 / 24, 1, 7, 30, 90, 180, 365].filter(d => d <= DAYS);
const rows = [];
const t0 = Date.now();
let day = 0;
const STEP = 600; // policy runs every 10 simulated minutes
while (day < DAYS) {
  g.advance(STEP, false);
  policy();
  day = s.time / 86400;
  if (checkpoints.length && day >= checkpoints[0]) {
    checkpoints.shift();
    const tiers = [0, 0, 0, 0, 0, 0, 0];
    for (const id in s.items) tiers[ITEMS[id].tier] += s.items[id];
    rows.push({
      day: +day.toFixed(2),
      bestFloor: s.rb.bestFloor,
      rebirths: s.rb.count,
      skills: Object.fromEntries(Object.keys(SKILLS).map(k => [k, s.skills[k].lv])),
      totalLv: Object.values(s.skills).reduce((a, b) => a + b.lv, 0),
      codex: Object.keys(s.codex).length,
      myth: tiers[5], prim: tiers[6], legend: tiers[4],
    });
  }
}
const runtime = (Date.now() - t0) / 1000;

const report = { levelTable, tierTable, pityTable, rows, firstRebirthAt, firstFloor20, firstTier, runtime, days: DAYS };
if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('\n# 1. 한 스킬만 계속 돌릴 때 레벨 도달 시간 (24시간 기준)');
  console.log('Lv\t보너스 없음\t경험치 +50%');
  for (const r of levelTable) console.log(`${r.lv}\t${fmt(r.base)}\t\t${fmt(r.boosted)}`);
  console.log('\n# 2. 등급별 기대 대기 시간 (한 Task 3초/회, 24시간)');
  for (const r of tierTable) console.log(`${r.tier}\t${(r.p * 100).toPrecision(2)}%\t${fmt(r.days * 86400)}`);
  console.log('\n# 3. 1년 동안 태초급을 한 번도 못 얻을 확률');
  for (const r of pityTable) console.log(`시간 비중 ${r.share * 100}%\t천장 없음 ${(r.noPity * 100).toFixed(1)}%\t천장 있음 ${(r.pity * 100).toFixed(1)}%`);
  console.log(`\n# 4. 엔진 전체 시뮬레이션 (${DAYS}일, ${runtime.toFixed(0)}초 소요)`);
  console.log(`21층 첫 도달: ${firstFloor20 === null ? '-' : fmt(firstFloor20)} · 첫 윤회: ${firstRebirthAt === null ? '-' : fmt(firstRebirthAt)}`);
  for (const [t, at] of Object.entries(firstTier)) console.log(`첫 ${TIERS[t].name}급 획득: ${fmt(at)}`);
  console.log('일\t최고층\t윤회\t총Lv\t도감\t전설\t신화\t태초\t스킬');
  for (const r of rows) console.log(`${r.day}\t${r.bestFloor}\t${r.rebirths}\t${r.totalLv}\t${r.codex}\t${r.legend}\t${r.myth}\t${r.prim}\t${Object.entries(r.skills).map(([k, v]) => k + ':' + v).join(' ')}`);
}
