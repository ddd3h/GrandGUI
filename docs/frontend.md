# フロントエンド詳細

## 技術スタック

| ライブラリ | バージョン | 用途 |
|---|---|---|
| React | 19 | UIフレームワーク |
| TypeScript | 5.9 | 型安全 |
| Vite | 8 | ビルドツール・開発サーバー |
| Tailwind CSS | 4 | スタイリング |
| Zustand | 5 | 状態管理 |
| MapLibre GL JS | 5.22 | 地図表示 |
| ECharts | 6 | グラフ描画 |
| dnd-kit | 6/10 | ドラッグ&ドロップ |
| Vitest | 4 | テスト |

## ディレクトリ構成

```
frontend/src/
├── api/
│   └── client.ts          ← 全APIエンドポイントの型安全ラッパー
├── components/
│   ├── layout/
│   │   └── Header.tsx     ← ナビゲーション (モバイル対応)
│   └── widgets/
│       ├── WidgetCard.tsx  ← dnd-kit ソータブルコンテナ + マップリサイズ
│       ├── MapWidget.tsx   ← MapLibre GL + 衛星切替 + GPS + オフライン
│       ├── GraphWidget.tsx ← ECharts タイムシリーズ
│       └── StatusWidget.tsx← ステータスカードグリッド
├── pages/
│   ├── DashboardPage.tsx  ← ウィジェットグリッド + dnd-kit
│   ├── ConnectionPage.tsx ← UART接続設定
│   ├── ProfilesPage.tsx   ← UARTプロファイル編集
│   ├── HistoryPage.tsx    ← テレメトリ履歴テーブル
│   ├── MapsPage.tsx       ← オフライン地図管理
│   └── SettingsPage.tsx   ← アプリ設定
├── stores/
│   ├── telemetryStore.ts  ← テレメトリデータ + WebSocket
│   └── uiStore.ts         ← UI設定 (localStorage永続化)
├── types/
│   └── index.ts           ← 全TypeScript型定義
└── test/
    ├── setup.ts            ← Vitest セットアップ (モック定義)
    ├── types.test.ts       ← toDms() 変換テスト
    ├── stores.test.ts      ← Zustand ストアテスト
    ├── components.test.tsx ← コンポーネントテスト
    ├── graphFilter.test.ts ← タイムスタンプフィルターテスト
    └── graphWidget.test.tsx← GraphWidget 統合テスト
```

## 状態管理

### `telemetryStore.ts`

```typescript
interface TelemetryState {
  latest: TelemetryPoint | null;  // 最新の1点
  history: TelemetryPoint[];      // 直近1000点まで
  serialStatus: SerialStatus;     // 接続状態
  wsConnected: boolean;           // WebSocket接続状態
}
```

**WebSocket の自動管理**:
- モジュールロード時に自動接続 (`connectWs()`)
- 切断時に3秒後に自動再接続
- 接続済みなら二重接続しない

**重要**: `history` は最大1000件でキャップされる。古いものから削除される。

### `uiStore.ts`

```typescript
interface UiState {
  coordFormat: 'decimal' | 'dms'; // 座標表示形式
  editMode: boolean;              // ウィジェット編集モード
  activeTab: string;              // 現在のタブ
  mapFollowCurrent: boolean;      // テレメトリ位置追従
}
```

`persist` ミドルウェアで `localStorage` に保存される。リロード後も設定が保持される。

## コンポーネント詳細

### Header.tsx

**モバイル対応**:
- `md:` 以上: ナビゲーションタブを横並び表示
- `md:` 未満: ハンバーガーボタンを表示、タップで縦メニューを展開

```
[GrandGUI] [Dashboard] [Connection] [Profiles] ...    [Edit] [WS●] [Serial●]  ← デスクトップ
[GrandGUI]                                            [WS●] [●]  [☰]         ← モバイル
                                                                               ↓ 展開時
                          [Dashboard    ]
                          [Connection   ]
                          [Profiles     ]
                          ...
```

### WidgetCard.tsx

- `useSortable` (dnd-kit) でドラッグ&ドロップをサポート
- `editMode` でドラッグハンドルと削除ボタンを表示/非表示
- マップウィジェットのみ下端ドラッグリサイズ対応
  - `mapHeight` state (デフォルト 420px)
  - `CHROME_HEIGHT = 53px` (ヘッダー + リサイズハンドル) を加算してカード高さを明示

### MapWidget.tsx

**初期化フロー**:
1. `api.getActiveMapPackage()` でアクティブなオフラインパッケージを取得
2. MapLibre を初期化 (OSM + ESRI衛星 + オフライン衛星ソースを設定)
3. アクティブパッケージが変化した場合 `satellite-offline` ソース/レイヤーを動的追加

**レイヤー構成**:
```
osm-tiles            ← OpenStreetMap (デフォルト表示)
satellite-online-tiles ← ESRI World Imagery (衛星ONライン時)
satellite-offline-tiles ← ローカルMBTiles (オフライン時)
track-line           ← テレメトリ軌跡ライン
track-points         ← テレメトリ履歴点
[marker]             ← 現在位置 (赤い丸)
[gps-marker]         ← ブラウザGPS位置 (青い脈動ドット)
```

**衛星切替ロジック**:
```
mapStyle === 'satellite' かつ activePkg?.is_raster
  → satellite-offline-tiles を表示 (緑ボタン)
mapStyle === 'satellite' かつ オフラインなし
  → satellite-online-tiles を表示 (黄ボタン)
mapStyle === 'osm'
  → osm-tiles を表示
```

### GraphWidget.tsx

**タイムスタンプのバグ修正**:

Python の `datetime.utcnow().isoformat()` は `"2026-04-05T01:00:00"` (タイムゾーン指定なし) を返す。
JavaScript はこれをローカル時刻として解釈し、UTC+9では9時間ずれる。

```typescript
// 修正後: タイムゾーン指定なし文字列に Z を付加して UTC として解釈
function parseUtcMs(s: string): number {
  if (s.endsWith('Z') || s.includes('+') || /[+-]\d{2}:\d{2}$/.test(s)) {
    return new Date(s).getTime();
  }
  return new Date(s + 'Z').getTime();
}
```

**EChartsの高さ問題**:

`flex-1 h-full` はFlexboxで親に明示的な高さがない場合 0px になる。
`style={{ height: 160 }}` を直接指定することで確実に描画される。

## 型定義

主要な型 (`types/index.ts`):

```typescript
interface TelemetryPoint {
  id: number;
  received_at: string;          // ISO8601 UTC ("...Z")
  latitude?: number;
  longitude?: number;
  altitude?: number;
  barometric_pressure?: number;
  rssi?: number;
  mode?: string;
  battery?: string;
  logging_status?: string;
  wifi_status?: string;
  gnss_status?: string;
  payload_json?: Record<string, unknown>;
}

interface ActiveMapPackage {
  id: number;
  name: string;
  format_type: string;
  tile_format: string | null;   // 'jpg' | 'png' | 'webp' | 'pbf'
  is_raster: boolean;
  tile_url_template: string;    // "/api/maps/tiles/1/{z}/{x}/{y}"
}
```

## ページのスクロール対応

全ページのルート div に `overflow-y-auto h-full` が必要。
`App.tsx` の `<main>` が `overflow-hidden` であるため、各ページがスクロールを制御する。

```typescript
// 各ページのパターン
return (
  <div className="p-4 max-w-3xl mx-auto space-y-6 overflow-y-auto h-full">
    ...
  </div>
);
```

DashboardPage と HistoryPage は独自のスクロール実装を持つ。

## Vite プロキシ設定

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': 'http://localhost:8000',   // REST API
    '/ws': { target: 'ws://localhost:8000', ws: true },  // WebSocket
  }
}
```

開発時は Vite の devServer (port 5173) から API リクエストが localhost:8000 に転送される。
本番時はバックエンドが `frontend/dist/` を静的ファイルとして配信するため不要。

## 環境別の動作

| | 開発 (`npm run dev`) | 本番 (`npm run build`) |
|---|---|---|
| ポート | 5173 (Vite) | 8000 (FastAPI) |
| APIプロキシ | Vite設定で自動転送 | 同一オリジン |
| HMR | あり | なし |
| ソースマップ | あり | なし |
