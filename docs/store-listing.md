# App Store 掲載文（1.0）

App Store Connect の各欄にそのまま貼る。**文字数上限を超えると保存できない**ので、
変えるときは各欄の上限を守る。

## 名前（30文字・言語ごと）

日本語・ポルトガル語は `Clavenome`。
**英語（U.S.）だけ `Clavenome - Clave Metronome`。** 2026-09-20 の提出時、英語ロケールで
`Clavenome` が「すでに使用されている」と弾かれた（公開済みアプリには無い。
未公開の予約か、自分の日本語版との衝突誤判定）。説明語を足した形で通った。
言語ごとに名前が違うのは Apple の想定内で、ユーザーには端末言語の版だけが見える。

## プロモーション用テキスト

**空欄にする。** 審査なしで随時変えられる欄なので、リズム追加の告知などに使いたくなったら入れる。

## ローカリゼーション

日本語をプライマリにし、英語（U.S.）とポルトガル語（ブラジル）を足す。
**言語ごとに別々の欄**があり、ユーザーには端末の言語に合った版だけが出る。
英語版のキーワードは日本の App Store の検索にも効く（日本の Store は English (US) も索引する）。
スクリーンショットは日本語のものを全言語で使い回す。

### 日本語（プライマリ）

サブタイトル（30文字）

```
クラーベ メトロノーム
```

説明（4000文字）

```
Clavenome は、ラテンミュージックのリズムパターンを鳴らす練習用メトロノームです。

収録リズムは、ソン・ルンバ・ボサの各クラーベ、アフロ系のグルーヴ3種、6/8 のアフロ2種、IJEXA の計9種。クラーベは 3:2 と 2:3 を切り替えられます。

鳴っているリズムを譜面で表示し、いま鳴っている音を光らせます。

テンポは 40〜240 BPM。スライダーのほか、タップでも合わせられます。

音色はアゴゴ風とクラベス風の2種類。

画面をロックしても鳴り続け、ロック画面から止められます。

通信は一切行わず、アカウントも広告もありません。

特にアフロブラジルのリズムを練習する人のために作りました。
他にも自分自身のアイディアで拡張してより良い練習方法を見出してくれたら嬉しいです。
```

キーワード（100文字・カンマ区切り）

```
メトロノーム,クラーベ,サンバ,ラテン,サルサ,ソン,ルンバ,リズム,打楽器,パーカッション,アフロ,ブラジル,キューバ,サンバヘギ,コンガ,アタバキ,チンバウ,ドラム
```

### 英語（U.S.）

名前

```
Clavenome - Clave Metronome
```

サブタイトル

```
Latin Rhythm Patterns
```

説明

```
Clavenome is a practice metronome that plays Latin rhythm patterns.

It comes with nine patterns: the son, rumba and bossa claves, three Afro grooves, two 6/8 Afro grooves, and Ijexá. Claves can be flipped between 3:2 and 2:3.

The pattern is shown as notation, and the note being played lights up as it sounds.

Tempo runs from 40 to 240 BPM, set with a slider or by tapping.

Two sounds are included: an agogô-style bell and a claves-style click.

Playback keeps going when the screen is locked, and you can stop it from the lock screen.

No network access, no account, no ads.

Made especially for people practicing Afro-Brazilian rhythms. I hope you'll take it further with your own ideas and find practice methods that work better for you.
```

キーワード

```
metronome,clave,samba,latin,salsa,son,rumba,rhythm,percussion,afro,brazil,cuba,conga,atabaque,timbal
```

### ポルトガル語（ブラジル）

サブタイトル

```
Metrônomo de Clave
```

説明

```
Clavenome é um metrônomo de estudo que toca padrões rítmicos da música latina.

São nove padrões: as claves de son, rumba e bossa, três grooves afro, dois grooves afro em 6/8 e o Ijexá. As claves podem ser invertidas entre 3:2 e 2:3.

O padrão aparece em partitura, e a nota que está tocando acende na hora.

O andamento vai de 40 a 240 BPM, ajustado pelo controle deslizante ou por toque.

Dois timbres: um sino tipo agogô e um clique tipo claves.

Continua tocando com a tela bloqueada, e dá para parar pela tela de bloqueio.

Sem internet, sem conta, sem anúncios.

Feito especialmente para quem estuda ritmos afro-brasileiros. Espero que você leve isso adiante com suas próprias ideias e encontre formas de estudo ainda melhores.
```

キーワード

```
metrônomo,clave,samba,latino,salsa,son,rumba,ritmo,percussão,afro,brasil,cuba,conga,atabaque,timbal
```

## URL

| 欄                       | 値                               |
| ------------------------ | -------------------------------- |
| サポート URL             | https://tanebi-net.com/clavenome |
| マーケティング URL       | （空欄でよい）                   |
| プライバシーポリシー URL | https://tanebi-net.com/clavenome |

## その他

| 欄                  | 値                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| カテゴリ            | プライマリ: ミュージック ／ セカンダリ: 教育                                                       |
| 年齢制限            | すべて「なし」→ 4+                                                                                 |
| 著作権              | 2026 TANEBI CREATIVE                                                                               |
| 価格                | 無料                                                                                               |
| App のプライバシー  | データを収集しない                                                                                 |
| App Review の連絡先 | 氏名・電話・メール（審査員が連絡する先。公開されない）                                             |
| App Review のメモ   | 「オフラインで動作します。バックグラウンド再生は PLAY を押してから画面をロックしてご確認ください」 |

## スクリーンショット

`screenshots/store/` に 6.7 インチ（`67-*`）と 6.5 インチ（`65-*`）を4枚ずつ。
作り直すときは `pnpm build && node scripts/store-screenshots.mjs`。

| 順  | ファイル            | 内容                  |
| --- | ------------------- | --------------------- |
| 1   | `*-1-son-clave.png` | 初期画面（Son Clave） |
| 2   | `*-2-list.png`      | リズム一覧            |
| 3   | `*-3-6-8.png`       | 6/8 のリズム          |
| 4   | `*-4-ijexa.png`     | IJEXA                 |

## 審査対応履歴

### 2026-09-21（1回目）

**Apple からの質問**：Guideline 2.1 Information Needed

新規アカウントの審査として、以下を提供するよう求められた：

1. 実機の画面録画（最新 OS、アプリ起動から主な機能の一通り）
2. アプリの目的・ターゲット・解く課題・提供する価値
3. セットアップ・アクセス方法（ログイン有無・サンプルファイル有無）
4. 外部サービス一覧
5. 地域差の有無
6. 規制産業か / 第三者保護資材の有無

**対応内容**：

- 画面録画：iPhone XR 実機で 91.5 秒（起動 → 再生 → テンポ変更 → リズム切り替え → 
  クラーベ 3:2/2:3 切り替え → 音色切り替え → バックグラウンド再生確認）
- 返信文：6 項目すべてに英語で回答。外部サービス・ユーザー生成コンテンツ・
  ログイン機能・有料機能いずれも無い旨、アプリ設計（完全オフライン・公開リズムのみ）を記載
- 訂正：返信文にコントロールセンター停止の記載があったが、録画に含まれていなかったため
  訂正メッセージを送信

**次のステップ**：Apple の再審査結果待ち（通常 1〜3日）
