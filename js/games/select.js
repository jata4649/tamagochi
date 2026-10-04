// ゲームセレクトオーバーレイ(追加仕様 §3.0)
// 各ゲームは registerGame(id, { thumb, label, start }) でここに登録する
// (select.js から各ゲームを import しない。循環 import を避けるため main.js が各ゲームを読み込む)
import { UI } from '../strings.js';
import { el, spriteImg, openOverlay, closeOverlay } from '../overlays.js';

// タイルの並び(2×2)
const ORDER = ['ball', 'hilo', 'mole', 'catch'];
const registry = new Map();

// thumb: manifest の file 値(または file 値を返す関数。manifest 読み込み後に解決するため)
// label: 表示名 / start(game): 開始処理(未実装なら null)
export function registerGame(id, def) {
  registry.set(id, def);
}

// セーブの games ブロック(v2)から成績を取る。無ければ null
function statsOf(game, id) {
  return game.state.games?.[id] ?? null;
}

function tile(game, id) {
  const def = registry.get(id);
  const b = el('button', 'game-tile');
  b.type = 'button';
  b.dataset.game = id;
  const thumb = typeof def.thumb === 'function' ? def.thumb() : def.thumb;
  b.appendChild(spriteImg(thumb, 'game-thumb'));
  b.appendChild(el('span', 'game-name', def.label));

  const stats = statsOf(game, id);
  if (!def.start) {
    // まだ遊べないゲーム
    b.disabled = true;
    b.appendChild(el('span', 'game-sub', UI.games.wip));
  } else if (stats && stats.plays > 0) {
    b.appendChild(el('span', 'game-sub', UI.games.labelValue(UI.games.bestLabel, stats.best)));
  }

  b.addEventListener('click', () => {
    closeOverlay(game);
    def.start(game);
  });
  return b;
}

export function openGameSelect(game) {
  const root = el('div', 'game-select');
  root.appendChild(el('h2', 'overlay-title', UI.games.selectTitle));
  const grid = el('div', 'game-grid');
  for (const id of ORDER) {
    if (registry.has(id)) grid.appendChild(tile(game, id));
  }
  root.appendChild(grid);
  const back = el('button', 'pill-btn', UI.games.back);
  back.type = 'button';
  back.addEventListener('click', () => closeOverlay(game));
  root.appendChild(back);
  openOverlay(game, 'games', root);
}
