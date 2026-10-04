// 全画面の画面: タイトル・名前入力・お別れ(仕様書 §5.1・§5.3)
// いずれも #overlay を全面(.screen)で使う
import { UI } from './strings.js';
import { el, spriteImg, openOverlay, closeOverlay } from './overlays.js';
import { ageParts, PICKABLE_COLORWAYS } from './state.js';
import { msUntilHatch } from './lifecycle.js';

const NAME_MAX = 8;
const $ = (id) => document.getElementById(id);

function button(text, className, onClick) {
  const b = el('button', className, text);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

// [タイトル] 色を選んで「たまごをもらう」。たまご中は孵化までの残り時間を表示
// onStart(colorway) で新規開始
export function openTitle(game, onStart) {
  let colorway = 'a';
  const root = el('div', 'title-screen');
  root.appendChild(el('h1', 'app-title', UI.appTitle));
  root.appendChild(spriteImg('sprites/pet_egg.png', 'title-egg'));

  const status = el('p', 'title-status');
  status.id = 'hatch-status';
  root.appendChild(status);

  const pick = el('div', 'color-pick');
  pick.id = 'color-pick';
  pick.appendChild(el('p', 'color-pick-label', UI.colorPick));
  const row = el('div', 'color-row');
  for (const c of PICKABLE_COLORWAYS) { // 選べるのは A/B/C だけ(新種族は孵化のときに決まる)
    const b = button('', 'color-btn', () => {
      colorway = c;
      row.querySelectorAll('.color-btn').forEach((x) => x.classList.toggle('selected', x === b));
    });
    b.append(spriteImg(`sprites/pet_${c}_baby_idle.png`), el('span', '', UI.colorwayName[c]));
    b.classList.toggle('selected', c === colorway);
    row.appendChild(b);
  }
  pick.appendChild(row);
  pick.appendChild(button(UI.startBtn, 'pill-btn start-btn', () => onStart(colorway)));
  root.appendChild(pick);

  openOverlay(game, 'title', root);
  $('overlay').classList.add('screen');
  updateTitle(game);
}

// タイトルの表示更新(たまご待ちなら残り時間、未開始なら色選び)
export function updateTitle(game) {
  const s = game.state;
  const waiting = s && s.stage === 'egg';
  const status = $('hatch-status');
  if (!status) return;
  $('color-pick').hidden = waiting;
  if (!waiting) {
    status.textContent = '';
    return;
  }
  const min = Math.ceil(msUntilHatch(s) / 60000);
  status.textContent = min > 1 ? UI.hatchCountdown(min) : UI.hatchSoon;
}

// [名前入力] 孵化直後に表示。空なら既定名
export function openNameInput(game, onDone) {
  const root = el('div', 'name-screen');
  root.appendChild(el('h2', 'overlay-title', UI.nameTitle));
  root.appendChild(spriteImg(`sprites/pet_${game.state.colorway}_baby_idle.png`, 'name-pet'));
  const input = el('input', 'name-input');
  input.type = 'text';
  input.maxLength = NAME_MAX;
  input.placeholder = UI.defaultName;
  input.setAttribute('aria-label', UI.nameTitle);
  const done = () => onDone(input.value.trim() || UI.defaultName);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(); });
  root.append(input, button(UI.okBtn, 'pill-btn', done));
  openOverlay(game, 'name', root);
}

// [お別れ] angel を中央に大きく・年齢・文言・「あたらしいたまご」
export function openGone(game, onReset, filter = '') {
  const a = ageParts(game.state);
  const root = el('div', 'gone-screen');
  root.appendChild(el('h2', 'overlay-title', UI.goneTitle));
  const angel = spriteImg('sprites/pet_a_adult_angel.png', 'gone-angel');
  angel.style.filter = filter; // B/C は色を合わせる(せってい次第)
  root.appendChild(angel);
  root.appendChild(el('p', 'gone-name', game.state.name || UI.defaultName));
  root.appendChild(el('p', 'gone-age', `${UI.ageLabel} ${UI.ageFormat(a.d, a.h, a.m)}`));
  root.appendChild(el('p', 'gone-body', UI.goneBody));
  root.appendChild(button(UI.resetBtn, 'pill-btn', onReset));
  openOverlay(game, 'gone', root);
  $('overlay').classList.add('screen');
}

// 全画面を閉じる
export function closeScreen(game) {
  $('overlay').classList.remove('screen');
  closeOverlay(game);
}
