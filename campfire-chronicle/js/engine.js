// Pure game logic. No DOM access, so the same code runs in the browser and in
// the Node balance simulator (sim/simulate.mjs).
import {
  TIERS, TIER_P, LUCK_CAP, SKILLS, ITEMS, SPOT_LV, SPOT_XP, SPOTS, SKILL_RARES, SEASON_FISH,
  RECIPES, MONSTERS, REGIONS, GEAR_NAMES, GEAR_TIER_MULT, PERKS, MEMORIES, PRESETS, AWAKENINGS,
  TOOL_TIERS, MASTER_BONUS, UNLOCKS, BOSS_EVERY, ELITE_EVERY,
} from './data.js';
import { makeRng, hash32 } from './rng.js';

export const VERSION = 1;
export const ACTION_TIME = 3;
export const ALCH_TIME = 4;
export const CLONE_SPEED = 0.6;
export const KILLS_PER_FLOOR = 10;
export const MON_INTERVAL = 1.8;
export const REBIRTH_XP = 0.05;
export const RECALL_MULT = 5;
export const RECALL_UNTIL = 0.95;
export const RECALL_FLOOR = 0.2;

// ---------- Curves ----------
export const xpNeed = lv => Math.floor(20 + 1.8 * Math.pow(lv, 1.9));
export const charXpNeed = lv => Math.floor(15 * Math.pow(1.12, lv - 1));
export const toolTier = lv => Math.min(10, Math.floor(lv / 100));
export const spotsUnlocked = lv => SPOT_LV.filter(l => lv >= l).length;
export const skillPassive = lv => lv * 0.001 + Math.floor(lv / 10) * 0.01;
export const perkCost = (id, lv) => Math.ceil(PERKS[id].base * Math.pow(PERKS[id].grow, lv));
// Soft pity: past 1.5x the expected count, myth/primordial odds ramp up (x2 at 2x, x3 at 2.5x).
export const pity = ratio => (ratio > 1.5 ? 1 + 2 * (ratio - 1.5) : 1);
export const ashFor = maxFloor => (maxFloor > 20 ? Math.floor(Math.pow(maxFloor / 5, 1.5)) : 0);
// Monsters grow faster than gear (1.16 vs 1.12 per floor), so the climb always
// meets a wall that only permanent multipliers can push back.
export const monHp = f => 20 * Math.pow(1.16, f - 1);
export const monAtk = f => 3 * Math.pow(1.15, f - 1);
export const GEAR_GROWTH = 1.12;

export function gearValue(g) {
  return (g.slot === 'weapon' ? 5 : 22) * Math.pow(GEAR_GROWTH, g.f - 1) * GEAR_TIER_MULT[g.tier] * g.roll * (1 + 0.1 * g.enh);
}
export function charmValue(g) {
  const k = (g.tier + 1) * g.roll * (1 + 0.1 * g.enh);
  return { luck: 0.02 * k, crit: 0.01 * k };
}
export function gearScore(g) {
  if (!g) return 0;
  if (g.slot === 'charm') { const c = charmValue(g); return c.luck * 10 + c.crit * 10; }
  return gearValue(g);
}
export const gearName = g => `${GEAR_NAMES[g.slot][g.tier]}${g.enh ? ' +' + g.enh : ''}`;
export const enhanceCost = g => Math.ceil(10 * Math.pow(1.13, g.f - 1) * Math.pow(1.5, g.enh));

// What happens at a given skill level (used for logs and the "next milestone" list).
export function milestoneAt(k, lv) {
  if (lv === 1000) return `마스터 달성 · ${MASTER_BONUS[k]}`;
  if (AWAKENINGS[lv]) return AWAKENINGS[lv];
  if (k === 'alchemy') {
    const r = RECIPES.find(x => x.lv === lv && !x.secret);
    if (r) return `새 레시피: ${ITEMS[r.id].name}`;
  }
  const si = SPOT_LV.indexOf(lv);
  if (si > 0 && SPOTS[k]) return `새 장소: ${SPOTS[k][si].name}`;
  if (lv % 100 === 0) return `도구 승급: ${TOOL_TIERS[toolTier(lv)].name} (속도 +10%)`;
  if (lv % 10 === 0) return `${SKILLS[k].stat} +1% 보너스`;
  return null;
}
export function nextMilestones(k, lv, count = 4) {
  const out = [];
  for (let l = lv + 1; out.length < count && l <= lv + 1000; l++) {
    const m = milestoneAt(k, l);
    if (m && (!m.endsWith('+1% 보너스') || out.length === 0)) out.push({ lv: l, text: m });
  }
  return out;
}

function freshChar(floor) {
  return {
    lv: 1, xp: 0, pts: 0, st: { str: 5, agi: 5, vit: 5, luk: 5 }, preset: 'balanced', auto: true,
    hp: 1e12, sta: 1e12, gold: 0, floor, kills: 0, maxFloor: floor, farmUntil: 0,
    gear: { weapon: null, armor: null, charm: null }, bag: [],
  };
}
export const BAG_MAX = 40;
export const sellPrice = g => Math.ceil(Math.pow(1.13, g.f - 1) * 5 * (g.tier + 1) * (1 + 0.5 * g.enh));

export function newState(seed = (Math.random() * 4294967296) >>> 0) {
  const skills = {};
  for (const k of Object.keys(SKILLS)) skills[k] = { lv: 1, xp: 0, n: 0, dryM: 0, dryP: 0 };
  const now = Date.now();
  return {
    v: VERSION, seed, rng: seed, time: 0, created: now, lastSeen: now,
    char: freshChar(1), mode: 'fight', focus: false,
    slots: [{ k: 'mining', p: 0 }],
    spots: { mining: 0, wood: 0, forage: 0, fish: 0, hunt: 0 },
    recipe: 'p_str', secret: false,
    skills, items: {}, codex: {}, records: {},
    potAuto: { str: true, hp: true, sta: true, antidote: true, warm: true, luck: true },
    pot: {}, catUntil: 0, elixirs: { atk: 0, hp: 0, all: 0 },
    rb: { count: 0, ash: 0, totalAsh: 0, perks: {}, memory: null, choices: null, bestFloor: 1, bestLv: 1 },
    stats: { kills: 0, deaths: 0, bosses: 0, actions: 0, gold: 0 },
    hall: [], log: [], firstKills: {},
    tut: { step: 0, done: false, tips: {} },
    settings: { autoEquip: false },
  };
}

// A life skill is open once the skill before it reached its level (or it was already played).
export function isUnlocked(s, k) {
  const u = UNLOCKS[k];
  if (!u) return true;
  return s.skills[u.skill].lv >= u.lv || s.skills[k].lv > 1;
}

// Fill in fields added in later versions so old saves keep loading.
export function migrate(raw) {
  const base = newState(raw.seed);
  const s = { ...base, ...raw };
  s.settings = { ...base.settings, ...(raw.settings || {}) };
  s.char = { ...freshChar(1), ...raw.char, st: { ...base.char.st, ...(raw.char?.st || {}) }, gear: { ...base.char.gear, ...(raw.char?.gear || {}) } };
  for (const k of Object.keys(base.skills)) s.skills[k] = { ...base.skills[k], ...(raw.skills?.[k] || {}) };
  s.rb = { ...base.rb, ...(raw.rb || {}) };
  s.stats = { ...base.stats, ...(raw.stats || {}) };
  s.potAuto = { ...base.potAuto, ...(raw.potAuto || {}) };
  s.elixirs = { ...base.elixirs, ...(raw.elixirs || {}) };
  s.tut = { ...base.tut, ...(raw.tut || {}), tips: { ...((raw.tut && raw.tut.tips) || {}) } };
  s.v = VERSION;
  return s;
}

const VARIANTS = {
  golden: { name: '황금 ', hp: 2, atk: 1, xp: 2, gold: 10 },
  giant: { name: '거대 ', hp: 5, atk: 1.5, xp: 10, gold: 5 },
  ancient: { name: '고대 ', hp: 20, atk: 2, xp: 100, gold: 50 },
};
const NO_VARIANT = { name: '', hp: 1, atk: 1, xp: 1, gold: 1 };

export class Game {
  constructor(state, opts = {}) {
    this.s = state;
    this.rng = makeRng(state.rng);
    this.clock = opts.clock || (() => Date.now());
    this.quiet = !!opts.quiet; // simulator: skip logs
    this.simStep = opts.simStep || 0;
    this.events = [];
    this.live = true;
    this.summary = null;
    this.mon = null;
    this.heroTimer = 0.3;
    this.monTimer = 1;
    this.lastEnv = -1e9;
    this.env = this.envNow();
    this.dirty = true;
    this.calc();
    const c = state.char;
    c.hp = Math.min(c.hp, this.d.hp);
    c.sta = Math.min(c.sta, this.d.sta);
  }

  // ---------- Infrastructure ----------
  emit(e) {
    if (this.live) this.events.push(e);
    if (this.summary) this.summarize(e);
  }
  log(text, tier = 0) {
    if (this.quiet) return;
    this.s.log.unshift({ at: this.clock(), text, tier });
    if (this.s.log.length > 80) this.s.log.length = 80;
  }
  has(id) { return !!this.s.codex[id]; }
  // Primordial items stack: every duplicate adds a little more to its effect.
  // Capped at 10 duplicates so faster gathering cannot feed itself without limit.
  prim(id, base, per) { const n = Math.min(11, this.s.items[id] || 0); return n ? base + per * (n - 1) : 0; }
  P(id) { return this.s.rb.perks[id] || 0; }
  serialize() {
    this.s.rng = this.rng.getState();
    this.s.lastSeen = this.clock();
    return JSON.stringify(this.s);
  }

  envNow() {
    const t = this.clock();
    const d = new Date(t);
    const h = d.getHours();
    const m = d.getMonth();
    const season = m >= 2 && m <= 4 ? 0 : m >= 5 && m <= 7 ? 1 : m >= 8 && m <= 10 ? 2 : 3;
    const w = hash32((Math.floor(t / 3600000) * 2654435761) ^ 0x9e37);
    const weather = w < 0.18 ? (season === 3 ? 'snow' : 'rain') : 'clear';
    return { night: h >= 20 || h < 6, hour: h + d.getMinutes() / 60, season, weather };
  }

  // ---------- Derived stats ----------
  calc() {
    const s = this.s, c = s.char, st = c.st, sk = s.skills, mem = s.rb.memory, pot = s.pot, env = this.env;
    const pb = k => skillPassive(sk[k].lv);
    const master = k => sk[k].lv >= 1000;
    let codex = 0;
    for (const id in s.codex) codex += TIERS[ITEMS[id].tier].codex;
    const potPow = (1 + pb('alchemy')) * (this.prim('a_prim', 2, 0.1) || 1) * (master('alchemy') ? 2 : 1);
    const allMul = (this.prim('c_prim', 1.05, 0.02) || 1) * (1 + 0.03 * s.elixirs.all);
    const g = c.gear;
    const wAtk = g.weapon ? gearValue(g.weapon) : 0;
    const aHp = g.armor ? gearValue(g.armor) : 0;
    const ch = g.charm ? charmValue(g.charm) : { luck: 0, crit: 0 };

    let atk = (4 + st.str * 2 + wAtk) * (1 + pb('mining')) * (1 + pb('combat')) * (1 + codex)
      * (1 + 0.1 * this.P('w_atk')) * (1 + 0.02 * s.elixirs.atk) * allMul;
    if (pot.str) atk *= 1 + 0.25 * potPow;
    atk *= this.prim('m_prim', 1.5, 0.1) || 1;
    if (master('mining')) atk *= 1.25;
    if (master('combat')) atk *= 1.25;
    if (mem === 'coward') atk *= 0.9;
    if (mem === 'warrior') atk *= 1.15;

    let hp = (40 + st.vit * 8 + c.lv * 4 + aHp) * (1 + pb('forage')) * (1 + pb('combat')) * (1 + codex)
      * (1 + 0.1 * this.P('w_hp')) * (1 + 0.02 * s.elixirs.hp) * allMul;
    if (pot.hp) hp *= 1 + 0.25 * potPow;
    if (master('forage')) hp *= 1.25;
    if (master('combat')) hp *= 1.25;

    let sta = 100 * (1 + st.vit * 0.005) * (1 + pb('wood'));
    if (pot.sta) sta *= 1 + 0.4 * potPow;

    const luckCap = LUCK_CAP + this.prim('f_prim', 0.5, 0.1) + (master('fish') ? 0.5 : 0);
    let luck = 1 + st.luk * 0.002 + sk.fish.lv * 0.0005 + Math.floor(sk.fish.lv / 10) * 0.005
      + 0.05 * this.P('a_luck') + ch.luck + (mem === 'lucky' ? 0.5 : 0) + (pot.luck ? 0.3 * potPow : 0);
    luck = Math.min(luckCap, luck);

    const critC = Math.min(0.75, 0.05 + st.luk * 0.003 + ch.crit);
    const critD = (1.5 + pb('hunt') + this.prim('h_prim', 1, 0.2)) * (master('hunt') ? 1.5 : 1);
    const interval = Math.max(0.25, 1.4 / (1 + st.agi * 0.008));
    const dodge = Math.min(0.6, st.agi * 0.002 + (mem === 'coward' ? 0.3 : 0));
    const nightXp = env.night ? this.prim('s_prim', 1.3, 0.05) || 1 : 1;

    this.d = {
      atk, hp, sta, luck, luckCap, critC, critD, interval, dodge, potPow, codex,
      res: { poison: Math.min(1, sk.forage.lv / 60), ice: Math.min(1, sk.wood.lv / 80) },
      lifeSpeed: (1 + 0.03 * this.P('a_speed')) * (this.prim('w_prim', 1.25, 0.05) || 1) * (master('wood') ? 1.15 : 1),
      lifeXp: (1 + 0.05 * this.P('a_xp')) * nightXp,
      charXp: (1 + 0.15 * this.P('w_xp')) * this.rebirthXp() * nightXp,
      gold: (1 + 0.2 * this.P('r_gold')) * (mem === 'rich' ? 3 : 1),
      campDur: 60 * (mem === 'sleepy' ? 1.5 : 1),
    };
    this.dirty = false;
  }

  skillSpeed(k) {
    const sk = this.s.skills[k];
    return this.d.lifeSpeed * (1 + 0.1 * toolTier(sk.lv)) * (k === 'forage' && this.env.weather === 'rain' ? 1.2 : 1);
  }
  skillXpMult(k) {
    const mem = this.s.rb.memory;
    return this.d.lifeXp * (mem && MEMORIES[mem].skill === k ? 2 : 1) * (k === 'combat' && mem === 'warrior' ? 2 : 1);
  }
  rareMult(k) {
    const sk = this.s.skills[k];
    return this.d.luck * (sk.lv >= 750 ? 1.5 : 1) * (this.s.catUntil > this.s.time && k !== 'combat' ? 1.5 : 1)
      * (k === 'fish' && this.env.night ? 1.3 : 1);
  }

  // ---------- Main loop ----------
  advance(sec, live = true) {
    this.live = live;
    const stepMax = live ? 0.1 : this.simStep || 0.5;
    let left = sec;
    while (left > 1e-9) {
      const dt = Math.min(stepMax, left);
      this.step(dt);
      left -= dt;
    }
    this.live = true;
  }

  fastForward(sec) {
    const c = this.s.char;
    const startLv = c.lv, startFloor = c.maxFloor, startGold = this.s.stats.gold;
    const skillStart = Object.fromEntries(Object.entries(this.s.skills).map(([k, v]) => [k, v.lv]));
    this.summary = { sec, kills: 0, deaths: 0, drops: [0, 0, 0, 0, 0, 0, 0], best: [], records: 0, codex: [], fails: 0, rebirth: false };
    this.advance(sec, false);
    const sm = this.summary;
    this.summary = null;
    sm.charLv = [startLv, this.s.char.lv];
    sm.floor = [startFloor, this.s.char.maxFloor];
    sm.gold = this.s.stats.gold - startGold;
    sm.skills = Object.entries(this.s.skills).filter(([k, v]) => v.lv > skillStart[k]).map(([k, v]) => ({ k, from: skillStart[k], to: v.lv }));
    return sm;
  }

  summarize(e) {
    const sm = this.summary;
    if (e.t === 'kill') sm.kills++;
    else if (e.t === 'death') sm.deaths++;
    else if (e.t === 'drop') {
      sm.drops[e.tier] += e.n;
      if (e.tier >= 3) sm.best.push(e.id);
    } else if (e.t === 'record') sm.records++;
    else if (e.t === 'codex') sm.codex.push(e.id);
    else if (e.t === 'act' && e.kind === 'fail') sm.fails++;
  }

  step(dt) {
    const s = this.s;
    s.time += dt;
    if (s.time - this.lastEnv >= 60) {
      this.env = this.envNow();
      this.lastEnv = s.time;
      this.dirty = true;
    }
    if (this.dirty) this.calc();
    const cloneSpeed = CLONE_SPEED * (1 + 0.05 * this.P('r_offline'));
    for (let i = 1; i < s.slots.length; i++) this.lifeTick(s.slots[i], i, dt * cloneSpeed);
    if (s.mode === 'fight') this.fightStep(dt);
    else this.campStep(dt);
  }

  // ---------- Camp & life skills ----------
  enterCamp(reason) {
    const s = this.s;
    s.mode = 'camp';
    s.pot = {};
    this.mon = null;
    this.dirty = true;
    this.emit({ t: 'camp', reason });
  }

  enterFight() {
    const s = this.s, c = s.char;
    s.mode = 'fight';
    s.pot = {};
    this.calc();
    const gm = this.gimmick(c.floor);
    for (const id of ['p_str', 'p_hp', 'p_sta', 'p_luck', 'p_antidote', 'p_warm']) {
      const type = ITEMS[id].potion;
      if (!s.potAuto[type] || !(s.items[id] > 0)) continue;
      if (type === 'antidote' && (gm !== 'poison' || this.d.res.poison >= 1)) continue;
      if (type === 'warm' && (gm !== 'ice' || this.d.res.ice >= 1)) continue;
      s.items[id]--;
      s.pot[type] = true;
    }
    this.calc();
    c.hp = this.d.hp;
    c.sta = this.d.sta;
    this.emit({ t: 'fight', pots: Object.keys(s.pot) });
  }

  campStep(dt) {
    const s = this.s, c = s.char, d = this.d;
    c.sta = Math.min(d.sta, c.sta + (d.sta / d.campDur) * dt);
    c.hp = Math.min(d.hp, c.hp + (d.hp / (d.campDur * 0.6)) * dt);
    this.lifeTick(s.slots[0], 0, dt);
    if (!s.focus && c.sta >= d.sta && c.hp >= d.hp) this.enterFight();
  }

  recipe() { return RECIPES.find(r => r.id === this.s.recipe); }
  canCraft(r) {
    if (!r) return false;
    const s = this.s;
    if (r.secret && !s.secret) return false;
    if (s.skills.alchemy.lv < r.lv) return false;
    if (r.max && this.crafted(r) >= r.max) return false;
    for (const id in r.in) if ((s.items[id] || 0) < r.in[id]) return false;
    return true;
  }
  crafted(r) {
    const e = ITEMS[r.id].elixir;
    return e ? this.s.elixirs[e] : 0;
  }

  lifeTick(slot, idx, dt) {
    const k = slot.k;
    if (k === 'alchemy' && !this.canCraft(this.recipe())) { slot.p = 0; slot.blocked = true; return; }
    slot.blocked = false;
    slot.p += (dt * this.skillSpeed(k)) / (k === 'alchemy' ? ALCH_TIME : ACTION_TIME);
    while (slot.p >= 1) {
      slot.p -= 1;
      if (k === 'alchemy') {
        this.alchemyAction(idx);
        if (!this.canCraft(this.recipe())) { slot.p = 0; break; }
      } else this.gatherAction(k, idx);
    }
  }

  rollTier(k, mult) {
    const sk = this.s.skills[k];
    // Luck only counts as its square root for myth/primordial, so they stay rare.
    const top = Math.sqrt(mult);
    const eM = 1 / (TIER_P[5] * top), eP = 1 / (TIER_P[6] * top);
    const pityM = pity(sk.dryM / eM), pityP = pity(sk.dryP / eP);
    let r = this.rng();
    const p6 = TIER_P[6] * top * pityP;
    if (r < p6) { sk.dryP = 0; sk.dryM++; return 6; }
    r -= p6;
    const p5 = TIER_P[5] * top * pityM;
    if (r < p5) { sk.dryM = 0; sk.dryP++; return 5; }
    r -= p5;
    sk.dryM++;
    sk.dryP++;
    for (let t = 4; t >= 2; t--) {
      const p = TIER_P[t] * mult;
      if (r < p) return t;
      r -= p;
    }
    return r < TIER_P[1] ? 1 : 0;
  }

  gatherAction(k, slot) {
    const s = this.s, sk = s.skills[k];
    const spot = Math.min(s.spots[k], spotsUnlocked(sk.lv) - 1);
    const tier = this.rollTier(k, this.rareMult(k));
    let id;
    if (tier >= 3) id = SKILL_RARES[k][tier - 3];
    else {
      id = SPOTS[k][spot].items[tier];
      if (k === 'fish' && tier === 2 && this.rng() < 0.3) id = SEASON_FISH[this.env.season];
    }
    const dbl = sk.lv >= 500 ? 0.1 : sk.lv >= 250 ? 0.05 : 0;
    const n = dbl && tier < 3 && this.rng() < dbl ? 2 : 1;
    sk.n++;
    s.stats.actions++;
    let w = 0;
    if (ITEMS[id].w) w = this.fishRecord(id);
    this.gain(id, n, k);
    this.skillXp(k, SPOT_XP[spot] * this.skillXpMult(k));
    this.emit({ t: 'act', k, slot, id, tier, n, w });
  }

  gauss() {
    const u = Math.max(1e-12, this.rng()), v = this.rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  fishRecord(id) {
    const w = +(ITEMS[id].w * Math.exp(0.35 * this.gauss())).toFixed(2);
    const rec = this.s.records[id];
    if (!rec || w > rec) {
      this.s.records[id] = w;
      if (rec) {
        this.emit({ t: 'record', id, w });
        this.log(`신기록! ${ITEMS[id].name} ${w}kg`, 2);
      }
    }
    return w;
  }

  alchemyAction(slot) {
    const s = this.s, sk = s.skills.alchemy, r = this.recipe();
    for (const id in r.in) s.items[id] -= r.in[id];
    const noFail = this.has('a_prim') || s.rb.memory === 'alchem';
    const failP = noFail ? 0 : Math.max(0, 0.15 - sk.lv * 0.002);
    const roll = this.rng();
    let kind = 'ok', n = 1;
    if (roll < failP) { kind = 'fail'; n = 0; }
    else if (roll < failP + 0.001) { kind = 'miracle'; n = 10; }
    else if (roll < failP + 0.051) { kind = 'great'; n = 2; }
    if (n) {
      const it = ITEMS[r.id];
      if (r.max) n = Math.min(n, r.max - this.crafted(r));
      if (it.elixir) {
        s.elixirs[it.elixir] += n;
        this.register(r.id);
        this.dirty = true;
        this.emit({ t: 'drop', id: r.id, n, tier: it.tier, src: 'alchemy' });
      } else this.gain(r.id, n, 'alchemy');
    }
    if (kind === 'miracle') this.log(`연금술 기적! ${ITEMS[r.id].name} ×10`, 4);
    if (!s.secret && this.rng() < 0.00001 * this.d.luck) {
      s.secret = true;
      this.log('미지의 레시피를 발견했다! ???의 영약', 5);
      this.emit({ t: 'secret' });
    }
    const t = this.rollTier('alchemy', this.rareMult('alchemy'));
    if (t >= 3) this.gain(SKILL_RARES.alchemy[t - 3], 1, 'alchemy');
    sk.n++;
    s.stats.actions++;
    this.skillXp('alchemy', r.xp * (kind === 'fail' ? 1.5 : 1) * this.skillXpMult('alchemy'));
    this.emit({ t: 'act', k: 'alchemy', slot, id: r.id, kind, n, tier: ITEMS[r.id].tier });
  }

  register(id) {
    const s = this.s, it = ITEMS[id];
    if (s.codex[id]) return;
    s.codex[id] = 1;
    this.dirty = true;
    this.emit({ t: 'codex', id });
    this.log(`도감 등록: ${it.name}`, it.tier);
  }

  gain(id, n, src) {
    const s = this.s, it = ITEMS[id];
    s.items[id] = (s.items[id] || 0) + n;
    this.register(id);
    if (it.tier >= 4) {
      s.hall.unshift({ id, at: this.clock(), n: s.skills[src] ? s.skills[src].n : 0, src });
      if (s.hall.length > 60) s.hall.length = 60;
      this.log(`[${TIERS[it.tier].name}] ${it.name} 획득!`, it.tier);
    }
    this.emit({ t: 'drop', id, n, tier: it.tier, src });
  }

  skillXp(k, x) {
    const sk = this.s.skills[k];
    sk.xp += x;
    while (sk.xp >= xpNeed(sk.lv)) {
      sk.xp -= xpNeed(sk.lv);
      sk.lv++;
      this.dirty = true;
      const m = milestoneAt(k, sk.lv);
      this.emit({ t: 'slv', k, lv: sk.lv, m });
      for (const k2 in UNLOCKS) {
        const u = UNLOCKS[k2];
        if (u && u.skill === k && u.lv === sk.lv && this.s.skills[k2].lv === 1) {
          this.log(`새 생활 스킬 해금: ${SKILLS[k2].name}`, 4);
          this.emit({ t: 'unlock', k: k2 });
        }
      }
      if (m && (sk.lv % 10 !== 0 || sk.lv % 50 === 0)) this.log(`${SKILLS[k].name} Lv.${sk.lv} · ${m}`, sk.lv % 100 === 0 ? 3 : 2);
    }
  }

  useItem(id) {
    const s = this.s;
    if (id !== 'x_cat' || !(s.items[id] > 0)) return false;
    s.items[id]--;
    s.catUntil = Math.max(s.time, s.catUntil) + 3600;
    this.log('행운의 촉매 사용: 1시간 동안 생활 희귀 확률 ×1.5', 2);
    return true;
  }

  // ---------- Combat ----------
  region(f) {
    for (let i = REGIONS.length - 1; i >= 0; i--) if (f >= REGIONS[i].from) return REGIONS[i];
    return REGIONS[0];
  }
  gimmick(f) {
    const g = this.region(f).gimmick;
    return g === 'mixed' ? ['poison', 'ice', null][f % 3] : g;
  }

  spawn() {
    const c = this.s.char, f = c.floor, reg = this.region(f), boss = f % BOSS_EVERY === 0;
    const elite = !boss && f % ELITE_EVERY === 0;
    // Tower bosses rotate starting at its first boss floor (40 = the first entry).
    const key = boss ? (reg.bosses ? reg.bosses.at((Math.floor(f / BOSS_EVERY) - Math.ceil(reg.from / BOSS_EVERY)) % reg.bosses.length) : reg.boss)
      : reg.mobs[Math.floor(this.rng() * reg.mobs.length)];
    const M = MONSTERS[key];
    let variant = null;
    if (!boss && !elite) {
      const vr = this.rng() / this.d.luck;
      if (vr < 0.00001) variant = 'ancient';
      else if (vr < 0.001) variant = 'giant';
      else if (vr < 0.01) variant = 'golden';
    }
    const vm = VARIANTS[variant] || NO_VARIANT;
    const hp = monHp(f) * M.hp * (boss ? 10 : elite ? 4 : 1) * vm.hp;
    this.mon = {
      key, boss, elite, variant, f, hp, maxHp: hp, hits: 0,
      name: (elite ? '정예 ' : '') + vm.name + (reg.theme === 'tower' && !M.unique ? '심연의 ' : '') + M.name,
      atk: monAtk(f) * M.atk * (boss ? 2.2 : elite ? 1.5 : 1) * vm.atk,
      approach: 0.8,
    };
    this.heroTimer = 0.15;
    this.monTimer = 0.9;
    if (variant === 'ancient') this.log(`고대 개체 출현! ${this.mon.name}`, 5);
    if (boss) this.log(`${f}층 보스 등장: ${this.mon.name}`, 3);
    this.emit({ t: 'spawn', mon: this.mon });
  }

  fightStep(dt) {
    const s = this.s, c = s.char, d = this.d;
    const gm = this.gimmick(c.floor);
    // Poison fog shortens fights (stamina x2.5) instead of killing: a wall slows, never stops.
    const poison = gm === 'poison' && !s.pot.antidote ? 1.5 * (1 - d.res.poison) : 0;
    c.sta -= dt * (1 + poison);
    if (c.sta <= 0) { c.sta = 0; this.enterCamp('tired'); return; }
    if (!this.mon) this.spawn();
    const m = this.mon;
    if (m.approach > 0) { m.approach -= dt; return; }
    const iv = d.interval / (gm === 'ice' && !s.pot.warm ? 1 - 0.4 * (1 - d.res.ice) : 1);
    this.heroTimer -= dt;
    this.monTimer -= dt;
    while (this.mon && s.mode === 'fight' && (this.heroTimer <= 0 || this.monTimer <= 0)) {
      if (this.heroTimer <= this.monTimer) { this.heroTimer += iv; this.heroHit(); }
      else { this.monTimer += MON_INTERVAL; this.monHit(); }
    }
  }

  heroHit() {
    const s = this.s, c = s.char, d = this.d, m = this.mon;
    let dmg = d.atk * (0.9 + 0.2 * this.rng());
    if (s.rb.memory === 'berserk' && c.hp < d.hp * 0.5) dmg *= 1.6;
    const crit = this.rng() < d.critC;
    if (crit) dmg *= d.critD;
    m.hp -= dmg;
    this.emit({ t: 'hit', who: 'mon', dmg, crit });
    if (m.hp <= 0) this.kill();
  }

  monHit() {
    const c = this.s.char, m = this.mon;
    if (this.rng() < this.d.dodge) { this.emit({ t: 'miss' }); return; }
    m.hits++;
    // Bosses telegraph nothing but hit hard every fourth swing.
    const slam = m.boss && m.hits % 4 === 0;
    const dmg = m.atk * (0.9 + 0.2 * this.rng()) * (slam ? 2.2 : 1);
    c.hp -= dmg;
    this.emit({ t: 'hit', who: 'hero', dmg, slam });
    if (c.hp <= 0) this.die();
  }

  kill() {
    const s = this.s, c = s.char, d = this.d, m = this.mon;
    const vm = VARIANTS[m.variant] || NO_VARIANT;
    const bossMul = m.boss ? 10 : m.elite ? 4 : 1;
    s.stats.kills++;
    this.mon = null;
    const xp = 4 * Math.pow(1.14, m.f - 1) * bossMul * vm.xp * d.charXp;
    // During recall every kill is worth at least 10% of the current level, so a new life
    // climbs back to its previous best level in a few hundred kills.
    this.charXp(this.recall() > 1 ? Math.max(xp * RECALL_MULT, charXpNeed(c.lv) * RECALL_FLOOR) : xp);
    const gold = Math.pow(1.13, m.f - 1) * bossMul * vm.gold * d.gold;
    c.gold += gold;
    s.stats.gold += gold;
    this.skillXp('combat', (1 + m.f * 0.08) * (m.boss ? 5 : 1) * this.skillXpMult('combat'));
    s.skills.combat.n++;
    const reg = this.region(m.f);
    if (m.variant || m.boss || this.rng() < 0.4) {
      const t = this.rollTier('combat', d.luck * (m.variant ? 2 : 1));
      this.gain(t >= 3 ? SKILL_RARES.combat[t - 3] : reg.mats[t], 1, 'combat');
    }
    const sure = m.boss || m.elite || m.variant === 'giant' || m.variant === 'ancient';
    const first = (m.boss || m.elite) && !s.firstKills[m.f];
    if (first) {
      s.firstKills[m.f] = 1;
      this.dropGear(m, m.boss ? 3 : 2);
      this.log(`${m.f}층 ${m.boss ? '보스' : '정예'} 첫 처치 보상!`, m.boss ? 4 : 3);
    }
    if (sure || this.rng() < 0.03) this.dropGear(m);
    this.emit({ t: 'kill', mon: m, gold });
    if (m.boss) {
      s.stats.bosses++;
      this.log(`${m.f}층 보스 ${m.name} 처치!`, 3);
    }
    c.kills++;
    if (m.boss || m.elite || c.kills >= KILLS_PER_FLOOR) {
      c.kills = 0;
      if (s.time >= c.farmUntil) {
        c.floor++;
        if (c.floor > c.maxFloor) {
          c.maxFloor = c.floor;
          if (c.maxFloor > s.rb.bestFloor) s.rb.bestFloor = c.maxFloor;
          if (c.maxFloor === 21 && s.rb.count === 0) this.log('윤회가 해금되었다!', 4);
        }
        this.emit({ t: 'floor', floor: c.floor });
      }
    }
  }

  die() {
    const s = this.s, c = s.char;
    s.stats.deaths++;
    this.emit({ t: 'death', floor: c.floor });
    c.floor = Math.max(1, c.floor - 1);
    c.kills = 0;
    c.hp = 0;
    c.farmUntil = s.time + 180;
    this.enterCamp('death');
  }

  rollGearTier(mult, min = 0) {
    let r = this.rng();
    for (let t = 6; t >= 2; t--) {
      const p = TIER_P[t] * (t >= 5 ? Math.sqrt(mult) : mult);
      if (r < p) return Math.max(min, t);
      r -= p;
    }
    return Math.max(min, r < TIER_P[1] ? 1 : 0);
  }

  dropGear(m, minTier = 0) {
    const s = this.s, c = s.char;
    const slot = ['weapon', 'armor', 'charm'][Math.floor(this.rng() * 3)];
    const tier = this.rollGearTier(this.d.luck, Math.max(minTier, m.variant === 'ancient' ? 3 : m.boss ? 1 : 0));
    const g = { slot, tier, f: m.f, roll: +(0.8 + 0.4 * this.rng()).toFixed(3), enh: 0 };
    const cur = c.gear[slot];
    if (tier >= 2) this.log(`장비 획득: [${TIERS[tier].name}] ${gearName(g)} (${m.f}층)`, tier);
    // Auto-equip is opt-in; by default every drop goes to the bag for the player to equip.
    if (s.settings.autoEquip && gearScore(g) > gearScore(cur)) {
      if (cur) this.toBag(cur);
      c.gear[slot] = g;
      this.dirty = true;
      this.emit({ t: 'gear', g, equip: true });
    } else {
      this.toBag(g);
      this.emit({ t: 'gear', g, equip: false, better: gearScore(g) > gearScore(cur) });
    }
  }

  toBag(g) {
    const c = this.s.char;
    c.bag.push(g);
    if (c.bag.length > BAG_MAX) {
      // Full bag: sell the weakest piece.
      let worst = 0;
      for (let i = 1; i < c.bag.length; i++) if (gearScore(c.bag.at(i)) < gearScore(c.bag.at(worst))) worst = i;
      c.gold += sellPrice(c.bag.splice(worst, 1)[0]);
    }
  }
  equip(i) {
    const c = this.s.char, g = c.bag[i];
    if (!g) return false;
    c.bag.splice(i, 1);
    const cur = c.gear[g.slot];
    if (cur) c.bag.push(cur);
    c.gear[g.slot] = g;
    this.dirty = true;
    return true;
  }
  unequip(slot) {
    const c = this.s.char, g = c.gear[slot];
    if (!g) return false;
    c.gear[slot] = null;
    c.bag.push(g);
    this.dirty = true;
    return true;
  }
  sell(i) {
    const c = this.s.char, g = c.bag[i];
    if (!g) return false;
    c.bag.splice(i, 1);
    c.gold += sellPrice(g);
    return true;
  }
  sellAll() {
    const c = this.s.char;
    for (const g of c.bag) c.gold += sellPrice(g);
    c.bag = [];
  }
  // Best piece in the bag that beats what is worn, per slot (for the "upgrade available" dot).
  upgrades() {
    const c = this.s.char;
    return c.bag.filter(g => gearScore(g) > gearScore(c.gear[g.slot])).length;
  }

  enhance(slot) {
    const c = this.s.char, g = c.gear[slot];
    if (!g) return false;
    const cost = enhanceCost(g);
    if (c.gold < cost) return false;
    c.gold -= cost;
    g.enh++;
    this.dirty = true;
    return true;
  }

  charXp(x) {
    const c = this.s.char;
    c.xp += x;
    let up = false;
    while (c.xp >= charXpNeed(c.lv)) {
      c.xp -= charXpNeed(c.lv);
      c.lv++;
      c.pts += 3;
      if (c.lv > this.s.rb.bestLv) this.s.rb.bestLv = c.lv;
      up = true;
    }
    if (up) {
      if (c.auto) this.autoAllocate();
      this.dirty = true;
      this.emit({ t: 'lv', lv: c.lv });
    }
  }

  autoAllocate() {
    const c = this.s.char, w = PRESETS[c.preset].w;
    while (c.pts > 0) {
      let best = null, bestV = Infinity;
      for (const k in w) {
        if (!w[k]) continue;
        const v = (c.st[k] - 5) / w[k];
        if (v < bestV) { bestV = v; best = k; }
      }
      c.st[best]++;
      c.pts--;
    }
    this.dirty = true;
  }
  allocate(stat, n = 1) {
    const c = this.s.char;
    n = Math.min(n, c.pts);
    if (n <= 0) return;
    c.st[stat] += n;
    c.pts -= n;
    this.dirty = true;
  }
  respec() {
    const c = this.s.char;
    for (const k in c.st) { c.pts += c.st[k] - 5; c.st[k] = 5; }
    if (c.auto) this.autoAllocate();
    this.dirty = true;
  }

  // ---------- Slots & settings ----------
  unlocked(k) { return isUnlocked(this.s, k); }
  setSlotSkill(i, k) {
    if (!this.unlocked(k)) return false;
    const sl = this.s.slots;
    const other = sl.findIndex((x, j) => j !== i && x.k === k);
    if (other >= 0) sl[other].k = sl[i].k; // swap so one skill never runs twice
    sl[i].k = k;
    sl[i].p = 0;
    if (other >= 0) sl[other].p = 0;
  }
  freeSkill() {
    const used = new Set(this.s.slots.map(x => x.k));
    return ['fish', 'wood', 'forage', 'hunt', 'mining', 'alchemy'].find(k => !used.has(k) && this.unlocked(k)) || 'mining';
  }

  // ---------- Rebirth ----------
  // Permanent: every rebirth adds +5% character XP, forever.
  rebirthXp() { return 1 + REBIRTH_XP * this.s.rb.count; }
  // Past-life recall: until the character is back near its best level, XP is multiplied.
  recall() { return this.s.char.lv < this.s.rb.bestLv * RECALL_UNTIL ? RECALL_MULT : 1; }
  canRebirth() { return this.s.char.maxFloor > 20; }
  rebirth() {
    if (!this.canRebirth()) return false;
    const s = this.s, rb = s.rb, old = s.char;
    const gain = ashFor(old.maxFloor);
    rb.ash += gain;
    rb.totalAsh += gain;
    rb.count++;
    const start = Math.max(1, Math.min(1 + 5 * this.P('w_start'), rb.bestFloor - 10));
    s.char = freshChar(start);
    s.char.preset = old.preset;
    s.char.auto = old.auto;
    rb.memory = null;
    const keys = Object.keys(MEMORIES);
    const pick = [];
    while (pick.length < 3) {
      const k = keys[Math.floor(this.rng() * keys.length)];
      if (!pick.includes(k)) pick.push(k);
    }
    rb.choices = pick;
    s.pot = {};
    s.mode = 'fight';
    this.mon = null;
    this.calc();
    s.char.hp = this.d.hp;
    s.char.sta = this.d.sta;
    this.log(`윤회 ${rb.count}회차 시작 · 모닥불의 재 +${gain}`, 4);
    this.emit({ t: 'rebirth', gain });
    return gain;
  }
  chooseMemory(key) {
    const rb = this.s.rb;
    if (!rb.choices || !rb.choices.includes(key)) return false;
    rb.memory = key;
    rb.choices = null;
    this.dirty = true;
    this.log(`전생의 기억: ${MEMORIES[key].name}`, 3);
    return true;
  }
  buyPerk(id) {
    const rb = this.s.rb, lv = this.P(id), p = PERKS[id];
    if (p.max && lv >= p.max) return false;
    const cost = perkCost(id, lv);
    if (rb.ash < cost) return false;
    rb.ash -= cost;
    rb.perks[id] = lv + 1;
    if (id === 'r_clone') this.s.slots.push({ k: this.freeSkill(), p: 0 });
    this.dirty = true;
    return true;
  }

  // ---------- UI helpers ----------
  goals() {
    const s = this.s, c = s.char, out = [];
    if (s.rb.choices) out.push('전생의 기억을 골라주세요 (윤회 탭)');
    if (c.pts > 0 && !c.auto) out.push(`스탯 포인트 ${c.pts}개를 분배하세요`);
    if (this.canRebirth() && s.rb.count === 0) out.push('윤회 가능! 윤회 탭을 열어보세요');
    const nextG = Math.ceil(c.floor / ELITE_EVERY) * ELITE_EVERY;
    out.push(`${nextG}층 ${nextG % BOSS_EVERY === 0 ? '보스' : '정예 몬스터'} 처치`);
    const locked = Object.keys(UNLOCKS).find(k => !this.unlocked(k));
    if (locked) { const u = UNLOCKS[locked]; out.push(`${SKILLS[u.skill].name} Lv.${u.lv} → ${SKILLS[locked].name} 해금`); }
    if (c.maxFloor <= 20 && s.rb.count === 0) out.push('21층 도달 시 윤회 해금');
    const k = s.slots[0].k, nm = nextMilestones(k, s.skills[k].lv, 1)[0];
    if (nm) out.push(`${SKILLS[k].name} Lv.${nm.lv} · ${nm.text}`);
    return out.slice(0, 3);
  }
}
