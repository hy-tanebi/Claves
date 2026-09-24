import Foundation

/// 収録している音色。**増やすときは JS 側 `src/audio/bell.ts` の `Timbre` も同時に足す。**
/// `golden/click.json` は音色ごとに書き出されるので、片方だけ足すとテストが落ちる。
public enum Timbre: String, Sendable, Codable, CaseIterable {
    case agogo
    case claves
}

/// 打点の音。**JS 側 `src/audio/bell.ts` と同じ式でなければならない。**
///
/// ブラウザは Web Audio、iOS はここが鳴らすので、音を作る式が2言語に存在する。
/// 片方だけ変えると「ブラウザと iOS で音が違う」が黙って起きるため、
/// `golden/click.json` を読む突き合わせテストで一致を保証する。
///
/// **レンダーコールバックの中で作らない。** その中でメモリ確保や三角関数を回すと
/// 締め切りに間に合わず音が途切れる。起動時にここで表を作っておき、
/// 本番はコピーするだけにする。
///
/// **音色は録音ではなく合成で作る**（2026-08-22 に録音しないと決定済み）。
/// 楽器の違いは倍音の並びと減衰の速さで出す。
public enum Click {

    public struct Spec: Sendable {
        /// 1打点の長さ（秒）
        public let duration: Double
        /// 先頭のごく短いアタック整形（クリックノイズを避けつつ立ち上がりは保つ）
        public let attack: Double
        public let gain: Double
        public let partials: [(ratio: Double, gain: Double, decay: Double)]
        /// 高音・低音の基音。**同じ音色で基音だけ変える**
        public let high: Double
        public let low: Double

        public func fundamental(for pitch: Pitch) -> Double {
            switch pitch {
            case .high: high
            case .low: low
            }
        }
    }

    /// アゴゴ（金属）。**金属打楽器らしさは倍音が整数比から外れていることで出る。**
    /// 減衰が遅く、打ったあとに余韻が残る。
    private static let agogo = Spec(
        duration: 0.35,
        attack: 0.0015,
        gain: 0.22,
        partials: [
            (1.0, 1.0, 12),
            (2.76, 0.55, 18),
            (5.4, 0.3, 26),
            (8.93, 0.15, 34),
        ],
        high: 1180,
        low: 790
    )

    /// クラベス（木）。**金属との違いは余韻の短さで出る。**
    /// 減衰をアゴゴの4〜5倍速くし、鳴り終わりまでを 0.12 秒に切る。
    /// 倍音は金属ほど散らさない（木は響きが単純で、基音がはっきり聴こえる）。
    /// 短いぶん音圧が下がるので、全体の音量をやや上げて他の音色と揃える。
    private static let claves = Spec(
        duration: 0.12,
        attack: 0.0006,
        gain: 0.3,
        partials: [
            (1.0, 1.0, 55),
            (1.62, 0.45, 75),
            (2.95, 0.22, 95),
            (4.6, 0.1, 120),
        ],
        high: 2400,
        low: 1750
    )

    public static func spec(for timbre: Timbre) -> Spec {
        switch timbre {
        case .agogo: agogo
        case .claves: claves
        }
    }

    /// 既定の音色の長さ。**音色ごとに違う**ので、長さが要る場所では
    /// `spec(for:).duration` を使う
    public static let duration: Double = agogo.duration

    public static func fundamental(for pitch: Pitch, timbre: Timbre = .agogo) -> Double {
        spec(for: timbre).fundamental(for: pitch)
    }

    /// 打点1つぶんの波形
    public static func samples(
        pitch: Pitch, timbre: Timbre = .agogo, sampleRate: Double
    ) -> [Float] {
        let spec = spec(for: timbre)
        let count = Int((spec.duration * sampleRate).rounded(.up))
        guard count > 0 else { return [] }

        let fundamental = spec.fundamental(for: pitch)

        return (0..<count).map { index in
            let t = Double(index) / sampleRate
            var value = 0.0
            for partial in spec.partials {
                value +=
                    sin(2 * .pi * fundamental * partial.ratio * t)
                    * partial.gain * exp(-t * partial.decay)
            }
            let attack = min(1, t / spec.attack)
            return Float(value * attack * spec.gain)
        }
    }
}
