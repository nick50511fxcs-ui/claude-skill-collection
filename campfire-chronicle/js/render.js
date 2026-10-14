// Canvas renderer: parallax backgrounds, the battle scene, the campfire scene with
// animated life-skill stations, clone insets, floaters and rare-drop effects.
import {
  sprite, drawRotated, drawText, icon, shade, OUTLINE, HERO, HERO_STEP, HERO_CROUCH, HERO_PAL, CLONE_PAL,
  MON, MON_BASE_PAL, CROWN, ANIMALS, TOOLS, TOOL_PIVOT, TOOL_FOR, WOOD_PAL, BOW,
} from './sprites.js';
import { ITEMS, TIERS, MONSTERS, TOOL_TIERS, REGIONS } from './data.js';
import { toolTier } from './engine.js';

export const W = 384, H = 216, GROUND = 178;
const GEAR_COLORS = ['#c8ccd8', '#9ae0a0', '#8ac8ff', '#d8a8ff', '#ffd27a', '#ff8aa8', '#bffcff'];

// Deterministic noise for terrain.
function noise(i, seed) {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
function smooth(x, seed) {
  const i = Math.floor(x), f = x - i;
  const a = noise(i, seed), b = noise(i + 1, seed);
  return a + (b - a) * (f * f * (3 - 2 * f));
}
function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
const lerp = (a, b, t) => a + (b - a) * t;
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = lerp((pa >> 16) & 255, (pb >> 16) & 255, t), g = lerp((pa >> 8) & 255, (pb >> 8) & 255, t), bl = lerp(pa & 255, pb & 255, t);
  return `rgb(${r | 0},${g | 0},${bl | 0})`;
}

const THEMES = {
  meadow: { far: '#7a9ad8', mid: '#5aa85a', mid2: '#3f8a4a', top: '#6ad04a', topD: '#3f9a3a', dirt: '#a8743a', dirtD: '#7a4e24' },
  swamp: { far: '#6a5a8a', mid: '#4a5a4a', mid2: '#384838', top: '#6a8a4a', topD: '#4a6a3a', dirt: '#5a4a3a', dirtD: '#3a2e24' },
  ice: { far: '#5a7ab8', mid: '#8ab8e8', mid2: '#6a98d0', top: '#d8f0ff', topD: '#a8d0f0', dirt: '#5a78a8', dirtD: '#3a5888' },
  tower: { far: '#3a2a5a', mid: '#4a3a6a', mid2: '#2e2448', top: '#8a6ac8', topD: '#5a4a8a', dirt: '#3a2a4a', dirtD: '#24182e' },
  camp: { far: '#7a8ac8', mid: '#4a8a5a', mid2: '#3a6a4a', top: '#5ac04a', topD: '#3a8a3a', dirt: '#9a6a3a', dirtD: '#6a4424' },
};

function skyColors(hour, theme) {
  if (theme === 'ice') return ['#1a2a4a', '#3a5a8a'];
  if (theme === 'tower') return ['#120a24', '#3a2458'];
  let top, bot;
  if (hour >= 20 || hour < 5) { top = '#141a3a'; bot = '#2e3468'; }
  else if (hour < 7) { top = '#5a6ab8'; bot = '#f6a37a'; }
  else if (hour < 17) { top = '#5ab4ff'; bot = '#c8ecff'; }
  else { top = '#6a5a9a'; bot = '#ff9a6a'; }
  if (theme === 'swamp') { top = mixHex(top, '#4a3a6a', 0.45); bot = mixHex(bot, '#8a9a7a', 0.45); }
  return [top, bot];
}

export class Renderer {
  constructor(canvas, overlay, game) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.ov = overlay;
    this.g = game;
    this.t = 0;
    this.scroll = 0;
    this.floaters = [];
    this.parts = [];
    this.pops = [];
    this.shake = 0;
    this.flash = 0;
    this.flashColor = '#fff';
    this.timeScale = 1;
    this.fxQueue = [];
    this.fx = null;
    this.heroAnim = { swing: 0, hurt: 0, levelUp: 0 };
    this.monAnim = { hurt: 0, dying: 0, last: null };
    this.slotVis = [];
    this.layers = new Map();
    this.clones = [];
    this.soot = 0;
    this.lastMode = null;
    this.modeFade = 0;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.makeOverlay();
  }

  makeOverlay() {
    this.ov.innerHTML = `
      <div class="nametag" id="nameTag"><span class="nm">모험가</span><span class="badge" id="titleBadge">새내기</span></div>
      <div class="monname" id="monName" hidden></div>
      <div class="bubble" id="bubble" hidden></div>
      <div class="banner" id="banner" hidden></div>
      <div class="blackout" id="blackout" hidden></div>`;
    this.el = {
      name: this.ov.querySelector('#nameTag'), title: this.ov.querySelector('#titleBadge'),
      mon: this.ov.querySelector('#monName'), bubble: this.ov.querySelector('#bubble'),
      banner: this.ov.querySelector('#banner'), blackout: this.ov.querySelector('#blackout'),
    };
  }

  // Position an overlay element at internal canvas coordinates.
  place(el, x, y) {
    el.style.left = (x / W) * 100 + '%';
    el.style.top = (y / H) * 100 + '%';
  }

  say(text, ms = 3500) {
    const b = this.el.bubble;
    b.textContent = text;
    b.hidden = false;
    clearTimeout(this.sayT);
    this.sayT = setTimeout(() => { b.hidden = true; }, ms);
  }

  // ---------- Event intake ----------
  handle(events) {
    const s = this.g.s;
    for (const e of events) {
      switch (e.t) {
        case 'hit':
          if (e.who === 'mon') {
            this.heroAnim.swing = 0.22;
            this.monAnim.hurt = 0.15;
            this.floater(fmtShort(e.dmg) + (e.crit ? '!' : ''), 236 + rnd(-8, 8), 140 + rnd(-6, 4), e.crit ? '#ff6ad5' : '#fff2a8', e.crit ? 2 : 1);
            if (e.crit && !this.reduced) this.shake = Math.max(this.shake, 0.12);
          } else {
            this.heroAnim.hurt = 0.2;
            this.floater('-' + fmtShort(e.dmg), 150 + rnd(-4, 4), 140, '#ff5a5a', 1);
          }
          break;
        case 'miss': this.floater('MISS', 150, 136, '#a8d8ff', 1); break;
        case 'kill':
          this.monAnim.dying = 0.35;
          this.monAnim.last = e.mon;
          this.burst(236, 160, MON_BASE_PAL[MONSTERS[e.mon.key].sprite]?.a || '#fff', 10);
          this.floater('+' + fmtShort(e.gold) + 'g', 236, 128, '#ffd34d', 1);
          break;
        case 'lv':
          this.heroAnim.levelUp = 1.2;
          this.floater('LV UP', 157, 118, '#ffe066', 2);
          this.ring(157, 168, '#ffe066');
          break;
        case 'drop':
          if (e.src === 'combat') this.pop(e.id, 236, 160);
          this.rareFx(e.id);
          break;
        case 'gear':
          if (e.equip) this.say('좋은 장비다! 바로 장착!', 2500);
          break;
        case 'act': {
          const v = this.vis(e.slot);
          v.last = this.t;
          v.kind = e.kind || 'ok';
          v.id = e.id;
          if (e.k === 'hunt') { v.arrow = 0.35; v.animal = null; }
          if (e.k === 'alchemy' && e.kind === 'fail' && e.slot === 0) this.soot = 3;
          if (e.slot === 0 && this.g.s.mode === 'camp') this.pop(e.id, 205, 160, e.n);
          else if (e.slot > 0) v.pop = { id: e.id, t: 0 };
          break;
        }
        case 'record': this.say(`신기록! ${ITEMS[e.id].name} ${e.w}kg!`, 3500); break;
        case 'camp': this.say(e.reason === 'death' ? '으윽… 모닥불로 후퇴!' : e.reason === 'tired' ? '헉헉, 잠깐 쉬자…' : '야영 준비!', 2500); break;
        case 'death': this.flash = 0.25; this.flashColor = '#ff3a3a'; break;
        case 'secret': this.queueFx({ tier: 5, id: 'x_secret', text: '미지의 레시피 발견!' }); break;
        case 'rebirth': this.queueFx({ tier: 4, id: 'p_luck', text: `윤회! 모닥불의 재 +${e.gain}` }); break;
      }
    }
  }

  vis(i) {
    if (!this.slotVis[i]) this.slotVis[i] = { last: -9, kind: 'ok', id: null, arrow: 0, animal: null };
    return this.slotVis[i];
  }
  floater(text, x, y, color, scale) {
    this.floaters.push({ text, x, y, color, scale, t: 0, life: scale > 1 ? 1.1 : 0.9 });
    if (this.floaters.length > 40) this.floaters.shift();
  }
  burst(x, y, color, n) {
    if (this.reduced) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 50;
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, g: 120, life: 0.6, t: 0, color, size: 1 + (Math.random() < 0.3) });
    }
  }
  ring(x, y, color) {
    if (this.reduced) return;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      this.parts.push({ x, y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 18 - 10, g: 0, life: 0.7, t: 0, color, size: 1 });
    }
  }
  pop(id, x, y, n = 1) {
    const it = ITEMS[id];
    if (!it) return;
    this.pops.push({ id, x, y, tx: 157, t: 0, n });
    if (this.pops.length > 12) this.pops.shift();
  }

  rareFx(id) {
    const it = ITEMS[id];
    if (!it || it.tier < 2) return;
    if (it.tier === 2) { this.sparkle(205, 150, TIERS[2].color); return; }
    this.queueFx({ tier: it.tier, id });
  }
  sparkle(x, y, color) {
    if (this.reduced) return;
    for (let i = 0; i < 8; i++) this.parts.push({ x: x + rnd(-10, 10), y: y + rnd(-10, 6), vx: 0, vy: -15, g: 0, life: 0.8, t: 0, color, size: 1, star: true });
  }
  queueFx(f) {
    if (this.fxQueue.length > 6) return;
    this.fxQueue.push(f);
  }
  // Replay big drops that happened while away (newest first, a few at most).
  replay(ids) {
    for (const id of ids.slice(-4)) this.queueFx({ tier: ITEMS[id].tier, id, replay: true });
  }

  startFx(f) {
    const it = ITEMS[f.id];
    const dur = [0, 0, 0, 1.4, 2.4, 3.2, 5][f.tier];
    this.fx = { ...f, t: 0, dur };
    const tier = TIERS[f.tier];
    const b = this.el.banner;
    const ic = icon(it.icon, it.color);
    const big = mk(ic.width * 4, ic.height * 4);
    const bctx = big.getContext('2d');
    bctx.imageSmoothingEnabled = false;
    bctx.drawImage(ic, 0, 0, big.width, big.height);
    const hall = this.g.s.hall.find(h => h.id === f.id);
    const extra = f.tier === 6 && hall ? `<small>${new Date(hall.at).toLocaleString('ko-KR')} · ${hall.n.toLocaleString()}번째 시도</small>` : '';
    b.className = 'banner tier' + f.tier;
    b.innerHTML = `<div class="bn-tier" style="color:${tier.color}">${f.replay ? '자리를 비운 사이 · ' : ''}${tier.name}</div>
      <div class="bn-body"><span class="bn-icon"></span><span class="bn-name">${f.text || it.name}</span></div>${extra}`;
    b.querySelector('.bn-icon').appendChild(big);
    b.hidden = true;
    if (f.tier >= 4) { this.shake = this.reduced ? 0 : 0.5; this.flash = 0.2; this.flashColor = tier.color; }
    if (f.tier === 5 && !this.reduced) this.timeScale = 0.3;
    if (f.tier === 6) { this.el.blackout.hidden = false; this.el.blackout.className = 'blackout on'; }
    else this.showBanner();
  }
  showBanner() {
    const b = this.el.banner;
    b.hidden = false;
    b.style.animation = 'none';
    void b.offsetWidth;
    b.style.animation = '';
  }
  updateFx(dt) {
    if (!this.fx && this.fxQueue.length) this.startFx(this.fxQueue.shift());
    const f = this.fx;
    if (!f) return;
    f.t += dt;
    if (f.tier === 5 && f.t > 1) this.timeScale = 1;
    if (f.tier === 6 && f.t > 1.6 && !f.revealed) {
      f.revealed = true;
      this.el.blackout.className = 'blackout reveal';
      this.flash = 0.4;
      this.flashColor = '#ffffff';
      this.showBanner();
      for (let i = 0; i < 40; i++) {
        const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 90;
        this.parts.push({ x: W / 2, y: H / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, life: 1.4, t: 0, color: `hsl(${(i * 37) % 360} 100% 70%)`, size: 2 });
      }
    }
    if (f.t >= f.dur) {
      this.fx = null;
      this.timeScale = 1;
      this.el.banner.hidden = true;
      this.el.blackout.hidden = true;
    }
  }

  // ---------- Background ----------
  layer(theme, hour) {
    const bucket = theme === 'ice' || theme === 'tower' ? 0 : hour >= 20 || hour < 5 ? 1 : hour < 7 ? 2 : hour < 17 ? 3 : 4;
    const key = theme + bucket;
    if (this.layers.has(key)) return this.layers.get(key);
    const T = THEMES[theme];
    const seed = theme.length * 7 + 3;
    // Sky + far mountains (static)
    const sky = mk(W, H);
    const sc = sky.getContext('2d');
    const [top, bot] = skyColors(hour, theme);
    const grd = sc.createLinearGradient(0, 0, 0, GROUND);
    grd.addColorStop(0, top);
    grd.addColorStop(1, bot);
    sc.fillStyle = grd;
    sc.fillRect(0, 0, W, H);
    if (bucket === 1 || theme === 'tower' || theme === 'ice') {
      for (let i = 0; i < 70; i++) {
        sc.fillStyle = noise(i, 3) > 0.8 ? '#ffffff' : '#a8b8ff';
        sc.fillRect(Math.floor(noise(i, 1) * W), Math.floor(noise(i, 2) * 120), 1, 1);
      }
    }
    if (theme === 'ice') {
      // Cave ceiling with icicles
      sc.fillStyle = '#24365a';
      for (let x = 0; x < W; x++) {
        const h = 10 + Math.floor(smooth(x / 9, 5) * 16 + (noise(x, 8) > 0.86 ? 14 : 0));
        sc.fillRect(x, 0, 1, h);
      }
    }
    // Far: wide wrap-around layer (2x width)
    const far = mk(W * 2, H);
    const fc = far.getContext('2d');
    const farCol = bucket === 1 ? shade(T.far, -0.45) : T.far;
    for (let x = 0; x < W * 2; x++) {
      const u = (x / (W * 2)) * 16;
      const h = 60 + smooth(u, seed) * 50 + smooth(u * 3, seed + 1) * 14;
      fc.fillStyle = farCol;
      fc.fillRect(x, GROUND - h, 1, h);
      if (theme === 'ice' || theme === 'meadow') {
        fc.fillStyle = shade(farCol, 0.35);
        fc.fillRect(x, GROUND - h, 1, 2);
      }
    }
    // Mid: hills + decorations + a floating ledge with a rope
    const mid = mk(W * 2, H);
    const mc = mid.getContext('2d');
    const midCol = bucket === 1 ? shade(T.mid, -0.45) : T.mid;
    const mid2 = bucket === 1 ? shade(T.mid2, -0.45) : T.mid2;
    for (let x = 0; x < W * 2; x++) {
      const u = (x / (W * 2)) * 10;
      const h = 22 + smooth(u, seed + 9) * 28;
      mc.fillStyle = midCol;
      mc.fillRect(x, GROUND - h, 1, h);
    }
    for (let i = 0; i < 9; i++) {
      const x = Math.floor(noise(i, seed + 4) * (W * 2 - 30)) + 10;
      this.decor(mc, theme, x, GROUND - 6 - Math.floor(noise(i, 9) * 14), mid2, i);
    }
    // Ledge
    const lx = Math.floor(W * 0.62), ly = 112;
    mc.fillStyle = shade(T.dirt, bucket === 1 ? -0.5 : -0.15);
    mc.fillRect(lx, ly, 86, 10);
    mc.fillStyle = bucket === 1 ? shade(T.top, -0.5) : T.top;
    mc.fillRect(lx, ly, 86, 3);
    mc.fillStyle = OUTLINE;
    mc.fillRect(lx, ly + 10, 86, 1);
    mc.fillStyle = '#c8a86a';
    for (let y = ly + 10; y < GROUND - 2; y += 3) mc.fillRect(lx + 70, y, 1, 2);
    mc.fillStyle = '#5ab45a';
    mc.fillRect(lx + 69, GROUND - 6, 3, 3);
    // Ground strip (tileable)
    const gr = mk(W * 2, H - GROUND);
    const gc = gr.getContext('2d');
    gc.fillStyle = T.dirt;
    gc.fillRect(0, 0, W * 2, H - GROUND);
    for (let i = 0; i < 300; i++) {
      gc.fillStyle = noise(i, 11) > 0.5 ? T.dirtD : shade(T.dirt, 0.15);
      gc.fillRect(Math.floor(noise(i, 12) * W * 2), 6 + Math.floor(noise(i, 13) * (H - GROUND - 6)), 2, 1);
    }
    gc.fillStyle = T.top;
    gc.fillRect(0, 0, W * 2, 4);
    gc.fillStyle = T.topD;
    for (let x = 0; x < W * 2; x += 3) gc.fillRect(x, 4, 2, 1 + (noise(x, 14) > 0.5));
    gc.fillStyle = OUTLINE;
    gc.fillRect(0, 0, W * 2, 1);
    for (let x = 0; x < W * 2; x += 7) if (noise(x, 15) > 0.6) { gc.fillStyle = shade(T.top, 0.25); gc.fillRect(x, 1, 1, 1); }
    const L = { sky, far, mid, ground: gr };
    this.layers.set(key, L);
    return L;
  }

  decor(c, theme, x, y, col, i) {
    c.fillStyle = col;
    if (theme === 'meadow' || theme === 'camp') {
      c.fillStyle = shade(col, -0.25);
      c.fillRect(x + 6, y - 2, 3, 10);
      c.fillStyle = col;
      for (let r = 0; r < 3; r++) circle(c, x + 4 + r * 3, y - 6 - (r % 2) * 3, 6);
    } else if (theme === 'swamp') {
      c.fillRect(x + 5, y - 22, 2, 30);
      c.fillRect(x + 1, y - 16, 5, 2);
      c.fillRect(x + 6, y - 12, 6, 2);
      c.fillRect(x + 1, y - 18, 2, 3);
    } else if (theme === 'ice') {
      for (let k = 0; k < 4; k++) c.fillRect(x + k * 2, y - k * 4, 3, k * 4 + 8);
      c.fillStyle = shade(col, 0.4);
      c.fillRect(x + 2, y - 8, 1, 10);
    } else {
      c.fillRect(x, y - 40, 10, 48);
      c.fillStyle = shade(col, 0.25);
      c.fillRect(x - 2, y - 42, 14, 4);
      c.fillRect(x + 2, y - 30 + (i % 3) * 6, 2, 3);
    }
  }

  drawBackground(ctx, theme, hour, scroll) {
    const L = this.layer(theme, hour);
    ctx.drawImage(L.sky, 0, 0);
    const fx = -((scroll * 0.15) % (W * 2));
    ctx.drawImage(L.far, fx, 0);
    ctx.drawImage(L.far, fx + W * 2, 0);
    const mx = -((scroll * 0.45) % (W * 2));
    ctx.drawImage(L.mid, mx, 0);
    ctx.drawImage(L.mid, mx + W * 2, 0);
    const gx = -(scroll % (W * 2));
    ctx.drawImage(L.ground, gx, GROUND);
    ctx.drawImage(L.ground, gx + W * 2, GROUND);
  }

  weather(ctx, env, theme, w = W, h = H) {
    if (this.reduced) return;
    const t = this.t;
    if (theme === 'swamp') {
      ctx.fillStyle = 'rgba(190,170,230,0.10)';
      for (let i = 0; i < 4; i++) ctx.fillRect(0, 120 + i * 14 + Math.sin(t * 0.6 + i) * 4, w, 8);
      for (let i = 0; i < 10; i++) {
        const fx = (noise(i, 31) * w + t * 6 * (i % 2 ? 1 : -1)) % w;
        ctx.fillStyle = Math.sin(t * 3 + i) > 0 ? '#d8ff6a' : '#8aa848';
        ctx.fillRect((fx + w) % w, 100 + noise(i, 32) * 70 + Math.sin(t + i) * 5, 1, 1);
      }
    }
    if (theme === 'ice' || env.weather === 'snow') {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 40; i++) {
        const x = (noise(i, 21) * w + Math.sin(t + i) * 6 + t * 4) % w;
        const y = (noise(i, 22) * h + t * (10 + (i % 5) * 3)) % h;
        ctx.fillRect(x, y, 1, 1);
      }
    } else if (env.weather === 'rain' && theme !== 'tower') {
      ctx.fillStyle = 'rgba(170,200,255,0.65)';
      for (let i = 0; i < 50; i++) {
        const x = (noise(i, 23) * w - t * 60) % w;
        const y = (noise(i, 24) * h + t * 160) % h;
        ctx.fillRect((x + w) % w, y, 1, 3);
      }
    }
  }

  // ---------- Actors ----------
  drawHero(ctx, x, y, opts = {}) {
    const pal = opts.pal || HERO_PAL;
    const body = sprite('hero', HERO, pal);
    const bob = opts.walk ? Math.round(Math.abs(Math.sin(this.t * 10))) : Math.round(Math.sin(this.t * 3) * 0.5 + 0.5);
    const crouch = opts.crouch ? 2 : 0;
    const flash = opts.hurt;
    const top = y - body.height - bob + crouch;
    if (opts.shadow !== false) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x - 6, y - 1, 13, 2);
    }
    if (opts.crouch) {
      ctx.drawImage(body, 0, 0, body.width, 14, x - 7, top, body.width, 14);
      ctx.drawImage(sprite('heroc', HERO_CROUCH, pal), x - 7, top + 14);
    } else if (opts.walk && Math.sin(this.t * 10) > 0) {
      ctx.drawImage(body, 0, 0, body.width, 14, x - 7, top, body.width, 14);
      ctx.drawImage(sprite('heros', HERO_STEP, pal), x - 7, top + 14);
    } else ctx.drawImage(body, x - 7, top);
    if (flash > 0) {
      ctx.globalAlpha = 0.6;
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = '#ff3a3a';
      ctx.fillRect(x - 7, top, 14, 18);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    if (opts.soot) {
      ctx.fillStyle = 'rgba(40,30,30,0.75)';
      ctx.fillRect(x - 3, top + 4, 8, 5);
    }
    return { hx: x + 4, hy: top + 12 };
  }

  drawTool(ctx, kind, hand, angle, color, flip = false) {
    if (kind === 'bow') return;
    const img = sprite('tool:' + kind, TOOLS[kind], { ...WOOD_PAL, a: color });
    const [px, py] = TOOL_PIVOT[kind];
    drawRotated(ctx, img, hand.hx, hand.hy, px, py, angle, flip);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(hand.hx - 1, hand.hy - 1, 3, 3);
    ctx.fillStyle = HERO_PAL.s;
    ctx.fillRect(hand.hx, hand.hy, 1, 1);
  }

  drawMonster(ctx, mon, x, y, alpha = 1) {
    const M = MONSTERS[mon.key];
    let key = M.sprite;
    if (key === 'bat' && Math.sin(this.t * 14) > 0) key = 'bat2';
    const pal = { ...MON_BASE_PAL[key], ...M.pal };
    if (mon.variant === 'golden') { pal.a = '#ffd34d'; pal.r = '#ffd34d'; }
    if (mon.variant === 'ancient') { pal.a = '#3a2a4a'; pal.r = '#3a2a4a'; pal.e = '#ff3a3a'; }
    const region = this.g.region(mon.f);
    if (region.theme === 'tower' && !mon.variant) { pal.a = shade(pal.a || '#888', -0.45); if (pal.r) pal.r = shade(pal.r, -0.45); }
    const img = sprite('mon:' + key, MON[key], pal);
    const scale = mon.boss || mon.variant === 'giant' || mon.variant === 'ancient' ? 2 : 1;
    const w = img.width * scale, h = img.height * scale;
    const fly = M.fly ? 26 + Math.sin(this.t * 3) * 4 : 0;
    const squash = key === 'slime' ? Math.sin(this.t * 6) * 0.08 : 0;
    const hh = h * (1 - squash);
    const top = y - hh - fly;
    ctx.globalAlpha = alpha;
    if (mon.variant === 'ancient' && !this.reduced) {
      ctx.fillStyle = 'rgba(255,58,90,0.25)';
      circle(ctx, x, top + hh / 2, w * 0.75 + Math.sin(this.t * 5) * 2);
    }
    if (mon.variant === 'golden' && Math.random() < 0.3 && !this.reduced) this.sparkle(x, top + hh / 2, '#ffe066');
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x - w / 2 + 2, y - 1, w - 4, 2);
    ctx.drawImage(img, Math.round(x - w / 2), Math.round(top), w, Math.round(hh));
    if (this.monAnim.hurt > 0) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(Math.round(x - w / 2), Math.round(top), w, Math.round(hh));
      ctx.globalCompositeOperation = 'source-over';
    }
    if (M.crown || mon.boss) {
      const cr = sprite('crown', CROWN, { y: '#ffd34d', r: '#ff3a5a' });
      ctx.drawImage(cr, Math.round(x - cr.width), Math.round(top - 7), cr.width * 2, cr.height * 2);
    }
    ctx.globalAlpha = 1;
    return { top, w };
  }

  // ---------- Life-skill stations ----------
  // Draws the actor working at a station. hx = actor x, gy = ground y.
  drawStation(ctx, k, hx, gy, slot, opts = {}) {
    const s = this.g.s;
    const v = this.vis(slot);
    const t = this.t;
    const since = t - v.last;
    const sl = s.slots[slot];
    const p = sl ? sl.p : 0;
    const lv = s.skills[k].lv;
    const tc = TOOL_TIERS[toolTier(lv)].color;
    const pal = opts.pal;
    const nx = hx + 24;
    const hit = since < 0.25;
    switch (k) {
      case 'mining': {
        const spot = s.spots.mining || 0;
        const ore = ITEMS[['m_copper', 'm_iron', 'm_silver', 'm_mithril', 'm_adamant'][Math.min(spot, 4)]].color;
        rock(ctx, nx + (hit ? rnd(-1, 1) : 0), gy, ore, hit);
        const ang = swingAngle(p);
        const hand = this.drawHero(ctx, hx, gy, { pal });
        this.drawTool(ctx, 'pick', hand, ang, tc);
        if (hit && since < 0.05 && !this.reduced) this.burst(nx - 6, gy - 10, ore, 5);
        break;
      }
      case 'wood': {
        const shake = hit ? Math.sin(since * 60) * 2 : 0;
        tree(ctx, nx + 4, gy, shake, ['#3f9a4a', '#e8d8a8', '#5a7a3a', '#6a8cff', '#8fe07a'][Math.min(s.spots.wood || 0, 4)]);
        const hand = this.drawHero(ctx, hx, gy, { pal });
        this.drawTool(ctx, 'axe', hand, swingAngle(p) * 0.9 + 0.3, tc);
        if (hit && since < 0.05 && !this.reduced) this.burst(nx + 2, gy - 18, '#5ab45a', 4);
        break;
      }
      case 'forage': {
        bush(ctx, nx - 4, gy, ITEMS[SPOT_ITEM.forage[Math.min(s.spots.forage || 0, 4)]].color, hit);
        const hand = this.drawHero(ctx, hx, gy, { pal, crouch: true });
        this.drawTool(ctx, 'sickle', hand, 1.2 + Math.sin(p * Math.PI * 2) * 0.5, tc);
        if (hit && since < 0.05 && !this.reduced) this.burst(nx - 4, gy - 6, '#7ad85a', 4);
        break;
      }
      case 'fish': {
        water(ctx, hx + 14, gy, opts.w || W, t);
        const hand = this.drawHero(ctx, hx, gy, { pal });
        const bite = p > 0.8;
        const ang = hit ? -0.2 : 0.75 + (bite ? Math.sin(t * 30) * 0.06 : 0);
        this.drawTool(ctx, 'rod', hand, ang, tc);
        const tipX = hand.hx + Math.sin(ang) * 11, tipY = hand.hy - Math.cos(ang) * 11;
        const bx = hx + 52, by = gy + 4 + (bite ? Math.round(Math.sin(t * 25)) * 2 : Math.round(Math.sin(t * 2)));
        if (!hit) {
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          line(ctx, tipX, tipY, bx, by);
          ctx.fillStyle = '#ff3a3a';
          ctx.fillRect(bx - 1, by - 2, 3, 2);
          ctx.fillStyle = '#fff';
          ctx.fillRect(bx - 1, by, 3, 1);
          if (lv >= 250 && bite) { ctx.fillStyle = 'rgba(255,220,90,0.45)'; ctx.fillRect(bx - 6, by + 4, 12, 3); }
        } else if (since < 0.05 && !this.reduced) this.burst(bx, gy + 4, '#bfe6ff', 6);
        break;
      }
      case 'hunt': {
        if (!v.animal) v.animal = { kind: (s.spots.hunt || 0) >= 1 ? 'deer' : 'rabbit' };
        const ax = lerp((opts.w || W) + 10, hx + 70, Math.min(1, p / 0.6));
        const animal = sprite('an:' + v.animal.kind, ANIMALS[v.animal.kind], { a: v.animal.kind === 'deer' ? '#c8885a' : '#efe6d8', y: '#e8d8b8', r: '#ff9aa8' });
        if (!hit) {
          ctx.save();
          ctx.translate(Math.round(ax + animal.width / 2), 0);
          ctx.scale(-1, 1);
          ctx.drawImage(animal, -Math.round(animal.width / 2), gy - animal.height);
          ctx.restore();
        } else if (since < 0.05 && !this.reduced) this.burst(hx + 72, gy - 6, '#e8dcc8', 6);
        this.drawHero(ctx, hx, gy, { pal, crouch: true });
        const draw = p > 0.6 ? Math.min(1, (p - 0.6) / 0.35) : 0;
        const bow = sprite('bow', BOW, { a: tc });
        ctx.drawImage(bow, hx + 5, gy - 18);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(hx + 6 - Math.round(draw * 3), gy - 17, 1, 8);
        if (draw > 0 && !hit) { ctx.fillStyle = '#c8a86a'; ctx.fillRect(hx + 3 - Math.round(draw * 3), gy - 13, 10, 1); }
        if (since < 0.3) {
          const ax2 = lerp(hx + 12, hx + 72, Math.min(1, since / 0.18));
          ctx.fillStyle = '#c8a86a';
          ctx.fillRect(ax2, gy - 13, 8, 1);
          ctx.fillStyle = '#fff';
          ctx.fillRect(ax2 + 7, gy - 14, 2, 3);
        }
        bush(ctx, hx + 10, gy, '#5ab45a', false, true);
        break;
      }
      case 'alchemy': {
        const r = s.recipe;
        const liquid = v.kind === 'fail' && since < 1.2 ? '#4a4a4a' : ITEMS[r] ? ITEMS[r].color : '#7ad8ff';
        cauldron(ctx, nx + 2, gy, liquid, t, (v.kind === 'great' || v.kind === 'miracle') && since < 1.5);
        const hand = this.drawHero(ctx, hx, gy, { pal, soot: slot === 0 && this.soot > 0 });
        this.drawTool(ctx, 'ladle', hand, 1.4 + Math.sin(t * 4) * 0.35, tc);
        if (v.kind === 'fail' && since < 0.05 && !this.reduced) {
          for (let i = 0; i < 14; i++) this.parts.push({ x: nx + 2, y: gy - 16, vx: rnd(-40, 40), vy: rnd(-70, -20), g: 30, life: 1, t: 0, color: '#6a6a6a', size: 3 });
        }
        if (sl && sl.blocked && Math.sin(t * 4) > 0) drawText(ctx, '!', nx + 2, gy - 34, '#ff5a5a', 2);
        break;
      }
    }
  }

  // ---------- Frame ----------
  frame(dtReal) {
    const dt = dtReal * this.timeScale;
    this.t += dt;
    const ctx = this.ctx;
    const g = this.g, s = g.s, c = s.char;
    ctx.imageSmoothingEnabled = false;
    if (this.lastMode !== s.mode) { this.modeFade = 0.35; this.lastMode = s.mode; }
    const env = g.env;
    const region = g.region(c.floor);
    const camp = s.mode === 'camp';
    const theme = camp ? 'camp' : region.theme;
    const mon = g.mon;
    const walking = !camp && (!mon || mon.approach > 0);
    if (walking && !this.reduced) this.scroll += dt * 40;

    ctx.save();
    if (this.shake > 0) ctx.translate(Math.round(rnd(-2, 2)), Math.round(rnd(-2, 2)));
    this.drawBackground(ctx, theme, env.hour, this.scroll);

    if (camp) this.drawCamp(ctx, env);
    else this.drawFight(ctx, mon, walking);

    this.drawPops(ctx, dt);
    this.drawParts(ctx, dt);
    this.drawFloaters(ctx, dt);
    this.weather(ctx, env, theme);
    if (env.night && theme !== 'ice' && theme !== 'tower') {
      ctx.fillStyle = 'rgba(20,24,70,0.28)';
      ctx.fillRect(0, 0, W, H);
      if (camp) { // fire light
        const grd = ctx.createRadialGradient(54, 168, 4, 54, 168, 90);
        grd.addColorStop(0, 'rgba(255,170,80,0.35)');
        grd.addColorStop(1, 'rgba(255,170,80,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 60, 200, 156);
      }
    }
    if (this.flash > 0) {
      ctx.globalAlpha = Math.min(0.7, this.flash * 3);
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    if (this.modeFade > 0) {
      ctx.globalAlpha = Math.min(1, this.modeFade * 3);
      ctx.fillStyle = '#0c0a14';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // timers
    this.shake = Math.max(0, this.shake - dtReal);
    this.flash = Math.max(0, this.flash - dtReal);
    this.modeFade = Math.max(0, this.modeFade - dtReal);
    this.soot = Math.max(0, this.soot - dtReal);
    for (const k in this.heroAnim) this.heroAnim[k] = Math.max(0, this.heroAnim[k] - dt);
    this.monAnim.hurt = Math.max(0, this.monAnim.hurt - dt);
    this.monAnim.dying = Math.max(0, this.monAnim.dying - dt);
    this.updateFx(dtReal);

    // overlay positions
    this.place(this.el.name, 157, GROUND + 3);
    this.place(this.el.bubble, 157, 112);
    this.renderClones(dt);
  }

  // Background monsters of the current region that wander around (decoration only).
  drawAmbient(ctx, region) {
    if (!this.ambient || this.ambient.region !== region.name) {
      const mobs = region.mobs;
      this.ambient = {
        region: region.name,
        list: [0, 1, 2, 3].map(i => ({ key: mobs[i % mobs.length], x: 250 + i * 70, ledge: i === 1, dir: i % 2 ? 1 : -1, ph: i * 1.7 })),
      };
    }
    for (const a of this.ambient.list) {
      const M = MONSTERS[a.key];
      let key = M.sprite;
      if (key === 'bat' && Math.sin(this.t * 14 + a.ph) > 0) key = 'bat2';
      const pal = { ...MON_BASE_PAL[key], ...M.pal };
      if (region.theme === 'tower') { pal.a = shade(pal.a || '#888', -0.45); if (pal.r) pal.r = shade(pal.r, -0.45); }
      const img = sprite('mon:' + key, MON[key], pal);
      const lx = a.ledge ? 246 : 0;
      const range = a.ledge ? [lx + 8, lx + 70] : [262, W + 40];
      a.x += a.dir * 6 * (1 / 60);
      if (a.x < range[0] || a.x > range[1]) a.dir *= -1;
      const sx = a.ledge ? a.x : ((a.x - this.scroll * 0.0) % (W + 80) + W + 80) % (W + 80) - 20;
      const gy = a.ledge ? 112 : GROUND - 1;
      const hop = Math.max(0, Math.sin(this.t * 4 + a.ph)) * 2 + (M.fly ? 30 : 0);
      ctx.globalAlpha = 0.9;
      ctx.save();
      if (a.dir > 0) { ctx.translate(Math.round(sx), 0); ctx.scale(-1, 1); ctx.drawImage(img, -Math.round(img.width / 2), Math.round(gy - img.height - hop)); }
      else ctx.drawImage(img, Math.round(sx - img.width / 2), Math.round(gy - img.height - hop));
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  drawFight(ctx, mon, walking) {
    const g = this.g, c = g.s.char;
    this.drawAmbient(ctx, g.region(c.floor));
    const hurt = this.heroAnim.hurt;
    const hand = this.drawHero(ctx, 157, GROUND, { walk: walking, hurt });
    const sw = this.heroAnim.swing;
    const ang = sw > 0 ? lerp(1.9, -0.9, sw / 0.22) : 0.5 + Math.sin(this.t * 3) * 0.05;
    const wt = c.gear.weapon ? c.gear.weapon.tier : 0;
    this.drawTool(ctx, 'sword', hand, ang, GEAR_COLORS[wt]);
    if (sw > 0.12 && !this.reduced) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (let i = 0; i < 5; i++) ctx.fillRect(hand.hx + 6 + i * 2, hand.hy - 14 + i * 3, 2, 2);
    }
    const nameEl = this.el.mon;
    if (mon) {
      const x = 236 + (mon.approach > 0 ? (mon.approach / 0.8) * 150 : 0) + (this.monAnim.hurt > 0 ? 3 : 0);
      const { top } = this.drawMonster(ctx, mon, x, GROUND);
      const bw = 26, frac = Math.max(0, mon.hp / mon.maxHp);
      const by = Math.round(top - (mon.boss ? 12 : 6));
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(Math.round(x - bw / 2) - 1, by - 1, bw + 2, 4);
      ctx.fillStyle = '#4a1a24';
      ctx.fillRect(Math.round(x - bw / 2), by, bw, 2);
      ctx.fillStyle = mon.boss ? '#ff5a8a' : '#ff5a5a';
      ctx.fillRect(Math.round(x - bw / 2), by, Math.round(bw * frac), 2);
      nameEl.hidden = false;
      nameEl.textContent = (mon.boss ? '👑 ' : '') + mon.name;
      nameEl.className = 'monname' + (mon.variant ? ' v-' + mon.variant : '') + (mon.boss ? ' boss' : '');
      this.place(nameEl, x, by - 2);
    } else nameEl.hidden = true;
    if (this.monAnim.dying > 0 && this.monAnim.last) {
      this.drawMonster(ctx, this.monAnim.last, 236, GROUND + (0.35 - this.monAnim.dying) * 20, this.monAnim.dying / 0.35);
    }
  }

  drawCamp(ctx, env) {
    this.el.mon.hidden = true;
    tent(ctx, 26, GROUND);
    campfire(ctx, 54, GROUND, this.t);
    if (!this.reduced && Math.random() < 0.25) this.parts.push({ x: 54 + rnd(-2, 2), y: GROUND - 10, vx: rnd(-4, 4), vy: -18, g: 0, life: 1.2, t: 0, color: Math.random() < 0.5 ? '#ffb84a' : '#ff6a3a', size: 1 });
    const k = this.g.s.slots[0].k;
    this.drawStation(ctx, k, 157, GROUND, 0, { w: W });
  }

  drawPops(ctx, dt) {
    for (const p of this.pops) {
      p.t += dt;
      const f = Math.min(1, p.t / 0.7);
      const x = lerp(p.x, p.tx, f), y = p.y - 26 * Math.sin(f * Math.PI) - f * 6;
      const it = ITEMS[p.id];
      ctx.globalAlpha = 1 - Math.max(0, (p.t - 0.6) / 0.3);
      ctx.drawImage(icon(it.icon, it.color), Math.round(x - 6), Math.round(y - 12));
      if (p.t < 0.6 && it.tier >= 1) {
        ctx.fillStyle = TIERS[it.tier].color;
        ctx.fillRect(Math.round(x - 1), Math.round(y - 15), 2, 2);
      }
      ctx.globalAlpha = 1;
    }
    this.pops = this.pops.filter(p => p.t < 0.9);
  }
  drawParts(ctx, dt) {
    for (const p of this.parts) {
      p.t += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color;
      if (p.star) { ctx.fillRect(Math.round(p.x), Math.round(p.y) - 1, 1, 3); ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y), 3, 1); }
      else ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    this.parts = this.parts.filter(p => p.t < p.life);
    if (this.parts.length > 400) this.parts.splice(0, this.parts.length - 400);
  }
  drawFloaters(ctx, dt) {
    for (const f of this.floaters) {
      f.t += dt;
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, f.t - f.life * 0.6) / (f.life * 0.4));
      drawText(ctx, f.text, f.x, f.y - f.t * 22, f.color, f.scale);
    }
    ctx.globalAlpha = 1;
    this.floaters = this.floaters.filter(f => f.t < f.life);
  }

  // Small canvases showing clones working at their own stations.
  setCloneCanvases(list) { this.clones = list; }
  renderClones() {
    const s = this.g.s;
    this.clones.forEach((cv, i) => {
      const slot = i + 1;
      if (!s.slots[slot]) return;
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      const w = cv.width, h = cv.height, gy = h - 14;
      const k = s.slots[slot].k;
      const [top, bot] = skyColors(this.g.env.hour, 'camp');
      const grd = ctx.createLinearGradient(0, 0, 0, gy);
      grd.addColorStop(0, top);
      grd.addColorStop(1, bot);
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#4a8a5a';
      for (let x = 0; x < w; x++) ctx.fillRect(x, gy - 10 - Math.floor(smooth(x / 18, 7 + slot) * 14), 1, 30);
      ctx.fillStyle = '#9a6a3a';
      ctx.fillRect(0, gy, w, h - gy);
      ctx.fillStyle = '#5ac04a';
      ctx.fillRect(0, gy, w, 3);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(0, gy, w, 1);
      this.drawStation(ctx, k, 40, gy, slot, { pal: CLONE_PAL, w });
      const v = this.vis(slot);
      if (v.pop) {
        v.pop.t += 1 / 60;
        const it = ITEMS[v.pop.id];
        if (it && v.pop.t < 0.8) {
          ctx.globalAlpha = 1 - v.pop.t / 0.8;
          ctx.drawImage(icon(it.icon, it.color), 58, gy - 34 - v.pop.t * 14);
          ctx.globalAlpha = 1;
        } else v.pop = null;
      }
    });
  }
}

const SPOT_ITEM = { forage: ['f_dandelion', 'f_berry', 'f_firefly', 'f_poppy', 'f_fairyshroom'] };

// ---------- Primitive pixel shapes ----------
function rnd(a, b) { return a + Math.random() * (b - a); }
function circle(ctx, cx, cy, r) {
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
}
function ellipse(ctx, cx, cy, rx, ry) {
  for (let y = -ry; y <= ry; y++) {
    const w = Math.floor(rx * Math.sqrt(1 - (y * y) / (ry * ry)));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
}
function line(ctx, x0, y0, x1, y1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let i = 0; i < 400; i++) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function swingAngle(p) {
  // Raise slowly, strike fast near the end of each action.
  if (p < 0.75) return lerp(0.6, -1.4, p / 0.75);
  return lerp(-1.4, 1.5, (p - 0.75) / 0.25);
}
function rock(ctx, x, gy, ore, hit) {
  ctx.fillStyle = OUTLINE;
  ellipse(ctx, x, gy - 8, 13, 9);
  ctx.fillStyle = hit ? '#b8b8c4' : '#8a8a96';
  ellipse(ctx, x, gy - 8, 12, 8);
  ctx.fillStyle = '#6a6a76';
  ctx.fillRect(x - 10, gy - 4, 21, 3);
  ctx.fillStyle = '#a8a8b4';
  ctx.fillRect(x - 6, gy - 14, 6, 2);
  ctx.fillStyle = ore;
  for (const [dx, dy] of [[-5, -8], [3, -11], [6, -5], [-1, -4], [8, -9]]) ctx.fillRect(x + dx, gy + dy, 2, 2);
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + 3, gy - 11, 1, 1);
}
function tree(ctx, x, gy, shake, leaf) {
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(x - 4, gy - 30, 9, 30);
  ctx.fillStyle = '#8a5a2e';
  ctx.fillRect(x - 3, gy - 30, 7, 30);
  ctx.fillStyle = '#6a4424';
  ctx.fillRect(x - 1, gy - 26, 1, 20);
  ctx.fillStyle = '#e8c88a';
  ctx.fillRect(x - 3, gy - 12, 2, 4);
  const sx = Math.round(shake);
  ctx.fillStyle = OUTLINE;
  circle(ctx, x + sx, gy - 42, 15);
  circle(ctx, x - 9 + sx, gy - 34, 10);
  circle(ctx, x + 10 + sx, gy - 34, 10);
  ctx.fillStyle = leaf;
  circle(ctx, x + sx, gy - 42, 14);
  circle(ctx, x - 9 + sx, gy - 34, 9);
  circle(ctx, x + 10 + sx, gy - 34, 9);
  ctx.fillStyle = shade(leaf, 0.3);
  circle(ctx, x - 4 + sx, gy - 47, 5);
}
function bush(ctx, x, gy, flower, hit, front) {
  ctx.fillStyle = OUTLINE;
  circle(ctx, x, gy - 6, 8);
  circle(ctx, x - 6, gy - 3, 6);
  circle(ctx, x + 6, gy - 3, 6);
  ctx.fillStyle = front ? '#3f8a3f' : hit ? '#7ad86a' : '#4caf50';
  circle(ctx, x, gy - 6, 7);
  circle(ctx, x - 6, gy - 3, 5);
  circle(ctx, x + 6, gy - 3, 5);
  if (!front) {
    ctx.fillStyle = flower;
    for (const [dx, dy] of [[-4, -9], [3, -11], [6, -5], [-7, -4]]) ctx.fillRect(x + dx, gy + dy, 2, 2);
  }
}
function water(ctx, x, gy, w, t) {
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(x, gy, w - x, 1);
  ctx.fillStyle = '#3a7ad8';
  ctx.fillRect(x, gy + 1, w - x, H);
  ctx.fillStyle = '#5a9ae8';
  ctx.fillRect(x, gy + 1, w - x, 2);
  ctx.fillStyle = '#bfe6ff';
  for (let i = 0; i < 12; i++) {
    const wx = x + ((i * 37 + t * 8) % Math.max(1, w - x));
    ctx.fillRect(Math.round(wx), gy + 6 + (i % 4) * 5, 4, 1);
  }
  ctx.fillStyle = '#8a5a2e';
  ctx.fillRect(x - 2, gy - 1, 18, 3);
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(x - 2, gy + 2, 18, 1);
  ctx.fillRect(x + 2, gy + 3, 2, 8);
  ctx.fillRect(x + 12, gy + 3, 2, 8);
}
function cauldron(ctx, x, gy, liquid, t, rainbow) {
  ctx.fillStyle = OUTLINE;
  ellipse(ctx, x, gy - 9, 13, 10);
  ctx.fillStyle = '#3a3a48';
  ellipse(ctx, x, gy - 9, 12, 9);
  ctx.fillStyle = '#5a5a6a';
  ctx.fillRect(x - 9, gy - 12, 3, 6);
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(x - 13, gy - 18, 27, 4);
  ctx.fillStyle = rainbow ? `hsl(${(t * 300) % 360} 90% 60%)` : liquid;
  ctx.fillRect(x - 12, gy - 17, 25, 2);
  for (let i = 0; i < 3; i++) {
    const by = gy - 20 - ((t * 14 + i * 7) % 18);
    ctx.globalAlpha = 0.8;
    ctx.fillRect(x - 6 + i * 6, Math.round(by), 2, 2);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = '#ff8a2a';
  ctx.fillRect(x - 6, gy - 1, 3, 1);
  ctx.fillRect(x + 3, gy - 1, 3, 1);
}
function tent(ctx, x, gy) {
  ctx.fillStyle = OUTLINE;
  for (let i = 0; i < 26; i++) ctx.fillRect(x - i, gy - 26 + i, i * 2 + 1, 1);
  ctx.fillStyle = '#c8433b';
  for (let i = 1; i < 25; i++) ctx.fillRect(x - i + 1, gy - 26 + i, i * 2 - 1, 1);
  ctx.fillStyle = '#8a2a2a';
  for (let i = 6; i < 25; i++) ctx.fillRect(x - 2, gy - 26 + i, 5, 1);
  ctx.fillStyle = '#ffd34d';
  ctx.fillRect(x, gy - 26, 1, 3);
}
function campfire(ctx, x, gy, t) {
  ctx.fillStyle = '#6a4424';
  ctx.fillRect(x - 8, gy - 3, 16, 3);
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(x - 8, gy - 1, 16, 1);
  const f = Math.sin(t * 12) * 1.5;
  ctx.fillStyle = '#ff6a3a';
  ellipse(ctx, x, gy - 8, 5, 6 + Math.round(f));
  ctx.fillStyle = '#ffb84a';
  ellipse(ctx, x, gy - 6, 3, 4 + Math.round(f / 2));
  ctx.fillStyle = '#fff2a8';
  ctx.fillRect(x - 1, gy - 6, 2, 3);
  ctx.fillStyle = '#8a8a96';
  for (const dx of [-10, -6, 6, 10]) ctx.fillRect(x + dx - 1, gy - 2, 3, 2);
}

export function fmtShort(n) {
  if (!isFinite(n)) return '∞';
  const a = Math.abs(n);
  if (a < 1000) return String(Math.round(n));
  const u = ['K', 'M', 'B', 'T'];
  let i = -1, v = a;
  while (v >= 1000 && i < u.length - 1) { v /= 1000; i++; }
  if (v >= 1000) return n.toExponential(1).replace('e+', 'E');
  return (n < 0 ? '-' : '') + (v < 10 ? v.toFixed(1) : Math.round(v)) + u[i];
}
