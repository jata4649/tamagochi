// 共通の結果オーバーレイ(追加仕様 §3.5)
// 「けっか スコア: ○ / いちばん: ○ / きろく更新!」+「もう一回」「もどる」
import { UI } from '../strings.js';
import { el, spriteImg, openOverlay } from '../overlays.js';
import { createRun, isCoolingDown } from './common.js';
import { openGameSelect } from './select.js';

// score: 今回のスコア / best: これまでの最高 / isRecord: 記録更新したか
// onAgain(): もう一回(休憩中は押せない)
export function openResult(game, id, { score, best, isRecord, onAgain }) {
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
    const cooling = isCoolingDown(id);
    again.disabled = cooling;
    note.textContent = cooling ? UI.games.cooldown : '';
  };
  refresh();
  run.interval(refresh, 1000);

  openOverlay(game, 'result', root, () => run.dispose());
}
