// セーブデータの形・ゲージ更新・状態判定(仕様書 §4.2〜§4.4・§4.6・§6)

export const SAVE_VERSION = 1;

// 進化スピード(§4.1)。DEMO = 1 / REALISTIC = 0.1。初期値は DEMO
export const TIME_SCALE = { DEMO: 1, REALISTIC: 0.1 };
export let timeScale = TIME_SCALE.DEMO;

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
export const MAX_OFFLINE_MS = 24 * HOUR; // オフライン補正の上限(§4.3)
const STEP_MS = MINUTE;                  // 一括計算の刻み幅

// 1時間あたりの増減(§4.2)。[覚醒, 睡眠]
const RATES = {
  hunger: [-8, -3],
  happiness: [-5, -2],
  cleanliness: [-4, -1],
  energy: [-6, 12]
};
const POOP_CLEAN_PENALTY = -8;   // うんちがある間の追加減衰/時
const SICK_ENERGY_PENALTY = -10; // 病気中の追加減衰/時
const SICK_CHANCE_PER_10MIN = 0.15;
const HUNGER_ZERO_SICK_MS = 1 * HOUR;
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
    }
  };
}

// 経過時間ぶん状態を進める(オフライン分もこれで一括計算する)
export function advance(state, now = Date.now()) {
  if (state.stage === 'egg' || state.flags.gone) {
    state.lastTick = now;
    return;
  }
  let t = Math.max(state.lastTick, now - MAX_OFFLINE_MS);
  while (t < now) {
    const dt = Math.min(STEP_MS, now - t);
    t += dt;
    step(state, dt, t);
  }
  state.lastTick = now;
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
    const pChance = 1 - Math.pow(1 - SICK_CHANCE_PER_10MIN, dt / (10 * MINUTE));
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
// 戻り値: { file, fallback } fallback=true は「状態絵が無いので idle で代用」の意
export function selectSprite(state, anim = null) {
  const c = state.colorway;
  const f = state.flags;
  const stage = state.stage;
  if (f.gone) return { file: 'sprites/pet_a_adult_angel.png', fallback: c !== 'a' };
  if (stage === 'egg') return { file: 'sprites/pet_egg.png', fallback: false };

  const idle = `sprites/pet_${c}_${stage}_idle.png`;
  // 状態絵があるのは A のおとな(+ A のベビー眠り)だけ(§2.3)
  const pick = (mood) => {
    if (c === 'a' && stage === 'adult') return { file: `sprites/pet_a_adult_${mood}.png`, fallback: false };
    if (c === 'a' && stage === 'baby' && mood === 'sleep') return { file: 'sprites/pet_a_baby_sleep.png', fallback: false };
    return { file: idle, fallback: true };
  };

  if (f.sick) return { ...pick('sick'), mood: 'sick' };
  if (!f.sleeping && f.poops > 0) return { ...pick('dirty'), mood: 'dirty' };
  if (f.sleeping) return { ...pick('sleep'), mood: 'sleep' };
  if (anim) return { ...pick(anim), mood: anim };
  if (state.gauges.hunger < LOW) return { ...pick('sad'), mood: 'sad' };
  return { file: idle, fallback: false, mood: 'idle' };
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
