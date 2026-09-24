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

const TIMBRE_KEY = "claves.timbre";

/**
 * 最後に選んだ音色。覚えていなければ null。
 *
 * **値の妥当性はここで見ない。** 収録から外した音色の名前が残っていることが
 * あるので、読む側（`pickTimbre`）が知らない名前を既定に落とす。
 */
export function loadTimbre(): string | null {
  try {
    const saved = localStorage.getItem(TIMBRE_KEY);
    return saved === null || saved === "" ? null : saved;
  } catch {
    return null;
  }
}

export function saveTimbre(timbre: string): void {
  try {
    localStorage.setItem(TIMBRE_KEY, timbre);
  } catch {
    // 覚えられないだけで、動作には影響しない
  }
}
