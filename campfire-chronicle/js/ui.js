// DOM layer: the base screen (resources, start bar, menu), the run HUD and
// controls, and the panels: 제작, 장비, 마을, 보물상자, 미션, 설정.
import { icon, sprite, HERO, HERO_PAL } from './sprites.js';
import {
  ORES, ORE, GEAR, GEAR_SLOTS, GEAR_TIERS, UPGRADES, ABILITIES, ABILITY, ABIL_MAX, abilityUnlockFloor, abilityCost,
  RARITY, RELICS, RELIC, RELIC_COPIES, RELIC_MAX, fxText, BUILDINGS, BUILD_MAX, MISSIONS, TIPS,
} from './data.js';
import { fmt, W, H, T } from './render.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const RES_ICON = { stone: ['stone', '#9a9aa6'], gems: ['gem', '#ff7ad8'], chests: ['chest', '#c8913a'], ...Object.fromEntries(ORES.map(o => [o.id, ['ore', o.color]])) };
const RES_NAME = { stone: '돌', gems: '보석', chests: '보물상자', ...Object.fromEntries(ORES.map(o => [o.id, o.name])) };
const TIER_COL = ['#a8743a', ...ORES.map(o => o.color)];

function iconCanvas(tpl, color, size = 24) {
  const src = icon(tpl, color);
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0);
  c.className = 'px ic';
  c.style.width = c.style.height = size + 'px';
  return c;
}
// Markup uses <i data-ic="tpl" data-c="#hex" data-s="20"></i>; hydrate swaps in pixel canvases.
const ic = (tpl, col, size = 20) => `<i data-ic="${tpl}" data-c="${col}" data-s="${size}"></i>`;
const resIc = (k, size = 16) => ic(RES_ICON[k][0], RES_ICON[k][1], size);
function hydrate(root) {
  root.querySelectorAll('i[data-ic]').forEach(el => el.replaceWith(iconCanvas(el.dataset.ic, el.dataset.c, +el.dataset.s)));
}

export class UI {
  constructor(game, renderer, hooks) {
    this.g = game;
    this.r = renderer;
    this.hooks = hooks;
    this.mode = null;
    this.panel = null;
    this.selAbil = null;
    this.selRelic = null;
    this.lastOpen = [];
    this.el = { top: $('#top'), side: $('#side'), bottom: $('#bottom'), toasts: $('#toasts'), panel: $('#panel'), title: $('#panelTitle'), body: $('#panelBody'), modal: $('#modal') };
    $('#panelClose').addEventListener('click', () => this.close());
    for (const k of ['top', 'side', 'bottom', 'body']) this.el[k].addEventListener('click', e => this.onClick(e));
    this.el.modal.addEventListener('click', e => this.onClick(e));
    // Hold-to-dig direction buttons.
    const hold = e => {
      const b = e.target.closest('[data-dir]');
      if (!b || !this.g.run) return;
      e.preventDefault();
      this.g.run.input = b.dataset.dir;
      b.setPointerCapture?.(e.pointerId);
    };
    const release = e => { if (e.target.closest('[data-dir]') && this.g.run) this.g.run.input = null; };
    this.el.bottom.addEventListener('pointerdown', hold);
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) this.el.bottom.addEventListener(ev, release);
    this.sync();
  }

  // ---------- Mode: base screen or run HUD ----------
  sync() {
    const mode = this.g.run ? 'run' : 'base';
    if (mode === this.mode) return;
    this.mode = mode;
    const { top, side, bottom } = this.el;
    document.body.dataset.mode = mode;
    if (mode === 'run') {
      this.close();
      top.innerHTML = `<div class="hud">
        <div class="hud-row"><div class="floor"><b id="hFloor"></b><small id="hBest"></small></div>
          <button type="button" class="hbtn" data-act="leave">귀환</button></div>
        <div class="meter dur"><i id="hDur"></i><span id="hDurT"></span></div>
        <div class="loot" id="hLoot"></div></div>`;
      side.innerHTML = '';
      bottom.innerHTML = `<div class="ctl">
        <div class="pad"><button type="button" data-dir="left" aria-label="왼쪽 파기">◀</button><button type="button" data-dir="down" aria-label="아래 파기">▼</button><button type="button" data-dir="right" aria-label="오른쪽 파기">▶</button></div>
        <button type="button" class="auto" data-act="auto" id="hAuto">자동</button>
        <button type="button" class="frenzy" data-act="frenzy" id="hFrenzy" aria-label="광란"><span>🔥</span><i id="hGauge"></i></button></div>`;
      this.sideKey = '';
    } else {
      top.innerHTML = `<div class="res" id="bRes"></div>
        <div class="base-info"><span id="bBest"></span><button type="button" class="hbtn" data-act="panel" data-id="menu" aria-label="설정">⚙</button></div>`;
      side.innerHTML = '';
      bottom.innerHTML = `<div class="startbar"><button type="button" data-act="floor" data-d="-1" aria-label="출발 층 낮추기">−</button>
        <button type="button" class="go" data-act="go" id="bGo"></button>
        <button type="button" data-act="floor" data-d="1" aria-label="출발 층 높이기">+</button></div>
        <nav class="nav" id="bNav">${[['craft', '제작', 'pick', '#c8c8d0'], ['equip', '장비', 'helm', '#5a8ae0'], ['town', '마을', 'camp', '#ff8a3a'], ['chest', '보물상자', 'chest', '#c8913a'], ['missions', '미션', 'scroll', '#e8dcc8']]
        .map(([id, label, tpl, c]) => `<button type="button" data-act="panel" data-id="${id}">${ic(tpl, c, 22)}<span>${label}</span><b class="dot" data-dot="${id}" hidden></b></button>`).join('')}</nav>`;
      hydrate(bottom);
    }
    this.update();
  }

  update() {
    this.sync();
    const g = this.g, s = g.s;
    if (this.mode === 'run') {
      const run = g.run;
      $('#hFloor').textContent = `${run.y}F`;
      $('#hBest').textContent = ` / 최고 ${s.stats.deepest}F`;
      $('#hDur').style.width = Math.max(0, (run.dur / run.maxDur) * 100) + '%';
      $('#hDurT').textContent = `${Math.max(0, run.dur)} / ${run.maxDur}`;
      const loot = run.loot;
      const parts = [['stone', loot.stone], ['gems', loot.gems], ['chests', loot.chests], ...Object.entries(loot.ores)].filter(([, n]) => n > 0);
      const key = parts.map(p => p.join(':')).join('|');
      if (key !== this.lootKey) {
        this.lootKey = key;
        const el = $('#hLoot');
        el.innerHTML = parts.map(([k, n]) => `<span>${resIc(k, 14)}${fmt(n)}</span>`).join('');
        hydrate(el);
      }
      const learned = ABILITIES.filter(a => s.abil[a.id]);
      const sk = learned.map(a => a.id).join();
      if (sk !== this.sideKey) {
        this.sideKey = sk;
        this.el.side.innerHTML = learned.map(a => `<div class="ab" title="${a.name}">${ic(a.icon, a.color, 18)}<div class="cd"><i data-cd="${a.id}"></i></div></div>`).join('');
        hydrate(this.el.side);
      }
      for (const a of learned) {
        const el = this.el.side.querySelector(`[data-cd="${a.id}"]`);
        if (el) el.style.width = Math.min(100, ((run.abil[a.id] || 0) / g.abilEvery(a)) * 100) + '%';
      }
      $('#hAuto').classList.toggle('on', s.auto);
      const gf = run.gauge / g.gaugeMax();
      $('#hGauge').style.height = gf * 100 + '%';
      $('#hFrenzy').classList.toggle('ready', gf >= 1);
      $('#hFrenzy').classList.toggle('active', run.frenzy > 0);
      return;
    }
    const keys = ['stone', 'gems', 'chests', ...ORES.filter(o => s.res[o.id] > 0).map(o => o.id)];
    const rk = keys.map(k => k + s.res[k]).join();
    if (rk !== this.resKey) {
      this.resKey = rk;
      const el = $('#bRes');
      el.innerHTML = keys.map(k => `<span title="${RES_NAME[k]}">${resIc(k, 14)}${fmt(s.res[k])}</span>`).join('');
      hydrate(el);
    }
    $('#bBest').textContent = `최고 ${s.stats.deepest}F`;
    $('#bGo').textContent = `${s.start}F에서 채굴 출발`;
    const dots = { craft: this.anyCraft(), chest: s.res.chests > 0, missions: g.missionsReady() > 0, equip: ABILITIES.some(a => g.abilityOpen(a) && (s.abil[a.id] || 0) < ABIL_MAX && s.res.gems >= abilityCost(a, s.abil[a.id] || 0)), town: BUILDINGS.some(b => (s.town[b.id] || 0) < BUILD_MAX && g.afford(g.buildCostOf(b.id))) };
    for (const [k, v] of Object.entries(dots)) { const d = this.el.bottom.querySelector(`[data-dot="${k}"]`); if (d) d.hidden = !v; }
  }
  anyCraft() {
    const g = this.g;
    return Object.keys(UPGRADES).some(id => g.afford(g.upgradeCostOf(id))) || GEAR_SLOTS.some(k => { const c = g.craftCost(k); return c && g.afford(c); });
  }

  // ---------- Clicks ----------
  onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const g = this.g, s = g.s, id = b.dataset.id, act = b.dataset.act;
    let changed = true;
    if (act === 'panel') return this.open(id);
    if (act === 'go') { this.close(); g.startRun(s.start); this.hooks.flush(); }
    else if (act === 'floor') {
      const opts = g.startOptions();
      const i = Math.max(0, Math.min(opts.length - 1, opts.indexOf(s.start) + Number(b.dataset.d)));
      s.start = opts[i] ?? 0;
    } else if (act === 'leave') { g.endRun(true); this.hooks.flush(); }
    else if (act === 'auto') s.auto = !s.auto;
    else if (act === 'frenzy') g.frenzy();
    else if (act === 'home') { g.leaveRun(); this.closeModal(); this.hooks.save(); }
    else if (act === 'up') { if (g.buyUpgrade(id)) this.flash(b); }
    else if (act === 'craft') { if (g.craft(id)) this.toast(`${GEAR_TIERS[s.gear[id]]} ${GEAR[id].name} 제작!`, 2); }
    else if (act === 'abil') this.selAbil = id;
    else if (act === 'learn') { if (g.learn(id)) this.toast(`${ABILITY[id].name} Lv ${s.abil[id]}`, 2); }
    else if (act === 'build') { if (g.build(id)) this.toast(`${BUILDINGS.find(x => x.id === id).name} Lv ${s.town[id]}`, 2); }
    else if (act === 'open') {
      const n = Math.min(Number(b.dataset.n), s.res.chests);
      this.lastOpen = [];
      for (let i = 0; i < n; i++) { const r = g.openChest(); if (r) this.lastOpen.push(r); }
      const best = this.lastOpen.reduce((m, r) => Math.max(m, RELIC[r.id].r), 0);
      if (best >= 2) this.toast(`${RARITY[best].name} 유물 획득!`, best + 1);
    } else if (act === 'relic') this.selRelic = id;
    else if (act === 'claim') { if (g.claim(id)) this.toast('미션 보상을 받았습니다', 2); }
    else if (act === 'save') { this.hooks.save(true); this.toast('저장했습니다'); }
    else if (act === 'export') { const t = $('#saveText'); t.value = this.hooks.exportSave(); t.select(); }
    else if (act === 'import') { const ok = this.hooks.importSave($('#saveText').value.trim()); this.toast(ok ? '불러왔습니다' : '불러오기에 실패했습니다'); }
    else if (act === 'reset') { if (b.dataset.sure) this.hooks.reset(); else { b.dataset.sure = '1'; b.textContent = '정말 초기화할까요? 한 번 더 누르세요'; changed = false; } }
    else if (act === 'modal-close') this.closeModal();
    else changed = false;
    if (changed) { this.update(); this.refreshPanel(true); }
  }
  flash(b) { b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse'); }

  // ---------- Events from the engine ----------
  handle(events) {
    for (const e of events) {
      if (e.t === 'layer') this.toast(`${e.y}F 돌파! 새 광석: ${ORES[Math.min(ORES.length - 1, e.y / 100)]?.name ?? ''}`, 3);
      else if (e.t === 'revive') this.toast('불사조 깃털이 타오릅니다!', 3);
      else if (e.t === 'break' && e.c.t === 'chest') this.toast('보물상자 발견!', 2);
      else if (e.t === 'end') this.runSummary(e);
      else if (e.t === 'start') { this.sync(); this.tip('controls', '<b>←↓→</b> 버튼(키보드 방향키)을 누르고 있으면 그쪽을 팝니다. <b>자동</b>을 켜 두면 알아서 광석을 찾아 내려가요. 게이지가 차면 <b>🔥 광란</b>!'); }
    }
  }
  runSummary(e) {
    const loot = e.loot;
    const rows = [['stone', loot.stone], ['gems', loot.gems], ['chests', loot.chests], ...Object.entries(loot.ores)].filter(([, n]) => n > 0);
    this.showModal(`<h2>${e.early ? '귀환' : '곡괭이가 닳았어요'}</h2>
      <p class="lead">${e.start}F → <b>${e.deepest}F</b> · 블록 ${fmt(e.broken)}개</p>
      <div class="lootgrid">${rows.map(([k, n]) => `<div>${resIc(k, 22)}<span>${RES_NAME[k]}</span><b>+${fmt(n)}</b></div>`).join('') || '<p>얻은 것이 없어요</p>'}</div>`,
    [['마을로', 'home']]);
  }

  // ---------- Panels ----------
  open(name) {
    this.panel = name;
    this.el.panel.hidden = false;
    this.refreshPanel(true);
  }
  close() { this.panel = null; this.el.panel.hidden = true; }
  refreshPanel(force) {
    if (!this.panel) return;
    if (!force && this.el.panel.contains(document.activeElement) && document.activeElement.tagName === 'TEXTAREA') return;
    const titles = { craft: '제작', equip: '장비', town: '마을', chest: '보물상자', missions: '미션', menu: '설정' };
    this.el.title.textContent = titles[this.panel];
    const body = this.el.body, top = body.scrollTop;
    body.innerHTML = this['p_' + this.panel]();
    hydrate(body);
    if (this.panel === 'equip') this.drawHeroPic();
    body.scrollTop = top;
  }
  cost(c) {
    const s = this.g.s;
    return `<span class="cost">${Object.entries(c).map(([k, v]) => `<span class="${s.res[k] >= v ? '' : 'no'}">${resIc(k, 14)}${fmt(v)}</span>`).join('')}</span>`;
  }

  p_craft() {
    const g = this.g, s = g.s;
    const ups = Object.entries(UPGRADES).map(([id, u]) => {
      const c = g.upgradeCostOf(id), lv = s.up[id];
      return `<div class="row">${ic(u.icon, '#c8c8d0', 26)}<div class="txt"><b>${u.name} <em>Lv ${lv}</em></b><small>${u.text(lv)} → ${u.text(lv + 1)}</small></div>
        <button type="button" class="pbtn" data-act="up" data-id="${id}" ${g.afford(c) ? '' : 'disabled'}>${this.cost(c)}</button></div>`;
    }).join('');
    const gear = GEAR_SLOTS.map(k => {
      const G = GEAR[k], t = s.gear[k], c = g.craftCost(k);
      const next = c ? `${G.fmt(fmtV(G.val(t)))} → <b>${G.fmt(fmtV(G.val(t + 1)))}</b>` : '최고 등급';
      const seen = !c || s.stats.deepest >= (t) * 100 - 100 || s.res[ORES[t].id] > 0;
      return `<div class="row">${ic(G.icon, TIER_COL[t], 26)}<div class="txt"><b>${GEAR_TIERS[t]} ${G.name}</b><small>${next}</small>${c && !seen ? `<small class="warn">${ORES[t].name}은(는) ${t * 100}F 근처부터 나와요</small>` : ''}</div>
        ${c ? `<button type="button" class="pbtn" data-act="craft" data-id="${k}" ${g.afford(c) ? '' : 'disabled'}>${GEAR_TIERS[t + 1]}<br>${this.cost(c)}</button>` : ''}</div>`;
    }).join('');
    return `<section class="psec"><h3>강화 <small>돌로 올리는 영구 능력치</small></h3>${ups}</section>
      <section class="psec"><h3>장비 제작 <small>더 깊은 광석으로 다음 등급을 만듭니다</small></h3>${gear}</section>`;
  }

  p_equip() {
    const g = this.g, s = g.s, d = g.d;
    const tiers = [1, 2, 3, 4, 5].map(tier => `<div class="tier"><span>T${tier}</span>${ABILITIES.filter(a => a.tier === tier).map(a => {
      const lv = s.abil[a.id] || 0, open = g.abilityOpen(a);
      return `<button type="button" class="abtn ${lv ? 'on' : ''} ${this.selAbil === a.id ? 'sel' : ''}" data-act="abil" data-id="${a.id}">${open ? ic(a.icon, a.color, 24) : '🔒'}<small>${lv ? 'Lv' + lv : open ? '배우기' : abilityUnlockFloor(a) + 'F'}</small></button>`;
    }).join('')}</div>`).join('');
    let detail = '<p class="hint">어빌리티를 누르면 설명이 나옵니다. 배운 어빌리티는 채굴 중 저절로 발동해요.</p>';
    const a = ABILITY[this.selAbil];
    if (a) {
      const lv = s.abil[a.id] || 0, open = g.abilityOpen(a), c = { gems: abilityCost(a, lv) };
      const every = Math.max(4, Math.round((a.every - Math.max(0, lv - 1)) * d.cd));
      detail = `<div class="detail">${ic(a.icon, a.color, 30)}<div class="txt"><b>${a.name} <em>${lv}/${ABIL_MAX}</em></b>
        <small>T${a.tier} · ${a.desc} · ${every}번 휘두를 때마다 · 피해 공격력 ×${(a.mult * (1 + 0.3 * Math.max(0, lv - 1)) * d.abil).toFixed(1)}</small>
        ${!open ? `<small class="warn">${abilityUnlockFloor(a)}F에 도달하면 배울 수 있어요</small>` : ''}</div>
        ${open && lv < ABIL_MAX ? `<button type="button" class="pbtn" data-act="learn" data-id="${a.id}" ${g.afford(c) ? '' : 'disabled'}>${lv ? '강화' : '배우기'}<br>${this.cost(c)}</button>` : ''}</div>`;
    }
    return `<section class="psec equip"><canvas class="px heropic" id="heroPic" width="${HERO[0].length}" height="${HERO.length}"></canvas>
        <div class="slots">${GEAR_SLOTS.map(k => `<div class="slot">${ic(GEAR[k].icon, TIER_COL[s.gear[k]], 22)}<span>${GEAR_TIERS[s.gear[k]]} ${GEAR[k].name}</span></div>`).join('')}</div></section>
      <section class="psec"><div class="stats">
        <div>${ic('pick', '#c8c8d0', 18)}<span>공격</span><b>${fmt(d.atk)}</b></div><div>${ic('armor', '#5a8ae0', 18)}<span>내구</span><b>${fmt(d.dur)}</b></div>
        <div>${ic('boots', '#b07a44', 18)}<span>간격</span><b>${d.interval.toFixed(2)}초</b></div><div>${ic('clover', '#6bbf5a', 18)}<span>행운</span><b>×${d.luck.toFixed(2)}</b></div></div></section>
      <section class="psec"><h3>어빌리티 <small>보석 ${fmt(s.res.gems)}개</small></h3><div class="tiers">${tiers}</div>${detail}</section>`;
  }
  drawHeroPic() {
    const c = $('#heroPic');
    if (c) c.getContext('2d').drawImage(sprite('hero', HERO, HERO_PAL), 0, 0);
  }

  p_town() {
    const g = this.g, s = g.s;
    const rows = BUILDINGS.map(b => {
      const lv = s.town[b.id] || 0, c = g.buildCostOf(b.id);
      return `<div class="card">${ic(b.icon, b.color, 32)}<div class="txt"><b>${b.name} <em>Lv ${lv}/${BUILD_MAX}</em></b><small>${b.desc}</small>
        <small>${lv ? b.text(b.per * lv) : '아직 없음'}${lv < BUILD_MAX ? ` → <b>${b.text(b.per * (lv + 1))}</b>` : ''}</small></div>
        ${lv < BUILD_MAX ? `<button type="button" class="pbtn" data-act="build" data-id="${b.id}" ${g.afford(c) ? '' : 'disabled'}>${lv ? '확장' : '건설'}<br>${this.cost(c)}</button>` : ''}</div>`;
    }).join('');
    const hut = g.d.idle ? `<p class="hint">광부 오두막: 시간당 돌 약 ${fmt(g.d.idle * (1 + s.stats.deepest / 50))}개와 ${ORES[Math.min(ORES.length - 1, Math.floor(s.stats.deepest / 100))].name} ${((s.town.hut || 0) * 1.5).toFixed(1)}개 (창을 닫아도 계속)</p>` : '';
    return `<section class="psec"><h3>마을 시설 <small>영구 보너스</small></h3>${hut}${rows}</section>`;
  }

  p_chest() {
    const s = this.g.s;
    const res = this.lastOpen.length ? `<div class="opened">${this.lastOpen.map(r => {
      const R = RELIC[r.id];
      return `<div class="relic r${R.r}">${ic(R.icon, R.color, 26)}<small>${R.name}</small><em>${r.maxed ? `+보석 ${r.gems}` : r.isNew ? 'NEW' : r.up ? `Lv ${r.lv}!` : '+1'}</em></div>`;
    }).join('')}</div>` : '';
    const grid = RELICS.map(R => {
      const o = s.relics[R.id];
      if (!o) return `<button type="button" class="relic unk" data-act="relic" data-id="${R.id}"><span>?</span></button>`;
      const next = RELIC_COPIES[o.lv] ?? o.copies, prev = RELIC_COPIES[o.lv - 1] ?? 0;
      return `<button type="button" class="relic r${R.r} ${this.selRelic === R.id ? 'sel' : ''}" data-act="relic" data-id="${R.id}">${ic(R.icon, R.color, 26)}<em>Lv${o.lv}</em><i class="cp"><i style="width:${o.lv >= RELIC_MAX ? 100 : ((o.copies - prev) / (next - prev)) * 100}%"></i></i></button>`;
    }).join('');
    let detail = '<p class="hint">유물은 영구 효과를 줍니다. 같은 유물을 또 얻으면 레벨이 올라 효과가 커져요.</p>';
    const R = RELIC[this.selRelic];
    if (R) {
      const o = s.relics[R.id];
      detail = o ? `<div class="detail">${ic(R.icon, R.color, 30)}<div class="txt"><b style="color:${RARITY[R.r].color}">${R.name} <em>Lv ${o.lv}/${RELIC_MAX}</em></b>
        <small>${fxText(R.fx, o.lv)}${o.lv < RELIC_MAX ? ` → 다음: ${fxText(R.fx, o.lv + 1)}` : ''}</small>
        <small>${RARITY[R.r].name} · 보유 ${o.copies}개${o.lv < RELIC_MAX ? ` · 다음 레벨까지 ${RELIC_COPIES[o.lv] - o.copies}개` : ' · 최대 레벨'}</small></div></div>`
        : `<p class="hint">아직 발견하지 못한 ${RARITY[R.r].name} 유물이에요.</p>`;
    }
    const owned = RELICS.filter(r => s.relics[r.id]).length;
    return `<section class="psec chestbox"><div class="big">${ic('chest', '#c8913a', 40)}<b>${fmt(s.res.chests)}</b></div>
        <div class="btns"><button type="button" class="pbtn big" data-act="open" data-n="1" ${s.res.chests ? '' : 'disabled'}>1개 열기</button>
        <button type="button" class="pbtn big" data-act="open" data-n="10" ${s.res.chests ? '' : 'disabled'}>10개 열기</button></div>${res}</section>
      <section class="psec"><h3>유물 도감 <small>${owned}/${RELICS.length}</small></h3>
        <p class="hint">${RARITY.map(r => `<span style="color:${r.color}">${r.name}</span>`).join(' · ')}</p><div class="relics">${grid}</div>${detail}</section>`;
  }

  p_missions() {
    const g = this.g;
    return `<section class="psec">${MISSIONS.map(m => {
      const st = g.mission(m);
      if (st.done) return `<div class="row"><div class="txt"><b>${m.name}</b><small>모두 달성!</small></div></div>`;
      const rw = Object.entries(st.reward).filter(([, v]) => v).map(([k, v]) => `${resIc(k, 14)}${v}`).join(' ');
      return `<div class="row"><div class="txt"><b>${m.name} ${fmt(st.goal)}${m.id === 'deep' ? 'F' : ''}</b>
        <div class="meter mini"><i style="width:${Math.min(100, (st.cur / st.goal) * 100)}%"></i><span>${fmt(Math.min(st.cur, st.goal))} / ${fmt(st.goal)}</span></div><small>보상 ${rw}</small></div>
        <button type="button" class="pbtn" data-act="claim" data-id="${m.id}" ${st.ready ? '' : 'disabled'}>받기</button></div>`;
    }).join('')}</section>`;
  }

  p_menu() {
    const cloud = this.hooks.cloudStatus();
    const s = this.g.s;
    return `<section class="psec"><h3>저장</h3><p class="hint">자동 저장: 5분마다, 창을 닫거나 숨길 때. 클라우드: ${esc(cloud.status)}</p>
        <button type="button" class="pbtn" data-act="save">지금 저장</button>
        <textarea id="saveText" rows="3" placeholder="내보내기 문자열"></textarea>
        <div class="btns"><button type="button" class="pbtn" data-act="export">내보내기</button><button type="button" class="pbtn" data-act="import">불러오기</button></div></section>
      <section class="psec"><h3>기록</h3><p class="hint">최고 ${s.stats.deepest}F · 출발 ${s.stats.runs}회 · 블록 ${fmt(s.stats.blocks)}개 · 상자 ${s.stats.opened}개 개봉</p></section>
      <section class="psec"><h3>도움말</h3><ul class="tips">${TIPS.map(t => `<li>${t}</li>`).join('')}</ul></section>
      <section class="psec"><button type="button" class="pbtn danger" data-act="reset">처음부터 다시 하기</button></section>`;
  }

  // ---------- Modal, toasts, one-time tips ----------
  showModal(html, buttons = [['확인', 'modal-close']]) {
    const m = this.el.modal;
    m.innerHTML = `<div class="modal-box">${html}<div class="modal-btns">${buttons.map(([t, act]) => `<button type="button" class="pbtn big" data-act="${act}">${t}</button>`).join('')}</div></div>`;
    hydrate(m);
    m.hidden = false;
    m.querySelector('.modal-btns button')?.focus();
  }
  closeModal() { this.el.modal.hidden = true; this.el.modal.innerHTML = ''; }
  tip(id, html) {
    const s = this.g.s;
    if (s.tips[id]) return;
    s.tips[id] = 1;
    this.toast(html, 0, 7000);
  }
  toast(html, tier = 0, ms = 3200) {
    const d = document.createElement('div');
    d.className = 'toast t' + tier;
    d.innerHTML = html;
    d.style.animationDuration = ms + 'ms';
    this.el.toasts.appendChild(d);
    setTimeout(() => d.remove(), ms);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
  }
  offlineReport(r) {
    if (!r.stone && !r.ore) return;
    const h = r.sec / 3600;
    this.showModal(`<h2>광부들이 일했어요</h2><p class="lead">자리를 비운 ${h >= 1 ? h.toFixed(1) + '시간' : Math.round(r.sec / 60) + '분'} 동안</p>
      <div class="lootgrid"><div>${resIc('stone', 22)}<span>돌</span><b>+${fmt(r.stone)}</b></div>${r.ore ? `<div>${resIc(r.oreId, 22)}<span>${ORE[r.oreId].name}</span><b>+${fmt(r.ore)}</b></div>` : ''}</div>`);
  }
  // Pointer on the mine canvas: hold on a block next to the miner to dig that way.
  canvasDir(clientX, clientY, rect) {
    const run = this.g.run;
    if (!run) return null;
    const x = Math.floor((((clientX - rect.left) / rect.width) * W) / T);
    const yPix = ((clientY - rect.top) / rect.height) * H;
    const y = Math.floor(yPix / T + this.r.cam);
    if (y === run.y + 1 && Math.abs(x - run.x) <= 1) return x === run.x ? 'down' : x < run.x ? 'left' : 'right';
    if (y === run.y && x !== run.x) return x < run.x ? 'left' : 'right';
    if (y > run.y) return 'down';
    return null;
  }
}

const fmtV = v => (v < 10 && v % 1 ? Math.round(v * 100) / 100 : Math.round(v));
