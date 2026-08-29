import Foundation

public enum PlanValidationError: Error, Equatable {
    case unsupportedSchemaVersion(Int)
    case unsupportedPPQ(Int)
    case unknownPitch(String)
    case invalidBpm(Double)
    case invalidBpmUnit(Int)
    case invalidCycleTicks(Int)
    case nonFiniteOrigin(Double)
    case originOutOfRange(tick: Int, seconds: Double)
    case noEvents
    case tooManyEvents(Int)
    case eventOutsideCycle(index: Int, tick: Int)
    case eventsNotAscending(index: Int)
    case planTooLarge(bytes: Int)
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
    /// **収録中の最大は9打点。** 128 で 14 倍の余裕がある
    public static let maxEvents = 128

    /// 周期長の上限。**上限が無いと `loop * cycleTicks` が桁あふれして
    /// プロセスごと落ちる**（Swift の整数演算は検査付きでトラップする）。
    /// 収録中の最大は 768（2小節）。6144 は 4/4 で 16 小節ぶんにあたる
    public static let maxCycleTicks = 6_144

    /// 基準点の範囲。**上限が無いと `tick - originTick` が桁あふれし、
    /// 秒→サンプルの変換も `Int64` の範囲を超える。**
    ///
    /// 通常 JS は基準点ゼロで送ってくる（`native-audio.ts` の `FROM_START`）が、
    /// 途中から鳴らし始める余地を API に残してあるため、
    /// ゼロ固定にはせず現実的な範囲で縛る。
    /// 10^8 tick は最速テンポでも約21時間ぶん、10^6 秒は約11日ぶん
    public static let maxAbsOriginTick = 100_000_000
    public static let maxAbsOriginSeconds: Double = 1_000_000

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
        guard plan.cycleTicks > 0, plan.cycleTicks <= maxCycleTicks else {
            throw PlanValidationError.invalidCycleTicks(plan.cycleTicks)
        }
        guard plan.originSeconds.isFinite else {
            throw PlanValidationError.nonFiniteOrigin(plan.originSeconds)
        }
        // **`isFinite` だけでは足りない。** 1e300 は有限だが、
        // 秒→サンプルの変換で `Int64` の範囲を超える。
        //
        // **`abs()` を使ってはいけない。** `abs(Int.min)` は表現できる正の値が
        // 無いためトラップする。検査そのものが落ちては意味がないので、
        // 範囲の両端と直接比べる
        guard
            plan.originTick >= -maxAbsOriginTick, plan.originTick <= maxAbsOriginTick,
            plan.originSeconds >= -maxAbsOriginSeconds,
            plan.originSeconds <= maxAbsOriginSeconds
        else {
            throw PlanValidationError.originOutOfRange(
                tick: plan.originTick, seconds: plan.originSeconds)
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
