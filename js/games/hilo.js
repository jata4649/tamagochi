// ハイアンドロー(追加仕様 §3.2)
// N0: セレクト画面への登録のみ(start が null のあいだは「じっそうちゅう」と表示)
import { UI } from '../strings.js';
import { gameFile } from '../assets.js';
import { registerGame } from './select.js';

registerGame('hilo', { thumb: () => gameFile('card_back'), label: UI.games.names.hilo, start: null });
