import Foundation
import Testing
@testable import ClavesEngine

/// **JS と Swift の答え合わせ。**
///
/// 再生クロックをネイティブが持つ以上、tick → 時刻の式が2言語に存在してしまう。
/// 片方だけ直して黙ってずれるのを防ぐため、JS が書き出した
/// `golden/transport.json` を Swift 側でも読んで同じ答えになるか突き合わせる。
///
/// **fixture はコピーしない。** リポジトリの実ファイルを読む。
/// コピーすると二重管理になり、JS 側を更新したときに検出できなくなる。
@Suite("golden fixture との突き合わせ")
struct TransportGoldenTests {

    // MARK: - fixture の読み込み

    /// `<リポジトリ>/golden/transport.json`。
    /// このファイルは `ios/ClavesEngine/Tests/ClavesEngineTests/` にあるので5階層上がる。
    static var goldenURL: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()  // ClavesEngineTests
            .deletingLastPathComponent()  // Tests
            .deletingLastPathComponent()  // ClavesEngine
            .deletingLastPathComponent()  // ios
            .deletingLastPathComponent()  // リポジトリのルート
            .appendingPathComponent("golden/transport.json")
    }

    struct Golden: Decodable {
        let schemaVersion: Int
        let scenarios: [Scenario]
    }

    struct Scenario: Decodable {
        let name: String
        let kind: String
        let plan: PlanJSON?
        let expected: [ExpectedJSON]?
        let applyAtTick: Int?
        let before: Side?
        let after: Side?

        struct Side: Decodable {
            let plan: PlanJSON
            let expected: [ExpectedJSON]
        }
    }

    struct PlanJSON: Decodable {
        let ppq: Int
        let bpmUnit: Int
        let cycleTicks: Int
        let bpm: Double
        let originTick: Int
        let originSeconds: Double
        let events: [EventJSON]

        struct EventJSON: Decodable {
            let tick: Int
            let pitch: String
        }

        var asPlan: TransportPlan {
            TransportPlan(
                bpmUnit: bpmUnit,
                cycleTicks: cycleTicks,
                bpm: bpm,
                originTick: originTick,
                originSeconds: originSeconds,
                events: events.map {
                    TransportPlan.Event(tick: $0.tick, pitch: Pitch(rawValue: $0.pitch)!)
                }
            )
        }
    }

    struct ExpectedJSON: Decodable {
        let absTick: Int
        let seconds: Double
        let pitch: String
    }

    /// fixture の `note` にある通り、**秒は小数9桁に丸めた値を契約とする**。
    /// 2言語の浮動小数の丸め差をここで吸収する。
    static func rounded(_ value: Double) -> Double {
        (value * 1e9).rounded() / 1e9
    }

    static func load() throws -> Golden {
        let data = try Data(contentsOf: goldenURL)
        return try JSONDecoder().decode(Golden.self, from: data)
    }

    // MARK: - 突き合わせ

    @Test("fixture が読める")
    func fixtureLoads() throws {
        let golden = try Self.load()
        #expect(golden.schemaVersion == 1)
        #expect(golden.scenarios.count == 16)
    }

    @Test("全シナリオで JS と同じ absTick・秒・音色になる")
    func allScenariosMatchJS() throws {
        let golden = try Self.load()

        for scenario in golden.scenarios {
            switch scenario.kind {
            case "steady":
                let plan = try #require(scenario.plan).asPlan
                let expected = try #require(scenario.expected)
                Self.verify(plan: plan, expected: expected, label: scenario.name)

            case "switch":
                let before = try #require(scenario.before)
                let after = try #require(scenario.after)
                Self.verify(
                    plan: before.plan.asPlan, expected: before.expected,
                    label: "\(scenario.name)（切替前）")
                Self.verify(
                    plan: after.plan.asPlan, expected: after.expected,
                    label: "\(scenario.name)（切替後）")

            default:
                Issue.record("未知のシナリオ種別: \(scenario.kind)")
            }
        }
    }

    /// **検証層が厳しすぎないことの確認。**
    ///
    /// 上限や許容値を絞りすぎると、壊れた入力ではなく
    /// **実際に収録しているリズムを弾いてしまう**。
    /// 5リズム × 3テンポ（40 / 120 / 240）と切替の全ケースが通ることを固定する。
    @Test("収録している全リズム・全テンポが検証を通る")
    func realRhythmsPassValidation() throws {
        let golden = try Self.load()

        for scenario in golden.scenarios {
            if let plan = scenario.plan {
                #expect(throws: Never.self, "\(scenario.name) が弾かれた") {
                    try PlanValidator.validate(plan.asPlan)
                }
            }
            if let before = scenario.before, let after = scenario.after {
                #expect(throws: Never.self, "\(scenario.name)（切替前）が弾かれた") {
                    try PlanValidator.validate(before.plan.asPlan)
                }
                #expect(throws: Never.self, "\(scenario.name)（切替後）が弾かれた") {
                    try PlanValidator.validate(after.plan.asPlan)
                }
            }
        }
    }

    static func verify(plan: TransportPlan, expected: [ExpectedJSON], label: String) {
        for (index, want) in expected.enumerated() {
            let got = plan.event(at: index)
            #expect(
                got.absTick == want.absTick,
                "\(label) の \(index) 番目: absTick が \(want.absTick) ではなく \(got.absTick)")
            #expect(
                rounded(got.seconds) == rounded(want.seconds),
                "\(label) の \(index) 番目: 秒が \(want.seconds) ではなく \(got.seconds)")
            #expect(
                got.pitch.rawValue == want.pitch,
                "\(label) の \(index) 番目: 音色が \(want.pitch) ではなく \(got.pitch.rawValue)")
        }
    }
}
