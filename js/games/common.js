// ミニゲーム共通の部品(追加仕様 §2.2・§2.4)
// - createRun(): タイマー/リスナー/requestAnimationFrame をまとめて登録し、dispose() で全部解除する
// - canStart(): 開始できるか(病気・げんき・休憩)
// - payEnergy() / clampHappy() / recordPlay(): 消耗・報酬・成績の共通ルール
import { UI } from '../strings.js';
import { showToast } from '../ui.js';
import { el, spriteImg, openOverlay } from '../overlays.js';

export const ENERGY_COST = 5;   // 1プレイで げんき −5
export const HAPPY_MAX = 15;    // 1プレイの きげん 増加の上限
export const HAPPY_MIN = -8;    // 1プレイの きげん 減少の下限

// 動いているタイマー等の数(検収用: tt.gameDebug.live で 0 に戻ることを確認する)
export const gameDebug = { live: 0 };

export function createRun() {
  let alive = true;
  const timeouts = new Set();
  const intervals = new Set();
  const frames = new Set();
  const offs = [];

  const run = {
    get alive() { return alive; },

    // setTimeout(終了後は呼ばれない)
    timeout(fn, ms) {
      if (!alive) return null;
      const id = setTimeout(() => {
        timeouts.delete(id);
        gameDebug.live--;
        if (alive) fn();
      }, ms);
      timeouts.add(id);
      gameDebug.live++;
      return id;
    },

    clearTimeout(id) {
      if (timeouts.delete(id)) {
        clearTimeout(id);
        gameDebug.live--;
      }
    },

    // setInterval
    interval(fn, ms) {
      if (!alive) return null;
      const id = setInterval(() => { if (alive) fn(); }, ms);
      intervals.add(id);
      gameDebug.live++;
      return id;
    },

    // requestAnimationFrame のループ。fn(dt ミリ秒) が false を返すと止まる
    // 画面が隠れている間はゲーム内時間を進めない(dt = 0)。
    // 普通は隠れると rAF 自体が止まるが、止まらない環境でも時間が飛ばないようにする。
    // 戻ったときの dt も最大 100ms に抑える
    loop(fn) {
      if (!alive) return;
      let last = performance.now();
      const tick = (now) => {
        frames.delete(handle);
        gameDebug.live--;
        if (!alive) return;
        const dt = document.visibilityState === 'hidden' ? 0 : Math.min(100, now - last);
        last = now;
        if (fn(dt) === false) return;
        handle = requestAnimationFrame(tick);
        frames.add(handle);
        gameDebug.live++;
      };
      let handle = requestAnimationFrame(tick);
      frames.add(handle);
      gameDebug.live++;
    },

    // addEventListener(dispose で removeEventListener)
    on(target, type, fn, opts) {
      if (!alive) return;
      target.addEventListener(type, fn, opts);
      gameDebug.live++;
      offs.push(() => {
        target.removeEventListener(type, fn, opts);
        gameDebug.live--;
      });
    },

    // 全部解除する(何度呼んでもよい)
    dispose() {
      if (!alive) return;
      alive = false;
      for (const id of timeouts) clearTimeout(id);
      for (const id of intervals) clearInterval(id);
      for (const id of frames) cancelAnimationFrame(id);
      gameDebug.live -= timeouts.size + intervals.size + frames.size;
      timeouts.clear();
      intervals.clear();
      frames.clear();
      offs.splice(0).forEach((off) => off());
    }
  };
  return run;
}

// 休憩中のゲーム(id → 再開できる時刻)。追加仕様 §2.4 の「同じゲームは3分間 再開不可」
const cooldownUntil = new Map();
export const COOLDOWN_MS = 3 * 60 * 1000;

export function isCoolingDown(id, now = Date.now()) {
  return (cooldownUntil.get(id) ?? 0) > now;
}
export function startCooldown(id, now = Date.now()) {
  cooldownUntil.set(id, now + COOLDOWN_MS);
}
// 検収用: 休憩を解除する
export function clearCooldowns() {
  cooldownUntil.clear();
}

// 開始できるか。できないときは理由をトーストで出して false
export function canStart(game, id) {
  const s = game.state;
  if (s.flags.sick) {
    showToast(UI.cannotPlaySick);
    return false;
  }
  if (isCoolingDown(id)) {
    showToast(UI.games.cooldown);
    return false;
  }
  if (s.gauges.energy < ENERGY_COST) {
    showToast(UI.games.lowEnergy);
    return false;
  }
  return true;
}

// 開始時に げんき を払う
export function payEnergy(game) {
  const g = game.state.gauges;
  g.energy = Math.max(0, g.energy - ENERGY_COST);
}

// 1プレイ分の きげん の増減を上限・下限に収める
export function clampHappy(delta) {
  return Math.max(HAPPY_MIN, Math.min(HAPPY_MAX, delta));
}

export function addHappy(game, delta) {
  const g = game.state.gauges;
  g.happiness = Math.max(0, Math.min(100, g.happiness + delta));
}

// 成績を記録する。戻り値: { best, isRecord }
export function recordPlay(game, id, score) {
  const stats = game.state.games[id];
  const isRecord = score > stats.best;
  stats.plays += 1;
  if (isRecord) stats.best = score;
  return { best: stats.best, isRecord };
}

// ゲーム画面(全面)を開く。閉じる/差し替えのときに run を必ず片付ける
// noTouch: true なら touch-action: none(もぐらたたき・おんぷキャッチ用)
export function openGameScreen(game, id, content, run, { noTouch = false } = {}) {
  const root = el('div', `game-screen game-${id}` + (noTouch ? ' no-touch' : ''));
  root.appendChild(content);
  openOverlay(game, 'game', root, () => run.dispose());
  const box = document.getElementById('overlay');
  box.classList.add('screen', 'game-overlay');
}

// ゲーム画面の上の小さな演出(終わったら消える)
export function popFx(container, file, className, pos = {}) {
  const img = spriteImg(file, 'fx ' + className);
  if (pos.left) img.style.left = pos.left;
  if (pos.top) img.style.top = pos.top;
  img.addEventListener('animationend', () => img.remove(), { once: true });
  container.appendChild(img);
  return img;
}
