// UI 文言辞書(仕様書 §9)。画面に出す文字列はすべてここから取る。
// 文言の追加・修正はこのファイルだけで行い、HTML に直書きしない。
export const UI = {
  appTitle: "ふれんどっち",
  startBtn: "たまごをもらう",
  colorwayName: { a: "きいろ", b: "みどり", c: "ピンク" },
  gauges: { hunger: "おなか", happiness: "きげん", cleanliness: "せいけつ", energy: "げんき" },
  actions: {
    meal: "ごはん", snack: "おやつ", play: "遊び", bath: "おふろ",
    toilet: "トイレ", medicine: "くすり", sleep: "おやすみ", status: "じょうたい"
  },
  statusTitle: "ステータス",
  ageLabel: "年齢",
  alertText: "せわ が いるよ!",
  cannotPlaySick: "びょうきだから遊べないよ",
  refuseMoreSnack: "おやつは ひかえめにね!きげんが さがった",
  medicineHealthy: "げんきなのに のんだ…(きげん さがった)",
  cleanPoopDone: "ピッカピカ!",
  sleepingNow: "ねてるよ…(おやすみで起こせる)",
  wakeUpMsg: "わ!よく ねた!!",
  goneTitle: "お別れしました",
  goneBody: "いままで そだててくれて ありがとう。あたらしいたまごが 待っているよ",
  resetBtn: "あたらしいたまご",
  snackLimitText: "おやつは 一日あたり3こまで",
  backBtn: "もどる",

  // --- 以下は仕様書に無いため追加した文言(README「仕様メモ」参照) ---
  defaultName: "ふれんどくん",
  // 年齢表示「○日○時間○分」の書式
  ageFormat: (d, h, m) => `${d}日${h}時間${m}分`
};
