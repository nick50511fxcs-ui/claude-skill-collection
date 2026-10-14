// Static game data: rarity tiers, skills, spots, items, recipes, monsters,
// regions, rebirth perks and memory cards. Player-facing text is Korean.

export const TIERS = [
  { key: 'common', name: '일반', color: '#d6d6d6', codex: 0.002 },
  { key: 'uncommon', name: '고급', color: '#7be07b', codex: 0.004 },
  { key: 'rare', name: '희귀', color: '#5ab4ff', codex: 0.01 },
  { key: 'epic', name: '영웅', color: '#c27bff', codex: 0.02 },
  { key: 'legend', name: '전설', color: '#ffbe4d', codex: 0.04 },
  { key: 'myth', name: '신화', color: '#ff5f87', codex: 0.08 },
  { key: 'prim', name: '태초', color: '#8ffcff', codex: 0.2 },
];

// Base chance per action / kill. Tiers 2+ are multiplied by the luck multiplier.
// uncommon 15%, rare 3%, epic 0.3%, legend 0.02%, myth 0.002%, primordial 0.0001%.
export const TIER_P = [null, 0.15, 0.03, 0.003, 0.0002, 0.00002, 0.000001];
export const LUCK_CAP = 3;

// Life skills are leveled by actions; combat mastery by kills.
export const SKILLS = {
  combat: { name: '전투 숙련', short: '전투', icon: 'sword', color: '#e8e8f0', stat: '공격력·HP', per: '+0.1% 공격력·최대 HP' },
  mining: { name: '광질', short: '광질', icon: 'pick', color: '#c8c8d0', stat: '공격력', per: '+0.1% 공격력' },
  wood: { name: '벌목', short: '벌목', icon: 'axe', color: '#c08a4a', stat: '스태미나', per: '+0.1% 최대 스태미나' },
  forage: { name: '채집', short: '채집', icon: 'leaf', color: '#6bbf5a', stat: '최대 HP', per: '+0.1% 최대 HP, 독 저항' },
  fish: { name: '낚시', short: '낚시', icon: 'fish', color: '#5ab4ff', stat: '행운', per: '+0.0005 행운 배율' },
  hunt: { name: '사냥', short: '사냥', icon: 'bow', color: '#d8784a', stat: '치명 피해', per: '+0.1% 치명타 피해' },
  alchemy: { name: '연금술', short: '연금', icon: 'potion', color: '#c27bff', stat: '물약 효과', per: '+0.1% 물약 효과' },
};
export const LIFE_SKILLS = ['mining', 'wood', 'forage', 'fish', 'hunt', 'alchemy'];
export const GATHER_SKILLS = ['mining', 'wood', 'forage', 'fish', 'hunt'];

// Tool tier changes every 100 levels (visible on the sprite).
export const TOOL_TIERS = [
  { name: '나무', color: '#a8743a' }, { name: '강철', color: '#b8c4d0' }, { name: '은', color: '#e8eef8' },
  { name: '금', color: '#ffd34d' }, { name: '미스릴', color: '#7fe3ff' }, { name: '아다만', color: '#6aff9e' },
  { name: '흑요', color: '#7a5aa8' }, { name: '용린', color: '#ff6a3d' }, { name: '별빛', color: '#fff6b0' },
  { name: '천공', color: '#9ab8ff' }, { name: '마스터', color: '#ffe066' },
];

export const AWAKENINGS = {
  250: '각성 Ⅰ · 채집물 2배 확률 5%',
  500: '각성 Ⅱ · 채집물 2배 확률 10%',
  750: '각성 Ⅲ · 희귀 이상 확률 ×1.5',
  1000: '마스터 · 전용 칭호와 전역 보너스',
};
export const MASTER_BONUS = {
  combat: '모든 공격력·HP ×1.25', mining: '공격력 ×1.25', wood: '모든 생활 속도 ×1.15',
  forage: '최대 HP ×1.25', fish: '행운 상한 +0.5', hunt: '치명타 피해 ×1.5', alchemy: '물약 효과 ×2',
};
export const MASTER_TITLE = {
  combat: '전장의 주인', mining: '대지의 주인', wood: '숲의 주인', forage: '들판의 주인',
  fish: '바다의 주인', hunt: '숲의 사냥꾼', alchemy: '진리의 연금술사',
};

const I = {};
function it(id, name, tier, icon, color, skill, extra = {}) {
  I[id] = { id, name, tier, icon, color, skill, ...extra };
  return id;
}

// ---- Mining
it('m_copper', '구리 광석', 0, 'ore', '#e08a4a', 'mining');
it('m_tin', '주석 광석', 1, 'ore', '#c9d1d9', 'mining');
it('m_quartz', '석영', 2, 'gem', '#eef0ff', 'mining');
it('m_iron', '철 광석', 0, 'ore', '#b07a6a', 'mining');
it('m_coal', '석탄', 1, 'ore', '#4a4a50', 'mining');
it('m_amethyst', '자수정', 2, 'gem', '#a66bff', 'mining');
it('m_silver', '은 광석', 0, 'ore', '#e6ecf5', 'mining');
it('m_gold', '금 광석', 1, 'ore', '#ffd34d', 'mining');
it('m_sapphire', '사파이어', 2, 'gem', '#3d7cff', 'mining');
it('m_mithril', '미스릴 광석', 0, 'ore', '#7fe3ff', 'mining');
it('m_obsidian', '흑요석', 1, 'gem', '#4a3a6a', 'mining');
it('m_ruby', '루비', 2, 'gem', '#ff3b5c', 'mining');
it('m_adamant', '아다만 광석', 0, 'ore', '#6aff9e', 'mining');
it('m_meteor', '운석 조각', 1, 'ore', '#ff8a3d', 'mining');
it('m_stardia', '별빛 다이아', 2, 'gem', '#ffffff', 'mining');
it('m_fossil', '고대 화석', 3, 'shell', '#d8c39a', 'mining');
it('m_dragonstone', '용의 비늘석', 4, 'scale', '#ff6a3d', 'mining');
it('m_timecrystal', '시간의 결정', 5, 'orb', '#9effe0', 'mining');
it('m_prim', '별의 심장석', 6, 'star', '#fff3a0', 'mining', { effect: '공격력 ×1.5 (중복 획득마다 +0.1)' });

// ---- Woodcutting
it('w_oak', '참나무 원목', 0, 'log', '#c08a4a', 'wood');
it('w_resin', '송진', 1, 'drop', '#e8a93a', 'wood');
it('w_acorn', '도토리', 2, 'seed', '#a8743a', 'wood');
it('w_birch', '자작나무 원목', 0, 'log', '#e8dcc8', 'wood');
it('w_maple', '단풍 수액', 1, 'drop', '#d9532c', 'wood');
it('w_pinecone', '황금 솔방울', 2, 'seed', '#ffcc4d', 'wood');
it('w_elder', '고목 원목', 0, 'log', '#7a5432', 'wood');
it('w_amber', '호박석', 1, 'gem', '#ffb030', 'wood');
it('w_owl', '부엉이 깃털', 2, 'feather', '#b89a7a', 'wood');
it('w_mana', '마나 원목', 0, 'log', '#6a8cff', 'wood');
it('w_spirit', '정령 수액', 1, 'drop', '#7dffe0', 'wood');
it('w_fairy', '요정 날개', 2, 'feather', '#ffb8f0', 'wood');
it('w_world', '세계수 가지', 0, 'log', '#8fe07a', 'wood');
it('w_goldsap', '황금 수액', 1, 'drop', '#ffd700', 'wood');
it('w_glowleaf', '빛나는 잎', 2, 'leaf', '#c8ff6a', 'wood');
it('w_ring', '천년 나이테', 3, 'log', '#ffcf87', 'wood');
it('w_entheart', '엔트의 심장', 4, 'orb', '#6bbf3a', 'wood');
it('w_rainbow', '무지개 송진', 5, 'drop', '#ff7ae0', 'wood');
it('w_prim', '세계수의 묘목', 6, 'sprout', '#7dff7a', 'wood', { effect: '모든 생활 속도 ×1.25 (중복마다 +0.05)' });

// ---- Foraging
it('f_mugwort', '쑥', 0, 'leaf', '#6bbf5a', 'forage');
it('f_dandelion', '민들레', 1, 'flower', '#ffe14d', 'forage');
it('f_mushroom', '버섯', 2, 'mushroom', '#c8553d', 'forage');
it('f_mint', '박하', 0, 'leaf', '#6effc8', 'forage');
it('f_berry', '블루베리', 1, 'seed', '#4a5cff', 'forage');
it('f_pine', '송이버섯', 2, 'mushroom', '#d8b48a', 'forage');
it('f_antidote', '해독초', 0, 'leaf', '#9a6bff', 'forage');
it('f_mandrake', '맨드레이크', 1, 'root', '#c8a27a', 'forage');
it('f_firefly', '반딧불 이끼', 2, 'leaf', '#d8ff5a', 'forage');
it('f_snowlotus', '설련화', 0, 'flower', '#e8f6ff', 'forage');
it('f_poppy', '고산 양귀비', 1, 'flower', '#6aa8ff', 'forage');
it('f_ginseng', '산삼', 2, 'root', '#f0d8a8', 'forage');
it('f_moonflower', '달빛 꽃', 0, 'flower', '#c8d0ff', 'forage');
it('f_dew', '별 이슬', 1, 'drop', '#b8f4ff', 'forage');
it('f_fairyshroom', '요정 버섯', 2, 'mushroom', '#ff8ae8', 'forage');
it('f_goldacorn', '황금 도토리', 3, 'seed', '#ffcf3a', 'forage');
it('f_phoenix', '불사조 깃털', 4, 'feather', '#ff5a2a', 'forage');
it('f_oldginseng', '천년 산삼', 5, 'root', '#ffe9b0', 'forage');
it('f_prim', '일곱 빛 네잎클로버', 6, 'clover', '#7dff9a', 'forage', { effect: '행운 상한 +0.5 (중복마다 +0.1)' });

// ---- Fishing (w = base weight in kg for size records)
it('s_minnow', '피라미', 0, 'fish', '#b8c8d8', 'fish', { w: 0.05 });
it('s_crucian', '붕어', 1, 'fish', '#c8a050', 'fish', { w: 0.4 });
it('s_trout', '무지개송어', 2, 'fish', '#ff8aa8', 'fish', { w: 1.2 });
it('s_carp', '잉어', 0, 'fish', '#d89a50', 'fish', { w: 3 });
it('s_catfish', '메기', 1, 'fish', '#7a7a62', 'fish', { w: 5 });
it('s_goldcarp', '황금 잉어', 2, 'fish', '#ffd34d', 'fish', { w: 4 });
it('s_salmon', '연어', 0, 'fish', '#ff8a6a', 'fish', { w: 4 });
it('s_eel', '장어', 1, 'fish', '#5a6a3a', 'fish', { w: 2 });
it('s_sturgeon', '철갑상어', 2, 'fish', '#8a9aa8', 'fish', { w: 20 });
it('s_mackerel', '고등어', 0, 'fish', '#4a8ad8', 'fish', { w: 0.8 });
it('s_tuna', '참치', 1, 'fish', '#3a5a9a', 'fish', { w: 60 });
it('s_marlin', '청새치', 2, 'fish', '#3a7aff', 'fish', { w: 90 });
it('s_angler', '아귀', 0, 'fish', '#7a5a4a', 'fish', { w: 15 });
it('s_squid', '대왕오징어', 1, 'tentacle', '#ff6a6a', 'fish', { w: 150 });
it('s_dragonfish', '심해 용고기', 2, 'fish', '#3affd8', 'fish', { w: 40 });
it('s_spring', '벚꽃 연어', 2, 'fish', '#ffb8d8', 'fish', { w: 5, season: 0 });
it('s_summer', '반딧불 은어', 2, 'fish', '#d8ff6a', 'fish', { w: 0.3, season: 1 });
it('s_autumn', '단풍 쏘가리', 2, 'fish', '#ff7a2a', 'fish', { w: 1.5, season: 2 });
it('s_winter', '얼음 빙어', 2, 'fish', '#bff2ff', 'fish', { w: 0.1, season: 3 });
it('s_chest', '물에 젖은 보물상자', 3, 'chest', '#c8913a', 'fish');
it('s_mermaid', '인어의 비늘', 4, 'scale', '#6affe8', 'fish');
it('s_kraken', '크라켄의 촉수', 5, 'tentacle', '#c83aff', 'fish');
it('s_prim', '달을 삼킨 고래', 6, 'whale', '#6a7aff', 'fish', { effect: '밤 동안 모든 경험치 ×1.3 (중복마다 +0.05)' });

// ---- Hunting
it('h_rabbitmeat', '토끼 고기', 0, 'meat', '#e88a7a', 'hunt');
it('h_rabbithide', '토끼 가죽', 1, 'hide', '#e8dcc8', 'hunt');
it('h_pheasant', '꿩 깃털', 2, 'feather', '#c84a2a', 'hunt');
it('h_venison', '사슴 고기', 0, 'meat', '#c85a4a', 'hunt');
it('h_deerhide', '사슴 가죽', 1, 'hide', '#b8783a', 'hunt');
it('h_antler', '사슴뿔', 2, 'horn', '#e8d8b8', 'hunt');
it('h_boar', '멧돼지 고기', 0, 'meat', '#a84a3a', 'hunt');
it('h_bearhide', '곰 가죽', 1, 'hide', '#6a4a32', 'hunt');
it('h_claw', '곰 발톱', 2, 'horn', '#f0f0e0', 'hunt');
it('h_wolfhide', '설원 늑대 가죽', 0, 'hide', '#d8e0f0', 'hunt');
it('h_tusk', '매머드 상아', 1, 'horn', '#fff6d8', 'hunt');
it('h_fang', '설표 송곳니', 2, 'horn', '#e8f0ff', 'hunt');
it('h_griffin', '그리핀 깃털', 0, 'feather', '#ffd87a', 'hunt');
it('h_unicorn', '유니콘 뿔 조각', 1, 'horn', '#ffe0ff', 'hunt');
it('h_kirin', '기린 비늘', 2, 'scale', '#7affb8', 'hunt');
it('h_white', '백색 변이 가죽', 3, 'hide', '#ffffff', 'hunt');
it('h_goldantler', '황금 사슴뿔', 4, 'horn', '#ffd34d', 'hunt');
it('h_gumiho', '구미호 꼬리', 5, 'feather', '#ff9a3a', 'hunt');
it('h_prim', '하얀 사슴 왕', 6, 'deer', '#f0ffff', 'hunt', { effect: '치명타 피해 +100% (중복마다 +20%)' });

// ---- Combat (region materials + skill-wide rares)
it('c_jelly', '슬라임 젤리', 0, 'jelly', '#7ae05a', 'combat');
it('c_spore', '버섯 포자', 1, 'drop', '#d8a87a', 'combat');
it('c_crown', '왕관 조각', 2, 'gem', '#ffd34d', 'combat');
it('c_slime', '독 점액', 0, 'jelly', '#a65aff', 'combat');
it('c_poisonspore', '독버섯 포자', 1, 'drop', '#c85aff', 'combat');
it('c_venom', '독샘', 2, 'orb', '#7aff3a', 'combat');
it('c_batwing', '박쥐 날개', 0, 'feather', '#6a8ab8', 'combat');
it('c_yetifur', '설인 털', 1, 'hide', '#f0f8ff', 'combat');
it('c_icecore', '얼음 핵', 2, 'orb', '#9ae8ff', 'combat');
it('c_shadow', '그림자 정수', 0, 'orb', '#7a4ab8', 'combat');
it('c_abyss', '심연 파편', 1, 'gem', '#4a2a7a', 'combat');
it('c_voideye', '공허의 눈', 2, 'orb', '#ff3aff', 'combat');
it('c_core', '몬스터 핵', 3, 'orb', '#ff4a4a', 'combat');
it('c_seal', '마왕의 인장', 4, 'charm', '#ffcf3a', 'combat');
it('c_tear', '고대 신의 눈물', 5, 'drop', '#aaffff', 'combat');
it('c_prim', '잊혀진 신의 파편', 6, 'star', '#ffffff', 'combat', { effect: '모든 스탯 +5% (중복마다 +2%)' });

// ---- Alchemy (products + skill-wide rares)
it('p_str', '힘의 물약', 0, 'potion', '#ff4a4a', 'alchemy', { potion: 'str', desc: '이번 전투 동안 공격력 +25%' });
it('p_hp', '체력의 물약', 0, 'potion', '#4aff7a', 'alchemy', { potion: 'hp', desc: '이번 전투 동안 최대 HP +25%' });
it('p_sta', '지구력 물약', 0, 'potion', '#4a9aff', 'alchemy', { potion: 'sta', desc: '이번 전투 동안 스태미나 +40%' });
it('p_antidote', '해독 물약', 1, 'potion', '#a65aff', 'alchemy', { potion: 'antidote', desc: '이번 전투 동안 독 무효' });
it('p_warm', '온기의 물약', 1, 'potion', '#ff8a2a', 'alchemy', { potion: 'warm', desc: '이번 전투 동안 한기 무효' });
it('p_luck', '행운의 물약', 1, 'potion', '#ffd34d', 'alchemy', { potion: 'luck', desc: '이번 전투 동안 행운 배율 +0.3' });
it('x_str', '힘의 영약', 2, 'elixir', '#ff2a5a', 'alchemy', { elixir: 'atk', desc: '영구 공격력 +2% (최대 50회)' });
it('x_life', '생명의 영약', 2, 'elixir', '#2aff8a', 'alchemy', { elixir: 'hp', desc: '영구 최대 HP +2% (최대 50회)' });
it('x_cat', '행운의 촉매', 2, 'orb', '#ffe87a', 'alchemy', { desc: '사용 시 1시간 동안 생활 희귀 확률 ×1.5' });
it('x_secret', '???의 영약', 4, 'elixir', '#ffffff', 'alchemy', { elixir: 'all', desc: '영구 모든 스탯 +3% (최대 20회)' });
it('a_salt', '현자의 소금', 3, 'gem', '#f0f0f0', 'alchemy');
it('a_essence', '엘릭서 원액', 4, 'potion', '#ff9aff', 'alchemy');
it('a_homunculus', '호문쿨루스 플라스크', 5, 'potion', '#9aff9a', 'alchemy');
it('a_prim', '현자의 돌', 6, 'stone', '#ff2a3a', 'alchemy', { effect: '물약 효과 ×2 (중복마다 +0.1), 연금 실패 없음' });

export const ITEMS = I;

// Spots unlock at these levels; each gives common / uncommon / rare items.
export const SPOT_LV = [1, 50, 150, 300, 500];
export const SPOT_XP = [8, 14, 24, 40, 65];
export const SPOTS = {
  mining: [
    { name: '얕은 갱도', items: ['m_copper', 'm_tin', 'm_quartz'] },
    { name: '철광 언덕', items: ['m_iron', 'm_coal', 'm_amethyst'] },
    { name: '수정 동굴', items: ['m_silver', 'm_gold', 'm_sapphire'] },
    { name: '심연 광맥', items: ['m_mithril', 'm_obsidian', 'm_ruby'] },
    { name: '별똥 분화구', items: ['m_adamant', 'm_meteor', 'm_stardia'] },
  ],
  wood: [
    { name: '참나무 숲', items: ['w_oak', 'w_resin', 'w_acorn'] },
    { name: '자작나무 길', items: ['w_birch', 'w_maple', 'w_pinecone'] },
    { name: '고목의 숲', items: ['w_elder', 'w_amber', 'w_owl'] },
    { name: '마법의 숲', items: ['w_mana', 'w_spirit', 'w_fairy'] },
    { name: '세계수 뿌리', items: ['w_world', 'w_goldsap', 'w_glowleaf'] },
  ],
  forage: [
    { name: '들판', items: ['f_mugwort', 'f_dandelion', 'f_mushroom'] },
    { name: '숲길', items: ['f_mint', 'f_berry', 'f_pine'] },
    { name: '안개 늪', items: ['f_antidote', 'f_mandrake', 'f_firefly'] },
    { name: '고산 지대', items: ['f_snowlotus', 'f_poppy', 'f_ginseng'] },
    { name: '요정 정원', items: ['f_moonflower', 'f_dew', 'f_fairyshroom'] },
  ],
  fish: [
    { name: '개울', items: ['s_minnow', 's_crucian', 's_trout'] },
    { name: '호수', items: ['s_carp', 's_catfish', 's_goldcarp'] },
    { name: '강 하구', items: ['s_salmon', 's_eel', 's_sturgeon'] },
    { name: '먼 바다', items: ['s_mackerel', 's_tuna', 's_marlin'] },
    { name: '심해', items: ['s_angler', 's_squid', 's_dragonfish'] },
  ],
  hunt: [
    { name: '초원', items: ['h_rabbitmeat', 'h_rabbithide', 'h_pheasant'] },
    { name: '사슴 숲', items: ['h_venison', 'h_deerhide', 'h_antler'] },
    { name: '산악 지대', items: ['h_boar', 'h_bearhide', 'h_claw'] },
    { name: '설원', items: ['h_wolfhide', 'h_tusk', 'h_fang'] },
    { name: '신수의 숲', items: ['h_griffin', 'h_unicorn', 'h_kirin'] },
  ],
};
// Skill-wide high tiers: [epic, legend, myth, primordial].
export const SKILL_RARES = {
  mining: ['m_fossil', 'm_dragonstone', 'm_timecrystal', 'm_prim'],
  wood: ['w_ring', 'w_entheart', 'w_rainbow', 'w_prim'],
  forage: ['f_goldacorn', 'f_phoenix', 'f_oldginseng', 'f_prim'],
  fish: ['s_chest', 's_mermaid', 's_kraken', 's_prim'],
  hunt: ['h_white', 'h_goldantler', 'h_gumiho', 'h_prim'],
  combat: ['c_core', 'c_seal', 'c_tear', 'c_prim'],
  alchemy: ['a_salt', 'a_essence', 'a_homunculus', 'a_prim'],
};
export const SEASON_FISH = ['s_spring', 's_summer', 's_autumn', 's_winter'];
export const SEASON_NAME = ['봄', '여름', '가을', '겨울'];

export const RECIPES = [
  { id: 'p_str', lv: 1, xp: 10, in: { f_mugwort: 3, m_copper: 2 } },
  { id: 'p_hp', lv: 8, xp: 14, in: { f_dandelion: 2, s_minnow: 3 } },
  { id: 'p_sta', lv: 15, xp: 18, in: { w_oak: 4, h_rabbitmeat: 2 } },
  { id: 'p_antidote', lv: 25, xp: 24, in: { f_mugwort: 5, f_mushroom: 1, c_slime: 2 } },
  { id: 'p_warm', lv: 40, xp: 32, in: { w_resin: 3, m_coal: 2, c_batwing: 2 } },
  { id: 'p_luck', lv: 60, xp: 40, in: { h_pheasant: 1, s_crucian: 3, w_acorn: 1 } },
  { id: 'x_str', lv: 100, xp: 80, in: { h_antler: 2, m_amethyst: 2, f_pine: 3 }, max: 50 },
  { id: 'x_life', lv: 150, xp: 110, in: { f_mandrake: 3, s_salmon: 5, h_bearhide: 2 }, max: 50 },
  { id: 'x_cat', lv: 200, xp: 140, in: { f_firefly: 3, s_goldcarp: 1, m_sapphire: 1 } },
  { id: 'x_secret', lv: 1, xp: 300, in: { a_salt: 1, f_ginseng: 2, w_spirit: 2 }, max: 20, secret: true },
];

export const MONSTERS = {
  slime: { name: '슬라임', sprite: 'slime', pal: { a: '#7ae05a' }, hp: 1, atk: 1 },
  shroom: { name: '버섯돌이', sprite: 'shroom', pal: { r: '#e8553d' }, hp: 1.2, atk: 0.9 },
  kingslime: { name: '왕 슬라임', sprite: 'slime', pal: { a: '#5ad0e0' }, hp: 1, atk: 1, crown: true, scale: 2 },
  frog: { name: '독두꺼비', sprite: 'frog', pal: { a: '#9a5ad8' }, hp: 1, atk: 1.1 },
  pshroom: { name: '독버섯', sprite: 'shroom', pal: { r: '#a83ad8' }, hp: 1.3, atk: 0.9 },
  frogking: { name: '독두꺼비 대왕', sprite: 'frog', pal: { a: '#6a3ab8' }, hp: 1, atk: 1, crown: true, scale: 2 },
  bat: { name: '얼음 박쥐', sprite: 'bat', pal: { a: '#6a8ab8' }, hp: 0.8, atk: 1.2, fly: true },
  yeti: { name: '설인', sprite: 'yeti', pal: { a: '#e8f0ff' }, hp: 1.4, atk: 1 },
  yetiking: { name: '설인 왕', sprite: 'yeti', pal: { a: '#bfe0ff' }, hp: 1, atk: 1, crown: true, scale: 1.6 },
};

export const REGIONS = [
  { name: '햇살 초원', from: 1, mobs: ['slime', 'shroom'], boss: 'kingslime', mats: ['c_jelly', 'c_spore', 'c_crown'], gimmick: null, theme: 'meadow' },
  { name: '독안개 숲', from: 11, mobs: ['frog', 'pshroom'], boss: 'frogking', mats: ['c_slime', 'c_poisonspore', 'c_venom'], gimmick: 'poison', theme: 'swamp' },
  { name: '얼음 동굴', from: 21, mobs: ['bat', 'yeti'], boss: 'yetiking', mats: ['c_batwing', 'c_yetifur', 'c_icecore'], gimmick: 'ice', theme: 'ice' },
  { name: '무한의 탑', from: 31, mobs: ['slime', 'shroom', 'frog', 'bat', 'yeti'], boss: 'yetiking', mats: ['c_shadow', 'c_abyss', 'c_voideye'], gimmick: 'mixed', theme: 'tower' },
];
export const GIMMICK_TEXT = {
  poison: '독안개: 스태미나 소모 ×2.5 (채집 Lv 60 또는 해독 물약으로 무효)',
  ice: '한기: 공격 속도 -40% (벌목 Lv 80 또는 온기의 물약으로 무효)',
};

export const GEAR_NAMES = {
  weapon: ['낡은 검', '강철 검', '기사의 검', '영웅의 검', '전설의 검', '신화의 검', '태초의 검'],
  armor: ['천 옷', '가죽 갑옷', '사슬 갑옷', '영웅의 갑옷', '전설의 갑옷', '신화의 갑옷', '태초의 갑옷'],
  charm: ['조약돌 부적', '은 부적', '수정 부적', '영웅의 부적', '전설의 부적', '신화의 부적', '태초의 부적'],
};
export const GEAR_TIER_MULT = [1, 1.3, 1.7, 2.3, 3.2, 4.5, 7];

export const PERKS = {
  w_atk: { tree: 'war', name: '불꽃의 칼날', desc: '공격력 +10%', base: 1, grow: 1.4 },
  w_hp: { tree: 'war', name: '불꽃의 심장', desc: '최대 HP +10%', base: 1, grow: 1.4 },
  w_xp: { tree: 'war', name: '전투의 기억', desc: '캐릭터 경험치 +15%', base: 2, grow: 1.5 },
  w_start: { tree: 'war', name: '지름길', desc: '윤회 후 시작 층 +5', base: 5, grow: 2, max: 10 },
  a_speed: { tree: 'art', name: '숙련된 손', desc: '모든 생활 속도 +3%', base: 2, grow: 1.45, max: 20 },
  a_xp: { tree: 'art', name: '장인의 눈', desc: '생활 경험치 +5%', base: 2, grow: 1.45, max: 20 },
  a_luck: { tree: 'art', name: '행운의 불씨', desc: '행운 배율 +0.05', base: 3, grow: 1.6, max: 10 },
  r_clone: { tree: 'wan', name: '분신술', desc: '분신 슬롯 +1 (분신은 생활만, 속도 60%)', base: 10, grow: 6, max: 2 },
  r_offline: { tree: 'wan', name: '긴 여정', desc: '오프라인 상한 +2시간', base: 3, grow: 1.6, max: 18 },
  r_gold: { tree: 'wan', name: '방랑 상인', desc: '골드 +20%', base: 1, grow: 1.4 },
};
export const PERK_TREES = { war: '전사의 불', art: '장인의 불', wan: '방랑자의 불' };

export const MEMORIES = {
  fisher: { name: '전생에 어부였다', desc: '낚시 경험치 ×2', skill: 'fish' },
  miner: { name: '전생에 광부였다', desc: '광질 경험치 ×2', skill: 'mining' },
  lumber: { name: '전생에 나무꾼이었다', desc: '벌목 경험치 ×2', skill: 'wood' },
  herbal: { name: '전생에 약초꾼이었다', desc: '채집 경험치 ×2', skill: 'forage' },
  hunter: { name: '전생에 사냥꾼이었다', desc: '사냥 경험치 ×2', skill: 'hunt' },
  alchem: { name: '전생에 연금술사였다', desc: '연금술 경험치 ×2, 실패 없음', skill: 'alchemy' },
  berserk: { name: '전생에 광전사였다', desc: 'HP 50% 이하일 때 공격력 +60%' },
  coward: { name: '전생에 겁쟁이였다', desc: '회피 +30%, 공격력 -10%' },
  rich: { name: '전생에 부자였다', desc: '골드 ×3' },
  lucky: { name: '전생에 행운아였다', desc: '행운 배율 +0.5' },
  sleepy: { name: '전생에 잠꾸러기였다', desc: '야영 시간 +50% (생활 시간 증가)' },
  warrior: { name: '전생에 검투사였다', desc: '전투 숙련 경험치 ×2, 공격력 +15%' },
};

export const STAT_NAMES = { str: '힘', agi: '민첩', vit: '체력', luk: '행운' };
export const PRESETS = {
  balanced: { name: '균형형', w: { str: 4, agi: 2, vit: 3, luk: 1 } },
  attack: { name: '공격형', w: { str: 6, agi: 3, vit: 1, luk: 0 } },
  survive: { name: '생존형', w: { str: 3, agi: 1, vit: 6, luk: 0 } },
  luck: { name: '행운형', w: { str: 3, agi: 2, vit: 2, luk: 3 } },
};

export const LINES = {
  fight: ['오늘도 한 층 더!', '이 슬라임… 끈적해', '검이 점점 무거워지는 기분이야', '저 녀석, 날 노려보는데?', '모닥불이 그리워…'],
  camp: ['잠깐 쉬어 갈까', '불 좀 쬐자…', '소시지 굽고 싶다', '오늘은 대박 날 것 같아', '별이 예쁘네'],
  mining: ['반짝이는 게 보인다!', '팔이 저려…', '이 돌, 뭔가 수상해'],
  wood: ['나무가 쓰러진다아!', '나이테가 예쁘네', '도끼 날 좀 갈아야겠다'],
  forage: ['이건 먹어도 되는 거겠지?', '향긋하다', '네잎클로버는 어디 있을까'],
  fish: ['입질이 왔다!', '…아무것도 안 무네', '저번에 놓친 메기, 기억한다'],
  hunt: ['쉿… 조용히', '바람이 등 뒤에서 분다', '저기 뭔가 지나갔다'],
  alchemy: ['색이 변하고 있어…!', '이번엔 안 터지겠지', '킁킁, 냄새가 수상한데'],
};
