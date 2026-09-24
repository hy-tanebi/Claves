import Foundation
import Testing
@testable import ClavesEngine

/// **打点の音を JS と Swift で揃えるための答え合わせ。**
///
/// ブラウザは Web Audio、iOS はネイティブが鳴らすので、音を作る式が2言語に存在する。
/// 片方だけ変えると**「ブラウザと iOS で音が違う」が黙って起きる**。
/// JS が書き出した `golden/click.json` を読んで突き合わせる。
///
/// **音色ごとに突き合わせる。** 音色を片方の言語にだけ足した、という
/// 取りこぼしをここで捕まえる。
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
        struct Entry: Decodable {
            let duration: Double
            let fundamentals: [String: Double]
            let samples: [String: [Double]]
        }
        let schemaVersion: Int
        let sampleRate: Double
        let probeStride: Int
        let timbres: [String: Entry]
    }

    static func load() throws -> Golden {
        try JSONDecoder().decode(Golden.self, from: Data(contentsOf: Self.goldenURL))
    }

    /// 契約の形が変わったら気づけるようにする
    @Test("答え合わせ表の版が合っている")
    func schemaVersionMatches() throws {
        #expect(try Self.load().schemaVersion == 2)
    }

    /// **収録している音色が両言語で同じでなければならない。**
    /// 片方にだけ足すと、切り替えたときに無音になる
    @Test("収録している音色が JS と一致する")
    func timbresMatchJS() throws {
        let golden = try Self.load()
        let mine = Set(Timbre.allCases.map(\.rawValue))
        #expect(Set(golden.timbres.keys) == mine)
    }

    @Test("波形が JS と一致する")
    func waveformMatchesJS() throws {
        let golden = try Self.load()

        for timbre in Timbre.allCases {
            let entry = try #require(golden.timbres[timbre.rawValue], "\(timbre) が表に無い")

            for pitch in [Pitch.high, Pitch.low] {
                let expected = try #require(entry.samples[pitch.rawValue])
                let actual = Click.samples(
                    pitch: pitch, timbre: timbre, sampleRate: golden.sampleRate)

                #expect(
                    actual.count == Int((entry.duration * golden.sampleRate).rounded(.up)),
                    "\(timbre) の \(pitch) の長さが違う")

                for (index, want) in expected.enumerated() {
                    let position = index * golden.probeStride
                    guard position < actual.count else {
                        Issue.record("\(timbre) の \(pitch) の抜き取り位置 \(position) が波形の外")
                        break
                    }
                    // JS 側は小数6桁に丸めた値を契約にしている
                    let got = (Double(actual[position]) * 1e6).rounded() / 1e6
                    #expect(
                        abs(got - want) < 2e-6,
                        "\(timbre) の \(pitch) の \(position) サンプル目: \(want) ではなく \(got)")
                }
            }
        }
    }

    /// 基音まで JS と揃っていないと、同じ式でも違う高さで鳴る
    @Test("基音が JS と一致する")
    func fundamentalsMatchJS() throws {
        let golden = try Self.load()

        for timbre in Timbre.allCases {
            let entry = try #require(golden.timbres[timbre.rawValue])
            for pitch in [Pitch.high, Pitch.low] {
                let expected = try #require(entry.fundamentals[pitch.rawValue])
                #expect(Click.fundamental(for: pitch, timbre: timbre) == expected)
            }
        }
    }

    /// 長さも契約の一部。ここがずれると鳴り終わりが片方だけ長くなる
    @Test("長さが JS と一致する")
    func durationsMatchJS() throws {
        let golden = try Self.load()

        for timbre in Timbre.allCases {
            let entry = try #require(golden.timbres[timbre.rawValue])
            #expect(Click.spec(for: timbre).duration == entry.duration)
        }
    }
}
