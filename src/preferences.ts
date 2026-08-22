/**
 * 端末に残す設定。**localStorage だけを使い、外部には一切送らない。**
 *
 * 端末やブラウザの設定（Safari のプライベート閲覧、サイトデータの遮断）では
 * localStorage に触れるだけで例外が出る。ここで throw するとアプリが
 * 起動しなくなるので、読み書きの両方を必ず握りつぶし、
 * 「覚えていない」状態として扱う。
 */
const PATTERN_KEY = "claves.patternId";

/** 最後に選んだリズムの id。覚えていなければ null */
export function loadPatternId(): string | null {
  try {
    const saved = localStorage.getItem(PATTERN_KEY);
    return saved === null || saved === "" ? null : saved;
  } catch {
    return null;
  }
}

export function savePatternId(id: string): void {
  try {
    localStorage.setItem(PATTERN_KEY, id);
  } catch {
    // 覚えられないだけで、動作には影響しない
  }
}
