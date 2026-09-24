import MediaPlayer

/// ロック画面とコントロールセンターの再生・停止。
///
/// バックグラウンドで鳴らす以上、**画面を消したまま止める手段が要る**。
/// アプリを開き直さないと止められないメトロノームは使いづらい。
///
/// ここは OS の UI を触るだけで判断を持たない。
/// 何をするかは呼び出し側（`ClavesAudioPlugin`）が決める。
enum NowPlaying {

    /// ロック画面のボタンに応答できるようにする。**一度だけ呼ぶ。**
    static func enableRemoteControls(
        onPlay: @escaping () -> Void,
        onStop: @escaping () -> Void
    ) {
        let center = MPRemoteCommandCenter.shared()

        center.playCommand.removeTarget(nil)
        center.playCommand.addTarget { _ in
            onPlay()
            return .success
        }

        // 停止と一時停止の両方を受ける。ロック画面に出るボタンは状況で変わる
        for command in [center.pauseCommand, center.stopCommand, center.togglePlayPauseCommand] {
            command.removeTarget(nil)
            command.addTarget { _ in
                onStop()
                return .success
            }
        }

        // 使わないものは明示的に無効化する。
        // 有効なままだとロック画面に反応しないボタンが並ぶ
        for command in [
            center.nextTrackCommand, center.previousTrackCommand,
            center.seekForwardCommand, center.seekBackwardCommand,
            center.changePlaybackPositionCommand,
        ] {
            command.isEnabled = false
        }
    }

    /// ロック画面に出すアイコン。
    ///
    /// **アセットカタログのアプリアイコンは `UIImage(named:)` で読めないことがある。**
    /// Web 資産としてバンドルに入る `public/icon-1024.png`（アプリアイコンと同じ絵）を読む。
    /// これは `cap sync` が必ず配置するので確実に存在する。
    ///
    /// 毎回作り直すと重いので一度だけ作って持っておく。
    private static let artwork: MPMediaItemArtwork? = {
        guard
            let url = Bundle.main.url(
                forResource: "icon-1024", withExtension: "png", subdirectory: "public"),
            let image = UIImage(contentsOfFile: url.path)
        else { return nil }
        return MPMediaItemArtwork(boundsSize: image.size) { _ in image }
    }()

    /// ロック画面の表示を更新する。
    ///
    /// **経過時間は出さない。** メトロノームは終わりのない繰り返しなので、
    /// 進捗バーが出ると意味のない表示になる。
    static func update(title: String, bpm: Double, isPlaying: Bool) {
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: title,
            MPMediaItemPropertyArtist: "\(Int(bpm)) BPM",
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? 1.0 : 0.0,
            MPNowPlayingInfoPropertyIsLiveStream: true,
        ]
        if let artwork { info[MPMediaItemPropertyArtwork] = artwork }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    static func clear() {
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    }
}
