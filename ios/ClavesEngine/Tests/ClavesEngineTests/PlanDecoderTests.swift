import Foundation
import Testing
@testable import ClavesEngine

/// JS から届く JSON を再生計画に変換する境界。
///
/// **ここが唯一の入口。** 検証層があっても、通さない経路が残っていれば意味がない。
/// デコードと検証を同じ場所で行い、**検証を通ったものしか作れない**ようにする。
///
/// 壊れた JSON でクラッシュしないことも要件。JS 側は自分たちのコードだが、
/// WebView に読み込まれるものは書き換えられうる。
@Suite("JSON から再生計画へ")
struct PlanDecoderTests {

    static func json(
        schemaVersion: Int = 1,
        ppq: Int = 96,
        bpmUnit: Int = 192,
        cycleTicks: Int = 768,
        bpm: String = "120",
        events: String = #"[{"tick":0,"pitch":"high"},{"tick":144,"pitch":"low"}]"#
    ) -> Data {
        """
        {"schemaVersion":\(schemaVersion),"ppq":\(ppq),"bpmUnit":\(bpmUnit),
         "cycleTicks":\(cycleTicks),"bpm":\(bpm),"originTick":0,"originSeconds":0,
         "events":\(events)}
        """.data(using: .utf8)!
    }

    @Test("まっとうな JSON は計画になる")
    func decodesValidJSON() throws {
        let plan = try PlanDecoder.decode(Self.json())

        #expect(plan.bpm == 120)
        #expect(plan.bpmUnit == 192)
        #expect(plan.cycleTicks == 768)
        #expect(plan.events.count == 2)
        #expect(plan.events[0].pitch == .high)
        #expect(plan.events[1].pitch == .low)
    }

    /// 契約が変わったのに古い JS が動いている、という状況を素通りさせない
    @Test("schemaVersion が違えば弾く")
    func rejectsWrongSchemaVersion() {
        #expect(throws: PlanValidationError.unsupportedSchemaVersion(2)) {
            _ = try PlanDecoder.decode(Self.json(schemaVersion: 2))
        }
    }

    /// PPQ は 96 固定。ここが違うと tick の意味そのものが変わる
    @Test("ppq が 96 でなければ弾く")
    func rejectsWrongPPQ() {
        #expect(throws: PlanValidationError.unsupportedPPQ(480)) {
            _ = try PlanDecoder.decode(Self.json(ppq: 480))
        }
    }

    /// 知らない音色で落ちてはいけない
    @Test("知らない音色は弾く（クラッシュしない）")
    func rejectsUnknownPitch() {
        #expect(throws: PlanValidationError.unknownPitch("sparkle")) {
            _ = try PlanDecoder.decode(
                Self.json(events: #"[{"tick":0,"pitch":"sparkle"}]"#))
        }
    }

    /// **デコードできても検証を通らない値がある。**
    /// ここを素通りさせるとオーディオスレッドが無限ループする
    @Test("形は正しくても危険な値は弾く")
    func rejectsStructurallyValidButDangerousValues() {
        #expect(throws: PlanValidationError.invalidCycleTicks(0)) {
            _ = try PlanDecoder.decode(Self.json(cycleTicks: 0))
        }
        #expect(throws: PlanValidationError.self) {
            _ = try PlanDecoder.decode(Self.json(bpm: "1e18"))
        }
    }

    @Test("壊れた JSON でクラッシュしない")
    func doesNotCrashOnGarbage() {
        #expect(throws: (any Error).self) {
            _ = try PlanDecoder.decode(Data("{{{".utf8))
        }
        #expect(throws: (any Error).self) {
            _ = try PlanDecoder.decode(Data())
        }
    }

    /// 上限を超える打点数を投げつけられても、
    /// 配列を確保しきる前か直後に弾いて処理を止める
    @Test("打点が多すぎる JSON は弾く")
    func rejectsFloodOfEvents() {
        let flood = (0..<(PlanValidator.maxEvents + 10))
            .map { #"{"tick":\#($0),"pitch":"high"}"# }
            .joined(separator: ",")

        #expect(throws: PlanValidationError.self) {
            _ = try PlanDecoder.decode(
                Self.json(cycleTicks: 100_000, events: "[\(flood)]"))
        }
    }
}
