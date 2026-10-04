// localStorage の読み書き(仕様書 §6)
// オフライン補正は読み込み後に state.advance() で行う(§4.3)
import { createState, SAVE_VERSION, GAME_IDS, ALL_COLORWAYS } from './state.js';

export const SAVE_KEY = 'tt_save_v1';

// 数値に直す(文字列などが入っていても UNIX ms に揃える)。不正なら fallback
function num(v, fallback) {
  const n = Number(v);
  return v === null || v === undefined || v === '' || !Number.isFinite(n) ? fallback : n;
}

// 保存。失敗してもゲームは止めない
export function saveState(state) {
  if (!state) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('セーブに失敗', e);
  }
}

// 読み込み。無い・壊れている・新しすぎる version のときは null(新規開始)
// version 1 のセーブは、既存の項目をそのまま引き継いで version 2(games ブロック付き)に上げる
export function loadState() {
  let raw;
  try {
    raw = JSON.parse(localStorage.getItem(SAVE_KEY));
  } catch (e) {
    console.error('セーブデータが壊れているため新規開始します', e);
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  if (num(raw.version, 0) > SAVE_VERSION) return null; // 対応より新しい → 無視して新規開始
  return normalize(raw);
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    console.error('セーブの削除に失敗', e);
  }
}

// 足りない項目は初期値で補い、型を揃える
function normalize(raw) {
  const now = Date.now();
  const s = createState(ALL_COLORWAYS.includes(raw.colorway) ? raw.colorway : 'a', '', now);
  const stages = ['egg', 'baby', 'child', 'adult'];
  s.name = typeof raw.name === 'string' ? raw.name : '';
  s.stage = stages.includes(raw.stage) ? raw.stage : 'egg';
  s.stageEnteredAt = num(raw.stageEnteredAt, now);
  s.hatchedAt = num(raw.hatchedAt, s.stage === 'egg' ? null : s.stageEnteredAt);
  s.lastTick = Math.min(num(raw.lastTick, now), now);

  const g = raw.gauges || {};
  for (const key of Object.keys(s.gauges)) {
    s.gauges[key] = Math.max(0, Math.min(100, num(g[key], 80)));
  }

  const f = raw.flags || {};
  const d = s.flags;
  d.sleeping = f.sleeping === true;
  d.sick = f.sick === true;
  d.gone = f.gone === true;
  d.poops = Math.max(0, Math.min(2, Math.floor(num(f.poops, 0))));
  d.zeroHungerSince = num(f.zeroHungerSince, null);
  d.zeroHappySince = num(f.zeroHappySince, null);
  d.snacksCount = num(f.snacksCount, 0);
  d.snacksWindowStart = num(f.snacksWindowStart, 0);
  d.pendingPoopAt = num(f.pendingPoopAt, null);
  d.miniGameHigh = num(f.miniGameHigh, 0);

  // games ブロック(v1 には無いので初期値になる = v1 → v2 のマイグレーション)
  const games = raw.games || {};
  for (const id of GAME_IDS) {
    const src = games[id] || {};
    s.games[id] = {
      best: Math.max(0, num(src.best, 0)),
      plays: Math.max(0, Math.floor(num(src.plays, 0)))
    };
  }
  // アルバイト&ショップ追加仕様 §2: 無ければ 0 / 中身 0 / null で補う(v2 のまま後付け)
  s.coins = Math.max(0, Math.floor(num(raw.coins, 0)));
  const inv = raw.inventory || {};
  for (const id of Object.keys(s.inventory)) s.inventory[id] = Math.max(0, Math.floor(num(inv[id], 0)));
  s.slowGlassUntil = num(raw.slowGlassUntil, null);
  // 1回だけの桁合わせ(§2.1): フラグが無い旧セーブは coins を ×10 してフラグを付ける
  // (coins が 0 でもフラグは付ける。付けないと、新レートで貯めた分が次の読み込みで ×10 されてしまう)
  if (f.coinScale10 !== true) s.coins *= 10;
  d.coinScale10 = true;

  // s.version は createState() で常に SAVE_VERSION(2)。次のセーブから v2 で書かれる
  return s;
}
