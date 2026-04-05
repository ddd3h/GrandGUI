# ウィジェットシステム

## 概要

ダッシュボードはウィジェットの集合です。各ウィジェットは:
- DBに `Widget` レコードとして保存される
- `widget_type` でどのReactコンポーネントを使うか決まる
- `config` (JSON) でウィジェット固有の設定を持つ
- `WidgetLayout` でダッシュボード上の順序を管理する

## 既存ウィジェット

| `widget_type` | コンポーネント | `config` のキー |
|---|---|---|
| `map` | `MapWidget` | `trackLength` (軌跡の最大点数) |
| `graph` | `GraphWidget` | `field` (フィールド名), `window` (1m/5m/15m/all) |
| `status` | `StatusWidget` | なし (固定フィールド) |

## ウィジェットの描画フロー

```
DashboardPage
  └─ WidgetCard (dnd-kit useSortable)
       ├─ ヘッダー (タイトル・編集ボタン)
       ├─ コンテンツ
       │    └─ renderContent() → widget_type に応じたコンポーネント
       └─ リサイズハンドル (マップのみ)
```

## 新しいウィジェットを追加する方法

### Step 1: バックエンドに `widget_type` を追加

`Widget` モデルの `widget_type` は現在文字列フリーなので、フロントエンドの型定義のみ更新する。

### Step 2: Reactコンポーネントを作成

`frontend/src/components/widgets/MyWidget.tsx` を作成:

```typescript
import { useTelemetryStore } from '../../stores/telemetryStore';

interface MyWidgetProps {
  label?: string;
}

export function MyWidget({ label = 'My Widget' }: MyWidgetProps) {
  const { latest, history } = useTelemetryStore();

  return (
    <div className="p-3 h-full flex flex-col gap-2">
      <div className="text-sm text-gray-400">{label}</div>
      <div className="text-2xl font-bold text-white">
        {latest?.altitude?.toFixed(1) ?? '---'}
      </div>
    </div>
  );
}
```

### Step 3: `WidgetCard.tsx` に分岐を追加

```typescript
// frontend/src/components/widgets/WidgetCard.tsx の renderContent() に追加
import { MyWidget } from './MyWidget';

case 'my_widget':
  return (
    <MyWidget
      label={cfg.label as string | undefined}
    />
  );
```

### Step 4: `types/index.ts` を更新

```typescript
export interface Widget {
  ...
  widget_type: 'map' | 'graph' | 'status' | 'my_widget'; // 追加
  ...
}
```

### Step 5: DashboardPage の追加ボタンに追加 (任意)

```typescript
// DashboardPage.tsx の handleAddWidget の呼び出し元
{(['map', 'graph', 'status', 'my_widget'] as const).map((t) => (
  <button key={t} onClick={() => handleAddWidget(t)}>
    + {t}
  </button>
))}
```

### Step 6: 初期ダッシュボードのシードに追加 (任意)

```python
# app/main.py の seed_default_data() に追加
("my_widget", "My Label", {"label": "Custom Label"}),
```

## データへのアクセス方法

ウィジェット内では Zustand ストアから直接データを読み取る:

```typescript
import { useTelemetryStore } from '../../stores/telemetryStore';

const { latest, history } = useTelemetryStore();

// latest: TelemetryPoint | null  (最新の1点)
// history: TelemetryPoint[]      (直近1000点)

// 数値フィールドの例
const altitude = latest?.altitude;           // number | undefined
const rssi = latest?.rssi;                   // number | undefined

// 文字列フィールドの例
const mode = latest?.mode;                   // string | undefined

// payload_json の動的フィールド
const customValue = latest?.payload_json?.["my_key"];
```

## dnd-kit によるドラッグ&ドロップ

`WidgetCard.tsx` が `useSortable` を使ってドラッグを制御する。
ドラッグ終了時に `DashboardPage.tsx` の `handleDragEnd` が `patchLayout` APIを呼んで順序を永続化する。

`editMode` が `false` のとき、ドラッグは無効 (`disabled: !editMode`)。

## マップウィジェットのリサイズ

ウィジェットごとの `mapHeight` state (デフォルト 420px) でカード高さを管理:

```typescript
// WidgetCard.tsx
const CHROME_HEIGHT = 53; // ヘッダー(41px) + リサイズハンドル(12px)
style={{ height: mapHeight + CHROME_HEIGHT }}

// マウスドラッグでリサイズ
const handleResizeMouseDown = (e: React.MouseEvent) => {
  const startY = e.clientY;
  const startHeight = mapHeight;
  document.addEventListener('mousemove', (ev) => {
    setMapHeight(Math.max(200, startHeight + ev.clientY - startY));
  });
};
```

`self-start w-full` クラスでグリッドの行高に引き伸ばされるのを防ぎ、
縮小時にもカードが小さくなるようにしている。
