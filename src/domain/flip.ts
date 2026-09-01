import type { NotationItem, Pattern } from "./types";

/**
 * 反転した打点 id に付ける印。**元の id と必ず違う文字列にすること。**
 * ここを空にすると再生中の切替で譜面が音より早く変わる（下の説明を参照）。
 */
const FLIP_SUFFIX = "-r";

/**
 * 3:2 と 2:3 を入れ替えられるリズムか。
 *
 * **`clave` を持つものだけ。** 2小節を入れ替える操作自体はどのリズムにもできるが、
 * 「3:2 / 2:3」はクラーベの用語なので、打点がクラーベの形をしていない
 * リズムに当てると、アプリが根拠のないことを主張することになる。
 *
 * 2小節でないものも外す。**入れ替えは「前半と後半のどちらから始めるか」**であって、
 * 3小節以上の並べ替えは別の話になる。
 */
export function canFlip(pattern: Pattern): boolean {
  return pattern.clave === "3-2" && pattern.bars.length === 2;
}

/**
 * 3:2 と 2:3 を入れ替えた写しを作る。
 *
 * **小節の順番を入れ替えるだけ。** 打点そのものは変えない。
 * クラーベの 3-2 と 2-3 は「同じ形をどちらの半分から始めるか」の違いなので、
 * 2小節の順番を入れ替えれば足りる。
 *
 * **打点の id は必ず作り替える。**
 * `registry.test.ts` が「打点の id はパターンをまたいでも重複しない」を
 * 要求している。同じ id のまま返すと、再生中に 3:2 ⇄ 2:3 を切り替えたとき、
 * 切替先の打点が鳴ったかどうかの判定（`switchingIds`）が元の打点にも当たり、
 * **譜面が音より早く切り替わる**（2026-08-22 に直した不具合の再発）。
 *
 * **パターンの `id` と `name` は変えない。** 同じリズムを別の半分から
 * 始めているだけで、収録が増えるわけではない。一覧の選択状態や
 * 端末に残す「最後に選んだリズム」も、反転の有無で分かれてほしくない。
 *
 * `registry.ts` には載せない。**反転は収録リズムではなく派生物。**
 *
 * `beams` と `tuplets` は小節の中の位置を指すので、
 * 小節の順番を変えてもそのまま通る（小節の中は並べ替えない）。
 */
export function flipPattern(pattern: Pattern): Pattern {
  return {
    ...pattern,
    bars: [...pattern.bars].reverse().map((bar) => ({
      ...bar,
      items: bar.items.map(flipItem),
    })),
  };
}

function flipItem(item: NotationItem): NotationItem {
  if (item.kind !== "note") return { ...item };
  return { ...item, id: `${item.id}${FLIP_SUFFIX}` };
}
