// 初期化・ゲームループの入口
// M0: メイン画面を静的に表示するだけ(ペットは pet_a_adult_idle 固定)
import { UI } from './strings.js';
import { loadManifest, checkFiles, ACTION_ICONS, BG } from './assets.js';
import {
  applyStaticText, buildGauges, renderGauges, buildActions, renderTopbar, showToast
} from './ui.js';

async function init() {
  const manifest = await loadManifest();
  // 参照する素材が manifest に載っているか確認
  checkFiles(manifest, [
    ...Object.values(ACTION_ICONS), ...Object.values(BG),
    'sprites/pet_a_adult_idle.png', 'icons/icon_alert.png'
  ]);

  applyStaticText();
  buildGauges();
  renderGauges({ hunger: 80, happiness: 80, cleanliness: 80, energy: 80 });
  // M0 ではボタンを押すとアクション名をトーストで表示するだけ
  buildActions((key) => showToast(UI.actions[key]));

  const tick = () => renderTopbar({ name: UI.defaultName, ageText: UI.ageFormat(0, 0, 0) });
  tick();
  setInterval(tick, 10 * 1000);
}

init();
