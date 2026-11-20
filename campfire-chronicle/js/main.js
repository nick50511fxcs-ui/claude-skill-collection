// Boot: load or create a save, pay out idle miners for the time away, then run the
// logic loop (20 Hz) and the render loop (requestAnimationFrame).
import { Game, newState, migrate } from './engine.js';
import { Renderer } from './render.js';
import { UI } from './ui.js';

const KEY = 'campfire-mine-save-v1';

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
  const renderer = new Renderer(canvas, game);

  // A run in progress is banked (its loot kept) before saving, so closing the tab never loses ore.
  const bank = () => { if (game.run && !game.run.over) game.endRun(true); };
  const save = (withCloud = false) => {
    try { localStorage.setItem(KEY, game.serialize()); } catch { /* storage blocked: keep playing */ }
    if (withCloud) cloudSave();
  };
  // Cloud save: one private document per signed-in viewer.
  const cloud = { ref: null, ok: false, busy: false, status: '연결 중…' };
  const cloudSave = async () => {
    if (!cloud.ok || cloud.busy) return;
    cloud.busy = true;
    try {
      await cloud.ref.set({ json: game.serialize(), time: game.s.time, at: Date.now() });
      cloud.status = '연결됨';
    } catch (e) {
      if (e && ['invalid_argument', 'revoked', 'not_granted', 'quota_exceeded'].includes(e.code)) {
        cloud.ok = false;
        cloud.status = '사용할 수 없어 브라우저에만 저장됩니다';
      }
    } finally {
      cloud.busy = false;
    }
  };
  const hooks = {
    save,
    flush: () => { if (game.events.length) { renderer.handle(game.events); ui.handle(game.events); game.events.length = 0; } },
    exportSave: () => encode(game.serialize()),
    importSave: str => {
      try {
        const data = JSON.parse(decode(str));
        if (!data || !data.res) return false;
        swap(new Game(migrate(data)));
        save(true);
        return true;
      } catch {
        return false;
      }
    },
    cloudStatus: () => cloud,
    reset: () => {
      swap(new Game(newState()));
      save(true);
      ui.close();
      ui.toast('새로 시작합니다');
    },
  };
  const ui = new UI(game, renderer, hooks);
  function swap(g) {
    game = g;
    renderer.g = g;
    ui.g = g;
    ui.mode = null;
    ui.update();
  }

  // Idle miners: pay out the time away (no cap).
  if (!fresh && !hotData.save) {
    const away = (Date.now() - state.lastSeen) / 1000;
    if (away > 60) ui.offlineReport(game.fastForward(away));
  }
  if (fresh) {
    ui.showModal(`<h2>⛏ 끝없는 광산</h2>
      <p class="lead">모닥불 곁의 광부가 땅 밑으로 끝없이 파 내려갑니다.</p>
      <ul class="report">
        <li><b>채굴 출발</b>을 누르면 곡괭이 내구가 다할 때까지 아래로 팝니다.</li>
        <li>캐 온 <b>돌과 광석</b>으로 능력치를 강화하고 더 좋은 장비를 만드세요.</li>
        <li><b>보물상자</b>에서 나온 유물은 영구 효과를 주고, 같은 유물을 또 얻으면 레벨이 올라요.</li>
        <li>깊을수록 새로운 광석이 나옵니다. 바닥은 없어요.</li>
      </ul>`, [['시작하기', 'modal-close']]);
  }

  // Input: hold a direction (keys, buttons or the block next to the miner).
  const keyDir = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowDown: 'down', s: 'down' };
  addEventListener('keydown', e => {
    if (e.target.closest?.('textarea, input')) return;
    const run = game.run;
    if (run && keyDir[e.key]) { run.input = keyDir[e.key]; e.preventDefault(); }
    else if (run && e.key === ' ') { game.frenzy(); e.preventDefault(); }
    else if (e.key === 'Escape') ui.close();
  });
  addEventListener('keyup', e => { if (game.run && keyDir[e.key] && game.run.input === keyDir[e.key]) game.run.input = null; });
  canvas.addEventListener('pointerdown', e => {
    const dir = ui.canvasDir(e.clientX, e.clientY, canvas.getBoundingClientRect());
    if (!dir) return;
    game.run.input = dir;
    canvas.setPointerCapture?.(e.pointerId);
  });
  for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, () => { if (game.run) game.run.input = null; });

  // Logic loop
  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    game.advance(dt);
    hooks.flush();
  }, 50);

  // Render loop
  let lastF = performance.now(), uiT = 0, panelT = 0;
  const frame = now => {
    const dt = Math.min(0.05, (now - lastF) / 1000);
    lastF = now;
    renderer.frame(dt);
    uiT += dt; panelT += dt;
    if (uiT > 0.15) { uiT = 0; ui.update(); }
    if (panelT > 2) { panelT = 0; ui.refreshPanel(); }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  setInterval(() => { if (!game.run) save(true); }, 300000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { bank(); hooks.flush(); save(true); } });
  addEventListener('pagehide', () => { bank(); save(); });
  (async () => {
    try {
      if (!window.claude?.use) { cloud.status = '이 환경에서는 브라우저에만 저장됩니다'; return; }
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      const uid = user ? await user.id() : null;
      if (!db || !uid) { cloud.status = '로그인하면 클라우드 저장을 쓸 수 있습니다'; return; }
      cloud.ref = db.doc('data/users/' + uid + '/mine');
      const snap = await cloud.ref.get();
      if (snap.exists) {
        const raw = JSON.parse(snap.data().json);
        if (raw && raw.time > game.s.time + 30 && !game.run) {
          swap(new Game(migrate(raw)));
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
  window.claude?.hot?.snapshot?.(() => { bank(); return { save: game.serialize() }; });
  if (location.hash === '#debug') window.__cc = { game: () => game, renderer, ui };
}

if (window.claude?.hot?.ready) window.claude.hot.ready(start);
else start(window.claude?.hot?.data ?? {});
