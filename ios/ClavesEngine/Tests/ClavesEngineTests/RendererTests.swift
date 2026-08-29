import Testing
@testable import ClavesEngine

/// オーディオのレンダーコールバックは「このバッファの N サンプルを埋めろ」としか言わない。
/// **どの打点がバッファ内のどのサンプル位置で鳴るか**を決めるのがここ。
///
/// この計算を `AVAudioSourceNode` から切り離しておくことで、
/// 実機もオーディオ機器も要らずに検証できる。
@Suite("バッファ内の発音位置")
struct RendererTests {

    /// three-two-groove を 120bpm、48kHz で。
    /// 1 tick = 0.5/192 秒なので、tick 144 は 0.375 秒 = 18000 サンプル。
    static func makePlan() -> TransportPlan {
        TransportPlan(
            bpmUnit: 192,
            cycleTicks: 768,
            bpm: 120,
            originTick: 0,
            originSeconds: 0,
            events: [
                .init(tick: 0, pitch: .high),
                .init(tick: 144, pitch: .high),
                .init(tick: 288, pitch: .low),
                .init(tick: 480, pitch: .high),
                .init(tick: 576, pitch: .low),
            ]
        )
    }

    @Test("バッファに入る打点だけを、そのバッファ内のオフセット付きで返す")
    func returnsHitsWithinBufferOnly() {
        var renderer = TransportRenderer(plan: Self.makePlan(), sampleRate: 48000)

        // 0 〜 20000 サンプル。tick 0（0秒）と tick 144（0.375秒 = 18000）が入る。
        // tick 288（0.75秒 = 36000）はまだ入らない
        let first = renderer.hits(from: 0, frameCount: 20000)
        #expect(first.count == 2)
        #expect(first[0].frameOffset == 0)
        #expect(first[0].pitch == .high)
        #expect(first[1].frameOffset == 18000)
        #expect(first[1].pitch == .high)
    }

    @Test("次のバッファでは、そのバッファ先頭からのオフセットになる")
    func offsetsAreRelativeToEachBuffer() {
        var renderer = TransportRenderer(plan: Self.makePlan(), sampleRate: 48000)
        _ = renderer.hits(from: 0, frameCount: 20000)

        // 20000 〜 40000。tick 288 は 36000 なので、このバッファの 16000 番目
        let second = renderer.hits(from: 20000, frameCount: 20000)
        #expect(second.count == 1)
        #expect(second[0].frameOffset == 16000)
        #expect(second[0].pitch == .low)
    }

    /// 打点が1つも入らないバッファは普通に起こる（テンポが遅いとき）。
    /// ここで詰まると音が飛ぶので、空を返して進めなければならない。
    @Test("打点が入らないバッファは空を返す")
    func emptyBufferIsFine() {
        var renderer = TransportRenderer(plan: Self.makePlan(), sampleRate: 48000)
        _ = renderer.hits(from: 0, frameCount: 1)

        // 1 〜 17999。次の打点 18000 の手前で終わる
        let gap = renderer.hits(from: 1, frameCount: 17999)
        #expect(gap.isEmpty)
    }

    /// 周期をまたいでも鳴り続ける。2周目の先頭は 768 tick = 2.0 秒 = 96000 サンプル
    /// 譜面のハイライトは「いまどこを鳴らしているか」で動く。
    /// **ネイティブが時計を持つ以上、再生位置もネイティブに聞くしかない。**
    /// JS 側で別に数えると必ずずれる。
    @Test("サンプル位置から再生位置（tick）を取れる")
    func reportsPlayheadTick() {
        let renderer = TransportRenderer(plan: Self.makePlan(), sampleRate: 48000)

        // 1 tick = 0.5/192 秒。18000 サンプル = 0.375 秒 = 144 tick
        #expect(abs(renderer.tick(atFrame: 0) - 0) < 1e-9)
        #expect(abs(renderer.tick(atFrame: 18000) - 144) < 1e-9)
        #expect(abs(renderer.tick(atFrame: 96000) - 768) < 1e-9)
    }

    /// 切替後は新しい計画の時間軸で数える。
    /// 古い計画のまま数えるとハイライトが譜面とずれる
    @Test("切替後は新しい計画の時間軸で再生位置を返す")
    func playheadFollowsCurrentPlan() {
        var renderer = TransportRenderer(plan: Self.makePlan(), sampleRate: 48000)

        // 倍のテンポ（240bpm）に、1.0 秒地点で切り替える
        let faster = TransportPlan(
            bpmUnit: 192, cycleTicks: 768, bpm: 240,
            originTick: 0, originSeconds: 1.0,
            events: [.init(tick: 0, pitch: .high)]
        )
        renderer.apply(faster, atTick: 384)  // 120bpm では 1.0 秒
        _ = renderer.hits(from: 0, frameCount: 60000)

        // 切替後 0.5 秒（=1.5秒地点 = 72000 サンプル）。
        // 240bpm では 1 tick = 0.5/2/192 秒なので 0.5 秒は 384 tick
        #expect(abs(renderer.tick(atFrame: 72000) - 384) < 1e-9)
    }

    @Test("周期をまたいでも鳴り続ける")
    func continuesAcrossCycles() {
        var renderer = TransportRenderer(plan: Self.makePlan(), sampleRate: 48000)
        _ = renderer.hits(from: 0, frameCount: 90000)

        let nextCycle = renderer.hits(from: 90000, frameCount: 10000)
        #expect(nextCycle.count == 1)
        #expect(nextCycle[0].frameOffset == 6000)  // 96000 - 90000
        #expect(nextCycle[0].pitch == .high)
    }

    // MARK: - 使い回すバッファへ書く形

    /// レンダーコールバックはリアルタイムスレッドで走るので、
    /// **打点の配列を毎回作ってはいけない。** 呼ぶ側のバッファへ書く形が本体で、
    /// 配列を返す形はそれを包んだだけ。両者が一致することを確かめる
    @Test("バッファへ書く形と配列を返す形は同じ結果になる")
    func bufferFormMatchesArrayForm() {
        var byArray = TransportRenderer(plan: Self.makePlan(), sampleRate: 48000)
        var byBuffer = TransportRenderer(plan: Self.makePlan(), sampleRate: 48000)

        let expected = byArray.hits(from: 0, frameCount: 90000)

        var buffer = [ScheduledHit](repeating: .placeholder, count: 256)
        let count = byBuffer.hits(from: 0, frameCount: 90000, into: &buffer)

        #expect(count == expected.count)
        for index in 0..<count {
            #expect(buffer[index] == expected[index])
        }
    }

    /// 検証層を通った計画では溢れないが、溢れても落ちないことを確かめる。
    /// **入りきらないぶんは読み飛ばす**（鳴らないだけで、位置は進む）
    @Test("バッファに入りきらない打点は読み飛ばす")
    func dropsHitsBeyondBufferCapacity() {
        var renderer = TransportRenderer(plan: Self.makePlan(), sampleRate: 48000)

        var tiny = [ScheduledHit](repeating: .placeholder, count: 1)
        let count = renderer.hits(from: 0, frameCount: 90000, into: &tiny)

        #expect(count == 1, "バッファの長さを超えて書き込まない")
    }
}
