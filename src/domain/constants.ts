/** 4分音符 = 96 tick。8分3連（32）も 16分3連（16）も整数になる分解能 */
export const PPQ = 96;

export const BASE_TICKS = {
  w: 384,
  h: 192,
  q: 96,
  "8": 48,
  "16": 24,
  "32": 12,
} as const;
