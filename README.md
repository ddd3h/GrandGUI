# GrandGUI

UART テレメトリデータをリアルタイムでブラウザ表示するローカル Web アプリケーション。  
地図・グラフ・ステータスウィジェットを備え、設定駆動でデータフォーマットを自由に変更できる。

![Python](https://img.shields.io/badge/Python-3.10%2B-3776ab?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-WAL-003b57?logo=sqlite&logoColor=white)
![MapLibre GL JS](https://img.shields.io/badge/MapLibre_GL_JS-5.22-396cb2)
![ECharts](https://img.shields.io/badge/ECharts-6-aa344d)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06b6d4?logo=tailwindcss&logoColor=white)
![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey?logo=windows&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow)

![](docs/img/screenshot.png)

## 目次

1. [概要](#概要)
2. [変遷](#変遷)
3. [機能一覧](#機能一覧)
4. [技術スタック](#技術スタック)
5. [ディレクトリ構成](#ディレクトリ構成)
6. [クイックスタート（使う人向け）](#クイックスタート使う人向け)
7. [開発環境セットアップ（開発者向け）](#開発環境セットアップ開発者向け)
8. [画面ガイド](#画面ガイド)
9. [UART データフォーマット設定](#uart-データフォーマット設定)
10. [シミュレーターモード](#シミュレーターモード)
11. [仮想 UART（socat）でのテスト](#仮想-uartsocat-でのテスト)
12. [オフライン衛星地図](#オフライン衛星地図)
13. [API リファレンス](#api-リファレンス)
14. [データベース設計](#データベース設計)
15. [データフロー](#データフロー)
16. [テスト](#テスト)
17. [環境変数](#環境変数)
18. [Windows / Linux での実行](#windows--linux-での実行)
19. [よくある質問](#よくある質問)
20. [トラブルシューティング](#トラブルシューティング)
21. [開発者向けドキュメント](#開発者向けドキュメント)
22. [Contributors](#Contributors)

---

## 概要

GrandGUI は、ローカル PC 上で動作する UART テレメトリ可視化ツールです。  
PC に接続したシリアルデバイス（GPS・センサー等）から 1 秒程度の周期で送られてくる 1 行テキストを受信し、次の処理を自動で行います。

```
UART受信 → パース → SQLite保存 → WebSocket配信 → ブラウザリアルタイム表示
```

スマートフォンや別 PC からもブラウザ経由でアクセスできます。  
事前にオフライン地図を登録しておけば、インターネット非接続環境でも地図を表示できます。

### 対応入力ソース

| ソース | 説明 |
|--------|------|
| **Simulator** | アプリ内蔵の疑似データ生成器。実機不要で動作確認ができる |
| **Physical Serial** | 実際の UART デバイスを COM ポート / tty デバイスとして接続 |
| **Virtual Serial** | `socat` で作成した仮想ポートペア経由で接続 |

## 変遷

GrandGUIの初代バージョンは「ANCO-project2022」に開発された地上局のテレメトリ監視用のGUIです。このGUIは [GroundSystem GUI Project](https://github.com/Akatoki-Saidai/GroundSystem_GUI_Project) と呼ばれ、多くのプロジェクト・チーム・団体から愛され利用されてきました。

<p align="center">
  <a href="https://github.com/Akatoki-Saidai/GroundSystem_GUI_Project">
    <img src="https://socialify.git.ci/Akatoki-Saidai/GroundSystem_GUI_Project/image?font=Jost&forks=1&issues=1&language=1&name=1&owner=1&pattern=Solid&pulls=1&stargazers=1&theme=Auto" width=80% />
  </a>
</p>

このプロジェクトの精神を引き継ぎ、より誰でも自由に簡単に利用できるシステムの開発を行ったものになります。 

それを踏まえ、[GroundSystem GUI Project](https://github.com/Akatoki-Saidai/GroundSystem_GUI_Project) で開発、テスターとしてさらには利用者の声を挙げてくれた方々に敬意を表します。

<p align="center">
  <a href="">
    <img src="docs/img/takashin9.webp" width="70px;" alt="takashin9" style="border-radius:50%;" />
  </a>
  <a href="">
    <img src="docs/img/anco.png" width="70px;" alt="ANCO-project" style="border-radius:50%;" />
  </a>
  <a href="">
    <img src="docs/img/aktk.jpg" width="70px;" alt="あかとき" style="border-radius:50%;" />
  </a>
  <a href="">
    <img src="docs/img/naft.png" width="70px;" alt="ddd3h" style="border-radius:50%;" />
  </a>
  <a href="">
    <img src="docs/img/soraurushi.webp" width="70px;" alt="ddd3h" style="border-radius:50%;" />
  </a>
  <a href="">
    <img src="docs/img/nanyo.png" width="70px;" alt="ddd3h" style="border-radius:50%;" />
  </a>
</p>

## 機能一覧

| カテゴリ | 機能 |
|---------|------|
| **受信** | UART 受信・仮想UART・シミュレーター（共通後処理） |
| **地図** | MapLibre GL JS によるリアルタイム現在位置・軌跡表示 |
| **グラフ** | ECharts によるリアルタイム折れ線グラフ（時間窓: 1m/5m/15m/全件） |
| **ステータス** | モード・バッテリー・WiFi・GNSS 等の色分けカード表示 |
| **ダッシュボード** | ウィジェットのドラッグ&ドロップ並び替え・レイアウト永続化 |
| **プロファイル** | UART 区切り文字・項目型・役割をGUIで定義・複数保存 |
| **履歴** | 期間指定検索・CSV/JSON エクスポート |
| **オフライン地図** | PMTiles / MBTiles ファイルのアップロード・管理 |
| **座標表示** | 10進数 / 度分秒（DMS）表示をワンクリックで切替 |
| **モバイル対応** | レスポンシブ UI（スマートフォン・タブレット閲覧可） |


## 技術スタック

### バックエンド

| ライブラリ | バージョン | 用途 |
|-----------|-----------|------|
| Python | 3.12+ | ランタイム |
| FastAPI | 0.115 | REST API + WebSocket |
| Uvicorn | 0.32 | ASGI サーバー |
| pySerial | 3.5 | シリアルポート制御 |
| SQLAlchemy | 2.0 | ORM |
| Alembic | 1.14 | DB マイグレーション |
| SQLite | — | ローカルデータベース（WAL モード） |
| Pydantic | 2.10 | スキーマバリデーション |

### フロントエンド

| ライブラリ | バージョン | 用途 |
|-----------|-----------|------|
| React | 19 | UI フレームワーク |
| TypeScript | 5.9 | 型安全 |
| Vite | 8 | ビルドツール |
| Tailwind CSS | 4 | スタイリング |
| MapLibre GL JS | 5 | 地図描画 |
| ECharts | 6 | グラフ描画 |
| dnd-kit | 6/10 | ドラッグ&ドロップ |
| Zustand | 5 | 状態管理 |


## ディレクトリ構成

```
grandGUI/
├── backend/
│   ├── app/
│   │   ├── api/                  # REST API エンドポイント
│   │   │   ├── serial.py         # シリアル接続 API
│   │   │   ├── profiles.py       # UART プロファイル CRUD
│   │   │   ├── telemetry.py      # テレメトリ取得・エクスポート
│   │   │   ├── dashboard.py      # ダッシュボード・ウィジェット管理
│   │   │   └── maps.py           # オフライン地図パッケージ管理
│   │   ├── core/
│   │   │   ├── parser.py         # 設定駆動 UART 行パーサー
│   │   │   ├── simulator.py      # 内蔵テレメトリシミュレーター
│   │   │   ├── uart_receiver.py  # 物理/仮想/シミュ 共通受信インターフェース
│   │   │   ├── receiver_service.py  # 受信→パース→保存→配信 オーケストレーター
│   │   │   └── websocket_manager.py # WebSocket ブロードキャストマネージャー
│   │   ├── db/
│   │   │   ├── base.py           # SQLAlchemy エンジン・セッション・WAL設定
│   │   │   └── models.py         # 全 10 テーブル定義
│   │   ├── schemas/              # Pydantic スキーマ（リクエスト/レスポンス型）
│   │   └── main.py               # FastAPI アプリ・初期データシード・WebSocket エンドポイント
│   ├── tests/
│   │   ├── conftest.py           # テスト用 SQLite インメモリ DB 設定
│   │   ├── test_api.py           # REST API 統合テスト（22 ケース）
│   │   ├── test_parser.py        # パーサー単体テスト（14 ケース）
│   │   └── test_simulator.py     # シミュレーター単体テスト（4 ケース + 非同期）
│   ├── alembic/                  # DB マイグレーション定義
│   ├── requirements.txt
│   ├── alembic.ini
│   └── pytest.ini
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts         # バックエンド API クライアント（全エンドポイント）
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   └── Header.tsx    # ナビゲーション・接続状態表示
│   │   │   └── widgets/
│   │   │       ├── MapWidget.tsx      # 地図ウィジェット（MapLibre）
│   │   │       ├── GraphWidget.tsx    # グラフウィジェット（ECharts）
│   │   │       ├── StatusWidget.tsx   # ステータスカードウィジェット
│   │   │       └── WidgetCard.tsx     # ドラッグ可能ウィジェットコンテナ
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx  # メインダッシュボード（dnd-kit）
│   │   │   ├── ConnectionPage.tsx # 接続設定画面
│   │   │   ├── ProfilesPage.tsx   # UART プロファイル編集画面
│   │   │   ├── HistoryPage.tsx    # 履歴閲覧・エクスポート画面
│   │   │   ├── MapsPage.tsx       # オフライン地図管理画面
│   │   │   └── SettingsPage.tsx   # アプリ設定画面
│   │   ├── stores/
│   │   │   ├── telemetryStore.ts  # テレメトリ状態 + WebSocket 自動接続
│   │   │   └── uiStore.ts         # UI 設定（座標形式・編集モード等）
│   │   ├── types/
│   │   │   └── index.ts           # 全型定義 + toDms() 変換ユーティリティ
│   │   └── test/
│   │       ├── setup.ts           # MapLibre/WebSocket/ResizeObserver モック
│   │       ├── types.test.ts      # 座標変換テスト（5 ケース）
│   │       ├── stores.test.ts     # Zustand ストアテスト（7 ケース）
│   │       └── components.test.tsx # コンポーネントテスト（2 ケース）
│   ├── vite.config.ts             # Vite 設定（プロキシ・テスト設定）
│   └── package.json
│
├── tools/
│   └── virtual_uart_sender.py    # 仮想ポート向け疑似データ送信スクリプト
│
├── data/                         # 実行時データ（自動生成）
│   ├── grandgui.db               # SQLite データベース
│   └── maps/                     # オフライン地図ファイル格納先
│
├── start.sh                      # 本番起動スクリプト（バックエンド + ビルド済みフロント）
└── start-dev.sh                  # 開発起動スクリプト（ホットリロード）
```


## クイックスタート（使う人向け）

### 前提条件

- Python 3.12 以上
- Node.js 20 以上
- macOS / Windows / Linux

### 1. リポジトリ取得

```bash
git clone <repository-url> grandGUI
cd grandGUI
```

### 2. フロントエンドをビルドする

```bash
cd frontend
npm install
npm run build
cd ..
```

### 3. 起動

```bash
./start.sh
```

バックエンドが起動し、自動的にブラウザが開きます。  
起動後、以下の URL でアクセスできます。

| URL | 説明 |
|-----|------|
| `http://localhost:8000` | アプリ本体 |
| `http://localhost:8000/docs` | Swagger UI（API ドキュメント） |
| `http://<PCのIPアドレス>:8000` | スマートフォン・別 PC からのアクセス |

### 4. 最初の操作

1. 上部ナビゲーションの **Connection** をクリック
2. Source Type を **Simulator** のままにして **Connect** をクリック
3. **Dashboard** タブに戻る → 地図・グラフ・ステータスが更新され始める

> **メモ:** 初回起動時、デフォルトのUARTプロファイルとダッシュボードが自動生成されます。


## 開発環境セットアップ（開発者向け）

### バックエンド

```bash
cd backend

# 仮想環境作成
python3 -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate

# 依存インストール
pip install -r requirements.txt

# 起動（ホットリロード付き）
DATABASE_URL="sqlite:///../data/grandgui.db" \
MAPS_DIR="../data/maps" \
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### フロントエンド

```bash
cd frontend

# 依存インストール
npm install

# 開発サーバー起動（Vite HMR、バックエンドへプロキシ）
npm run dev
# → http://localhost:5173
```

### 同時起動（推奨）

```bash
# プロジェクトルートから
./start-dev.sh
```

バックエンド `:8000` とフロントエンド `:5173` を同時に起動します。  
フロントエンドは `/api/*` と `/ws/*` を自動的にバックエンドへプロキシします。


## 画面ガイド

### Dashboard

メイン画面。受信データをリアルタイムに表示します。

- **地図ウィジェット**: 現在位置（赤丸）と過去の軌跡（青線）を表示
  - 左上の「⊙ Follow」ボタンで現在位置への自動追従を切替
  - 手動でドラッグすると追従が自動解除される
- **グラフウィジェット**: 高度・RSSI・気圧等の時系列グラフ
  - 表示窓は 1m / 5m / 15m / 全件 から選択
- **ステータスウィジェット**: モード・バッテリー・GNSS 等をカード形式で色分け表示

ヘッダーの **Edit Layout** ボタンで編集モードに入り、カードをドラッグして並び替えができます。  
並び替え結果はサーバーに自動保存され、再起動後も維持されます。

### Connection

接続ソースの選択と接続操作を行います。

| フィールド | 説明 |
|-----------|------|
| Source Type | simulator / physical / virtual の選択 |
| Serial Port | 接続先ポート（physical/virtual 時のみ表示） |
| Baudrate | 通信速度 |
| Auto-reconnect | 切断時の自動再接続を有効化 |
| Interval | シミュレーター出力間隔（秒） |

接続中は上部ヘッダーのインジケーターが緑になります。

### Profiles

UART 受信データのパース設定を管理します。

- **区切り文字**: `,`（カンマ）、`\t`（タブ）等
- **フィールド定義**: 列番号・キー名・型・役割（地図用/グラフ用/ステータス用）を設定
- **サンプル検証**: 実際の UART 行を貼り付けて、現在の設定でどう解釈されるか確認

デフォルトプロファイルは以下のフォーマットに対応しています。

```
35.681200, 139.768100, 49.8, 1007.10, -72.5, Mode:wait, Bt:Full, Log:OFF, WiFi:OK, GNSS:unlock
```

### History

過去データの閲覧とエクスポートができます。

- 期間・件数を指定して検索
- **Export CSV / Export JSON** ボタンでダウンロード

### Maps

オフライン地図パッケージの管理を行います。  
詳細は [オフライン地図の登録](docs/offline-maps.md) を参照。

### Settings

- 座標表示形式（10進数 / 度分秒）の切替
- 設定は `localStorage` に自動保存され、再起動後も保持


## UART データフォーマット設定

GrandGUI はコードを変更せずに UART のデータ構造を変更できます。

### デフォルトのフォーマット

```
列0     列1         列2    列3       列4    列5         列6       列7       列8       列9
lat,    lon,        alt,   pressure, rssi,  Mode:wait,  Bt:Full,  Log:OFF,  WiFi:OK,  GNSS:lock
float   float       float  float     float  key:val     key:val   key:val   key:val   key:val
```

### 型の種類

| 型名 | 説明 | 例 |
|------|------|----|
| `float` | 浮動小数点数 | `35.6812`, `-70.5` |
| `int` | 整数 | `100`, `-17` |
| `string` | 文字列そのまま | `active`, `lock` |
| `key_value_string` | `Key:Value` 形式（値のみ取り出す） | `Mode:active` → `active` |

### フィールド定義のカラム（Profiles 画面）

| カラム | 説明 |
|--------|------|
| `#` | 列番号（0 始まり） |
| `Key` | 内部キー名（英数字・アンダースコア） |
| `Label` | 表示名 |
| `Type` | 型（上表参照） |
| `Lat` | この列を緯度として使用 |
| `Lon` | この列を経度として使用 |
| `Alt` | この列を高度として使用 |
| `Map` | 地図に表示 |
| `Graph` | グラフに表示 |
| `Status` | ステータスカードに表示 |

### 設定変更後のサンプル検証

Profiles 画面の「Validate Sample Line」欄に実際の受信行を貼り付けて「Test」を押すと、
現在のプロファイルでどう解釈されるかを JSON 形式で確認できます。

```json
{
  "latitude": 35.6812,
  "longitude": 139.7671,
  "altitude": 50.0,
  "mode": "active",
  "battery": "Full"
}
```


## シミュレーターモード

実機なしで動作確認できます。  
内部で次のようなデータを 1 秒ごとに生成します。

```
35.681200, 139.768100, 49.8, 1007.10, -72.5, Mode:wait, Bt:Full, Log:OFF, WiFi:OK, GNSS:unlock
```

- **緯度・経度**: 東京駅付近を中心に円形軌道で移動
- **高度**: sin 波で変化（40〜60m 程度）
- **気圧**: 高度に連動して変化
- **RSSI**: -60 〜 -80 dBm 程度でゆらぐ
- **モード**: wait / active / sleep / transmit を順に遷移
- **バッテリー**: Full → High → Middle → Low と段階的に変化
- **GNSS**: 最初の数ステップは `unlock`、その後 `lock`

### 起動方法

Connection 画面で Source Type を `simulator` に設定して Connect をクリックするだけです。  
`simulator_interval` スライダーで出力間隔（0.1〜10秒）を調整できます。


## 仮想 UART（socat）でのテスト

実機に近い条件でテストする場合は `socat` を使った仮想ポートペアを利用します。

### 1. socat のインストール

```bash
# macOS
brew install socat

# Ubuntu / Debian
sudo apt install socat
```

### 2. 仮想ポートペアの作成

```bash
socat -d -d pty,raw,echo=0 pty,raw,echo=0
```

出力例:

```
2024/01/01 12:00:00 socat[1234] N PTY is /dev/ttys003
2024/01/01 12:00:00 socat[1234] N PTY is /dev/ttys004
```

この 2 つのポートがペアになっています。片方に書き込むともう片方から読めます。

### 3. 疑似データを送信する

```bash
python3 tools/virtual_uart_sender.py /dev/ttys003 1.0
```

| 引数 | デフォルト | 説明 |
|------|-----------|------|
| 第1引数 | `/dev/ttys003` | 送信側ポート |
| 第2引数 | `1.0` | 送信間隔（秒） |

### 4. GrandGUI で受信する

Connection 画面で以下を設定して Connect:

| 項目 | 値 |
|------|-----|
| Source Type | physical または virtual |
| Serial Port | `/dev/ttys004`（送信側と反対のポート） |
| Baudrate | `9600` |


## オフライン衛星地図

インターネット非接続環境でも衛星画像を表示できます。**MBTiles（ラスターJPEG/PNG）** 形式を使用します。

### MBTiles の作成方法

**QGIS（推奨・無料）**:
1. QGIS に衛星XYZタイルレイヤ（ESRI World Imagery 等）を追加
2. 対象エリアにズームイン
3. Processing → "Generate XYZ tiles (MBTiles)" を実行
4. ズーム範囲: z10〜17 程度、Output format: JPEG

**gdal2tiles + mb-util**:
```bash
gdal2tiles.py -z 10-17 satellite.tif ./tiles/
mb-util --image_format=jpg ./tiles/ output.mbtiles
```

詳細は [docs/offline-maps.md](./docs/offline-maps.md) を参照。

### GrandGUI への登録手順

1. Maps 画面を開く
2. パッケージ名を入力（例: `tokyo-satellite-z14`）
3. `.mbtiles` ファイルを選択して **アップロード**
4. アップロード完了後、**有効化** をクリック
5. ダッシュボードのマップで 🛰 衛星 ボタンを押すと **[オフライン]** が表示される

### 動作の確認

マップの衛星ボタンが緑色の **🛰 衛星 [オフライン]** になれば、ローカルMBTilesから配信されています。

### 注意事項

- ファイルは `data/maps/` に保存されます
- 複数パッケージを登録できますが、アクティブにできるのは 1 つのみです
- ズームレベルが高いほどファイルサイズが急増します（z10〜17の東京全域で数GB）
- タイル形式（JPEG/PNG/WebP/PBF）はMBTilesメタデータから自動判定されます


## API リファレンス

バックエンドの全 API は `http://localhost:8000/docs` で Swagger UI を通じて試せます。

### シリアル関連

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/api/serial/ports` | 利用可能なシリアルポート一覧 |
| `POST` | `/api/serial/connect` | 接続開始 |
| `POST` | `/api/serial/disconnect` | 接続停止 |
| `GET` | `/api/serial/status` | 現在の接続状態 |

`POST /api/serial/connect` リクエスト例:

```json
{
  "source_type": "simulator",
  "baudrate": 9600,
  "simulator_interval": 1.0,
  "auto_reconnect": false
}
```

```json
{
  "source_type": "physical",
  "port_name": "/dev/ttyUSB0",
  "baudrate": 115200,
  "data_bits": 8,
  "stop_bits": 1.0,
  "parity": "N",
  "auto_reconnect": true,
  "reconnect_interval": 5
}
```

### プロファイル関連

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/api/profiles` | プロファイル一覧 |
| `POST` | `/api/profiles` | プロファイル作成 |
| `GET` | `/api/profiles/{id}` | プロファイル取得 |
| `PATCH` | `/api/profiles/{id}` | プロファイル更新 |
| `DELETE` | `/api/profiles/{id}` | プロファイル削除 |
| `POST` | `/api/profiles/{id}/validate-sample` | サンプル行の検証 |

### テレメトリ関連

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/api/telemetry/latest` | 最新テレメトリ 1 件 |
| `GET` | `/api/telemetry/history` | 履歴一覧（クエリ: `start`, `end`, `limit`, `offset`） |
| `GET` | `/api/telemetry/export` | CSV/JSON エクスポート（クエリ: `format`, `start`, `end`） |

`GET /api/telemetry/history` クエリパラメーター例:

```
/api/telemetry/history?start=2024-01-01T00:00:00&end=2024-01-02T00:00:00&limit=500
```

### ダッシュボード関連

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/api/dashboard` | ダッシュボード一覧 |
| `POST` | `/api/dashboard` | ダッシュボード作成 |
| `PATCH` | `/api/dashboard/layout` | レイアウト一括更新 |
| `POST` | `/api/widgets` | ウィジェット追加 |
| `PATCH` | `/api/widgets/{id}` | ウィジェット更新 |
| `DELETE` | `/api/widgets/{id}` | ウィジェット削除 |

### 地図関連

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/api/maps/active` | アクティブパッケージ情報 (is_raster, tile_url_template 含む) |
| `GET` | `/api/maps/offline-packages` | パッケージ一覧 |
| `POST` | `/api/maps/offline-packages` | パッケージアップロード（multipart） |
| `POST` | `/api/maps/offline-packages/{id}/activate` | パッケージ有効化 |
| `POST` | `/api/maps/offline-packages/{id}/deactivate` | パッケージ無効化 |
| `DELETE` | `/api/maps/offline-packages/{id}` | パッケージ削除 |
| `GET` | `/api/maps/tiles/{package_id}/{z}/{x}/{y}` | タイル配信（ラスター/ベクター自動判定） |

### WebSocket

```
ws://localhost:8000/ws/telemetry
```

受信メッセージ形式（`type: "telemetry"` の場合）:

```json
{
  "type": "telemetry",
  "timestamp": "2024-01-01T12:00:00.000000",
  "data": {
    "id": 42,
    "received_at": "2024-01-01T12:00:00",
    "latitude": 35.6812,
    "longitude": 139.7671,
    "altitude": 50.0,
    "barometric_pressure": 1013.25,
    "rssi": -70.5,
    "mode": "active",
    "battery": "Full",
    "logging_status": "ON",
    "wifi_status": "OK",
    "gnss_status": "lock",
    "payload_json": {},
    "raw_line": "35.681200, 139.767100, ..."
  }
}
```


## データベース設計

SQLite（WAL モード）を使用します。  
データファイルは `data/grandgui.db` に保存されます。

### テーブル一覧

| テーブル名 | 説明 |
|-----------|------|
| `uart_profiles` | UART フォーマット定義 |
| `uart_profile_fields` | 各フィールドの詳細設定 |
| `serial_connections` | 接続設定・最終接続状態 |
| `telemetry_raw` | 受信生データ（パース失敗行も保存） |
| `telemetry_points` | 正規化テレメトリ（地図・グラフ・ステータス用） |
| `dashboards` | ダッシュボード定義 |
| `widgets` | ウィジェット定義 |
| `widget_layouts` | ウィジェットの配置情報（デバイス別） |
| `offline_map_packages` | オフライン地図パッケージ管理 |
| `app_settings` | アプリ全体設定（KV ストア） |

### telemetry_raw と telemetry_points の関係

受信した生データはすべて `telemetry_raw` に保存されます（パース失敗も含む）。  
パース成功時のみ、正規化データが `telemetry_points` にも保存されます。

```
telemetry_raw (raw_id) ──1:0..1──> telemetry_points
```

既知フィールド（latitude, longitude 等）は専用カラムに、未知フィールドは `payload_json` に格納されます。


## データフロー

```
                   ┌─────────────────────────────────────┐
                   │           UartReceiver               │
   Physical UART ──┤  (physical / virtual / simulator)    │
   Virtual UART  ──┤  共通インターフェース: line_callback  │
   Simulator     ──┤                                      │
                   └──────────────┬──────────────────────┘
                                  │ 1行テキスト
                                  ▼
                   ┌─────────────────────────────────────┐
                   │          ReceiverService             │
                   │                                      │
                   │  1. 受信時刻付与                     │
                   │  2. アクティブプロファイルで parse   │
                   │  3. telemetry_raw に保存（常時）     │
                   │  4. 正規化 → telemetry_points に保存 │
                   │  5. WebSocket でブロードキャスト     │
                   └──────────────┬──────────────────────┘
                                  │ JSON
                                  ▼
                   ┌─────────────────────────────────────┐
                   │        WebSocketManager              │
                   │  接続中の全クライアントへ配信        │
                   └──────────────┬──────────────────────┘
                                  │ WS: /ws/telemetry
                                  ▼
                   ┌─────────────────────────────────────┐
                   │         ブラウザ（React）            │
                   │  telemetryStore.appendHistory()      │
                   │  → MapWidget（軌跡・現在位置更新）   │
                   │  → GraphWidget（データ点追加）       │
                   │  → StatusWidget（最新値更新）        │
                   └─────────────────────────────────────┘
```


## テスト

### バックエンドテスト

```bash
cd backend
DATABASE_URL="sqlite:///./test.db" .venv/bin/python -m pytest -v
```

| テストファイル | 内容 | ケース数 |
|---------------|------|---------|
| `test_api.py` | REST API 統合テスト（全エンドポイント） | 22 |
| `test_parser.py` | UART パーサー単体テスト | 14 |
| `test_simulator.py` | シミュレーター単体テスト（非同期含む） | 4 |
| **合計** | | **43** |

### フロントエンドテスト

```bash
cd frontend
npm test
```

| テストファイル | 内容 | ケース数 |
|---------------|------|---------|
| `types.test.ts` | `toDms()` 座標変換テスト | 5 |
| `stores.test.ts` | Zustand ストアの動作テスト | 7 |
| `components.test.tsx` | StatusWidget レンダリングテスト | 2 |
| **合計** | | **13** |

### テスト実行の全体確認

```bash
# バックエンド
cd backend && .venv/bin/python -m pytest -v

# フロントエンド
cd ../frontend && npm test
```

期待される結果:
```
backend:  43 passed
frontend: 37 passed
```


## 環境変数

| 変数名 | デフォルト | 説明 |
|--------|-----------|------|
| `DATABASE_URL` | `sqlite:///./data/grandgui.db` | SQLAlchemy 接続 URL |
| `MAPS_DIR` | `./data/maps` | オフライン地図ファイルの保存先 |

### 例: 別の DB パスを使用する

```bash
DATABASE_URL="sqlite:////home/user/myapp.db" uvicorn app.main:app
```

### 例: PostgreSQL を使用する（将来拡張）

SQLAlchemy 互換のため、PostgreSQL URL を指定することで切り替えが可能です。

```bash
DATABASE_URL="postgresql://user:pass@localhost/grandgui" uvicorn app.main:app
```


## Windows / Linux での実行

### Windows

**ワンクリック起動（推奨）**:

| スクリプト | 用途 | 実行方法 |
|---|---|---|
| `start.bat` | 本番起動 (CMD) | ダブルクリック or `start.bat` |
| `start-dev.bat` | 開発起動 (CMD) | ダブルクリック or `start-dev.bat` |
| `start.ps1` | 本番起動 (PowerShell) | `powershell -ExecutionPolicy Bypass -File start.ps1` |
| `start-dev.ps1` | 開発起動 (PowerShell) | `powershell -ExecutionPolicy Bypass -File start-dev.ps1` |

`start.bat` / `start.ps1`: フロントエンドをビルドして http://localhost:8000 で起動  
`start-dev.bat` / `start-dev.ps1`: バックエンド (8000) とフロントエンドdev (5173) を別ウィンドウで起動

**手動起動**:

```powershell
# バックエンド
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

$env:DATABASE_URL = "sqlite:///../data/grandgui.db"
$env:MAPS_DIR = "../data/maps"
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

シリアルポートは `COM3`, `COM4` 等の形式で自動検出されます。  
デバイスマネージャーで実際のポート名を確認してから Connection 画面で選択してください。

### Linux

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

DATABASE_URL="sqlite:///../data/grandgui.db" \
MAPS_DIR="../data/maps" \
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

シリアルポートは `/dev/ttyUSB0`, `/dev/ttyACM0` 等として認識されます。  
アクセス権限が必要な場合:

```bash
sudo usermod -aG dialout $USER
# 一度ログアウト・ログインが必要
```

### フロントエンド（共通）

```bash
cd frontend
npm install
npm run build
```

ビルド後のファイルは `frontend/dist/` に出力されます。  
バックエンドが自動的にこのディレクトリを静的ファイルとして配信します。


## よくある質問

### Q. スマートフォンからアクセスするにはどうすればいいですか？

PC と スマートフォンが同じ Wi-Fi ネットワークに接続されていることを確認し、  
PC の IP アドレスを使って `http://<PC-IPアドレス>:8000` にアクセスしてください。

PC の IP アドレスの確認方法:
- macOS: `ipconfig getifaddr en0`
- Windows: `ipconfig` → IPv4 アドレス
- Linux: `ip addr show`

### Q. 受信データを後から別のプロファイルで再解釈できますか？

現時点では、生データ（`telemetry_raw` テーブル）はすべて保存されています。  
プロファイルを変更後、API 経由で生データを再取得し手動でパースするか、  
将来的な「一括再解釈」機能の追加で対応予定です。

### Q. データはどこに保存されていますか？

`data/grandgui.db`（SQLite）に保存されます。  
このファイルをバックアップすることで全データを保全できます。

### Q. 軌跡の最大保持件数はどうなっていますか？

フロントエンドの `telemetryStore` は最大 **1000 点** を RAM 上に保持します（超えると古いものから削除）。  
データベース上はすべて保持されます。  
ウィジェットの `trackLength` 設定（デフォルト 500）で地図に描画する件数を絞れます。

### Q. セキュリティはどうなっていますか？

現在は認証なしのローカルネットワーク利用を想定しています。  
公開ネットワークへの露出は避けてください。  
将来的に Basic 認証などの追加を検討しています。


## トラブルシューティング

### バックエンドが起動しない

```
ModuleNotFoundError: No module named 'fastapi'
```

仮想環境がアクティブになっているか確認してください。

```bash
cd backend
source .venv/bin/activate  # または .venv\Scripts\activate
```


### シリアルポートに接続できない

```
serial.SerialException: [Errno 2] No such file or directory: '/dev/ttyUSB0'
```

1. デバイスが接続されているか確認
2. Connection 画面の「↻」ボタンでポート一覧を再読み込み
3. Linux の場合はユーザーに `dialout` グループの権限があるか確認


### 地図が表示されない

- インターネット接続がある場合: OpenStreetMap タイルが読み込まれるはずです。ブラウザのコンソールを確認してください。
- オフライン環境: Maps 画面でオフライン地図パッケージが **Activate** されているか確認してください。


### WebSocket が接続できない

フロントエンド開発サーバー（`:5173`）を使用している場合、`vite.config.ts` の proxy 設定が正しいか確認してください。

```
ws://localhost:5173/ws/telemetry → ws://localhost:8000/ws/telemetry
```


### テストが失敗する

```bash
# テスト用 DB が残っている場合
cd backend && rm -f test.db
.venv/bin/python -m pytest -v
```


### ポート 8000 が使用中

```bash
# macOS / Linux
lsof -i :8000
kill -9 <PID>

# 別のポートで起動
uvicorn app.main:app --port 8001
```

フロントエンドのプロキシ設定（`vite.config.ts`）も合わせて変更が必要です。

## 開発者向けドキュメント

詳細な開発者向けドキュメントは [`docs/`](./docs/) ディレクトリにあります。

| ドキュメント | 内容 |
|---|---|
| [docs/architecture.md](./docs/architecture.md) | システムアーキテクチャ・データフロー全体図 |
| [docs/backend.md](./docs/backend.md) | バックエンド構造・全APIエンドポイント・DB設計 |
| [docs/frontend.md](./docs/frontend.md) | フロントエンド構造・コンポーネント・状態管理 |
| [docs/uart-profile.md](./docs/uart-profile.md) | UARTプロファイル設定・パーサー詳細 |
| [docs/widgets.md](./docs/widgets.md) | ウィジェットシステム・新規ウィジェット追加方法 |
| [docs/offline-maps.md](./docs/offline-maps.md) | オフライン衛星地図・MBTiles作成方法 |
| [docs/testing.md](./docs/testing.md) | テスト戦略・テストの追加方法 |


## Contributors

<table>
  <tr>
    <td align="left">
      <a href="https://github.com/ddd3h">
        <img src="docs/img/ddd3h.jpg" width="100px;" style="border-radius:50%;" alt="ddd3h"/>
      </a>
      <div align="center">
        <sub><b>ddd3h</b></sub><br>
        <img src="https://img.shields.io/badge/GitHub-Profile-181717?logo=github&style=flat-square">
      </div>
    </td>
  </tr>
</table>