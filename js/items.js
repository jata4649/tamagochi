// もちもの(アルバイト&ショップ追加仕様 §4.3)
// じょうたい画面の下に、持っているアイテムを「アイコン + 個数 + つかう」で並べる
import { UI } from './strings.js';
import { shopFile } from './assets.js';
import { el, spriteImg } from './overlays.js';
import { showToast } from './ui.js';
import { schedulePoop, playAnim } from './actions.js';
import { ITEM_IDS } from './economy.js';
import { HOUR } from './state.js';

// スロウ砂時計の効き目は実時間 12時間(PACE で縮めない。§4.2)
export const SLOW_GLASS_MS = 12 * HOUR;

// 100 まで回復(今より下げない)
function fill(s, key) {
  s.gauges[key] = Math.max(s.gauges[key], 100);
}

// 各アイテムの効果。false を返したら使わない(消費しない)
const EFFECTS = {
  item_bento: (game, s, now) => {
    fill(s, 'hunger');
    s.gauges.happiness = Math.min(100, s.gauges.happiness + 2);
    schedulePoop(s, now); // 食事と同じうんち待ち
    playAnim(game, 'eat');
  },
  item_funbox: (game, s) => { fill(s, 'happiness'); playAnim(game, 'happy'); },
  item_soapset: (game, s) => { fill(s, 'cleanliness'); playAnim(game, 'happy'); },
  item_vitamin: (game, s) => { fill(s, 'energy'); playAnim(game, 'happy'); },
  item_medherb: (game, s) => {
    if (!s.flags.sick) return false; // 病気でないときは もったいないので使わせない
    s.flags.sick = false;
    playAnim(game, 'happy');
  },
  item_slowglass: (game, s, now) => {
    s.slowGlassUntil = now + SLOW_GLASS_MS; // 重ねがけで延長せず上書き
  }
};

// 使う。使えたら true
export function useItem(game, id) {
  const s = game.state;
  if (!(s.inventory[id] > 0)) return false;
  if (s.flags.sleeping) {
    showToast(UI.sleepingNow);
    return false;
  }
  if (EFFECTS[id](game, s, Date.now()) === false) {
    showToast(UI.shop.cannotUseNow);
    return false;
  }
  s.inventory[id] -= 1;
  game.save();
  return true;
}

// スロウ砂時計の残り時間(切り上げの時間数)。効いていなければ 0
export function slowRemainHours(s, now = Date.now()) {
  const left = (s.slowGlassUntil ?? 0) - now;
  return left > 0 ? Math.ceil(left / HOUR) : 0;
}

// じょうたい画面に足すセクション。onUsed() は使ったあとの描き直し
export function itemsSection(game, onUsed) {
  const s = game.state;
  const box = el('div', 'items');
  box.appendChild(el('h3', 'items-title', UI.shop.itemsTitle));
  const h = slowRemainHours(s);
  if (h > 0) box.appendChild(el('p', 'items-slow', `${UI.shop.slowActive}(${UI.shop.slowRemain(h)})`));
  const owned = ITEM_IDS.filter((id) => s.inventory[id] > 0);
  if (owned.length === 0) box.appendChild(el('p', 'items-empty', UI.shop.empty));
  for (const id of owned) {
    const row = el('div', 'items-row');
    row.dataset.item = id;
    row.appendChild(spriteImg(shopFile(id), 'items-img'));
    row.appendChild(el('span', 'items-name', UI.itemNames[id]));
    row.appendChild(el('span', 'items-count', UI.countFormat(s.inventory[id])));
    const use = el('button', 'pill-btn items-use', UI.shop.use);
    use.type = 'button';
    use.addEventListener('click', () => {
      if (useItem(game, id)) onUsed();
    });
    row.appendChild(use);
    box.appendChild(row);
  }
  return box;
}
