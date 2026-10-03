// 8つのボタンアクションの処理(仕様書 §4.5)
import { UI } from './strings.js';
import { showToast } from './ui.js';
import { spawnFx, fadeOutPoops } from './effects.js';
import { openMealMenu, openStatus } from './overlays.js';
import { startMiniGame } from './minigame.js';
import { beep } from './sound.js';

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
export const ANIM_MS = 2500;       // アクション演出の長さ(§4.4)
const BATH_MS = 3000;              // おふろ演出の長さ(§4.5)
const SNACK_WINDOW_MS = 6 * HOUR;  // おやつ回数制限の窓
const SNACK_MAX = 3;

// 食材(§5.3)。ごはん系は おなか+25 / きげん+3、飲みものは おなか+3 / げんき+5
export const FOODS = [
  'onigiri', 'bread', 'burger', 'cake', 'apple', 'chips',
  'ricebowl', 'banana', 'icecream', 'cookie', 'water', 'juice'
].map((key) => {
  const drink = key === 'water' || key === 'juice';
  return {
    key,
    file: `foods/food_${key}.png`,
    effect: drink ? { hunger: 3, energy: 5 } : { hunger: 25, happiness: 3 },
    drink
  };
});

// ゲージに加算(0〜100 に収める)
function add(state, key, v) {
  state.gauges[key] = Math.max(0, Math.min(100, state.gauges[key] + v));
}

// 食事成功の 15〜40 分後にうんちを予約(予約済みなら上書きしない)
function schedulePoop(state, now) {
  if (state.flags.pendingPoopAt !== null) return;
  const min = 15 + Math.random() * 25;
  state.flags.pendingPoopAt = now + min * MINUTE;
}

// アクション演出(*_eat など)を 2.5 秒表示
function playAnim(game, anim) {
  game.runtime.anim = anim;
  game.runtime.animUntil = Date.now() + ANIM_MS;
}

// 成功時のハート(スプライト右上から浮上)
function heart() {
  spawnFx('props/prop_heart.png', 'fx-heart', { left: '60%', top: '30%' });
}

// 口元に食べ物を表示
function showFood(file) {
  spawnFx(file, 'fx-food');
}

// ---- 各アクション ----

// 食材を選んだあとの処理(病気中は効果半分)
export function eat(game, food) {
  const s = game.state;
  const rate = s.flags.sick ? 0.5 : 1;
  for (const [k, v] of Object.entries(food.effect)) add(s, k, v * rate);
  if (!food.drink) schedulePoop(s, Date.now());
  playAnim(game, 'eat');
  beep('eat');
  showFood(food.file);
  heart();
}

function snack(game) {
  const s = game.state;
  const f = s.flags;
  const now = Date.now();
  if (now - f.snacksWindowStart >= SNACK_WINDOW_MS) {
    f.snacksWindowStart = now;
    f.snacksCount = 0;
  }
  if (f.snacksCount >= SNACK_MAX) {
    add(s, 'happiness', -5);
    beep('ng');
    showToast(UI.refuseMoreSnack);
    return;
  }
  f.snacksCount += 1;
  add(s, 'hunger', 8);
  add(s, 'happiness', 15);
  schedulePoop(s, now);
  playAnim(game, 'eat');
  beep('eat');
  showFood('icons/icon_snack.png');
  heart();
}

function play(game) {
  if (game.state.flags.sick) {
    beep('ng');
    showToast(UI.cannotPlaySick);
    return;
  }
  startMiniGame(game);
}

function bath(game) {
  game.runtime.busyUntil = Date.now() + BATH_MS;
  beep('clean');
  spawnFx('icons/icon_bath.png', 'fx-bath', { left: '50%', top: '10%' });
  for (const pos of [['30%', '35%'], ['62%', '28%'], ['45%', '55%']]) {
    spawnFx('props/prop_sparkle.png', 'fx-sparkle-slow', { left: pos[0], top: pos[1] });
  }
  // 3秒の演出が終わったら反映
  setTimeout(() => {
    add(game.state, 'cleanliness', 100);
    add(game.state, 'happiness', 2);
    game.render();
    game.save();
  }, BATH_MS);
}

function toilet(game) {
  const f = game.state.flags;
  if (f.poops === 0) return; // うんちが無ければ何も変わらない
  f.poops = 0;
  fadeOutPoops();
  beep('clean');
  showToast(UI.cleanPoopDone);
}

function medicine(game) {
  const s = game.state;
  spawnFx('icons/icon_medicine.png', 'fx-float', { left: '50%', top: '30%' });
  if (s.flags.sick) {
    s.flags.sick = false;
    s.flags.zeroHungerSince = s.gauges.hunger <= 0 ? Date.now() : null;
    add(s, 'happiness', 5);
    beep('wake');
  } else {
    // 病気でないのに飲んだ(過剰投与ペナルティ)
    add(s, 'happiness', -5);
    beep('ng');
    showToast(UI.medicineHealthy);
  }
}

function sleep(game) {
  const f = game.state.flags;
  f.sleeping = !f.sleeping;
  beep(f.sleeping ? 'sleep' : 'wake');
  if (!f.sleeping) {
    add(game.state, 'happiness', 5);
    showToast(UI.wakeUpMsg);
  }
}

const HANDLERS = {
  meal: (game) => {
    beep('tap');
    openMealMenu(game, FOODS, (food) => { eat(game, food); game.render(); game.save(); });
  },
  snack, play, bath, toilet, medicine, sleep,
  status: (game) => { beep('tap'); openStatus(game); }
};

// ボタンが押せない状態か(演出中・オーバーレイ表示中)
export function isBusy(game) {
  const rt = game.runtime;
  return Date.now() < rt.busyUntil || rt.overlay !== null;
}

// ボタンから呼ばれる入口
export function handleAction(game, key) {
  if (isBusy(game)) return;
  const s = game.state;
  // 眠り中は おやすみ 以外を受け付けない
  if (s.flags.sleeping && key !== 'sleep') {
    beep('ng');
    showToast(UI.sleepingNow);
    return;
  }
  HANDLERS[key](game);
  game.render();
  game.save(); // 各アクション後にセーブ(§6)
}
