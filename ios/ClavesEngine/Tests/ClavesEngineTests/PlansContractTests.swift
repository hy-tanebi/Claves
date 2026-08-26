import Foundation
import Testing
@testable import ClavesEngine

/// **JS が出す計画を Swift が受け取れるかの契約。**
///
/// JS 側の出口は `buildPlan`、Swift 側の入口は `PlanDecoder`。
/// ここが食い違うと、実行時に無言で弾かれて音が鳴らない。
///
/// 検証ルールを TS 側に書き写すと二重管理になって必ずずれるので、
/// **JS に実物の計画を書き出させて（`golden/plans.json`）、それを読む。**
/// 収録リズムが増えたり譜面が変わったりして
/// ネイティブが受け付けない形になれば、ここが落ちる。
@Suite("JS が出す計画の受理")
struct PlansContractTests {

    static var plansURL: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()  // ClavesEngineTests
            .deletingLastPathComponent()  // Tests
            .deletingLastPathComponent()  // ClavesEngine
            .deletingLastPathComponent()  // ios
            .deletingLastPathComponent()  // リポジトリのルート
            .appendingPathComponent("golden/plans.json")
    }

    struct Fixture: Decodable {
        let schemaVersion: Int
        let plans: [Entry]

        struct Entry: Decodable {
            let name: String
            /// `PlanDecoder` は Data を受け取るので、生の JSON のまま持っておく
            let plan: JSONValue
        }
    }

    /// 中身を解釈せずに再エンコードするための入れ物。
    /// **Swift 側で型を決め打つと、そこが二重管理になる**ので素通しする
    enum JSONValue: Decodable {
        case object([String: JSONValue])
        case array([JSONValue])
        case string(String)
        case number(Double)
        case bool(Bool)
        case null

        init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            if container.decodeNil() {
                self = .null
            } else if let value = try? container.decode([String: JSONValue].self) {
                self = .object(value)
            } else if let value = try? container.decode([JSONValue].self) {
                self = .array(value)
            } else if let value = try? container.decode(Bool.self) {
                self = .bool(value)
            } else if let value = try? container.decode(Double.self) {
                self = .number(value)
            } else {
                self = .string(try container.decode(String.self))
            }
        }

        var raw: Any {
            switch self {
            case .object(let value): value.mapValues(\.raw)
            case .array(let value): value.map(\.raw)
            case .string(let value): value
            case .number(let value): value
            case .bool(let value): value
            case .null: NSNull()
            }
        }
    }

    @Test("JS が出す計画をすべて受理できる")
    func acceptsEveryPlanFromJS() throws {
        let data = try Data(contentsOf: Self.plansURL)
        let fixture = try JSONDecoder().decode(Fixture.self, from: data)

        #expect(fixture.schemaVersion == 1)
        #expect(!fixture.plans.isEmpty)

        for entry in fixture.plans {
            let json = try JSONSerialization.data(withJSONObject: entry.plan.raw)
            #expect(throws: Never.self, "\(entry.name) が弾かれた") {
                _ = try PlanDecoder.decode(json)
            }
        }
    }

    /// 受理できるだけでなく、値が素通しされていることも確かめる。
    /// 全部 0 に潰れていても「弾かれなかった」だけは成立してしまう
    @Test("受理した計画の中身が JS 側と一致する")
    func decodedValuesMatchJS() throws {
        let data = try Data(contentsOf: Self.plansURL)
        let fixture = try JSONDecoder().decode(Fixture.self, from: data)

        let first = try #require(fixture.plans.first)
        let json = try JSONSerialization.data(withJSONObject: first.plan.raw)
        let plan = try PlanDecoder.decode(json)

        guard case .object(let fields) = first.plan else {
            Issue.record("計画が JSON オブジェクトではない")
            return
        }
        guard case .number(let bpm) = fields["bpm"],
            case .number(let cycleTicks) = fields["cycleTicks"],
            case .array(let events) = fields["events"]
        else {
            Issue.record("計画に必要な項目がない")
            return
        }

        #expect(plan.bpm == bpm)
        #expect(plan.cycleTicks == Int(cycleTicks))
        #expect(plan.events.count == events.count)
    }
}
