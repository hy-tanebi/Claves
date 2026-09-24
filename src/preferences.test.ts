// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadPatternId, savePatternId } from "./preferences";

const realStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

/** localStorage に触れるだけで例外になる状況を作る（Safari のプライベート閲覧など） */
function breakStorage(): void {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("The operation is insecure.", "SecurityError");
    },
  });
}

beforeEach(() => {
  if (realStorage) Object.defineProperty(globalThis, "localStorage", realStorage);
  localStorage.clear();
});

afterEach(() => {
  if (realStorage) Object.defineProperty(globalThis, "localStorage", realStorage);
});

describe("最後に選んだリズムの記憶", () => {
  it("保存した id を読み戻せる", () => {
    savePatternId("ijexa");
    expect(loadPatternId()).toBe("ijexa");
  });

  it("何も保存していなければ null", () => {
    expect(loadPatternId()).toBeNull();
  });

  it("上書きすると最後の値が残る", () => {
    savePatternId("ijexa");
    savePatternId("afro-groove-2");
    expect(loadPatternId()).toBe("afro-groove-2");
  });

  it("空文字は保存されていない扱いにする", () => {
    localStorage.setItem("claves.patternId", "");
    expect(loadPatternId()).toBeNull();
  });

  // 端末やブラウザの設定で localStorage が使えないことがある。
  // そこで例外が出ると、アプリが起動しなくなる
  it("localStorage が使えなくても読み込みで例外を投げない", () => {
    breakStorage();
    expect(() => loadPatternId()).not.toThrow();
    expect(loadPatternId()).toBeNull();
  });

  it("localStorage が使えなくても保存で例外を投げない", () => {
    breakStorage();
    expect(() => savePatternId("ijexa")).not.toThrow();
  });
});
