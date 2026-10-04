// ボールあて = 既存の「ボールの飛ぶ方向当て」(仕様書 §4.7 / 追加仕様 §3.1)
// 遊び中は背景を公園にし、ゲージとボタンの代わりにこのパネルを出す
// 遊び方(3ラウンド・あたり +12 / はずれ −4)は変えず、追加仕様 §2.4 の共通ルール
// (げんき −5・1プレイの きげん は +15〜−8 まで・休憩3分)と共通の結果画面 §3.5 に乗せた
import { UI } from '../strings.js';
import { el, spriteImg, closeOverlay } from '../overlays.js';
import { spawnFx, spawnRandom } from '../effects.js';
import { beep } from '../sound.js';
import { registerGame } from './select.js';
import {
  createRun, canStart, payEnergy, clampHappy, addHappy, recordPlay, startCooldown
} from './common.js';
import { openResult } from './result.js';

const ID = 'ball';

const ROUNDS = 3;
const SHUFFLE_MS = 1200;  // ボールが左右にすばやく動く時間
const RESULT_MS = 1400;   // 判定を見せる時間
const ANIM_MS = 2500;
const HIT_HAPPY = 12;
const MISS_HAPPY = -4;

const $ = (id) => document.getElementById(id);

// ステージ上のボール
function ball() {
  let b = $('mg-ball');
  if (!b) {
    b = spriteImg('props/prop_ball.png', 'mg-ball');
    b.id = 'mg-ball';
    $('fx-layer').appendChild(b);
  }
  return b;
}
function setBall(cls) {
  ball().className = 'sprite mg-ball ' + cls;
}

// パネル表示の切り替え
function showPanel(on) {
  $('minigame').hidden = !on;
  $('gauges').hidden = on;
  $('actions').hidden = on;
}

let current = null; // 遊んでいる回のタイマー・リスナー(終わるときに全部解除する)

export function startMiniGame(game) {
  game.runtime.overlay = 'play';
  game.runtime.park = true;
  showPanel(true);
  runGame(game);
  game.render();
}

export function endMiniGame(game) {
  if (current) current.dispose();
  current = null;
  const b = $('mg-ball');
  if (b) b.remove();
  showPanel(false);
  game.runtime.overlay = null;
  game.runtime.park = false;
  game.render();
}

// ボールの飛ぶ方向を決める(M5 の乱数調整)
// 基本は五分五分。ただし同じ方向が3回続かないようにする(運だけで全部外れる/当たるのを減らす)
function pickAnswer(history) {
  const ans = Math.random() < 0.5 ? 'left' : 'right';
  const n = history.length;
  if (n >= 2 && history[n - 1] === history[n - 2] && history[n - 1] === ans) {
    return ans === 'left' ? 'right' : 'left';
  }
  return ans;
}

function runGame(game) {
  if (current) current.dispose();
  const run = createRun();
  current = run;
  let total = 0; // この回の きげん の増減(合計)
  let round = 0;
  let hits = 0;
  const history = [];
  const panel = $('minigame');

  const nextRound = () => {
    round += 1;
    panel.textContent = '';
    panel.appendChild(el('p', 'mg-round', UI.playRound(round, ROUNDS)));
    panel.appendChild(el('p', 'mg-text', UI.playAsk));
    setBall('shuffle');
    // 少し動かしてから選択肢を出す
    run.timeout(() => {
      setBall('center');
      const btns = el('div', 'mg-choices');
      for (const dir of ['left', 'right']) {
        const b = el('button', 'pill-btn', dir === 'left' ? UI.playLeft : UI.playRight);
        b.type = 'button';
        run.on(b, 'click', () => judge(dir));
        btns.appendChild(b);
      }
      panel.appendChild(btns);
    }, SHUFFLE_MS);
  };

  const judge = (guess) => {
    const answer = pickAnswer(history);
    history.push(answer);
    const hit = guess === answer;
    setBall('fly-' + answer);
    panel.querySelector('.mg-choices').remove();
    panel.querySelector('.mg-text').textContent = hit ? UI.playHit : UI.playMiss;
    if (hit) {
      hits += 1;
      beep('hit');
      changeHappy(HIT_HAPPY);
      game.runtime.anim = 'play';
      game.runtime.animUntil = Date.now() + ANIM_MS;
      spawnFx('props/prop_star.png', 'fx-pop', { left: '50%', top: '20%' });
      spawnRandom(['props/prop_note.png', 'props/prop_sparkle.png'], 'fx-pop', 2 + Math.floor(Math.random() * 2));
    } else {
      changeHappy(MISS_HAPPY);
      beep('miss');
    }
    game.render();
    game.save();
    run.timeout(round < ROUNDS ? nextRound : finish, RESULT_MS);
  };

  // 1プレイの合計が +15〜−8 に収まるように きげん を動かす(§2.4)
  const changeHappy = (v) => {
    const next = clampHappy(total + v);
    addHappy(game, next - total);
    total = next;
  };

  const finish = () => {
    const f = game.state.flags;
    f.miniGameHigh = Math.max(f.miniGameHigh, hits);
    const rec = recordPlay(game, ID, hits);
    startCooldown(ID);
    game.save();
    endMiniGame(game);
    openResult(game, ID, {
      score: hits,
      ...rec,
      onAgain: () => start(game),
      // 元の仕様 §4.7: きげんが最大(表示値 100)なら もう1回 は不可
      againBlocked: () => (Math.round(game.state.gauges.happiness) >= 100 ? UI.playMaxHappy : null)
    });
  };

  nextRound();
}

// 開始: 病気・げんき・休憩を確かめてから、セレクト画面を閉じて始める
function start(game) {
  if (!canStart(game, ID)) return;
  payEnergy(game);
  game.save();
  closeOverlay(game);
  startMiniGame(game);
}

registerGame(ID, { thumb: 'props/prop_ball.png', label: UI.games.names.ball, start });
