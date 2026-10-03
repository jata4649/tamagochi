// せってい(M5 のオプション): B/C の表情流用・効果音・育つはやさ
// ゲームのセーブ(tt_save_v1)とは別のキーに保存する
import { UI } from './strings.js';
import { el, openOverlay, closeOverlay, backButton } from './overlays.js';
import { TIME_SCALE, setTimeScale } from './lifecycle.js';
import { setSoundOn } from './sound.js';

const KEY = 'tt_settings_v1';
const DEFAULTS = { hue: true, sound: false, speed: 'demo' };

export const settings = { ...DEFAULTS };

export function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && typeof raw === 'object') {
      settings.hue = typeof raw.hue === 'boolean' ? raw.hue : DEFAULTS.hue;
      settings.sound = raw.sound === true;
      settings.speed = raw.speed === 'real' ? 'real' : 'demo';
    }
  } catch (e) {
    // 壊れていたら既定値のまま
  }
  apply();
}

function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('設定の保存に失敗', e);
  }
}

function apply() {
  setTimeScale(settings.speed === 'real' ? TIME_SCALE.REALISTIC : TIME_SCALE.DEMO);
  setSoundOn(settings.sound);
}

// 2択の切替ボタン行
function choiceRow(label, options, current, onChange) {
  const row = el('div', 'status-row setting-row');
  row.appendChild(el('span', 'status-label', label));
  const box = el('div', 'setting-choices');
  for (const [value, text] of options) {
    const b = el('button', 'setting-btn' + (value === current ? ' selected' : ''), text);
    b.type = 'button';
    b.addEventListener('click', () => {
      box.querySelectorAll('.setting-btn').forEach((x) => x.classList.toggle('selected', x === b));
      onChange(value);
    });
    box.appendChild(b);
  }
  row.appendChild(box);
  return row;
}

export function openSettings(game) {
  const root = el('div', 'settings');
  root.appendChild(el('h2', 'overlay-title', UI.settingsTitle));
  const update = (key) => (value) => {
    settings[key] = value;
    saveSettings();
    apply();
    game.render();
  };
  const onOff = [[true, UI.on], [false, UI.off]];
  root.appendChild(choiceRow(UI.settingHue, onOff, settings.hue, update('hue')));
  root.appendChild(choiceRow(UI.settingSound, onOff, settings.sound, update('sound')));
  root.appendChild(choiceRow(UI.settingSpeed, [['demo', UI.speedDemo], ['real', UI.speedReal]], settings.speed, update('speed')));
  root.appendChild(el('p', 'status-note', UI.settingHueNote));
  root.appendChild(backButton(() => closeOverlay(game)));
  openOverlay(game, 'settings', root);
}
