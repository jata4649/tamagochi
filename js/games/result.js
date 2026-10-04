// 共通の結果オーバーレイ(追加仕様 §3.5)
// 「けっか スコア: ○ / いちばん: ○ / きろく更新!」+「もう一回」「もどる」
import { UI } from '../strings.js';
import { el, spriteImg, openOverlay } from '../overlays.js';
import { createRun, isCoolingDown } from './common.js';
import { openGameSelect } from './select.js';
import { shopFile } from '../assets.js';
import { addCoins } from '../economy.js';

// score: 今回のスコア / best: これまでの最高 / isRecord: 記録更新したか
// onAgain(): もう一回(休憩中は押せない)
// againBlocked(): 休憩のほかに「もう一回」を止める理由があれば文言を返す(ボールあての きげん最大など)
// paid: アルバイト代(ドッチ)。この画面を出すときに1回だけ所持ドッチに足す(アルバイト&ショップ §3)
export function openResult(game, id, { score, best, isRecord, onAgain, againBlocked = () => null, paid = 0 }) {
  const run = createRun();
  const root = el('div', 'game-result');
  root.appendChild(el('h2', 'overlay-title', UI.games.resultTitle));
  root.appendChild(el('p', 'result-game', UI.games.names[id]));

  // 小さなハートの演出
  const heart = spriteImg('props/prop_heart.png', 'result-heart');
  root.appendChild(heart);

  root.appendChild(el('p', 'result-score', UI.games.labelValue(UI.games.scoreLabel, score)));
  root.appendChild(el('p', 'result-best', UI.games.labelValue(UI.games.bestLabel, best)));
  if (isRecord) root.appendChild(el('p', 'result-record', UI.games.newRecord));

  // アルバイト代: 表示と同時に1回だけ加算(この関数は1プレイにつき1回しか呼ばれない)
  addCoins(game.state, paid);
  game.save();
  const job = el('p', 'result-paid');
  job.append(spriteImg(shopFile('coin'), 'result-coin'), el('span', '', UI.jobs.paid.replace('{n}', paid)));
  root.appendChild(job);

  const note = el('p', 'result-note', '');
  root.appendChild(note);

  const btns = el('div', 'mg-choices');
  const again = el('button', 'pill-btn', UI.games.again);
  again.type = 'button';
  again.addEventListener('click', () => {
    if (!again.disabled) onAgain();
  });
  const back = el('button', 'pill-btn', UI.games.back);
  back.type = 'button';
  back.addEventListener('click', () => openGameSelect(game));
  btns.append(again, back);
  root.appendChild(btns);

  // 休憩中は「もう一回」を押せない。3分たったら押せるようにする
  const refresh = () => {
    const reason = isCoolingDown(id) ? UI.games.cooldown : againBlocked();
    again.disabled = Boolean(reason);
    note.textContent = reason || '';
  };
  refresh();
  run.interval(refresh, 1000);

  openOverlay(game, 'result', root, () => run.dispose());
}
