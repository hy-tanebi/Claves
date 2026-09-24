// swift-tools-version: 6.0
import PackageDescription

/// 再生エンジンの中核。**UIKit にも AVFoundation にも依存させない。**
///
/// tick ⇔ 時刻の計算は JS 側（`src/domain/transport.ts`）と一字一句同じ結果を
/// 出さなければならず、`golden/transport.json` を読む突き合わせテストで検証する。
/// 純粋な計算だけをここに置くことで、実機もシミュレータも要らずに
/// `swift test` で検証できる。
let package = Package(
    name: "ClavesEngine",
    platforms: [.iOS(.v14), .macOS(.v13)],
    products: [
        .library(name: "ClavesEngine", targets: ["ClavesEngine"])
    ],
    targets: [
        .target(name: "ClavesEngine"),
        // golden fixture はコピーせず、テスト内から #filePath 経由で
        // リポジトリの golden/transport.json を直接読む。
        // コピーすると二重管理になり、JS 側を更新したときに黙って食い違う。
        .testTarget(name: "ClavesEngineTests", dependencies: ["ClavesEngine"])
    ]
)
