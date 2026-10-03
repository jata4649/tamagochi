// 画面描画まわり(M0: メイン画面の静的表示とトースト)
import { UI } from './strings.js';
import { assetPath, ACTION_ICONS } from './assets.js';

const GAUGE_KEYS = ['hunger', 'happiness', 'cleanliness', 'energy'];
const ACTION_KEYS = ['meal', 'snack', 'play', 'bath', 'toilet', 'medicine', 'sleep', 'status'];

const $ = (id) => document.getElementById(id);

// 静的な文言(辞書由来)を差し込む
export function applyStaticText() {
  document.title = UI.appTitle;
  $('age-label').textContent = UI.ageLabel;
  $('alert-icon').alt = UI.alertText;
}

// ゲージ4本の DOM を生成
export function buildGauges() {
  const box = $('gauges');
  box.textContent = '';
  for (const key of GAUGE_KEYS) {
    const row = document.createElement('div');
    row.className = 'gauge';
    row.innerHTML =
      '<span class="gauge-label"></span>' +
      '<div class="gauge-track"><div class="gauge-fill"></div></div>';
    row.querySelector('.gauge-label').textContent = UI.gauges[key];
    row.dataset.key = key;
    box.appendChild(row);
  }
}

// ゲージの値(0〜100)を反映。30 未満で赤、60 未満で黄
export function renderGauges(gauges) {
  for (const row of $('gauges').children) {
    const v = Math.max(0, Math.min(100, gauges[row.dataset.key] ?? 0));
    const fill = row.querySelector('.gauge-fill');
    fill.style.width = v + '%';
    fill.classList.toggle('bad', v < 30);
    fill.classList.toggle('mid', v >= 30 && v < 60);
  }
}

// 8ボタンを生成し、押されたら onAction(key) を呼ぶ
export function buildActions(onAction) {
  const nav = $('actions');
  nav.textContent = '';
  for (const key of ACTION_KEYS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'action-btn';
    btn.dataset.action = key;
    const img = document.createElement('img');
    img.className = 'sprite';
    img.src = assetPath(ACTION_ICONS[key]);
    img.alt = '';
    const label = document.createElement('span');
    label.textContent = UI.actions[key];
    btn.append(img, label);
    btn.addEventListener('click', () => onAction(key));
    nav.appendChild(btn);
  }
}

// 上部バー: 名前・年齢・時刻
export function renderTopbar({ name, ageText }) {
  $('pet-name').textContent = name;
  $('pet-age').textContent = ageText;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  $('clock').textContent = `${hh}:${mm}`;
}

// ペットのスプライト。変わったときだけ src を差し替える
export function renderPet(file) {
  const pet = $('pet');
  const src = assetPath(file);
  if (pet.getAttribute('src') !== src) pet.setAttribute('src', src);
}

// 背景: 'day' | 'night' | 'park'(画像の指定は CSS 側のクラスで行う)
export function renderBackground(kind) {
  const stage = $('stage');
  stage.classList.toggle('bg-night', kind === 'night');
  stage.classList.toggle('bg-park', kind === 'park');
}

// alert アイコンの点滅(§4.8)
export function renderAlert(on) {
  $('alert-icon').classList.toggle('blink', on);
}

// トースト表示(alert() の代わり)
let toastTimer = null;
export function showToast(text, ms = 1800) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}
