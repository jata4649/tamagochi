// 演出(仕様書 §5.4)。すべて position:absolute + CSS keyframes。
// 一回きりの演出は DOM 追加 → animationend で remove する。
import { assetPath } from './assets.js';

const $ = (id) => document.getElementById(id);

function makeImg(file, className) {
  const img = document.createElement('img');
  img.src = assetPath(file);
  img.alt = '';
  img.className = 'sprite ' + className;
  return img;
}

// 一回きりの演出を出す。pos は { left, top }(% 指定の文字列)
export function spawnFx(file, className, pos = {}) {
  const img = makeImg(file, 'fx ' + className);
  if (pos.left) img.style.left = pos.left;
  if (pos.top) img.style.top = pos.top;
  img.addEventListener('animationend', () => img.remove(), { once: true });
  $('fx-layer').appendChild(img);
  return img;
}

// 床のうんち(最大2個)。数が変わったときだけ DOM を作り直す
export function renderPoops(count) {
  const layer = $('poop-layer');
  if (layer.childElementCount === count) return;
  layer.textContent = '';
  for (let i = 0; i < count; i++) {
    layer.appendChild(makeImg('props/prop_poop.png', `poop poop-${i}`));
  }
}

// 起床まで繰り返し表示する常駐演出(zzz など)。on/off を切り替える
function setLoop(id, on, file, className) {
  const existing = document.getElementById(id);
  if (on && !existing) {
    const img = makeImg(file, 'fx-loop ' + className);
    img.id = id;
    $('fx-layer').appendChild(img);
  } else if (!on && existing) {
    existing.remove();
  }
}

// 睡眠中の zzz
export function setSleepFx(on) {
  setLoop('fx-zzz', on, 'props/prop_zzz.png', 'zzz');
}

// 状態絵が無い B/C 用の補助表示(README 仕様メモ参照)
// 病気: くすりアイコンを頭の横に、汚れ: なし(床のうんちで表現)
export function setSickBadge(on) {
  setLoop('fx-sick', on, 'icons/icon_medicine.png', 'sick-badge');
}
