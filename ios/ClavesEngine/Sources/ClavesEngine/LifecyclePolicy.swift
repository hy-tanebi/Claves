/// 再生をどうするか。
public enum PlaybackCommand: Equatable, Sendable {
    case stop
    case keepPlaying
}

/// 割り込み（着信・Siri・アラームなど）の段階。
public enum InterruptionPhase: Equatable, Sendable {
    case began
    /// - Parameter systemSuggestsResume: iOS が「再開してよい」と示唆しているか。
    ///   **このアプリでは従わない**（下の `onInterruption` を参照）
    case ended(systemSuggestsResume: Bool)
}

/// 出力経路が変わった理由。`AVAudioSession.RouteChangeReason` に対応する。
///
/// **AVFoundation の型をここに持ち込まない。** そうするとこのパッケージが
/// 純粋な計算でなくなり、実機なしのテストができなくなる。
/// 変換はアプリ側（`ClavesAudioEngine`）で行う。
public enum RouteChangeReason: Equatable, Sendable {
    /// 使っていた機器が無くなった（イヤホンを抜いた等）
    case oldDeviceUnavailable
    /// 機器が増えた（イヤホンを挿した等）
    case newDeviceAvailable
    case categoryChange
    case override
    case wakeFromSleep
    /// いまのカテゴリで使える経路が無い
    case noSuitableRouteForCategory
    case routeConfigurationChange
    case unknown
}

/// 割り込みや機器の抜き差しに対して何をするか。
///
/// **AVFoundation のコールバックそのものはテストできないが、
/// 「何が起きたら何をするか」の判断は切り離せる。**
/// ここを純粋な計算にしておけば、実機なしで仕様を固定できる。
public enum LifecyclePolicy {

    /// 割り込みへの対応。
    ///
    /// **始まったら止める。終わっても自動では再開しない**（2026-08-22 オーナー判断）。
    /// iOS は終了時に「再開してよい」と示唆してくることがあるが、
    /// メトロノームが電話を切った直後に勝手に鳴り出すのは驚かせるだけなので従わない。
    public static func onInterruption(_ phase: InterruptionPhase) -> PlaybackCommand {
        switch phase {
        case .began: .stop
        case .ended: .stop
        }
    }

    /// 出力経路の変更への対応。
    ///
    /// **使っていた機器が無くなったら止める**（2026-08-22 オーナー判断）。
    /// イヤホンを抜くと出力がスピーカーへ切り替わり、
    /// そのまま鳴り続けると静かな場所で突然大音量が出る。
    ///
    /// 逆に機器が増えただけで止めると、練習中に接続しただけで止まって不便。
    public static func onRouteChange(_ reason: RouteChangeReason) -> PlaybackCommand {
        switch reason {
        case .oldDeviceUnavailable, .noSuitableRouteForCategory: .stop
        default: .keepPlaying
        }
    }
}
