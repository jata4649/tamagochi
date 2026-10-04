// オーバーレイ画面(食事選択・ステータス)(仕様書 §5.3)
import { UI } from './strings.js';
import { assetPath } from './assets.js';
import { ageParts } from './state.js';

const $ = (id) => document.getElementById(id);

// 小さな DOM ヘルパー
export function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}
export function spriteImg(file, className = '') {
  const img = el('img', 'sprite ' + className);
  img.src = assetPath(file);
  img.alt = '';
  return img;
}

// 閉じる・差し替えるときに呼ぶ後片付け(ミニゲームのタイマー解除など)
let cleanup = null;
function runCleanup() {
  const fn = cleanup;
  cleanup = null;
  if (fn) fn();
}

// オーバーレイを開く。content はパネルの中身
// onClose: このオーバーレイが閉じられる/別の画面に差し替えられるときに必ず呼ばれる
export function openOverlay(game, name, content, onClose = null) {
  runCleanup();
  const box = $('overlay');
  box.textContent = '';
  box.classList.remove('screen');
  const panel = el('div', 'overlay-panel');
  panel.appendChild(content);
  box.appendChild(panel);
  box.classList.add('show');
  game.runtime.overlay = name;
  cleanup = onClose;
}

export function closeOverlay(game) {
  runCleanup();
  const box = $('overlay');
  box.classList.remove('show');
  box.textContent = '';
  game.runtime.overlay = null;
  game.render();
}

// 「もどる」ボタン
export function backButton(onClick) {
  const b = el('button', 'pill-btn', UI.backBtn);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

// [食事選択] 12種を 3列×4行で表示し、選ばれたら onPick(food)
export function openMealMenu(game, foods, onPick) {
  const root = el('div', 'meal-menu');
  root.appendChild(el('h2', 'overlay-title', UI.mealTitle));
  const grid = el('div', 'meal-grid');
  for (const food of foods) {
    const b = el('button', 'food-btn');
    b.type = 'button';
    b.appendChild(spriteImg(food.file));
    b.appendChild(el('span', 'food-name', UI.foods[food.key]));
    for (const [k, v] of Object.entries(food.effect)) {
      b.appendChild(el('span', 'food-effect', UI.effectFormat(UI.gauges[k], v)));
    }
    b.addEventListener('click', () => {
      closeOverlay(game);
      onPick(food);
    });
    grid.appendChild(b);
  }
  root.appendChild(grid);
  root.appendChild(backButton(() => closeOverlay(game)));
  openOverlay(game, 'meal', root);
}

// 表の1行
function row(label, value) {
  const r = el('div', 'status-row');
  r.append(el('span', 'status-label', label), el('span', 'status-value', value));
  return r;
}

// [ステータス] ゲージ4本・年齢・名前・病気/睡眠/うんち・ミニゲーム成績
export function openStatus(game) {
  const s = game.state;
  const f = s.flags;
  const root = el('div', 'status');
  root.appendChild(el('h2', 'overlay-title', UI.statusTitle));

  const a = ageParts(s);
  root.appendChild(row(UI.nameLabel, s.name || UI.defaultName));
  root.appendChild(row(UI.ageLabel, UI.ageFormat(a.d, a.h, a.m)));

  for (const key of ['hunger', 'happiness', 'cleanliness', 'energy']) {
    const v = Math.round(s.gauges[key]);
    const r = el('div', 'status-row');
    const track = el('div', 'gauge-track');
    const fill = el('div', 'gauge-fill' + (v < 30 ? ' bad' : v < 60 ? ' mid' : ''));
    fill.style.width = v + '%';
    track.appendChild(fill);
    r.append(el('span', 'status-label', UI.gauges[key]), track, el('span', 'status-num', String(v)));
    root.appendChild(r);
  }

  root.appendChild(row(UI.sickLabel, f.sick ? UI.yes : UI.no));
  root.appendChild(row(UI.sleepLabel, f.sleeping ? UI.yes : UI.no));
  root.appendChild(row(UI.poopLabel, UI.countFormat(f.poops)));
  root.appendChild(row(UI.miniGameLabel, UI.hitsFormat(f.miniGameHigh)));
  root.appendChild(el('p', 'status-note', UI.snackLimitText));
  root.appendChild(backButton(() => closeOverlay(game)));
  openOverlay(game, 'status', root);
}
