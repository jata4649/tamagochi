// 初期化・ゲームループの入口
// M1: ゲージの時間減衰・スプライト切替・alert・うんち出現
import { UI } from './strings.js';
import { loadManifest, checkFiles, ACTION_ICONS, BG } from './assets.js';
import {
  createState, advance, needsCare, selectSprite, isNight, ageParts
} from './state.js';
import {
  applyStaticText, buildGauges, renderGauges, buildActions, renderTopbar,
  renderPet, renderBackground, renderAlert, showToast
} from './ui.js';
import { renderPoops, setSleepFx, setSickBadge } from './effects.js';

const TICK_MS = 1000;

// 実行時の状態(セーブ対象外のものは runtime に置く)
const game = {
  state: null,
  runtime: { anim: null, animUntil: 0, park: false }
};

// 画面全体を state から描き直す
function render() {
  const s = game.state;
  const rt = game.runtime;
  const anim = Date.now() < rt.animUntil ? rt.anim : null;
  const sprite = selectSprite(s, anim);

  renderPet(sprite.file);
  renderGauges(s.gauges);
  renderAlert(needsCare(s));
  renderPoops(s.flags.poops);
  setSleepFx(s.flags.sleeping);
  setSickBadge(s.flags.sick && sprite.fallback);
  // 遊び中は公園、睡眠中は夜固定、それ以外は時刻で昼/夜(§5.2・§4.5)
  renderBackground(rt.park ? 'park' : (s.flags.sleeping || isNight()) ? 'night' : 'day');

  const a = ageParts(s);
  renderTopbar({ name: s.name || UI.defaultName, ageText: UI.ageFormat(a.d, a.h, a.m) });
}

function loop() {
  advance(game.state, Date.now());
  render();
}

async function init() {
  const manifest = await loadManifest();
  // 参照する素材が manifest に載っているか確認
  checkFiles(manifest, [
    ...Object.values(ACTION_ICONS), ...Object.values(BG),
    'icons/icon_alert.png', 'props/prop_poop.png', 'props/prop_zzz.png'
  ]);

  applyStaticText();
  buildGauges();
  // M2 で各アクションを実装する。いまはアクション名を出すだけ
  buildActions((key) => showToast(UI.actions[key]));

  // M1 ではタイトル画面が未実装のため、A のおとなから開始する(M3 で差し替え)
  const now = Date.now();
  game.state = createState('a', '', now);
  game.state.stage = 'adult';
  game.state.hatchedAt = now;

  // DevTools から触れるように公開(例: tt.state.gauges.hunger = 10)
  window.tt = game;

  loop();
  setInterval(loop, TICK_MS);
}

init();
