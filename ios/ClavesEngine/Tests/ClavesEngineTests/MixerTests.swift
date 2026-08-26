import Testing
@testable import ClavesEngine

/// 打点をバッファに書き込む部分。
///
/// **クリックの長さ（40ms ≒ 1920 サンプル）は普通のバッファ長より長い。**
/// バッファの端で鳴り始めた音は次のバッファへ続かなければならず、
/// ここを取りこぼすと音がブツ切りになる。
@Suite("バッファへの書き込み")
struct MixerTests {

    @Test("バッファの端で鳴り始めた打点は次のバッファへ続く")
    func voiceContinuesAcrossBuffers() {
        var mixer = ClickMixer(sampleRate: 48000)

        // 512 サンプルのバッファの、残り 10 サンプルの位置で鳴らす
        var first = [Float](repeating: 0, count: 512)
        mixer.fill(&first, hits: [ScheduledHit(frameOffset: 502, pitch: .high)])

        var second = [Float](repeating: 0, count: 512)
        mixer.fill(&second, hits: [])

        #expect(second.contains { $0 != 0 }, "次のバッファで音が途切れている")
    }

    @Test("打点が無ければ無音のまま")
    func silenceWithoutHits() {
        var mixer = ClickMixer(sampleRate: 48000)
        var buffer = [Float](repeating: 0, count: 512)
        mixer.fill(&buffer, hits: [])

        #expect(buffer.allSatisfy { $0 == 0 })
    }

    @Test("打点の位置から音が始まる")
    func hitStartsAtItsOffset() {
        var mixer = ClickMixer(sampleRate: 48000)
        var buffer = [Float](repeating: 0, count: 512)
        mixer.fill(&buffer, hits: [ScheduledHit(frameOffset: 100, pitch: .high)])

        #expect(buffer[0..<100].allSatisfy { $0 == 0 }, "打点より前で鳴っている")
        #expect(buffer[100..<512].contains { $0 != 0 }, "打点の位置から鳴っていない")
    }

    /// 速いテンポでは前の打点が鳴り終わる前に次が来る。
    /// 上書きすると前の音が不自然に切れるので、足し合わせる
    @Test("重なった打点は足し合わせる")
    func overlappingHitsAreMixed() {
        var single = ClickMixer(sampleRate: 48000)
        var one = [Float](repeating: 0, count: 512)
        single.fill(&one, hits: [ScheduledHit(frameOffset: 0, pitch: .high)])

        var double = ClickMixer(sampleRate: 48000)
        var two = [Float](repeating: 0, count: 512)
        double.fill(
            &two,
            hits: [
                ScheduledHit(frameOffset: 0, pitch: .high),
                ScheduledHit(frameOffset: 0, pitch: .high),
            ])

        // 同じ音を2つ重ねたので、どこかで単独より大きくなっているはず
        #expect(zip(one, two).contains { abs($1) > abs($0) + 1e-6 }, "重なりが無視されている")
    }

    /// バッファは使い回されるので、前回の中身が残っていることがある。
    /// 無音の区間は 0 で埋め直さないと、前の音が繰り返し鳴る
    @Test("前回の内容が残っているバッファでも無音区間は無音になる")
    func clearsStaleBufferContent() {
        var mixer = ClickMixer(sampleRate: 48000)
        var buffer = [Float](repeating: 0.5, count: 512)  // 前回の残骸
        mixer.fill(&buffer, hits: [])

        #expect(buffer.allSatisfy { $0 == 0 }, "前回の内容が残っている")
    }
}
