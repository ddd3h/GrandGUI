# アーキテクチャ

## システム全体構成

```
┌─────────────────────────────────────────────────────────────────┐
│                        GrandGUI                                  │
│                                                                  │
│  ┌──────────────┐    ┌─────────────────────┐    ┌────────────┐  │
│  │  Data Source  │    │   FastAPI Backend    │    │  Browser   │  │
│  │              │    │                      │    │  (React)   │  │
│  │ ・Physical   │───▶│  ReceiverService     │───▶│            │  │
│  │   UART       │    │  ・受信              │ WS │  Telemetry │  │
│  │ ・Virtual    │    │  ・パース            │───▶│  Store     │  │
│  │   UART(socat)│    │  ・DB保存            │    │  (Zustand) │  │
│  │ ・Simulator  │    │  ・WS broadcast      │    │            │  │
│  └──────────────┘    │                      │    │  ┌───────┐ │  │
│                      │  SQLite (WAL)        │    │  │Widgets│ │  │
│                      │  ・telemetry_raw     │◀───│  │Map    │ │  │
│                      │  ・telemetry_points  │ REST│  │Graph  │ │  │
│                      │  ・uart_profiles     │    │  │Status │ │  │
│                      │  ・dashboards        │    │  └───────┘ │  │
│                      │  ・widgets           │    │            │  │
│                      │  ・offline_map_pkgs  │    └────────────┘  │
│                      │                      │                    │
│                      │  Offline Maps        │                    │
│                      │  ・MBTiles (JPEG)    │                    │
│                      │  ・タイル配信        │                    │
│                      └─────────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
```

## データフロー詳細

### 1. データ受信フロー (リアルタイム)

```
UART line 受信
    │
    ▼
UartReceiver._on_line(line)
    │
    ▼
ReceiverService._on_line(line, source_type, port_name)
    │
    ├─▶ TelemetryRaw に保存 (raw_line, parse_ok, error_message)
    │
    ├─▶ parse_line(line, profile_dict)
    │       └─ delimiters で分割
    │       └─ 各フィールドを cast_field() で型変換
    │       └─ key_value_string は "Key:Value" → value を抽出
    │
    ├─▶ normalize_to_point(parsed, fields)
    │       └─ is_latitude/is_longitude/is_altitude で固定カラムに配置
    │       └─ 既知キー(rssi, mode等)は固定カラムへ
    │       └─ 未知キーは payload_json に格納
    │
    ├─▶ TelemetryPoint に保存
    │
    └─▶ WebSocketManager.broadcast_telemetry(data)
            └─ 全接続クライアントに JSON 送信
```

### 2. フロントエンド受信フロー

```
WebSocket onmessage(event)
    │
    ▼
JSON.parse(event.data) → WsMessage { type: 'telemetry', data: TelemetryPoint }
    │
    ▼
useTelemetryStore.setLatest(point)    ← GraphWidget, StatusWidget が購読
useTelemetryStore.appendHistory(point) ← MapWidget, GraphWidget が購読
    │
    ▼
React re-render (Zustand の shallow 比較でのみ再描画)
```

### 3. 初期ロードフロー

```
ブラウザ初回アクセス
    │
    ├─▶ GET /api/dashboard → ウィジェット一覧を取得
    ├─▶ GET /api/telemetry/history → 直近100件を取得
    └─▶ WebSocket ws://localhost:8000/ws/telemetry を接続
            └─ 以降はリアルタイムで受信
```

## ファイル構成

```
grandGUI/
├── backend/
│   ├── app/
│   │   ├── main.py              ← FastAPI エントリーポイント、DB初期化、シード
│   │   ├── api/                 ← REST API ルーター群
│   │   │   ├── serial.py        ← /api/serial/* (接続制御)
│   │   │   ├── profiles.py      ← /api/profiles/* (UARTプロファイル)
│   │   │   ├── telemetry.py     ← /api/telemetry/* (データ取得・エクスポート)
│   │   │   ├── dashboard.py     ← /api/dashboard/*, /api/widgets/*
│   │   │   └── maps.py          ← /api/maps/* (オフライン地図)
│   │   ├── core/                ← ビジネスロジック
│   │   │   ├── receiver_service.py ← メインパイプライン (受信→解析→保存→配信)
│   │   │   ├── uart_receiver.py    ← UART抽象層 (physical/virtual/simulator)
│   │   │   ├── parser.py           ← プロファイル駆動パーサー
│   │   │   ├── simulator.py        ← 内蔵テレメトリシミュレーター
│   │   │   └── websocket_manager.py ← WebSocket接続管理
│   │   ├── db/
│   │   │   ├── models.py        ← SQLAlchemy ORM モデル (10テーブル)
│   │   │   └── base.py          ← DB接続・セッション
│   │   └── schemas/             ← Pydantic レスポンススキーマ
│   ├── tests/
│   │   ├── test_api.py          ← REST API テスト (43件)
│   │   ├── test_parser.py       ← パーサーテスト (14件)
│   │   └── test_simulator.py    ← シミュレーターテスト (4件)
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── api/client.ts        ← 全APIエンドポイントの型安全ラッパー
│   │   ├── stores/
│   │   │   ├── telemetryStore.ts ← テレメトリデータ + WebSocket管理
│   │   │   └── uiStore.ts        ← UI設定 (localStorage永続化)
│   │   ├── components/
│   │   │   ├── layout/Header.tsx ← ナビゲーション (モバイル対応ハンバーガーメニュー)
│   │   │   └── widgets/
│   │   │       ├── WidgetCard.tsx   ← dnd-kit ソータブルラッパー + リサイズ
│   │   │       ├── MapWidget.tsx    ← MapLibre GL JS + オフライン衛星 + GPS
│   │   │       ├── GraphWidget.tsx  ← ECharts タイムシリーズ
│   │   │       └── StatusWidget.tsx ← ステータスカードグリッド
│   │   ├── pages/               ← 各タブのページコンポーネント
│   │   ├── types/index.ts       ← 全TypeScript型定義
│   │   └── test/                ← Vitest テスト (37件)
│   └── package.json
│
├── tools/
│   └── virtual_uart_sender.py   ← socat仮想UART送信ツール
│
├── start.sh         ← macOS/Linux 本番起動
├── start-dev.sh     ← macOS/Linux 開発起動
├── start.bat        ← Windows 本番起動 (CMD)
├── start-dev.bat    ← Windows 開発起動 (CMD)
├── start.ps1        ← Windows 本番起動 (PowerShell)
└── start-dev.ps1    ← Windows 開発起動 (PowerShell)
```

## 重要な設計上の制約

### タイムスタンプの扱い
Python の `datetime.utcnow().isoformat()` はタイムゾーン指定なしの文字列を返す。
JavaScript はこれをローカル時刻として解釈するため、UTC+9 環境では9時間ずれが生じる。

**対処**:
- バックエンド: broadcast 時に `.isoformat() + "Z"` で UTC を明示
- フロントエンド: `parseUtcMs()` 関数でタイムゾーン指定なし文字列に `Z` を付加して UTC として解釈

### WebSocket の再接続
`telemetryStore.ts` がモジュールロード時に WebSocket を自動接続し、切断時に 3 秒後に自動再接続する。
サーバーが再起動しても自動回復する。

### MBTiles タイル形式の自動判定
`_mbtiles_tile_format()` はメタデータテーブルの `format` フィールドを読み取る。
存在しない場合はタイルの先頭バイトを検査して JPEG/PNG/WebP/PBF を判定する。
