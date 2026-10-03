// 初期化・ゲームループの入口
// M2: 8ボタンのアクション(食事選択・ミニゲーム・ステータス含む)
import { UI } from './strings.js';
import { loadManifest, checkFiles, ACTION_ICONS, BG } from './assets.js';
import {
  createState, advance, needsCare, selectSprite, isNight, ageParts
} from './state.js';
import {
  applyStaticText, buildGauges, renderGauges, buildActions, renderTopbar,
  renderPet, renderBackground, renderAlert, renderActionState
} from './ui.js';
import { renderPoops, setSleepFx, setSickBadge } from './effects.js';
import { handleAction, isBusy, FOODS } from './actions.js';

const TICK_MS = 1000;

// 実行時の状態(セーブ対象外のものは runtime に置く)
const game = {
  state: null,
  runtime: { anim: null, animUntil: 0, park: false, busyUntil: 0, overlay: null },
  render
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
  renderActionState({ busy: isBusy(game), sleeping: s.flags.sleeping });
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
    ...Object.values(ACTION_ICONS), ...Object.values(BG), ...FOODS.map((f) => f.file),
    'icons/icon_alert.png', 'props/prop_poop.png', 'props/prop_zzz.png',
    'props/prop_heart.png', 'props/prop_star.png', 'props/prop_note.png',
    'props/prop_sparkle.png', 'props/prop_ball.png'
  ]);

  applyStaticText();
  buildGauges();
  buildActions((key) => handleAction(game, key));

  // タイトル画面は M3 で作るため、いまは A のおとなから開始する
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
