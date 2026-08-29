/// 打点をバッファへ書き込む。
///
/// **クリックの長さ（40ms ≒ 1920 サンプル）は普通のバッファ長より長い。**
/// バッファの端で鳴り始めた音は次のバッファへ続けなければならないので、
/// 鳴っている途中の音（voice）をまたいで持ち越す。
///
/// レンダーコールバックから呼ぶので、**ここでメモリを確保しない。**
/// 波形は初期化時に作った表を読むだけ。
public struct ClickMixer {

    /// 鳴っている途中の音。表のどこまで進んだかを持つ
    private struct Voice {
        let pitch: Pitch
        var position: Int
    }

    private let tables: [Pitch: [Float]]
    private var voices: [Voice] = []

    /// 同時に鳴らせる数の上限。速いテンポで打点が溜まっても
    /// 処理量が青天井にならないようにする。
    ///
    /// **上限に達すると鳴っている音を途中で切るので、余裕を持たせる。**
    /// 打点は 0.35 秒鳴る。最も密な IJEXA を上限の 400bpm で鳴らすと
    /// 平均 0.075 秒間隔＝約5音が重なる。打点が偏る箇所を考えても 16 あれば届かない。
    private let maxVoices = 16

    public init(sampleRate: Double) {
        tables = [
            .high: Click.samples(pitch: .high, sampleRate: sampleRate),
            .low: Click.samples(pitch: .low, sampleRate: sampleRate),
        ]
        voices.reserveCapacity(maxVoices)
    }

    /// バッファの先頭 `count` サンプルを埋める。`hits` はその範囲で鳴り始める打点。
    ///
    /// **`count` は必ず渡す。** バッファは最大長で確保して使い回し、
    /// オーディオ側が要求する数は毎回それより少ないのが普通。
    /// バッファ長ぶん音を進めると、40ms のクリックが1回のコールバックで
    /// 消費し尽くされ、音が途中でぶつ切りになる。
    ///
    /// バッファは使い回されるため、**まず 0 で埋め直す**。
    /// 残骸を放置すると前の音が繰り返し鳴る。
    /// `hits` は使い回されるバッファなので、**読むのは先頭 `hitCount` 件だけ**。
    /// 残りは前回の中身が入ったままになっている
    public mutating func fill(
        _ buffer: inout [Float], count: Int, hits: [ScheduledHit], hitCount: Int
    ) {
        let frames = min(count, buffer.count)
        guard frames > 0 else { return }

        for index in 0..<frames { buffer[index] = 0 }

        for index in 0..<min(hitCount, hits.count) {
            let hit = hits[index]
            guard hit.frameOffset >= 0, hit.frameOffset < frames else { continue }
            if voices.count >= maxVoices { voices.removeFirst() }
            // 表の先頭からではなく、バッファ内の位置ぶん遅らせて鳴らす
            voices.append(Voice(pitch: hit.pitch, position: -hit.frameOffset))
        }

        guard !voices.isEmpty else { return }

        for voiceIndex in voices.indices {
            let table = tables[voices[voiceIndex].pitch] ?? []
            var position = voices[voiceIndex].position

            for bufferIndex in 0..<frames {
                if position >= 0 && position < table.count {
                    // 重なった打点は足し合わせる。上書きすると前の音が不自然に切れる
                    buffer[bufferIndex] += table[position]
                }
                position += 1
            }
            voices[voiceIndex].position = position
        }

        // 鳴り終わった音を落とす
        voices.removeAll { $0.position >= (tables[$0.pitch]?.count ?? 0) }
    }

    /// 確保してよい場面（テストと確認）向けの形
    public mutating func fill(_ buffer: inout [Float], count: Int, hits: [ScheduledHit]) {
        fill(&buffer, count: count, hits: hits, hitCount: hits.count)
    }
}
