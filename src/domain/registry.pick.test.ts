import { describe, expect, it } from "vitest";
import { PATTERNS, pickPattern } from "./registry";

describe("pickPattern", () => {
  it("id が一致するリズムを返す", () => {
    expect(pickPattern("ijexa").id).toBe("ijexa");
  });

  it("id がなければ先頭のリズムを返す", () => {
    expect(pickPattern(null)).toBe(PATTERNS[0]);
  });

  // 収録から外したリズムの id が端末に残っていることがある
  it("知らない id なら先頭のリズムを返す", () => {
    expect(pickPattern("no-such-rhythm")).toBe(PATTERNS[0]);
  });
});
