// おんぷキャッチ(追加仕様 §3.4)
// 下のかごを 左/中央/右 の3か所に動かして、上から落ちてくるものを受ける。30秒
// おんぷ +1 / ほし +3 / うんち −2(かごが震える)。取りこぼしは 0点
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

const ID = 'catch';
const TIME_MS = 30000;          // 制限時間 30秒
const LATE_FROM_MS = 15000;     // 後半
const SPAWN_MS = [350, 600];    // 落とす間隔 [前半, 後半](§3.4 のとおり)
const FALL_MS = 2400;           // 上から下まで落ちる時間(CSS アニメ)
const SHAKE_MS = 400;           // うんちを取ったときのかごの震え
const LANES = 3;

// 落下物の種類(file は manifest の file 値)
export const DROPS = {
  note: { file: 'props/prop_note.png', points: 1 },
  star: { file: 'props/prop_star.png', points: 3 },
  poop: { file: 'props/prop_poop.png', points: -2 }
};
// 出る割合: おんぷ 65% / うんち 25% / ほし 10%
export function pickDrop(r = Math.random()) {
  if (r < 0.10) return 'star';
  if (r < 0.35) return 'poop';
  return 'note';
}

// 報酬: きげん += min(score, 12)。マイナスなら 0
export function catchReward(score) {
  return Math.max(0, Math.min(score, 12));
}

// 矩形の交差(AABB)。落下物の矩形は少し小さくして判定をゆるめにする
export function hits(a, b, shrink = 0.2) {
  const dx = a.width * shrink / 2;
  const dy = a.height * shrink / 2;
  return a.left + dx < b.right && a.right - dx > b.left &&
         a.top + dy < b.bottom && a.bottom - dy > b.top;
}

function start(game) {
  if (!canStart(game, ID)) return;
  payEnergy(game);
  game.save();
  play(game);
}

function play(game) {
  const run = createRun();
  let elapsed = 0;
  let nextSpawn = 300;
  let score = 0;
  let lane = 1;               // 0=ひだり 1=まんなか 2=みぎ
  let ended = false;
  const drops = [];           // { el, kind }

  // --- 画面 ---
  const root = el('div', 'catch');
  const head = el('div', 'game-head');
  const quit = el('button', 'game-quit', UI.games.back);
  quit.type = 'button';
  const timeEl = el('span', 'game-round');
  const scoreEl = el('span', 'game-score');
  head.append(quit, timeEl, scoreEl);
  const field = el('div', 'catch-field');
  const basket = spriteImg(gameFile('basket'), 'catch-basket');
  field.appendChild(basket);
  const btns = el('div', 'game-controls');
  const left = el('button', 'pill-btn', UI.games.catch.left);
  const right = el('button', 'pill-btn', UI.games.catch.right);
  left.type = right.type = 'button';
  btns.append(left, right);
  root.append(head, field, btns);

  const laneLeft = (i) => `${(i + 0.5) * (100 / LANES)}%`;
  const moveTo = (i) => {
    lane = Math.max(0, Math.min(LANES - 1, i));
    basket.style.left = laneLeft(lane);
  };
  const render = () => {
    const leftSec = Math.max(0, Math.ceil((TIME_MS - elapsed) / 1000));
    timeEl.textContent = UI.games.labelValue(UI.games.mole.timeLeft, leftSec);
    scoreEl.textContent = UI.games.labelValue(UI.games.scoreLabel, score);
  };

  // 操作: ボタン / 画面(落ちてくる場所)タップで その列へ / キーボードの ← →
  run.on(left, 'pointerdown', (e) => { e.preventDefault(); moveTo(lane - 1); });
  run.on(right, 'pointerdown', (e) => { e.preventDefault(); moveTo(lane + 1); });
  run.on(field, 'pointerdown', (e) => {
    const r = field.getBoundingClientRect();
    moveTo(Math.floor(((e.clientX - r.left) / r.width) * LANES));
  });
  run.on(document, 'keydown', (e) => {
    if (e.key === 'ArrowLeft') moveTo(lane - 1);
    if (e.key === 'ArrowRight') moveTo(lane + 1);
  });
  // 画面が隠れたら落下アニメも止める(ゲーム内時間は common.js の loop が止める)
  const syncPause = () => field.classList.toggle('paused', document.visibilityState === 'hidden');
  run.on(document, 'visibilitychange', syncPause);
  run.on(quit, 'click', () => openGameSelect(game));

  const spawn = () => {
    const kind = pickDrop();
    const img = spriteImg(DROPS[kind].file, `catch-drop drop-${kind}`);
    img.style.left = laneLeft(Math.floor(Math.random() * LANES));
    img.style.animationDuration = FALL_MS + 'ms';
    field.appendChild(img);
    drops.push({ el: img, kind });
  };

  const shake = () => {
    basket.classList.remove('shake');
    void basket.offsetWidth; // アニメを最初からやり直すため
    basket.classList.add('shake');
    run.timeout(() => basket.classList.remove('shake'), SHAKE_MS);
  };

  // 毎コマ: かごとの当たり判定、下まで落ちたものの片付け
  const check = () => {
    const b = basket.getBoundingClientRect();
    const f = field.getBoundingClientRect();
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      const r = d.el.getBoundingClientRect();
      if (hits(r, b)) {
        const pts = DROPS[d.kind].points;
        score = Math.max(0, score + pts);
        if (pts < 0) {
          shake();
          beep('miss');
        } else {
          beep(d.kind === 'star' ? 'hit' : 'tap');
        }
        d.el.remove();
        drops.splice(i, 1);
      } else if (r.top >= f.bottom) {
        d.el.remove(); // 取りこぼし(0点)
        drops.splice(i, 1);
      }
    }
  };

  const finish = () => {
    ended = true;
    for (const d of drops) d.el.remove();
    drops.length = 0;
    const delta = clampHappy(catchReward(score));
    addHappy(game, delta);
    const rec = recordPlay(game, ID, score);
    startCooldown(ID);
    game.save();
    beep('evolve');
    run.timeout(() => openResult(game, ID, { score, ...rec, onAgain: () => start(game) }), 600);
  };

  run.loop((dt) => {
    if (ended) return false;
    elapsed += dt;
    if (elapsed >= TIME_MS) {
      render();
      finish();
      return false;
    }
    if (dt > 0 && elapsed >= nextSpawn) {
      spawn();
      nextSpawn = elapsed + (elapsed >= LATE_FROM_MS ? SPAWN_MS[1] : SPAWN_MS[0]);
    }
    check();
    render();
    return true;
  });

  moveTo(1);
  render();
  openGameScreen(game, ID, root, run, { noTouch: true });
  syncPause();
}

registerGame(ID, { thumb: () => gameFile('basket'), label: UI.games.names.catch, start });
