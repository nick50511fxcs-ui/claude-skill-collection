// Boot: load or create a save, catch up offline time, then run the logic
// loop (10 Hz, wall-clock based) and the render loop (requestAnimationFrame).
import { Game, newState, migrate } from './engine.js';
import { Renderer } from './render.js';
import { UI } from './ui.js';
import { LINES, ITEMS } from './data.js';

const KEY = 'campfire-chronicle-save-v1';

function readSave() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function encode(str) { return btoa(unescape(encodeURIComponent(str))); }
function decode(str) { return decodeURIComponent(escape(atob(str))); }

function start(hotData = {}) {
  let raw = null;
  try { raw = hotData.save ? JSON.parse(hotData.save) : readSave(); } catch { raw = null; }
  const state = raw ? migrate(raw) : newState();
  const fresh = !raw;
  let game = new Game(state);
  const canvas = document.getElementById('scene');
  const renderer = new Renderer(canvas, document.getElementById('overlay'), game);

  const save = () => {
    try { localStorage.setItem(KEY, game.serialize()); } catch { /* storage blocked: keep playing */ }
  };
  // Cloud save: one private document per signed-in viewer (data/users/<id>/save).
  // Browser storage stays the fast local copy; the cloud copy follows the player across devices.
  const cloud = { ref: null, ok: false, busy: false, lastAt: 0, status: '연결 중…' };
  const cloudSave = async () => {
    if (!cloud.ok || cloud.busy) return;
    cloud.busy = true;
    try {
      await cloud.ref.set({ json: game.serialize(), time: game.s.time, at: Date.now() });
      cloud.lastAt = Date.now();
      cloud.status = '연결됨';
    } catch (e) {
      if (e && (e.code === 'invalid_argument' || e.code === 'revoked' || e.code === 'not_granted' || e.code === 'quota_exceeded')) {
        cloud.ok = false;
        cloud.status = e.code === 'invalid_argument' ? '이 페이지에 저장 권한이 없어 브라우저에만 저장됩니다' : '사용할 수 없어 브라우저에만 저장됩니다';
      }
    } finally {
      cloud.busy = false;
    }
  };
  const hooks = {
    save,
    exportSave: () => encode(game.serialize()),
    importSave: str => {
      try {
        const data = migrate(JSON.parse(decode(str)));
        if (!data.char || !data.skills) return false;
        swap(new Game(data));
        save();
        cloudSave();
        return true;
      } catch {
        return false;
      }
    },
    cloudStatus: () => cloud,
    reset: () => {
      swap(new Game(newState()));
      save();
      cloudSave();
      ui.close();
      ui.toast('새 모험을 시작합니다');
    },
  };
  const ui = new UI(game, renderer, hooks);
  function swap(g) {
    game = g;
    renderer.g = g;
    ui.g = g;
    renderer.slotVis = [];
  }

  // Offline catch-up. There is no cap: a day of absence computes in well under
  // a second, so long absences run in one-day chunks behind a progress note
  // instead of freezing the page.
  let catching = false;
  const merge = parts => {
    const first = parts[0], lastPart = parts.at(-1), skills = {};
    for (const p of parts) for (const x of p.skills) skills[x.k] = { k: x.k, from: skills[x.k] ? skills[x.k].from : x.from, to: x.to };
    return {
      sec: parts.reduce((a, p) => a + p.sec, 0),
      kills: parts.reduce((a, p) => a + p.kills, 0),
      deaths: parts.reduce((a, p) => a + p.deaths, 0),
      drops: first.drops.map((_, i) => parts.reduce((a, p) => a + p.drops[i], 0)),
      best: parts.flatMap(p => p.best),
      records: parts.reduce((a, p) => a + p.records, 0),
      codex: parts.flatMap(p => p.codex),
      fails: parts.reduce((a, p) => a + p.fails, 0),
      gold: parts.reduce((a, p) => a + p.gold, 0),
      charLv: [first.charLv[0], lastPart.charLv[1]],
      floor: [first.floor[0], lastPart.floor[1]],
      skills: Object.values(skills),
    };
  };
  const catchUp = async (sec, report) => {
    if (catching || sec < 1) return;
    catching = true;
    const parts = [];
    try {
      if (sec <= 2 * 86400) parts.push(game.fastForward(sec));
      else {
        ui.showModal('<h2>📜 귀환 중…</h2><p class="lead" id="ffProgress"></p>', [], true);
        for (let done = 0; done < sec;) {
          const chunk = Math.min(86400, sec - done);
          parts.push(game.fastForward(chunk));
          done += chunk;
          const el = document.getElementById('ffProgress');
          if (el) el.textContent = `자리를 비운 ${Math.ceil(sec / 86400)}일을 정리하는 중… ${Math.round((done / sec) * 100)}%`;
          await new Promise(r => setTimeout(r, 0));
        }
        ui.closeModal();
      }
    } finally {
      catching = false;
    }
    game.events.length = 0;
    const sm = merge(parts);
    if (report && sec >= 60) {
      ui.offlineReport(sm, Math.random);
      renderer.replay(sm.best.filter(id => ITEMS[id].tier >= 4));
    }
  };
  if (!fresh && !hotData.save) {
    const away = (Date.now() - state.lastSeen) / 1000;
    catchUp(away, true);
  }
  if (fresh) {
    ui.showModal(`<h2>🔥 모닥불 연대기</h2>
      <p class="lead">한 명의 모험가가 끝없는 길을 오릅니다.</p>
      <ul class="report">
        <li>싸우다 지치면 <b>모닥불 야영지</b>에서 쉬며 생활 스킬을 합니다.</li>
        <li>광질·벌목·채집·낚시·사냥·연금술의 레벨은 <b>윤회해도 사라지지 않고</b> 전투를 영원히 강하게 만듭니다.</li>
        <li>모든 행동에 운이 있습니다. 가장 귀한 것은 <b>0.0001%</b>.</li>
        <li>창을 닫아도 모험은 계속됩니다. 몇 시간이든 며칠이든, 돌아오면 그동안의 일을 정리해 드려요.</li>
      </ul>`, [['모험 시작', null]]);
  }

  // Logic loop
  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;
    if (catching) return;
    if (dt > 3) catchUp(dt, dt > 60); // tab was throttled in the background
    else game.advance(dt, true);
    if (game.events.length) {
      renderer.handle(game.events);
      ui.handle(game.events);
      game.events.length = 0;
    }
  }, 100);

  // Render loop
  let lastF = performance.now();
  let uiT = 0, panelT = 0, talkT = 8;
  const frame = now => {
    const dt = Math.min(0.05, (now - lastF) / 1000);
    lastF = now;
    renderer.frame(dt);
    uiT += dt; panelT += dt; talkT -= dt;
    if (uiT > 0.2) { uiT = 0; ui.updateBar(); }
    if (panelT > 1.5) { panelT = 0; ui.refreshPanel(); }
    if (talkT < 0) {
      talkT = 14 + Math.random() * 14;
      const s = game.s;
      const pool = s.mode === 'camp' ? [...LINES.camp, ...LINES[s.slots[0].k]] : LINES.fight;
      renderer.say(pool[Math.floor(Math.random() * pool.length)]);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  setInterval(save, 10000);
  setInterval(cloudSave, 60000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { save(); cloudSave(); } });
  (async () => {
    try {
      if (!window.claude?.use) { cloud.status = '이 환경에서는 브라우저에만 저장됩니다'; return; }
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      const uid = user ? await user.id() : null;
      if (!db || !uid) { cloud.status = '로그인하면 클라우드 저장을 쓸 수 있습니다'; return; }
      cloud.ref = db.doc('data/users/' + uid + '/save');
      const snap = await cloud.ref.get();
      if (snap.exists) {
        const raw = JSON.parse(snap.data().json);
        if (raw && raw.time > game.s.time + 30) {
          swap(new Game(migrate(raw)));
          catchUp((Date.now() - raw.lastSeen) / 1000, true);
          save();
          ui.toast('클라우드에 저장된 진행을 불러왔습니다', 2);
        }
      }
      cloud.ok = true;
      cloud.status = '연결됨';
      cloudSave();
    } catch {
      cloud.status = '사용할 수 없어 브라우저에만 저장됩니다';
    }
  })();
  addEventListener('pagehide', save);
  window.claude?.hot?.snapshot?.(() => ({ save: game.serialize() }));
  if (location.hash === '#debug') window.__cc = { game: () => game, renderer, ui };
  ui.updateBar();
}

if (window.claude?.hot?.ready) window.claude.hot.ready(start);
else start(window.claude?.hot?.data ?? {});
