import { AFRO_GROOVE } from "./patterns/afro-groove";
import { AFRO_GROOVE_2 } from "./patterns/afro-groove-2";
import { AFRO_GROOVE_6_8 } from "./patterns/afro-groove-6-8";
import { SAMBA_REGGAE } from "./patterns/samba-reggae";
import type { Pattern } from "./types";

/**
 * アプリに収録するリズムの一覧。
 *
 * ここに載せるのは、奏者が採譜し出典を明記したものだけ。
 * テスト用のフィクスチャ（fixtures.ts）は絶対に載せない。
 */
export const PATTERNS: Pattern[] = [SAMBA_REGGAE, AFRO_GROOVE, AFRO_GROOVE_2, AFRO_GROOVE_6_8];
