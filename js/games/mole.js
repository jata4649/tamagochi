// もぐらたたき(追加仕様 §3.3)
// 3×3 の巣穴からもぐらが出る。20秒でたたいた数がスコア
// 時間は requestAnimationFrame で数える「ゲーム内時間」。画面が裏に回ると rAF が止まるので、
// ゲームも一緒に止まり、戻ったときに裏で動いていたタイマーが残ることがない
import { UI } from '../strings.js';
import { gameFile } from '../assets.js';
import { el, spriteImg } from '../overlays.js';
import { beep } from '../sound.js';
import { registerGame, openGameSelect } from './select.js';
import {
  createRun, canStart, payEnergy, clampHappy, addHappy, recordPlay, startCooldown,
  openGameScreen
} from './common.js';
import { openResult } from './result.js';

const ID = 'mole';
const HOLES = 9;
const TIME_MS = 20000;          // 制限時間 20秒
const FAST_FROM_MS = 10000;     // 残り10秒から出現頻度アップ
const SPAWN_MS = [900, 380];    // 出現間隔 [前半, 残り10秒](後半は 3体同時まで届く速さ)
const UP_MS = [600, 1100];      // 1体が出ている時間
const MALLET_MS = 300;          // トンカチの表示時間

// 報酬: きげん += min(round(score / 2), 12)
export function moleReward(score) {
  return Math.min(Math.round(score / 2), 12);
}

// 同時に出せる数: 経過時間が長いほど増える(1〜3体)
export function maxUp(elapsed) {
  return Math.min(3, 1 + Math.floor(elapsed / 7000));
}

function start(game) {
  if (!canStart(game, ID)) return;
  payEnergy(game);
  game.save();
  play(game);
}

function play(game) {
  const run = createRun();
  let elapsed = 0;       // ゲーム内時間(ms)
  let nextSpawn = 400;   // 次に出す時刻
  let score = 0;
  let ended = false;

  // --- 画面 ---
  const root = el('div', 'mole');
  const head = el('div', 'game-head');
  const quit = el('button', 'game-quit', UI.games.back);
  quit.type = 'button';
  const timeEl = el('span', 'game-round');
  const scoreEl = el('span', 'game-score');
  head.append(quit, timeEl, scoreEl);
  const field = el('div', 'mole-field');
  root.append(head, field);

  // 巣穴ごとの状態。hideAt はゲーム内時間
  const holes = [];
  for (let i = 0; i < HOLES; i++) {
    const cell = el('div', 'mole-cell');
    const hole = spriteImg(gameFile('hole'), 'mole-hole');
    const mole = spriteImg(gameFile('mole'), 'mole-mole');
    const mallet = spriteImg(gameFile('mallet'), 'mole-mallet');
    cell.append(hole, mole, mallet);
    field.appendChild(cell);
    const h = { cell, mole, mallet, up: false, hideAt: 0 };
    holes.push(h);

    // たたく: 最初のタッチだけ数える(押した瞬間に引っ込めて二重カウントを防ぐ)
    const hit = (e) => {
      e.preventDefault();
      if (!h.up || ended) return;
      h.up = false;
      mole.classList.remove('up');
      score += 1;
      beep('tap');
      mallet.classList.add('show');
      run.timeout(() => mallet.classList.remove('show'), MALLET_MS);
      render();
    };
    run.on(mole, 'pointerdown', hit);
    run.on(mole, 'touchstart', hit, { passive: false }); // 古い端末向けに併用(上の判定で1回だけ数える)
  }

  const render = () => {
    const left = Math.max(0, Math.ceil((TIME_MS - elapsed) / 1000));
    timeEl.textContent = UI.games.labelValue(UI.games.mole.timeLeft, left);
    scoreEl.textContent = UI.games.labelValue(UI.games.scoreLabel, score);
  };

  const spawn = () => {
    const upCount = holes.filter((h) => h.up).length;
    if (upCount >= maxUp(elapsed)) return;
    const free = holes.filter((h) => !h.up);
    const h = free[Math.floor(Math.random() * free.length)];
    h.up = true;
    h.hideAt = elapsed + UP_MS[0] + Math.random() * (UP_MS[1] - UP_MS[0]);
    h.mole.classList.add('up');
  };

  const finish = () => {
    ended = true;
    for (const h of holes) {
      h.up = false;
      h.mole.classList.remove('up');
    }
    const delta = clampHappy(moleReward(score));
    addHappy(game, delta);
    const rec = recordPlay(game, ID, score);
    startCooldown(ID);
    game.save();
    beep('evolve');
    run.timeout(() => openResult(game, ID, { score, ...rec, onAgain: () => start(game) }), 600);
  };

  run.on(quit, 'click', () => openGameSelect(game));

  run.loop((dt) => {
    elapsed += dt;
    // 時間が来たもぐらを引っ込める
    for (const h of holes) {
      if (h.up && elapsed >= h.hideAt) {
        h.up = false;
        h.mole.classList.remove('up');
      }
    }
    if (elapsed >= TIME_MS) {
      render();
      finish();
      return false; // ループ終了
    }
    if (elapsed >= nextSpawn) {
      spawn();
      nextSpawn = elapsed + (elapsed >= FAST_FROM_MS ? SPAWN_MS[1] : SPAWN_MS[0]);
    }
    render();
    return true;
  });

  render();
  openGameScreen(game, ID, root, run, { noTouch: true });
}

registerGame(ID, { thumb: () => gameFile('mole'), label: UI.games.names.mole, start });
