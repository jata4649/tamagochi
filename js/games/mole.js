// もぐらたたき(追加仕様 §3.3)
// N0: セレクト画面への登録のみ(start が null のあいだは「じっそうちゅう」と表示)
import { UI } from '../strings.js';
import { gameFile } from '../assets.js';
import { registerGame } from './select.js';

registerGame('mole', { thumb: () => gameFile('mole'), label: UI.games.names.mole, start: null });
