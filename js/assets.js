// 素材まわり: manifest.json の読み込みとパス解決(仕様書 §2.4)

// assets/manifest.json の読み込み。失敗時は null を返し、静的パスで代替する
export async function loadManifest() {
  try {
    const res = await fetch('assets/manifest.json');
    return await res.json(); // { items: [{file, category, ja, en, usage}, ...] }
  } catch (e) {
    console.error('manifest.json の読み込みに失敗', e);
    return null;
  }
}

// manifest の file 値(例: "sprites/pet_a_adult_idle.png")を実パスへ
export function assetPath(file) {
  return 'assets/' + file;
}

// ボタンに使うアイコン(アクション名 → manifest の file 値)
export const ACTION_ICONS = {
  meal: 'icons/icon_meal.png',
  snack: 'icons/icon_snack.png',
  play: 'icons/icon_play.png',
  bath: 'icons/icon_bath.png',
  toilet: 'icons/icon_toilet.png',
  medicine: 'icons/icon_medicine.png',
  sleep: 'icons/icon_sleep.png',
  status: 'icons/icon_status.png'
};

// 背景
export const BG = {
  day: 'bg/bg_day_room.png',
  night: 'bg/bg_night_room.png',
  park: 'bg/bg_park.png'
};

// ミニゲーム素材(追加仕様 §1)。manifest の category === "minigame" から引く
// キーは manifest の en 値(例: "card_tree" / "mole" / "basket")
const gameFiles = {};

export function registerGameAssets(manifest) {
  if (!manifest || !Array.isArray(manifest.items)) return;
  for (const item of manifest.items) {
    if (item.category === 'minigame') gameFiles[item.en] = item.file;
  }
}

// manifest が読めなかったときは命名規則どおりのパスで代替する
export function gameFile(key) {
  return gameFiles[key] || `game/game_${key}.png`;
}

// manifest に載っているかを確認し、載っていなければ警告する(404 の早期発見用)
export function checkFiles(manifest, files) {
  if (!manifest || !Array.isArray(manifest.items)) return;
  const known = new Set(manifest.items.map((i) => i.file));
  files.filter((f) => !known.has(f)).forEach((f) => console.error('manifest に無い素材:', f));
}
