// ライフサイクル: 孵化・進化・お別れの判定(仕様書 §4.1・§4.6)

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// 進化スピード(§4.1)。DEMO = 1 / REALISTIC = 0.1。初期値は DEMO
export const TIME_SCALE = { DEMO: 1, REALISTIC: 0.1 };
let timeScale = TIME_SCALE.DEMO;
export function setTimeScale(v) { timeScale = v; }
export function getTimeScale() { return timeScale; }

// 各段階にとどまる時間(§4.1 の表をそのまま。モードごとに定義)
const STAGE_DURATIONS = {
  [TIME_SCALE.DEMO]:      { egg: 3 * MINUTE, baby: 3 * HOUR,  child: 6 * HOUR },
  [TIME_SCALE.REALISTIC]: { egg: 1 * HOUR,   baby: 24 * HOUR, child: 48 * HOUR }
};
const NEXT_STAGE = { egg: 'baby', baby: 'child', child: 'adult' };

// お別れ条件(§4.6)。おなか0 は デモ速 2時間(リアルは ÷TIME_SCALE で 20時間)
const STARVE_MS_DEMO = 2 * HOUR;
const UNHAPPY_MS = 24 * HOUR;

export function stageDuration(stage) {
  return STAGE_DURATIONS[timeScale][stage] ?? Infinity;
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

// 孵化: 年齢の起点を記録し、ゲージを全て 80 にする(§4.2)
function hatch(state, at) {
  state.hatchedAt = at;
  for (const key of Object.keys(state.gauges)) state.gauges[key] = 80;
}

// お別れ判定。満たしたら即確定(演出なし)
export function checkGone(state, t, events) {
  const f = state.flags;
  const starveMs = STARVE_MS_DEMO / timeScale;
  const starved = f.zeroHungerSince !== null && t - f.zeroHungerSince >= starveMs;
  const unhappy = f.zeroHappySince !== null && t - f.zeroHappySince >= UNHAPPY_MS;
  if (starved || unhappy) {
    f.gone = true;
    f.sleeping = false;
    events.push({ type: 'gone' });
  }
}
