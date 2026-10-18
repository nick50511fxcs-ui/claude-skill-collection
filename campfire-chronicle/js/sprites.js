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
// Grids are drawn as fills only; ol() pads them by a pixel and adds the 1px outline around the
// silhouette, so every character gets the same clean black edge. 'o' inside a grid is a drawn line.
export function ol(rows) {
  const w = Math.max(...rows.map(r => r.length)) + 2, h = rows.length + 2;
  const g = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => {
    const ch = (rows[y - 1] || '')[x - 1];
    return ch && ch !== ' ' ? ch : '.';
  }));
  const filled = (x, y) => y >= 0 && y < h && x >= 0 && x < w && g[y][x] !== '.' && g[y][x] !== '_';
  return g.map((row, y) => row.map((ch, x) => (ch === '.' && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) ? 'o' : ch === '_' ? '.' : ch)).join(''));
}

// The adventurer: chibi, big head, auburn hair, blue jacket, red scarf. Faces right.
const HERO_HEAD = [
  '..........hh........',
  '.......hhhh.........',
  '.....hhhhhhhhhh.....',
  '....hhhhhcchhhhhh...',
  '...hhhhhcchhhhhhhh..',
  '..Hhhhhhchhhhhhhhhh.',
  '.HHhhhhhhhhhhhhhhhhh',
  '.HHhhhhHhhhhHhhhhHhh',
  '.HHhhhHshhhHsshhhHsh',
  '.HhhhHssshHsssshHssh',
  '.HhhHsssssssssssssHh',
  '.HhhheeesssssseeesHh',
  '.HhHhwiisssssswiishh',
  '.HhHhiIIsssssiIIsHhh',
  '.HhHhrrssssmsssrrsh.',
  '..HHhhSssssssssSHh..',
];
const HERO_BODY = [
  '...HhkkkkkkkkkkK....',
  '....kKkkkkkkkkKk....',
  '....aakkatttaajaa...',
  '...aaAkKatttaaajaa..',
  '...aaAKaatttaaaajss.',
  '...ssAaabbybbaa.ss..',
];
const HERO_HIP = [
  '....aaaaatttaaa.....',
  '....aAaaaaaaaAa.....',
];
export const HERO = ol([
  ...HERO_HEAD, ...HERO_BODY, ...HERO_HIP,
  '.....ppppPpppp......',
  '.....pppP.Pppp......',
  '.....ffF..fffF......',
  '....fffF..ffffF.....',
]);
export const HERO_STEP = ol([
  ...HERO_HEAD, ...HERO_BODY, ...HERO_HIP,
  '.....ppppPppppp.....',
  '....pppP...Pppp.....',
  '...ffF......ffF.....',
  '..fffF......fffF....',
]);
export const HERO_CROUCH = ol([
  ...HERO_HEAD, ...HERO_BODY,
  '....aaaaatttaaaa....',
  '...pppppPPpppppp....',
  '.ffppP.....Pppp.....',
  'fffF.......fffF.....',
]);
// Front hand (tool grip) in sprite pixels, per pose.
export const HERO_HAND = [18, 21];
export const HERO_PAL = {
  h: '#c0623a', H: '#8a3a2a', c: '#f0a070',
  s: '#ffe4cc', S: '#f2b896', r: '#ffa8a8', e: '#2a1838', i: '#3a6ad8', I: '#7ac8ff', w: '#ffffff', m: '#a83a3a',
  k: '#e8484a', K: '#a8283a', a: '#3c64b4', A: '#2a4482', j: '#5a8ae0', t: '#f6f2ea',
  b: '#6a4424', y: '#ffd34d', p: '#3a3450', P: '#2a2438', f: '#7a4a2a', F: '#4e2e1a',
};
// Clones: the same figure as a pale blue spirit.
export const CLONE_PAL = {
  o: '#1a2440', h: '#6a8ad8', H: '#4a62a8', c: '#a8c8ff',
  s: '#dceaff', S: '#b0c8f0', r: '#9ab8f0', e: '#1a2440', i: '#3a5ac8', I: '#a8d8ff', w: '#ffffff', m: '#4a62a8',
  k: '#7aa0f0', K: '#4a6ac0', a: '#5a7ab8', A: '#3a5490', j: '#7a9ad8', t: '#e8f0ff',
  b: '#3a4a80', y: '#c8e0ff', p: '#3a4a80', P: '#2a3668', f: '#2a3460', F: '#1e2850',
};

// Monsters face the hero (left). 'a' is the body colour (b/c shades are derived), so variants recolour cleanly.
export const MON = {
  slime: ol([
    '........aaaaaa........',
    '......aaaaaaaaaa......',
    '.....aacwaaaaaaaa.....',
    '....aacwcaaaaaaaaa....',
    '...aaaccaaaaaaaaaaa...',
    '..aaaaaaaaaaaaaaaaaa..',
    '..aaaaaeeaaaaaeeaaaa..',
    '.aaaaaaweaaaaaweaaaaa.',
    '.aaaaaaeeaaaaaeeaaaaa.',
    '.aaaarraaaommaarraaaa.',
    'aaaaaaaaaaaaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaaaaaabb',
    'baaaaaaaaaaaaaaaaaabbb',
    'bbaaaaaaaaaaaaaaaabbbb',
    '.bbbbbbbbbbbbbbbbbbbb.',
  ]),
  shroom: ol([
    '.......aaaaaaaa.......',
    '.....aaawwaaaaaaa.....',
    '....aaawwwwaaaawwa....',
    '...acaaawwaaaawwwwa...',
    '..acwwaaaaaaaaaawwaa..',
    '.acwwwwaaaaawwaaaaaaa.',
    'aaaawwaaaawwwwaaaawwaa',
    'baaaaaaaaaawwaaaaaaaab',
    '.bbbbbbbbbbbbbbbbbbbb.',
    '....osssssssssssso....',
    '.....sseessseesss.....',
    '.....swesssswesss.....',
    '.....seesssseessS.....',
    '.....rrssmmmssrrS.....',
    '......sssssssssS......',
    '....ssSssssssssSss....',
    '....ss.SssssssS.ss....',
    '.......sSS..sSS.......',
  ]),
  frog: ol([
    '...aaaaa........aaaaa...',
    '..awwwwwa......awwwwwa..',
    '..awwweea......aeewwwa..',
    '..awweeeaaaaaaaaeeewwa..',
    '.aaawwwaacaacaaaawwwaaa.',
    '.aarraaaaaaaaaaaaaarraa.',
    'aaaoooooooooooooooooaaaa',
    'aaaallllllllllllllllaaaa',
    'aallllllllllllllllllllaa',
    '.aallllllllllllllllllaa.',
    'aaaa.bllllllllllllb.aaaa',
    'aaaa..bbbbbbbbbbbb..aaaa',
  ]),
  bat: ol([
    '.........a......a.........',
    '.........aa....aa.........',
    'aa.......apaaaapa.......aa',
    'aaa.....aaaaaaaaaa.....aaa',
    '.aaaa..aaaaaaaaaaaa..aaaa.',
    '.aaaaaaaaeeaaaaeeaaaaaaaa.',
    '..aaaaaaaweaaaaweaaaaaaa..',
    '..aaab.aaeeaaaaeeaa.baaa..',
    '...ab..aaaaawwaaaaa..ba...',
    '...b....aaaaaaaaaa....b...',
    '.........aabaabaa.........',
  ]),
  bat2: ol([
    '..........................',
    '.........a......a.........',
    '.........aa....aa.........',
    '.........apaaaapa.........',
    '........aaaaaaaaaa........',
    '.......aaaaaaaaaaaa.......',
    '....aaaaaeeaaaaeeaaaaa....',
    '..aaaaaaaweaaaaweaaaaaaa..',
    '.aaaabbaaeeaaaaeeaabbaaaa.',
    'aaab..b.aaaawwaaaa.b..baaa',
    'aab.....baaaaaaaab.....baa',
    'ab.......aabaabaa.......ba',
  ]),
  yeti: ol([
    '.......aaaaaaaaa........',
    '.....aacaaaaaaaaaa......',
    '....acaaaaaaaaaaaaa.....',
    '...aaaaffffffffffaaa....',
    '...aaaffffffffffffaa....',
    '..aaafeeffffffeeffaaa...',
    '..aaafweffffffweffaaa...',
    '..aaafeeffffffeeffaaa...',
    '..aaaffffffffffffffaa...',
    '...aaffwoooooowffaaa....',
    '...aaaffffffffffaaaa....',
    '..aaaaaaaaaaaaaaaaaaa...',
    '.aaaaaaacccccccaaaaaaa..',
    'aaabaaaccccccccccaaabaa.',
    'aaabaaccccccccccccaabaaa',
    'aabb.accccccccccccab.bba',
    'ffff.accccccccccccab.fff',
    'fff..aacccccccccaaab..ff',
    '.....aaaaaaaaaaaaaab....',
    '.....aaaab....aaaabb....',
    '....ffffff....ffffff....',
  ]),
  eye: ol([
    '.........c.......c.......c',
    '........cb......cb......cb',
    '........cbc...ccaacccc..cbc',
    '...........cccaaaaaaaaccb',
    '.........ccaaaaaaaaaaaaaacc',
    '........caaaaaaawwwwaaaaaaac',
    '.......caaaaawwwwwwwwwwaaaaac',
    '......caaaawwwwwwwwwwwmwwaaaac',
    '.....caaawwwwwwwwwwwwwmwwwwaaac',
    '....caaawwwwwwwwwwwwwwwwwwwwaaac',
    '....caaawwwwwwwrrrrrrwwwwwwwaaab',
    '...caaawwwwwwrrrrrrrrrrwwwwmwaaac',
    '...caawwmmmwrrwwRRRRRrrrwwmwwwaab',
    '..caaawwwwwwrrwRReeRRRrrwmwwwwaaac',
    '..caaawwwwwrrRRRReeRRRRrrwwwwwaaab',
    '..caaawwwwwrrRRReeeeRRRrrwwwwwaaab',
    '..caawwwwwwrrRRReeeeRRRrrwwwwwwaab',
    '..caawwwwwwrrRRReeeeRRRrrwwwwwwaab',
    '..caaawwwwwrrRRReeeeRRRrrwwwwwaaab',
    '..caaawmwwwrrRRRReeRRRRrrwwwwwaaab',
    '..caaawwmwwwrrRRReeRRRrrwwmmmwaabb',
    '...caawwwmwwrrrRRRRRRrrrwwwwwwaab',
    '...caaawwwwwwrrrrrrrrrrwwwwwwaabb',
    '....caaawwwwwwwrrrrrrwwwwwwwaaab',
    '....caaawwwwwwwwwwwwwwwwwwwwaabb',
    '.....caaawwwwwmwwwwwwwwwwwwaaab',
    '......caaaawwwmwwwwwwwwwwaaaaabc',
    '.......caaaaawwwwwwwwwwaaaabbab',
    '........caaaaaaawwwwaaaaaabb.cb',
    '.........caaaaaaaaaaaaaaabb.cb',
    '..........cbaaaaaaaaabbabb.cb',
    '.........cb.cbbbabbbbb.cb..cb',
    '.........cb.cb..cb.....cb.cb',
    '........c..c.....c....c...c',
    '.......c...c.....c....c....c',
    '.......c....c.....c..c.....c',
    '............c.........c',
    '.............c........c',
    '..............c........c',
  ]),
  treant: ol([
    '..............llllllllllll',
    '.............lggggggggggggl',
    '............lggggggggggggggl',
    '..........llggggggggggggggggll',
    '........llggggllggggggggggggggll',
    '....llllgggggglgggggggggggggggggllll',
    '...lgggggggggggggggggggggGggggggggggl',
    '..lgggggggggggggggggggggGGgggggllggggl',
    '..lggggggllggGggggggggggggggggglgggggG',
    '..lgggggglggGGgggggggggggggggggggggggG',
    '..lggggggggggggggggggggggllggggggggggG',
    '..lgggggggggggggggggggGgglgggggggggggG',
    '..lggggggGgggggggggggGGggggggggGgggggG',
    '..lgggggGGgggggggGggggggggggggGGggggGG',
    '...lggggggggggggGGgggggggggggggggggGG',
    '....lgggggggggggggggggggggggggggggGG',
    '.....lGgggggggGGGGGGGGGGGgggggggGGG',
    '.......lGGGGaaaaaaaaaaaaaaabGGGGG',
    '............caaaaaaaaallaaab',
    'gg..........caaaaaaaaalaaaab',
    'glaa.......caaaaaaaaaaaaaaaac........gg',
    '...aa......caaooooaaaaooooaab......aalg',
    '....aaa....caaayyyaaaayyyaaab.....aa',
    '.....aaaaaacaaayYyaaaayYyaaab...aaa',
    '......aaaabcaaaayaaaaaayaaaabaaaaa',
    '...........caaaaaaaaaaaaaaaabbaaa',
    '...........caaaaaaaaaaaaaaaab',
    '...........caaaaooooooooaaaab',
    '...........caaaaowmmmmwoaaaab',
    '...........caaaaaooooooaabaab',
    '...........caabaaaaaaaaaabaab',
    '...........caabaaaaaaaaaabaab',
    '...........caabaaaaaaaaaabaab',
    '...........caabaaaabaaaaabaab',
    '...........caaaaaaabaaaaabaab',
    '...........caaaaaaabaaaaaaaab',
    '...........caaaaaaaaaaaaaaabb',
    '...........aaaaabbbbbbaaaaab',
    '..........aaaab........aaaaab',
    '.........aaab...........aaaab',
    '........aaa...............aaa',
  ]),
  knight: ol([
    '...............cccrrc',
    '............cccaarrrrccc',
    '...........caaaaarrrraaac',
    '...w......caaaaaarrraaaaac',
    '...w1....caaaaaaaaaaaaaaaac',
    '...w1....caaaaaaaaaaaaaaaab',
    '...w1...caaaaaaaaaaaaaaaaaac',
    '...w1...caaaaaaaaaaaaaaaaaab',
    '...w1...caaaaaaaaaaaaaaaaaab',
    '...w1...caaaaaaaaaaaaaaaaaab',
    '...w1...caooooooooooooooooob',
    '...w1...caooyyooooyyooooooob',
    '...w1....coooYooooYoooooooob',
    '...w1.kkkaoooooooooooooooooakK',
    '...w1.kkkaaaaaaaaaaaaaaaaaaakK',
    '...w1.kkkaaaaaaaaaaaaaaaaaaakK',
    '...w1kkkkaaaaaaaaaaaaaaaaaaakkK',
    '...w1kkaaabbbbbbbbbbbbbbbbbaakK',
    '...w1kaaaaaaaaaaaaaaaaaaaaaaaaK',
    '...w1kaaaaaaaaaaaaaaaaaaaaaaaaK',
    '...w1kaaaaaaaaaaaaaaaaaaaaaaaaK',
    '...w1kaaaaaaaaaaayyaaaaaaaaaaaK',
    '...w1kkaaaaaaaaayYYyaaaaaaaaakK',
    '...w1kkkkkaaaaaaayyaaaaaaaakkkK',
    '...w1kkkkkaaaaaaaaaaaaaaaaakkkK',
    '...cckkkkkaaaaaaaaaaaaaaaaakkkK',
    '..cccckkkkaaaaaaaaaaaaaaaaakkkK',
    '..caabkkkkBBBBBBByyBBBBBBBBkkkK',
    'yyyyyyyykkBBBBBBByyBBBBBBBBkkkK',
    '...BBkkkkkaaaaaaaaaaaaaaaaakkkK',
    '...BBkkkkkkaaaaaaaaaaaaaaakkkkK',
    '...BBkkkkkkaaaaakkkkkaaaaakkkkK',
    '...BBkkkkkkaaaaakkkkkaaaaakkkkK',
    '.....kkkkkkaaaaakkkkkaaaaakkkkK',
    '.....kkkkkkaaaaakkkkkaaaaakkkkK',
    '.....kkkkkkkkkkkkkkkkkkkkkkkkkK',
    '.....KKKKKKKKKKKKKKKKKKKKKKKKKK',
  ]),
  frogking: ol([
    '.......cccc....................cccc',
    '.....ccaaaacc................ccaaaacc',
    '....caawwwwaac..............caawwwwaac',
    '....cawwwwwwab..............cawwwwwwab',
    '...cawwwweewwac............cawweewwwwac',
    '...cawwweweewab............caweweewwwab',
    '...cawwweeeewaacppccccccccppaweeeewwwab',
    '...cawwweeeewaaapaaaaaaaaapaaweeeewwwbb',
    '....cawweeeeaaaaaaaaappaaaaaaaeeeewwab',
    '....caawweeaaaaaaaaaapaaaaaaaaaeewwabb',
    '.....caaaaaappaaaaaaaaaaaaaaappaaaaab',
    '....caaaaaaapaaaaaaaaaaaaaaaapaaaaaaac',
    '...caaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaac',
    '..caoaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaoc',
    '..caaoooooooooooooooooooooooooooooooooab',
    '.caaaaaaarraaaaaaaaaaaaaaaaaaaarraaaaaaac',
    '.caaaaaaaaaaaaaallllllllllaaaaaaaaaaaaaab',
    'kkaaaaaaaaaaallllllllllllllllaaaaaaaaaaakk',
    'kkkaaaaaaaallllllllllllllllllllaaaaaaaakkk',
    'kkkkaaappallllllllllllllllllllllaappaakkkk',
    'kkkkaaapallllllllllllllllllllllllapaaakkkk',
    'kkkkkaaallllllllllllllllllllllllllaaakkkkk',
    'kkkkkaaallllllllllllllllllllllllllaaakkkkk',
    'kkkkkyaallllllllllllllllllllllllllaaykkkkk',
    'kkkkkyaallllllllllllllllllllllllllaaykkkkk',
    'yyyyyybaallllllllllllllllllllllllabbyyyyyy',
    '.......cballllllllllllllllllllllbbb',
    '.........cbllllllllllllllllllllbb',
    '......aaaabcbllllllllllllllllbbaaaab',
    '.......bbbb....cllllllllllb....bbbb',
  ]),
  yetiking: ol([
    '.....ii............................ii',
    '.....iii........cccccccc..........iii',
    '......iii.....ccaaaaaaaacc.......iii',
    '.......iii..ccaaaaaaaaaaaacc....iii',
    '........iiicaaaaaaaaaaaaaaaac..iii',
    '..........caaaaaaaaaaaaaaaaaac',
    '..........caaaaaaaaaaaaaaaaaab',
    '.........caaaaaaaffffffaaaaaaac',
    '.........caaaaffffffffffffaaaab',
    '........caaaaffffffffffffffaaaac',
    '........caaaffffffffffffffffaaab',
    '........caaafeefffffeeffffffaaab',
    '........caaffwefffffwefffffffaab',
    '........caaffeefffffeefffffffaab',
    '........caaffffffffffffffffffabb',
    '.........caffffffffffffffffffab',
    '.........caaffffffffffffffffabb',
    '..........caffooooooooofffffab',
    '..........caaffwofffowfffffaab',
    '..........caaaffffffffffffaaab',
    '........ccaaaaaaaffffffaaaaaaacc',
    '.......caaaaaaaaaaaaaaaaaaaaaaaac',
    '......iiiiiiiiiiiCCCCCCiiiiiiiiiii',
    '.....iiiiiiiiiCCCCCCCCCCCCiiiiiiiii',
    '.....caaaaaaaCCCCCCCCCCCCCCaaaaaaab',
    '....caaaaaaaCCCCCCCCCCCCCCCCaaaaaaac',
    '.aa.caaaaaaCCCCCCCCCCCCCCCCCCaaaaaabaa',
    '.aaaaaaaaaaCCCCCCCCCCCCCCCCCCaaaaaaaaa',
    '.aaaaaaaaaCCCCCCCCCCCCCCCCCCCCaaaaaaaa',
    '.aaabaaaaaCCCCCCCCCCCCCCCCCCCCaaaabaaa',
    '.ffffaaaaaCCCCCCCCCCCCCCCCCCCCaaaaffff',
    '.fffaaaaaaCCCCCCCCCCCCCCCCCCCCaaaaafff',
    '...caaaaaaaCCCCCCCCCCCCCCCCCCaaaaaabb',
    '....caaaaaaCCCCCCCCCCCCCCCCCCaaaaaab',
    '....caaaaaaaCCCCCCCCCCCCCCCCaaaaaaab',
    '.....caaaaaaaCCCCCCCCCCCCCCaaaaaaaab',
    '.....caaaaaaaaCCCCCCCCCCCCaaaaaaaaab',
    '.....caaaaaaaaaaaCCCCCCaaaaaaaaaaaab',
    '.....cbbaaaaaaaaaaaaaaaaaaaaaaabbbbb',
    '........caaaaaabaaaaaaaaaaaabbbb',
    '.........ffffffffaaaaffffffffb',
    '............cbbaaaaaaaaabbbb',
    '...............cbbbbbbbbb',
  ]),
};
export const MON_BASE_PAL = {
  treant: { a: '#8a5a32', g: '#5ab84a', G: '#2e7d32', l: '#a8e070', y: '#ffe066', Y: '#fff8c0', w: '#fff4e0', m: '#3a1a10' },
  knight: { a: '#5a5478', k: '#4a1a3a', K: '#2a1028', r: '#ff3a5a', y: '#ff5aff', Y: '#ffffff', w: '#e8eef8', 1: '#9aa4b8', B: '#2a2438' },
  eye: { a: '#7a3a9a', w: '#f4eef8', r: '#c83aff', R: '#8a1ac8', e: '#1e1626', m: '#ff6a8a' },
  frogking: { a: '#5a3a8a', w: '#ffffff', e: '#1e1626', r: '#ff8ab8', l: '#d8d0a0', p: '#9a7ad0', k: '#c8283a', y: '#ffd34d' },
  yetiking: { a: '#c8d8f0', f: '#7a8ec0', C: '#ffffff', i: '#7ae8ff', e: '#1e1626', w: '#ffffff' },
  slime: { a: '#6ac04a', w: '#ffffff', e: '#1e1626', r: '#ff8aa0', m: '#8a2a3a' },
  shroom: { a: '#d8443a', w: '#fff4e0', s: '#f6e2c4', S: '#d8b890', e: '#1e1626', r: '#ff9aa0', m: '#8a2a3a' },
  frog: { a: '#7a5ab0', l: '#d8d0a0', w: '#ffffff', e: '#1e1626', r: '#ff8ab8' },
  bat: { a: '#4a5a8a', p: '#ff9ab8', e: '#ffe066', w: '#ffffff' },
  bat2: { a: '#4a5a8a', p: '#ff9ab8', e: '#ffe066', w: '#ffffff' },
  yeti: { a: '#dfe8f2', f: '#8aa0c8', c: '#ffffff', e: '#1e1626', w: '#ffffff' },
};

// Wandering wisp: a tiny glowing fairy, two wing frames.
export const WISP = [
  ol(['cc.....cc', 'ccc...ccc', '.ccyyycc.', '..yeyey..', '..yrYry..', '...yyy...']),
  ol(['.........', '...yyy...', 'ccyeyeycc', 'cccrYrccc', '.c.yyy.c.', '....y....']),
];
export const WISP_PAL = { c: '#bff8ff', y: '#fff6b0', Y: '#ffffff', e: '#2a1838', r: '#ffb0c0' };

export const CROWN = ol([
  'y...y...y',
  'yy.yyy.yy',
  'yyyyyyyyy',
  'yryyyyyry',
  'yyyyyyyyy',
]);

// Animals for hunting.
export const ANIMALS = {
  rabbit: ol([
    '..........ab..ab',
    '..........ar..ar',
    '..........ar..ar',
    '..........araaar',
    '.........aaaaaaab',
    '.......b.aaaaewab',
    '...aaaaaaaaaaeeaab',
    '.waaaaaaaaaaaaaabb',
    'wwwaaaaaaaaaaaaabr',
    'wwwaaaaaaaaaaabrb',
    '.waaaaaaaaaaabb',
    '.baaaaaaaaaabb',
    '..baaaaaaaaab',
    '...bbbbbbbbbb',
    '.......b',
  ]),
  deer: ol([
    '................y...y.y...y',
    '.................y.y...y.y',
    '..................y.....y',
    '..................y.....y',
    '..................yy....yy',
    '.................cyy.cc.yy',
    '.................ccccaacc',
    '..................caaaaaac',
    '..................caaewaab',
    '.................caaaeeaaaee',
    '.................caaaaaaaab',
    '.................caaaabbbbb',
    '.................caaabbr',
    '.................caaab',
    '..w.....cccccccc.caaab',
    '.www.cccaaaaaaaacaaaab',
    '.wwwcaaaaaawaaaaaaaaab',
    '..wcaaawaaaaaaaaaaaabb',
    '...caaaaaaaaaawaaaaab',
    '...caaaaawaaaaaaaaaab',
    '...caaaaaaaaaaaaaaabb',
    '....caaaaaaaaaaaaaab',
    '.....cbbaaaaaaaabbbac',
    '.....cb.cabbbbbab..cb',
    '.....cb..cb....cb..cb',
    '.....cb..cb....cb..cb',
    '.....cb..cb....cb..cb',
    '.....cb..cb....cb..cb',
    '.....ee..ee....ee..ee',
  ]),
  boar: ol([
    '.....m..m..m..m..m',
    '..m..mm.mm.mm.mm.mm.c',
    '..mm..cccccccccccc.cb',
    '....ccaaaaaaaaaaaacab',
    '...caaaaaaaaaaaaaaaaacc',
    '..caaaaaaaaaaaaaaaaaaaacc',
    '.caaaaaaaaaaaaaaaaaaaewaac',
    '.caaaaaaaaaaaaaaaaaaaeeaaac',
    '.caaaaaaaaaaaaaaaaaaaaaaaar',
    '.caaaaaaaaaaaaaaaaaaaaaarrrrr',
    '.caaaaaaaaaaaaaaaaaaaaaarrrer',
    '..caaaaaaaaaaaaaaaaaaaaarrrer',
    '...caaaaaaaaaaaaaaaaaaawbbr',
    '....caaaaaaaaaaaabbaaabww',
    '....cabbbaabbbbaab.caab',
    '....cab..cab...cab..cab',
    '....eee..eee...eee..eee',
  ]),
  wolf: ol([
    '...................c....c',
    '...................cr..cr',
    '...................cbc.cb',
    'cc....................cb',
    'cac.................ccaacc',
    '.cac...............caaaaaac',
    '..cac...cccccccc..caaaewaaac',
    '...cmmmmmmmmmmmmmmmaaaeeaaab',
    '...caammmmmmmmmmmaaaaaaaaaaacee',
    '..caaaaaaaaaaaaaaaaaaaaaaaaaab',
    '..caaaaaaaaaaaaaaaaaaaaaaawwww',
    '..caaaaaaawwwwwwwwaaaaabbbwwww',
    '..caaaaawwwwwwwwwwwwbbbb',
    '...cbaaawwwwwwwwwwwwb',
    '.....cbbaawwwwwwwwbab',
    '.....cb.cabbbbbab..cb',
    '.....cb..cb....cb..cb',
    '.....cb..cb....cb..cb',
    '.....cb..cb....cb..cb',
    '.....ee..ee....ee..ee',
  ]),
  unicorn: ol([
    '............................y',
    '...........................yy',
    '..........................yy',
    '.........................yy',
    '...................c....yy',
    '...............ppp.cccccy',
    '..............pppp.caaaaacc',
    '..............ppp..caaaaaab',
    '..............pp..caaaewaaac',
    '..............pp.caaaaeeaaaac',
    '..............pp.caaaaaaaaaab',
    '..............p..caaaaaaaaaab',
    '..............p..caaabbbbbbrb',
    '..............pp.caaab',
    '.......cccccccppcaaaab',
    '..pp.ccaaaaaaaaaaaaaab',
    '.pppcaaaaaaaaaaaaaaaab',
    'pppcaaaaaaaaaaaaaaaaaac',
    'pp.caaaaaaaaaaaaaaaaaab',
    'pp.caaaaaaaaaaaaaaaaaab',
    'pppcaaaaaaaaaaaaaaaaabb',
    '.pp.caaaaaaaaaaaaaaabb',
    '.....caaaaaaaaaaaabbb',
    '......cbbbabbbbbabb.cc',
    '......cb..cb....cb..cb',
    '......cb..cb....cb..cb',
    '......cb..cb....cb..cb',
    '......cb..cb....cb..cb',
    '......cb..cb....cb..cb',
    '......yy..yy....yy..yy',
  ]),
};

// ---------------- Tools (held upright; pivot is the bottom of the handle) ----------------
export const TOOLS = {
  pick: ol([
    '..ccaaaaa..',
    '.caaaaaaab.',
    'ca...d...bb',
    'a....d....b',
    '.....d.....',
    '.....d.....',
    '.....d.....',
    '.....d.....',
    '.....d.....',
    '.....d.....',
    '.....D.....',
  ]),
  axe: ol([
    '...dcc..',
    '...dcaa.',
    '...daaab',
    '...daaab',
    '...dbbb.',
    '...d....',
    '...d....',
    '...d....',
    '...d....',
    '...d....',
    '...D....',
  ]),
  sword: ol([
    '..c..',
    '.cab.',
    '.cab.',
    '.cab.',
    '.cab.',
    '.cab.',
    '.cab.',
    '.cab.',
    '.cab.',
    '.cab.',
    'yyyyy',
    '..d..',
    '..d..',
    '..y..',
  ]),
  sickle: ol([
    '.ccaa..',
    'c....a.',
    '.....ab',
    '....db.',
    '....d..',
    '....d..',
    '....d..',
    '....D..',
  ]),
  rod: ol(['a', 'd', 'd', 'a', 'd', 'd', 'd', 'd', 'd', 'd', 'D', 'D']),
  ladle: ol([
    '.caa.',
    'caaab',
    '.abb.',
    '..d..',
    '..d..',
    '..d..',
    '..d..',
    '..d..',
    '..D..',
  ]),
};
export const TOOL_PIVOT = { pick: [6, 11], axe: [4, 11], sword: [3, 13], sickle: [5, 8], rod: [1, 12], ladle: [3, 9] };
export const TOOL_FOR = { combat: 'sword', mining: 'pick', wood: 'axe', forage: 'sickle', fish: 'rod', hunt: 'bow', alchemy: 'ladle' };
export const WOOD_PAL = { d: '#b07a44', D: '#7a4e2a', y: '#ffd34d' };

export const BOW = ol([
  'ca...',
  '.ca..',
  '..a..',
  '..ab.',
  '...a.',
  '...a.',
  '...a.',
  '..ab.',
  '..a..',
  '.ab..',
  'ab...',
]);

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
  log: ol([
    '',
    '',
    '.aaaaaa33.',
    'acccccc343',
    'aaaaaaa343',
    'abbbbbb343',
    '.bbbbbb33.',
    '',
    '',
    '',
  ]),
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
  fish: ol([
    '',
    '',
    '....ccc...',
    'a.ccaaaaa.',
    'aacaaaaaea',
    'aaaaaaaaaa',
    'a.bbbbbbb.',
    '....bbb...',
    '',
    '',
  ]),
  meat: ol([
    '...aaaa...',
    '..acccaa..',
    '.acaaaaab.',
    '.aaaaaaab.',
    '.aaaaaabb.',
    '..abbbbb..',
    '....ww....',
    '....ww....',
    '...wwww...',
    '...w..w...',
  ]),
  hide: ol([
    'a........a',
    'aa.aaaa.aa',
    '.aaccaaaa.',
    '.acaaaaaa.',
    'aaaaaaaaaa',
    '.aaaaaaab.',
    '.aaaaaabb.',
    'aa.bbbb.aa',
    'a........a',
    '',
  ]),
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
  person: ol([
    '..hhhhh...',
    '.hhhcchhh.',
    'hhhhhhhhhh',
    'hhHshhsHhh',
    'hHsssssssh',
    'hseessseeh',
    'hsiissiish',
    '.srsssssr.',
    '.kkkkkkkk.',
    'aaakkkkaaa',
  ]),
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
  if (template === 'person') return sprite('icon:person', ICONS.person, HERO_PAL);
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
