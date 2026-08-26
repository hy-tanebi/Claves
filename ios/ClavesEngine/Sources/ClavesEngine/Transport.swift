// tick ⇔ 時刻の計算。
// JS 側 `src/domain/transport.ts` が式の唯一の真実源で、
// `golden/transport.json` を読む突き合わせテストが一致を保証する。

/// 打点の音色。譜面データ側の `Pitch` と同じ文字列で表す。
public enum Pitch: String, Sendable, Codable {
    case high
    case low
}

/// 導出済みの打点。絶対 tick と、それが鳴る時刻（秒）を持つ。
public struct TransportEvent: Equatable, Sendable {
    public let absTick: Int
    public let seconds: Double
    public let pitch: Pitch

    public init(absTick: Int, seconds: Double, pitch: Pitch) {
        self.absTick = absTick
        self.seconds = seconds
        self.pitch = pitch
    }
}

/// 再生計画。**JS と Swift が共有する唯一の契約。**
///
/// iOS ではバックグラウンドで WKWebView ごと止まるため、再生クロックは
/// ネイティブが所有する。JS はユーザー操作を「この計画に切り替えてくれ」という
/// 宣言に変換して渡すだけで、時刻の計算は両側が同じ式で行う。
public struct TransportPlan: Sendable {

    /// 周期内の打点。`tick` は昇順。
    public struct Event: Sendable {
        public let tick: Int
        public let pitch: Pitch

        public init(tick: Int, pitch: Pitch) {
            self.tick = tick
            self.pitch = pitch
        }
    }

    /// BPM の1拍が何 tick か。2/2 は 192、4/4 は 96、6/8 は 144
    public let bpmUnit: Int
    /// 1周期の tick 数
    public let cycleTicks: Int
    public let bpm: Double
    /// この計画の基準点（絶対 tick）
    public let originTick: Int
    /// 基準点の時刻（秒）。オーディオ側の時計で測った値
    public let originSeconds: Double
    public let events: [Event]

    public init(
        bpmUnit: Int,
        cycleTicks: Int,
        bpm: Double,
        originTick: Int,
        originSeconds: Double,
        events: [Event]
    ) {
        self.bpmUnit = bpmUnit
        self.cycleTicks = cycleTicks
        self.bpm = bpm
        self.originTick = originTick
        self.originSeconds = originSeconds
        self.events = events
    }

    /// 1 tick の長さ（秒）。
    ///
    /// **`bpmUnit` を必ず噛ませる。** 拍子を変えたのに据え置くと
    /// テンポが倍ずれる（このプロジェクトで実際に踏んだ）。
    public static func secondsPerTick(bpm: Double, bpmUnit: Int) -> Double {
        60 / bpm / Double(bpmUnit)
    }

    public var secondsPerTick: Double {
        Self.secondsPerTick(bpm: bpm, bpmUnit: bpmUnit)
    }

    /// 通し番号 index の打点。index は 0 から無限に増える（周期をまたぐ）。
    ///
    /// 絶対 tick は「何周目か × 周期長 + 周期内の tick」。
    /// **JS の `Math.floor` に合わせて負の index でも切り捨て方向を揃える**
    /// （Swift の整数除算は 0 方向に丸めるため、そのままだとずれる）。
    public func event(at index: Int) -> TransportEvent {
        let count = events.count
        let loop = Int((Double(index) / Double(count)).rounded(.down))
        let position = index - loop * count
        let event = events[position]
        let absTick = loop * cycleTicks + event.tick
        return TransportEvent(
            absTick: absTick,
            seconds: seconds(atTick: absTick),
            pitch: event.pitch
        )
    }

    /// 絶対 tick の時刻（秒）。基準点より前なら基準時刻より小さくなる
    public func seconds(atTick tick: Int) -> Double {
        originSeconds + Double(tick - originTick) * secondsPerTick
    }

    /// 時刻（秒）に対応する絶対 tick。整数に丸めない（境界の判定に使う）
    public func tick(atSeconds seconds: Double) -> Double {
        Double(originTick) + (seconds - originSeconds) / secondsPerTick
    }

    /// 切替を置ける最初の拍境界。
    ///
    /// **予約済みの範囲より後にしか境界を置かない。**
    /// 単に「次の拍境界」とすると、先読み済みの範囲と重なって二重に鳴る。
    /// この規則により予約済みの音を取り消す必要がなくなり、
    /// 二重発音と打点欠落が構造的に起こらない。
    ///
    /// JS 側 `Scheduler.nextBoundaryTick` と同じ式。
    public static func nextBoundaryTick(
        bpmUnit: Int,
        lastScheduledTick: Int,
        nowTick: Double
    ) -> Int {
        let lowerBound = max(Double(lastScheduledTick), nowTick)
        var boundary = Int((lowerBound / Double(bpmUnit)).rounded(.up)) * bpmUnit
        // 予約済みの打点と同じ位置では切り替えられない（二重発音になる）
        while boundary <= lastScheduledTick { boundary += bpmUnit }
        return boundary
    }
}
