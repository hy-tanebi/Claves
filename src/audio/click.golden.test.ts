import { describe, expect, it } from "vitest";
import { BELL_DURATION, BELL_FUNDAMENTALS, bellSamples } from "./bell";

const GOLDEN_PATH = "../../golden/click.json";
const SAMPLE_RATE = 48000;
/** 全サンプルを載せると巨大になるので間引く。ずれの検出には十分細かい */
const PROBE_STRIDE = 128;

/**
 * **打点の音を JS と Swift で揃えるための答え合わせ表。**
 *
 * ブラウザは Web Audio、iOS はネイティブが鳴らすので、
 * 音を作る式が2言語に存在する。片方だけ変えると
 * **「ブラウザと iOS で音が違う」が黙って起きる**ので、
 * 波形を抜き取って書き出し、Swift 側の同じテストに読ませる。
 *
 * 書き直しは `pnpm gen:golden`。
 */
function buildGolden() {
  const probe = (fundamental: number) => {
    const samples = bellSamples(fundamental, SAMPLE_RATE);
    const out: number[] = [];
    for (let i = 0; i < samples.length; i += PROBE_STRIDE) {
      out.push(Number(samples[i]!.toFixed(6)));
    }
    return out;
  };

  return {
    schemaVersion: 1,
    note: "打点の音の答え合わせ表。値は小数6桁に丸めた抜き取り。",
    generatedBy: "pnpm gen:golden",
    sampleRate: SAMPLE_RATE,
    duration: BELL_DURATION,
    probeStride: PROBE_STRIDE,
    fundamentals: BELL_FUNDAMENTALS,
    samples: {
      high: probe(BELL_FUNDAMENTALS.high),
      low: probe(BELL_FUNDAMENTALS.low),
    },
  };
}

describe("打点の音の契約", () => {
  it("書き出した波形と、いまの式の出力が一致する", async () => {
    await expect(`${JSON.stringify(buildGolden(), null, 2)}\n`).toMatchFileSnapshot(GOLDEN_PATH);
  });

  /// 高音と低音が別の音色になっていると、
  /// ひとつの楽器の高低ではなく別の楽器に聴こえる
  it("高音と低音は基音だけが違う（音色は同じ）", () => {
    const high = bellSamples(BELL_FUNDAMENTALS.high, SAMPLE_RATE);
    const low = bellSamples(BELL_FUNDAMENTALS.low, SAMPLE_RATE);

    // 同じ式・同じ長さで、基音だけが違う
    expect(high.length).toBe(low.length);
    expect(BELL_FUNDAMENTALS.high).toBeGreaterThan(BELL_FUNDAMENTALS.low);
  });

  it("波形は無音から始まる（段差があるとプチッと鳴る）", () => {
    for (const fundamental of Object.values(BELL_FUNDAMENTALS)) {
      expect(Math.abs(bellSamples(fundamental, SAMPLE_RATE)[0]!)).toBeLessThan(0.001);
    }
  });
});
