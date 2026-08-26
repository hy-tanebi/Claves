/// バッファ内で鳴らす打点。`frameOffset` はそのバッファの先頭からのサンプル数。
public struct ScheduledHit: Equatable, Sendable {
    public let frameOffset: Int
    public let pitch: Pitch

    public init(frameOffset: Int, pitch: Pitch) {
        self.frameOffset = frameOffset
        self.pitch = pitch
    }
}

/// 「このバッファの N サンプルを埋めろ」というレンダーコールバックの要求を、
/// 「バッファ内のどの位置で何を鳴らすか」に変換する。
///
/// **時刻はサンプル数で数える。`Date` や壁時計は使わない。**
/// オーディオの再生位置はサンプル単位で進み、壁時計とは独立に動くため、
/// 壁時計を混ぜると再生位置がじわじわずれる。
///
/// `AVAudioSourceNode` から切り離してあるので、実機もオーディオ機器も要らずに検証できる。
public struct TransportRenderer: Sendable {

    public private(set) var plan: TransportPlan
    public let sampleRate: Double

    /// まだ返していない打点の通し番号
    private var nextIndex: Int = 0

    /// 予約済みの切替。切替点のサンプル位置は**旧 plan の時間軸**で決まる
    private var pending: (plan: TransportPlan, frame: Int64)?

    public init(plan: TransportPlan, sampleRate: Double) {
        self.plan = plan
        self.sampleRate = sampleRate
    }

    /// 切替を予約する。`atTick` は**現在の plan の時間軸での**絶対 tick。
    ///
    /// 境界は `TransportPlan.nextBoundaryTick` で決めること。
    /// 予約済みの範囲より後にしか置かないので、
    /// **すでに返した打点を取り消す必要がない**（二重発音が構造的に起こらない）。
    /// **渡された計画の基準点は使わず、切替点に置き直す。**
    /// JS は切替時刻を知らないので基準点は常に 0 で届く。
    /// そのまま使うと新しい計画の打点が全部過去になり、読み飛ばされて無音になる。
    public mutating func apply(_ newPlan: TransportPlan, atTick tick: Int) {
        let seconds = plan.seconds(atTick: tick)
        pending = (newPlan.anchored(atSeconds: seconds), Int64((seconds * sampleRate).rounded()))
    }

    /// 通し番号 index の打点が鳴る絶対サンプル位置
    public func frame(ofEventAt index: Int) -> Int64 {
        Int64((plan.event(at: index).seconds * sampleRate).rounded())
    }

    /// サンプル位置に対応する再生位置（絶対 tick）。
    ///
    /// 譜面のハイライトはこれで動かす。
    /// **ネイティブが時計を持つ以上、JS 側で別に数えると必ずずれる。**
    /// 切替後は現在の計画の時間軸で数える。
    public func tick(atFrame frame: Int64) -> Double {
        plan.tick(atSeconds: Double(frame) / sampleRate)
    }

    /// `startFrame` から `frameCount` サンプルぶんのバッファに入る打点を返す。
    ///
    /// バッファより前になってしまった打点は**読み飛ばす**。
    /// 過去の位置で鳴らすと実機では即座に発音され、打点が連射されるため。
    public mutating func hits(from startFrame: Int64, frameCount: Int) -> [ScheduledHit] {
        guard !plan.events.isEmpty, frameCount > 0 else { return [] }

        let endFrame = startFrame + Int64(frameCount)
        var hits: [ScheduledHit] = []

        while true {
            // 切替点がこのバッファに入っていて、旧 plan の次の打点が切替点以降なら、
            // ここが継ぎ目。旧 plan の打点を鳴らす前に差し替える。
            //
            // **切替点がバッファの外なら差し替えない。** 先に差し替えてしまうと、
            // まだ鳴らすべき旧 plan の打点を落とす。
            if let pending, pending.frame < endFrame,
                self.frame(ofEventAt: nextIndex) >= pending.frame
            {
                plan = pending.plan
                nextIndex = 0
                self.pending = nil
                continue
            }

            let frame = self.frame(ofEventAt: nextIndex)
            if frame >= endFrame { break }

            if frame >= startFrame {
                hits.append(
                    ScheduledHit(
                        frameOffset: Int(frame - startFrame),
                        pitch: plan.event(at: nextIndex).pitch
                    )
                )
            }
            // frame < startFrame の打点は遅れているので鳴らさず読み飛ばす
            nextIndex += 1
        }

        return hits
    }
}
