import { SAMBA_REGGAE } from "./patterns/samba-reggae";
import type { Pattern } from "./types";

/**
 * アプリに収録するリズムの一覧。
 *
 * ここに載せるのは、奏者が採譜し出典を明記したものだけ。
 * テスト用のフィクスチャ（fixtures.ts）は絶対に載せない。
 */
export const PATTERNS: Pattern[] = [SAMBA_REGGAE];
