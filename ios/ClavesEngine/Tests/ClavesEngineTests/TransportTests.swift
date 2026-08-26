import Testing
@testable import ClavesEngine

/// tick ⇔ 時刻の計算。**JS 側 `src/domain/transport.ts` と同じ式でなければならない。**
@Suite("Transport の時刻計算")
struct TransportTests {

    /// 拍子を変えたのに `bpmUnit` を据え置くとテンポが倍ずれる。
    /// このプロジェクトで実際に踏んだので、まずここを固定する。
    @Test("1 tick の長さは bpmUnit を必ず噛ませる")
    func secondsPerTickHonorsBpmUnit() {
        // 2/2（1拍 = 2分音符 = 192 tick）を 120bpm で鳴らすと、
        // 1拍 0.5 秒 ÷ 192 tick = 1 tick あたり 0.0026041666... 秒
        let halfNote = TransportPlan.secondsPerTick(bpm: 120, bpmUnit: 192)
        #expect(abs(halfNote - 0.5 / 192) < 1e-12)

        // 4/4（1拍 = 4分音符 = 96 tick）なら 1 tick は倍の長さになる
        let quarterNote = TransportPlan.secondsPerTick(bpm: 120, bpmUnit: 96)
        #expect(abs(quarterNote - 0.5 / 96) < 1e-12)

        // bpmUnit を無視した実装だと、この2つが同じ値になってしまう
        #expect(halfNote != quarterNote)
    }

    /// 打点の通し番号は 0 から無限に増え、周期をまたぐ。
    /// 「何周目か × 周期長 + 周期内の tick」で絶対 tick が決まる。
    @Test("通し番号が周期を超えると絶対 tick が周期長ぶん進む")
    func eventAtWrapsAcrossCycles() {
        // three-two-groove を 120bpm で。2/2 なので bpmUnit は 192
        let plan = TransportPlan(
            bpmUnit: 192,
            cycleTicks: 768,
            bpm: 120,
            originTick: 0,
            originSeconds: 0,
            events: [
                .init(tick: 0, pitch: .high),
                .init(tick: 144, pitch: .high),
                .init(tick: 288, pitch: .high),
                .init(tick: 480, pitch: .high),
                .init(tick: 576, pitch: .high),
            ]
        )

        // 1周目の3つ目
        let third = plan.event(at: 2)
        #expect(third.absTick == 288)
        #expect(abs(third.seconds - 0.75) < 1e-12)

        // 打点は5つなので index 5 は2周目の先頭。周期長 768 ぶん進む
        let secondCycleHead = plan.event(at: 5)
        #expect(secondCycleHead.absTick == 768)
        #expect(abs(secondCycleHead.seconds - 2.0) < 1e-12)

        // 2周目の2つ目は 768 + 144
        let secondCycleNext = plan.event(at: 6)
        #expect(secondCycleNext.absTick == 912)
        #expect(abs(secondCycleNext.seconds - 2.375) < 1e-12)
    }
}
