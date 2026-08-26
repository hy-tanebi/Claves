import Foundation

/// 打点の音そのもの。
///
/// **レンダーコールバックの中で作らない。** その中でメモリ確保や三角関数を回すと
/// 締め切りに間に合わず音が途切れる。起動時にここで表を作っておき、
/// 本番はコピーするだけにする。
public enum Click {

    /// 1打点の長さ（秒）。骨格を刻む用途なので短く切る
    public static let duration: Double = 0.04

    /// 歪まないよう頭を抑える
    private static let peak: Float = 0.9

    /// アクセント（骨格の頭）と通常打点を聴き分けるための高さ
    private static func frequency(for pitch: Pitch) -> Double {
        switch pitch {
        case .high: 1600
        case .low: 900
        }
    }

    /// 打点1つぶんの波形。
    ///
    /// 始まりと終わりを 0 に落とすのは**「プチッ」というノイズを出さないため**。
    /// 段差があるとスピーカーが跳ね、毎小節それが鳴って聴き続けられなくなる。
    public static func samples(pitch: Pitch, sampleRate: Double) -> [Float] {
        let count = Int((duration * sampleRate).rounded())
        guard count > 0 else { return [] }

        let frequency = frequency(for: pitch)
        // 立ち上がりは 1ms。ここが 0 から始まらないと頭で段差が出る
        let attackFrames = max(1.0, 0.001 * sampleRate)
        // 終わりは 5ms かけて 0 へ。減衰だけだと末尾がわずかに残る
        let releaseFrames = max(1.0, 0.005 * sampleRate)
        // 指数減衰の時定数。打点らしく速く落とす
        let tau = duration / 5

        return (0..<count).map { index in
            let t = Double(index) / sampleRate
            let attack = min(1.0, Double(index) / attackFrames)
            let release = min(1.0, Double(count - 1 - index) / releaseFrames)
            let envelope = attack * exp(-t / tau) * release
            return Float(sin(2 * .pi * frequency * t) * envelope) * peak
        }
    }
}
