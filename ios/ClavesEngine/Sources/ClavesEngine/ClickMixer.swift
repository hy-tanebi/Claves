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
    /// 処理量が青天井にならないようにする
    private let maxVoices = 8

    public init(sampleRate: Double) {
        tables = [
            .high: Click.samples(pitch: .high, sampleRate: sampleRate),
            .low: Click.samples(pitch: .low, sampleRate: sampleRate),
        ]
        voices.reserveCapacity(maxVoices)
    }

    /// バッファを埋める。`hits` はこのバッファ内で鳴り始める打点。
    ///
    /// バッファは使い回されるため、**まず 0 で埋め直す**。
    /// 残骸を放置すると前の音が繰り返し鳴る。
    public mutating func fill(_ buffer: inout [Float], hits: [ScheduledHit]) {
        for index in buffer.indices { buffer[index] = 0 }

        for hit in hits {
            guard hit.frameOffset >= 0, hit.frameOffset < buffer.count else { continue }
            if voices.count >= maxVoices { voices.removeFirst() }
            // 表の先頭からではなく、バッファ内の位置ぶん遅らせて鳴らす
            voices.append(Voice(pitch: hit.pitch, position: -hit.frameOffset))
        }

        guard !voices.isEmpty else { return }

        for voiceIndex in voices.indices {
            let table = tables[voices[voiceIndex].pitch] ?? []
            var position = voices[voiceIndex].position

            for bufferIndex in buffer.indices {
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
}
