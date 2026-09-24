import Testing
@testable import ClavesEngine

/// 打点の音そのもの。
///
/// レンダーコールバックの中でメモリ確保や三角関数を回すと、
/// 締め切りに間に合わずに音が途切れる。**事前に計算した表を用意して、
/// 本番はコピーするだけ**にする。表の正しさはここで担保する。
@Suite("クリック音の生成")
struct ClickTests {

    /// 波形の始まりに段差があると「プチッ」というノイズになる。
    /// 打点は毎小節鳴るので、ここが雑だと聴き続けられない。
    @Test("波形は無音から始まる")
    func waveformStartsSilent() {
        for pitch in [Pitch.high, Pitch.low] {
            let samples = Click.samples(pitch: pitch, sampleRate: 48000)

            #expect(!samples.isEmpty)
            #expect(abs(samples.first!) < 0.001, "\(pitch) の先頭に段差がある")
        }
    }

    /// 末尾は**ちょうど 0 にはならない**。指数減衰なので理屈上ゼロに達しない。
    ///
    /// 末尾のサンプル1点だけを見ると、サイン波がたまたまゼロ交差に近いかどうかで
    /// 値が変わり、**運で通るテストになる**。包絡線が十分下がっていることを見る。
    /// 0.0033（およそ -50dB）は聴こえない。
    @Test("波形の末尾は聴こえない大きさまで減衰している")
    func waveformDecaysToInaudible() {
        for pitch in [Pitch.high, Pitch.low] {
            let samples = Click.samples(pitch: pitch, sampleRate: 48000)
            // 末尾 1ms の最大値で見る（1点だけだと偶然に左右される）
            let tail = samples.suffix(48)

            #expect(tail.allSatisfy { abs($0) < 0.005 }, "\(pitch) の末尾が減衰しきっていない")
        }
    }

    /// 骨格を示すアクセントと通常打点を聴き分けられなければ意味がない
    @Test("high と low は違う高さで鳴る")
    func pitchesDiffer() {
        let high = Click.samples(pitch: .high, sampleRate: 48000)
        let low = Click.samples(pitch: .low, sampleRate: 48000)

        #expect(Self.zeroCrossings(high) > Self.zeroCrossings(low), "high の方が高い音でなければならない")
    }

    @Test("音量は 1.0 を超えない")
    func doesNotClip() {
        for pitch in [Pitch.high, Pitch.low] {
            let samples = Click.samples(pitch: pitch, sampleRate: 48000)
            #expect(samples.allSatisfy { abs($0) <= 1.0 }, "\(pitch) が歪む")
        }
    }

    /// サンプルレートが変わっても同じ長さ（秒）で鳴らなければ、
    /// 機器によって音の長さが変わってしまう
    @Test("サンプルレートが変わっても鳴る長さは同じ")
    func durationIsIndependentOfSampleRate() {
        let at48k = Click.samples(pitch: .high, sampleRate: 48000).count
        let at44k = Click.samples(pitch: .high, sampleRate: 44100).count

        let seconds48k = Double(at48k) / 48000
        let seconds44k = Double(at44k) / 44100
        #expect(abs(seconds48k - seconds44k) < 0.001)
    }

    static func zeroCrossings(_ samples: [Float]) -> Int {
        var count = 0
        for i in 1..<samples.count where (samples[i - 1] < 0) != (samples[i] < 0) {
            count += 1
        }
        return count
    }
}
