// Canvas renderer: the surface camp between runs, and the mine during a run
// (block tiles, the miner, ability effects, debris and damage numbers).
import { sprite, drawRotated, drawText, icon, shade, OUTLINE, silhouette, HERO, HERO_HAND, HERO_PAL, TOOLS, TOOL_PIVOT, WOOD_PAL } from './sprites.js';
import { COLS, ORES, LAYERS, ABILITY, GEAR_TIERS } from './data.js';
import { layerOf } from './engine.js';

export const T = 24;
export const W = COLS * T, H = 384;
const VIEW_ROW = 5; // the miner's row on screen
const PICK_COLORS = ['#a8743a', ...ORES.map(o => o.color)];

const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
function noise(i, s) { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); }
function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); ctx.fill(); }
const layerDef = y => { const L = layerOf(y); return { ...LAYERS[L % LAYERS.length], deep: Math.floor(L / LAYERS.length) }; };
const rockColor = y => { const l = layerDef(y); return l.deep ? shade(l.rock, -Math.min(0.5, l.deep * 0.15)) : l.rock; };

// ---------- Block tiles (generated once per look) ----------
const tiles = new Map();
function tile(c, y) {
  const L = layerOf(y);
  const key = `${c.t}:${L}:${c.o ?? ''}:${c.v}`;
  let cv = tiles.get(key);
  if (cv) return cv;
  cv = makeCanvas(T, T);
  const x = cv.getContext('2d');
  const base = c.t === 'hard' ? shade(rockColor(y), -0.35) : rockColor(y);
  x.fillStyle = base; x.fillRect(0, 0, T, T);
  // speckles
  for (let i = 0; i < 14; i++) {
    x.fillStyle = noise(i, c.v + L * 7) > 0.5 ? shade(base, 0.12) : shade(base, -0.15);
    x.fillRect(Math.floor(noise(i, 3 + c.v) * 21) + 1, Math.floor(noise(i, 9 + c.v) * 21) + 1, 2, 1 + (i % 2));
  }
  if (c.t === 'hard') {
    x.fillStyle = shade(base, -0.3);
    for (let i = 0; i < 3; i++) { const sx = 3 + i * 7; for (let k = 0; k < 6; k++) x.fillRect(sx + k, 4 + k * 2 + (i % 2), 1, 2); }
  }
  // bevel and edge
  x.fillStyle = shade(base, 0.22); x.fillRect(1, 1, T - 2, 1); x.fillRect(1, 1, 1, T - 2);
  x.fillStyle = shade(base, -0.28); x.fillRect(1, T - 2, T - 2, 1); x.fillRect(T - 2, 1, 1, T - 2);
  x.fillStyle = shade(base, -0.5); x.strokeStyle = x.fillStyle;
  x.fillRect(0, 0, T, 1); x.fillRect(0, 0, 1, T); x.fillRect(0, T - 1, T, 1); x.fillRect(T - 1, 0, 1, T);
  if (c.t === 'ore') {
    const col = ORES[c.o].color;
    for (let i = 0; i < 4; i++) {
      const ox = 3 + Math.floor(noise(i, 40 + c.v) * 14), oy = 3 + Math.floor(noise(i, 50 + c.v) * 14);
      x.fillStyle = OUTLINE; x.fillRect(ox - 1, oy, 6, 4); x.fillRect(ox, oy - 1, 4, 6);
      x.fillStyle = shade(col, -0.25); x.fillRect(ox, oy, 4, 4);
      x.fillStyle = col; x.fillRect(ox, oy, 3, 3);
      x.fillStyle = shade(col, 0.55); x.fillRect(ox, oy, 1, 1);
    }
  } else if (c.t === 'gem') {
    const col = '#ff7ad8';
    const g = ['...oo...', '..occo..', '.occaao.', 'occaaabo', '.oaaabo.', '..oabo..', '...oo...'];
    g.forEach((r, j) => [...r].forEach((ch, i) => {
      if (ch === '.') return;
      x.fillStyle = ch === 'o' ? OUTLINE : ch === 'c' ? '#ffd8f4' : ch === 'b' ? shade(col, -0.3) : col;
      x.fillRect(8 + i, 8 + j, 1, 1);
    }));
    x.fillStyle = '#ffffff'; x.fillRect(5, 6, 1, 1); x.fillRect(17, 15, 1, 1);
  } else if (c.t === 'chest') {
    x.drawImage(icon('chest', '#c8913a'), 6, 6);
  }
  tiles.set(key, cv);
  return cv;
}
function cracks(ctx, px, py, f) {
  ctx.fillStyle = 'rgba(10,6,14,0.75)';
  const n = f > 0.66 ? 0 : f > 0.33 ? 1 : 2;
  const paths = [[[12, 4], [11, 8], [13, 11], [10, 15]], [[4, 14], [8, 13], [10, 16], [15, 15], [18, 19]], [[18, 4], [16, 8], [19, 10], [17, 14]]];
  for (let k = 0; k <= n; k++) for (const [x, y] of paths[k]) ctx.fillRect(px + x, py + y, 2, 1);
}

export class Renderer {
  constructor(canvas, game) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.g = game;
    this.t = 0;
    this.cam = 0;
    this.parts = [];
    this.floaters = [];
    this.fx = [];
    this.shake = 0;
    this.swingT = 0;
    this.reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  handle(events) {
    const run = this.g.run;
    for (const e of events) {
      if (e.t === 'start') { this.cam = e.floor - VIEW_ROW; this.parts = []; this.fx = []; }
      else if (e.t === 'swing') this.swingT = 0.16;
      else if (e.t === 'hit') {
        if (e.src === 'crit' || (e.src !== 'pick' && Math.random() < 0.35)) this.floater(fmt(e.dmg), e.x * T + 12, this.sy(e.y) + 8, e.src === 'crit' ? '#ff6a6a' : '#ffe066');
        else if (e.src === 'pick' && Math.random() < 0.5) this.floater(fmt(e.dmg), e.x * T + 12, this.sy(e.y) + 8, '#ffffff');
      } else if (e.t === 'break') {
        const col = e.c.t === 'ore' ? ORES[e.c.o].color : e.c.t === 'gem' ? '#ff7ad8' : e.c.t === 'chest' ? '#ffd34d' : rockColor(e.y);
        this.burst(e.x * T + 12, this.sy(e.y) + 12, col, e.c.t === 'rock' ? 5 : 10);
        if (e.c.t === 'rock' || e.c.t === 'hard') this.burst(e.x * T + 12, this.sy(e.y) + 12, rockColor(e.y), 4);
        if (e.drop && e.drop.k !== 'stone') this.pop(e.drop, e.x * T + 12, this.sy(e.y) + 6);
        if (e.c.t === 'chest') { this.ring(e.x * T + 12, this.sy(e.y) + 12, '#ffd34d'); this.shake = 0.15; }
      } else if (e.t === 'cast') {
        const a = ABILITY[e.id];
        this.fx.push({ t: 0, life: e.id === 'meteor' ? 0.6 : 0.4, a, cells: e.cells, cx: e.cx, cy: e.cy, from: e.from });
        if (['bomb', 'dyn', 'meteor', 'vortex', 'nova'].includes(e.id)) this.shake = Math.max(this.shake, e.id === 'nova' ? 0.4 : 0.2);
      } else if (e.t === 'frenzy') { this.ring(run.x * T + 12, this.sy(run.y) + 12, '#ff8a3a'); this.shake = 0.2; }
      else if (e.t === 'revive') { this.ring(run.x * T + 12, this.sy(run.y) + 12, '#ff7a2a'); this.floater('부활!', run.x * T + 12, this.sy(run.y) - 10, '#ffb84a'); }
    }
  }
  sy(y) { return Math.round((y - this.cam) * T); }
  burst(x, y, color, n) {
    if (this.reduced) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) this.parts.push({ x, y, vx: rnd(-50, 50), vy: rnd(-90, -20), g: 260, life: rnd(0.3, 0.7), t: 0, color, size: Math.random() < 0.4 ? 2 : 1 });
  }
  ring(x, y, color) { this.fx.push({ t: 0, life: 0.4, ring: true, x, y, color }); }
  floater(text, x, y, color, scale = 1) { this.floaters.push({ text, x, y, color, scale, t: 0, life: 0.8 }); }
  pop(drop, x, y) {
    const tpl = drop.k === 'gems' ? 'gem' : drop.k === 'chests' ? 'chest' : 'ore';
    const col = drop.k === 'gems' ? '#ff7ad8' : drop.k === 'chests' ? '#c8913a' : ORES.find(o => o.id === drop.k)?.color;
    this.floaters.push({ icon: icon(tpl, col), n: drop.n, x, y, t: 0, life: 0.9 });
  }

  frame(dt) {
    this.t += dt;
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    if (this.shake > 0 && !this.reduced) ctx.translate(Math.round(rnd(-2, 2)), Math.round(rnd(-2, 2)));
    if (this.g.run) this.drawMine(ctx, dt);
    else this.drawCamp(ctx);
    ctx.restore();
    this.shake = Math.max(0, this.shake - dt);
    this.swingT = Math.max(0, this.swingT - dt);
  }

  // ---------- Mine ----------
  drawMine(ctx, dt) {
    const run = this.g.run;
    let py = run.y, px = run.x;
    if (run.anim) { const f = Math.min(1, run.anim.t / run.anim.dur); py = lerp(run.anim.fy, run.y, f); px = lerp(run.anim.fx, run.x, f); }
    const target = py - VIEW_ROW;
    this.cam = Math.abs(target - this.cam) > 12 ? target : lerp(this.cam, target, Math.min(1, dt * 8));
    const top = Math.floor(this.cam), rows = Math.ceil(H / T) + 1;
    for (let r = 0; r <= rows; r++) {
      const y = top + r, sy = this.sy(y);
      const l = layerDef(y);
      ctx.fillStyle = y < run.start ? '#14101c' : l.bg;
      ctx.fillRect(0, sy, W, T);
      if (y < run.start) continue;
      const row = this.g.row(y);
      for (let x = 0; x < COLS; x++) {
        const c = row[x];
        if (!c) {
          ctx.fillStyle = shade(l.bg, 0.06);
          if (noise(x + y * 9, 5) > 0.7) ctx.fillRect(x * T + 6 + ((x * 7) % 9), sy + 8 + ((y * 5) % 9), 2, 2);
          continue;
        }
        ctx.drawImage(tile(c, y), x * T, sy);
        if (c.hp < c.max) cracks(ctx, x * T, sy, c.hp / c.max);
      }
      if (y % 100 === 0 && y > 0) { // layer marker
        ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(0, sy, W, 1);
        drawText(ctx, `${y}F`, W - 14, sy + 2, '#ffe066');
      }
    }
    // Ability effects under the miner
    for (const f of this.fx) this.drawFx(ctx, f, dt);
    this.fx = this.fx.filter(f => f.t < f.life);
    this.drawMiner(ctx, px * T + 12, Math.round((py - this.cam) * T) + T, run);
    this.drawParts(ctx, dt);
    this.drawFloaters(ctx, dt);
    // Darkness creeps in at the edges deeper down.
    const L = layerOf(run.y);
    if (L >= 1) {
      const g = ctx.createRadialGradient(px * T + 12, this.sy(py) + 12, 60, px * T + 12, this.sy(py) + 12, 260);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(4,2,10,${Math.min(0.6, 0.2 + L * 0.05)})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (run.frenzy > 0) {
      ctx.globalAlpha = 0.12 + 0.06 * Math.sin(this.t * 12);
      ctx.fillStyle = '#ff6a2a'; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }
  drawMiner(ctx, cx, footY, run) {
    const s = this.g.s;
    const body = sprite('hero', HERO, HERO_PAL);
    const flip = run.face < 0;
    const x0 = Math.round(cx - 11), top = Math.round(footY - body.height + 1);
    if (run.frenzy > 0) { ctx.globalAlpha = 0.35; ctx.fillStyle = '#ff8a3a'; circle(ctx, cx, top + 16, 16 + Math.sin(this.t * 14) * 2); ctx.globalAlpha = 1; }
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(cx - 8, footY - 1, 16, 2);
    ctx.save();
    if (flip) { ctx.translate(cx * 2, 0); ctx.scale(-1, 1); }
    ctx.drawImage(body, x0, top);
    if (run.dur / run.maxDur < 0.2 && Math.sin(this.t * 10) > 0) {
      ctx.globalAlpha = 0.35; ctx.drawImage(silhouette(body, '#ff4a4a'), x0, top); ctx.globalAlpha = 1;
    }
    ctx.restore();
    // Pickaxe: swings toward the block being dug.
    const hx = flip ? x0 + body.width - HERO_HAND[0] : x0 + HERO_HAND[0], hy = top + HERO_HAND[1];
    const ph = this.swingT > 0 ? 1 - this.swingT / 0.16 : 0;
    const down = run.dir === 'down';
    const ang = down ? lerp(-0.4, 2.3, ph) : lerp(-1.3, 1.5, ph);
    const img = sprite('tool:pick', TOOLS.pick, { ...WOOD_PAL, a: PICK_COLORS[s.gear.pick] || '#ffffff' });
    const [ppx, ppy] = TOOL_PIVOT.pick;
    drawRotated(ctx, img, hx, hy, ppx, ppy, flip ? -ang : ang, flip);
    ctx.fillStyle = OUTLINE; ctx.fillRect(hx - 1, hy - 1, 3, 3);
    ctx.fillStyle = HERO_PAL.s; ctx.fillRect(hx, hy, 1, 1);
  }
  drawFx(ctx, f, dt) {
    f.t += dt;
    const k = f.t / f.life;
    if (f.ring) {
      ctx.strokeStyle = f.color; ctx.globalAlpha = 1 - k; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(f.x, f.y, 6 + k * 30, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1; return;
    }
    const col = f.a.color;
    ctx.globalAlpha = Math.max(0, 1 - k);
    if (f.a.id === 'bolt') {
      ctx.fillStyle = '#fff8c0';
      const [fx0, fy0] = f.from;
      for (const [x, y] of f.cells) {
        let lx = fx0 * T + 12, ly = this.sy(fy0) + 12;
        const tx = x * T + 12, ty = this.sy(y) + 12;
        for (let i = 1; i <= 6; i++) {
          const nx = lerp(fx0 * T + 12, tx, i / 6) + (i < 6 ? rnd(-4, 4) : 0), ny = lerp(this.sy(fy0) + 12, ty, i / 6) + (i < 6 ? rnd(-4, 4) : 0);
          const steps = Math.max(Math.abs(nx - lx), Math.abs(ny - ly));
          for (let j = 0; j <= steps; j++) ctx.fillRect(Math.round(lerp(lx, nx, j / steps)), Math.round(lerp(ly, ny, j / steps)), 2, 2);
          lx = nx; ly = ny;
        }
      }
    } else if (f.a.id === 'meteor' && k < 0.4) {
      const mk = k / 0.4, mx = f.cx * T + 12, my = this.sy(f.cy) + 12;
      ctx.globalAlpha = 1;
      ctx.drawImage(icon('meteor', '#8a5a3a'), Math.round(lerp(mx + 60, mx, mk)) - 12, Math.round(lerp(my - 160, my, mk)) - 12, 24, 24);
      return;
    }
    for (const [x, y] of f.cells) {
      ctx.fillStyle = col;
      const inset = Math.round(k * 8);
      ctx.fillRect(x * T + inset, this.sy(y) + inset, T - inset * 2, T - inset * 2);
    }
    if (['bomb', 'meteor', 'vortex', 'nova', 'frost'].includes(f.a.id)) {
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = Math.max(0, 0.6 - k);
      circle(ctx, f.cx * T + 12, this.sy(f.cy) + 12, 8 + k * (f.a.r || 1) * 26);
    }
    ctx.globalAlpha = 1;
  }
  drawParts(ctx, dt) {
    for (const p of this.parts) {
      p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    this.parts = this.parts.filter(p => p.t < p.life);
    if (this.parts.length > 300) this.parts.splice(0, this.parts.length - 300);
  }
  drawFloaters(ctx, dt) {
    for (const f of this.floaters) {
      f.t += dt;
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, f.t - f.life * 0.6) / (f.life * 0.4));
      const y = f.y - f.t * 26;
      if (f.icon) { ctx.drawImage(f.icon, Math.round(f.x - 6), Math.round(y - 6)); if (f.n > 1) drawText(ctx, 'x' + f.n, f.x + 10, y - 2, '#ffffff'); }
      else drawText(ctx, f.text, f.x, y, f.color, f.scale);
    }
    ctx.globalAlpha = 1;
    this.floaters = this.floaters.filter(f => f.t < f.life);
    if (this.floaters.length > 60) this.floaters.splice(0, this.floaters.length - 60);
  }

  // ---------- Surface camp ----------
  drawCamp(ctx) {
    const s = this.g.s, t = this.t, gy = 236;
    const sky = ctx.createLinearGradient(0, 0, 0, gy);
    sky.addColorStop(0, '#2a3a7a'); sky.addColorStop(1, '#e8a87a');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, gy);
    for (let i = 0; i < 30; i++) { ctx.fillStyle = noise(i, 2) > 0.7 ? '#ffffff' : '#c8d0ff'; ctx.fillRect(Math.floor(noise(i, 3) * W), Math.floor(noise(i, 4) * 90), 1, 1); }
    ctx.fillStyle = '#5a4a7a';
    for (let x = 0; x < W; x++) { const h = 40 + Math.sin(x / 23) * 12 + Math.sin(x / 9 + 1) * 5; ctx.fillRect(x, gy - 40 - h, 1, h + 40); }
    ctx.fillStyle = '#3a5a4a';
    for (let x = 0; x < W; x++) { const h = 20 + Math.sin(x / 17 + 2) * 8; ctx.fillRect(x, gy - h, 1, h); }
    // ground cross-section with the shaft going down
    ctx.fillStyle = '#4a8a3a'; ctx.fillRect(0, gy, W, 5);
    ctx.fillStyle = OUTLINE; ctx.fillRect(0, gy, W, 1);
    for (let r = 0; r * T + gy + 5 < H; r++) {
      for (let x = 0; x < COLS; x++) {
        const y = r + 1, px = x * T, sy = gy + 5 + r * T;
        if (x === 4) { ctx.fillStyle = '#14101c'; ctx.fillRect(px, sy, T, T); continue; }
        ctx.drawImage(tile({ t: noise(x, r) > 0.85 ? 'ore' : 'rock', o: 0, v: (x + r) % 4 }, y), px, sy);
      }
    }
    ctx.fillStyle = '#7a5432'; ctx.fillRect(4 * T - 3, gy - 22, 4, 27); ctx.fillRect(5 * T - 1, gy - 22, 4, 27); ctx.fillRect(4 * T - 5, gy - 26, T + 10, 5);
    ctx.fillStyle = OUTLINE; ctx.fillRect(4 * T - 5, gy - 27, T + 10, 1);
    // village buildings appear as they are built
    const built = ['smith', 'inn', 'smelter', 'vault', 'trader', 'hut'].filter(id => s.town[id]);
    built.forEach((id, i) => this.house(ctx, i < 3 ? 6 + i * 24 : 132 + (i - 3) * 26, gy, id, s.town[id]));
    // campfire and the miner
    const fx = 150, fl = Math.sin(t * 9) * 1.5;
    ctx.fillStyle = '#6a4424'; ctx.fillRect(fx - 7, gy - 3, 14, 3);
    ctx.fillStyle = '#ff6a2a'; circle(ctx, fx, gy - 7 + fl * 0.3, 5);
    ctx.fillStyle = '#ffd34d'; circle(ctx, fx, gy - 6, 3);
    if (Math.random() < 0.3 && !this.reduced) this.parts.push({ x: fx + rnd(-2, 2), y: gy - 10, vx: rnd(-5, 5), vy: -25, g: 0, life: 1, t: 0, color: Math.random() < 0.5 ? '#ffb84a' : '#ff6a3a', size: 1 });
    const body = sprite('hero', HERO, HERO_PAL);
    const bob = Math.round(Math.sin(t * 2.5) * 0.5 + 0.5);
    ctx.drawImage(body, 116, gy - body.height + 1 - bob);
    this.drawParts(ctx, 1 / 60);
    const glow = ctx.createRadialGradient(fx, gy - 6, 2, fx, gy - 6, 60);
    glow.addColorStop(0, 'rgba(255,170,80,0.25)'); glow.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = glow; ctx.fillRect(fx - 60, gy - 66, 120, 120);
    drawText(ctx, `${GEAR_TIERS[s.gear.pick]}`, 127, gy - 40, '#ffe066');
  }
  house(ctx, x, gy, id, lv) {
    const cols = { smith: '#8a4a3a', inn: '#a85a3a', smelter: '#6a6a7a', vault: '#8a6a2a', trader: '#3a6aa8', hut: '#5a7a3a' };
    const h = 16 + Math.min(10, lv), w = 20;
    ctx.fillStyle = OUTLINE; ctx.fillRect(x - 1, gy - h - 1, w + 2, h + 1);
    ctx.fillStyle = '#c8a070'; ctx.fillRect(x, gy - h, w, h);
    ctx.fillStyle = cols[id];
    for (let i = 0; i < 8; i++) ctx.fillRect(x - 2 + i, gy - h - 8 + i, w + 4 - i * 2, 1);
    ctx.fillStyle = OUTLINE; ctx.fillRect(x + 7, gy - 8, 6, 8);
    ctx.fillStyle = '#ffe08a'; ctx.fillRect(x + 2, gy - h + 4, 3, 3); ctx.fillRect(x + 15, gy - h + 4, 3, 3);
    if (id === 'smelter') { ctx.fillStyle = '#4a4a5a'; ctx.fillRect(x + 14, gy - h - 12, 4, 8); }
  }
}

export function fmt(n) {
  if (n < 1000) return String(Math.round(n));
  const u = ['K', 'M', 'B', 'T'];
  let i = -1;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return (n < 10 ? n.toFixed(1) : Math.round(n)) + u[i];
}
