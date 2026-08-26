import Foundation

/// JS から届く JSON を再生計画に変換する**唯一の入口**。
///
/// 検証層があっても、通さない経路が残っていれば意味がない。
/// デコードと検証をここで一緒に行い、**検証を通ったものしか外に出さない**。
///
/// JSON の形は `src/domain/transport.ts` の `TransportPlan` と同じ。
public enum PlanDecoder {

    /// 契約のバージョン。JS 側の `schemaVersion` と一致していなければ受け付けない
    public static let schemaVersion = 1
    /// 4分音符の tick 数。ここが違うと tick の意味そのものが変わる
    public static let ppq = 96

    private struct Wire: Decodable {
        let schemaVersion: Int
        let ppq: Int
        let bpmUnit: Int
        let cycleTicks: Int
        let bpm: Double
        let originTick: Int
        let originSeconds: Double
        let events: [Event]

        struct Event: Decodable {
            let tick: Int
            let pitch: String
        }
    }

    public static func decode(_ data: Data) throws -> TransportPlan {
        let wire = try JSONDecoder().decode(Wire.self, from: data)

        guard wire.schemaVersion == schemaVersion else {
            throw PlanValidationError.unsupportedSchemaVersion(wire.schemaVersion)
        }
        guard wire.ppq == ppq else {
            throw PlanValidationError.unsupportedPPQ(wire.ppq)
        }
        // 上限を超える数を先に弾く。中身を1件ずつ見る前に打ち切る
        guard wire.events.count <= PlanValidator.maxEvents else {
            throw PlanValidationError.tooManyEvents(wire.events.count)
        }

        var events: [TransportPlan.Event] = []
        events.reserveCapacity(wire.events.count)
        for event in wire.events {
            guard let pitch = Pitch(rawValue: event.pitch) else {
                throw PlanValidationError.unknownPitch(event.pitch)
            }
            events.append(TransportPlan.Event(tick: event.tick, pitch: pitch))
        }

        let plan = TransportPlan(
            bpmUnit: wire.bpmUnit,
            cycleTicks: wire.cycleTicks,
            bpm: wire.bpm,
            originTick: wire.originTick,
            originSeconds: wire.originSeconds,
            events: events
        )

        try PlanValidator.validate(plan)
        return plan
    }
}
