// おんぷキャッチ(追加仕様 §3.4)
// N0: セレクト画面への登録のみ(start が null のあいだは「じっそうちゅう」と表示)
import { UI } from '../strings.js';
import { gameFile } from '../assets.js';
import { registerGame } from './select.js';

registerGame('catch', { thumb: () => gameFile('basket'), label: UI.games.names.catch, start: null });
