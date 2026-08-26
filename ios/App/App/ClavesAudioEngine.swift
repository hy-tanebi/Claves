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

    // MARK: - オーディオスレッドが触る状態

    /// レンダーコールバックは**リアルタイムスレッド**で走る。
    /// ここでメモリ確保・ロック待ち・システムコールをすると音が途切れる。
    private var renderer: TransportRenderer
    private var mixer: ClickMixer
    private var currentFrame: Int64 = 0
    /// バッファはコールバックごとに確保せず、最大長ぶんを使い回す
    private var scratch: [Float]

    // MARK: - 別スレッドからの受け渡し

    /// UI スレッドが置いた切替の予約。
    /// **オーディオスレッドは待たない**（`trylock` で取れなければ次の回に回す）。
    private var lock = os_unfair_lock_s()
    private var pendingPlan: (plan: TransportPlan, atTick: Int)?
    private var pendingVolume: Float?
    private var volume: Float = 1.0

    /// 予約済みの最後の tick。境界計算に使う
    private var lastScheduledTick: Int = 0

    /// いま鳴らしている位置（絶対 tick）。譜面のハイライトに使う。
    ///
    /// **`renderer` を UI スレッドから直接読んではいけない。**
    /// オーディオスレッドが書き換える構造体なのでデータ競合になる。
    /// 代わりにオーディオスレッド側がこの値を書き出し、UI はこれだけを読む。
    /// 8バイトの整列した読み書きなので分断されず、
    /// 1バッファぶん古い値になってもハイライトの見た目に影響はない。
    private(set) var playheadTick: Double = 0

    init(plan: TransportPlan, sampleRate: Double = 48000, maxFrames: Int = 4096) {
        self.sampleRate = sampleRate
        self.renderer = TransportRenderer(plan: plan, sampleRate: sampleRate)
        self.mixer = ClickMixer(sampleRate: sampleRate)
        self.scratch = [Float](repeating: 0, count: maxFrames)
    }

    // MARK: - セッション

    /// 決定済みの仕様に合わせる:
    /// 他アプリと混ぜない（`.playback` を単独で使う）／
    /// サイレントスイッチでも鳴る（`.playback` の性質）。
    ///
    /// 割り込み後の自動再開とイヤホン抜去での停止は P3 で扱う。
    func configureSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playback, mode: .default, options: [])
        try session.setActive(true)
    }

    // MARK: - 開始と停止

    func start() throws {
        guard sourceNode == nil else { return }

        let format = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: sampleRate,
            channels: 1,
            interleaved: false
        )!

        let node = AVAudioSourceNode { [weak self] _, _, frameCount, audioBufferList -> OSStatus in
            guard let self else { return noErr }
            return self.render(frameCount: Int(frameCount), into: audioBufferList)
        }

        engine.attach(node)
        engine.connect(node, to: engine.mainMixerNode, format: format)
        sourceNode = node

        try engine.start()
    }

    func stop() {
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
    func requestChange(to plan: TransportPlan, bpmUnit: Int) {
        os_unfair_lock_lock(&lock)
        let nowTick = renderer.plan.tick(atSeconds: Double(currentFrame) / sampleRate)
        let boundary = TransportPlan.nextBoundaryTick(
            bpmUnit: bpmUnit,
            lastScheduledTick: lastScheduledTick,
            nowTick: nowTick
        )
        pendingPlan = (plan, boundary)
        os_unfair_lock_unlock(&lock)
    }

    func setVolume(_ value: Float) {
        os_unfair_lock_lock(&lock)
        pendingVolume = max(0, min(1, value))
        os_unfair_lock_unlock(&lock)
    }

    // MARK: - レンダー

    private func render(frameCount: Int, into audioBufferList: UnsafeMutablePointer<AudioBufferList>)
        -> OSStatus
    {
        // UI スレッドの予約を取り込む。**取れなければ諦めて次の回に回す。**
        // ここで待つとオーディオの締め切りを落として音が途切れる
        if os_unfair_lock_trylock(&lock) {
            if let pending = pendingPlan {
                renderer.apply(pending.plan, atTick: pending.atTick)
                pendingPlan = nil
            }
            if let value = pendingVolume {
                volume = value
                pendingVolume = nil
            }
            os_unfair_lock_unlock(&lock)
        }

        let count = min(frameCount, scratch.count)
        let hits = renderer.hits(from: currentFrame, frameCount: count)
        if let last = hits.last {
            lastScheduledTick = Int(
                renderer.plan.tick(atSeconds: Double(currentFrame + Int64(last.frameOffset)) / sampleRate)
            )
        }

        mixer.fill(&scratch, hits: hits)

        let buffers = UnsafeMutableAudioBufferListPointer(audioBufferList)
        for buffer in buffers {
            guard let destination = buffer.mData?.assumingMemoryBound(to: Float.self) else { continue }
            for frame in 0..<count {
                destination[frame] = scratch[frame] * volume
            }
        }

        currentFrame += Int64(count)
        // UI が読む再生位置をここで書き出す（UI から renderer を触らせないため）
        playheadTick = renderer.tick(atFrame: currentFrame)
        return noErr
    }

    /// 再生中かどうか。停止後にハイライトを止めるために使う
    var isRunning: Bool { engine.isRunning }
}
