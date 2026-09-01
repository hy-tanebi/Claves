/// 打点をバッファへ書き込む。
///
/// **クリックの長さ（アゴゴは 40ms 相当より長い 0.35 秒）は普通のバッファ長より長い。**
/// バッファの端で鳴り始めた音は次のバッファへ続けなければならないので、
/// 鳴っている途中の音（voice）をまたいで持ち越す。
///
/// レンダーコールバックから呼ぶので、**ここでメモリを確保しない。**
/// 波形は初期化時に作った表を読むだけ。
///
/// **音色は全種類ぶんの表を初期化時に作る。** 切り替えのたびに合成すると、
/// その場で数万サンプルぶんの三角関数を回すことになり、押した瞬間に音が途切れる。
public struct ClickMixer {

    /// 鳴っている途中の音。表のどこまで進んだかを持つ。
    ///
    /// **音色も一緒に持つ。** 鳴っている最中に音色を変えたとき、
    /// 途中から別の表を読むと波形が不連続になってプチッと鳴る。
    private struct Voice {
        let timbre: Timbre
        let pitch: Pitch
        /// 表の長さ。**鳴り終わりの判定でここを見る。**
        /// 判定のたびに表を引きに行くと `voices` を書き換えながら
        /// `self` を読むことになり、排他アクセス違反になる
        let length: Int
        var position: Int
    }

    /// 表は辞書ではなく個別に持つ。
    /// **レンダー中に辞書を引くと、参照カウントとハッシュ計算が毎回走る。**
    private let agogoHigh: [Float]
    private let agogoLow: [Float]
    private let clavesHigh: [Float]
    private let clavesLow: [Float]

    private var voices: [Voice] = []

    /// これから鳴らす音の音色。**すでに鳴っている音は元の音色のまま鳴り終わる**
    private var timbre: Timbre = .agogo

    /// 同時に鳴らせる数の上限。速いテンポで打点が溜まっても
    /// 処理量が青天井にならないようにする。
    ///
    /// **上限に達すると鳴っている音を途中で切るので、余裕を持たせる。**
    /// アゴゴは 0.35 秒鳴る。最も密な IJEXA を上限の 400bpm で鳴らすと
    /// 平均 0.075 秒間隔＝約5音が重なる。打点が偏る箇所を考えても 16 あれば届かない。
    /// クラベスは 0.12 秒しか鳴らないので、さらに余る。
    private let maxVoices = 16

    public init(sampleRate: Double) {
        agogoHigh = Click.samples(pitch: .high, timbre: .agogo, sampleRate: sampleRate)
        agogoLow = Click.samples(pitch: .low, timbre: .agogo, sampleRate: sampleRate)
        clavesHigh = Click.samples(pitch: .high, timbre: .claves, sampleRate: sampleRate)
        clavesLow = Click.samples(pitch: .low, timbre: .claves, sampleRate: sampleRate)
        voices.reserveCapacity(maxVoices)
    }

    /// 音色を変える。**表はもう作ってあるので、選び直すだけ。**
    public mutating func setTimbre(_ timbre: Timbre) {
        self.timbre = timbre
    }

    public var currentTimbre: Timbre { timbre }

    private func table(_ timbre: Timbre, _ pitch: Pitch) -> [Float] {
        switch (timbre, pitch) {
        case (.agogo, .high): agogoHigh
        case (.agogo, .low): agogoLow
        case (.claves, .high): clavesHigh
        case (.claves, .low): clavesLow
        }
    }

    /// バッファの先頭 `count` サンプルを埋める。`hits` はその範囲で鳴り始める打点。
    ///
    /// **`count` は必ず渡す。** バッファは最大長で確保して使い回し、
    /// オーディオ側が要求する数は毎回それより少ないのが普通。
    /// バッファ長ぶん音を進めると、クリックが1回のコールバックで
    /// 消費し尽くされ、音が途中でぶつ切りになる。
    ///
    /// バッファは使い回されるため、**まず 0 で埋め直す**。
    /// 残骸を放置すると前の音が繰り返し鳴る。
    ///
    /// `hits` も使い回されるバッファなので、**読むのは先頭 `hitCount` 件だけ**。
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
            voices.append(
                Voice(
                    timbre: timbre,
                    pitch: hit.pitch,
                    length: table(timbre, hit.pitch).count,
                    position: -hit.frameOffset
                ))
        }

        guard !voices.isEmpty else { return }

        for voiceIndex in voices.indices {
            let table = table(voices[voiceIndex].timbre, voices[voiceIndex].pitch)
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
        voices.removeAll { $0.position >= $0.length }
    }

    /// 確保してよい場面（テストと確認）向けの形
    public mutating func fill(_ buffer: inout [Float], count: Int, hits: [ScheduledHit]) {
        fill(&buffer, count: count, hits: hits, hitCount: hits.count)
    }
}
