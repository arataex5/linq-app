# LINQ（リンク）

ボードゲーム「LINQ」を遊ぶための **スマートフォン専用 PWA** です。
役職（スパイ／一般人）とお題の配布、キーワードの伝達、投票と得点の集計までを1台でまかないます。

- 完全オフライン動作（Service Worker）
- 現在のバージョン：**v1.2.0** / お題データ 533件
- すべて相対パス（`./`）構成 → サブディレクトリ配置・Capacitor での APK 化に対応
- ダーク／ライトモード、画面の縦横切替（⟳ ボタン）、セーフエリア対応

---

## ファイル構成

```
linq-app/                     ← このフォルダの中身をリポジトリ直下に置く
├─ index.html                 画面（section.screen）の定義
├─ manifest.json              PWA マニフェスト
├─ sw.js                      Service Worker（APP_VERSION を持つ）
├─ .nojekyll                  GitHub Pages 用
├─ .gitignore                 node_modules / android / www / 署名鍵を除外
├─ package.json               Capacitor の依存とビルドスクリプト
├─ capacitor.config.json      appId / appName / webDir
├─ css/style.css              スタイル（ダーク／ライト、回転、セーフエリア）
├─ js/
│   ├─ data.js                お題データ／永続化／得点ルール（APP_VERSION・APK配布設定）
│   ├─ app.js                 画面遷移・ゲーム進行・描画
│   └─ pwa.js                 Service Worker 登録・更新
├─ data/linq_topics.csv       お題データ（A列=No. / B列=お題／533件）
├─ icons/                     PWA用アイコン（Q＋目隠しバー）
├─ assets/                    APK用のアイコン／スプラッシュ素材（1024px・2732px）
├─ download/
│   ├─ apk-info.json          配布情報（GitHub Actions が更新／初期は available:false）
│   └─ linq.apk               ビルド後に GitHub Actions が自動コミット
├─ tools/
│   ├─ embed_csv.py           CSV を js/data.js の埋め込みデータへ同期
│   ├─ build-www.mjs          Capacitor 用 www/ を作成
│   └─ set-android-version.mjs  APP_VERSION を versionName/versionCode へ反映
└─ .github/workflows/
    ├─ build-apk.yml          APK ビルド → download/ 更新 → リリース作成
    └─ pages.yml              GitHub Pages へ公開
```

## 画面の流れ

```
タイトル
 ├ クイックゲーム → ゲーム設定① → 役職＆お題確認 → キーワード伝達 → 投票
 │                                → ポイント集計 → リザルト（勝者表示）
 │                                   └「もう一度遊ぶ」→ ゲーム設定①
 ├ フルゲーム   → ゲーム設定②（初回）→ 役職＆お題確認 → キーワード伝達 → 投票
 │                → ポイント集計 → 総ポイント
 │                     ├ 必要pt未到達        →「次のゲームへ」→ ゲーム設定③
 │                     ├ 単独1位             → 勝利画面
 │                     ├ 同点1位（SDなし）   → 複数勝者の勝利画面
 │                     └ 同点1位（SDあり）   → サドンデス →（ゲーム設定③へ）
 └ ルール説明 / お題リスト / お題の追加・削除 / 履歴 / 設定
```

ゲーム設定②と③は同じ画面（`#screen-setup-full`）を状態で切り替えています。
③（2ゲーム目以降）では順番の決め方が変更不可になり、保持ポイントに総ポイントが入ります。

## 得点ルール（js/data.js の `scoreRound`）

| 人数 | スパイ | 一般人 | 指名上限 | ペナルティ |
|---|---|---|---|---|
| 4〜8 | 2 | 2〜6 | +1pt（最大1pt） | 一般人から2票以上で0pt |
| 9〜12 | 3 | 6〜9 | 最大2pt | 3票以上で0pt |
| 13〜16 | 4 | 9〜12 | 最大3pt | 4票以上で0pt |
| 17〜20 | 5 | 12〜15 | 最大4pt | 5票以上で0pt |

- スパイ：相方（他のスパイ）を当てた +1pt／他のスパイから指名された数 1人につき +1pt（上限はスパイ数−1）
- 一般人：指名した2人が両方ともスパイで +2pt（1人のみ正解は0pt）
- 救済ルール：全員が0ptだった場合、一般人全員に +1pt

投票画面では **「誰が誰に投票したか」** を入力します。役職に応じて選べる人数を制限しており、
スパイの行は1人まで、一般人の行は2人までしか選べません。
得票数は自動集計され、合計が本来あるべき票数と一致しない場合は確認ダイアログが出ます。

ポイント集計画面は **キーワード伝達画面と同じ順番** で並び、プレイヤー名の下に投票先を細字で表示します。

## 順番の決め方（フルゲーム）

| 設定 | 動作 |
|---|---|
| 一個ずつずれる | 毎ゲーム順番が1つずれる。設定画面で番号をドラッグして入れ替え可能 |
| 最初だけランダム | 1ゲーム目のみランダム、以降は1つずつずれる |
| ランダム（被りなし） | **各プレイヤーが「まだ経験していない順番」の中からランダムに選ばれる。全部経験したらその人の履歴をリセット** |
| ランダム（被りあり） | 毎ゲーム完全ランダム |

## お題データの更新

1. `data/linq_topics.csv` を編集（A列＝No.、B列＝お題）
2. `python3 tools/embed_csv.py` を実行（`file://`／APK 用の埋め込みデータへ同期）
3. `sw.js` と `js/data.js` の `APP_VERSION` を上げる
4. No. が入れ替わる差し替えのときは `js/data.js` の `TOPICS_REV` も上げる
   （保存済みのお気に入り・除外・使用済み・履歴がリセットされ、別のお題に紐づくのを防ぎます）

アプリ内の「設定 → お題の追加、削除」からも追加・編集・削除ができます
（CSV 由来の「標準」お題は削除・編集不可）。

## 更新時の注意

- **`sw.js` と `js/data.js` の `APP_VERSION` を必ず両方上げる**こと。
  キャッシュ名にバージョンが入っており、古いキャッシュは `activate` で削除されます。
- HTML / JS / CSS はネットワーク優先、画像・CSV はキャッシュ優先です。

## GitHub での APK 化

`.github/workflows/build-apk.yml` が Capacitor で Android アプリをビルドします。
Android Studio も Mac も不要で、**GitHub 上だけで APK が作れます**。

> **はじめて GitHub を使う場合は、同梱の [`SETUP-GITHUB.md`](SETUP-GITHUB.md) に
> 画面の操作手順を1ステップずつ書いてあります。そちらを先にご覧ください。**

### セットアップ（初回のみ）

1. GitHub でリポジトリを作り、**この `linq-app/` フォルダの中身をリポジトリ直下に置いて** push
   （`index.html` がリポジトリのトップにある状態にします）
2. Settings → **Actions → General → Workflow permissions** を
   「Read and write permissions」にする（APK を `download/` へコミットするため）
3. Settings → **Pages → Source** を「**GitHub Actions**」にする（配布ページを公開する場合）

これで push するたびに自動でビルドされます。手動で回すときは
Actions タブ → **Build APK** → Run workflow。

### できあがるもの

| 場所 | 内容 |
|---|---|
| Actions の Artifacts | `linq-apk-vX.Y.Z`（毎回のビルド成果物） |
| Releases | タグ `vX.Y.Z` に APK を添付 |
| `download/linq.apk` | 配布用。Pages のダウンロードボタンが参照します |
| `download/apk-info.json` | 配布情報（バージョン・サイズ・署名種別） |

`download/apk-info.json` の `available` が `true` になると、タイトル画面に
「オフラインで使えるアプリをインストールする」ボタンが自動で表示されます
（Android のブラウザのみ。iOS・アプリ版では非表示）。手動で切り替えたいときは
`js/data.js` の `APK.mode` を `'on'` / `'off'` にしてください。

### 署名について

- **Secrets を設定しない場合**：debug 署名の APK がビルドされます。そのままインストールできます。
- **配布用に自分の鍵で署名する場合**：下記4つの Secrets を登録すると release ビルドになります。

| Secret 名 | 内容 |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | キーストアを Base64 化した文字列 |
| `ANDROID_KEYSTORE_PASSWORD` | キーストアのパスワード |
| `ANDROID_KEY_ALIAS` | 鍵のエイリアス |
| `ANDROID_KEY_PASSWORD` | 鍵のパスワード |

キーストアの作り方（ローカル、JDK付属の keytool）:

```bash
keytool -genkey -v -keystore linq.keystore -alias linq \
        -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 linq.keystore > linq.keystore.b64   # macOS は base64 -i linq.keystore -o linq.keystore.b64
```

**キーストアは絶対にリポジトリに入れないでください**（`.gitignore` で除外済み）。
一度作った鍵を失うと、同じアプリとして上書き更新できなくなります。

### ローカルでビルドする場合（任意）

Node.js 22 以上・JDK 21・Android SDK が必要です。

```bash
npm install
npm run android:add       # 初回のみ（android/ を生成）
npm run android:assets    # アイコン・スプラッシュ生成
npm run android:apk       # debug APK をビルド
# → android/app/build/outputs/apk/debug/app-debug.apk
```

### アプリの設定

| 項目 | 値 | 変更する場所 |
|---|---|---|
| アプリID | `com.linq.party` | `capacitor.config.json` |
| アプリ名 | `LINQ` | `capacitor.config.json` |
| versionName | `sw.js` の `APP_VERSION` | `sw.js` |
| versionCode | major*10000+minor*100+patch | `tools/set-android-version.mjs` |

**アプリIDは一度公開したら変更しないでください**（別アプリ扱いになります）。

## 動作確認

Chromium（headless）で以下を実機相当（390×844 / 375×667）で操作検証済み・コンソールエラーなし。

- クイックゲーム一周（順番の手動並べ替え／役職確認／キーワード入力／投票／集計／リザルト／戻る）
- フルゲーム（サドンデス発生 → サドンデス → 単独勝者、必要pt未到達 →「次のゲームへ」）
- 順番の決め方（一個ずつずれる／ランダム被りなし）、保持ポイントの引き継ぎ
- 空欄のまま進む／得票数不一致の確認ダイアログ、救済ルール
- お題リスト・追加/削除・履歴・設定、ダーク/ライト、縦横切替、`file://`（埋め込みデータ）
- ランダム（被りなし）の順番履歴（4人×6ゲームで全員が全順番を1回ずつ経験→リセット）
- キーワード欄の入力確定（入力中は次の人へ進まない）と対象枠の強調表示
- スパイ行の投票先1人制限、サドンデス時の設定項目の非表示、履歴の日付欄

## 変更履歴

### v1.2.0
- GitHub Actions による APK ビルド一式を追加（Capacitor 8 / Node 22 / JDK 21）
- GitHub Pages への公開ワークフローを追加
- APK用のアイコン・スプラッシュ素材（`assets/`）を追加
- タイトル画面のインストール導線を、配布情報（`download/apk-info.json`）に応じて自動表示に変更。
  APKのサイズとバージョンをインストール手順に表示
- Service Worker が `download/` をキャッシュしないよう変更

### v1.1.1
- 横画面レイアウト時の入力シートを撤去（v1.1.0 の変更を差し戻し。横画面でもテキスト欄を直接タップして入力）
- 履歴画面：行の一番右に日付欄を設け、欄の中では左寄せ（日付／時刻の2行）

### v1.1.0
- お題データを差し替え（533件・重複解消）。`TOPICS_REV` によるリセット処理を追加
- ランダム（被りなし）を「各プレイヤーが未経験の順番から選ぶ／全部経験したらリセット」に変更
- キーワード伝達画面：プレイヤー名だけ着色／対象枠をゴールド枠＋ゆっくり点滅で強調／
  入力が確定してから「入力済み」扱いに変更
- 投票画面：スパイ行は1人までに制限
- ポイント集計画面：順番どおりの並びに変更、投票先を細字で表示
- サドンデス中の設定画面から「勝利に必要なポイント数」「サドンデス」を非表示
- 履歴画面の日付表示を調整

### v1.0.0
- 初版
