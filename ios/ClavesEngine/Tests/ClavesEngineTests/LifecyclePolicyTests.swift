import Testing
@testable import ClavesEngine

/// 割り込みや機器の抜き差しに対して何をするか。
///
/// **AVFoundation のコールバックそのものはテストできないが、
/// 「何が起きたら何をするか」の判断は切り離せる。**
/// ここを純粋な計算にしておけば、実機なしで仕様を固定できる。
///
/// 決定済みの仕様（2026-08-22 オーナー判断）:
/// 割り込み後は自動再開しない／イヤホン抜去で止める／他アプリと非mix／
/// ロック画面に再生・停止を出す
@Suite("割り込みと機器変更の扱い")
struct LifecyclePolicyTests {

    // MARK: - 割り込み（着信・Siri・アラーム）

    @Test("割り込みが始まったら止める")
    func stopsWhenInterruptionBegins() {
        #expect(LifecyclePolicy.onInterruption(.began) == .stop)
    }

    /// **iOS は割り込みの終了時に「再開してよい」と示唆してくることがある。**
    /// メトロノームは鳴り続けると練習の邪魔になるので、**その示唆を無視して止めたままにする**。
    /// 電話を切った直後に勝手に鳴り出すのは驚かせるだけ。
    @Test("割り込みが終わっても自動で再開しない")
    func doesNotResumeAfterInterruption() {
        #expect(LifecyclePolicy.onInterruption(.ended(systemSuggestsResume: false)) == .stop)
        #expect(
            LifecyclePolicy.onInterruption(.ended(systemSuggestsResume: true)) == .stop,
            "システムが再開を示唆しても従わない")
    }

    // MARK: - 機器の抜き差し

    /// イヤホンを抜くと出力がスピーカーに切り替わる。
    /// **そのまま鳴り続けると、静かな場所で突然大音量が出る。**
    @Test("使っていた機器が無くなったら止める")
    func stopsWhenDeviceRemoved() {
        #expect(LifecyclePolicy.onRouteChange(.oldDeviceUnavailable) == .stop)
    }

    /// 逆に、イヤホンを挿した・スピーカーが増えた等では止めない。
    /// 練習中に接続しただけで止まるのは不便
    @Test("機器が増えただけなら鳴り続ける")
    func keepsPlayingWhenDeviceAdded() {
        #expect(LifecyclePolicy.onRouteChange(.newDeviceAvailable) == .keepPlaying)
    }

    @Test("その他の経路変更では止めない")
    func keepsPlayingOnOtherRouteChanges() {
        for reason in [
            RouteChangeReason.categoryChange,
            .override,
            .wakeFromSleep,
            .routeConfigurationChange,
            .unknown,
        ] {
            #expect(LifecyclePolicy.onRouteChange(reason) == .keepPlaying, "\(reason) で止まっている")
        }
    }

    /// 経路が無くなった場合は鳴らしようがない
    @Test("使える経路が無くなったら止める")
    func stopsWhenNoRouteAvailable() {
        #expect(LifecyclePolicy.onRouteChange(.noSuitableRouteForCategory) == .stop)
    }
}
