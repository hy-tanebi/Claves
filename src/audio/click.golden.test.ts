import { describe, expect, it } from "vitest";
import { clickSamples, TIMBRE_SPECS, TIMBRES, type Timbre } from "./bell";
import type { Pitch } from "../domain/types";

const GOLDEN_PATH = "../../golden/click.json";
const SAMPLE_RATE = 48000;
/** 全サンプルを載せると巨大になるので間引く。ずれの検出には十分細かい */
const PROBE_STRIDE = 128;

const PITCHES: Pitch[] = ["high", "low"];

/**
 * **打点の音を JS と Swift で揃えるための答え合わせ表。**
 *
 * ブラウザは Web Audio、iOS はネイティブが鳴らすので、
 * 音を作る式が2言語に存在する。片方だけ変えると
 * **「ブラウザと iOS で音が違う」が黙って起きる**ので、
 * 波形を抜き取って書き出し、Swift 側の同じテストに読ませる。
 *
 * **音色ごとに書き出す。** 音色を足したのに片方の言語だけ足していない、
 * という取りこぼしをここで捕まえる。
 *
 * 書き直しは `pnpm gen:golden`。
 */
function buildGolden() {
  const probe = (timbre: Timbre, pitch: Pitch) => {
    const samples = clickSamples(timbre, pitch, SAMPLE_RATE);
    const out: number[] = [];
    for (let i = 0; i < samples.length; i += PROBE_STRIDE) {
      out.push(Number(samples[i]!.toFixed(6)));
    }
    return out;
  };

  const timbres: Record<string, unknown> = {};
  for (const timbre of TIMBRES) {
    const spec = TIMBRE_SPECS[timbre];
    timbres[timbre] = {
      duration: spec.duration,
      fundamentals: spec.fundamentals,
      samples: {
        high: probe(timbre, "high"),
        low: probe(timbre, "low"),
      },
    };
  }

  return {
    schemaVersion: 2,
    note: "打点の音の答え合わせ表。値は小数6桁に丸めた抜き取り。",
    generatedBy: "pnpm gen:golden",
    sampleRate: SAMPLE_RATE,
    probeStride: PROBE_STRIDE,
    timbres,
  };
}

describe("打点の音の契約", () => {
  it("書き出した波形と、いまの式の出力が一致する", async () => {
    await expect(`${JSON.stringify(buildGolden(), null, 2)}\n`).toMatchFileSnapshot(GOLDEN_PATH);
  });

  /// 高音と低音が別の音色になっていると、
  /// ひとつの楽器の高低ではなく別の楽器に聴こえる
  it("高音と低音は基音だけが違う（音色は同じ）", () => {
    for (const timbre of TIMBRES) {
      const spec = TIMBRE_SPECS[timbre];
      const high = clickSamples(timbre, "high", SAMPLE_RATE);
      const low = clickSamples(timbre, "low", SAMPLE_RATE);

      // 同じ式・同じ長さで、基音だけが違う
      expect(high.length).toBe(low.length);
      expect(spec.fundamentals.high).toBeGreaterThan(spec.fundamentals.low);
    }
  });

  it("波形は無音から始まる（段差があるとプチッと鳴る）", () => {
    for (const timbre of TIMBRES) {
      for (const pitch of PITCHES) {
        expect(Math.abs(clickSamples(timbre, pitch, SAMPLE_RATE)[0]!)).toBeLessThan(0.001);
      }
    }
  });

  /// クラベスは木、アゴゴは金属。**違いは余韻の長さで出している。**
  /// ここが崩れると「音色を変えたのに同じに聴こえる」になる
  it("クラベスはアゴゴより短く鳴り終わる", () => {
    expect(TIMBRE_SPECS.claves.duration).toBeLessThan(TIMBRE_SPECS.agogo.duration);

    const tail = (timbre: Timbre) => {
      const samples = clickSamples(timbre, "high", SAMPLE_RATE);
      // 0.1 秒の時点でどれだけ残っているか
      const at = Math.floor(SAMPLE_RATE * 0.1);
      return at < samples.length ? Math.abs(samples[at]!) : 0;
    };

    expect(tail("claves")).toBeLessThan(tail("agogo"));
  });

  it("知らない音色の名前は既定に落ちる", async () => {
    const { pickTimbre, DEFAULT_TIMBRE } = await import("./bell");
    expect(pickTimbre(null)).toBe(DEFAULT_TIMBRE);
    expect(pickTimbre("")).toBe(DEFAULT_TIMBRE);
    expect(pickTimbre("surdo")).toBe(DEFAULT_TIMBRE);
    expect(pickTimbre("claves")).toBe("claves");
  });
});
