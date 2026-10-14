// DOM UI: bottom bar, Idleon-style panels, toasts and modals.
import {
  TIERS, SKILLS, LIFE_SKILLS, ITEMS, SPOTS, SPOT_LV, SKILL_RARES, SEASON_FISH, SEASON_NAME, RECIPES,
  PERKS, PERK_TREES, MEMORIES, PRESETS, STAT_NAMES, TOOL_TIERS, MASTER_TITLE, GIMMICK_TEXT, LUCK_CAP,
} from './data.js';
import {
  xpNeed, charXpNeed, toolTier, spotsUnlocked, skillPassive, nextMilestones, perkCost, ashFor,
  gearName, gearValue, charmValue, enhanceCost, pity,
} from './engine.js';
import { icon, sprite, HERO, HERO_PAL } from './sprites.js';
import { fmtShort } from './render.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const fmt = n => fmtShort(n);
const pct = (x, d = 1) => (x * 100).toFixed(d) + '%';

function iconCanvas(tpl, color, size = 36, extra) {
  const src = icon(tpl, color, extra);
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0);
  c.className = 'px';
  c.style.width = size + 'px';
  c.style.height = size + 'px';
  return c;
}
function itemIcon(id, size = 36) {
  const it = ITEMS[id];
  return iconCanvas(it.icon, it.color, size);
}
const SKILL_ICON = { combat: ['sword', '#c8ccd8'], mining: ['pick', '#b8c4d0'], wood: ['axe', '#b8c4d0'], forage: ['leaf', '#6bbf5a'], fish: ['fish', '#5ab4ff'], hunt: ['bow', '#a8743a'], alchemy: ['potion', '#c27bff'] };
const skillIcon = (k, size = 32) => iconCanvas(...SKILL_ICON[k], size);

export class UI {
  constructor(game, renderer, hooks) {
    this.g = game;
    this.r = renderer;
    this.hooks = hooks;
    this.panel = null;
    this.tab = {};
    this.sel = { skill: 'mining', item: null, codex: 'mining', bag: 'mat' };
    this.pointerDown = false;
    this.confirm = null;
    document.addEventListener('pointerdown', () => { this.pointerDown = true; });
    document.addEventListener('pointerup', () => { this.pointerDown = false; setTimeout(() => this.refreshPanel(), 50); });
    this.buildBar();
    this.buildPanel();
  }

  // ---------- Bottom bar ----------
  buildBar() {
    const bar = $('#bar');
    bar.innerHTML = `
      <div class="who">
        <canvas id="portrait" class="px" width="14" height="18"></canvas>
        <div class="who-txt"><div class="who-nm">모험가</div><div class="who-sub" id="whoSub"></div></div>
      </div>
      <div class="bars">
        <div class="meter hp"><i id="hpFill"></i><span id="hpTxt"></span><b>HP</b></div>
        <div class="meter sta"><i id="staFill"></i><span id="staTxt"></span><b>ST</b></div>
        <div class="meter xp"><i id="xpFill"></i><span id="xpTxt"></span><b>XP</b></div>
      </div>
      <nav class="btns" id="btns"></nav>`;
    const pc = $('#portrait').getContext('2d');
    pc.drawImage(sprite('hero', HERO, HERO_PAL), 0, 0);
    const btns = [
      ['mode', 'camp', '#ff8a3a', '순환'],
      ['char', 'person', '#3f9a5c', '캐릭터'],
      ['life', 'axe', '#b8c4d0', '생활'],
      ['bag', 'bag', '#c8913a', '가방'],
      ['codex', 'book', '#4a6ab8', '도감'],
      ['rebirth', 'cycle', '#ffb84a', '윤회'],
      ['log', 'scroll', '#e8dcc8', '일지'],
      ['menu', 'gear', '#8a8a96', '설정'],
    ];
    const nav = $('#btns');
    for (const [id, tpl, col, label] of btns) {
      const b = document.createElement('button');
      b.className = 'btn';
      b.id = 'b-' + id;
      b.type = 'button';
      b.appendChild(iconCanvas(tpl, col, 30, { h: '#3f9a5c', s: '#ffd8b0', t: '#efe9d8' }));
      const l = document.createElement('span');
      l.className = 'lbl';
      l.textContent = label;
      b.appendChild(l);
      const dot = document.createElement('i');
      dot.className = 'dot';
      dot.hidden = true;
      b.appendChild(dot);
      b.addEventListener('click', () => (id === 'mode' ? this.toggleFocus() : this.toggle(id)));
      nav.appendChild(b);
    }
  }

  toggleFocus() {
    const s = this.g.s;
    s.focus = !s.focus;
    if (s.focus && s.mode === 'fight') this.g.enterCamp('focus');
    this.toast(s.focus ? '생활 집중: 전투를 멈추고 야영지에서 생활만 합니다' : '순환: 싸우고, 지치면 야영합니다');
    this.updateBar();
  }

  updateBar() {
    const g = this.g, s = g.s, c = s.char, d = g.d;
    $('#whoSub').textContent = `윤회 ${s.rb.count}회 · LV ${c.lv}`;
    const set = (id, v, max, txt) => {
      $('#' + id + 'Fill').style.width = Math.max(0, Math.min(100, (v / max) * 100)) + '%';
      $('#' + id + 'Txt').textContent = txt;
    };
    set('hp', c.hp, d.hp, `${fmt(Math.max(0, c.hp))} / ${fmt(d.hp)}`);
    set('sta', c.sta, d.sta, `${Math.floor(c.sta)} / ${Math.floor(d.sta)}`);
    const need = charXpNeed(c.lv);
    set('xp', c.xp, need, `${fmt(c.xp)} / ${fmt(need)} (${((c.xp / need) * 100).toFixed(1)}%)`);
    const mb = $('#b-mode .lbl');
    mb.textContent = s.focus ? '생활집중' : '순환';
    $('#b-mode').classList.toggle('on', s.focus);
    $('#b-char .dot').hidden = !(c.pts > 0 && !c.auto);
    $('#b-rebirth .dot').hidden = !(s.rb.choices || (g.canRebirth() && s.rb.count === 0));
    $('#b-life .dot').hidden = !s.slots.some(x => x.blocked);
    for (const id of ['char', 'life', 'bag', 'codex', 'rebirth', 'log', 'menu']) $('#b-' + id).classList.toggle('active', this.panel === id);
    this.updateHud();
  }

  updateHud() {
    const g = this.g, s = g.s, c = s.char, env = g.env;
    const reg = g.region(c.floor);
    const gm = s.mode === 'fight' ? g.gimmick(c.floor) : null;
    const boss = c.floor % 10 === 0;
    const timeIcon = env.night ? '🌙' : '☀️';
    const w = env.weather === 'rain' ? ' · 🌧 비 (채집 +20%)' : env.weather === 'snow' ? ' · ❄ 눈' : '';
    $('#hudTL').innerHTML = `
      <div class="reg">${esc(s.mode === 'camp' ? '모닥불 야영지' : reg.name)}</div>
      <div class="fl">${s.mode === 'camp' ? `${esc(SKILLS[s.slots[0].k].name)} 중${s.focus ? ' · 생활 집중' : ''}` : `${c.floor}층 ${boss ? '· 보스' : `· ${c.kills}/10`}`}</div>
      <div class="env">${timeIcon} ${SEASON_NAME[env.season]}${w}${env.night ? ' · 밤낚시 희귀 ×1.3' : ''}</div>
      ${gm ? `<div class="gm ${s.pot[gm === 'poison' ? 'antidote' : 'warm'] || g.d.res[gm] >= 1 ? 'ok' : ''}">${esc(GIMMICK_TEXT[gm])}</div>` : ''}
      ${s.catUntil > s.time ? `<div class="env">✨ 행운의 촉매 ${Math.ceil((s.catUntil - s.time) / 60)}분</div>` : ''}`;
    $('#goals').innerHTML = g.goals().map(t => `<li>${esc(t)}</li>`).join('');
    // Clone insets
    const holder = $('#clones');
    const n = s.slots.length - 1;
    if (holder.childElementCount !== n) {
      holder.innerHTML = '';
      const list = [];
      for (let i = 0; i < n; i++) {
        const box = document.createElement('div');
        box.className = 'clone';
        const cv = document.createElement('canvas');
        cv.width = 160;
        cv.height = 90;
        cv.className = 'px';
        box.appendChild(cv);
        const lb = document.createElement('div');
        lb.className = 'clone-lb';
        box.appendChild(lb);
        holder.appendChild(box);
        list.push(cv);
      }
      this.r.setCloneCanvases(list);
    }
    holder.querySelectorAll('.clone-lb').forEach((lb, i) => {
      const k = s.slots[i + 1].k;
      lb.textContent = `분신 ${i + 1} · ${SKILLS[k].name} Lv.${s.skills[k].lv}`;
    });
  }

  toast(text, tier = 0) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.style.setProperty('--tc', TIERS[Math.min(6, tier)].color);
    t.textContent = text;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 3200);
    const all = $('#toasts').children;
    if (all.length > 4) all[0].remove();
  }

  handle(events) {
    for (const e of events) {
      if (e.t === 'slv' && (e.lv % 10 === 0 || e.lv < 10)) this.toast(`${SKILLS[e.k].name} Lv.${e.lv}${e.m ? ' · ' + e.m : ''}`, e.lv % 100 === 0 ? 4 : 1);
      else if (e.t === 'codex') { const it = ITEMS[e.id]; this.toast(`도감 등록 · ${it.name}`, it.tier); }
      else if (e.t === 'gear' && e.equip && e.g.tier >= 1) this.toast(`장착 · [${TIERS[e.g.tier].name}] ${gearName(e.g)}`, e.g.tier);
      else if (e.t === 'floor' && e.floor % 10 === 1) this.toast(`${e.floor}층 · ${this.g.region(e.floor).name}`, 2);
    }
  }

  // ---------- Panel ----------
  buildPanel() {
    $('#panelClose').addEventListener('click', () => this.close());
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (!$('#modal').hidden && !this.modalLocked) this.closeModal();
        else this.close();
      }
    });
  }
  toggle(id) {
    if (this.panel === id) this.close();
    else this.open(id);
  }
  open(id) {
    this.panel = id;
    $('#panel').hidden = false;
    $('#panel').dataset.kind = id;
    this.confirm = null;
    this.renderPanel();
    this.updateBar();
  }
  close() {
    this.panel = null;
    $('#panel').hidden = true;
    this.updateBar();
  }
  refreshPanel() {
    if (!this.panel || this.pointerDown) return;
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT')) return;
    this.renderPanel();
  }
  renderPanel() {
    const body = $('#panelBody');
    const scroll = body.scrollTop;
    const focusId = document.activeElement && body.contains(document.activeElement) ? document.activeElement.dataset.fid : null;
    const titles = { char: '캐릭터 정보', life: '생활 스킬', bag: '가방', codex: '도감', rebirth: '윤회', log: '모험 일지', menu: '설정' };
    $('#panelTitle').textContent = titles[this.panel];
    body.innerHTML = '';
    this['p_' + this.panel](body);
    body.scrollTop = scroll;
    if (focusId) { const el = body.querySelector(`[data-fid="${focusId}"]`); if (el) el.focus(); }
  }
  act(fn) {
    fn();
    this.g.calc();
    this.renderPanel();
    this.updateBar();
  }
  btn(label, onClick, opts = {}) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pbtn' + (opts.cls ? ' ' + opts.cls : '');
    b.innerHTML = label;
    if (opts.fid) b.dataset.fid = opts.fid;
    b.disabled = !!opts.disabled;
    b.addEventListener('click', () => this.act(onClick));
    return b;
  }
  section(parent, title) {
    const sec = document.createElement('section');
    sec.className = 'psec';
    if (title) {
      const h = document.createElement('h3');
      h.textContent = title;
      sec.appendChild(h);
    }
    parent.appendChild(sec);
    return sec;
  }
  html(parent, markup, cls) {
    const d = document.createElement('div');
    if (cls) d.className = cls;
    d.innerHTML = markup;
    parent.appendChild(d);
    return d;
  }

  // ----- Character
  p_char(body) {
    const g = this.g, s = g.s, c = s.char, d = g.d;
    const top = this.html(body, '', 'char-top');
    const pic = document.createElement('canvas');
    pic.width = 14; pic.height = 18;
    pic.className = 'px char-pic';
    pic.getContext('2d').drawImage(sprite('hero', HERO, HERO_PAL), 0, 0);
    top.appendChild(pic);
    const titles = Object.keys(MASTER_TITLE).filter(k => s.skills[k].lv >= 1000).map(k => MASTER_TITLE[k]);
    this.html(top, `<div class="char-nm">모험가 <span class="lv">LV ${c.lv}</span></div>
      <div class="char-sub">윤회 ${s.rb.count}회 · 최고 ${s.rb.bestFloor}층${titles.length ? ' · ' + titles.join(', ') : ''}</div>
      <div class="char-sub">${s.rb.memory ? `전생의 기억: <b>${esc(MEMORIES[s.rb.memory].name)}</b> (${esc(MEMORIES[s.rb.memory].desc)})` : '전생의 기억 없음'}</div>`, 'char-meta');

    const st = this.section(body, '능력치');
    const rows = [
      ['최대 HP', fmt(d.hp)], ['공격력', fmt(d.atk)], ['공격 간격', d.interval.toFixed(2) + '초'],
      ['치명타 확률', pct(d.critC)], ['치명타 피해', '×' + d.critD.toFixed(2)], ['회피', pct(d.dodge)],
      ['최대 스태미나', Math.floor(d.sta)], ['행운 배율', `×${d.luck.toFixed(2)} (상한 ×${d.luckCap.toFixed(1)})`],
      ['도감 보너스', '+' + pct(d.codex)], ['골드', fmt(c.gold)],
    ];
    this.html(st, rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join(''), 'statlist');

    const al = this.section(body, `스탯 분배 · 남은 포인트 ${c.pts}`);
    const grid = this.html(al, '', 'alloc');
    for (const k of Object.keys(STAT_NAMES)) {
      const row = this.html(grid, `<span>${STAT_NAMES[k]}</span><b>${c.st[k]}</b>`, 'alloc-row');
      row.appendChild(this.btn('+1', () => g.allocate(k, 1), { disabled: c.pts < 1, fid: 'a1' + k }));
      row.appendChild(this.btn('+10', () => g.allocate(k, 10), { disabled: c.pts < 1, fid: 'a10' + k }));
    }
    const pr = this.html(al, '', 'chips');
    for (const [k, p] of Object.entries(PRESETS)) {
      pr.appendChild(this.btn(p.name, () => { c.preset = k; if (c.auto) g.respec(); }, { cls: c.preset === k ? 'chip on' : 'chip' }));
    }
    pr.appendChild(this.btn(c.auto ? '자동 분배 켜짐' : '자동 분배 꺼짐', () => { c.auto = !c.auto; if (c.auto) g.autoAllocate(); }, { cls: c.auto ? 'chip on' : 'chip' }));
    pr.appendChild(this.btn('초기화', () => g.respec(), { cls: 'chip' }));

    const ge = this.section(body, '장비 (윤회 시 초기화)');
    for (const slot of ['weapon', 'armor', 'charm']) {
      const gg = c.gear[slot];
      const row = this.html(ge, '', 'gear-row');
      row.appendChild(iconCanvas(slot === 'weapon' ? 'sword' : slot === 'armor' ? 'armor' : 'charm', gg ? TIERS[gg.tier].color : '#5a5a66', 32));
      if (gg) {
        const val = slot === 'charm' ? `행운 +${charmValue(gg).luck.toFixed(3)} · 치명 +${pct(charmValue(gg).crit)}` : `${slot === 'weapon' ? '공격력' : 'HP'} +${fmt(gearValue(gg))}`;
        this.html(row, `<b style="color:${TIERS[gg.tier].color}">[${TIERS[gg.tier].name}] ${esc(gearName(gg))}</b><small>${gg.f}층 · ${val}</small>`, 'gear-txt');
        const cost = enhanceCost(gg);
        row.appendChild(this.btn(`강화 ${fmt(cost)}g`, () => g.enhance(slot), { disabled: c.gold < cost, fid: 'en' + slot }));
      } else this.html(row, '<b>비어 있음</b><small>몬스터를 쓰러뜨리면 3% 확률로 떨어집니다</small>', 'gear-txt');
    }
  }

  // ----- Life skills
  p_life(body) {
    const g = this.g, s = g.s;
    const sl = this.section(body, '배치 · 야영 중에는 야영 슬롯, 분신은 항상 일합니다');
    const chips = this.html(sl, '', 'slots');
    s.slots.forEach((x, i) => {
      const el = this.html(chips, `<small>${i === 0 ? '야영' : '분신 ' + i}</small><b>${SKILLS[x.k].name}</b>${x.blocked ? '<em>재료 부족</em>' : ''}`, 'slot' + (i === 0 ? ' main' : ''));
      el.prepend(skillIcon(x.k, 26));
    });
    if (s.slots.length < 3) this.html(sl, `<p class="hint">분신 슬롯은 윤회 특성 「분신술」로 늘어납니다 (${s.slots.length - 1}/2)</p>`);

    const grid = this.html(body, '', 'skill-grid');
    for (const k of Object.keys(SKILLS)) {
      const sk = s.skills[k];
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'skill-card' + (this.sel.skill === k ? ' sel' : '');
      card.dataset.fid = 'sk' + k;
      card.appendChild(skillIcon(k, 30));
      const need = xpNeed(sk.lv);
      card.insertAdjacentHTML('beforeend', `<div class="sc-nm">${SKILLS[k].name}</div><div class="sc-lv">Lv.${sk.lv}</div>
        <div class="sc-bar"><i style="width:${(sk.xp / need) * 100}%"></i></div>
        <div class="sc-tool">${k === 'combat' ? '처치로 성장' : TOOL_TIERS[toolTier(sk.lv)].name + ' 도구'}</div>`);
      card.addEventListener('click', () => { this.sel.skill = k; this.renderPanel(); });
      grid.appendChild(card);
    }
    this.skillDetail(body, this.sel.skill);
  }

  skillDetail(body, k) {
    const g = this.g, s = g.s, sk = s.skills[k];
    const det = this.section(body, `${SKILLS[k].name} Lv.${sk.lv}`);
    const need = xpNeed(sk.lv);
    const pb = skillPassive(sk.lv);
    const speed = k === 'combat' ? null : g.skillSpeed(k);
    const mult = g.rareMult(k);
    const eP = 1 / (1e-6 * Math.sqrt(mult));
    this.html(det, `
      <div><span>경험치</span><b>${fmt(sk.xp)} / ${fmt(need)}</b></div>
      <div><span>패시브 (${esc(SKILLS[k].stat)})</span><b>+${k === 'fish' ? (sk.lv * 0.0005 + Math.floor(sk.lv / 10) * 0.005).toFixed(3) + ' 행운' : pct(pb)}</b></div>
      ${speed ? `<div><span>작업 속도</span><b>×${speed.toFixed(2)}</b></div>` : ''}
      <div><span>희귀 이상 확률 배율</span><b>×${mult.toFixed(2)}</b></div>
      <div><span>누적 행동</span><b>${sk.n.toLocaleString()}회</b></div>
      <div><span>불운 게이지 (태초)</span><b>${((sk.dryP / eP) * 100).toFixed(1)}%${pity(sk.dryP / eP) > 1 ? ` · 확률 ×${pity(sk.dryP / eP).toFixed(2)}` : ''}</b></div>`, 'statlist');
    if (k !== 'combat') {
      const row = this.html(det, '', 'chips');
      s.slots.forEach((x, i) => {
        row.appendChild(this.btn(x.k === k ? `${i === 0 ? '야영' : '분신 ' + i} 배치됨` : `${i === 0 ? '야영' : '분신 ' + i}에 배치`, () => g.setSlotSkill(i, k), { cls: x.k === k ? 'chip on' : 'chip', fid: 'as' + i }));
      });
    }
    // Milestones
    const ms = nextMilestones(k, sk.lv, 5);
    this.html(det, `<h4>다음 보상</h4><ul class="ms">${ms.map(m => `<li class="${m.lv % 100 === 0 || m.lv >= 250 ? 'big' : ''}"><b>Lv.${m.lv}</b> ${esc(m.text)}</li>`).join('')}</ul>`);
    // Spots
    if (SPOTS[k]) {
      const sp = this.section(body, '장소');
      const unlocked = spotsUnlocked(sk.lv);
      SPOTS[k].forEach((spot, i) => {
        const locked = i >= unlocked;
        const row = this.html(sp, '', 'spot' + (s.spots[k] === i ? ' on' : '') + (locked ? ' locked' : ''));
        const icons = this.html(row, '', 'spot-icons');
        for (const id of spot.items) icons.appendChild(s.codex[id] || !locked ? itemIcon(id, 22) : iconCanvas(ITEMS[id].icon, '#2a2a34', 22));
        this.html(row, `<b>${esc(spot.name)}</b><small>${locked ? `Lv.${SPOT_LV[i]} 필요` : `경험치 ${[8, 14, 24, 40, 65][i]}/회`}</small>`, 'spot-txt');
        if (!locked) row.appendChild(this.btn(s.spots[k] === i ? '선택됨' : '선택', () => { s.spots[k] = i; }, { cls: 'chip' + (s.spots[k] === i ? ' on' : ''), fid: 'sp' + i }));
      });
    }
    if (k === 'alchemy') this.alchemyDetail(body);
    // Skill-wide rares
    const rr = this.section(body, '희귀 보상 (모든 장소 공통)');
    const ul = this.html(rr, '', 'rares');
    SKILL_RARES[k].forEach((id, i) => {
      const it = ITEMS[id], known = s.codex[id];
      const r = this.html(ul, `<div><b style="color:${TIERS[it.tier].color}">${known ? esc(it.name) : '???'}</b><small>${TIERS[it.tier].name} · ${['0.3%', '0.02%', '0.002%', '0.0001%'][i]}${it.effect && known ? ' · ' + esc(it.effect) : ''}${known ? ` · 보유 ${s.items[id] || 0}` : ''}</small></div>`, 'rare-row');
      r.prepend(known ? itemIcon(id, 26) : iconCanvas(it.icon, '#2a2a34', 26));
    });
  }

  alchemyDetail(body) {
    const g = this.g, s = g.s, lv = s.skills.alchemy.lv;
    const sec = this.section(body, '레시피');
    for (const r of RECIPES) {
      if (r.secret && !s.secret) continue;
      const it = ITEMS[r.id];
      const locked = lv < r.lv;
      const done = r.max && g.crafted(r) >= r.max;
      const row = this.html(sec, '', 'recipe' + (s.recipe === r.id ? ' on' : '') + (locked ? ' locked' : ''));
      row.appendChild(itemIcon(r.id, 30));
      const ins = Object.entries(r.in).map(([id, n]) => {
        const have = s.items[id] || 0;
        return `<span class="${have >= n ? 'ok' : 'no'}">${esc(ITEMS[id].name)} ${fmt(have)}/${n}</span>`;
      }).join('');
      this.html(row, `<b>${esc(it.name)}${r.max ? ` <small>(${g.crafted(r)}/${r.max})</small>` : ` <small>보유 ${s.items[r.id] || 0}</small>`}</b>
        <small>${esc(it.desc || '')}</small><div class="ins">${locked ? `연금술 Lv.${r.lv} 필요` : ins}</div>`, 'recipe-txt');
      if (!locked && !done) row.appendChild(this.btn(s.recipe === r.id ? '제작 중' : '선택', () => { s.recipe = r.id; }, { cls: 'chip' + (s.recipe === r.id ? ' on' : ''), fid: 'rc' + r.id }));
    }
    const pa = this.section(body, '물약 자동 사용 (전투 시작 시 1개씩)');
    const chips = this.html(pa, '', 'chips');
    for (const id of ['p_str', 'p_hp', 'p_sta', 'p_luck', 'p_antidote', 'p_warm']) {
      const type = ITEMS[id].potion;
      chips.appendChild(this.btn(`${ITEMS[id].name} ${s.potAuto[type] ? 'ON' : 'OFF'} · ${s.items[id] || 0}`, () => { s.potAuto[type] = !s.potAuto[type]; }, { cls: 'chip' + (s.potAuto[type] ? ' on' : ''), fid: 'pa' + id }));
    }
    this.html(pa, '<p class="hint">해독·온기 물약은 해당 지역에서 저항이 부족할 때만 사용됩니다. 실패해도 경험치는 1.5배를 받습니다.</p>');
  }

  // ----- Bag
  p_bag(body) {
    const s = this.g.s;
    const tabs = this.html(body, '', 'chips');
    const cats = { mat: '재료', pot: '물약·영약', rare: '영웅 이상' };
    for (const [k, v] of Object.entries(cats)) tabs.appendChild(this.btn(v, () => { this.sel.bag = k; this.sel.item = null; }, { cls: 'chip' + (this.sel.bag === k ? ' on' : ''), fid: 'bt' + k }));
    const ids = Object.keys(s.items).filter(id => s.items[id] > 0).filter(id => {
      const it = ITEMS[id];
      if (this.sel.bag === 'rare') return it.tier >= 3;
      if (this.sel.bag === 'pot') return it.skill === 'alchemy' && it.tier < 3;
      return it.tier < 3 && it.skill !== 'alchemy';
    }).sort((a, b) => ITEMS[b].tier - ITEMS[a].tier || (ITEMS[a].skill > ITEMS[b].skill ? 1 : -1));
    const grid = this.html(body, '', 'slotgrid');
    if (!ids.length) this.html(grid, '<p class="hint">아직 비어 있어요. 야영지에서 생활 스킬을 돌려보세요.</p>');
    for (const id of ids) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell t' + ITEMS[id].tier + (this.sel.item === id ? ' sel' : '');
      cell.dataset.fid = 'it' + id;
      cell.appendChild(itemIcon(id, 34));
      cell.insertAdjacentHTML('beforeend', `<span class="cnt">${fmt(s.items[id])}</span>`);
      cell.addEventListener('click', () => { this.sel.item = id; this.renderPanel(); });
      grid.appendChild(cell);
    }
    if (this.sel.item && s.items[this.sel.item] > 0) this.itemInfo(body, this.sel.item);
  }
  itemInfo(body, id) {
    const s = this.g.s, it = ITEMS[id];
    const box = this.section(body);
    box.classList.add('iteminfo');
    box.appendChild(itemIcon(id, 40));
    const src = it.skill === 'combat' ? '전투' : SKILLS[it.skill].name;
    this.html(box, `<b style="color:${TIERS[it.tier].color}">${esc(it.name)}</b>
      <small>${TIERS[it.tier].name} · ${src} · 보유 ${fmt(s.items[id] || 0)}${s.records[id] ? ` · 최고 ${s.records[id]}kg` : ''}</small>
      <small>${esc(it.effect || it.desc || '도감 보너스 +' + pct(TIERS[it.tier].codex))}</small>`, 'ii-txt');
    if (id === 'x_cat') box.appendChild(this.btn('사용', () => this.g.useItem('x_cat'), { fid: 'use' }));
  }

  // ----- Codex
  p_codex(body) {
    const g = this.g, s = g.s;
    const all = Object.keys(ITEMS);
    const found = all.filter(id => s.codex[id]).length;
    this.html(body, `<div class="codex-head"><b>${found} / ${all.length}</b> 등록 · 도감 보너스 <b>+${pct(g.d.codex)}</b> (공격력·HP)</div>`);
    const tabs = this.html(body, '', 'chips');
    for (const k of Object.keys(SKILLS)) tabs.appendChild(this.btn(SKILLS[k].short, () => { this.sel.codex = k; this.sel.item = null; }, { cls: 'chip' + (this.sel.codex === k ? ' on' : ''), fid: 'cx' + k }));
    const ids = all.filter(id => ITEMS[id].skill === this.sel.codex);
    const n = ids.filter(id => s.codex[id]).length;
    this.html(body, `<p class="hint">${SKILLS[this.sel.codex].name}: ${n}/${ids.length} · 등급별 보너스 일반 +0.2% … 태초 +20%${this.sel.codex === 'fish' ? ' · 계절 물고기는 해당 계절에만 낚입니다' : ''}</p>`);
    const grid = this.html(body, '', 'slotgrid');
    for (const id of ids) {
      const it = ITEMS[id], known = s.codex[id];
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell t' + it.tier + (known ? '' : ' unknown') + (this.sel.item === id ? ' sel' : '');
      cell.dataset.fid = 'cx' + id;
      cell.appendChild(known ? itemIcon(id, 34) : iconCanvas(it.icon, '#22222c', 34));
      cell.addEventListener('click', () => { this.sel.item = id; this.renderPanel(); });
      grid.appendChild(cell);
    }
    const id = this.sel.item;
    if (id && ITEMS[id].skill === this.sel.codex) {
      if (s.codex[id]) this.itemInfo(body, id);
      else {
        const it = ITEMS[id];
        const season = it.season !== undefined ? ` · ${SEASON_NAME[it.season]} 한정` : '';
        this.html(this.section(body), `<b>??? </b><small>${TIERS[it.tier].name}${season} · 아직 발견하지 못했습니다</small>`, 'ii-txt');
      }
    }
    if (this.sel.codex === 'fish') {
      const recs = Object.entries(s.records).sort((a, b) => b[1] / ITEMS[b[0]].w - a[1] / ITEMS[a[0]].w).slice(0, 8);
      if (recs.length) this.html(this.section(body, '어종별 최고 기록'), recs.map(([fid, w]) => `<div><span>${esc(ITEMS[fid].name)}</span><b>${w}kg</b></div>`).join(''), 'statlist');
    }
  }

  // ----- Rebirth
  p_rebirth(body) {
    const g = this.g, s = g.s, rb = s.rb, c = s.char;
    if (rb.choices) {
      const sec = this.section(body, '전생의 기억을 하나 고르세요 (이번 회차 동안 적용)');
      const row = this.html(sec, '', 'memories');
      for (const k of rb.choices) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'memory';
        b.innerHTML = `<b>${esc(MEMORIES[k].name)}</b><small>${esc(MEMORIES[k].desc)}</small>`;
        b.addEventListener('click', () => this.act(() => g.chooseMemory(k)));
        row.appendChild(b);
      }
    }
    const gain = ashFor(c.maxFloor);
    const top = this.section(body, '모닥불의 재');
    this.html(top, `<div class="ash"><b>${fmt(rb.ash)}</b><small>보유 · 누적 ${fmt(rb.totalAsh)}</small></div>
      <div class="statlist"><div><span>이번 회차 최고층</span><b>${c.maxFloor}층</b></div>
      <div><span>지금 윤회하면</span><b>재 +${gain}</b></div></div>
      <p class="hint">유지: 생활·전투 숙련 레벨, 도감, 재료, 영약, 기록 · 초기화: 캐릭터 레벨, 스탯, 장비, 골드, 층</p>`);
    if (!g.canRebirth()) this.html(top, '<p class="hint">21층에 도달하면 윤회할 수 있습니다. 재는 (최고층 ÷ 5)^1.5 만큼 얻습니다.</p>');
    else if (this.confirm === 'rebirth') {
      const row = this.html(top, '<p class="warn">정말 윤회할까요? 장비와 레벨이 초기화됩니다.</p>', 'confirm');
      row.appendChild(this.btn('윤회한다', () => { g.rebirth(); this.confirm = null; }, { cls: 'danger', fid: 'rbyes' }));
      row.appendChild(this.btn('취소', () => { this.confirm = null; }, { fid: 'rbno' }));
    } else top.appendChild(this.btn(`윤회하기 (재 +${gain})`, () => { this.confirm = 'rebirth'; }, { cls: 'big', fid: 'rb' }));

    const trees = this.html(body, '', 'perk-trees');
    for (const [tk, tname] of Object.entries(PERK_TREES)) {
      const col = this.section(trees, tname);
      col.classList.add('tree-' + tk);
      for (const [id, p] of Object.entries(PERKS)) {
        if (p.tree !== tk) continue;
        const lv = rb.perks[id] || 0;
        const maxed = p.max && lv >= p.max;
        const cost = perkCost(id, lv);
        const row = this.html(col, `<div><b>${esc(p.name)} <small>Lv.${lv}${p.max ? '/' + p.max : ''}</small></b><small>${esc(p.desc)}</small></div>`, 'perk');
        row.appendChild(this.btn(maxed ? '최대' : `재 ${fmt(cost)}`, () => g.buyPerk(id), { disabled: maxed || rb.ash < cost, fid: 'pk' + id }));
      }
    }
  }

  // ----- Log
  p_log(body) {
    const s = this.g.s;
    const hall = this.section(body, '명예의 전당 (전설 이상)');
    if (!s.hall.length) this.html(hall, '<p class="hint">아직 기록이 없습니다. 전설 등급(0.02%)부터 이곳에 영원히 남습니다.</p>');
    for (const h of s.hall.slice(0, 20)) {
      const it = ITEMS[h.id];
      const row = this.html(hall, `<div><b style="color:${TIERS[it.tier].color}">[${TIERS[it.tier].name}] ${esc(it.name)}</b>
        <small>${new Date(h.at).toLocaleString('ko-KR')} · ${esc(SKILLS[h.src] ? SKILLS[h.src].name : '')} ${h.n.toLocaleString()}번째 시도</small></div>`, 'hall-row');
      row.prepend(itemIcon(h.id, 28));
    }
    const lg = this.section(body, '최근 일지');
    this.html(lg, s.log.slice(0, 40).map(l => `<li><time>${new Date(l.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</time><span style="color:${TIERS[Math.min(6, l.tier)].color}">${esc(l.text)}</span></li>`).join('') || '<li>아직 기록이 없습니다.</li>', 'loglist');
    const st = s.stats;
    this.html(this.section(body, '누적 기록'), `<div><span>처치</span><b>${st.kills.toLocaleString()}</b></div><div><span>보스</span><b>${st.bosses}</b></div>
      <div><span>쓰러짐</span><b>${st.deaths}</b></div><div><span>생활 행동</span><b>${st.actions.toLocaleString()}</b></div>
      <div><span>플레이 시간</span><b>${(s.time / 3600).toFixed(1)}시간</b></div>`, 'statlist');
  }

  // ----- Settings
  p_menu(body) {
    const g = this.g, s = g.s;
    const sv = this.section(body, '저장');
    this.html(sv, `<p class="hint">10초마다 이 브라우저에 자동 저장됩니다. 브라우저 데이터를 지우면 사라지니, 오래 플레이하려면 내보내기 문자열을 따로 보관하세요. 오프라인 진행 상한: ${(g.offlineCapSec() / 3600).toFixed(0)}시간.</p>`);
    sv.appendChild(this.btn('지금 저장', () => { this.hooks.save(); this.toast('저장했습니다'); }, { fid: 'save' }));
    const ex = this.section(body, '내보내기');
    const ta = document.createElement('textarea');
    ta.id = 'exportBox';
    ta.readOnly = true;
    ta.rows = 3;
    ta.value = this.hooks.exportSave();
    ta.dataset.fid = 'ex';
    ex.appendChild(ta);
    ex.appendChild(this.btn('복사', () => {
      const t = $('#exportBox');
      navigator.clipboard.writeText(t.value).then(() => this.toast('복사했습니다'), () => { t.select(); this.toast('텍스트를 선택했습니다. 직접 복사하세요'); });
    }, { fid: 'copy' }));
    const im = this.section(body, '가져오기');
    const ti = document.createElement('textarea');
    ti.id = 'importBox';
    ti.rows = 3;
    ti.placeholder = '내보낸 문자열을 붙여넣으세요';
    ti.dataset.fid = 'im';
    im.appendChild(ti);
    im.appendChild(this.btn('불러오기', () => {
      const ok = this.hooks.importSave($('#importBox').value.trim());
      this.toast(ok ? '불러왔습니다' : '문자열을 읽을 수 없습니다. 내보내기로 만든 문자열 전체를 붙여넣었는지 확인하세요', ok ? 2 : 5);
    }, { fid: 'load' }));
    const rs = this.section(body, '처음부터');
    if (this.confirm === 'reset') {
      const row = this.html(rs, '<p class="warn">모든 진행이 사라집니다. 정말 초기화할까요?</p>', 'confirm');
      row.appendChild(this.btn('초기화', () => this.hooks.reset(), { cls: 'danger', fid: 'rsyes' }));
      row.appendChild(this.btn('취소', () => { this.confirm = null; }, { fid: 'rsno' }));
    } else rs.appendChild(this.btn('데이터 초기화', () => { this.confirm = 'reset'; }, { cls: 'danger', fid: 'rs' }));
  }

  // ---------- Modals ----------
  showModal(html, buttons = [], locked = false) {
    const m = $('#modal');
    m.innerHTML = `<div class="modal-box">${html}<div class="modal-btns"></div></div>`;
    const row = m.querySelector('.modal-btns');
    for (const [label, fn] of buttons) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pbtn big';
      b.textContent = label;
      b.addEventListener('click', () => { if (fn) fn(); this.closeModal(); });
      row.appendChild(b);
    }
    this.modalLocked = locked;
    m.hidden = false;
    const first = row.querySelector('button');
    if (first) first.focus();
  }
  closeModal() { $('#modal').hidden = true; this.modalLocked = false; }

  offlineReport(sm, rng) {
    const h = sm.sec / 3600;
    const time = h >= 1 ? `${Math.floor(h)}시간 ${Math.round((h % 1) * 60)}분` : `${Math.round(sm.sec / 60)}분`;
    const jokes = [
      `모닥불에 소시지를 ${1 + Math.floor(rng() * Math.max(1, h * 3))}번 태웠습니다.`,
      `슬라임에게 ${Math.floor(sm.kills / 37) + 1}번 미끄러졌습니다.`,
      `별을 ${Math.floor(h * 11) + 3}개 세다가 잠들었습니다.`,
      `전설의 메기를 ${Math.floor(rng() * 3) + 1}번 놓쳤습니다.`,
      `혼잣말을 ${Math.floor(h * 40) + 5}번 했습니다.`,
    ];
    const joke = jokes[Math.floor(rng() * jokes.length)];
    const drops = sm.drops.map((n, i) => (n ? `<span style="color:${TIERS[i].color}">${TIERS[i].name} ${fmt(n)}</span>` : '')).filter(Boolean).join(' · ');
    const best = [...new Set(sm.best)].sort((a, b) => ITEMS[b].tier - ITEMS[a].tier).slice(0, 6)
      .map(id => `<li style="color:${TIERS[ITEMS[id].tier].color}">[${TIERS[ITEMS[id].tier].name}] ${esc(ITEMS[id].name)}</li>`).join('');
    const skills = sm.skills.map(x => `<li>${esc(SKILLS[x.k].name)} Lv.${x.from} → <b>${x.to}</b></li>`).join('');
    this.showModal(`
      <h2>📜 귀환 일지</h2>
      <p class="lead">당신이 자리를 비운 <b>${time}</b> 동안, 모험가는…</p>
      <ul class="report">
        <li>몬스터 <b>${sm.kills.toLocaleString()}</b>마리를 쓰러뜨렸고${sm.deaths ? `, ${sm.deaths}번 쓰러졌다가 일어났습니다` : '습니다'}.</li>
        ${sm.charLv[1] > sm.charLv[0] ? `<li>레벨이 ${sm.charLv[0]} → <b>${sm.charLv[1]}</b> 올랐습니다.</li>` : ''}
        ${sm.floor[1] > sm.floor[0] ? `<li>최고 ${sm.floor[0]}층 → <b>${sm.floor[1]}층</b>까지 올랐습니다.</li>` : ''}
        <li>골드 <b>${fmt(sm.gold)}</b>를 모았습니다.</li>
        ${sm.records ? `<li>물고기 크기 신기록을 <b>${sm.records}</b>번 세웠습니다.</li>` : ''}
        <li>${joke}</li>
      </ul>
      ${skills ? `<h4>성장한 스킬</h4><ul class="report">${skills}</ul>` : ''}
      ${drops ? `<h4>얻은 것</h4><p>${drops}</p>` : ''}
      ${best ? `<h4>눈에 띄는 획득</h4><ul class="report">${best}</ul>` : ''}
      ${sm.codex.length ? `<p>도감에 <b>${sm.codex.length}</b>종이 새로 등록되었습니다.</p>` : ''}`, [['계속하기', null]]);
  }
}
