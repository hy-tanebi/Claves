import Foundation
import Testing
@testable import ClavesEngine

/// **打点の音を JS と Swift で揃えるための答え合わせ。**
///
/// ブラウザは Web Audio、iOS はネイティブが鳴らすので、音を作る式が2言語に存在する。
/// 片方だけ変えると**「ブラウザと iOS で音が違う」が黙って起きる**。
/// JS が書き出した `golden/click.json` を読んで突き合わせる。
@Suite("打点の音の突き合わせ")
struct ClickGoldenTests {

    static var goldenURL: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()  // ClavesEngineTests
            .deletingLastPathComponent()  // Tests
            .deletingLastPathComponent()  // ClavesEngine
            .deletingLastPathComponent()  // ios
            .deletingLastPathComponent()  // リポジトリのルート
            .appendingPathComponent("golden/click.json")
    }

    struct Golden: Decodable {
        let sampleRate: Double
        let duration: Double
        let probeStride: Int
        let fundamentals: [String: Double]
        let samples: [String: [Double]]
    }

    static func load() throws -> Golden {
        try JSONDecoder().decode(Golden.self, from: Data(contentsOf: Self.goldenURL))
    }

    @Test("波形が JS と一致する")
    func waveformMatchesJS() throws {
        let golden = try Self.load()

        for pitch in [Pitch.high, Pitch.low] {
            let expected = try #require(golden.samples[pitch.rawValue])
            let actual = Click.samples(pitch: pitch, sampleRate: golden.sampleRate)

            #expect(
                actual.count == Int((golden.duration * golden.sampleRate).rounded(.up)),
                "\(pitch) の長さが違う")

            for (index, want) in expected.enumerated() {
                let position = index * golden.probeStride
                guard position < actual.count else {
                    Issue.record("\(pitch) の抜き取り位置 \(position) が波形の外")
                    break
                }
                // JS 側は小数6桁に丸めた値を契約にしている
                let got = (Double(actual[position]) * 1e6).rounded() / 1e6
                #expect(
                    abs(got - want) < 2e-6,
                    "\(pitch) の \(position) サンプル目: \(want) ではなく \(got)")
            }
        }
    }

    /// 基音まで JS と揃っていないと、同じ式でも違う高さで鳴る
    @Test("基音が JS と一致する")
    func fundamentalsMatchJS() throws {
        let golden = try Self.load()

        for pitch in [Pitch.high, Pitch.low] {
            let expected = try #require(golden.fundamentals[pitch.rawValue])
            #expect(Click.fundamental(for: pitch) == expected)
        }
    }
}
