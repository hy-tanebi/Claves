import Foundation

public enum PlanValidationError: Error, Equatable {
    case unsupportedSchemaVersion(Int)
    case unsupportedPPQ(Int)
    case unknownPitch(String)
    case invalidBpm(Double)
    case invalidBpmUnit(Int)
    case invalidCycleTicks(Int)
    case nonFiniteOrigin(Double)
    case noEvents
    case tooManyEvents(Int)
    case eventOutsideCycle(index: Int, tick: Int)
    case eventsNotAscending(index: Int)
}

/// JS から渡ってくる再生計画の検証。
///
/// **この値はオーディオスレッドが読む。** 壊れた値が通ると、UI が固まるのではなく
/// 音が止まるか、最悪プロセスごと落ちる。JS 側は自分たちのコードだが、
/// WebView に読み込まれるものは書き換えられうるので、**信用しない前提で境界を守る**。
///
/// 特に注意しているのは「打点のサンプル位置が進まなくなる」種類の壊れ方で、
/// `TransportRenderer.hits` が終端に到達できず無限ループになる。
/// 周期長 0 と極端なテンポがそれにあたる。
public enum PlanValidator {

    /// レンダーコールバック1回の処理量を読めるようにするための上限。
    /// 実際のリズムはせいぜい数十打点なので、十分な余裕がある
    public static let maxEvents = 512

    /// 練習用メトロノームとして現実的な範囲。
    /// 上限を切らないと 1 tick が短くなりすぎて発音位置が進まなくなる
    public static let bpmRange: ClosedRange<Double> = 20...400

    /// 拍子ごとに決まった値しか取らない。
    /// 2/2 は 2分音符（192）、2/4・4/4 は 4分音符（96）、6/8 は付点4分（144）
    public static let allowedBpmUnits: Set<Int> = [96, 144, 192]

    public static func validate(_ plan: TransportPlan) throws {
        guard plan.bpm.isFinite, bpmRange.contains(plan.bpm) else {
            throw PlanValidationError.invalidBpm(plan.bpm)
        }
        guard allowedBpmUnits.contains(plan.bpmUnit) else {
            throw PlanValidationError.invalidBpmUnit(plan.bpmUnit)
        }
        guard plan.cycleTicks > 0 else {
            throw PlanValidationError.invalidCycleTicks(plan.cycleTicks)
        }
        guard plan.originSeconds.isFinite else {
            throw PlanValidationError.nonFiniteOrigin(plan.originSeconds)
        }
        guard !plan.events.isEmpty else {
            throw PlanValidationError.noEvents
        }
        guard plan.events.count <= maxEvents else {
            throw PlanValidationError.tooManyEvents(plan.events.count)
        }

        var previous = -1
        for (index, event) in plan.events.enumerated() {
            guard event.tick >= 0, event.tick < plan.cycleTicks else {
                throw PlanValidationError.eventOutsideCycle(index: index, tick: event.tick)
            }
            guard event.tick > previous else {
                throw PlanValidationError.eventsNotAscending(index: index)
            }
            previous = event.tick
        }
    }
}
