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
@objc(ClavesAudioPlugin)
public class ClavesAudioPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "ClavesAudioPlugin"
    public let jsName = "ClavesAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(#selector(start), returnType: .promise),
        CAPPluginMethod(#selector(stop), returnType: .promise),
        CAPPluginMethod(#selector(applyPlan), returnType: .promise),
        CAPPluginMethod(#selector(setVolume), returnType: .promise),
    ]

    private var engine: ClavesAudioEngine?

    // MARK: - メソッド

    @objc func start(_ call: CAPPluginCall) {
        do {
            let plan = try decodePlan(from: call)

            let engine = ClavesAudioEngine(plan: plan)
            try engine.configureSession()
            try engine.start()
            self.engine = engine

            call.resolve()
        } catch {
            call.reject(Self.message(for: error), nil, error)
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        engine?.stop()
        engine = nil
        call.resolve()
    }

    @objc func applyPlan(_ call: CAPPluginCall) {
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

    @objc func setVolume(_ call: CAPPluginCall) {
        guard let value = call.getDouble("value") else {
            call.reject("value が必要です（0〜1）")
            return
        }
        engine?.setVolume(Float(value))
        call.resolve()
    }

    // MARK: - 補助

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
