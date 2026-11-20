// Static game data for the mining game: layers and ores, gear tiers, stat upgrades,
// abilities, relics, village buildings and missions. Player-facing text is Korean.

export const COLS = 9;
export const LAYER_SIZE = 100; // floors per layer; a new ore appears in each layer

// One ore per layer. Deeper ores are worth more and build better gear.
export const ORES = [
  { id: 'copper', name: '구리', color: '#e08a4a' },
  { id: 'iron', name: '철', color: '#b8b0a8' },
  { id: 'silver', name: '은', color: '#e6ecf5' },
  { id: 'gold', name: '금', color: '#ffd34d' },
  { id: 'sapphire', name: '사파이어', color: '#3d7cff' },
  { id: 'mithril', name: '미스릴', color: '#7fe3ff' },
  { id: 'adamant', name: '아다만타이트', color: '#b06aff' },
  { id: 'orichalc', name: '오리할콘', color: '#ff8a3d' },
  { id: 'aether', name: '에테르', color: '#9affd8' },
  { id: 'prime', name: '태초석', color: '#fff3a0' },
];
export const ORE = Object.fromEntries(ORES.map((o, i) => [o.id, { ...o, i }]));

// Rock colours per layer (cycled past the last one, darker each cycle).
export const LAYERS = [
  { name: '흙층', rock: '#8a5a3a', bg: '#3a2418' },
  { name: '암석층', rock: '#7a7a86', bg: '#2a2a34' },
  { name: '화강암층', rock: '#9a7a7a', bg: '#34262a' },
  { name: '용암층', rock: '#8a3a2a', bg: '#2a1210' },
  { name: '수정층', rock: '#4a5a9a', bg: '#1a1e3a' },
  { name: '심층', rock: '#3a6a6a', bg: '#122426' },
  { name: '자수정층', rock: '#5a3a7a', bg: '#1e1228' },
  { name: '화염층', rock: '#9a5a2a', bg: '#2e1608' },
  { name: '별빛층', rock: '#3a3a6a', bg: '#10102a' },
  { name: '태초층', rock: '#6a6a5a', bg: '#1a1a14' },
];

// Gear: tier 0 is the starter piece; tier k (1-10) is crafted from ore k-1.
export const GEAR_TIERS = ['나무', ...ORES.map(o => o.name)];
export const GEAR = {
  pick: { name: '곡괭이', icon: 'pick', stat: '공격력', val: t => Math.round(2 * Math.pow(2.4, t)), fmt: v => `공격 ${v}` },
  helm: { name: '헬멧', icon: 'helm', stat: '내구', val: t => 6 * t, fmt: v => `내구 +${v}` },
  armor: { name: '갑옷', icon: 'armor', stat: '내구 %', val: t => 0.05 * t, fmt: v => `내구 +${Math.round(v * 100)}%` },
  boots: { name: '장화', icon: 'boots', stat: '간격', val: t => 1 - Math.pow(0.95, t), fmt: v => `간격 -${Math.round(v * 100)}%` },
  lamp: { name: '랜턴', icon: 'lamp', stat: '행운', val: t => 0.06 * t, fmt: v => `행운 +${Math.round(v * 100)}%` },
};
export const GEAR_SLOTS = Object.keys(GEAR);
// Cost to craft tier t (t >= 1) of a slot: ore t-1 plus stone.
export function gearCost(slot, t) {
  const k = slot === 'pick' ? 1 : 0.6;
  return { [ORES[t - 1].id]: Math.round(120 * Math.pow(1.85, t - 1) * k), stone: Math.round(200 * Math.pow(2.8, t - 1) * k) };
}

// Stat upgrades bought with stone; levels are uncapped (interval has a floor).
export const UPGRADES = {
  atk: { name: '공격 강화', icon: 'pick', per: 0.08, text: lv => `공격력 +${Math.round(lv * 8)}%` },
  dur: { name: '내구 강화', icon: 'armor', per: 5, text: lv => `내구 +${lv * 5}` },
  spd: { name: '속도 강화', icon: 'boots', per: 0.03, text: lv => `간격 -${Math.round((1 - Math.pow(0.97, lv)) * 100)}%` },
  luck: { name: '행운 강화', icon: 'clover', per: 0.02, text: lv => `행운 +${lv * 2}%` },
};
export const upgradeCost = (id, lv) => Math.round((id === 'atk' ? 25 : 20) * Math.pow(1.25, lv));

// Abilities fire on their own every N swings. Unlocked and levelled (1-5) with gems.
export const ABILITIES = [
  { id: 'bomb', name: '폭탄', tier: 1, every: 15, mult: 0.6, shape: 'circle', r: 1, icon: 'bomb', color: '#4a4a5a', desc: '주변 3×3을 터뜨려요' },
  { id: 'fire', name: '화염구', tier: 1, every: 9, mult: 1, shape: 'line', n: 3, icon: 'flame', color: '#ff6a3a', desc: '바라보는 방향으로 3칸을 태워요' },
  { id: 'bolt', name: '번개', tier: 2, every: 12, mult: 1.2, shape: 'chain', n: 4, r: 3, icon: 'bolt', color: '#ffe066', desc: '가까운 블록 4개에 번개가 튀어요' },
  { id: 'frost', name: '냉기', tier: 2, every: 20, mult: 0.5, shape: 'circle', r: 2, haste: 3, icon: 'snow', color: '#9ae8ff', desc: '주변을 얼려 부수고 3초간 빨라져요' },
  { id: 'dyn', name: '다이너마이트', tier: 3, every: 18, mult: 0.8, shape: 'row', icon: 'dyn', color: '#e8484a', desc: '아래 줄 전체를 날려요' },
  { id: 'drill', name: '드릴', tier: 3, every: 22, mult: 1.5, shape: 'col', n: 6, icon: 'drill', color: '#b8c4d0', desc: '아래로 6칸을 곧장 뚫어요' },
  { id: 'meteor', name: '메테오', tier: 4, every: 30, mult: 1.2, shape: 'meteor', r: 2, icon: 'meteor', color: '#ff8a3d', desc: '아래쪽에 운석이 떨어져 넓게 파내요' },
  { id: 'vortex', name: '블랙홀', tier: 4, every: 36, mult: 0.6, shape: 'circle', r: 3, icon: 'swirl', color: '#8a4ad0', desc: '주변을 크게 빨아들여 부숴요' },
  { id: 'nova', name: '초신성', tier: 5, every: 50, mult: 0.8, shape: 'circle', r: 4, icon: 'star', color: '#fff6b0', desc: '화면을 뒤덮는 대폭발' },
];
export const ABILITY = Object.fromEntries(ABILITIES.map(a => [a.id, a]));
export const ABIL_MAX = 5;
export const abilityUnlockFloor = a => (a.tier - 1) * 150;
export const abilityCost = (a, lv) => a.tier * 8 * (lv + 1) ** 2; // gems to go from lv to lv+1

// Relics: found in treasure chests, permanent. Duplicates raise the level.
export const RARITY = [
  { name: '일반', color: '#d6d6d6', w: 60 },
  { name: '희귀', color: '#5ab4ff', w: 28 },
  { name: '영웅', color: '#c27bff', w: 10 },
  { name: '전설', color: '#ffbe4d', w: 2 },
];
// Total copies needed for each level (index = level - 1).
export const RELIC_COPIES = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55];
export const RELIC_MAX = RELIC_COPIES.length;
const pct = v => `${Math.round(v * 1000) / 10}%`;
export const FX_TEXT = {
  atk: v => `공격력 +${pct(v)}`, atkMul: v => `최종 공격력 ×${(1 + v).toFixed(2)}`,
  durFlat: v => `내구 +${Math.round(v)}`, durPct: v => `내구 +${pct(v)}`, spd: v => `간격 -${pct(v)}`,
  luck: v => `행운 +${pct(v)}`, luckMul: v => `최종 행운 ×${(1 + v).toFixed(2)}`,
  chest: v => `보물상자 확률 +${pct(v)}`, gem: v => `보석 원석 확률 +${pct(v)}`, ore: v => `광석 등장 +${pct(v)}`,
  stone: v => `돌 획득 +${pct(v)}`, double: v => `광석 2배 확률 +${pct(v)}`,
  abil: v => `어빌리티 피해 +${pct(v)}`, cd: v => `어빌리티 발동 간격 -${pct(v)}`,
  revive: v => `내구가 다하면 한 번 부활 (최대 내구의 ${pct(v)})`, idle: v => `광부 오두막 생산 +${pct(v)}`,
};
export const fxText = (fx, lv) => Object.entries(fx).map(([k, v]) => FX_TEXT[k](v * lv)).join(', ');
export const RELICS = [
  { id: 'glove', name: '낡은 장갑', r: 0, icon: 'hide', color: '#b8783a', fx: { atk: 0.03 } },
  { id: 'lunch', name: '광부의 도시락', r: 0, icon: 'chest', color: '#e8a93a', fx: { durFlat: 3 } },
  { id: 'compass', name: '녹슨 나침반', r: 0, icon: 'orb', color: '#c8a050', fx: { chest: 0.04 } },
  { id: 'pouch', name: '가죽 주머니', r: 0, icon: 'bag', color: '#a8743a', fx: { stone: 0.05 } },
  { id: 'clover', name: '네잎클로버', r: 0, icon: 'clover', color: '#6bbf5a', fx: { luck: 0.02 } },
  { id: 'chalk', name: '광부의 분필', r: 0, icon: 'scroll', color: '#efe9d8', fx: { gem: 0.04 } },
  { id: 'claw', name: '두더지 발톱', r: 1, icon: 'horn', color: '#e8d8b8', fx: { spd: 0.01 } },
  { id: 'powder', name: '화약 주머니', r: 1, icon: 'bomb', color: '#5a5a6a', fx: { abil: 0.05 } },
  { id: 'lens', name: '수정 렌즈', r: 1, icon: 'gem', color: '#9affe0', fx: { double: 0.015 } },
  { id: 'canteen', name: '튼튼한 물통', r: 1, icon: 'potion', color: '#4a9aff', fx: { durPct: 0.02 } },
  { id: 'rod', name: '피뢰침', r: 1, icon: 'bolt', color: '#ffe066', fx: { cd: 0.015 } },
  { id: 'hammer', name: '드워프의 망치', r: 2, icon: 'pick', color: '#c8c8d0', fx: { atk: 0.06 } },
  { id: 'hourglass', name: '시간의 모래시계', r: 2, icon: 'potion', color: '#ffcf87', fx: { cd: 0.025 } },
  { id: 'heart', name: '용의 심장', r: 2, icon: 'orb', color: '#ff3a5a', fx: { abil: 0.08 } },
  { id: 'feather', name: '불사조 깃털', r: 2, icon: 'feather', color: '#ff7a2a', fx: { revive: 0.03 } },
  { id: 'magnet', name: '황금 자석', r: 2, icon: 'charm', color: '#ffd34d', fx: { ore: 0.04 } },
  { id: 'primpick', name: '태초의 곡괭이', r: 3, icon: 'sword', color: '#fff3a0', fx: { atkMul: 0.05 } },
  { id: 'abyss', name: '심연의 눈', r: 3, icon: 'orb', color: '#c83aff', fx: { luckMul: 0.04 } },
  { id: 'crown', name: '광산왕의 왕관', r: 3, icon: 'star', color: '#ffbe4d', fx: { idle: 0.1 } },
];
export const RELIC = Object.fromEntries(RELICS.map(r => [r.id, r]));

// Village buildings: permanent bonuses, levels 1-10, paid with stone and ore.
export const BUILDINGS = [
  { id: 'smith', name: '대장간', icon: 'pick', color: '#ff8a3a', per: 0.05, text: v => `공격력 +${Math.round(v * 100)}%`, desc: '곡괭이를 손봐 공격력이 오릅니다' },
  { id: 'inn', name: '식당', icon: 'meat', color: '#e88a7a', per: 0.04, text: v => `내구 +${Math.round(v * 100)}%`, desc: '든든히 먹고 출발해 내구가 늘어납니다' },
  { id: 'smelter', name: '제련소', icon: 'ore', color: '#e08a4a', per: 0.06, text: v => `광석 2배 확률 +${Math.round(v * 100)}%`, desc: '광석을 제련해 더 많이 얻습니다' },
  { id: 'vault', name: '보물 창고', icon: 'chest', color: '#c8913a', per: 0.1, text: v => `보물상자 확률 +${Math.round(v * 100)}%`, desc: '상자 냄새를 잘 맡게 됩니다' },
  { id: 'trader', name: '행상인의 집', icon: 'bag', color: '#6aa8ff', per: 0.03, text: v => `강화 비용 -${Math.round(v * 100)}%`, desc: '강화 재료를 싸게 구해 줍니다' },
  { id: 'hut', name: '광부 오두막', icon: 'person', color: '#7be07b', per: 1, text: v => `자리를 비워도 시간당 돌 ${v * 40}개+`, desc: '고용한 광부가 쉬지 않고 캡니다 (오프라인 포함)' },
];
export const BUILDING = Object.fromEntries(BUILDINGS.map(b => [b.id, b]));
export const BUILD_MAX = 10;
export function buildCost(lv) { // cost to go from lv to lv+1
  const ore = ORES[Math.min(ORES.length - 1, lv)];
  return { stone: Math.round(200 * Math.pow(2.3, lv)), [ore.id]: 20 + 25 * lv };
}

// Missions: each has a ladder of goals; claiming one shows the next.
export const MISSIONS = [
  { id: 'deep', name: '최고 도달 층', goals: [10, 25, 50, 100, 150, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1200, 1500, 2000], stat: s => s.stats.deepest, reward: i => ({ gems: 4 + i * 3, chests: 1 + (i >> 2) }) },
  { id: 'blocks', name: '부순 블록', goals: [100, 400, 1500, 5000, 15000, 50000, 150000, 500000], stat: s => s.stats.blocks, reward: i => ({ gems: 3 + i * 3, chests: 1 }) },
  { id: 'runs', name: '채굴 출발', goals: [3, 10, 30, 80, 200, 500], stat: s => s.stats.runs, reward: i => ({ gems: 3 + i * 2 }) },
  { id: 'chests', name: '연 보물상자', goals: [1, 5, 15, 40, 100, 250], stat: s => s.stats.opened, reward: i => ({ gems: 5 + i * 4 }) },
  { id: 'pick', name: '곡괭이 등급', goals: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], stat: s => s.gear.pick, reward: i => ({ gems: 5 + i * 5, chests: 1 }) },
];

export const TIPS = [
  '방향키(←↓→)나 화면 아래 버튼으로 직접 팔 수 있어요. 자동 채굴을 켜 두면 알아서 내려갑니다.',
  '보물상자는 마을로 돌아와 열어야 해요. 같은 유물을 또 얻으면 레벨이 올라갑니다.',
  '보석 원석에서 나온 보석으로 어빌리티를 배우고 키울 수 있어요.',
  '최고 기록 근처의 층에서 바로 출발할 수 있어요. 깊을수록 좋은 광석이 나옵니다.',
];
