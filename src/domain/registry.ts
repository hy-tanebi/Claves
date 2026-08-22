import { AFRO_GROOVE } from "./patterns/afro-groove";
import { AFRO_GROOVE_2 } from "./patterns/afro-groove-2";
import { AFRO_GROOVE_6_8 } from "./patterns/afro-groove-6-8";
import { IJEXA } from "./patterns/ijexa";
import { THREE_TWO_GROOVE } from "./patterns/three-two-groove";
import type { Pattern } from "./types";

/**
 * アプリに収録するリズムの一覧。
 *
 * ここに載せるのは、奏者が採譜し出典を明記したものだけ。
 * テスト用のフィクスチャ（fixtures.ts）は絶対に載せない。
 */
export const PATTERNS: Pattern[] = [
  THREE_TWO_GROOVE,
  AFRO_GROOVE,
  AFRO_GROOVE_2,
  AFRO_GROOVE_6_8,
  IJEXA,
];

/**
 * id からリズムを引く。知らない id や null なら先頭のリズムを返す。
 *
 * 端末に保存された id をそのまま信用しない。収録から外したリズムの id が
 * 残っていることがあり、そのまま使うと画面が空になる。
 */
export function pickPattern(id: string | null): Pattern {
  return PATTERNS.find((p) => p.id === id) ?? PATTERNS[0]!;
}
