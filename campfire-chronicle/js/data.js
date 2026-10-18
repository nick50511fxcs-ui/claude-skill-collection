// Static game data: rarity tiers, skills, spots, items, recipes, monsters,
// regions, rebirth perks and memory cards. Player-facing text is Korean.

export const TIERS = [
  { key: 'common', name: '일반', color: '#d6d6d6', codex: 0.0012 },
  { key: 'uncommon', name: '고급', color: '#7be07b', codex: 0.0025 },
  { key: 'rare', name: '희귀', color: '#5ab4ff', codex: 0.006 },
  { key: 'epic', name: '영웅', color: '#c27bff', codex: 0.012 },
  { key: 'legend', name: '전설', color: '#ffbe4d', codex: 0.025 },
  { key: 'myth', name: '신화', color: '#ff5f87', codex: 0.05 },
  { key: 'prim', name: '태초', color: '#8ffcff', codex: 0.15 },
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
it('m_prim', '별의 심장석', 6, 'star', '#fff3a0', 'mining', { effect: '공격력 ×1.5 (중복 획득마다 +0.1, 최대 10회)' });

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
it('w_prim', '세계수의 묘목', 6, 'sprout', '#7dff7a', 'wood', { effect: '모든 생활 속도 ×1.25 (중복마다 +0.05, 최대 10회)' });

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
it('f_prim', '일곱 빛 네잎클로버', 6, 'clover', '#7dff9a', 'forage', { effect: '행운 상한 +0.5 (중복마다 +0.1, 최대 10회)' });

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
it('s_prim', '달을 삼킨 고래', 6, 'whale', '#6a7aff', 'fish', { effect: '밤 동안 모든 경험치 ×1.3 (중복마다 +0.05, 최대 10회)' });

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
it('h_prim', '하얀 사슴 왕', 6, 'deer', '#f0ffff', 'hunt', { effect: '치명타 피해 +100% (중복마다 +20%, 최대 10회)' });

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
it('c_prim', '잊혀진 신의 파편', 6, 'star', '#ffffff', 'combat', { effect: '모든 스탯 +5% (중복마다 +2%, 최대 10회)' });

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
it('a_prim', '현자의 돌', 6, 'stone', '#ff2a3a', 'alchemy', { effect: '물약 효과 ×2 (중복마다 +0.1, 최대 10회), 연금 실패 없음' });

// ---- Expansion: two more items per spot, more rares per tier, trophies, seasonal fish, alchemy
it('m_clay', '점토 덩어리', 0, 'ore', '#b08a6a', 'mining');
it('m_flint', '부싯돌', 1, 'gem', '#8a8a9a', 'mining');
it('m_lead', '납 광석', 0, 'ore', '#7a8090', 'mining');
it('m_garnet', '석류석', 1, 'gem', '#b0304a', 'mining');
it('m_crystalsand', '수정 모래', 0, 'drop', '#cfe6ff', 'mining');
it('m_topaz', '토파즈', 1, 'gem', '#ffc04a', 'mining');
it('m_darksteel', '암흑철 광석', 0, 'ore', '#4a4a6a', 'mining');
it('m_emerald', '에메랄드', 1, 'gem', '#3ad07a', 'mining');
it('m_stardust', '별가루', 0, 'drop', '#fff0c0', 'mining');
it('m_moonstone', '월장석', 1, 'gem', '#c8d8ff', 'mining');
it('m_geode', '정동석', 3, 'orb', '#a87aff', 'mining');
it('m_relic', '드워프의 유물', 3, 'charm', '#c8a060', 'mining');
it('m_titanheart', '거인의 심장석', 4, 'orb', '#ff8a5a', 'mining');
it('m_voidcore', '공허의 핵석', 5, 'orb', '#5a3a9a', 'mining');

it('w_twig', '잔가지', 0, 'log', '#b08a5a', 'wood');
it('w_moss', '이끼 덩굴', 1, 'leaf', '#6a9a4a', 'wood');
it('w_bark', '자작나무 껍질', 0, 'hide', '#efe9d8', 'wood');
it('w_honey', '야생 벌꿀', 1, 'drop', '#ffb030', 'wood');
it('w_burl', '옹이 목재', 0, 'log', '#8a5a3a', 'wood');
it('w_mistletoe', '겨우살이', 1, 'leaf', '#5ad08a', 'wood');
it('w_starwood', '별나무 가지', 0, 'log', '#8a8aff', 'wood');
it('w_dryad', '드라이어드의 눈물', 1, 'drop', '#9affd8', 'wood');
it('w_lightwood', '빛나무 판재', 0, 'log', '#ffeaa0', 'wood');
it('w_seedpod', '세계수 씨앗꼬투리', 1, 'seed', '#b8ff7a', 'wood');
it('w_beehive', '황금 벌집', 3, 'chest', '#ffc040', 'wood');
it('w_carving', '고대 목각상', 3, 'charm', '#a8784a', 'wood');
it('w_crown', '숲의 왕관', 4, 'charm', '#6bd04a', 'wood');
it('w_heartwood', '영원의 심재', 5, 'log', '#ffd8a0', 'wood');

it('f_clover', '세잎클로버', 0, 'clover', '#5ab45a', 'forage');
it('f_wildrose', '들장미', 1, 'flower', '#ff7a9a', 'forage');
it('f_fern', '고사리', 0, 'leaf', '#4a9a5a', 'forage');
it('f_raspberry', '산딸기', 1, 'seed', '#e83a5a', 'forage');
it('f_reed', '갈대', 0, 'leaf', '#a8a06a', 'forage');
it('f_lotus', '연꽃', 1, 'flower', '#ffa8d8', 'forage');
it('f_edelweiss', '에델바이스', 0, 'flower', '#f8f8ff', 'forage');
it('f_cloudberry', '운무 열매', 1, 'seed', '#ffd08a', 'forage');
it('f_starpetal', '별꽃잎', 0, 'flower', '#fff6a0', 'forage');
it('f_dreamleaf', '꿈결 잎', 1, 'leaf', '#d8a8ff', 'forage');
it('f_silverfern', '은빛 고사리', 3, 'leaf', '#e0e8f0', 'forage');
it('f_bloodroot', '혈근초', 3, 'root', '#c83a4a', 'forage');
it('f_lifeflower', '생명의 꽃', 4, 'flower', '#7affb0', 'forage');
it('f_moonherb', '월하 신초', 5, 'leaf', '#c8d0ff', 'forage');

it('s_loach', '미꾸라지', 0, 'fish', '#9a8a6a', 'fish', { w: 0.1 });
it('s_shrimp', '민물새우', 1, 'fish', '#ffa88a', 'fish', { w: 0.02 });
it('s_perch', '농어', 0, 'fish', '#8aa060', 'fish', { w: 2 });
it('s_turtle', '자라', 1, 'shell', '#6a8a4a', 'fish', { w: 3 });
it('s_trout2', '산천어', 0, 'fish', '#c8a8a8', 'fish', { w: 1 });
it('s_crab', '참게', 1, 'shell', '#c86a3a', 'fish', { w: 0.5 });
it('s_squidling', '오징어', 0, 'tentacle', '#ffb0a0', 'fish', { w: 0.6 });
it('s_swordfish', '황새치', 1, 'fish', '#5a7ab8', 'fish', { w: 120 });
it('s_lanternfish', '초롱아귀', 0, 'fish', '#2a8a9a', 'fish', { w: 8 });
it('s_oarfish', '산갈치', 1, 'fish', '#d8e0ff', 'fish', { w: 200 });
it('s_spring2', '봄 도다리', 2, 'fish', '#d8c09a', 'fish', { w: 1.2, season: 0 });
it('s_summer2', '여름 전갱이', 2, 'fish', '#9ad0e0', 'fish', { w: 0.5, season: 1 });
it('s_autumn2', '가을 전어', 2, 'fish', '#c8d0e0', 'fish', { w: 0.3, season: 2 });
it('s_winter2', '겨울 방어', 2, 'fish', '#5a7ab8', 'fish', { w: 8, season: 3 });
it('s_pearl', '흑진주', 3, 'orb', '#4a4a5a', 'fish');
it('s_bottle', '유리병 편지', 3, 'potion', '#a8e0d0', 'fish');
it('s_seadragon', '해룡의 수염', 4, 'feather', '#7affe0', 'fish');
it('s_leviathan', '리바이어선의 비늘', 5, 'scale', '#3a5aff', 'fish');

it('h_quail', '메추라기 알', 0, 'seed', '#e8dcc8', 'hunt');
it('h_fox', '여우 꼬리', 1, 'feather', '#ff8a3a', 'hunt');
it('h_squirrel', '다람쥐 털', 0, 'hide', '#a8784a', 'hunt');
it('h_elkhorn', '엘크 뿔', 1, 'horn', '#d8c8a0', 'hunt');
it('h_bearmeat', '곰 고기', 0, 'meat', '#8a3a2a', 'hunt');
it('h_eagle', '독수리 깃털', 1, 'feather', '#7a5a3a', 'hunt');
it('h_reindeer', '순록 가죽', 0, 'hide', '#c8a888', 'hunt');
it('h_owlwhite', '흰올빼미 깃털', 1, 'feather', '#f0f0ff', 'hunt');
it('h_phoenixegg', '화조의 알', 0, 'seed', '#ff8a5a', 'hunt');
it('h_qilinhorn', '기린의 뿔', 1, 'horn', '#7affb8', 'hunt');
it('h_trophy', '거대 곰 박제', 3, 'chest', '#6a4a32', 'hunt');
it('h_blackfur', '흑표 가죽', 3, 'hide', '#2a2a32', 'hunt');
it('h_thunderbird', '천둥새 깃털', 4, 'feather', '#ffe066', 'hunt');
it('h_fenrir', '펜리르의 송곳니', 5, 'horn', '#c8d8ff', 'hunt');

it('c_slimecore', '슬라임 핵', 0, 'orb', '#7ae05a', 'combat');
it('c_capshard', '버섯 갓 조각', 1, 'mushroom', '#e8553d', 'combat');
it('c_toadwart', '두꺼비 혹', 0, 'jelly', '#7a5aa8', 'combat');
it('c_miasma', '독기 결정', 1, 'gem', '#9a3ad8', 'combat');
it('c_frostfang', '서리 송곳니', 0, 'horn', '#d8f0ff', 'combat');
it('c_icicle', '영원한 고드름', 1, 'gem', '#bfe8ff', 'combat');
it('c_shadowcloth', '그림자 천', 0, 'hide', '#3a2a5a', 'combat');
it('c_voidsand', '공허의 모래', 1, 'drop', '#6a4aa8', 'combat');
it('c_t_treant', '트렌트의 옹이 심장', 3, 'orb', '#7a5432', 'combat', { trophy: true });
it('c_t_frog', '독두꺼비 대왕의 왕관', 3, 'charm', '#a66bff', 'combat', { trophy: true });
it('c_t_yeti', '설인 왕의 뿔', 3, 'horn', '#e8f0ff', 'combat', { trophy: true });
it('c_t_knight', '그림자 기사의 투구', 3, 'armor', '#4a4060', 'combat', { trophy: true });
it('c_t_eye', '심연의 눈동자', 3, 'orb', '#c83aff', 'combat', { trophy: true });
it('c_banner', '전장의 깃발', 3, 'feather', '#c8433b', 'combat');
it('c_medal', '용사의 훈장', 3, 'charm', '#ffd34d', 'combat');
it('c_dragonblood', '용의 피', 4, 'drop', '#ff2a3a', 'combat');
it('c_godsword', '신검의 파편', 5, 'sword', '#e8f0ff', 'combat');

it('p_haste', '신속의 물약', 1, 'potion', '#7affe8', 'alchemy', { potion: 'haste', desc: '이번 전투 동안 공격 속도 +25%' });
it('p_focus', '집중의 물약', 1, 'potion', '#ff9a3a', 'alchemy', { potion: 'focus', desc: '이번 전투 동안 치명타 확률 +10%' });
it('p_wisdom', '지혜의 물약', 1, 'potion', '#9a8aff', 'alchemy', { potion: 'wisdom', desc: '이번 전투 동안 캐릭터 경험치 +30%' });
it('t_gather', '장인의 강장제', 2, 'potion', '#c8a060', 'alchemy', { use: true, desc: '사용 시 30분 동안 생활 속도 ×1.3' });
it('t_fever', '열정의 비약', 2, 'potion', '#ff5a3a', 'alchemy', { use: true, desc: '사용 시 열정 게이지 즉시 가득' });
it('x_agi', '민첩의 영약', 2, 'elixir', '#7affe8', 'alchemy', { elixir: 'agi', desc: '영구 공격 속도 +1% (최대 50회)' });
it('x_sta', '지구력의 영약', 2, 'elixir', '#4a9aff', 'alchemy', { elixir: 'sta', desc: '영구 최대 스태미나 +2% (최대 50회)' });
it('x_luck', '행운의 영약', 2, 'elixir', '#ffd34d', 'alchemy', { elixir: 'luck', desc: '영구 행운 배율 +0.01 (최대 50회)' });
it('x_crit', '예리함의 영약', 2, 'elixir', '#ff6a3a', 'alchemy', { elixir: 'crit', desc: '영구 치명타 피해 +2% (최대 50회)' });
it('x_master', '대가의 영약', 2, 'elixir', '#c8a060', 'alchemy', { elixir: 'lifexp', desc: '영구 생활 경험치 +2% (최대 50회)' });
it('a_mercury', '살아있는 수은', 3, 'drop', '#c8c8d8', 'alchemy');
it('a_retort', '고대 증류기', 3, 'potion', '#a87a4a', 'alchemy');
it('a_panacea', '만병통치약', 4, 'potion', '#ffffff', 'alchemy');
it('a_aether', '에테르 결정', 5, 'orb', '#bff8ff', 'alchemy');

export const ITEMS = I;

// Spots unlock at these levels; each gives common / uncommon / rare items.
export const SPOT_LV = [1, 50, 150, 300, 500];
export const SPOT_XP = [8, 14, 24, 40, 65];
export const SPOTS = {
  mining: [
    { name: '얕은 갱도', items: ['m_copper', 'm_clay', 'm_tin', 'm_flint', 'm_quartz'] },
    { name: '철광 언덕', items: ['m_iron', 'm_lead', 'm_coal', 'm_garnet', 'm_amethyst'] },
    { name: '수정 동굴', items: ['m_silver', 'm_crystalsand', 'm_gold', 'm_topaz', 'm_sapphire'] },
    { name: '심연 광맥', items: ['m_mithril', 'm_darksteel', 'm_obsidian', 'm_emerald', 'm_ruby'] },
    { name: '별똥 분화구', items: ['m_adamant', 'm_stardust', 'm_meteor', 'm_moonstone', 'm_stardia'] },
  ],
  wood: [
    { name: '참나무 숲', items: ['w_oak', 'w_twig', 'w_resin', 'w_moss', 'w_acorn'] },
    { name: '자작나무 길', items: ['w_birch', 'w_bark', 'w_maple', 'w_honey', 'w_pinecone'] },
    { name: '고목의 숲', items: ['w_elder', 'w_burl', 'w_amber', 'w_mistletoe', 'w_owl'] },
    { name: '마법의 숲', items: ['w_mana', 'w_starwood', 'w_spirit', 'w_dryad', 'w_fairy'] },
    { name: '세계수 뿌리', items: ['w_world', 'w_lightwood', 'w_goldsap', 'w_seedpod', 'w_glowleaf'] },
  ],
  forage: [
    { name: '들판', items: ['f_mugwort', 'f_clover', 'f_dandelion', 'f_wildrose', 'f_mushroom'] },
    { name: '숲길', items: ['f_mint', 'f_fern', 'f_berry', 'f_raspberry', 'f_pine'] },
    { name: '안개 늪', items: ['f_antidote', 'f_reed', 'f_mandrake', 'f_lotus', 'f_firefly'] },
    { name: '고산 지대', items: ['f_snowlotus', 'f_edelweiss', 'f_poppy', 'f_cloudberry', 'f_ginseng'] },
    { name: '요정 정원', items: ['f_moonflower', 'f_starpetal', 'f_dew', 'f_dreamleaf', 'f_fairyshroom'] },
  ],
  fish: [
    { name: '개울', items: ['s_minnow', 's_loach', 's_crucian', 's_shrimp', 's_trout'] },
    { name: '호수', items: ['s_carp', 's_perch', 's_catfish', 's_turtle', 's_goldcarp'] },
    { name: '강 하구', items: ['s_salmon', 's_trout2', 's_eel', 's_crab', 's_sturgeon'] },
    { name: '먼 바다', items: ['s_mackerel', 's_squidling', 's_tuna', 's_swordfish', 's_marlin'] },
    { name: '심해', items: ['s_angler', 's_lanternfish', 's_squid', 's_oarfish', 's_dragonfish'] },
  ],
  hunt: [
    { name: '초원', items: ['h_rabbitmeat', 'h_quail', 'h_rabbithide', 'h_fox', 'h_pheasant'] },
    { name: '사슴 숲', items: ['h_venison', 'h_squirrel', 'h_deerhide', 'h_elkhorn', 'h_antler'] },
    { name: '산악 지대', items: ['h_boar', 'h_bearmeat', 'h_bearhide', 'h_eagle', 'h_claw'] },
    { name: '설원', items: ['h_wolfhide', 'h_reindeer', 'h_tusk', 'h_owlwhite', 'h_fang'] },
    { name: '신수의 숲', items: ['h_griffin', 'h_phoenixegg', 'h_unicorn', 'h_qilinhorn', 'h_kirin'] },
  ],
};
// Skill-wide high tiers (any spot): 3 epic, 2 legend, 2 myth, 1 primordial per skill.
export const SKILL_RARES = {
  mining: ['m_fossil', 'm_geode', 'm_relic', 'm_dragonstone', 'm_titanheart', 'm_timecrystal', 'm_voidcore', 'm_prim'],
  wood: ['w_ring', 'w_beehive', 'w_carving', 'w_entheart', 'w_crown', 'w_rainbow', 'w_heartwood', 'w_prim'],
  forage: ['f_goldacorn', 'f_silverfern', 'f_bloodroot', 'f_phoenix', 'f_lifeflower', 'f_oldginseng', 'f_moonherb', 'f_prim'],
  fish: ['s_chest', 's_pearl', 's_bottle', 's_mermaid', 's_seadragon', 's_kraken', 's_leviathan', 's_prim'],
  hunt: ['h_white', 'h_trophy', 'h_blackfur', 'h_goldantler', 'h_thunderbird', 'h_gumiho', 'h_fenrir', 'h_prim'],
  combat: ['c_core', 'c_banner', 'c_medal', 'c_seal', 'c_dragonblood', 'c_tear', 'c_godsword', 'c_prim'],
  alchemy: ['a_salt', 'a_mercury', 'a_retort', 'a_essence', 'a_panacea', 'a_homunculus', 'a_aether', 'a_prim'],
};
export const SEASON_FISH = ['s_spring', 's_summer', 's_autumn', 's_winter', 's_spring2', 's_summer2', 's_autumn2', 's_winter2'];
// Each boss leaves its own trophy (always on the first kill, 15% after).
export const BOSS_TROPHY = { kingslime: 'c_t_treant', frogking: 'c_t_frog', yetiking: 'c_t_yeti', knight: 'c_t_knight', eye: 'c_t_eye' };
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
  { id: 'p_haste', lv: 80, xp: 60, in: { s_perch: 2, h_squirrel: 2, w_honey: 1 } },
  { id: 'p_focus', lv: 120, xp: 90, in: { m_garnet: 1, f_raspberry: 3, h_elkhorn: 1 } },
  { id: 'p_wisdom', lv: 170, xp: 120, in: { f_lotus: 2, w_mistletoe: 2, s_crab: 2 } },
  { id: 't_gather', lv: 220, xp: 150, in: { w_burl: 3, m_topaz: 1, f_reed: 4 } },
  { id: 't_fever', lv: 260, xp: 170, in: { h_eagle: 2, s_trout2: 3, m_crystalsand: 4 } },
  { id: 'x_agi', lv: 300, xp: 200, in: { h_reindeer: 2, w_starwood: 2, s_squidling: 3 }, max: 50 },
  { id: 'x_sta', lv: 350, xp: 230, in: { f_edelweiss: 2, m_darksteel: 3, h_owlwhite: 1 }, max: 50 },
  { id: 'x_luck', lv: 400, xp: 260, in: { s_lanternfish: 1, f_cloudberry: 3, m_emerald: 1 }, max: 50 },
  { id: 'x_crit', lv: 450, xp: 290, in: { h_phoenixegg: 1, w_dryad: 2, m_moonstone: 1 }, max: 50 },
  { id: 'x_master', lv: 600, xp: 360, in: { f_starpetal: 3, w_lightwood: 3, s_oarfish: 1 }, max: 50 },
  { id: 'x_secret', lv: 1, xp: 300, in: { a_salt: 1, f_ginseng: 2, w_spirit: 2 }, max: 20, secret: true },
];

export const MONSTERS = {
  slime: { name: '슬라임', sprite: 'slime', pal: { a: '#6ac04a' }, hp: 1, atk: 1 },
  shroom: { name: '포자 괴물', sprite: 'shroom', pal: { a: '#d8443a' }, hp: 1.2, atk: 0.9 },
  kingslime: { name: '숲의 수호자 트렌트', sprite: 'treant', pal: {}, hp: 1, atk: 1, unique: true },
  frog: { name: '독두꺼비', sprite: 'frog', pal: { a: '#7a5ab0' }, hp: 1, atk: 1.1 },
  pshroom: { name: '독버섯 괴물', sprite: 'shroom', pal: { a: '#9a4ad0', w: '#d8ff8a' }, hp: 1.3, atk: 0.9 },
  frogking: { name: '독두꺼비 대왕', sprite: 'frogking', pal: {}, hp: 1, atk: 1, crown: true },
  bat: { name: '얼음 박쥐', sprite: 'bat', pal: { a: '#5a78b8' }, hp: 0.8, atk: 1.2, fly: true },
  yeti: { name: '설인', sprite: 'yeti', pal: { a: '#dfe8f2' }, hp: 1.4, atk: 1 },
  yetiking: { name: '설인 왕', sprite: 'yetiking', pal: {}, hp: 1, atk: 1, crown: true },
  knight: { name: '그림자 기사', sprite: 'knight', pal: {}, hp: 1, atk: 1, unique: true },
  eye: { name: '심연의 눈', sprite: 'eye', pal: {}, hp: 1, atk: 1, unique: true, fly: true },
};

export const REGIONS = [
  { name: '햇살 초원', from: 1, mobs: ['slime', 'shroom'], boss: 'kingslime', mats: ['c_jelly', 'c_slimecore', 'c_spore', 'c_capshard', 'c_crown'], gimmick: null, theme: 'meadow' },
  { name: '독안개 숲', from: 11, mobs: ['frog', 'pshroom'], boss: 'frogking', mats: ['c_slime', 'c_toadwart', 'c_poisonspore', 'c_miasma', 'c_venom'], gimmick: 'poison', theme: 'swamp' },
  { name: '얼음 동굴', from: 21, mobs: ['bat', 'yeti'], boss: 'yetiking', mats: ['c_batwing', 'c_frostfang', 'c_yetifur', 'c_icicle', 'c_icecore'], gimmick: 'ice', theme: 'ice' },
  { name: '무한의 탑', from: 31, mobs: ['slime', 'shroom', 'frog', 'bat', 'yeti'], boss: 'knight', bosses: ['knight', 'eye', 'frogking', 'yetiking', 'kingslime'], mats: ['c_shadow', 'c_shadowcloth', 'c_abyss', 'c_voidsand', 'c_voideye'], gimmick: 'mixed', theme: 'tower' },
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
// Random gear affixes (one per piece); values scale with the piece's tier.
export const AFFIXES = {
  fierce: { name: '맹렬한', stat: 'atk', v: 0.05, text: '공격력' },
  sturdy: { name: '단단한', stat: 'hp', v: 0.06, text: '최대 HP' },
  swift: { name: '재빠른', stat: 'spd', v: 0.04, text: '공격 속도' },
  sharp: { name: '날카로운', stat: 'crit', v: 0.02, text: '치명타 확률' },
  keen: { name: '예리한', stat: 'critD', v: 0.08, text: '치명타 피해' },
  lucky: { name: '행운의', stat: 'luck', v: 0.03, text: '행운 배율' },
  vital: { name: '활력의', stat: 'sta', v: 0.06, text: '최대 스태미나' },
  wise: { name: '현명한', stat: 'xp', v: 0.08, text: '캐릭터 경험치' },
};

export const PERKS = {
  w_atk: { tree: 'war', name: '불꽃의 칼날', desc: '공격력 +10%', base: 1, grow: 1.4 },
  w_hp: { tree: 'war', name: '불꽃의 심장', desc: '최대 HP +10%', base: 1, grow: 1.4 },
  w_xp: { tree: 'war', name: '전투의 기억', desc: '캐릭터 경험치 +15%', base: 2, grow: 1.5 },
  w_start: { tree: 'war', name: '지름길', desc: '윤회 후 시작 층 +5', base: 5, grow: 2, max: 10 },
  a_speed: { tree: 'art', name: '숙련된 손', desc: '모든 생활 속도 +3%', base: 2, grow: 1.45, max: 20 },
  a_xp: { tree: 'art', name: '장인의 눈', desc: '생활 경험치 +5%', base: 2, grow: 1.45, max: 20 },
  a_luck: { tree: 'art', name: '행운의 불씨', desc: '행운 배율 +0.05', base: 3, grow: 1.6, max: 10 },
  r_clone: { tree: 'wan', name: '분신술', desc: '분신 슬롯 +1 (분신은 생활만, 속도 60%)', base: 10, grow: 6, max: 2 },
  r_offline: { tree: 'wan', name: '긴 여정', desc: '분신 작업 속도 +5%', base: 3, grow: 1.6, max: 8 },
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

// Life skills open one after another: each needs the previous one at a level.
export const UNLOCKS = {
  mining: null,
  wood: { skill: 'mining', lv: 10 },
  forage: { skill: 'wood', lv: 10 },
  fish: { skill: 'forage', lv: 15 },
  hunt: { skill: 'fish', lv: 15 },
  alchemy: { skill: 'hunt', lv: 20 },
};
export const BOSS_EVERY = 10;
export const ELITE_EVERY = 5;

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
