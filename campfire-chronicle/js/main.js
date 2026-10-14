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
  const hooks = {
    save,
    exportSave: () => encode(game.serialize()),
    importSave: str => {
      try {
        const data = migrate(JSON.parse(decode(str)));
        if (!data.char || !data.skills) return false;
        swap(new Game(data));
        save();
        return true;
      } catch {
        return false;
      }
    },
    reset: () => {
      swap(new Game(newState()));
      save();
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

  // Offline catch-up
  const catchUp = (sec, report) => {
    const capped = Math.min(sec, game.offlineCapSec());
    if (capped < 1) return;
    const sm = game.fastForward(capped);
    game.events.length = 0;
    if (report && capped >= 60) {
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
        <li>창을 닫아도 최대 12시간까지 모험은 계속됩니다.</li>
      </ul>`, [['모험 시작', null]]);
  }

  // Logic loop
  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;
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
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  addEventListener('pagehide', save);
  window.claude?.hot?.snapshot?.(() => ({ save: game.serialize() }));
  if (location.hash === '#debug') window.__cc = { game: () => game, renderer, ui };
  ui.updateBar();
}

if (window.claude?.hot?.ready) window.claude.hot.ready(start);
else start(window.claude?.hot?.data ?? {});
