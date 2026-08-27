import Capacitor

/// **アプリの中で定義したプラグインは、Capacitor が自動では見つけてくれない。**
///
/// npm パッケージとして配布されるプラグインは `Package.swift` 経由で登録されるが、
/// このアプリのように自前のクラスをアプリ本体に置いた場合は、
/// ここで明示的に登録しないと JS 側で
/// 「"ClavesAudio" plugin is not implemented on ios」になる。
///
/// クラスがバイナリに入っていても登録されていなければ呼べない。
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(ClavesAudioPlugin())
    }
}
