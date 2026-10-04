// ドッチ(通貨)のしくみ(アルバイト&ショップ追加仕様 §2.1・§3)
// 値段と報酬は「基本値 × COIN_RATE」で作る。将来の調整は COIN_RATE だけを変える

export const COIN_RATE = 10;                 // 1ドッチ economy の倍率(将来調整はここだけ)
export const BASE_PRICES = {                 // 基本値(= 実際の表示値は ×COIN_RATE)
  item_bento: 30, item_funbox: 25, item_soapset: 20,
  item_vitamin: 25, item_medherb: 40, item_slowglass: 60
};
export const BASE_PAYOUT = {                 // アルバイトの基本報酬レート
  ballPerHit: 3, hiloPerHit: 2, hiloPerfect: 5,
  moleDivisor: 2, catchDivisor: 3
};

// ショップのアイテム(並び順 = 表示順)
export const ITEM_IDS = Object.keys(BASE_PRICES);

// 実際の値段(ドッチ)
export function priceOf(id) {
  return BASE_PRICES[id] * COIN_RATE;
}

// ミニゲームのスコアからアルバイト代(ドッチ)を計算する(§3 の表)
// perfect: ハイアンドローの全問正解
export function payoutFor(id, score, { perfect = false } = {}) {
  const p = BASE_PAYOUT;
  const s = Math.max(0, score);
  switch (id) {
    case 'ball': return s * p.ballPerHit * COIN_RATE;
    case 'hilo': return (s * p.hiloPerHit + (perfect ? p.hiloPerfect : 0)) * COIN_RATE;
    case 'mole': return Math.ceil(s / p.moleDivisor) * COIN_RATE;
    case 'catch': return Math.floor(s / p.catchDivisor) * COIN_RATE;
    default: return 0;
  }
}

// ドッチを増減する。整数で、0 より下にはしない(§2・§7)
export function addCoins(state, delta) {
  state.coins = Math.max(0, Math.floor((state.coins || 0) + delta));
  return state.coins;
}

// 払えるなら払って true、足りなければ何もせず false
export function spendCoins(state, amount) {
  if ((state.coins || 0) < amount) return false;
  addCoins(state, -amount);
  return true;
}
