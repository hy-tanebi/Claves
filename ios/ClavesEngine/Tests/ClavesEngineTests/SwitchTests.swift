import Testing
@testable import ClavesEngine

/// パターンとテンポの切替。
///
/// **切替点より後で旧パターンの打点が鳴ってはいけない**（重なる）。
/// **切替点で新パターンが始まらなければいけない**（穴があく）。
/// この2つを継ぎ目で同時に満たすのが切替の全て。
@Suite("パターン切替の継ぎ目")
struct SwitchTests {

    /// three-two-groove を 120bpm。打点は 0 / 18000 / 36000 / 60000 / 72000 サンプル
    static func before() -> TransportPlan {
        TransportPlan(
            bpmUnit: 192, cycleTicks: 768, bpm: 120,
            originTick: 0, originSeconds: 0,
            events: [
                .init(tick: 0, pitch: .high),
                .init(tick: 144, pitch: .high),
                .init(tick: 288, pitch: .high),
                .init(tick: 480, pitch: .high),
                .init(tick: 576, pitch: .high),
            ]
        )
    }

    /// 切替後。**基準点が切替時刻（1.0秒）にあり、そこから先頭で鳴り始める**
    static func after() -> TransportPlan {
        TransportPlan(
            bpmUnit: 192, cycleTicks: 768, bpm: 180,
            originTick: 0, originSeconds: 1.0,
            events: [
                .init(tick: 0, pitch: .low),
                .init(tick: 192, pitch: .low),
            ]
        )
    }

    /// tick 384 は 120bpm で 1.0 秒。48kHz なら 48000 サンプル
    static let switchTick = 384
    static let switchFrame: Int64 = 48000

    @Test("切替点より後で旧パターンの打点が鳴らない")
    func oldPlanStopsAtBoundary() {
        var renderer = TransportRenderer(plan: Self.before(), sampleRate: 48000)
        renderer.apply(Self.after(), atTick: Self.switchTick)

        // 切替点をまたぐ 0 〜 60000 を一気に要求する。
        // 旧パターンの 60000（tick 480）は切替点より後なので鳴ってはいけない
        let hits = renderer.hits(from: 0, frameCount: 60000)

        let oldPlanHitsAfterSwitch = hits.filter {
            $0.frameOffset >= Int(Self.switchFrame) && $0.pitch == .high
        }
        #expect(oldPlanHitsAfterSwitch.isEmpty, "旧パターンが切替点を越えて鳴っている")
    }

    @Test("切替点ちょうどで新パターンの先頭が鳴る")
    func newPlanStartsAtBoundary() {
        var renderer = TransportRenderer(plan: Self.before(), sampleRate: 48000)
        renderer.apply(Self.after(), atTick: Self.switchTick)

        let hits = renderer.hits(from: 0, frameCount: 60000)

        let atSeam = hits.first { $0.frameOffset == Int(Self.switchFrame) }
        #expect(atSeam != nil, "切替点に穴があいている")
        #expect(atSeam?.pitch == .low, "切替点で鳴るのは新パターンの打点")
    }

    @Test("切替前の打点はそのまま鳴る")
    func earlierHitsAreUnaffected() {
        var renderer = TransportRenderer(plan: Self.before(), sampleRate: 48000)
        renderer.apply(Self.after(), atTick: Self.switchTick)

        let hits = renderer.hits(from: 0, frameCount: 60000)
        let beforeSeam = hits.filter { $0.frameOffset < Int(Self.switchFrame) }

        #expect(beforeSeam.map(\.frameOffset) == [0, 18000, 36000])
        #expect(beforeSeam.allSatisfy { $0.pitch == .high })
    }

    /// **JS は切替時刻を知らない。** 時計を持っているのはネイティブなので、
    /// JS が組む計画の基準点は常に 0 になる。
    ///
    /// 基準点をそのまま使うと、切替が 1.0 秒地点で起きたときに
    /// 新しい計画の打点が全部「0 秒あたり」＝過去になり、
    /// 読み飛ばされて**無音になる**。
    /// 切替点に基準点を合わせ直すのはネイティブ側の責任。
    @Test("基準点が 0 の計画を渡しても、切替点から鳴り始める")
    func anchorsIncomingPlanToTheSwitchPoint() {
        var renderer = TransportRenderer(plan: Self.before(), sampleRate: 48000)

        // JS が組む計画。切替時刻を知らないので基準点は 0
        let fromJS = TransportPlan(
            bpmUnit: 192, cycleTicks: 768, bpm: 180,
            originTick: 0, originSeconds: 0,
            events: [.init(tick: 0, pitch: .low)]
        )
        renderer.apply(fromJS, atTick: Self.switchTick)

        let hits = renderer.hits(from: 0, frameCount: 60000)
        let atSeam = hits.first { $0.frameOffset == Int(Self.switchFrame) }

        #expect(atSeam != nil, "切替後が無音になっている（基準点が過去のまま）")
        #expect(atSeam?.pitch == .low)
    }

    /// 切替はバッファ境界と無関係に起こる。
    /// バッファを細かく刻んでも、継ぎ目の位置は変わってはいけない
    @Test("バッファの区切り方を変えても継ぎ目の位置は同じ")
    func seamIsIndependentOfBufferSize() {
        var whole = TransportRenderer(plan: Self.before(), sampleRate: 48000)
        whole.apply(Self.after(), atTick: Self.switchTick)
        let inOneGo = whole.hits(from: 0, frameCount: 60000)

        var chunked = TransportRenderer(plan: Self.before(), sampleRate: 48000)
        chunked.apply(Self.after(), atTick: Self.switchTick)
        var collected: [Int] = []
        var start: Int64 = 0
        while start < 60000 {
            let size = 512
            for hit in chunked.hits(from: start, frameCount: size) {
                collected.append(Int(start) + hit.frameOffset)
            }
            start += Int64(size)
        }

        #expect(collected == inOneGo.map(\.frameOffset))
    }
}
