// ミニゲーム「ボールの飛ぶ方向当て」(仕様書 §4.7)
// 遊び中は背景を公園にし、ゲージとボタンの代わりにこのパネルを出す
import { UI } from './strings.js';
import { el, spriteImg, backButton } from './overlays.js';
import { spawnFx, spawnRandom } from './effects.js';

const ROUNDS = 3;
const SHUFFLE_MS = 1200;  // ボールが左右にすばやく動く時間
const RESULT_MS = 1400;   // 判定を見せる時間
const ANIM_MS = 2500;
const HIT_HAPPY = 12;
const MISS_HAPPY = -4;

const $ = (id) => document.getElementById(id);

function addHappy(state, v) {
  state.gauges.happiness = Math.max(0, Math.min(100, state.gauges.happiness + v));
}

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

export function startMiniGame(game) {
  game.runtime.overlay = 'play';
  game.runtime.park = true;
  showPanel(true);
  runGame(game);
  game.render();
}

function endMiniGame(game) {
  const b = $('mg-ball');
  if (b) b.remove();
  showPanel(false);
  game.runtime.overlay = null;
  game.runtime.park = false;
  game.render();
}

function runGame(game) {
  let round = 0;
  let hits = 0;
  const panel = $('minigame');

  const nextRound = () => {
    round += 1;
    panel.textContent = '';
    panel.appendChild(el('p', 'mg-round', UI.playRound(round, ROUNDS)));
    panel.appendChild(el('p', 'mg-text', UI.playAsk));
    setBall('shuffle');
    // 少し動かしてから選択肢を出す
    setTimeout(() => {
      setBall('center');
      const btns = el('div', 'mg-choices');
      for (const dir of ['left', 'right']) {
        const b = el('button', 'pill-btn', dir === 'left' ? UI.playLeft : UI.playRight);
        b.type = 'button';
        b.addEventListener('click', () => judge(dir));
        btns.appendChild(b);
      }
      panel.appendChild(btns);
    }, SHUFFLE_MS);
  };

  const judge = (guess) => {
    const answer = Math.random() < 0.5 ? 'left' : 'right';
    const hit = guess === answer;
    setBall('fly-' + answer);
    panel.querySelector('.mg-choices').remove();
    panel.querySelector('.mg-text').textContent = hit ? UI.playHit : UI.playMiss;
    if (hit) {
      hits += 1;
      addHappy(game.state, HIT_HAPPY);
      game.runtime.anim = 'play';
      game.runtime.animUntil = Date.now() + ANIM_MS;
      spawnFx('props/prop_star.png', 'fx-pop', { left: '50%', top: '20%' });
      spawnRandom(['props/prop_note.png', 'props/prop_sparkle.png'], 'fx-pop', 2 + Math.floor(Math.random() * 2));
    } else {
      addHappy(game.state, MISS_HAPPY);
    }
    game.render();
    setTimeout(round < ROUNDS ? nextRound : finish, RESULT_MS);
  };

  const finish = () => {
    const f = game.state.flags;
    f.miniGameHigh = Math.max(f.miniGameHigh, hits);
    setBall('hidden');
    panel.textContent = '';
    panel.appendChild(el('p', 'mg-text', UI.playResult(hits, ROUNDS)));
    const btns = el('div', 'mg-choices');
    const again = el('button', 'pill-btn', UI.playAgain);
    again.type = 'button';
    // きげんが最大(表示値 100)なら もう1回 は不可
    if (Math.round(game.state.gauges.happiness) >= 100) {
      again.disabled = true;
      panel.appendChild(el('p', 'mg-note', UI.playMaxHappy));
    }
    again.addEventListener('click', () => runGame(game));
    btns.append(again, backButton(() => endMiniGame(game)));
    panel.appendChild(btns);
    game.render();
  };

  nextRound();
}
