// Pure game logic for the mining game (no DOM), shared with the simulator.
// The base: upgrades, gear, abilities, relics, village, missions, idle miners.
// A run: dig down an endless 9-wide shaft until the pickaxe's durability runs out.
import { makeRng } from './rng.js';
import {
  COLS, LAYER_SIZE, ORES, GEAR, GEAR_SLOTS, gearCost, UPGRADES, upgradeCost, ABILITIES, ABILITY, ABIL_MAX,
  abilityUnlockFloor, abilityCost, RARITY, RELICS, RELIC, RELIC_COPIES, RELIC_MAX, BUILDING, BUILD_MAX, buildCost, MISSIONS,
} from './data.js';

export const VERSION = 1;
const BASE_INTERVAL = 0.5;
const BASE_DUR = 80;
const GAUGE_MAX = 30;
const FRENZY_SEC = 6;
export const CHECKPOINT = 25;

export function newState(seed = (Math.random() * 2 ** 32) >>> 0) {
  return {
    v: VERSION, seed, rngState: seed, time: 0, lastSeen: Date.now(),
    res: { stone: 0, gems: 0, chests: 0, ...Object.fromEntries(ORES.map(o => [o.id, 0])) },
    gear: Object.fromEntries(GEAR_SLOTS.map(k => [k, 0])),
    up: Object.fromEntries(Object.keys(UPGRADES).map(k => [k, 0])),
    abil: {}, relics: {}, town: {}, missions: {},
    stats: { deepest: 0, blocks: 0, runs: 0, opened: 0 },
    auto: true, start: 0, idleAcc: { stone: 0, ore: 0 }, tips: {},
  };
}

// Fill in fields added later so older saves keep loading; saves from the old RPG start fresh.
export function migrate(raw) {
  if (!raw || raw.v !== VERSION || !raw.res) return newState();
  const base = newState(raw.seed);
  const s = { ...base, ...raw };
  for (const k of ['res', 'gear', 'up', 'stats', 'idleAcc']) s[k] = { ...base[k], ...(raw[k] || {}) };
  return s;
}

export const hpAt = y => 4 * Math.pow(3, y / LAYER_SIZE);
export const layerOf = y => Math.floor(y / LAYER_SIZE);
const HP_MULT = { rock: 1, ore: 1.4, gem: 2.5, chest: 2, hard: 3.5 };
export const relicLevel = copies => RELIC_COPIES.filter(c => copies >= c).length;

export class Game {
  constructor(state) {
    this.s = state;
    this.events = [];
    this.rng = makeRng(state.rngState ?? state.seed);
    this.run = null;
    this.calc();
  }

  emit(e) { this.events.push(e); }
  serialize() {
    this.s.rngState = this.rng.getState();
    this.s.lastSeen = Date.now();
    return JSON.stringify(this.s);
  }

  // ---------- Derived stats ----------
  relicFx() {
    const fx = {};
    for (const [id, r] of Object.entries(this.s.relics)) {
      const def = RELIC[id];
      if (!def || !r.lv) continue;
      for (const [k, v] of Object.entries(def.fx)) fx[k] = (fx[k] || 0) + v * r.lv;
    }
    return fx;
  }
  calc() {
    const s = this.s, fx = this.relicFx(), t = k => s.town[k] || 0, g = s.gear;
    const luck = (1 + s.up.luck * UPGRADES.luck.per + GEAR.lamp.val(g.lamp) + (fx.luck || 0)) * (1 + (fx.luckMul || 0));
    this.d = {
      atk: GEAR.pick.val(g.pick) * (1 + s.up.atk * UPGRADES.atk.per + (fx.atk || 0) + t('smith') * BUILDING.smith.per) * (1 + (fx.atkMul || 0)),
      dur: Math.round((BASE_DUR + s.up.dur * UPGRADES.dur.per + GEAR.helm.val(g.helm) + (fx.durFlat || 0)) * (1 + GEAR.armor.val(g.armor) + t('inn') * BUILDING.inn.per + (fx.durPct || 0))),
      interval: Math.max(0.08, BASE_INTERVAL * Math.pow(1 - UPGRADES.spd.per, s.up.spd) * (1 - GEAR.boots.val(g.boots)) * (1 - Math.min(0.5, fx.spd || 0))),
      luck,
      crit: Math.min(0.5, 0.05 * luck),
      ore: 0.1 * Math.min(2, Math.sqrt(luck)) * (1 + (fx.ore || 0)),
      chest: 0.0015 * Math.sqrt(luck) * (1 + (fx.chest || 0) + t('vault') * BUILDING.vault.per),
      gem: 0.006 * Math.sqrt(luck) * (1 + (fx.gem || 0)),
      double: Math.min(0.9, 0.05 * luck + (fx.double || 0) + t('smelter') * BUILDING.smelter.per),
      abil: 1 + (fx.abil || 0),
      cd: Math.max(0.6, 1 - (fx.cd || 0)),
      stone: 1 + (fx.stone || 0),
      revive: fx.revive || 0,
      costMul: 1 - t('trader') * BUILDING.trader.per,
      idle: t('hut') * 40 * (1 + (fx.idle || 0)),
    };
    return this.d;
  }
  abilEvery(a) { return Math.max(4, Math.round((a.every - ((this.s.abil[a.id] || 1) - 1)) * this.d.cd)); }
  abilMult(a) { return a.mult * (1 + 0.3 * ((this.s.abil[a.id] || 1) - 1)) * this.d.abil; }

  // ---------- Time ----------
  advance(dt) {
    this.s.time += dt;
    this.idleTick(dt);
    if (this.run && !this.run.over) this.runStep(dt);
  }
  // Village miners keep digging while the page is closed. No cap.
  idleTick(sec) {
    const d = this.d, s = this.s;
    if (!d.idle) return { stone: 0, ore: 0, oreId: null };
    const oreId = ORES[Math.min(ORES.length - 1, layerOf(s.stats.deepest))].id;
    s.idleAcc.stone += (d.idle * (1 + s.stats.deepest / 50) * sec) / 3600;
    s.idleAcc.ore += ((s.town.hut || 0) * 1.5 * sec) / 3600;
    const st = Math.floor(s.idleAcc.stone), or = Math.floor(s.idleAcc.ore);
    s.idleAcc.stone -= st; s.idleAcc.ore -= or;
    s.res.stone += st;
    s.res[oreId] += or;
    return { stone: st, ore: or, oreId };
  }
  fastForward(sec) {
    const out = { sec, stone: 0, ore: 0, oreId: null };
    for (let done = 0; done < sec;) {
      const step = Math.min(3600, sec - done);
      const r = this.idleTick(step);
      out.stone += r.stone; out.ore += r.ore; out.oreId = r.oreId;
      done += step;
    }
    this.s.time += sec;
    return out;
  }

  // ---------- Run ----------
  startOptions() {
    const top = Math.floor(this.s.stats.deepest / CHECKPOINT) * CHECKPOINT;
    const out = [];
    for (let f = 0; f <= top; f += CHECKPOINT) out.push(f);
    return out;
  }
  startRun(floor = this.s.start) {
    if (this.run && !this.run.over) return false;
    this.calc();
    floor = Math.max(0, Math.min(floor, this.startOptions().at(-1)));
    this.s.start = floor;
    const d = this.d;
    this.run = {
      seed: (this.rng() * 2 ** 32) >>> 0, start: floor, x: Math.floor(COLS / 2), y: floor,
      dur: d.dur, maxDur: d.dur, swing: 0, hits: 0, broken: 0, rows: new Map(),
      loot: { stone: 0, gems: 0, chests: 0, ores: {} }, dir: 'down', face: 1,
      anim: null, gauge: 0, frenzy: 0, haste: 0, revived: false, deepest: floor, abil: {}, input: null, t: 0, over: false,
    };
    this.s.stats.runs++;
    this.emit({ t: 'start', floor });
    return true;
  }
  row(y) {
    const run = this.run;
    let r = run.rows.get(y);
    if (r) return r;
    const rng = makeRng((run.seed ^ Math.imul(y + 1, 0x9e3779b1)) >>> 0);
    r = [];
    const d = this.d, hp = hpAt(y), L = Math.min(ORES.length - 1, layerOf(y));
    for (let x = 0; x < COLS; x++) {
      if (y < run.start || (y === run.start && x === run.x)) { r.push(null); continue; }
      const v = rng();
      let c;
      if (v < d.chest) c = { t: 'chest' };
      else if (v < d.chest + d.gem) c = { t: 'gem' };
      else if (v < d.chest + d.gem + d.ore) c = { t: 'ore', o: pickOre(L, rng) };
      else if (y > 30 && v > 0.95) c = { t: 'hard' };
      else c = { t: 'rock' };
      c.max = c.hp = hp * HP_MULT[c.t] * (0.85 + rng() * 0.3);
      c.v = (rng() * 4) | 0; // sprite variant
      r.push(c);
    }
    run.rows.set(y, r);
    // Drop rows far above the miner to bound memory on long runs.
    if (run.rows.size > 80) for (const k of run.rows.keys()) if (k < run.y - 30) run.rows.delete(k);
    return r;
  }
  cell(x, y) { return x < 0 || x >= COLS ? undefined : this.row(y)[x]; }

  runStep(dt) {
    const run = this.run;
    run.t += dt;
    run.frenzy = Math.max(0, run.frenzy - dt);
    run.haste = Math.max(0, run.haste - dt);
    if (this.s.auto && run.gauge >= GAUGE_MAX) this.frenzy();
    if (run.anim) {
      run.anim.t += dt;
      if (run.anim.t < run.anim.dur) return;
      run.anim = null;
    }
    // Gravity first.
    if (this.cell(run.x, run.y + 1) === null) { this.moveTo(run.x, run.y + 1, 0.07); return; }
    const dir = this.chooseDir();
    if (!dir) { run.swing = 0; return; }
    run.dir = dir;
    if (dir !== 'down') run.face = dir === 'left' ? -1 : 1;
    const tx = run.x + (dir === 'left' ? -1 : dir === 'right' ? 1 : 0), ty = run.y + (dir === 'down' ? 1 : 0);
    const c = this.cell(tx, ty);
    if (c === undefined) return;
    if (c === null) { run.swing = 0; this.moveTo(tx, ty, 0.14); return; }
    const iv = this.d.interval * (run.frenzy > 0 ? 0.5 : 1) * (run.haste > 0 ? 0.7 : 1);
    run.swing += dt;
    while (run.swing >= iv && !run.over) {
      run.swing -= iv;
      this.swingAt(tx, ty);
      if (this.cell(tx, ty) === null) { run.swing = 0; break; }
    }
  }
  moveTo(x, y, dur) {
    const run = this.run;
    run.anim = { fx: run.x, fy: run.y, t: 0, dur };
    run.x = x; run.y = y;
    if (y > run.deepest) run.deepest = y;
    if (y > this.s.stats.deepest) {
      this.s.stats.deepest = y;
      if (y % 100 === 0) this.emit({ t: 'layer', y });
    }
  }
  // Manual input wins; otherwise the auto miner heads for the best nearby block or digs down.
  chooseDir() {
    const run = this.run;
    if (run.input) return run.input;
    if (!this.s.auto) return null;
    let best = null, bestV = 0;
    for (let dy = 0; dy <= 2; dy++) {
      const y = run.y + dy, r = this.row(y);
      for (let x = 0; x < COLS; x++) {
        const c = r[x];
        if (!c || Math.abs(x - run.x) > 3) continue;
        const v = c.t === 'chest' ? 12 : c.t === 'gem' ? 9 : c.t === 'ore' ? 5 + c.o : 0;
        const score = v - Math.abs(x - run.x) * 2 - dy;
        if (v && score > bestV) { bestV = score; best = { x, y }; }
      }
    }
    if (best && best.x !== run.x) return best.x < run.x ? 'left' : 'right';
    return 'down';
  }
  swingAt(tx, ty) {
    const run = this.run, d = this.d;
    run.hits++;
    run.dur -= 1;
    const crit = this.rng() < d.crit;
    this.damage(tx, ty, d.atk * (run.frenzy > 0 ? 3 : 1) * (crit ? 2 : 1), crit ? 'crit' : 'pick');
    this.emit({ t: 'swing', x: tx, y: ty });
    for (const a of ABILITIES) {
      if (!this.s.abil[a.id]) continue;
      run.abil[a.id] = (run.abil[a.id] || 0) + 1;
      if (run.abil[a.id] >= this.abilEvery(a)) { run.abil[a.id] = 0; this.cast(a); }
    }
    if (run.dur <= 0) {
      if (d.revive && !run.revived) {
        run.revived = true;
        run.dur = Math.max(1, Math.round(run.maxDur * Math.min(0.6, d.revive)));
        this.emit({ t: 'revive' });
      } else this.endRun();
    }
  }
  damage(x, y, dmg, src) {
    const c = this.cell(x, y);
    if (!c) return;
    c.hp -= dmg;
    this.emit({ t: 'hit', x, y, dmg, src });
    if (c.hp <= 0) this.breakCell(x, y, c);
  }
  breakCell(x, y, c) {
    const run = this.run, d = this.d, loot = run.loot;
    this.row(y)[x] = null;
    run.broken++;
    run.gauge = Math.min(GAUGE_MAX, run.gauge + 1);
    let drop = null;
    const dbl = this.rng() < d.double ? 2 : 1;
    if (c.t === 'rock' || c.t === 'hard') {
      const n = Math.round((1 + y / 40) * d.stone * (c.t === 'hard' ? 3 : 1));
      loot.stone += n; drop = { k: 'stone', n };
    } else if (c.t === 'ore') {
      const id = ORES[c.o].id;
      loot.ores[id] = (loot.ores[id] || 0) + dbl;
      loot.stone += 1;
      drop = { k: id, n: dbl };
    } else if (c.t === 'gem') {
      const n = (1 + Math.floor(y / 300)) * dbl;
      loot.gems += n; drop = { k: 'gems', n };
    } else if (c.t === 'chest') {
      loot.chests += 1; drop = { k: 'chests', n: 1 };
    }
    this.emit({ t: 'break', x, y, c, drop });
  }
  cast(a) {
    const run = this.run, dmg = this.d.atk * this.abilMult(a);
    const cells = [];
    const add = (x, y) => { if (x >= 0 && x < COLS && !(x === run.x && y === run.y) && y >= run.y - 3) cells.push([x, y]); };
    const circle = (cx, cy, r) => { for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= (r + 0.5) ** 2) add(x, y); };
    let cx = run.x, cy = run.y;
    const dx = run.dir === 'left' ? -1 : run.dir === 'right' ? 1 : 0, dy = run.dir === 'down' ? 1 : 0;
    if (a.shape === 'circle') circle(run.x, run.y, a.r);
    else if (a.shape === 'line') for (let i = 1; i <= a.n; i++) add(run.x + dx * i, run.y + dy * i);
    else if (a.shape === 'row') for (let x = 0; x < COLS; x++) add(x, run.y + 1);
    else if (a.shape === 'col') for (let i = 1; i <= a.n; i++) add(run.x, run.y + i);
    else if (a.shape === 'meteor') { cx = Math.max(1, Math.min(COLS - 2, run.x + Math.floor(this.rng() * 5) - 2)); cy = run.y + 3; circle(cx, cy, a.r); }
    else if (a.shape === 'chain') {
      const list = [];
      for (let y = run.y - 1; y <= run.y + a.r; y++) for (let x = 0; x < COLS; x++) {
        const dist = Math.abs(x - run.x) + Math.abs(y - run.y);
        if (this.cell(x, y) && dist <= a.r) list.push([x, y, dist + this.rng()]);
      }
      list.sort((p, q) => p[2] - q[2]).slice(0, a.n).forEach(([x, y]) => add(x, y));
    }
    if (a.haste) run.haste = a.haste;
    this.emit({ t: 'cast', id: a.id, cells, cx, cy, from: [run.x, run.y] });
    for (const [x, y] of cells) this.damage(x, y, dmg, a.id);
  }
  frenzy() {
    const run = this.run;
    if (!run || run.over || run.gauge < GAUGE_MAX) return false;
    run.gauge = 0;
    run.frenzy = FRENZY_SEC;
    this.emit({ t: 'frenzy' });
    return true;
  }
  gaugeMax() { return GAUGE_MAX; }
  endRun(early = false) {
    const run = this.run, s = this.s;
    if (!run || run.over) return;
    run.over = true;
    s.res.stone += run.loot.stone;
    s.res.gems += run.loot.gems;
    s.res.chests += run.loot.chests;
    for (const [id, n] of Object.entries(run.loot.ores)) s.res[id] += n;
    s.stats.blocks += run.broken;
    this.emit({ t: 'end', early, loot: run.loot, deepest: run.deepest, start: run.start, broken: run.broken });
  }
  leaveRun() { if (this.run && this.run.over) this.run = null; }

  // ---------- Base actions ----------
  afford(cost) { return Object.entries(cost).every(([k, v]) => (this.s.res[k] || 0) >= v); }
  pay(cost) { for (const [k, v] of Object.entries(cost)) this.s.res[k] -= v; }
  upgradeCostOf(id) { return { stone: Math.max(1, Math.round(upgradeCost(id, this.s.up[id]) * this.d.costMul)) }; }
  buyUpgrade(id) {
    const cost = this.upgradeCostOf(id);
    if (!this.afford(cost)) return false;
    this.pay(cost);
    this.s.up[id]++;
    this.calc();
    return true;
  }
  craftCost(slot) { const t = this.s.gear[slot] + 1; return t > ORES.length ? null : gearCost(slot, t); }
  canCraftTier(slot) { const t = this.s.gear[slot] + 1; return t <= ORES.length && this.s.stats.deepest >= (t - 1) * 100; }
  craft(slot) {
    const cost = this.craftCost(slot);
    if (!cost || !this.afford(cost)) return false;
    this.pay(cost);
    this.s.gear[slot]++;
    this.calc();
    this.emit({ t: 'craft', slot, tier: this.s.gear[slot] });
    return true;
  }
  abilityOpen(a) { return this.s.stats.deepest >= abilityUnlockFloor(a); }
  learn(id) {
    const a = ABILITY[id], lv = this.s.abil[id] || 0;
    if (!a || lv >= ABIL_MAX || !this.abilityOpen(a)) return false;
    const cost = { gems: abilityCost(a, lv) };
    if (!this.afford(cost)) return false;
    this.pay(cost);
    this.s.abil[id] = lv + 1;
    return true;
  }
  // Treasure chests open at the base into relics; a duplicate adds a copy toward the next level.
  openChest() {
    const s = this.s;
    if (s.res.chests < 1) return null;
    s.res.chests--;
    s.stats.opened++;
    const luckW = Math.min(3, this.d.luck);
    const weights = RARITY.map((r, i) => r.w * (i ? luckW : 1));
    let v = this.rng() * weights.reduce((a, b) => a + b, 0), rar = 0;
    while (v >= weights[rar]) { v -= weights[rar]; rar++; }
    const pool = RELICS.filter(r => r.r === rar);
    const def = pool[Math.floor(this.rng() * pool.length)];
    const cur = s.relics[def.id] || { copies: 0, lv: 0 };
    if (cur.lv >= RELIC_MAX) { // maxed: refund as gems
      s.res.gems += 5 * (rar + 1);
      return { id: def.id, maxed: true, gems: 5 * (rar + 1) };
    }
    cur.copies++;
    const before = cur.lv;
    cur.lv = relicLevel(cur.copies);
    s.relics[def.id] = cur;
    this.calc();
    return { id: def.id, isNew: before === 0, up: cur.lv > before, lv: cur.lv };
  }
  buildCostOf(id) { return buildCost(this.s.town[id] || 0); }
  build(id) {
    const lv = this.s.town[id] || 0;
    if (!BUILDING[id] || lv >= BUILD_MAX) return false;
    const cost = buildCost(lv);
    if (!this.afford(cost)) return false;
    this.pay(cost);
    this.s.town[id] = lv + 1;
    this.calc();
    return true;
  }
  mission(m) {
    const i = this.s.missions[m.id] || 0;
    if (i >= m.goals.length) return { done: true, i };
    const cur = m.stat(this.s);
    return { i, goal: m.goals[i], cur, ready: cur >= m.goals[i], reward: m.reward(i) };
  }
  claim(id) {
    const m = MISSIONS.find(x => x.id === id), st = m && this.mission(m);
    if (!st || !st.ready) return false;
    this.s.missions[id] = st.i + 1;
    this.s.res.gems += st.reward.gems || 0;
    this.s.res.chests += st.reward.chests || 0;
    return true;
  }
  missionsReady() { return MISSIONS.filter(m => this.mission(m).ready).length; }
}

function pickOre(L, rng) {
  const w = [];
  for (let i = 0; i <= Math.min(L + 1, ORES.length - 1); i++) w.push(i === L + 1 ? 0.25 : i === L ? 6 : i === L - 1 ? 3 : 1);
  let v = rng() * w.reduce((a, b) => a + b, 0), i = 0;
  while (v >= w[i]) { v -= w[i]; i++; }
  return i;
}
