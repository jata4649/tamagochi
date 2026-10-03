// WebAudio の簡易ビープ(M5 のオプション)。既定はオフ
// 音のファイルは使わず、矩形波の短い音を並べて鳴らす

let soundOn = false;
let ctx = null;

export function setSoundOn(on) {
  soundOn = on;
}

// 種類ごとの音: [周波数Hz, 長さ秒] の並び
const PATTERNS = {
  tap:    [[880, 0.05]],
  eat:    [[660, 0.07], [880, 0.07]],
  hit:    [[784, 0.08], [988, 0.08], [1319, 0.12]],
  miss:   [[330, 0.12], [262, 0.18]],
  clean:  [[1047, 0.06], [1319, 0.06], [1568, 0.1]],
  sleep:  [[523, 0.15], [392, 0.2]],
  wake:   [[392, 0.08], [523, 0.08], [659, 0.12]],
  evolve: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.25]],
  ng:     [[220, 0.15]]
};

export function beep(kind) {
  if (!soundOn) return;
  const pattern = PATTERNS[kind];
  if (!pattern) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    let t = ctx.currentTime;
    for (const [freq, len] of pattern) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + len);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + len);
      t += len;
    }
  } catch (e) {
    // 音が出せない環境では何もしない
  }
}
