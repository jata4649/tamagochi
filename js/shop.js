// おみせ(アルバイト&ショップ追加仕様 §4.1・§4.2)
// 入口は上部バーの「がまぐち + 所持ドッチ」チップ
import { UI } from './strings.js';
import { shopFile } from './assets.js';
import { el, spriteImg, openOverlay, closeOverlay } from './overlays.js';
import { showToast } from './ui.js';
import { isBusy } from './actions.js';

const $ = (id) => document.getElementById(id);

// 入口が開いているか。理由があるときはその文言を返す(null なら開ける)
// ゲーム中・ほかの画面の表示中は黙って開かない。寝ている間・病気で遊べない間は理由を出す(§7)
export function shopBlockedReason(game) {
  const s = game.state;
  if (!s || s.stage === 'egg' || s.flags.gone || isBusy(game)) return '';
  if (s.flags.sleeping) return UI.sleepingNow;
  if (s.flags.sick) return UI.shop.cannotUseNow;
  return null;
}

// 上部バーのチップ(所持ドッチ)を描く
export function renderCoinChip(game) {
  const s = game.state;
  const chip = $('coin-chip');
  chip.hidden = !s || s.stage === 'egg';
  if (chip.hidden) return;
  $('coin-chip-num').textContent = UI.coinFormat(s.coins);
  chip.classList.toggle('closed', shopBlockedReason(game) !== null);
}

// チップの準備(画像とタップ)
export function setupCoinChip(game) {
  $('coin-chip-img').src = 'assets/' + shopFile('pouch');
  $('coin-chip').setAttribute('aria-label', UI.shop.open);
  $('coin-chip').addEventListener('click', () => {
    const reason = shopBlockedReason(game);
    if (reason) showToast(reason);
    if (reason === null) openShop(game);
  });
}

// 見出し: icon_shop + 「おみせ」 + 所持ドッチ
function header(game) {
  const head = el('div', 'shop-head');
  head.appendChild(spriteImg(shopFile('icon_shop'), 'shop-head-icon'));
  head.appendChild(el('h2', 'overlay-title', UI.shop.title));
  const purse = el('span', 'shop-purse');
  purse.append(spriteImg(shopFile('pouch'), 'shop-purse-icon'), el('span', 'shop-coins', UI.coinFormat(game.state.coins)));
  head.appendChild(purse);
  return head;
}

export function openShop(game) {
  const root = el('div', 'shop');
  root.appendChild(header(game));
  // 売り物のグリッドは Q2 で追加する
  const back = el('button', 'pill-btn', UI.backBtn);
  back.type = 'button';
  back.addEventListener('click', () => closeOverlay(game));
  root.appendChild(back);
  openOverlay(game, 'shop', root);
}
