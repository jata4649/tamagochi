// 初期化・ゲームループの入口
// タイトル → たまご → 孵化(名前入力)→ 進化 → お別れ → リセット
// localStorage セーブ・リロード復帰・オフライン補正
// M5: せってい(B/C の表情流用・効果音・育つはやさ)
import { UI } from './strings.js';
import { loadManifest, checkFiles, ACTION_ICONS, BG } from './assets.js';
import {
  createState, advance, needsCare, selectSprite, isNight, ageParts
} from './state.js';
import {
  applyStaticText, buildGauges, renderGauges, buildActions, renderTopbar,
  renderPet, renderBackground, renderAlert, renderActionState, showToast, hideToast
} from './ui.js';
import { renderPoops, setSleepFx, setSickBadge, spawnRandom } from './effects.js';
import { handleAction, isBusy, FOODS } from './actions.js';
import { closeOverlay } from './overlays.js';
import { endMiniGame } from './minigame.js';
import { openTitle, updateTitle, openNameInput, openGone, closeScreen } from './screens.js';
import { TIME_SCALE, setTimeScale } from './lifecycle.js';
import { saveState, loadState, clearSave, SAVE_KEY } from './save.js';
import { settings, loadSettings, openSettings } from './settings.js';
import { beep } from './sound.js';

const TICK_MS = 1000;
const SAVE_EVERY_MS = 60 * 1000; // ゲージ更新のセーブ間隔(§6)
const SCREENS = ['title', 'name', 'gone'];

// 実行時の状態(セーブ対象外のものは runtime に置く)
const game = {
  state: null,
  runtime: { anim: null, animUntil: 0, park: false, busyUntil: 0, overlay: null, noSave: false },
  render,
  save
};

function save() {
  if (!game.runtime.noSave) saveState(game.state);
}

// 画面全体を state から描き直す
function render() {
  const s = game.state;
  if (!s) return;
  const rt = game.runtime;
  const anim = Date.now() < rt.animUntil ? rt.anim : null;
  const sprite = selectSprite(s, anim, settings.hue);

  renderPet(sprite.file, sprite.filter);
  renderGauges(s.gauges);
  renderAlert(needsCare(s));
  renderPoops(s.flags.poops);
  setSleepFx(s.flags.sleeping && !s.flags.gone);
  setSickBadge(s.flags.sick && sprite.fallback && !s.flags.gone);
  renderActionState({ busy: isBusy(game), sleeping: s.flags.sleeping });
  // 遊び中は公園、睡眠中は夜固定、それ以外は時刻で昼/夜(§5.2・§4.5)
  renderBackground(rt.park ? 'park' : (s.flags.sleeping || isNight()) ? 'night' : 'day');

  const a = ageParts(s);
  renderTopbar({ name: s.name || UI.defaultName, ageText: UI.ageFormat(a.d, a.h, a.m) });
}

// 状態に合った全画面(タイトル・名前入力・お別れ)を出す
function syncScreen() {
  const s = game.state;
  const cur = game.runtime.overlay;
  let want = null;
  if (!s || s.stage === 'egg') want = 'title';
  else if (s.flags.gone) want = 'gone';
  else if (!s.name) want = 'name';

  if (want === cur) {
    if (want === 'title') updateTitle(game);
    return;
  }
  if (!want) {
    if (SCREENS.includes(cur)) closeScreen(game);
    return;
  }
  // 開いている他の画面を閉じてから切り替える
  if (cur === 'play') endMiniGame(game);
  else if (cur) closeOverlay(game);
  if (want !== 'name') hideToast();
  if (want === 'title') openTitle(game, startNew);
  if (want === 'gone') openGone(game, resetGame, selectSprite(s, null, settings.hue).filter);
  if (want === 'name') {
    openNameInput(game, (name) => {
      game.state.name = name;
      save();
      closeScreen(game);
    });
  }
}

// 進化などのイベントに演出を付ける(§4.1・§5.4)
function handleEvents(events) {
  if (events.length) save();
  for (const ev of events) {
    if (ev.type === 'evolve') {
      spawnRandom(['props/prop_star.png'], 'fx-evolve', 5, 0.3);
      beep('evolve');
      showToast(UI.evolveMsg[ev.to], 2500);
    }
  }
}

function startNew(colorway) {
  game.state = createState(colorway, '', Date.now());
  save();
  render();
  syncScreen();
}

// 「あたらしいたまご」: セーブを消してタイトルへ
function resetGame() {
  game.state = null;
  clearSave();
  closeScreen(game);
  syncScreen();
}

let lastSaveAt = Date.now();
function loop() {
  if (game.state) {
    handleEvents(advance(game.state, Date.now()));
    render();
    if (Date.now() - lastSaveAt >= SAVE_EVERY_MS) {
      save();
      lastSaveAt = Date.now();
    }
  }
  syncScreen();
}

// 検収用: 「hours 時間 離れていた」ことにしてリロードする
// セーブ内の時刻(lastTick など)を全部 hours 時間前にずらす = 本当に離れていたのと同じ
function away(hours) {
  if (!game.state) return;
  save();
  game.runtime.noSave = true; // リロード時の上書きを防ぐ
  const d = hours * 3600e3;
  const s = JSON.parse(localStorage.getItem(SAVE_KEY));
  for (const k of ['lastTick', 'stageEnteredAt', 'hatchedAt']) if (s[k] !== null) s[k] -= d;
  for (const k of ['zeroHungerSince', 'zeroHappySince', 'pendingPoopAt', 'snacksWindowStart']) {
    if (s.flags[k]) s.flags[k] -= d;
  }
  localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  location.reload();
}

async function init() {
  const manifest = await loadManifest();
  // 参照する素材が manifest に載っているか確認
  checkFiles(manifest, [
    ...Object.values(ACTION_ICONS), ...Object.values(BG), ...FOODS.map((f) => f.file),
    'icons/icon_alert.png', 'props/prop_poop.png', 'props/prop_zzz.png',
    'props/prop_heart.png', 'props/prop_star.png', 'props/prop_note.png',
    'props/prop_sparkle.png', 'props/prop_ball.png',
    'sprites/pet_egg.png', 'sprites/pet_a_adult_angel.png'
  ]);

  applyStaticText();
  buildGauges();
  buildActions((key) => handleAction(game, key));
  loadSettings();
  document.getElementById('settings-btn').addEventListener('click', () => {
    if (game.state && !isBusy(game)) openSettings(game);
  });

  // セーブから復帰(オフライン補正は最初の loop() の advance で行う)
  game.state = loadState();

  // ページを離れるときにセーブ(§6)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
    else loop(); // 戻ってきたらすぐ反映
  });
  window.addEventListener('pagehide', save);

  // DevTools から触れるように公開(例: tt.state.stageEnteredAt -= 3 * 3600e3 / tt.away(3))
  game.setTimeScale = setTimeScale;
  game.TIME_SCALE = TIME_SCALE;
  game.away = away;
  window.tt = game;

  loop();
  setInterval(loop, TICK_MS);
}

init();
