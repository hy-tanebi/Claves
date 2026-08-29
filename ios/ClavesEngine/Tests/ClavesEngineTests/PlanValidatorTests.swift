import Testing
@testable import ClavesEngine

/// JS から渡ってくる再生計画の検証。
///
/// **この値はオーディオスレッドが読む。** 壊れた値が通ると、UI が固まるのではなく
/// 音が止まるか、最悪プロセスごと落ちる。JS 側は自分たちのコードだが、
/// WebView に読み込まれるものは書き換えられうるので、**信用しない前提で境界を守る**。
///
/// 特に危ないのは「打点のサンプル位置が進まなくなる」種類の壊れ方で、
/// `TransportRenderer.hits` が終端に到達できず無限ループになる。
@Suite("再生計画の検証")
struct PlanValidatorTests {

    static func valid(
        bpmUnit: Int = 192,
        cycleTicks: Int = 768,
        bpm: Double = 120,
        originTick: Int = 0,
        originSeconds: Double = 0,
        events: [TransportPlan.Event] = [
            .init(tick: 0, pitch: .high),
            .init(tick: 144, pitch: .low),
        ]
    ) -> TransportPlan {
        TransportPlan(
            bpmUnit: bpmUnit, cycleTicks: cycleTicks, bpm: bpm,
            originTick: originTick, originSeconds: originSeconds, events: events)
    }

    @Test("まっとうな計画は通る")
    func acceptsValidPlan() throws {
        try PlanValidator.validate(Self.valid())
    }

    // MARK: - 無限ループを起こす壊れ方

    /// 周期長が 0 だと2周目以降の絶対 tick が増えず、
    /// 打点のサンプル位置が止まって `hits` が終端に到達できない
    @Test("周期長が 0 なら弾く")
    func rejectsZeroCycle() {
        #expect(throws: PlanValidationError.invalidCycleTicks(0)) {
            try PlanValidator.validate(Self.valid(cycleTicks: 0))
        }
    }

    /// テンポが極端に大きいと 1 tick が短すぎて、
    /// 全打点が同じサンプル位置に丸まる。これも無限ループになる
    @Test("テンポが現実的な範囲を超えたら弾く")
    func rejectsAbsurdTempo() {
        #expect(throws: PlanValidationError.self) {
            try PlanValidator.validate(Self.valid(bpm: 1e18))
        }
        #expect(throws: PlanValidationError.self) {
            try PlanValidator.validate(Self.valid(bpm: 0))
        }
        #expect(throws: PlanValidationError.self) {
            try PlanValidator.validate(Self.valid(bpm: -120))
        }
    }

    /// 非数が混ざるとサンプル位置の計算が NaN になり、
    /// Int64 への変換でプロセスごと落ちる
    @Test("非数や無限大は弾く")
    func rejectsNonFinite() {
        #expect(throws: PlanValidationError.self) {
            try PlanValidator.validate(Self.valid(bpm: .nan))
        }
        #expect(throws: PlanValidationError.self) {
            try PlanValidator.validate(Self.valid(originSeconds: .infinity))
        }
    }

    // MARK: - 処理量が青天井になる壊れ方

    /// 打点が多すぎるとレンダーコールバック1回の処理量が読めなくなり、
    /// 締め切りを落として音が途切れる
    @Test("打点が多すぎたら弾く")
    func rejectsTooManyEvents() {
        let many = (0..<(PlanValidator.maxEvents + 1)).map {
            TransportPlan.Event(tick: $0, pitch: .high)
        }
        // **周期長は上限内にしておく。** 上限超えで弾かれると
        // 打点数を見ないまま通ってしまい、このテストの意味がなくなる
        #expect(throws: PlanValidationError.tooManyEvents(PlanValidator.maxEvents + 1)) {
            try PlanValidator.validate(
                Self.valid(cycleTicks: PlanValidator.maxCycleTicks, events: many))
        }
    }

    /// 周期長に上限が無いと `event(at:)` の `loop * cycleTicks` が桁あふれし、
    /// Swift の検査付き演算がプロセスごと落とす
    @Test("周期長が上限を超えたら弾く")
    func rejectsHugeCycle() {
        #expect(throws: PlanValidationError.invalidCycleTicks(Int.max)) {
            try PlanValidator.validate(Self.valid(cycleTicks: Int.max))
        }
        #expect(throws: PlanValidationError.self) {
            try PlanValidator.validate(Self.valid(cycleTicks: PlanValidator.maxCycleTicks + 1))
        }
    }

    /// `isFinite` を通る値でも、桁が大きすぎれば `tick - originTick` が
    /// 桁あふれし、秒→サンプルの変換も `Int64` の範囲を超える
    @Test("基準点が現実的な範囲を超えたら弾く")
    func rejectsOriginOutOfRange() {
        #expect(throws: PlanValidationError.self) {
            try PlanValidator.validate(Self.valid(originTick: Int.min))
        }
        #expect(throws: PlanValidationError.self) {
            try PlanValidator.validate(Self.valid(originTick: PlanValidator.maxAbsOriginTick + 1))
        }
        // 1e300 は有限だが、48kHz を掛けた時点で Int64 に入らない
        #expect(throws: PlanValidationError.self) {
            try PlanValidator.validate(Self.valid(originSeconds: 1e300))
        }
    }

    /// 途中から鳴らし始める余地は残す。ゼロ固定にはしない
    @Test("現実的な範囲の基準点は通る")
    func acceptsReasonableOrigin() throws {
        try PlanValidator.validate(Self.valid(originTick: 384, originSeconds: 2))
    }

    // MARK: - 密度

    /// 打点数の上限だけでは密度を縛れない。
    /// **周期長を縮めれば、打点1件のまま毎秒1000回以上鳴らせる。**
    /// 重なった音は足し合わせるので、これは持続音になる
    @Test("周期の継ぎ目が詰まっている計画は弾く")
    func rejectsTightCycleWrap() {
        // 打点1件・周期長1。中の間隔は測れないが、折り返しで毎 tick 鳴る
        #expect(throws: PlanValidationError.eventsTooClose(index: 0, gap: 1)) {
            try PlanValidator.validate(
                Self.valid(cycleTicks: 1, events: [.init(tick: 0, pitch: .high)]))
        }
    }

    @Test("打点どうしが近すぎたら弾く")
    func rejectsTightlyPackedEvents() {
        #expect(throws: PlanValidationError.eventsTooClose(index: 1, gap: 1)) {
            try PlanValidator.validate(
                Self.valid(events: [
                    .init(tick: 0, pitch: .high),
                    .init(tick: 1, pitch: .high),
                ]))
        }
    }

    /// 収録データの最小間隔は 48（周期の継ぎ目も 48）。下限 12 に対して4倍の余裕がある
    @Test("収録データの間隔は通る")
    func acceptsRealSpacing() throws {
        try PlanValidator.validate(
            Self.valid(
                cycleTicks: 768,
                events: [
                    .init(tick: 0, pitch: .high),
                    .init(tick: 48, pitch: .low),
                    .init(tick: 720, pitch: .low),
                ]))
    }

    @Test("打点が空なら弾く")
    func rejectsEmptyEvents() {
        #expect(throws: PlanValidationError.noEvents) {
            try PlanValidator.validate(Self.valid(events: []))
        }
    }

    // MARK: - 打点の並び

    /// 周期の外にある打点は、周期の内側という前提で書いた
    /// 絶対 tick の計算を壊す
    @Test("周期の外にある打点は弾く")
    func rejectsEventOutsideCycle() {
        #expect(throws: PlanValidationError.self) {
            try PlanValidator.validate(
                Self.valid(cycleTicks: 768, events: [.init(tick: 800, pitch: .high)]))
        }
        #expect(throws: PlanValidationError.self) {
            try PlanValidator.validate(
                Self.valid(cycleTicks: 768, events: [.init(tick: -1, pitch: .high)]))
        }
    }

    /// 昇順でないと、時間を巻き戻す打点ができて先読みの前提が崩れる
    @Test("打点が昇順でないなら弾く")
    func rejectsUnsortedEvents() {
        #expect(throws: PlanValidationError.self) {
            try PlanValidator.validate(
                Self.valid(events: [
                    .init(tick: 288, pitch: .high),
                    .init(tick: 144, pitch: .high),
                ]))
        }
    }

    /// 拍子ごとに決まった値しか取らない。2/2 は 192、2/4・4/4 は 96、6/8 は 144
    @Test("想定外の bpmUnit は弾く")
    func rejectsUnknownBpmUnit() {
        #expect(throws: PlanValidationError.invalidBpmUnit(7)) {
            try PlanValidator.validate(Self.valid(bpmUnit: 7))
        }
    }

    // MARK: - 危険が実在することの確認

    /// 検証層が「あるだけ」では守っている証明にならないので、
    /// **弾いている値が本当に危ないこと**を確かめる。
    ///
    /// `TransportRenderer.hits` は打点のサンプル位置が終端を越えるまで回るので、
    /// 位置が進まない計画を渡すと戻ってこない。
    /// 無限ループを実際に回すわけにはいかないため、
    /// 「通し番号を進めてもサンプル位置が増えない」ことを直接確かめる。
    @Test("周期長 0 では通し番号を進めてもサンプル位置が増えない")
    func zeroCycleFreezesPlayheadForever() {
        let broken = Self.valid(cycleTicks: 0)
        let renderer = TransportRenderer(plan: broken, sampleRate: 48000)

        // 打点は2つ。3番目以降は2周目・3周目…にあたるが、
        // 周期長が 0 なので絶対 tick が増えない
        let atSecondCycle = renderer.frame(ofEventAt: 2)
        let atHundredthCycle = renderer.frame(ofEventAt: 200)

        #expect(
            atSecondCycle == atHundredthCycle,
            "位置が進まない = hits が終端に到達できない。検証層で弾く必要がある")

        // 検証層がこれを通さないことを確かめる
        #expect(throws: PlanValidationError.invalidCycleTicks(0)) {
            try PlanValidator.validate(broken)
        }
    }

    /// 極端なテンポでも同じことが起きる。
    /// 1 tick が短すぎて、全打点が同じサンプル位置に丸まる
    @Test("極端なテンポでは全打点が同じサンプル位置に丸まる")
    func absurdTempoCollapsesAllHitsToOneFrame() {
        let broken = Self.valid(bpm: 1e18)
        let renderer = TransportRenderer(plan: broken, sampleRate: 48000)

        #expect(
            renderer.frame(ofEventAt: 0) == renderer.frame(ofEventAt: 1000),
            "位置が進まない = hits が終端に到達できない")

        #expect(throws: PlanValidationError.self) {
            try PlanValidator.validate(broken)
        }
    }
}
