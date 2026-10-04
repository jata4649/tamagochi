// ハイアンドロー(追加仕様 §3.2)
// 表示中のカードより次のカードが強いか弱いかを「たかい / ひくい」で当てる。1セッション = 5回
import { UI } from '../strings.js';
import { gameFile } from '../assets.js';
import { el, spriteImg } from '../overlays.js';
import { beep } from '../sound.js';
import { registerGame, openGameSelect } from './select.js';
import {
  createRun, canStart, payEnergy, clampHappy, addHappy, recordPlay, startCooldown,
  openGameScreen, popFx
} from './common.js';
import { openResult } from './result.js';

const ID = 'hilo';
const ROUNDS = 5;
const FLIP_MS = 500;     // 裏 → 表のフリップ演出
const NEXT_MS = 900;     // 判定を見せてから次の勝負へ
const STRIP_MAX = 5;     // 使ったカードの帯(最大5個)
// 強さ順(1 → 6)。manifest の en 値
export const CARDS = ['card_tree', 'card_cloud', 'card_plane', 'card_sun', 'card_star', 'card_moon'];

// 直前と同じカードは出さない(それ以外は何度でもよい)
export function drawCard(prev) {
  let c;
  do {
    c = Math.floor(Math.random() * CARDS.length);
  } while (c === prev);
  return c;
}

// 報酬: きげん += min(2n, 12)
export function hiloReward(score) {
  return Math.min(2 * score, 12);
}

function cardImg(index, className) {
  return spriteImg(gameFile(index === null ? 'card_back' : CARDS[index]), className);
}

function start(game) {
  if (!canStart(game, ID)) return;
  payEnergy(game);
  game.save();
  play(game);
}

function play(game) {
  const run = createRun();
  let round = 0;
  let score = 0;
  let current = drawCard(null);
  let busy = false;

  // --- 画面 ---
  const root = el('div', 'hilo');
  const head = el('div', 'game-head');
  const roundEl = el('span', 'game-round');
  const scoreEl = el('span', 'game-score');
  const quit = el('button', 'game-quit', UI.games.back); // 途中でやめる(報酬なし)
  quit.type = 'button';
  head.append(quit, roundEl, scoreEl);
  const strip = el('div', 'hilo-strip');        // 使ったカードの帯
  const table = el('div', 'hilo-table');
  const curSlot = el('div', 'hilo-card');
  const nextSlot = el('div', 'hilo-card hilo-next');
  table.append(curSlot, nextSlot);
  const question = el('p', 'game-text', UI.games.hilo.question);
  const btns = el('div', 'game-controls');
  const hi = el('button', 'pill-btn', UI.games.hilo.higher);
  const lo = el('button', 'pill-btn', UI.games.hilo.lower);
  hi.type = lo.type = 'button';
  btns.append(lo, hi);
  root.append(head, strip, table, question, btns);

  const renderHead = () => {
    roundEl.textContent = UI.playRound(Math.min(round + 1, ROUNDS), ROUNDS);
    scoreEl.textContent = UI.games.labelValue(UI.games.scoreLabel, score);
  };
  const showCards = () => {
    curSlot.replaceChildren(cardImg(current, 'hilo-face'));
    nextSlot.replaceChildren(cardImg(null, 'hilo-face'));  // 次のカードは伏せておく
    nextSlot.classList.remove('flip');
  };
  const pushStrip = (index) => {
    strip.appendChild(cardImg(index, 'hilo-mini'));
    while (strip.childElementCount > STRIP_MAX) strip.firstElementChild.remove();
  };
  const setButtons = (on) => { hi.disabled = lo.disabled = !on; };

  const guess = (higher) => {
    if (busy) return;
    busy = true;
    setButtons(false);
    const next = drawCard(current);
    // 裏 → 表のフリップ(前半で裏を回し、半分のところで表に差し替える)
    nextSlot.classList.add('flip');
    run.timeout(() => nextSlot.replaceChildren(cardImg(next, 'hilo-face')), FLIP_MS / 2);
    run.timeout(() => {
      const ok = higher ? next > current : next < current;
      if (ok) {
        score += 1;
        beep('hit');
        popFx(table, 'props/prop_sparkle.png', 'fx-pop', { left: '75%', top: '20%' });
      } else {
        beep('miss');
      }
      renderHead();
      run.timeout(() => {
        pushStrip(current);
        current = next;
        round += 1;
        if (round >= ROUNDS) finish();
        else {
          renderHead();
          showCards();
          busy = false;
          setButtons(true);
        }
      }, NEXT_MS);
    }, FLIP_MS);
  };
  run.on(quit, 'click', () => openGameSelect(game));
  run.on(hi, 'click', () => guess(true));
  run.on(lo, 'click', () => guess(false));

  const finish = () => {
    const delta = clampHappy(hiloReward(score));
    addHappy(game, delta);
    const rec = recordPlay(game, ID, score, { perfect: score === ROUNDS });
    startCooldown(ID);
    game.save();
    const done = () => openResult(game, ID, { score, ...rec, onAgain: () => start(game) });
    if (score === ROUNDS) {
      // 全問正解: prop_star の大演出を見せてから結果へ
      popFx(table, 'props/prop_star.png', 'fx-big-star', { left: '50%', top: '35%' });
      beep('evolve');
      run.timeout(done, 1200);
    } else {
      done();
    }
  };

  renderHead();
  showCards();
  openGameScreen(game, ID, root, run);
}

registerGame(ID, { thumb: () => gameFile('card_back'), label: UI.games.names.hilo, start });
