import { describe, expect, it } from "vitest";
import { createNativeAudio, type ClavesAudioPlugin } from "./native-audio";
import { buildPlan } from "../domain/plan-builder";
import { PATTERNS } from "../domain/registry";

/**
 * ネイティブ再生エンジンを呼ぶ側。
 *
 * Swift 側は `planJson` を**文字列として**読む（`call.getString`）。
 * ここをオブジェクトで送るように変えると、
 * **ネイティブが黙って弾いて無音になる**ので、形をテストで固定する。
 */
describe("createNativeAudio", () => {
  const pattern = PATTERNS.find((p) => p.id === "three-two-groove")!;

  function spyPlugin() {
    const calls: Array<{ method: string; args: unknown }> = [];
    const plugin: ClavesAudioPlugin = {
      start: async (o) => void calls.push({ method: "start", args: o }),
      stop: async () => void calls.push({ method: "stop", args: undefined }),
      applyPlan: async (o) => void calls.push({ method: "applyPlan", args: o }),
      setVolume: async (o) => void calls.push({ method: "setVolume", args: o }),
      getSnapshot: async () => ({ tick: 0, isPlaying: true }),
    };
    return { plugin, calls };
  }

  it("計画は JSON 文字列で渡す（オブジェクトではない）", async () => {
    const { plugin, calls } = spyPlugin();
    await createNativeAudio(plugin).start(pattern, 120);

    const args = calls[0]!.args as { planJson: unknown };
    expect(typeof args.planJson).toBe("string");
  });

  it("渡す JSON は buildPlan の出力そのもの", async () => {
    const { plugin, calls } = spyPlugin();
    await createNativeAudio(plugin).start(pattern, 120);

    const args = calls[0]!.args as { planJson: string };
    expect(JSON.parse(args.planJson)).toEqual(
      buildPlan(pattern, 120, { originTick: 0, originSeconds: 0 }),
    );
  });

  it("切替は applyPlan を呼び、基準点を引き継ぐ", async () => {
    const { plugin, calls } = spyPlugin();
    await createNativeAudio(plugin).change(pattern, 180, {
      originTick: 384,
      originSeconds: 2,
    });

    expect(calls[0]!.method).toBe("applyPlan");
    const sent = JSON.parse((calls[0]!.args as { planJson: string }).planJson);
    expect(sent.bpm).toBe(180);
    expect(sent.originTick).toBe(384);
    expect(sent.originSeconds).toBe(2);
  });

  it("停止と音量はそのまま渡す", async () => {
    const { plugin, calls } = spyPlugin();
    const audio = createNativeAudio(plugin);

    await audio.setVolume(0.5);
    await audio.stop();

    expect(calls[0]).toEqual({ method: "setVolume", args: { value: 0.5 } });
    expect(calls[1]!.method).toBe("stop");
  });

  /// 再生位置はネイティブに聞く。JS 側で別に数えると必ずずれる
  it("再生位置はネイティブから受け取る", async () => {
    const plugin: ClavesAudioPlugin = {
      start: async () => {},
      stop: async () => {},
      applyPlan: async () => {},
      setVolume: async () => {},
      getSnapshot: async () => ({ tick: 288.5, isPlaying: true }),
    };

    expect(await createNativeAudio(plugin).snapshot()).toEqual({
      tick: 288.5,
      isPlaying: true,
    });
  });

  /// ネイティブが弾いた理由は握りつぶさない。
  /// 無音の原因が分からなくなるため
  it("ネイティブが弾いたらエラーをそのまま投げる", async () => {
    const plugin: ClavesAudioPlugin = {
      start: async () => {
        throw new Error("再生計画が不正です: invalidBpm(0.0)");
      },
      stop: async () => {},
      applyPlan: async () => {},
      setVolume: async () => {},
      getSnapshot: async () => ({ tick: 0, isPlaying: false }),
    };

    await expect(createNativeAudio(plugin).start(pattern, 120)).rejects.toThrow(
      /再生計画が不正です/,
    );
  });
});
