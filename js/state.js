// セーブデータの形・ゲージ更新・状態判定(仕様書 §4.2〜§4.4・§4.6・§6)
import { checkEvolution, checkGone } from './lifecycle.js';

// 追加仕様 §2.3: ミニゲームの成績(games ブロック)を足して version 2 にした
export const SAVE_VERSION = 2;
export const GAME_IDS = ['ball', 'hilo', 'mole', 'catch'];

// 種族: タイトルで選べる A/B/C と、孵化のときにランダムで割り当てられる新種族 d〜g
// (d=ネコ / e=モモンガ / f=うさぎ / g=アザラシ。素材 README「追加(新種族4体)」)
export const PICKABLE_COLORWAYS = ['a', 'b', 'c'];
export const NEW_SPECIES = ['d', 'e', 'f', 'g'];
export const ALL_COLORWAYS = [...PICKABLE_COLORWAYS, ...NEW_SPECIES];

// ===== 進行速度(調整パッチ「tamagotchi_pace_tuneup_spec_claude.md」)=====
// 時間パラメータ(減衰・進化・イベント)は全て「1倍速の値」と PACE から導出する。速さは PACE だけで変える
// (3 = 3倍速、1 = 元の仕様書どおり)。年齢・セーブ時刻・昼夜・オフライン上限は実時間のまま。
// 検収用: URL に ?pace=2 を付けて開くと、その間だけ PACE を差し替えられる(保存はしない)
export const PACE = paceFromUrl() ?? 3;
function paceFromUrl() {
  const v = Number(new URLSearchParams(location.search).get('pace'));
  return Number.isFinite(v) && v > 0 ? v : null;
}

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;

// 1倍速の「毎時の増減」× PACE(浮動小数のまま) / 1倍速の「base 分」÷ PACE を ms で(最低1分・§1.4)
export const pacedRate = (perHour) => perHour * PACE;
export const pacedMinutes = (base) => Math.max(1, Math.floor(base / PACE)) * MINUTE;

export const MAX_OFFLINE_MS = 24 * HOUR; // オフライン補正の上限(§4.3)。実時間のまま変えない
const STEP_MS = 15 * SECOND;             // 一括計算の刻み幅(反映をなめらかにするため 1分 → 15秒)

// 1時間あたりの増減(§4.2 の1倍速の値 × PACE)。[覚醒, 睡眠]
const RATES = {
  hunger: [pacedRate(-8), pacedRate(-3)],
  happiness: [pacedRate(-5), pacedRate(-2)],
  cleanliness: [pacedRate(-4), pacedRate(-1)],
  energy: [pacedRate(-6), pacedRate(12)]
};
const POOP_CLEAN_PENALTY = pacedRate(-8); // うんちがある間の追加減衰/時
const SICK_ENERGY_PENALTY = pacedRate(-10); // 病気中の げんき 追加減衰/時(PACE=3 で −30)
const SICK_CHANCE = 0.15;                    // 発病 (a) の確率(1回の判定あたり)
const SICK_ROLL_MS = pacedMinutes(10);       // 発病 (a) の判定間隔(PACE=3 で 3分ごと)
const HUNGER_ZERO_SICK_MS = pacedMinutes(60); // 発病 (b): おなか0 が続く時間(PACE=3 で 20分)
export const MAX_POOPS = 2;
export const LOW = 30; // これ未満で「低い」扱い(alert・sad)

const clamp = (v) => Math.max(0, Math.min(100, v));

// 新規データ(§6 のスキーマ + hatchedAt / gone を追加。README 仕様メモ参照)
export function createState(colorway = 'a', name = '', now = Date.now()) {
  return {
    version: SAVE_VERSION,
    name,
    colorway,
    stage: 'egg',
    stageEnteredAt: now,
    hatchedAt: null,
    lastTick: now,
    gauges: { hunger: 80, happiness: 80, cleanliness: 80, energy: 80 },
    flags: {
      sleeping: false, sick: false, poops: 0,
      zeroHungerSince: null, zeroHappySince: null,
      snacksCount: 0, snacksWindowStart: 0,
      pendingPoopAt: null, miniGameHigh: 0,
      gone: false
    },
    games: createGames()
  };
}

// ミニゲームの成績(追加仕様 §2.3)
export function createGames() {
  const games = {};
  for (const id of GAME_IDS) games[id] = { best: 0, plays: 0 };
  return games;
}

// 経過時間ぶん状態を進める(オフライン分もこれで一括計算する)
// 戻り値: この間に起きたイベント([{ type: 'evolve', to } | { type: 'gone' }])
export function advance(state, now = Date.now()) {
  const events = [];
  let t = Math.max(state.lastTick, now - MAX_OFFLINE_MS);
  // 24時間を超えた分は「時間が止まっていた」扱いにし、時刻の記録もその分ずらす
  if (t > state.lastTick && !state.flags.gone) shiftTimes(state, t - state.lastTick);
  while (t < now && !state.flags.gone) {
    const dt = Math.min(STEP_MS, now - t);
    t += dt;
    if (state.stage !== 'egg') step(state, dt, t);
    checkEvolution(state, t, events);
    if (state.stage !== 'egg') checkGone(state, t, events);
  }
  state.lastTick = now;
  return events;
}

// ゲーム内の時刻記録を delta ミリ秒うしろへずらす(年齢 hatchedAt は実時間なのでずらさない)
function shiftTimes(state, delta) {
  const f = state.flags;
  state.stageEnteredAt += delta;
  for (const key of ['zeroHungerSince', 'zeroHappySince', 'pendingPoopAt']) {
    if (f[key] !== null) f[key] += delta;
  }
}

// 1刻みぶんの更新。dt はミリ秒、t は刻み終わりの時刻
function step(state, dt, t) {
  const g = state.gauges;
  const f = state.flags;
  const h = dt / HOUR;
  const idx = f.sleeping ? 1 : 0;

  for (const key of Object.keys(RATES)) g[key] += RATES[key][idx] * h;
  if (f.poops > 0) g.cleanliness += POOP_CLEAN_PENALTY * h;
  if (f.sick) g.energy += SICK_ENERGY_PENALTY * h;
  for (const key of Object.keys(g)) g[key] = clamp(g[key]);

  // うんちの出現(食事の 15〜40 分後に予約されたもの)
  if (f.pendingPoopAt !== null && t >= f.pendingPoopAt) {
    f.poops = Math.min(MAX_POOPS, f.poops + 1);
    f.pendingPoopAt = null;
  }

  // ゼロが続いている時間の記録
  f.zeroHungerSince = g.hunger <= 0 ? (f.zeroHungerSince ?? t) : null;
  f.zeroHappySince = g.happiness <= 0 ? (f.zeroHappySince ?? t) : null;

  // 発病判定(§4.6)
  if (!f.sick) {
    const dirty = f.poops > 0 && g.cleanliness < LOW;
    const pChance = 1 - Math.pow(1 - SICK_CHANCE, dt / SICK_ROLL_MS);
    if (dirty && Math.random() < pChance) f.sick = true;
    if (f.zeroHungerSince !== null && t - f.zeroHungerSince >= HUNGER_ZERO_SICK_MS) f.sick = true;
  }
}

// alert を出すべきか(§4.8)
export function needsCare(state) {
  if (state.stage === 'egg' || state.flags.gone) return false;
  const g = state.gauges;
  const f = state.flags;
  return Object.values(g).some((v) => v < LOW) || f.sick || f.poops > 0;
}

// 表示するスプライトを決める(§4.4)
// anim: アクション演出中なら 'eat' | 'play' | 'happy'、無ければ null
// borrow: true なら B/C も A の状態絵を hue-rotate で色を変えて使う(M5 のオプション・§2.3)
// 戻り値: { file, filter, fallback, mood }
//   fallback=true は「状態絵が無いので idle で代用」の意(補助エフェクトを出す)
export const HUE_FILTER = { a: '', b: 'hue-rotate(106deg) saturate(0.7)', c: 'hue-rotate(296deg)' };

export function selectSprite(state, anim = null, borrow = false) {
  const c = state.colorway;
  const f = state.flags;
  const stage = state.stage;
  // 流用できるのは A の色違い(B/C)だけ。新種族 d〜g は別の生き物なので流用しない(idle + 補助表示)
  const canBorrow = c === 'a' || (borrow && c in HUE_FILTER);
  const filter = HUE_FILTER[c] ?? '';
  if (f.gone) {
    return { file: 'sprites/pet_a_adult_angel.png', filter: canBorrow ? filter : '', fallback: false, mood: 'angel' };
  }
  if (stage === 'egg') return { file: 'sprites/pet_egg.png', filter: '', fallback: false, mood: 'idle' };

  const idle = { file: `sprites/pet_${c}_${stage}_idle.png`, filter: '' };
  // 状態絵があるのは A のおとな(+ A のベビー眠り)だけ(§2.3)
  const pick = (mood) => {
    let file = null;
    if (stage === 'adult') file = `sprites/pet_a_adult_${mood}.png`;
    if (stage === 'baby' && mood === 'sleep') file = 'sprites/pet_a_baby_sleep.png';
    if (file && canBorrow) return { file, filter, fallback: false, mood };
    return { ...idle, fallback: true, mood };
  };

  if (f.sick) return pick('sick');
  if (!f.sleeping && f.poops > 0) return pick('dirty');
  if (f.sleeping) return pick('sleep');
  if (anim) return pick(anim);
  if (state.gauges.hunger < LOW) return pick('sad');
  return { ...idle, fallback: false, mood: 'idle' };
}

// 夜(18:00〜6:00)かどうか。端末のローカル時刻で判定(§4.3)
export function isNight(date = new Date()) {
  const hour = date.getHours();
  return hour >= 18 || hour < 6;
}

// 孵化からの経過を { d, h, m } で返す
export function ageParts(state, now = Date.now()) {
  if (!state.hatchedAt) return { d: 0, h: 0, m: 0 };
  const min = Math.floor((now - state.hatchedAt) / MINUTE);
  return { d: Math.floor(min / 1440), h: Math.floor((min % 1440) / 60), m: min % 60 };
}
