import Foundation

/// 打点の音。**JS 側 `src/audio/bell.ts` と同じ式でなければならない。**
///
/// ブラウザは Web Audio、iOS はここが鳴らすので、音を作る式が2言語に存在する。
/// 片方だけ変えると「ブラウザと iOS で音が違う」が黙って起きるため、
/// `golden/click.json` を読む突き合わせテストで一致を保証する。
///
/// **レンダーコールバックの中で作らない。** その中でメモリ確保や三角関数を回すと
/// 締め切りに間に合わず音が途切れる。起動時にここで表を作っておき、
/// 本番はコピーするだけにする。
public enum Click {

    /// 1打点の長さ（秒）
    public static let duration: Double = 0.35

    /// 金属打楽器らしさは倍音が整数比から外れていることで出る
    private static let partials: [(ratio: Double, gain: Double, decay: Double)] = [
        (1.0, 1.0, 12),
        (2.76, 0.55, 18),
        (5.4, 0.3, 26),
        (8.93, 0.15, 34),
    ]

    /// 先頭のごく短いアタック整形（クリックノイズを避けつつ立ち上がりは保つ）
    private static let attackSeconds: Double = 0.0015
    private static let gain: Double = 0.22

    /// アゴゴの高音・低音。
    ///
    /// **高音と低音は同じ音色で、基音だけを変える。**
    /// 別々の音色にすると、ひとつの楽器の高低ではなく別の楽器に聴こえてしまう。
    public static func fundamental(for pitch: Pitch) -> Double {
        switch pitch {
        case .high: 1180
        case .low: 790
        }
    }

    /// 打点1つぶんの波形
    public static func samples(pitch: Pitch, sampleRate: Double) -> [Float] {
        let count = Int((duration * sampleRate).rounded(.up))
        guard count > 0 else { return [] }

        let fundamental = fundamental(for: pitch)

        return (0..<count).map { index in
            let t = Double(index) / sampleRate
            var value = 0.0
            for partial in partials {
                value +=
                    sin(2 * .pi * fundamental * partial.ratio * t)
                    * partial.gain * exp(-t * partial.decay)
            }
            let attack = min(1, t / attackSeconds)
            return Float(value * attack * gain)
        }
    }
}
