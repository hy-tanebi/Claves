/**
 * 音楽フォント（Bravura）の読み込み完了を待つ。
 *
 * **描画の前に必ず待つこと。**
 *
 * VexFlow は描画時に文字幅を測って符尾や小節幅の位置を決める。
 * Bravura の読み込み前に描くと代替フォントの幅で計算してしまい、
 * 実際に描かれる幅とずれる。実測では符頭の幅を 28 単位と誤って計算し
 * （正しくは 11.8）、符尾が符頭から離れ、小節に必要な幅も膨れて
 * 段が余計に増えた。
 *
 * 読み込み済みかどうかは実行のたびに変わる（キャッシュの有無、回線速度）ため、
 * 「たまたま動く」ことがある。必ず待つ。
 */
export async function whenMusicFontsReady(): Promise<void> {
  // jsdom には document.fonts がない。テストでは待つ対象がないので素通りする
  if (typeof document === "undefined" || !document.fonts) return;
  await document.fonts.ready;
}
