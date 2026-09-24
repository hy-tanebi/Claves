import Testing
@testable import ClavesEngine

/// 切替を置ける拍境界の計算。
///
/// **予約済みの範囲より後にしか境界を置かない。** これにより予約済みの音を
/// 取り消す必要がなくなり、二重発音と打点欠落が構造的に起こらない。
/// JS 側 `Scheduler.nextBoundaryTick` と同じ規則。
@Suite("切替の拍境界")
struct BoundaryTests {

    /// 一番危ないのがこの場合。予約済みの位置がちょうど拍境界に乗っていると、
    /// 素朴に「次の拍境界」を求めると同じ tick が返り、そこで切り替えると
    /// 予約済みの打点と新しい打点が重なって二重に鳴る。
    @Test("予約済みの tick がちょうど拍境界でも、境界はその先に置く")
    func boundaryNeverLandsOnAlreadyScheduledTick() {
        // 2/2 なので1拍 = 192 tick。384 はちょうど2拍目の頭
        let boundary = TransportPlan.nextBoundaryTick(
            bpmUnit: 192, lastScheduledTick: 384, nowTick: 300)

        #expect(boundary == 576, "384 に置くと予約済みの打点と重なる")
        #expect(boundary > 384, "境界は予約済みより後でなければならない")
    }

    @Test("予約済みが拍の途中なら、次の拍境界に切り上げる")
    func boundaryRoundsUpToNextBeat() {
        let boundary = TransportPlan.nextBoundaryTick(
            bpmUnit: 192, lastScheduledTick: 100, nowTick: 50)
        #expect(boundary == 192)
    }

    /// 先読みが現在時刻より遅れている場合（長いフリーズの後など）は、
    /// 現在時刻のほうを基準にしないと過去に境界を置いてしまう。
    @Test("現在時刻が予約済みより先なら、現在時刻を基準にする")
    func boundaryUsesNowWhenAhead() {
        let boundary = TransportPlan.nextBoundaryTick(
            bpmUnit: 192, lastScheduledTick: 100, nowTick: 500)
        #expect(boundary == 576)
    }

    /// 拍子が変われば1拍の長さも変わる。6/8 は付点4分 = 144 tick
    @Test("bpmUnit が変わると境界の間隔も変わる")
    func boundaryFollowsBpmUnit() {
        let boundary = TransportPlan.nextBoundaryTick(
            bpmUnit: 144, lastScheduledTick: 200, nowTick: 200)
        #expect(boundary == 288)
    }
}
