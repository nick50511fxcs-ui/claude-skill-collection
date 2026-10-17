// Canvas renderer: parallax backgrounds, the battle scene, the campfire scene with
// animated life-skill stations, clone insets, floaters and rare-drop effects.
import {
  sprite, drawRotated, drawText, icon, shade, OUTLINE, silhouette, HERO, HERO_STEP, HERO_CROUCH, HERO_PAL, CLONE_PAL,
  MON, MON_BASE_PAL, CROWN, ANIMALS, TOOLS, TOOL_PIVOT, TOOL_FOR, WOOD_PAL, BOW,
} from './sprites.js';
import { ITEMS, TIERS, MONSTERS, TOOL_TIERS, REGIONS, SPOTS } from './data.js';
import { toolTier, spotsUnlocked } from './engine.js';

export const W = 384, H = 216, GROUND = 178;
// Duel positions: hero and monster face each other close up.
const HX = 162, MX = 224;
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
    this.heroAnim = { swing: 0, hurt: 0, levelUp: 0, dodge: 0 };
    this.monAnim = { hurt: 0, dying: 0, last: null, atk: 0 };
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
      <div class="bossbar" id="bossBar" hidden><div class="bb-name" id="bossName"></div><div class="bb-track"><i id="bossFill"></i></div></div>
      <div class="bosswarn" id="bossWarn" hidden></div>
      <div class="blackout" id="blackout" hidden></div>`;
    this.el = {
      name: this.ov.querySelector('#nameTag'), title: this.ov.querySelector('#titleBadge'),
      mon: this.ov.querySelector('#monName'), bubble: this.ov.querySelector('#bubble'),
      banner: this.ov.querySelector('#banner'), blackout: this.ov.querySelector('#blackout'),
      bossBar: this.ov.querySelector('#bossBar'), bossName: this.ov.querySelector('#bossName'),
      bossFill: this.ov.querySelector('#bossFill'), bossWarn: this.ov.querySelector('#bossWarn'),
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
            this.floater(fmtShort(e.dmg) + (e.crit ? '!' : ''), MX + rnd(-8, 8), 136 + rnd(-6, 4), e.crit ? '#ff6ad5' : '#fff2a8', e.crit ? 2 : 1);
            if (e.crit && !this.reduced) this.shake = Math.max(this.shake, 0.12);
          } else {
            this.heroAnim.hurt = 0.2;
            this.floater('-' + fmtShort(e.dmg) + (e.slam ? '!' : ''), HX + rnd(-4, 4), 132, '#ff5a5a', e.slam ? 2 : 1);
            this.monAnim.atk = 0.28;
            if (e.slam && !this.reduced) { this.shake = Math.max(this.shake, 0.35); this.flash = 0.12; this.flashColor = '#ff3a3a'; }
          }
          break;
        case 'miss': this.floater('MISS', HX, 130, '#a8d8ff', 1); this.monAnim.atk = 0.28; this.heroAnim.dodge = 0.3; break;
        case 'spawn':
          if (e.mon.boss || e.mon.elite) this.bossIntro(e.mon);
          break;
        case 'kill':
          this.monAnim.dying = 0.35;
          this.monAnim.last = e.mon;
          this.burst(MX, 160, MON_BASE_PAL[MONSTERS[e.mon.key].sprite]?.a || '#fff', 10);
          this.floater('+' + fmtShort(e.gold) + 'g', MX, 124, '#ffd34d', 1);
          break;
        case 'lv':
          this.heroAnim.levelUp = 1.2;
          this.floater('LV UP', this.g.s.mode === 'camp' ? 157 : HX, 114, '#ffe066', 2);
          this.ring(this.g.s.mode === 'camp' ? 157 : HX, 168, '#ffe066');
          break;
        case 'drop':
          if (e.src === 'combat') this.pop(e.id, MX, 160);
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

  bossIntro(mon) {
    const w = this.el.bossWarn;
    w.className = 'bosswarn' + (mon.boss ? ' boss' : ' elite');
    w.innerHTML = `<b>${mon.boss ? 'WARNING · BOSS' : '정예 몬스터'}</b><span>${mon.f}층 · ${mon.name}</span>`;
    w.hidden = false;
    w.style.animation = 'none';
    void w.offsetWidth;
    w.style.animation = '';
    clearTimeout(this.warnT);
    this.warnT = setTimeout(() => { w.hidden = true; }, mon.boss ? 2600 : 1800);
    if (mon.boss && !this.reduced) { this.shake = 0.45; this.flash = 0.2; this.flashColor = '#ff2a4a'; }
    this.say(mon.boss ? '저 녀석… 보통이 아니야!' : '조금 강해 보이는데?', 2400);
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
    this.pops.push({ id, x, y, tx: this.g.s.mode === 'camp' ? 157 : HX, t: 0, n });
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

  location(k, spot, hour) {
    const indoor = isIndoor(k, spot);
    const key = `loc:${k}:${spot}:${indoor ? 0 : skyBucket(hour)}`;
    if (this.layers.has(key)) return this.layers.get(key);
    const c = mk(W, H);
    const x = c.getContext('2d');
    LOCS[k](x, spot, hour);
    this.layers.set(key, c);
    return c;
  }
  campSpot(k) {
    const s = this.g.s;
    return SPOTS[k] ? Math.min(s.spots[k] || 0, spotsUnlocked(s.skills[k].lv) - 1) : 0;
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
    if (this.reduced || theme === 'indoor') return;
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
      ctx.globalAlpha = 0.65;
      ctx.drawImage(silhouette(body, '#ff4a4a'), x - 7, top);
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
    const scale = mon.boss ? M.scale || 2 : mon.variant === 'giant' || mon.variant === 'ancient' ? 2 : 1;
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
    if ((mon.boss || mon.elite) && !this.reduced) {
      ctx.globalAlpha = 0.18 + 0.08 * Math.sin(this.t * 4);
      ctx.fillStyle = mon.boss ? '#ff2a4a' : '#ffb84a';
      circle(ctx, x, top + hh / 2, Math.max(w, hh) * 0.62);
      ctx.globalAlpha = alpha;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x - w / 2 + 2, y - 1, w - 4, 2);
    ctx.drawImage(img, Math.round(x - w / 2), Math.round(top), w, Math.round(hh));
    if (this.monAnim.hurt > 0 && alpha > 0) {
      ctx.globalAlpha = 0.7 * alpha;
      ctx.drawImage(silhouette(img, '#ffffff'), Math.round(x - w / 2), Math.round(top), w, Math.round(hh));
      ctx.globalAlpha = alpha;
    }
    if ((M.crown && mon.boss) || mon.elite) {
      const cr = sprite('crown', CROWN, { y: mon.elite ? '#c8ccd8' : '#ffd34d', r: '#ff3a5a' });
      const cs = mon.elite ? 1 : 2;
      ctx.drawImage(cr, Math.round(x - (cr.width * cs) / 2), Math.round(top - 4 * cs), cr.width * cs, cr.height * cs);
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
    const fx = !opts.mini && !this.reduced;
    const spot = SPOTS[k] ? Math.min(s.spots[k] || 0, spotsUnlocked(lv) - 1) : 0;
    switch (k) {
      case 'mining': {
        rock(ctx, nx + (hit ? rnd(-1, 1) : 0), gy, spot, hit, t);
        const hand = this.drawHero(ctx, hx, gy, { pal });
        this.drawTool(ctx, 'pick', hand, swingAngle(p), tc);
        if (hit && since < 0.05 && fx) this.burst(nx - 6, gy - 10, ROCK_ORE[spot], 5 + spot * 2);
        break;
      }
      case 'wood': {
        const shake = hit ? Math.sin(since * 60) * 2 : 0;
        tree(ctx, nx + 6, gy, shake, spot, t);
        const hand = this.drawHero(ctx, hx, gy, { pal });
        this.drawTool(ctx, 'axe', hand, swingAngle(p) * 0.9 + 0.3, tc);
        if (hit && since < 0.05 && fx) this.burst(nx + 2, gy - 20, TREES[spot].leaf, 4 + spot * 2);
        break;
      }
      case 'forage': {
        bush(ctx, nx - 2, gy, spot, hit, t, false);
        const hand = this.drawHero(ctx, hx, gy, { pal, crouch: true });
        this.drawTool(ctx, 'sickle', hand, 1.2 + Math.sin(p * Math.PI * 2) * 0.5, tc);
        if (hit && since < 0.05 && fx) this.burst(nx - 4, gy - 6, BUSH_SPARK[spot], 4 + spot * 2);
        break;
      }
      case 'fish': {
        water(ctx, hx + 14, gy, opts.w || W, t, spot);
        const hand = this.drawHero(ctx, hx, gy, { pal });
        const bite = p > 0.8;
        const ang = hit ? -0.2 : 0.75 + (bite ? Math.sin(t * 30) * 0.06 : 0);
        this.drawTool(ctx, 'rod', hand, ang, tc);
        const tipX = hand.hx + Math.sin(ang) * 11, tipY = hand.hy - Math.cos(ang) * 11;
        const bx = hx + 52, by = gy + 4 + (bite ? Math.round(Math.sin(t * 25)) * 2 : Math.round(Math.sin(t * 2)));
        if (!hit) {
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          line(ctx, tipX, tipY, bx, by);
          ctx.fillStyle = spot === 4 ? '#7affe8' : '#ff3a3a';
          ctx.fillRect(bx - 1, by - 2, 3, 2);
          ctx.fillStyle = '#fff';
          ctx.fillRect(bx - 1, by, 3, 1);
          if (lv >= 250 && bite) { ctx.fillStyle = 'rgba(255,220,90,0.45)'; ctx.fillRect(bx - 6, by + 4, 12, 3); }
        } else if (since < 0.05 && fx) this.burst(bx, gy + 4, spot === 4 ? '#7affe8' : '#bfe6ff', 6 + spot * 2);
        break;
      }
      case 'hunt': {
        const kind = ANIMAL_BY_SPOT[spot];
        if (!v.animal || v.animal.kind !== kind) v.animal = { kind };
        huntGround(ctx, hx, gy, opts.w || W, spot, t);
        const ax = lerp((opts.w || W) + 10, hx + 70, Math.min(1, p / 0.6));
        const animal = sprite('an:' + kind, ANIMALS[kind], ANIMAL_PAL[kind]);
        if (!hit) {
          if (spot === 4) { ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 4); ctx.fillStyle = '#ffe8ff'; circle(ctx, ax + animal.width / 2, gy - animal.height / 2, animal.width * 0.7); ctx.globalAlpha = 1; }
          ctx.save();
          ctx.translate(Math.round(ax + animal.width / 2), 0);
          ctx.scale(-1, 1);
          ctx.drawImage(animal, -Math.round(animal.width / 2), gy - animal.height);
          ctx.restore();
        } else if (since < 0.05 && fx) this.burst(hx + 72, gy - 6, ANIMAL_PAL[kind].a, 6 + spot * 2);
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
        bush(ctx, hx + 10, gy, 0, false, t, true);
        break;
      }
      case 'alchemy': {
        const r = s.recipe;
        const liquid = v.kind === 'fail' && since < 1.2 ? '#4a4a4a' : ITEMS[r] ? ITEMS[r].color : '#7ad8ff';
        cauldron(ctx, nx + 2, gy, liquid, t, (v.kind === 'great' || v.kind === 'miracle') && since < 1.5, toolTier(lv));
        const hand = this.drawHero(ctx, hx, gy, { pal, soot: slot === 0 && this.soot > 0 });
        this.drawTool(ctx, 'ladle', hand, 1.4 + Math.sin(t * 4) * 0.35, tc);
        if (v.kind === 'fail' && since < 0.05 && fx) {
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
    const campK = s.slots[0].k, campSp = this.campSpot(campK);
    const theme = camp ? (isIndoor(campK, campSp) ? 'indoor' : 'camp') : region.theme;
    const mon = g.mon;
    const walking = !camp && (!mon || mon.approach > 0);
    if (walking && !this.reduced) this.scroll += dt * 40;

    ctx.save();
    if (this.shake > 0) ctx.translate(Math.round(rnd(-2, 2)), Math.round(rnd(-2, 2)));
    if (camp) ctx.drawImage(this.location(campK, campSp, env.hour), 0, 0);
    else this.drawBackground(ctx, theme, env.hour, this.scroll);

    if (camp) this.drawCamp(ctx, env);
    else this.drawFight(ctx, mon, walking);

    this.drawPops(ctx, dt);
    this.drawParts(ctx, dt);
    this.drawFloaters(ctx, dt);
    this.weather(ctx, env, theme);
    if (env.night && theme !== 'ice' && theme !== 'tower' && theme !== 'indoor') {
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
    this.monAnim.atk = Math.max(0, this.monAnim.atk - dt);
    this.updateFx(dtReal);

    // overlay positions
    const hx = s.mode === 'camp' ? 157 : HX;
    this.place(this.el.name, hx, GROUND + 3);
    this.place(this.el.bubble, hx, 112);
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
    const g = this.g, c = g.s.char, d = g.d;
    // Hero: lunges forward on each swing, sways back when dodging, is knocked back when hit.
    const sw = this.heroAnim.swing;
    const lunge = sw > 0 ? Math.sin((1 - sw / 0.22) * Math.PI) * 11 : 0;
    const dodge = this.heroAnim.dodge > 0 ? -Math.sin((1 - this.heroAnim.dodge / 0.3) * Math.PI) * 6 : 0;
    const knock = this.heroAnim.hurt > 0 ? -2 : 0;
    const hx = Math.round(HX + lunge + dodge + knock);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ellipse(ctx, HX + 1, GROUND + 1, 10, 2);
    const hand = this.drawHero(ctx, hx, GROUND, { walk: walking, hurt: this.heroAnim.hurt, shadow: false });
    const ang = sw > 0 ? lerp(1.9, -0.9, sw / 0.22) : 0.5 + Math.sin(this.t * 3) * 0.05;
    const wt = c.gear.weapon ? c.gear.weapon.tier : 0;
    this.drawTool(ctx, 'sword', hand, ang, GEAR_COLORS[wt]);
    if (sw > 0.1 && !this.reduced) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (let i = 0; i < 6; i++) ctx.fillRect(hand.hx + 6 + i * 2, hand.hy - 15 + i * 3, 2, 2);
    }
    // Hero HP bar over the head
    const hb = 22, hf = Math.max(0, Math.min(1, c.hp / d.hp));
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(HX - hb / 2 - 1, GROUND - 27, hb + 2, 4);
    ctx.fillStyle = '#1a3a1a';
    ctx.fillRect(HX - hb / 2, GROUND - 26, hb, 2);
    ctx.fillStyle = hf > 0.3 ? '#5ae05a' : '#ff5a5a';
    ctx.fillRect(HX - hb / 2, GROUND - 26, Math.round(hb * hf), 2);

    const nameEl = this.el.mon;
    if (mon) {
      // A new opponent drops in from above while the hero walks up.
      const drop = mon.approach > 0 ? Math.min(1, mon.approach / 0.5) : 0;
      const atk = this.monAnim.atk;
      const mlunge = atk > 0 ? -Math.sin((1 - atk / 0.28) * Math.PI) * 13 : 0;
      const x = Math.round(MX + mlunge + (this.monAnim.hurt > 0 ? 3 : 0));
      const yOff = -Math.round(drop * drop * 90);
      if (mon.approach <= 0.5) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ellipse(ctx, MX, GROUND + 1, 12 * (1 - drop * 0.6), 2); }
      const { top } = this.drawMonster(ctx, mon, x, GROUND + yOff, mon.approach > 0.5 ? 0 : 1);
      if (mon.approach > 0 && mon.approach < 0.06 && !this.reduced) this.burst(MX, GROUND - 2, '#c8b89a', 8);
      const bw = 26, frac = Math.max(0, mon.hp / mon.maxHp);
      const by = Math.round(top - (mon.boss ? 12 : 6));
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(Math.round(x - bw / 2) - 1, by - 1, bw + 2, 4);
      ctx.fillStyle = '#4a1a24';
      ctx.fillRect(Math.round(x - bw / 2), by, bw, 2);
      ctx.fillStyle = mon.boss ? '#ff5a8a' : '#ff5a5a';
      ctx.fillRect(Math.round(x - bw / 2), by, Math.round(bw * frac), 2);
      nameEl.hidden = mon.approach > 0.5;
      nameEl.textContent = (mon.boss ? '👑 ' : '') + mon.name;
      nameEl.className = 'monname' + (mon.variant ? ' v-' + mon.variant : '') + (mon.boss ? ' boss' : '');
      this.place(nameEl, x, by - 2);
      const big = mon.boss || mon.elite;
      this.el.bossBar.hidden = !big;
      if (big) {
        this.el.bossBar.className = 'bossbar' + (mon.boss ? ' boss' : ' elite');
        this.el.bossName.textContent = `${mon.f}층 ${mon.boss ? '보스' : '정예'} · ${mon.name}`;
        this.el.bossFill.style.width = Math.max(0, (mon.hp / mon.maxHp) * 100) + '%';
      }
    } else { nameEl.hidden = true; this.el.bossBar.hidden = true; }
    if (this.monAnim.dying > 0 && this.monAnim.last) {
      this.drawMonster(ctx, this.monAnim.last, MX + (0.35 - this.monAnim.dying) * 30, GROUND - (0.35 - this.monAnim.dying) * 30, this.monAnim.dying / 0.35);
    }
    // Spotlight on the duel
    const v = ctx.createRadialGradient((HX + MX) / 2, GROUND - 22, 50, (HX + MX) / 2, GROUND - 22, 230);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(8,4,16,0.45)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  drawCamp(ctx, env) {
    this.el.mon.hidden = true;
    this.el.bossBar.hidden = true;
    const k0 = this.g.s.slots[0].k;
    if (isIndoor(k0, this.campSpot(k0))) { this.drawStation(ctx, k0, 157, GROUND, 0, { w: W }); return; }
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
      if (it.tier >= 1) {
        const a = ctx.globalAlpha;
        ctx.globalAlpha = a * (0.25 + 0.1 * it.tier);
        ctx.fillStyle = TIERS[it.tier].color;
        circle(ctx, Math.round(x), Math.round(y - 6), 6 + it.tier * 2);
        ctx.globalAlpha = a;
      }
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
      // The clone works at its own place: crop that location around the station.
      ctx.drawImage(this.location(k, this.campSpot(k), this.g.env.hour), 157 - 40, GROUND - gy, w, h, 0, 0, w, h);
      this.drawStation(ctx, k, 40, gy, slot, { pal: CLONE_PAL, w, mini: true });
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



// ---------- Life-skill locations: each skill (and each of its spots) has its own place ----------
const skyBucket = hour => (hour >= 20 || hour < 5 ? 1 : hour < 7 ? 2 : hour < 17 ? 3 : 4);
export const isIndoor = (k, spot) => k === 'alchemy' || (k === 'mining' && spot < 4);
function skyFill(x, hour, top2, bot2, mix = 0) {
  let [t, b] = skyColors(hour, 'camp');
  if (top2) { t = mixHex(t.startsWith('#') ? t : '#000000', top2, mix); b = mixHex(b.startsWith('#') ? b : '#000000', bot2, mix); }
  const g = x.createLinearGradient(0, 0, 0, GROUND);
  g.addColorStop(0, t); g.addColorStop(1, b);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  if (skyBucket(hour) === 1) for (let i = 0; i < 60; i++) { x.fillStyle = noise(i, 41) > 0.8 ? '#ffffff' : '#a8b8ff'; x.fillRect(Math.floor(noise(i, 42) * W), Math.floor(noise(i, 43) * 110), 1, 1); }
}
function ridge(x, col, base, amp, seed, freq) {
  x.fillStyle = col;
  for (let i = 0; i < W; i++) { const h = Math.round(base + smooth(i / freq, seed) * amp); x.fillRect(i, GROUND - h, 1, h); }
}
function groundStrip(x, top, dirt, seed = 1) {
  x.fillStyle = dirt; x.fillRect(0, GROUND, W, H - GROUND);
  for (let i = 0; i < 160; i++) { x.fillStyle = noise(i, seed + 50) > 0.5 ? shade(dirt, -0.25) : shade(dirt, 0.15); x.fillRect(Math.floor(noise(i, seed + 51) * W), GROUND + 6 + Math.floor(noise(i, seed + 52) * (H - GROUND - 6)), 2, 1); }
  x.fillStyle = top; x.fillRect(0, GROUND, W, 4);
  x.fillStyle = shade(top, -0.25); for (let i = 0; i < W; i += 3) x.fillRect(i, GROUND + 4, 2, 1 + (noise(i, seed) > 0.5));
  x.fillStyle = OUTLINE; x.fillRect(0, GROUND, W, 1);
}
function bgTree(x, cx, gy, h, trunk, leaf, r) {
  x.fillStyle = trunk; x.fillRect(cx - 2, gy - h, 4, h);
  x.fillStyle = leaf; circle(x, cx, gy - h, r); circle(x, cx - r * 0.6, gy - h + r * 0.5, r * 0.7); circle(x, cx + r * 0.6, gy - h + r * 0.5, r * 0.7);
}
function pine(x, cx, gy, h, col, snow) {
  for (let i = 0; i < h; i++) { const w = Math.round((i / h) * h * 0.38); x.fillStyle = snow && i % 7 < 2 ? '#f0f6ff' : col; x.fillRect(cx - w, gy - h + i, w * 2 + 1, 1); }
  x.fillStyle = '#4a3020'; x.fillRect(cx - 1, gy, 3, 4);
}
function lantern(x, cx, cy) {
  x.globalAlpha = 0.18; x.fillStyle = '#ffb84a'; circle(x, cx, cy, 16); x.globalAlpha = 0.3; circle(x, cx, cy, 8); x.globalAlpha = 1;
  x.fillStyle = OUTLINE; x.fillRect(cx, cy - 12, 1, 8); x.fillRect(cx - 3, cy - 4, 7, 8);
  x.fillStyle = '#ffd34d'; x.fillRect(cx - 2, cy - 3, 5, 6);
}
const LOCS = {
  mining(x, spot, hour) {
    if (spot === 4) {
      skyFill(x, 22, '#1a0a2a', '#4a1a2a', 0.6);
      for (let i = 0; i < 80; i++) { x.fillStyle = '#ffffff'; x.fillRect(Math.floor(noise(i, 61) * W), Math.floor(noise(i, 62) * 120), 1, 1); }
      x.fillStyle = '#fff6b0'; for (let i = 0; i < 14; i++) x.fillRect(300 - i * 3, 24 + i, 3, 1);
      ridge(x, '#3a1a1a', 30, 40, 7, 40); ridge(x, '#5a2418', 14, 22, 8, 26);
      x.globalAlpha = 0.35; x.fillStyle = '#ff6a3a'; ellipse(x, 200, GROUND, 160, 26); x.globalAlpha = 1;
      groundStrip(x, '#7a3a24', '#4a2a20', 9);
      x.fillStyle = '#ff8a3d'; for (let i = 0; i < 9; i++) x.fillRect(Math.floor(noise(i, 63) * W), GROUND + 8 + (i % 4) * 6, 5 + (i % 3) * 3, 1);
      return;
    }
    const wall = ['#3a3038', '#4a3a34', '#262848', '#1e1830'][spot];
    x.fillStyle = wall; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 220; i++) { x.fillStyle = noise(i, 71) > 0.5 ? shade(wall, -0.25) : shade(wall, 0.12); x.fillRect(Math.floor(noise(i, 72) * W), Math.floor(noise(i, 73) * GROUND), 3 + Math.floor(noise(i, 74) * 6), 2); }
    x.fillStyle = shade(wall, -0.45);
    for (let i = 0; i < W; i++) { const h = 14 + Math.floor(smooth(i / 10, 3) * 14) + (noise(i, 75) > 0.88 ? 12 : 0); x.fillRect(i, 0, 1, h); }
    if (spot === 2) {
      for (let i = 0; i < 9; i++) { const cx = 20 + i * 42 + Math.floor(noise(i, 76) * 20), cy = 60 + Math.floor(noise(i, 77) * 70), col = i % 3 ? '#5a9aff' : '#a66bff';
        x.globalAlpha = 0.25; x.fillStyle = col; circle(x, cx, cy, 12); x.globalAlpha = 1;
        for (let j = 0; j < 3; j++) { x.fillStyle = col; const hh = 8 + j * 3; for (let k = 0; k < hh; k++) { const ww = Math.max(0, Math.round(2 * (1 - k / hh))); x.fillRect(cx - 5 + j * 5 - ww, cy - k, ww * 2 + 1, 1); } } }
    }
    if (spot === 3) {
      x.fillStyle = '#7fe3ff';
      for (let i = 0; i < 7; i++) { let px = Math.floor(noise(i, 78) * W), py = 40 + Math.floor(noise(i, 79) * 100); for (let k = 0; k < 30; k++) { x.globalAlpha = 0.7; x.fillRect(px, py, 1, 1); px += noise(i * 31 + k, 80) > 0.5 ? 1 : 0; py += noise(i * 17 + k, 81) > 0.4 ? 1 : -1; } }
      x.globalAlpha = 1;
    }
    if (spot < 2) {
      for (const bx of [92, 246, 344]) {
        x.fillStyle = '#6a4424'; x.fillRect(bx, 52, 6, GROUND - 52); x.fillStyle = '#4a2e18'; x.fillRect(bx + 4, 52, 2, GROUND - 52);
        x.fillStyle = '#6a4424'; x.fillRect(bx - 30, 48, 66, 6); x.fillStyle = OUTLINE; x.fillRect(bx - 30, 54, 66, 1);
        lantern(x, bx + 18, 66);
      }
    } else lantern(x, 120, 60);
    groundStrip(x, spot >= 2 ? '#4a4a6a' : '#6a6470', spot >= 2 ? '#2e2e44' : '#4a4450', 11);
    x.fillStyle = '#8a8a96'; x.fillRect(0, GROUND + 7, W, 1); x.fillRect(0, GROUND + 12, W, 1);
    x.fillStyle = '#5a3a22'; for (let i = 0; i < W; i += 9) x.fillRect(i, GROUND + 6, 3, 8);
    x.fillStyle = '#8a8a96'; x.fillRect(0, GROUND + 7, W, 1); x.fillRect(0, GROUND + 12, W, 1);
  },
  wood(x, spot, hour) {
    const P = [
      { tint: null, trunk: '#5a3a22', leaf: '#2f7a3a', far: '#3f6a4a' },
      { tint: ['#ffe8a0', '#ffd8a0'], trunk: '#e8e0d0', leaf: '#d8b83a', far: '#b8a060' },
      { tint: ['#3a4a3a', '#5a6a4a'], trunk: '#3a2414', leaf: '#1e4a2a', far: '#2a3a2a' },
      { tint: ['#2a2a6a', '#5a4aa8'], trunk: '#3a3a7a', leaf: '#4ab8e8', far: '#3a3a8a' },
      { tint: ['#ffe8a0', '#fff6d0'], trunk: '#8a6a3a', leaf: '#7ad06a', far: '#a8c87a' },
    ][spot];
    skyFill(x, hour, P.tint && P.tint[0], P.tint && P.tint[1], P.tint ? 0.45 : 0);
    ridge(x, P.far, 40, 30, 21, 30);
    for (let i = 0; i < 12; i++) bgTree(x, 10 + i * 34 + Math.floor(noise(i, 22) * 12), GROUND - 4, 40 + Math.floor(noise(i, 23) * 30), shade(P.trunk, -0.2), shade(P.leaf, -0.25), 12 + Math.floor(noise(i, 24) * 6));
    if (spot === 4) { x.globalAlpha = 0.16; x.fillStyle = '#fff6b0'; for (let i = 0; i < 6; i++) x.fillRect(30 + i * 60, 0, 14, GROUND); x.globalAlpha = 1;
      x.fillStyle = '#6a5030'; x.fillRect(300, GROUND - 60, 16, 60); x.fillRect(250, GROUND - 26, 70, 10); x.fillRect(330, GROUND - 40, 40, 8); }
    for (let i = 0; i < 7; i++) bgTree(x, 24 + i * 58 + Math.floor(noise(i, 25) * 16), GROUND, 30 + Math.floor(noise(i, 26) * 16), P.trunk, P.leaf, 14 + Math.floor(noise(i, 27) * 5));
    x.fillStyle = shade(P.leaf, -0.4); for (let i = 0; i < W; i++) { const h = 10 + Math.floor(smooth(i / 8, 28) * 12); x.fillRect(i, 0, 1, h); }
    if (spot === 3) for (let i = 0; i < 30; i++) { x.fillStyle = i % 2 ? '#bff8ff' : '#ffffff'; x.fillRect(Math.floor(noise(i, 29) * W), 20 + Math.floor(noise(i, 30) * 140), 1, 1); }
    groundStrip(x, spot === 1 ? '#c8a84a' : spot === 3 ? '#4a5aa8' : '#3f8a3a', '#5a3e24', 21);
    x.fillStyle = '#7a5432'; x.fillRect(300, GROUND - 6, 22, 6); x.fillRect(306, GROUND - 11, 22, 5); x.fillStyle = '#e8c88a'; x.fillRect(300, GROUND - 6, 3, 6); x.fillRect(325, GROUND - 11, 3, 5);
  },
  forage(x, spot, hour) {
    if (spot === 2) {
      skyFill(x, hour, '#4a5a4a', '#8a9a7a', 0.6); ridge(x, '#3a4a3a', 30, 24, 31, 30);
      for (let i = 0; i < 8; i++) { const cx = 20 + i * 50; x.fillStyle = '#2a3020'; x.fillRect(cx, GROUND - 50, 3, 50); x.fillRect(cx - 8, GROUND - 40, 9, 2); x.fillRect(cx + 2, GROUND - 32, 10, 2); }
      x.globalAlpha = 0.2; x.fillStyle = '#d8e8d0'; for (let i = 0; i < 4; i++) x.fillRect(0, 120 + i * 14, W, 7); x.globalAlpha = 1;
      groundStrip(x, '#5a7a3a', '#3a3424', 31);
      x.fillStyle = '#3a5a5a'; for (const [cx, w] of [[60, 30], [250, 44], [340, 26]]) ellipse(x, cx, GROUND + 8, w, 3);
      return;
    }
    if (spot === 3) {
      skyFill(x, hour, '#bfe0ff', '#e8f6ff', 0.4);
      x.fillStyle = '#8aa0c8'; for (let i = 0; i < W; i++) { const h = Math.round(70 + smooth(i / 34, 33) * 60); x.fillRect(i, GROUND - h, 1, h); }
      x.fillStyle = '#ffffff'; for (let i = 0; i < W; i++) { const h = Math.round(70 + smooth(i / 34, 33) * 60); x.fillRect(i, GROUND - h, 1, Math.max(0, Math.round((h - 70) * 0.4))); }
      ridge(x, '#c8d8f0', 16, 18, 34, 22);
      groundStrip(x, '#f0f6ff', '#8a9ab8', 33);
      return;
    }
    if (spot === 4) {
      skyFill(x, 23, '#2a1a4a', '#6a3a8a', 0.6);
      for (let i = 0; i < 7; i++) { const cx = 20 + i * 58, hh = 30 + Math.floor(noise(i, 35) * 40), col = i % 2 ? '#ff8ae8' : '#8ad8ff';
        x.globalAlpha = 0.25; x.fillStyle = col; circle(x, cx, GROUND - hh, 20); x.globalAlpha = 1;
        x.fillStyle = '#e8d8f0'; x.fillRect(cx - 2, GROUND - hh, 5, hh); x.fillStyle = col; ellipse(x, cx, GROUND - hh, 16, 7); }
      groundStrip(x, '#4a8a7a', '#3a2a4a', 35);
      for (let i = 0; i < 30; i++) { x.fillStyle = i % 2 ? '#ffe8ff' : '#b8fff0'; x.fillRect(Math.floor(noise(i, 36) * W), GROUND + 2 + (i % 3), 1, 1); }
      return;
    }
    skyFill(x, hour);
    ridge(x, '#6aa8d8', 50, 30, 37, 40); ridge(x, spot === 1 ? '#3f7a4a' : '#6ac05a', 22, 22, 38, 26);
    if (spot === 1) for (let i = 0; i < 9; i++) bgTree(x, 12 + i * 46, GROUND - 6, 34 + Math.floor(noise(i, 39) * 18), '#4a3020', '#2f6a3a', 13);
    for (let i = 0; i < 70; i++) { x.fillStyle = ['#ffe14d', '#ff8aa8', '#ffffff', '#c27bff'][i % 4]; x.fillRect(Math.floor(noise(i, 40) * W), GROUND - 2 - Math.floor(noise(i, 44) * 18), 2, 2); }
    groundStrip(x, '#6ad04a', '#9a6a3a', 37);
    if (spot === 1) { x.fillStyle = '#c8a87a'; x.fillRect(0, GROUND + 4, W, 5); x.fillStyle = '#a8885a'; for (let i = 0; i < W; i += 7) x.fillRect(i, GROUND + 6, 3, 1); }
  },
  fish(x, spot, hour) {
    const P = [
      { sea: '#5aa0e0', land: '#5ab45a' }, { sea: '#3a7ac8', land: '#3f8a4a' }, { sea: '#5a8aa8', land: '#6a8a4a' },
      { sea: '#2a6ad8', land: '#c8b87a' }, { sea: '#0e1e48', land: '#3a3a5a' },
    ][spot];
    skyFill(x, spot === 4 ? 22 : hour);
    if (spot === 4) { x.fillStyle = '#f0f0d8'; circle(x, 300, 40, 12); x.fillStyle = '#0e1430'; circle(x, 306, 37, 10); }
    if (spot === 3) { x.globalAlpha = 0.5; x.fillStyle = '#fff6b0'; circle(x, 320, 70, 16); x.globalAlpha = 1; }
    const hz = spot >= 3 ? 118 : 128;
    if (spot === 1) ridge(x, '#5a7aa8', 60, 40, 51, 40);
    if (spot < 3) { x.fillStyle = shade(P.land, -0.2); for (let i = 0; i < W; i++) { const h = Math.round(8 + smooth(i / 20, 52) * 10); x.fillRect(i, hz - h, 1, h); } }
    x.fillStyle = P.sea; x.fillRect(0, hz, W, GROUND - hz);
    x.fillStyle = shade(P.sea, 0.25); for (let i = 0; i < 40; i++) x.fillRect(Math.floor(noise(i, 53) * W), hz + 3 + Math.floor(noise(i, 54) * (GROUND - hz - 4)), 6, 1);
    if (spot === 2) { x.fillStyle = '#6a5a4a'; x.fillRect(200, hz - 14, 140, 4); for (let i = 0; i < 6; i++) x.fillRect(206 + i * 26, hz - 10, 3, 12); }
    if (spot === 0 || spot === 1) for (let i = 0; i < 6; i++) bgTree(x, 10 + i * 64, hz - 4, 22 + (i % 3) * 6, '#4a3020', shade(P.land, -0.15), 10);
    groundStrip(x, P.land, spot === 3 ? '#a8946a' : '#7a5a3a', 51);
  },
  hunt(x, spot, hour) {
    if (spot === 3) {
      skyFill(x, hour, '#c8d8f0', '#e8f0ff', 0.45);
      ridge(x, '#a8b8d8', 50, 50, 61, 50);
      for (let i = 0; i < 10; i++) pine(x, 12 + i * 40 + Math.floor(noise(i, 62) * 14), GROUND - 2, 26 + Math.floor(noise(i, 63) * 18), '#2a5a4a', true);
      groundStrip(x, '#f0f6ff', '#9aaac8', 61);
      return;
    }
    if (spot === 4) {
      skyFill(x, hour, '#ffd8f0', '#d8fff0', 0.5);
      for (let i = 0; i < 8; i++) bgTree(x, 14 + i * 52, GROUND - 2, 40 + Math.floor(noise(i, 64) * 20), '#e8e0f0', i % 2 ? '#ffb8e8' : '#b8ffe8', 14);
      for (let i = 0; i < 40; i++) { x.fillStyle = '#ffffff'; x.fillRect(Math.floor(noise(i, 65) * W), Math.floor(noise(i, 66) * 160), 1, 1); }
      groundStrip(x, '#8ae0a8', '#6a8a6a', 63);
      return;
    }
    skyFill(x, hour);
    if (spot === 2) { x.fillStyle = '#7a7a8a'; for (let i = 0; i < W; i++) { const h = Math.round(60 + smooth(i / 26, 67) * 70); x.fillRect(i, GROUND - h, 1, h); } ridge(x, '#5a5a6a', 20, 30, 68, 24); }
    else ridge(x, '#5aa0d0', 40, 26, 69, 40);
    if (spot === 1) for (let i = 0; i < 11; i++) bgTree(x, 8 + i * 38, GROUND - 4, 36 + Math.floor(noise(i, 70) * 20), '#4a3020', '#3a7a3a', 13);
    ridge(x, spot === 2 ? '#6a7a4a' : '#5aa04a', 12, 10, 71, 14);
    x.fillStyle = spot === 2 ? '#8a9a5a' : '#7ac05a'; for (let i = 0; i < W; i += 2) x.fillRect(i, GROUND - 4 - Math.floor(noise(i, 72) * 8), 1, 8);
    groundStrip(x, spot === 2 ? '#7a8a4a' : '#5ab44a', '#8a6a3a', 71);
  },
  alchemy(x) {
    x.fillStyle = '#5a3a2a'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < W; i += 16) { x.fillStyle = shade('#5a3a2a', -0.25); x.fillRect(i, 0, 1, GROUND); x.fillStyle = shade('#5a3a2a', 0.08); x.fillRect(i + 1, 0, 2, GROUND); }
    x.fillStyle = '#3a2418'; x.fillRect(0, 0, W, 12); x.fillRect(0, 40, W, 3);
    x.fillStyle = OUTLINE; x.fillRect(46, 56, 52, 46); x.fillStyle = '#7ab8e8'; x.fillRect(48, 58, 48, 42);
    x.fillStyle = '#a8d8ff'; x.fillRect(48, 58, 48, 10); x.fillStyle = '#5a3a2a'; x.fillRect(71, 58, 3, 42); x.fillRect(48, 77, 48, 3);
    for (const sy of [70, 108]) {
      x.fillStyle = '#7a5232'; x.fillRect(236, sy, 128, 5); x.fillStyle = OUTLINE; x.fillRect(236, sy + 5, 128, 1);
      for (let i = 0; i < 10; i++) { const col = ['#ff4a4a', '#4aff7a', '#4a9aff', '#ffd34d', '#c27bff', '#ff8a2a'][(i + sy) % 6], bh = 8 + (i % 3) * 3;
        x.fillStyle = OUTLINE; x.fillRect(240 + i * 12, sy - bh - 1, 7, bh + 1); x.fillStyle = col; x.fillRect(241 + i * 12, sy - bh + 3, 5, bh - 3); x.fillStyle = '#e8e0d0'; x.fillRect(242 + i * 12, sy - bh, 3, 3); }
    }
    for (let i = 0; i < 6; i++) { x.fillStyle = '#4a7a3a'; x.fillRect(120 + i * 18, 14, 2, 10 + (i % 3) * 4); x.fillStyle = '#6aa04a'; x.fillRect(118 + i * 18, 22 + (i % 3) * 4, 6, 4); }
    x.globalAlpha = 0.18; x.fillStyle = '#ffb84a'; circle(x, 30, 120, 26); x.globalAlpha = 1;
    x.fillStyle = '#e8e0d0'; x.fillRect(28, 116, 4, 10); x.fillStyle = '#ffd34d'; x.fillRect(29, 112, 2, 3);
    x.fillStyle = '#7a5232'; x.fillRect(16, 126, 30, 4);
    x.fillStyle = '#7a5232'; x.fillRect(0, GROUND, W, H - GROUND);
    for (let i = 0; i < W; i += 24) { x.fillStyle = shade('#7a5232', -0.25); x.fillRect(i, GROUND, 1, H - GROUND); }
    x.fillStyle = shade('#7a5232', -0.3); x.fillRect(0, GROUND + 12, W, 1);
    x.fillStyle = OUTLINE; x.fillRect(0, GROUND, W, 1);
    x.fillStyle = '#8a2a3a'; x.fillRect(120, GROUND + 4, 120, 8); x.fillStyle = '#c8a84a'; x.fillRect(120, GROUND + 4, 120, 1); x.fillRect(120, GROUND + 11, 120, 1);
  },
};

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
// ---------- Gathering stations: one look per spot, flashier as the spot rises ----------
const ROCK_ORE = ['#e08a4a', '#b07a6a', '#5a9aff', '#7fe3ff', '#ff8a3d'];
const BUSH_SPARK = ['#ffe14d', '#4a5cff', '#d8ff5a', '#e8f6ff', '#ff8ae8'];
const ANIMAL_BY_SPOT = ['rabbit', 'deer', 'boar', 'wolf', 'unicorn'];
const ANIMAL_PAL = {
  rabbit: { a: '#efe6d8', r: '#ff9aa8' },
  deer: { a: '#c8885a', y: '#e8d8b8', r: '#ff9aa8' },
  boar: { a: '#7a5040', m: '#d88a8a' },
  wolf: { a: '#d8e0f0', m: '#3a3a4a' },
  unicorn: { a: '#ffffff', p: '#ff9ae8', y: '#ffd34d' },
};
const TREES = [
  { trunk: '#8a5a2e', tw: 7, th: 30, leaf: '#3f9a4a', R: 14 },
  { trunk: '#efe9d8', tw: 6, th: 32, leaf: '#e8c84a', R: 13, birch: true },
  { trunk: '#5a3a22', tw: 11, th: 30, leaf: '#2e6a3a', R: 17, owl: true, roots: true },
  { trunk: '#4a4a9a', tw: 8, th: 32, leaf: '#6ae8ff', R: 15, glow: '#6ae8ff', roots: true },
  { trunk: '#a87a3a', tw: 14, th: 40, leaf: '#8fe07a', R: 20, glow: '#ffd34d', gold: true, roots: true },
];
function sparkle(ctx, x, y, t, seed, col) {
  if (Math.sin(t * 3 + seed * 1.7) < 0.35) return;
  ctx.fillStyle = col;
  ctx.fillRect(Math.round(x), Math.round(y) - 1, 1, 3);
  ctx.fillRect(Math.round(x) - 1, Math.round(y), 3, 1);
}
function glowBlob(ctx, x, y, rx, ry, col, t, base = 0.18) {
  ctx.globalAlpha = base + 0.08 * Math.sin(t * 3);
  ctx.fillStyle = col;
  ellipse(ctx, x, y, rx, ry);
  ctx.globalAlpha = 1;
}
function shard(ctx, cx, baseY, h, w, col) {
  ctx.fillStyle = OUTLINE;
  for (let i = 0; i <= h; i++) { const ww = Math.max(1, Math.round(w * (1 - i / h))) + 1; ctx.fillRect(cx - ww, baseY - i, ww * 2 + 1, 1); }
  ctx.fillStyle = col;
  for (let i = 0; i < h; i++) { const ww = Math.max(0, Math.round(w * (1 - i / h))); ctx.fillRect(cx - ww, baseY - i, ww * 2 + 1, 1); }
  ctx.fillStyle = shade(col, 0.55);
  ctx.fillRect(cx, baseY - h + 2, 1, h - 3);
}
function rock(ctx, x, gy, spot, hit, t) {
  const R = 12 + spot, H = 8 + Math.min(3, spot);
  const base = ['#8a8a96', '#6e6a72', '#7a8494', '#2e2840', '#4a2a24'][spot];
  if (spot >= 2) glowBlob(ctx, x, gy - H, R + 9, H + 8, ROCK_ORE[spot], t);
  ctx.fillStyle = OUTLINE;
  ellipse(ctx, x, gy - H, R + 1, H + 1);
  ctx.fillStyle = hit ? shade(base, 0.35) : base;
  ellipse(ctx, x, gy - H, R, H);
  ctx.fillStyle = shade(base, -0.3);
  ctx.fillRect(x - R + 2, gy - 4, R * 2 - 3, 3);
  ctx.fillStyle = shade(base, 0.25);
  ctx.fillRect(x - Math.round(R / 2), gy - H * 2 + 2, Math.round(R / 2), 2);
  if (spot === 0) {
    ctx.fillStyle = ROCK_ORE[0];
    for (const [dx, dy] of [[-5, -8], [3, -11], [6, -5], [-1, -4], [8, -9]]) ctx.fillRect(x + dx, gy + dy, 2, 2);
  } else if (spot === 1) {
    ctx.fillStyle = '#c08a7a';
    ctx.fillRect(x - 8, gy - 10, 7, 1); ctx.fillRect(x + 1, gy - 13, 6, 1); ctx.fillRect(x + 2, gy - 6, 7, 1); ctx.fillRect(x - 6, gy - 5, 4, 1);
    ctx.fillStyle = '#1e1e24';
    for (const [dx, dy] of [[-3, -12], [6, -9], [-9, -6]]) ctx.fillRect(x + dx, gy + dy, 3, 2);
  } else if (spot === 2) {
    shard(ctx, x - 6, gy - H - 2, 11, 3, '#3d7cff');
    shard(ctx, x + 2, gy - H - 4, 15, 4, '#5a9aff');
    shard(ctx, x + 9, gy - H, 8, 2, '#a66bff');
    sparkle(ctx, x + 2, gy - H - 16, t, 1, '#ffffff');
    sparkle(ctx, x - 8, gy - H - 10, t, 4, '#bfe0ff');
  } else if (spot === 3) {
    ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 4);
    ctx.fillStyle = '#7fe3ff';
    ctx.fillRect(x - 10, gy - 9, 6, 1); ctx.fillRect(x - 4, gy - 10, 1, 4); ctx.fillRect(x - 4, gy - 6, 8, 1);
    ctx.fillRect(x + 4, gy - 14, 1, 8); ctx.fillRect(x + 4, gy - 14, 7, 1); ctx.fillRect(x - 2, gy - 15, 6, 1);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ff3b5c';
    ctx.fillRect(x + 8, gy - 8, 2, 2); ctx.fillRect(x - 9, gy - 13, 2, 2);
    sparkle(ctx, x + 9, gy - 10, t, 2, '#ffd0dc');
    sparkle(ctx, x - 3, gy - 18, t, 5, '#7fe3ff');
  } else {
    const pulse = 0.6 + 0.4 * Math.sin(t * 5);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ff8a3d';
    ctx.fillRect(x - 12, gy - 10, 8, 1); ctx.fillRect(x - 5, gy - 13, 1, 4); ctx.fillRect(x - 5, gy - 13, 9, 1);
    ctx.fillRect(x + 4, gy - 13, 1, 7); ctx.fillRect(x + 4, gy - 7, 9, 1); ctx.fillRect(x - 8, gy - 5, 6, 1);
    ctx.fillStyle = '#ffd34d';
    ctx.fillRect(x - 5, gy - 13, 3, 1); ctx.fillRect(x + 4, gy - 9, 1, 2);
    ctx.globalAlpha = 1;
    for (let i = 0; i < 4; i++) {
      const ey = gy - 14 - ((t * 14 + i * 9) % 26);
      ctx.globalAlpha = 1 - ((t * 14 + i * 9) % 26) / 26;
      ctx.fillStyle = i % 2 ? '#ffd34d' : '#ff8a3d';
      ctx.fillRect(x - 6 + i * 4, Math.round(ey), 1, 1);
    }
    ctx.globalAlpha = 1;
    sparkle(ctx, x - 14, gy - 26, t, 3, '#fff6b0');
    sparkle(ctx, x + 14, gy - 22, t, 6, '#ffffff');
  }
}
function tree(ctx, x, gy, shake, spot, t) {
  const T = TREES[spot];
  const tw = T.tw, th = T.th, R = T.R, sx = Math.round(shake);
  const cy = gy - th - Math.round(R * 0.6);
  if (T.glow) glowBlob(ctx, x + sx, cy, R + 10, R + 6, T.glow, t, spot === 4 ? 0.22 : 0.16);
  if (T.gold) {
    ctx.globalAlpha = 0.12 + 0.06 * Math.sin(t * 1.5);
    ctx.fillStyle = '#fff6b0';
    for (let i = 0; i < 4; i++) ctx.fillRect(x - R + i * 12, cy - R - 20, 4, th + R + 24);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(x - Math.ceil(tw / 2) - 1, gy - th, tw + 2, th);
  ctx.fillStyle = T.trunk;
  ctx.fillRect(x - Math.ceil(tw / 2), gy - th, tw, th);
  ctx.fillStyle = shade(T.trunk, -0.3);
  ctx.fillRect(x - 1, gy - th + 4, 1, th - 10);
  if (T.birch) { ctx.fillStyle = '#2a2a30'; for (let y = gy - th + 4; y < gy - 2; y += 6) ctx.fillRect(x - 2 + ((y / 6) % 2), y, 3, 1); }
  if (T.roots) {
    ctx.fillStyle = OUTLINE; ctx.fillRect(x - tw, gy - 3, tw * 2, 3);
    ctx.fillStyle = shade(T.trunk, -0.15); ctx.fillRect(x - tw + 1, gy - 2, tw * 2 - 2, 2);
  }
  if (T.gold) {
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2);
    ctx.fillStyle = '#ffd34d';
    ctx.fillRect(x - 2, gy - th + 8, 1, 6); ctx.fillRect(x + 2, gy - th + 18, 1, 6); ctx.fillRect(x - 3, gy - 14, 1, 5);
    ctx.globalAlpha = 1;
  }
  const blobs = [[0, 0, R], [-Math.round(R * 0.65), Math.round(R * 0.55), Math.round(R * 0.68)], [Math.round(R * 0.65), Math.round(R * 0.55), Math.round(R * 0.68)]];
  if (R >= 17) blobs.push([-Math.round(R * 0.4), -Math.round(R * 0.5), Math.round(R * 0.6)], [Math.round(R * 0.45), -Math.round(R * 0.45), Math.round(R * 0.6)]);
  ctx.fillStyle = OUTLINE;
  for (const [dx, dy, r] of blobs) circle(ctx, x + dx + sx, cy + dy, r + 1);
  ctx.fillStyle = T.leaf;
  for (const [dx, dy, r] of blobs) circle(ctx, x + dx + sx, cy + dy, r);
  ctx.fillStyle = shade(T.leaf, 0.3);
  circle(ctx, x - 4 + sx, cy - Math.round(R * 0.4), Math.max(3, Math.round(R * 0.35)));
  ctx.fillStyle = shade(T.leaf, -0.25);
  ctx.fillRect(x - R + 4 + sx, cy + Math.round(R * 0.7), R * 2 - 8, 2);
  if (T.owl && Math.sin(t * 0.7) < 0.92) {
    ctx.fillStyle = '#ffe066';
    ctx.fillRect(x + 5 + sx, cy + 2, 2, 2); ctx.fillRect(x + 9 + sx, cy + 2, 2, 2);
  }
  if (spot === 3) for (let i = 0; i < 6; i++) sparkle(ctx, x - R + ((i * 37) % (R * 2)) + sx, cy - R + ((i * 23) % (R * 2)), t, i, i % 2 ? '#ffffff' : '#bff8ff');
  if (T.gold) {
    for (let i = 0; i < 5; i++) {
      const fy = ((t * 9 + i * 11) % 46);
      ctx.globalAlpha = 1 - fy / 46;
      ctx.fillStyle = '#ffd34d';
      ctx.fillRect(Math.round(x - R + i * 9 + Math.sin(t * 2 + i) * 3), Math.round(cy + R * 0.6 + fy), 2, 1);
    }
    ctx.globalAlpha = 1;
    sparkle(ctx, x - 8 + sx, cy - 6, t, 2, '#ffffff');
    sparkle(ctx, x + 10 + sx, cy + 4, t, 5, '#fff6b0');
  }
}
function bush(ctx, x, gy, spot, hit, t, front) {
  const leaf = front ? '#3f8a3f' : ['#4caf50', '#3f8a3f', '#5a7a3a', '#5a8a6a', '#4a7a7a'][spot];
  if (!front && spot === 2) {
    for (const [dx, h] of [[-12, 22], [-8, 26], [11, 20], [14, 24]]) {
      ctx.fillStyle = '#6a8a3a'; ctx.fillRect(x + dx, gy - h, 1, h);
      ctx.fillStyle = OUTLINE; ctx.fillRect(x + dx - 1, gy - h - 1, 3, 6);
      ctx.fillStyle = '#7a4a2a'; ctx.fillRect(x + dx, gy - h, 1, 4);
    }
  }
  if (!front && spot === 4) glowBlob(ctx, x, gy - 8, 22, 14, '#ff8ae8', t);
  ctx.fillStyle = OUTLINE;
  circle(ctx, x, gy - 6, 8); circle(ctx, x - 6, gy - 3, 6); circle(ctx, x + 6, gy - 3, 6);
  ctx.fillStyle = hit && !front ? shade(leaf, 0.3) : leaf;
  circle(ctx, x, gy - 6, 7); circle(ctx, x - 6, gy - 3, 5); circle(ctx, x + 6, gy - 3, 5);
  if (front) return;
  if (spot === 0) {
    ctx.fillStyle = '#ffe14d';
    for (const [dx, dy] of [[-4, -9], [3, -11], [6, -5], [-7, -4]]) ctx.fillRect(x + dx, gy + dy, 2, 2);
  } else if (spot === 1) {
    for (const [dx, dy] of [[-4, -9], [2, -11], [5, -5], [-7, -5], [0, -4]]) {
      ctx.fillStyle = '#2a3ab8'; ctx.fillRect(x + dx, gy + dy, 2, 2);
      ctx.fillStyle = '#8a9aff'; ctx.fillRect(x + dx, gy + dy, 1, 1);
    }
    ctx.fillStyle = OUTLINE; ctx.fillRect(x + 9, gy - 6, 6, 3); ctx.fillRect(x + 11, gy - 3, 2, 3);
    ctx.fillStyle = '#c8553d'; ctx.fillRect(x + 10, gy - 5, 4, 2);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 11, gy - 5, 1, 1);
  } else if (spot === 2) {
    ctx.fillStyle = '#9a6bff';
    for (const [dx, dy] of [[-3, -10], [4, -8], [-6, -5]]) ctx.fillRect(x + dx, gy + dy, 2, 3);
    for (let i = 0; i < 5; i++) {
      if (Math.sin(t * 2.5 + i * 1.9) < 0.2) continue;
      ctx.fillStyle = '#d8ff5a';
      ctx.fillRect(Math.round(x - 16 + i * 8 + Math.sin(t + i) * 3), Math.round(gy - 22 - (i % 3) * 6 + Math.cos(t * 1.3 + i) * 3), 1, 1);
    }
  } else if (spot === 3) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 6, gy - 13, 12, 2); ctx.fillRect(x - 11, gy - 8, 6, 1); ctx.fillRect(x + 5, gy - 8, 6, 1);
    ctx.fillStyle = OUTLINE; ctx.fillRect(x - 2, gy - 19, 5, 5);
    ctx.fillStyle = '#e8f6ff'; ctx.fillRect(x - 1, gy - 18, 3, 3);
    ctx.fillStyle = '#ffe066'; ctx.fillRect(x, gy - 17, 1, 1);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(x - 18 + i * 7 + Math.sin(t + i) * 2), Math.round(gy - 30 + ((t * 10 + i * 9) % 28)), 1, 1);
    }
  } else {
    for (const [dx, h, col] of [[-10, 6, '#ff8ae8'], [9, 8, '#ff6ad5'], [-2, 4, '#c8d0ff']]) {
      ctx.fillStyle = '#f6e6cc'; ctx.fillRect(x + dx, gy - h, 1, h);
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 3 + dx);
      ctx.fillStyle = col; ctx.fillRect(x + dx - 2, gy - h - 2, 5, 2);
      ctx.globalAlpha = 1;
    }
    const fxp = x + Math.cos(t * 2) * 14, fyp = gy - 22 + Math.sin(t * 3) * 4;
    ctx.fillStyle = 'rgba(255,200,255,0.5)'; ctx.fillRect(Math.round(fxp - Math.cos(t * 2) * 3), Math.round(fyp), 1, 1);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(fxp), Math.round(fyp), 2, 2);
    sparkle(ctx, x + 6, gy - 16, t, 3, '#ffe8ff');
  }
}
function water(ctx, x, gy, w, t, spot = 0) {
  const [deep, top] = [['#3a7ad8', '#5a9ae8'], ['#2a6ac0', '#4a8ad8'], ['#4a7a9a', '#6a9ab8'], ['#1a4aa8', '#3a6ac8'], ['#0a1a3a', '#1a2a5a']][spot];
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(x, gy, w - x, 1);
  ctx.fillStyle = deep;
  ctx.fillRect(x, gy + 1, w - x, H);
  ctx.fillStyle = top;
  ctx.fillRect(x, gy + 1, w - x, 2);
  const speed = [8, 4, 26, 14, 3][spot];
  ctx.fillStyle = spot === 4 ? '#2a3a6a' : '#bfe6ff';
  for (let i = 0; i < 12; i++) {
    const wx = x + ((i * 37 + t * speed) % Math.max(1, w - x));
    ctx.fillRect(Math.round(wx), gy + 6 + (i % 4) * 5, spot === 2 ? 7 : 4, 1);
  }
  if (spot === 1) {
    for (const [dx, dy] of [[40, 6], [78, 12], [120, 5], [170, 10]]) {
      if (x + dx > w - 8) continue;
      ctx.fillStyle = OUTLINE; ellipse(ctx, x + dx, gy + dy, 6, 2);
      ctx.fillStyle = '#3f9a4a'; ellipse(ctx, x + dx, gy + dy, 5, 1);
      if (dx % 3 === 0) { ctx.fillStyle = '#ff9ad8'; ctx.fillRect(x + dx - 1, gy + dy - 2, 3, 2); }
    }
  } else if (spot === 2) {
    for (const dx of [w - x - 24, w - x - 16, w - x - 9]) {
      if (dx < 30) continue;
      ctx.fillStyle = '#6a8a3a'; ctx.fillRect(x + dx, gy - 14, 1, 16);
      ctx.fillStyle = '#7a4a2a'; ctx.fillRect(x + dx, gy - 14, 1, 4);
    }
  } else if (spot === 3) {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 6; i++) {
      const wx = x + ((i * 53 + t * 18) % Math.max(1, w - x));
      ctx.fillRect(Math.round(wx), gy + 2 + (i % 2) * 8, 1, 1); ctx.fillRect(Math.round(wx) + 1, gy + 1 + (i % 2) * 8, 2, 1); ctx.fillRect(Math.round(wx) + 3, gy + 2 + (i % 2) * 8, 1, 1);
    }
    const gx = x + ((t * 20) % Math.max(1, w - x)), gyy = gy - 46 + Math.sin(t * 2) * 3;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(gx), Math.round(gyy), 2, 1); ctx.fillRect(Math.round(gx) + 2, Math.round(gyy) + 1, 1, 1); ctx.fillRect(Math.round(gx) + 3, Math.round(gyy), 2, 1);
  } else if (spot === 4) {
    const sxp = x + ((t * 6) % Math.max(1, (w - x) + 80)) - 40;
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#000814';
    ellipse(ctx, sxp, gy + 22, 34, 7);
    ctx.globalAlpha = 1;
    for (let i = 0; i < 14; i++) {
      if (Math.sin(t * 2 + i * 2.3) < 0) continue;
      ctx.fillStyle = i % 3 ? '#7affe8' : '#ff8ae8';
      ctx.fillRect(Math.round(x + 10 + ((i * 41) % Math.max(1, w - x - 20))), Math.round(gy + 8 + ((i * 13) % 26) + Math.sin(t + i) * 2), 1, 1);
    }
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 4);
    ctx.fillStyle = '#ffd34d'; circle(ctx, x + 14, gy - 8, 5);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffd34d'; ctx.fillRect(x + 13, gy - 9, 3, 3);
  }
  ctx.fillStyle = '#8a5a2e';
  ctx.fillRect(x - 2, gy - 1, 18, 3);
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(x - 2, gy + 2, 18, 1);
  ctx.fillRect(x + 2, gy + 3, 2, 8);
  ctx.fillRect(x + 12, gy + 3, 2, 8);
}
function huntGround(ctx, hx, gy, w, spot, t) {
  if (spot === 3) {
    ctx.fillStyle = '#f0f6ff'; ctx.fillRect(hx + 20, gy - 1, w - hx - 20, 4);
    ctx.fillStyle = '#c8d8f0'; for (let x = hx + 22; x < w; x += 9) ctx.fillRect(x, gy + 2, 4, 1);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 8; i++) ctx.fillRect(Math.round(hx + 30 + ((i * 29) % Math.max(1, w - hx - 30)) + Math.sin(t + i) * 2), Math.round(gy - 40 + ((t * 10 + i * 7) % 40)), 1, 1);
  } else if (spot === 4) {
    for (let i = 0; i < 10; i++) {
      if (Math.sin(t * 2.2 + i * 1.3) < 0.1) continue;
      ctx.fillStyle = i % 2 ? '#ffe8ff' : '#b8fff0';
      ctx.fillRect(Math.round(hx + 30 + ((i * 31) % Math.max(1, w - hx - 30))), gy - 2 - (i % 3), 1, 2);
    }
  } else if (spot === 2) {
    ctx.fillStyle = '#6a6a76';
    for (const dx of [40, 96, 150]) if (hx + dx < w - 6) { ctx.fillRect(hx + dx, gy - 3, 6, 3); ctx.fillStyle = '#8a8a96'; ctx.fillRect(hx + dx + 1, gy - 3, 3, 1); ctx.fillStyle = '#6a6a76'; }
  }
}
function cauldron(ctx, x, gy, liquid, t, rainbow, tier = 0) {
  const rim = TOOL_TIERS[Math.min(10, tier)].color;
  if (tier >= 5) glowBlob(ctx, x, gy - 12, 22, 16, rim, t);
  ctx.fillStyle = OUTLINE;
  ellipse(ctx, x, gy - 9, 13, 10);
  ctx.fillStyle = tier >= 3 ? '#4a4458' : '#3a3a48';
  ellipse(ctx, x, gy - 9, 12, 9);
  ctx.fillStyle = '#5a5a6a';
  ctx.fillRect(x - 9, gy - 12, 3, 6);
  if (tier >= 3) { ctx.fillStyle = '#ff3b5c'; ctx.fillRect(x - 1, gy - 9, 2, 2); ctx.fillStyle = '#3d7cff'; ctx.fillRect(x + 5, gy - 8, 2, 2); ctx.fillStyle = '#6aff9e'; ctx.fillRect(x - 7, gy - 7, 2, 2); }
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(x - 13, gy - 18, 27, 4);
  ctx.fillStyle = rim;
  ctx.fillRect(x - 13, gy - 18, 27, 1);
  ctx.fillStyle = rainbow ? `hsl(${(t * 300) % 360} 90% 60%)` : liquid;
  ctx.fillRect(x - 12, gy - 17, 25, 2);
  for (let i = 0; i < 3 + Math.min(3, tier); i++) {
    const by = gy - 20 - ((t * 14 + i * 7) % 18);
    ctx.globalAlpha = 0.8;
    ctx.fillRect(x - 8 + ((i * 6) % 18), Math.round(by), 2, 2);
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
