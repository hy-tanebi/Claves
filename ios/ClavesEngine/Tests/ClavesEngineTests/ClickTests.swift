import Testing
@testable import ClavesEngine

/// 打点の音そのもの。
///
/// レンダーコールバックの中でメモリ確保や三角関数を回すと、
/// 締め切りに間に合わずに音が途切れる。**事前に計算した表を用意して、
/// 本番はコピーするだけ**にする。表の正しさはここで担保する。
@Suite("クリック音の生成")
struct ClickTests {

    /// 波形の始まりと終わりが 0 でないと、その段差が「プチッ」というノイズになる。
    /// 打点は毎小節鳴るので、ここが雑だと聴き続けられない。
    @Test("波形は無音から始まり無音で終わる")
    func waveformStartsAndEndsSilent() {
        for pitch in [Pitch.high, Pitch.low] {
            let samples = Click.samples(pitch: pitch, sampleRate: 48000)

            #expect(!samples.isEmpty)
            #expect(abs(samples.first!) < 0.001, "\(pitch) の先頭に段差がある")
            #expect(abs(samples.last!) < 0.001, "\(pitch) の末尾に段差がある")
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
