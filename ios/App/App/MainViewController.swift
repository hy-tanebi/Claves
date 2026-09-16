import Capacitor
import UIKit

/// **アプリの中で定義したプラグインは、Capacitor が自動では見つけてくれない。**
///
/// npm パッケージとして配布されるプラグインは `Package.swift` 経由で登録されるが、
/// このアプリのように自前のクラスをアプリ本体に置いた場合は、
/// ここで明示的に登録しないと JS 側で
/// 「"ClavesAudio" plugin is not implemented on ios」になる。
///
/// クラスがバイナリに入っていても登録されていなければ呼べない。
class MainViewController: CAPBridgeViewController {

    /// 起動画面を見せておく長さ（秒）。
    ///
    /// **iOS の起動画面（LaunchScreen.storyboard）は、アプリが最初の1枚を描いた
    /// 瞬間に消える**ので、長さを指定する手段がない。そこで同じ見た目のビューを
    /// WebView の上にかぶせ、この秒数だけ待ってから消す。
    /// WebView が最初に出す白い1枚もこれで隠れる。
    static let splashDuration: TimeInterval = 2.5
    static let splashFadeDuration: TimeInterval = 0.4

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(ClavesAudioPlugin())
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        showSplash()
    }

    // MARK: - 起動画面の引き延ばし

    /// **LaunchScreen.storyboard と同じ配置で作る。** 起動画面からこのビューへは
    /// 継ぎ目なく切り替わる必要があり、ずれると印が跳ねて見える。
    /// 色・寸法・間隔を変えるときは storyboard 側も揃える。
    private func showSplash() {
        let splash = UIView()
        splash.translatesAutoresizingMaskIntoConstraints = false
        // #0a0a0a（Web 側の --bg、アイコンの下地と同じ）
        splash.backgroundColor = UIColor(red: 10 / 255, green: 10 / 255, blue: 10 / 255, alpha: 1)

        let icon = UIImageView(image: UIImage(named: "LaunchIcon"))
        icon.translatesAutoresizingMaskIntoConstraints = false
        icon.contentMode = .scaleAspectFit

        let name = UILabel()
        name.translatesAutoresizingMaskIntoConstraints = false
        name.text = "Clavenome"
        name.textAlignment = .center
        name.font = UIFont.preferredFont(forTextStyle: .title2)
        // #fbf9f4（Web 側の --text）
        name.textColor = UIColor(red: 251 / 255, green: 249 / 255, blue: 244 / 255, alpha: 1)

        splash.addSubview(icon)
        splash.addSubview(name)
        view.addSubview(splash)

        NSLayoutConstraint.activate([
            splash.topAnchor.constraint(equalTo: view.topAnchor),
            splash.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            splash.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            splash.trailingAnchor.constraint(equalTo: view.trailingAnchor),

            icon.widthAnchor.constraint(equalToConstant: 160),
            icon.heightAnchor.constraint(equalToConstant: 160),
            icon.centerXAnchor.constraint(equalTo: splash.centerXAnchor),
            icon.centerYAnchor.constraint(equalTo: splash.centerYAnchor, constant: -20),

            name.topAnchor.constraint(equalTo: icon.bottomAnchor, constant: 20),
            name.centerXAnchor.constraint(equalTo: splash.centerXAnchor),
        ])

        DispatchQueue.main.asyncAfter(deadline: .now() + Self.splashDuration) {
            UIView.animate(
                withDuration: Self.splashFadeDuration,
                animations: { splash.alpha = 0 },
                completion: { _ in splash.removeFromSuperview() }
            )
        }
    }
}
