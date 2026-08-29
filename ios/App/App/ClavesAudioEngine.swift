import AVFoundation
import ClavesEngine
import os

/// 音を出す部分。**再生クロックはここが持ち続ける。**
///
/// iOS はバックグラウンドで WKWebView を止めるため、JS に時刻を任せると
/// 画面を消した瞬間に再生が壊れる。そのため JS からは「この計画に切り替えてくれ」という
/// 宣言だけを受け取り、時刻の計算とサンプルの生成はネイティブが一貫して行う。
///
/// 正しさが critical な計算は `ClavesEngine`（純粋計算のパッケージ）にあり、
/// `swift test` で検証済み。このクラスはそれを AVAudioEngine に繋ぐ薄い殻にとどめる。
final class ClavesAudioEngine {

    private let engine = AVAudioEngine()
    private var sourceNode: AVAudioSourceNode?
    private let sampleRate: Double

    // MARK: - オーディオスレッドだけが所有する状態

    /// レンダーコールバックは**リアルタイムスレッド**で走る。
    /// ここでメモリ確保・ロック待ち・システムコールをすると音が途切れる。
    ///
    /// **以下は `render` からしか触らない。** 他のスレッドから読むことも書くことも
    /// しないので、ロックが要らない。逆に、外から読めるようにした瞬間に
    /// 「ロックを取っているのに守られていない」状態が生まれる。
    /// 外へ渡す値は `publishedTick` に書き出す。
    private var renderer: TransportRenderer
    private var mixer: ClickMixer
    private var currentFrame: Int64 = 0
    /// バッファはコールバックごとに確保せず、最大長ぶんを使い回す
    private var scratch: [Float]
    /// 打点の受け皿。**これもコールバックごとに作らない。**
    ///
    /// 1バッファに入りうる打点数には上限がある。検証層が BPM を 400、
    /// `bpmUnit` を 192 までに縛るので tick は毎秒 1280 が上限で、
    /// 4096 サンプル（48kHz で約85ms）に入るのは約109。256 なら十分に余る
    private var hitBuffer: [ScheduledHit]
    private var volume: Float = 1.0
    /// 予約済みの最後の tick。境界計算に使う
    private var lastScheduledTick: Int = 0
    /// 直近のレンダーが到達した再生位置。次の回に `publishedTick` へ写す
    private var renderedTick: Double = 0

    // MARK: - スレッド間の受け渡し

    /// **`lock` が守るのはこの区画だけ。**
    /// オーディオスレッドが所有する状態を、ここへ持ち込んではいけない。
    ///
    /// **オーディオスレッドは待たない**（`trylock` で取れなければ次の回に回す）。
    /// 逆に UI 側は待ってよいので、通常のロックで入る。
    private var lock = os_unfair_lock_s()

    /// UI スレッドが置いた切替の予約。
    /// **切替点は入っていない。** 境界はオーディオスレッドが自分の状態から決める
    private var pendingPlan: (plan: TransportPlan, bpmUnit: Int)?
    private var pendingVolume: Float?

    /// オーディオスレッドが書き出した再生位置。UI が読むのはこれだけ
    private var publishedTick: Double = 0

    /// いま鳴らしている位置（絶対 tick）。譜面のハイライトに使う。
    ///
    /// **`renderer` を UI スレッドから直接読んではいけない。**
    /// オーディオスレッドが書き換える構造体なのでデータ競合になる。
    /// オーディオスレッド側が `publishedTick` へ書き出し、UI はロック越しに読む。
    /// 取り込みに失敗した回は1バッファぶん古い値になるが、
    /// ハイライトの見た目には影響しない。
    var playheadTick: Double {
        os_unfair_lock_lock(&lock)
        defer { os_unfair_lock_unlock(&lock) }
        return publishedTick
    }

    init(plan: TransportPlan, sampleRate: Double = 48000, maxFrames: Int = 4096) {
        self.sampleRate = sampleRate
        self.renderer = TransportRenderer(plan: plan, sampleRate: sampleRate)
        self.mixer = ClickMixer(sampleRate: sampleRate)
        self.scratch = [Float](repeating: 0, count: maxFrames)
        self.hitBuffer = [ScheduledHit](repeating: .placeholder, count: Self.maxHitsPerBuffer)
    }

    private static let maxHitsPerBuffer = 256

    // MARK: - セッション

    /// 再生が自分の意思でなく止まったときに呼ぶ。
    ///
    /// **止めたことを JS に伝えないと、画面のボタンが「再生中」のまま残る。**
    /// 割り込みやイヤホン抜去で止まったとき、UI と実際がずれるのを防ぐ。
    var onStoppedByPolicy: (() -> Void)?

    /// 決定済みの仕様に合わせる（2026-08-22 オーナー判断）:
    /// 他アプリと混ぜない（`.playback` を単独で使う）／
    /// サイレントスイッチでも鳴る（`.playback` の性質）。
    ///
    /// 割り込みと機器変更の監視もここで始める。
    /// **何をするかの判断は `ClavesEngine` の `LifecyclePolicy` にある**
    /// （実機なしでテストできるようにするため）。
    func configureSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playback, mode: .default, options: [])
        try session.setActive(true)
        observeLifecycle(session)
    }

    /// 登録した通知の解除券。
    ///
    /// **`addObserver(forName:...)` の戻り値を捨ててはいけない。**
    /// ブロック形式の observer は `NotificationCenter` 側に残り続け、
    /// `[weak self]` を付けてもトークンとクロージャは解放されない。
    /// `configureSession` は再生のたびに呼ばれるので、捨てると1回につき3個ずつ溜まる。
    private var observers: [NSObjectProtocol] = []

    private func observeLifecycle(_ session: AVAudioSession) {
        let center = NotificationCenter.default

        let interruption = center.addObserver(
            forName: AVAudioSession.interruptionNotification, object: session, queue: .main
        ) { [weak self] note in
            guard
                let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                let type = AVAudioSession.InterruptionType(rawValue: raw)
            else { return }

            let options = (note.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt)
                .map(AVAudioSession.InterruptionOptions.init(rawValue:)) ?? []

            let phase: InterruptionPhase =
                type == .began
                ? .began
                : .ended(systemSuggestsResume: options.contains(.shouldResume))

            self?.apply(LifecyclePolicy.onInterruption(phase))
        }

        let routeChange = center.addObserver(
            forName: AVAudioSession.routeChangeNotification, object: session, queue: .main
        ) { [weak self] note in
            let raw = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt
            let reason = AVAudioSession.RouteChangeReason(rawValue: raw ?? 0)
            self?.apply(LifecyclePolicy.onRouteChange(Self.translate(reason)))
        }

        observers.append(contentsOf: [interruption, routeChange])
    }

    /// 登録した通知をすべて解除する。**停止時と破棄時の両方で呼ぶ。**
    private func removeObservers() {
        let center = NotificationCenter.default
        for observer in observers { center.removeObserver(observer) }
        observers.removeAll()
    }

    deinit {
        removeObservers()
    }

    /// AVFoundation の理由を `ClavesEngine` の型へ移す。
    /// **`ClavesEngine` に AVFoundation を持ち込まないための変換点。**
    private static func translate(_ reason: AVAudioSession.RouteChangeReason?) -> RouteChangeReason {
        switch reason {
        case .oldDeviceUnavailable: .oldDeviceUnavailable
        case .newDeviceAvailable: .newDeviceAvailable
        case .categoryChange: .categoryChange
        case .override: .override
        case .wakeFromSleep: .wakeFromSleep
        case .noSuitableRouteForCategory: .noSuitableRouteForCategory
        case .routeConfigurationChange: .routeConfigurationChange
        default: .unknown
        }
    }

    private func apply(_ command: PlaybackCommand) {
        // **`engine.isRunning` で判定してはいけない。** 経路変更の最中は false になり、
        // イヤホン抜去で止めるべき場面を取りこぼす
        guard command == .stop, isPlaying else { return }
        stop()
        onStoppedByPolicy?()
    }

    // MARK: - 開始と停止

    /// 繋ぎ直すときに使い回す。経路が変わっても再生位置は保つ
    private lazy var format = AVAudioFormat(
        commonFormat: .pcmFormatFloat32,
        sampleRate: sampleRate,
        channels: 1,
        interleaved: false
    )!

    /// **「鳴らすつもりでいるか」。`engine.isRunning` とは別物。**
    ///
    /// 経路が変わると `AVAudioEngine` は一時的に止まる。
    /// `isRunning` だけで判断すると、繋ぎ直している最中に
    /// 「停止中」と見なされて画面と食い違う。
    private(set) var isPlaying = false

    func start() throws {
        guard sourceNode == nil else { return }

        let node = AVAudioSourceNode { [weak self] _, _, frameCount, audioBufferList -> OSStatus in
            guard let self else { return noErr }
            return self.render(frameCount: Int(frameCount), into: audioBufferList)
        }

        engine.attach(node)
        engine.connect(node, to: engine.mainMixerNode, format: format)
        sourceNode = node

        observeConfigurationChange()
        try engine.start()
        isPlaying = true
    }

    /// **イヤホンを挿すなど出力経路が変わると、`AVAudioEngine` の接続が無効になって止まる。**
    /// 止まったことは `isRunning` にしか出ないので、画面上は再生中のまま無音になる。
    /// 繋ぎ直して再開する。
    ///
    /// `currentFrame` は自前の数えなので、繋ぎ直しても**再生位置は続きから**になる。
    private func observeConfigurationChange() {
        let token = NotificationCenter.default.addObserver(
            forName: .AVAudioEngineConfigurationChange, object: engine, queue: .main
        ) { [weak self] _ in
            self?.reconnectAfterConfigurationChange()
        }
        observers.append(token)
    }

    private func reconnectAfterConfigurationChange() {
        // 止めたあとなら何もしない（停止中に経路が変わっても鳴らし始めない）
        guard isPlaying, let node = sourceNode else { return }

        engine.disconnectNodeOutput(node)
        engine.connect(node, to: engine.mainMixerNode, format: format)

        guard !engine.isRunning else { return }
        do {
            try engine.start()
        } catch {
            // 繋ぎ直せなければ、鳴っているつもりのまま無音になるより止めたほうがいい
            stop()
            onStoppedByPolicy?()
        }
    }

    func stop() {
        isPlaying = false
        // **止めたら通知の購読も畳む。** 残しておくと、鳴っていないエンジンが
        // 割り込みや経路変更に反応し続ける
        removeObservers()
        engine.stop()
        if let sourceNode {
            engine.detach(sourceNode)
            self.sourceNode = nil
        }
    }

    // MARK: - UI スレッドからの操作

    /// パターンやテンポの切替を予約する。
    ///
    /// **境界は「予約済みの範囲より後にある最初の拍境界」に置く。**
    /// これにより予約済みの音を取り消す必要がなくなり、
    /// 二重発音と打点欠落が構造的に起こらない。
    ///
    /// **境界の計算はここでしない。** 境界は `currentFrame` と `lastScheduledTick`
    /// から決まるが、どちらもオーディオスレッドが書き換える。ここで読むと競合するうえ、
    /// 読んでから予約が取り込まれるまでの間に再生位置が進み、
    /// **すでに鳴らした位置に境界を置いてしまう**（打点が飛ぶ）。
    /// 計画と拍の単位だけ渡し、切替点はオーディオスレッドに決めさせる。
    func requestChange(to plan: TransportPlan, bpmUnit: Int) {
        os_unfair_lock_lock(&lock)
        pendingPlan = (plan, bpmUnit)
        os_unfair_lock_unlock(&lock)
    }

    func setVolume(_ value: Float) {
        // **非数を先に弾く。** `min` / `max` は NaN との比較が全て false になるため、
        // `max(0, min(1, .nan))` は 0 でも NaN でもなく **1.0（最大音量）**を返す
        guard value.isFinite else { return }
        os_unfair_lock_lock(&lock)
        pendingVolume = max(0, min(1, value))
        os_unfair_lock_unlock(&lock)
    }

    // MARK: - レンダー

    private func render(frameCount: Int, into audioBufferList: UnsafeMutablePointer<AudioBufferList>)
        -> OSStatus
    {
        // 予約の取り込みと再生位置の公開を1回のロックで済ませる。
        // **取れなければ諦めて次の回に回す。**
        // ここで待つとオーディオの締め切りを落として音が途切れる
        var change: (plan: TransportPlan, bpmUnit: Int)?
        if os_unfair_lock_trylock(&lock) {
            publishedTick = renderedTick
            change = pendingPlan
            pendingPlan = nil
            if let value = pendingVolume {
                volume = value
                pendingVolume = nil
            }
            os_unfair_lock_unlock(&lock)
        }

        // 切替点はここで決める。**この計算が読む値はすべてこのスレッドの持ち物**
        if let change {
            let nowTick = renderer.plan.tick(atSeconds: Double(currentFrame) / sampleRate)
            let boundary = TransportPlan.nextBoundaryTick(
                bpmUnit: change.bpmUnit,
                lastScheduledTick: lastScheduledTick,
                nowTick: nowTick
            )
            renderer.apply(change.plan, atTick: boundary)
        }

        let buffers = UnsafeMutableAudioBufferListPointer(audioBufferList)

        // **要求が使い回しバッファより大きいことがある。**
        // 以前は入らないぶんを無音で埋めたうえ、時計はバッファ長しか進めていなかった。
        // 出した音と再生位置がずれるので、**分けて全部埋める**。
        //
        // **使い回しバッファの長さぶんずつ渡す。** 一度に長く進めると
        // 40ms のクリックが1回で消費し尽くされ、音が途中でぶつ切りになる
        var written = 0
        while written < frameCount {
            let count = min(frameCount - written, scratch.count)

            let hitCount = renderer.hits(
                from: currentFrame, frameCount: count, into: &hitBuffer)
            if hitCount > 0 {
                let lastOffset = Int64(hitBuffer[hitCount - 1].frameOffset)
                lastScheduledTick = Int(
                    renderer.plan.tick(
                        atSeconds: Double(currentFrame + lastOffset) / sampleRate)
                )
            }

            mixer.fill(&scratch, count: count, hits: hitBuffer, hitCount: hitCount)

            for buffer in buffers {
                guard let destination = buffer.mData?.assumingMemoryBound(to: Float.self)
                else { continue }
                for frame in 0..<count {
                    // **最後に振り幅を切る。** 重なった打点は足し合わせるので、
                    // 密な計画では合計が ±1 を超えうる。超えたまま出すと
                    // 後段で歪んだ持続音になる。
                    // 検証層を通った計画では届かない値で、**保険として置く**
                    let sample = scratch[frame] * volume
                    destination[written + frame] = max(-1, min(1, sample))
                }
            }

            currentFrame += Int64(count)
            written += count
        }

        // 公開するのは次の回。ここでロックを取ると、取れなかったときに
        // 位置が止まって見える。**この値はこのスレッドの持ち物のまま置いておく**
        renderedTick = renderer.tick(atFrame: currentFrame)
        return noErr
    }

    /// 画面に見せる再生状態。
    ///
    /// **`engine.isRunning` をそのまま返してはいけない。**
    /// 経路変更の最中は false になり、繋ぎ直している一瞬だけ
    /// 画面が「停止中」に見えてしまう。
    var isRunning: Bool { isPlaying }
}
