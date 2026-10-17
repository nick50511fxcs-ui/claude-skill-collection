// Pixel art drawn from character grids, cached as offscreen canvases.
// '.' is transparent; other characters map to palette colors.

export const OUTLINE = '#1e1626';

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
export { shade };

const BASE_PAL = {
  o: OUTLINE, w: '#ffffff', e: '#1e1626', m: '#5a1a2a', r: '#ff9a9a',
  1: '#8a8a96', 2: '#5c5c68', 3: '#9a6a3a', 4: '#6a4424', g: '#4caf50', G: '#2e7d32',
};

const cache = new Map();
function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Render a grid to a canvas. pal maps chars to colors; 'a' gets b/c shades automatically.
export function sprite(name, rows, pal = {}) {
  const key = name + JSON.stringify(pal);
  if (cache.has(key)) return cache.get(key);
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  const p = { ...BASE_PAL, ...pal };
  if (p.a && !pal.b) p.b = shade(p.a, -0.3);
  if (p.a && !pal.c) p.c = shade(p.a, 0.35);
  const cv = makeCanvas(w, h);
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch === '.' || ch === ' ') continue;
      const col = p[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  cache.set(key, cv);
  return cv;
}

// Solid-colour copy of a sprite's own pixels (hit flashes), cached per sprite and colour.
const silCache = new WeakMap();
export function silhouette(img, color) {
  let m = silCache.get(img);
  if (!m) { m = new Map(); silCache.set(img, m); }
  if (m.has(color)) return m.get(color);
  const c = makeCanvas(img.width, img.height);
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color;
  x.fillRect(0, 0, img.width, img.height);
  m.set(color, c);
  return c;
}

// Draw a sprite rotated around a pivot with nearest-neighbour sampling, so it stays crisp.
const rotCache = new Map();
export function drawRotated(ctx, img, x, y, px, py, angle, flip = false) {
  const q = Math.round(angle / (Math.PI / 32));
  const key = img;
  let byAngle = rotCache.get(key);
  if (!byAngle) { byAngle = new Map(); rotCache.set(key, byAngle); }
  const ck = q + (flip ? 'f' : '') + ',' + px + ',' + py;
  let entry = byAngle.get(ck);
  if (!entry) {
    const a = (q * Math.PI) / 32;
    const w = img.width, h = img.height;
    const R = Math.ceil(Math.hypot(Math.max(px, w - px), Math.max(py, h - py))) + 1;
    const out = makeCanvas(R * 2, R * 2);
    const octx = out.getContext('2d');
    const src = img.getContext('2d').getImageData(0, 0, w, h).data;
    const dst = octx.createImageData(R * 2, R * 2);
    const cos = Math.cos(-a), sin = Math.sin(-a);
    for (let dy = 0; dy < R * 2; dy++) {
      for (let dx = 0; dx < R * 2; dx++) {
        const rx = dx - R + 0.5, ry = dy - R + 0.5;
        let sx = Math.floor(rx * cos - ry * sin + px);
        const sy = Math.floor(rx * sin + ry * cos + py);
        if (flip) sx = w - 1 - sx;
        if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
        const si = (sy * w + sx) * 4, di = (dy * R * 2 + dx) * 4;
        if (src[si + 3] === 0) continue;
        dst.data[di] = src[si]; dst.data[di + 1] = src[si + 1]; dst.data[di + 2] = src[si + 2]; dst.data[di + 3] = 255;
      }
    }
    octx.putImageData(dst, 0, 0);
    entry = { c: out, R };
    byAngle.set(ck, entry);
  }
  ctx.drawImage(entry.c, Math.round(x - entry.R), Math.round(y - entry.R));
}

// ---------------- Characters ----------------
export const HERO = [
  '....ooooo.....',
  '..oohhhhhoo...',
  '.ohhhhhhhhho..',
  'ohhhhhhhhhhho.',
  'ohhhhssssssho.',
  'ohhhssssesseso',
  'ohhhssssesseso',
  'ohhhsssrssssro',
  '.ohhhssssssso.',
  '..ohhhoooooo..',
  '..ohhttttttoo.',
  '.ohhttttttttо.'.replace('о', 'o'),
  '.ohhtbbbbbbto.',
  '.ohhtttttttto.',
  '..ohhppppppo..',
  '...oppo.oppo..',
  '...offo.offo..',
  '...oooo.oooo..',
];
export const HERO_STEP = [
  '..ohhppppppo..',
  '..oppo...oppo.',
  '..offo...offo.',
  '..oooo...oooo.',
];
export const HERO_CROUCH = [
  '..ohhppppppo..',
  '.oppppoopppo..',
  '.ooooo.ooooo..',
];
export const HERO_PAL = {
  h: '#3f9a5c', s: '#ffd8b0', t: '#efe9d8', b: '#7a4a2a', p: '#4a4a72', f: '#5a3a24',
};
export const CLONE_PAL = {
  h: '#6aa8ff', s: '#cfe6ff', t: '#e8f2ff', b: '#4a6ab8', p: '#4a5aa8', f: '#3a4a8a',
};

export const MON = {
  slime: [
    '....oooooo....',
    '..ooccaaaaoo..',
    '.ocwcaaaaaaao.',
    '.ocaaaaaaaaao.',
    'oaaaaeaaaeaaao',
    'oaaaaeaaaeaaao',
    'oaaaaaaaaaaabo',
    'oaaaaaammaaabo',
    'obaaaaaaaaabbo',
    '.obbbbbbbbbbo.',
    '..oooooooooo..',
  ],
  shroom: [
    '.....oooo.....',
    '...oorrrroo...',
    '..orrwwrrrro..',
    '.orrwwrrrwwro.',
    '.orrrrrrrwwrro',
    'orwwrrrrrrrrro',
    'orrrrrrwwrrrro',
    'oooooooooooooo',
    '...osssssso...',
    '...oseSsseo...',
    '...ossssssо...'.replace('о', 'o'),
    '...osssmmso...',
    '...ossssssо...'.replace('о', 'o'),
    '...oSSooSSo...',
    '...oooooooo...',
  ],
  frog: [
    '..oo....oo....',
    '.oweo..oweo...',
    '.oaaooooaao...',
    'oaaaaaaaaaaoo.',
    'oaaaaaaaaaaaao',
    'oammmmmmmmaaao',
    'oacccccccaaaao',
    'oaccccccccaaao',
    '.oaccccccaaao.',
    'oaaoo....ooaao',
    'ooooo....ooooo',
  ],
  bat: [
    'oo............oo',
    'oaoo........ooao',
    'oaaaoo.oo.ooaaao',
    '.oaaaaoaaoaaaao.',
    '..oaaaaaaaaaao..',
    '...oaaraaraao...',
    '....oaawwaao....',
    '.....oaaaao.....',
    '......oooo......',
  ],
  bat2: [
    '................',
    '................',
    '.......oo.......',
    '......oaao......',
    '..oooaaaaaaooo..',
    '.oaaaaraaraaaao.',
    'oaaaoaawwaaoaaao',
    'oaao.oaaaao.oaao',
    'ooo...oooo...ooo',
  ],
  yeti: [
    '.....oooooo.....',
    '...ooaaaaaaoo...',
    '..oaaaaaaaaaao..',
    '.oaaaaaaaaaaaao.',
    '.oaaffffffffaao.',
    '.oaffefffeffao..',
    '.oaffffffffffao.',
    '.oaafwmwmwwfaao.',
    '..oaaffffffaao..',
    '.ooaaaaaaaaaaoo.',
    'oaaoaaaaaaaaoaao',
    'oaaoaaccccaaoaao',
    'oaaoaccccccaoaao',
    'oaaoaccccccaoaao',
    '.oo.oaaaaaao.oo.',
    '....oaaooaao....',
    '...oaaao.oaaao..',
    '...ooooo.ooooo..',
  ],
  treant: [
    '......GGGGGGGG........',
    '....GGgggggggGGG......',
    '...GgggGgggggggGG.....',
    '..GgggggggGgggggGG....',
    '..GggGgggggggggggG....',
    '.GgggggggggGggggggG...',
    '.GgggGggggggggGgggG...',
    '..GGgggggggggggggG....',
    '...oGGGGGGGGGGGGo.....',
    '....oaaaaaaaaaao......',
    '...oaabaaaaaabaao.....',
    '...oaayyaaaayyaao.....',
    '...oaayyaaaayyaao.....',
    '...oaaaaaaaaaaaao.....',
    '..oaaaammmmmmaaaao....',
    '..oaaaamwmmwmaaaao....',
    '.oaoaaaaaaaaaaaoao....',
    'oaaooaaaabaaaaooaao...',
    'oao.oaaaaaaaaao.oao...',
    '.o..oaabaaaaaao..o....',
    '....oaaaaaaabao.......',
    '...oaaaooooaaaao......',
    '..oaaao....oaaao......',
    '.oaaao......oaaao.....',
    '.oooo........oooo.....',
  ],
  knight: [
    '.......rr.........',
    '......rrrr........',
    '.....oooooo.......',
    '....oaaaaaao......',
    '....oaccccao......',
    '....oayoayao......',
    '....oaaaaaao......',
    '.....oaaaao.....w.',
    '...oooaaaaooo..ww.',
    '..oaaaaaaaaaao.ww.',
    '.oaacaaaaaacaaoww.',
    '.oaaoaaccaaoaaow..',
    '.oao.oaaaao.oao...',
    '.ooo.oaaaao.ooo...',
    '.....oaaaao.......',
    '.....oabbao.......',
    '....oaao.oaao.....',
    '....oaao.oaao.....',
    '...oaaao.oaaao....',
    '...ooooo.ooooo....',
  ],
  eye: [
    '......oooooooo......',
    '....oowwwwwwwwoo....',
    '...owwwwwwwwwwwwo...',
    '..owwmwwwrrrwwwmwo..',
    '.owwwwwwrrrrrwwwwwo.',
    '.owwwwwrrreerrwwwwo.',
    'owwwwwwrreeeerrwwwwo',
    'owmwwwwrreeeerrwwmwo',
    '.owwwwwrrreerrwwwwo.',
    '.owwwwwwrrrrrwwwwwo.',
    '..owwmwwwrrrwwwmwo..',
    '...owwwwwwwwwwwwo...',
    '....oowwwwwwwwoo....',
    '.....oaoaooaoao.....',
    '....oa.oa..ao.ao....',
    '...oa..oa..ao..ao...',
    '...o....o..o....o...',
  ],
};
export const MON_BASE_PAL = {
  treant: { a: '#7a5432', y: '#ffe066', m: '#2a1a10' },
  knight: { a: '#4a4060', r: '#ff3a5a', y: '#ff5aff' },
  eye: { r: '#c83aff', m: '#ff6a8a', a: '#6a3a8a', w: '#f4eef8' },
  slime: { a: '#7ae05a' },
  shroom: { r: '#e8553d', s: '#f6e6cc', S: '#d8c0a0' },
  frog: { a: '#9a5ad8' },
  bat: { a: '#6a8ab8', r: '#ff4a6a' },
  bat2: { a: '#6a8ab8', r: '#ff4a6a' },
  yeti: { a: '#e8f0ff', f: '#9ab0d8', c: '#ffffff' },
};

export const CROWN = [
  'o.o.o.o',
  'oyoyoyo',
  'oyyryyo',
  'ooooooo',
];

// Animals for hunting.
export const ANIMALS = {
  boar: [
    '....oooooo......',
    '..ooaaaaaaoo....',
    '.oaaaaaaaaaaoo..',
    'oaaaaaaaaaaaaeo.',
    'oaaaaaaaaaaaaaao',
    'oaaaaaaaaaaawwmo',
    '.oaaaaaaaaaaaoo.',
    '..oaaaaaaaaao...',
    '..oao.oao.oao...',
    '..oo..oo..oo....',
  ],
  wolf: [
    '.............oo.',
    '............oao.',
    '.ooooooooooooaao',
    'oaaaaaaaaaaaaaeo',
    '.oaaaaaaaaaaaaamo',
    '..oaaaaaaaaaaoo.',
    '..oaaoooaaaao...',
    '..oao..oaoao....',
    '..oo...oo.oo....',
  ],
  unicorn: [
    '..............y.',
    '.............y..',
    '...........pooo.',
    '..........ppaaao',
    '..........paaeao',
    '.........ppaaaao',
    '..ooooooopaaao..',
    '.oaaaaaaaaaao...',
    'paaaaaaaaaaao...',
    'p.oaaaaaaaaao...',
    '..oaaaaaaaao....',
    '..oao.oao.oao...',
    '..oao.oao.oao...',
    '..oo..oo..oo....',
  ],
  rabbit: [
    '...oo.oo..',
    '...oaooao.',
    '...oaooao.',
    '..oaaaaaao',
    '.oaaaaeaao',
    'oaaaaaaaro',
    'oaaaaaaao.',
    '.oaaaaaao.',
    '.oo.oo.oo.',
  ],
  deer: [
    'y.y.......y.y.',
    '.yy.......yy..',
    '..yy.....yy...',
    '...oooooooo...',
    '..oaaaaaaeao..',
    '..oaaaaaaaaaro',
    '...oaaaaaaoo..',
    'ooaaaaaaaao...',
    'oaaaaaaaaao...',
    '.oaaaaaaaao...',
    '.oao.oao.oao..',
    '.oo..oo..oo...',
  ],
};

// ---------------- Tools (held upright; pivot is the bottom of the handle) ----------------
export const TOOLS = {
  pick: [
    '..ooooooo..',
    '.oaaaaaaao.',
    'oaao.d.oaao',
    'oo...d...oo',
    '.....d.....',
    '.....d.....',
    '.....d.....',
    '.....d.....',
    '.....d.....',
    '.....D.....',
  ],
  axe: [
    '...oooo.',
    '..oaaaao',
    '.oaaaaao',
    '.oaaado.',
    '..oood..',
    '....d...',
    '....d...',
    '....d...',
    '....d...',
    '....D...',
  ],
  sword: [
    '..o..',
    '.oao.',
    '.oao.',
    '.oao.',
    '.oao.',
    '.oao.',
    '.oao.',
    'ooooo',
    'oyyyo',
    '.odo.',
    '.oDo.',
  ],
  sickle: [
    '.oooo...',
    'oaaaao..',
    'oo..oao.',
    '.....oo.',
    '....d...',
    '....d...',
    '....d...',
    '....D...',
  ],
  rod: [
    'a',
    'd',
    'd',
    'a',
    'd',
    'd',
    'd',
    'd',
    'd',
    'd',
    'D',
    'D',
  ],
  ladle: [
    '.ooo.',
    'oaaao',
    'oaaao',
    '.odo.',
    '..d..',
    '..d..',
    '..d..',
    '..d..',
    '..D..',
  ],
};
export const TOOL_PIVOT = { pick: [5, 9], axe: [4, 9], sword: [2, 10], sickle: [4, 7], rod: [0, 11], ladle: [2, 8] };
export const TOOL_FOR = { combat: 'sword', mining: 'pick', wood: 'axe', forage: 'sickle', fish: 'rod', hunt: 'bow', alchemy: 'ladle' };
export const WOOD_PAL = { d: '#9a6a3a', D: '#6a4424', y: '#ffd34d' };

export const BOW = [
  '.oo..',
  'oaao.',
  '.oao.',
  '..oao',
  '..oao',
  '..oao',
  '..oao',
  '.oao.',
  'oaao.',
  '.oo..',
];

// ---------------- Item icons (12x12) ----------------
export const ICONS = {
  ore: [
    '............',
    '....oooo....',
    '..oo1111oo..',
    '.o11a1111ao.',
    '.o1aa11111o.',
    'o111111aa12o',
    'o1a1111aa12o',
    'o11aa111112o',
    '.o11111a12o.',
    '.o22222222o.',
    '..oooooooo..',
    '............',
  ],
  gem: [
    '............',
    '...oooooo...',
    '..owccacao..',
    '.owcaaaaabo.',
    '.ocaaaaaabbo',
    '..oaaaaabbo.',
    '...oaaabbo..',
    '....oabbo...',
    '.....obo....',
    '......o.....',
    '............',
    '............',
  ],
  log: [
    '............',
    '............',
    '..ooooooooo.',
    '.obbbbbbbocco',
    'obaaaaaaoc44co',
    'obaaaaaaoc44co',
    '.obbbbbbbocco',
    '..ooooooooo.',
    '............',
    '............',
    '............',
    '............',
  ].map(r => r.slice(0, 12)),
  drop: [
    '.....oo.....',
    '....oco.....',
    '....oaco....',
    '...oacaao...',
    '..oacaaaao..',
    '..ocaaaaao..',
    '.ocwaaaaabo.',
    '.oaaaaaaabo.',
    '.oaaaaaabbo.',
    '..obbbbbbo..',
    '...oooooo...',
    '............',
  ],
  leaf: [
    '.......ooo..',
    '.....ooccao.',
    '...oocaaaao.',
    '..ocaaaaaao.',
    '.ocaaaGaaao.',
    '.oaaaGaaabo.',
    '.oaaGaaabo..',
    '.oaGaaabo...',
    '.oGabbbo....',
    'oGoooo......',
    'oo..........',
    '............',
  ],
  flower: [
    '............',
    '...oo.oo....',
    '..oaaoaao...',
    '..oaayaao...',
    '.oaayyyaao..',
    '..oaayaao...',
    '..oaaoaao...',
    '...ooGoo....',
    '...ogGo.....',
    '....oGgo....',
    '....oGoo....',
    '.....o......',
  ],
  mushroom: [
    '............',
    '....oooo....',
    '..ooaaaaoo..',
    '.oawwaaawao.',
    'oaaaaaawwaao',
    'oawwaaaaaaao',
    'oooooooooooo',
    '...osssso...',
    '...osssso...',
    '...osssso...',
    '...oooooo...',
    '............',
  ],
  fish: [
    '............',
    '............',
    '....ooooo...',
    '..ooccccaoo.',
    'oooaaaaaaaeo',
    'ocoaaaaaaaao',
    'ocoaaaaaaao.',
    'oooobbbbboo.',
    '...ooooo....',
    '............',
    '............',
    '............',
  ],
  meat: [
    '............',
    '....ooooo...',
    '...oaaacao..',
    '..oaacaaaao.',
    '..oaaaaaaao.',
    '..obaaaaabo.',
    '...obbbbbo..',
    '....oowoo...',
    '.....owo....',
    '....owwwo...',
    '....ooooo...',
    '............',
  ],
  hide: [
    '............',
    '.oo......oo.',
    '.oaooooooao.',
    '..oaaaaaao..',
    '.oacaaaaaao.',
    '.oaaaaacaao.',
    '.oaacaaaaao.',
    '..oaaaaaao..',
    '.oaobbbboao.',
    '.oo.oooo.oo.',
    '............',
    '............',
  ],
  feather: [
    '..........o.',
    '........ooao',
    '.......ocaao',
    '......ocaabo',
    '.....ocaabo.',
    '....ocaabo..',
    '...ocaabo...',
    '..ocabbo....',
    '..oabbo.....',
    '.o4oo.......',
    'o4o.........',
    '.o..........',
  ],
  horn: [
    '.........oo.',
    '........oco.',
    '.......ocao.',
    '......ocabo.',
    '.....ocaabo.',
    '....ocaabo..',
    '...ocaaabo..',
    '..ocaaabo...',
    '.ocaaabbo...',
    '.oabbbbo....',
    '.oooooo.....',
    '............',
  ],
  potion: [
    '....oooo....',
    '....o44o....',
    '....owwo....',
    '...oowwoo...',
    '..owcaaaao..',
    '.owcaaaaabo.',
    '.ocaaaaaabo.',
    '.oaaaaaaabo.',
    '.oaaaaaabbo.',
    '..obbbbbbo..',
    '...oooooo...',
    '............',
  ],
  elixir: [
    '.....oo.....',
    '....oyyo....',
    '....owwo....',
    '...owcawo...',
    '..owcaaaao..',
    '.owcaaaaabo.',
    'oycaaaaaabyo',
    '.oaaaaaaabo.',
    '..oaaaaabo..',
    '...obbbbo...',
    '....oooo....',
    '............',
  ],
  orb: [
    '............',
    '....oooo....',
    '..ooccaaoo..',
    '.ocwcaaaaao.',
    '.ocwaaaaaao.',
    'ocaaaaaaaabo',
    'oaaaaaaaaabo',
    'oaaaaaaaabbo',
    '.oaaaaaabbo.',
    '.obbbbbbbbo.',
    '..oooooooo..',
    '............',
  ],
  scale: [
    '............',
    '.....oo.....',
    '...ooccoo...',
    '..ocaaaaco..',
    '.ocaaaaaaao.',
    '.oaaaaaaaao.',
    '.oaobbbboao.',
    '.oaaaaaaaao.',
    '..oaaaaaao..',
    '...obbbbo...',
    '....oooo....',
    '............',
  ],
  shell: [
    '............',
    '....oooo....',
    '..oocaaaoo..',
    '.ocabababao.',
    '.oaabababao.',
    'ocabababaabo',
    'oaababababbo',
    '.oaabababbo.',
    '..ooaaabboo.',
    '....oooo....',
    '............',
    '............',
  ],
  seed: [
    '............',
    '.....oo.....',
    '...oo44oo...',
    '..o444444o..',
    '..oooooooo..',
    '..ocaaaaao..',
    '..oaaaaaao..',
    '..oaaaaabo..',
    '...oaaabo...',
    '....obbo....',
    '.....oo.....',
    '............',
  ],
  root: [
    '.....oGo....',
    '....oGgGo...',
    '.....oGo....',
    '....ooaoo...',
    '...ocaaaao..',
    '...oaaaaao..',
    '....oaaao...',
    '...oaobaoo..',
    '..oaooboao..',
    '..oo.oboo...',
    '.....oo.....',
    '............',
  ],
  tentacle: [
    '.........oo.',
    '........oaao',
    '.......oawao',
    '......oaaao.',
    '.....oawao..',
    '....oaaao...',
    '...oawao....',
    '..oaaao.....',
    '.oawao......',
    'oaaao.......',
    'oao.........',
    'oo..........',
  ],
  chest: [
    '............',
    '............',
    '..oooooooo..',
    '.oaaaaaaaao.',
    'oaaaaaaaaaao',
    'oooooyyooooo',
    'oaaaaoyoaaao',
    'oaaaaaoaaaao',
    'oaaaaaaaaaao',
    'oooooooooooo',
    '............',
    '............',
  ],
  charm: [
    '....oooo....',
    '...o....o...',
    '...o....o...',
    '....oooo....',
    '...oaaaao...',
    '..oacaaaao..',
    '..oaayyaao..',
    '..oaayyaao..',
    '..oaaaaabo..',
    '...obbbbo...',
    '....oooo....',
    '............',
  ],
  jelly: [
    '............',
    '............',
    '....oooo....',
    '..oocaaaoo..',
    '.ocwcaaaaao.',
    '.ocaaaaaaao.',
    'oaaaaaaaaabo',
    'oaaaaaaaabbo',
    '.obbbbbbbbo.',
    '..oooooooo..',
    '............',
    '............',
  ],
  star: [
    '.....oo.....',
    '.....oyo....',
    '....oyyo....',
    'ooooyyyyoooo',
    'oyyyywwyyyyo',
    '.oyyywwyyyo.',
    '..oyyyyyyo..',
    '..oyyooyyo..',
    '.oyyo..oyyo.',
    '.oyo....oyo.',
    '.oo......oo.',
    '............',
  ],
  sprout: [
    '............',
    '.ooo...ooo..',
    'oaaao.oaaao.',
    'oacaaoaacao.',
    '.oaaaoaaao..',
    '..ooaaaoo...',
    '....oao.....',
    '....oao.....',
    '..oo444oo...',
    '.o4444444o..',
    '..ooooooo...',
    '............',
  ],
  clover: [
    '............',
    '..ooo.ooo...',
    '.oaaaoaaao..',
    '.oaacoacao..',
    '..oooaooo...',
    '.oaaaoaaao..',
    '.oacaoacao..',
    '..ooo.ooo...',
    '.....oGo....',
    '......oGo...',
    '.......oo...',
    '............',
  ],
  whale: [
    '............',
    '..o.o.......',
    '...o........',
    '...ooooooo..',
    '.ooaaaaaaaoo',
    'oaaaaaaaaeao',
    'oaaaaaaaaaao',
    'occcccccaaao',
    '.occcccaaao.',
    '..oooooooaoo',
    '........ooao',
    '..........oo',
  ],
  deer: [
    'o.o....o.o..',
    '.oa....ao...',
    '..oa..ao....',
    '...oaao.....',
    '...oaaaao...',
    '..oaaeaaao..',
    '..oaaaaaao..',
    '...oaaaao...',
    '...oaaao....',
    '....oaro....',
    '.....oo.....',
    '............',
  ],
  stone: [
    '............',
    '....oooo....',
    '...ocwaao...',
    '..ocwaaaao..',
    '.ocaaaaaaao.',
    '.oaaaayaaao.',
    '.oaaayyyaao.',
    '.oaaaayaabo.',
    '..oaaaaabo..',
    '...obbbbo...',
    '....oooo....',
    '............',
  ],
  sword: [
    '..........oo',
    '.........oco',
    '........ocao',
    '.......ocao.',
    '......ocao..',
    '.....ocao...',
    '.o..ocao....',
    '.ooocao.....',
    '..oyoo......',
    '.oyoo.......',
    'o4oo........',
    'oo..........',
  ],
  armor: [
    '............',
    '..oo....oo..',
    '.oaaoooooao.',
    '.oaaaaaaaao.',
    '.ocaaaaaaao.',
    '..ocaaaaao..',
    '..oaaaaaao..',
    '..oaayyaao..',
    '..oaaaaaao..',
    '..obbbbbbo..',
    '..oooooooo..',
    '............',
  ],
  pick: [
    '............',
    '...ooooo....',
    '..oaaaaaoo..',
    '.oao...oaao.',
    '.oo...o4o.oo',
    '.....o4o....',
    '....o4o.....',
    '...o4o......',
    '..o4o.......',
    '.o4o........',
    '.oo.........',
    '............',
  ],
  axe: [
    '............',
    '.....oooo...',
    '....oaaaao..',
    '...oaaaaao..',
    '...oaaao4o..',
    '....ooo4o...',
    '......o4o...',
    '.....o4o....',
    '....o4o.....',
    '...o4o......',
    '...oo.......',
    '............',
  ],
  bow: [
    '...ooo......',
    '..oaao.o....',
    '.oao...w....',
    '.oao...w....',
    'oao....w....',
    'oaoooooooooo',
    'oao....w....',
    '.oao...w....',
    '.oao...w....',
    '..oaao.o....',
    '...ooo......',
    '............',
  ],
  camp: [
    '............',
    '.....oo.....',
    '....oyyo....',
    '...oyrryo...',
    '...oyrrryo..',
    '..oyrrwryo..',
    '..oyrwwryo..',
    '...oyyyyo...',
    '.o44oooo44o.',
    'o4444444444o',
    '.oooooooooo.',
    '............',
  ],
  book: [
    '............',
    '.oooooooooo.',
    '.oaaaaaaaaoo',
    '.oacwwwwaaoo',
    '.oaaaaaaaaoo',
    '.oacwwwaaaoo',
    '.oaaaaaaaaoo',
    '.oaaaayyaaoo',
    '.oaaaayyaaoo',
    '.obbbbbbbboo',
    '.ooowwwwwwoo',
    '..oooooooooo',
  ],
  bag: [
    '............',
    '....oooo....',
    '...o4..4o...',
    '..oooooooo..',
    '.ocaaaaaaao.',
    '.oaaayyaaao.',
    '.oaaaoyaaao.',
    '.oaaaaaaaao.',
    '.oaaaaaaabo.',
    '.obbbbbbbbo.',
    '..oooooooo..',
    '............',
  ],
  person: [
    '............',
    '....oooo....',
    '...ohhhho...',
    '..ohhssssho.',
    '..ohsseseo..',
    '..ohssssso..',
    '...ooooo....',
    '..otttttto..',
    '.otttttttto.',
    '.ottbbbbtto.',
    '.otttttttto.',
    '.oooooooooo.',
  ],
  scroll: [
    '............',
    '.oooooooooo.',
    'o4444444444o',
    '.owwwwwwwwo.',
    '.ow11w111wo.',
    '.owwwwwwwwo.',
    '.ow111w11wo.',
    '.owwwwwwwwo.',
    '.ow11111wwo.',
    'o4444444444o',
    '.oooooooooo.',
    '............',
  ],
  gear: [
    '............',
    '.....oo.....',
    '..oo.oo.oo..',
    '..o1o11o1o..',
    '...o1111o...',
    '.oo11oo11oo.',
    '.oo11oo11oo.',
    '...o1111o...',
    '..o1o11o1o..',
    '..oo.oo.oo..',
    '.....oo.....',
    '............',
  ],
  cycle: [
    '............',
    '....ooooo...',
    '...oaaaaao..',
    '..oao...oao.',
    '.oao.....oo.',
    'oaaao.......',
    '.oao.....oao',
    '..o.....oaaao',
    '.........oao.',
    '..oao...oao..',
    '...oaaaaao...',
    '....ooooo....',
  ].map(r => r.slice(0, 12)),
  moon: [
    '............',
    '....oooo....',
    '..oowwwoo...',
    '.owwwoo.....',
    '.owwo.......',
    'owwo........',
    'owwo........',
    '.owwo.......',
    '.owwwoo.....',
    '..oowwwoo...',
    '....oooo....',
    '............',
  ],
};

export function icon(template, color, extra = {}) {
  return sprite('icon:' + template, ICONS[template] || ICONS.orb, {
    a: color, y: '#ffd34d', s: '#f6e6cc', h: '#3f9a5c', t: '#efe9d8', b2: '#7a4a2a', ...extra,
  });
}

// ---------------- Bitmap font for damage numbers ----------------
const FONT = {
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'], 3: ['111', '001', '111', '001', '111'],
  4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '001', '010', '010'],
  8: ['111', '101', '111', '101', '111'], 9: ['111', '101', '111', '001', '111'],
  K: ['101', '110', '100', '110', '101'], M: ['10001', '11011', '10101', '10001', '10001'],
  B: ['110', '101', '110', '101', '110'], T: ['111', '010', '010', '010', '010'],
  E: ['111', '100', '111', '100', '111'], '.': ['0', '0', '0', '0', '1'],
  '+': ['000', '010', '111', '010', '000'], '-': ['000', '000', '111', '000', '000'],
  '!': ['1', '1', '1', '0', '1'], ' ': ['00', '00', '00', '00', '00'],
  x: ['000', '101', '010', '101', '000'], g: ['111', '100', '101', '101', '111'],
  P: ['111', '101', '111', '100', '100'], X: ['101', '101', '010', '101', '101'],
  L: ['100', '100', '100', '100', '111'], V: ['101', '101', '101', '101', '010'],
  S: ['111', '100', '111', '001', '111'], I: ['111', '010', '010', '010', '111'], U: ['101', '101', '101', '101', '111'],
  k: ['100', '101', '110', '101', '101'],
};
export function textWidth(str, scale = 1) {
  let w = 0;
  for (const ch of str) w += ((FONT[ch] || FONT[' '])[0].length + 1) * scale;
  return w - scale;
}
export function drawText(ctx, str, x, y, color, scale = 1, outline = OUTLINE) {
  const w = textWidth(str, scale);
  let cx = Math.round(x - w / 2);
  y = Math.round(y);
  for (const ch of str) {
    const g = FONT[ch] || FONT[' '];
    const gw = g[0].length;
    // outline pass
    ctx.fillStyle = outline;
    for (let r = 0; r < 5; r++) for (let c = 0; c < gw; c++) {
      if (g[r][c] !== '1') continue;
      ctx.fillRect(cx + (c - 1) * scale, y + (r - 1) * scale, scale * 3, scale * 3);
    }
    cx += (gw + 1) * scale;
  }
  cx = Math.round(x - w / 2);
  ctx.fillStyle = color;
  for (const ch of str) {
    const g = FONT[ch] || FONT[' '];
    const gw = g[0].length;
    for (let r = 0; r < 5; r++) for (let c = 0; c < gw; c++) {
      if (g[r][c] === '1') ctx.fillRect(cx + c * scale, y + r * scale, scale, scale);
    }
    cx += (gw + 1) * scale;
  }
}
