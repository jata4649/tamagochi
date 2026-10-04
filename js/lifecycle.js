// ライフサイクル: 孵化・進化・お別れの判定(仕様書 §4.1・§4.6)
// 時間は「1倍速の分数」で持ち、state.js の pacedMinutes() で PACE に合わせて縮める
// (state.js とは互いに import し合うので、PACE を使うのは関数の中だけにしている)
import { pacedMinutes, NEW_SPECIES } from './state.js';

// 進化スピード(§4.1)。DEMO = 1 / REALISTIC = 0.1。初期値は DEMO
export const TIME_SCALE = { DEMO: 1, REALISTIC: 0.1 };
let timeScale = TIME_SCALE.DEMO;
export function setTimeScale(v) { timeScale = v; }
export function getTimeScale() { return timeScale; }

// 各段階にとどまる時間(§4.1 の表の1倍速の値・分。モードごとに定義)
// PACE=3 なら デモ速: たまご 1分 / ベビー 1時間 / こども 2時間、リアル: 20分 / 8時間 / 16時間
const STAGE_BASE_MIN = {
  [TIME_SCALE.DEMO]:      { egg: 3,  baby: 3 * 60,  child: 6 * 60 },
  [TIME_SCALE.REALISTIC]: { egg: 60, baby: 24 * 60, child: 48 * 60 }
};
const NEXT_STAGE = { egg: 'baby', baby: 'child', child: 'adult' };

// お別れ条件(§4.6 の1倍速の値・分)。おなか0 は デモ速 2時間(リアルは ÷TIME_SCALE で 20時間)
// PACE=3 なら おなか0 が 40分 / きげん0 が 8時間
const STARVE_BASE_MIN_DEMO = 2 * 60;
const UNHAPPY_BASE_MIN = 24 * 60;

export function stageDuration(stage) {
  const base = STAGE_BASE_MIN[timeScale][stage];
  return base === undefined ? Infinity : pacedMinutes(base);
}

// 孵化までの残りミリ秒
export function msUntilHatch(state, now = Date.now()) {
  return Math.max(0, state.stageEnteredAt + stageDuration('egg') - now);
}

// 時刻 t までに進化すべき段階を進める。起きた進化は events に積む
export function checkEvolution(state, t, events) {
  while (NEXT_STAGE[state.stage] && t - state.stageEnteredAt >= stageDuration(state.stage)) {
    const at = state.stageEnteredAt + stageDuration(state.stage);
    const from = state.stage;
    state.stage = NEXT_STAGE[from];
    state.stageEnteredAt = at;
    if (from === 'egg') hatch(state, at);
    events.push({ type: 'evolve', to: state.stage });
  }
}

// 孵化のとき新種族になる確率。外れたら選んだ色(A/B/C)のまま
export const NEW_SPECIES_CHANCE = 0.5;

// 孵化で生まれる種族を決める。新種族になるときは d〜g から等確率(各 12.5%)
export function pickSpecies(chosen, rand = Math.random) {
  if (rand() < NEW_SPECIES_CHANCE) return NEW_SPECIES[Math.floor(rand() * NEW_SPECIES.length)];
  return chosen;
}

// 孵化: 種族を決め、年齢の起点を記録し、ゲージを全て 80 にする(§4.2)
// たまご(pet_egg)は全種族共通なので、何が生まれるかは孵化するまでわからない
function hatch(state, at) {
  state.colorway = pickSpecies(state.colorway);
  state.hatchedAt = at;
  for (const key of Object.keys(state.gauges)) state.gauges[key] = 80;
}

// お別れ判定。満たしたら即確定(演出なし)
export function checkGone(state, t, events) {
  const f = state.flags;
  const starveMs = pacedMinutes(STARVE_BASE_MIN_DEMO / timeScale);
  const starved = f.zeroHungerSince !== null && t - f.zeroHungerSince >= starveMs;
  const unhappy = f.zeroHappySince !== null && t - f.zeroHappySince >= pacedMinutes(UNHAPPY_BASE_MIN);
  if (starved || unhappy) {
    f.gone = true;
    f.sleeping = false;
    events.push({ type: 'gone' });
  }
}
