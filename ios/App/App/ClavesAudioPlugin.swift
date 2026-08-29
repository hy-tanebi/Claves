import Capacitor
import ClavesEngine
import Foundation

/// JS から再生エンジンを呼ぶための橋。
///
/// **計画は JSON 文字列で受け取る。** `PlanDecoder` が `Data` を取るので、
/// Capacitor の `JSObject` から Foundation の型へ詰め替える工程を挟まずに済む。
/// 詰め替えを挟むと、そこが `golden/plans.json` の検査から外れた第2の経路になり、
/// 「テストは通るのに実機で弾かれる」が起きうる。
///
/// **弾いたときは必ず `reject` で JS に返す。** 黙って無音になると原因が分からない。
///
/// **このクラスの状態は main キューの上でだけ触る。**
/// Capacitor はプラグインの呼び出しを専用のバックグラウンドキュー
/// （`CapacitorBridge` の `DispatchQueue(label: "bridge")`）で実行する。
/// 一方で割り込み通知とロック画面の操作は main で届く。
/// `engine` / `lastPlan` / `title` はその両方から触られるため、
/// 寄せ先を決めないとデータ競合になる。
/// `MPNowPlayingInfoCenter` も main から触るのが前提なので、寄せ先は main にする。
@objc(ClavesAudioPlugin)
public class ClavesAudioPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "ClavesAudioPlugin"
    public let jsName = "ClavesAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(#selector(start), returnType: .promise),
        CAPPluginMethod(#selector(stop), returnType: .promise),
        CAPPluginMethod(#selector(applyPlan), returnType: .promise),
        CAPPluginMethod(#selector(setVolume), returnType: .promise),
        CAPPluginMethod(#selector(getSnapshot), returnType: .promise),
    ]

    private var engine: ClavesAudioEngine?

    /// ロック画面に出す名前と、直前に鳴らした計画。
    /// 再生ボタンから鳴らし直すために覚えておく
    private var lastPlan: TransportPlan?
    private var title = "Claves"

    // MARK: - キューの寄せ先

    /// **プラグインの状態に触る処理はすべてここを通す。**
    /// すでに main にいるなら積まずにそのまま実行する
    /// （ロック画面の操作が1フレーム遅れないようにする）。
    private func onControlQueue(_ work: @escaping () -> Void) {
        if Thread.isMainThread {
            work()
        } else {
            DispatchQueue.main.async(execute: work)
        }
    }

    // MARK: - メソッド

    @objc func start(_ call: CAPPluginCall) {
        onControlQueue { [self] in
            do {
                let plan = try decodePlan(from: call)
                title = Self.clampedTitle(call.getString("title"))
                try startEngine(with: plan)
                call.resolve()
            } catch {
                call.reject(Self.message(for: error), nil, error)
            }
        }
    }

    private func startEngine(with plan: TransportPlan) throws {
        // **すでに鳴っているなら、畳んでから始める。**
        // PLAY を素早く二度押すと、JS が再生中と知る前に start が二度届きうる。
        // 参照を上書きするだけだと、前のエンジンは止められないまま参照を失い、
        // 破棄されるまでの間だけ音が二重に鳴る。
        if let running = self.engine {
            running.stop()
            self.engine = nil
        }

        let engine = ClavesAudioEngine(plan: plan)
        try engine.configureSession()

        // 割り込みやイヤホン抜去で止まったら JS に伝える。
        // **伝えないと画面のボタンが「再生中」のまま残る**
        engine.onStoppedByPolicy = { [weak self] in
            self?.handleStoppedByPolicy()
        }

        try engine.start()
        self.engine = engine
        self.lastPlan = plan

        NowPlaying.enableRemoteControls(
            onPlay: { [weak self] in self?.resumeFromRemote() },
            onStop: { [weak self] in self?.stopFromRemote() }
        )
        NowPlaying.update(title: title, bpm: plan.bpm, isPlaying: true)
    }

    @objc func stop(_ call: CAPPluginCall) {
        onControlQueue { [self] in
            stopEngine()
            call.resolve()
        }
    }

    private func stopEngine() {
        engine?.stop()
        engine = nil
        NowPlaying.clear()
    }

    // MARK: - 自分の意思でない停止・再開

    /// 割り込みやイヤホン抜去で止まったとき。
    /// **ロック画面の表示も止まった状態にする**（鳴っていないのに再生中と出ると混乱する）
    private func handleStoppedByPolicy() {
        onControlQueue { [self] in
            engine = nil
            if let plan = lastPlan {
                NowPlaying.update(title: title, bpm: plan.bpm, isPlaying: false)
            }
            notifyListeners("playbackStopped", data: [:])
        }
    }

    /// ロック画面の再生ボタン。**画面を開かずに鳴らし直せるようにする**
    ///
    /// **`MPRemoteCommandCenter` はどのスレッドで呼ぶか保証しない。**
    /// ここも寄せ先を通す
    private func resumeFromRemote() {
        onControlQueue { [self] in
            guard engine == nil, let plan = lastPlan else { return }
            try? startEngine(with: plan)
            notifyListeners("playbackStarted", data: [:])
        }
    }

    private func stopFromRemote() {
        onControlQueue { [self] in
            guard engine != nil else { return }
            stopEngine()
            notifyListeners("playbackStopped", data: [:])
        }
    }

    @objc func applyPlan(_ call: CAPPluginCall) {
        onControlQueue { [self] in
            guard let engine else {
                call.reject("再生が始まっていません。先に start を呼んでください")
                return
            }
            do {
                let plan = try decodePlan(from: call)
                engine.requestChange(to: plan, bpmUnit: plan.bpmUnit)
                call.resolve()
            } catch {
                call.reject(Self.message(for: error), nil, error)
            }
        }
    }

    @objc func setVolume(_ call: CAPPluginCall) {
        onControlQueue { [self] in
            guard let value = call.getDouble("value") else {
                call.reject("value が必要です（0〜1）")
                return
            }
            engine?.setVolume(Float(value))
            call.resolve()
        }
    }

    /// いま鳴らしている位置を返す。譜面のハイライトに使う。
    ///
    /// **ネイティブが時計を持つ以上、再生位置もネイティブに聞くしかない。**
    /// JS 側で別に数えると必ずずれる。
    @objc func getSnapshot(_ call: CAPPluginCall) {
        onControlQueue { [self] in
            guard let engine else {
                call.resolve(["tick": 0, "isPlaying": false])
                return
            }
            call.resolve([
                "tick": engine.playheadTick,
                "isPlaying": engine.isRunning,
            ])
        }
    }

    // MARK: - 補助

    /// ロック画面に出す名前の最大長。
    /// 表示にしか使わないが、**際限なく受け取る理由がない**
    static let maxTitleLength = 128

    private static func clampedTitle(_ title: String?) -> String {
        guard let title, !title.isEmpty else { return "Claves" }
        return String(title.prefix(maxTitleLength))
    }

    private func decodePlan(from call: CAPPluginCall) throws -> TransportPlan {
        guard let json = call.getString("planJson") else {
            throw PluginError.missingPlan
        }
        return try PlanDecoder.decode(Data(json.utf8))
    }

    enum PluginError: Error {
        case missingPlan
    }

    /// **なぜ弾かれたのかを JS 側で読めるようにする。**
    /// 「音が鳴らない」だけでは原因を追えない
    static func message(for error: Error) -> String {
        switch error {
        case PluginError.missingPlan:
            return "planJson が必要です"
        case let error as PlanValidationError:
            return "再生計画が不正です: \(error)"
        default:
            return "再生を開始できません: \(error)"
        }
    }
}
