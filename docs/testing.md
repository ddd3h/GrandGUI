# テストガイド

## テスト構成

```
backend/tests/          ← pytest (43テスト)
  ├── conftest.py       ← テスト用DBセットアップ
  ├── test_api.py       ← REST APIテスト
  ├── test_parser.py    ← パーサーユニットテスト
  └── test_simulator.py ← シミュレーターテスト

frontend/src/test/      ← Vitest (37テスト)
  ├── setup.ts          ← モック定義 (MapLibre, WebSocket, ResizeObserver)
  ├── types.test.ts     ← toDms() 変換
  ├── stores.test.ts    ← Zustand ストア
  ├── components.test.tsx ← StatusWidget レンダリング
  ├── graphFilter.test.ts ← タイムスタンプフィルター (バグ再現テスト含む)
  └── graphWidget.test.tsx ← GraphWidget 統合テスト
```

## テストの実行

### バックエンド

```bash
cd backend
python -m pytest tests/ -v
python -m pytest tests/ -v -k "test_parse"  # 特定テストのみ
python -m pytest tests/ --tb=short          # 短い出力
```

### フロントエンド

```bash
cd frontend
npm test              # 全テスト (1回実行)
npm run test:watch    # ウォッチモード (変更時自動再実行)
```

## テストの書き方

### バックエンド: REST APIテスト

```python
# backend/tests/test_api.py のパターン
class TestMyAPI:
    def test_get_something(self, client):
        resp = client.get("/api/my-endpoint")
        assert resp.status_code == 200
        data = resp.json()
        assert "field" in data

    def test_post_something(self, client):
        resp = client.post("/api/my-endpoint", json={"name": "test"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "test"
```

`conftest.py` の `client` フィクスチャはインメモリSQLiteDBを使用するため、
テストは互いに独立している。

### バックエンド: ユニットテスト

```python
# parser のテスト例
def test_parse_custom_format():
    profile = {
        "delimiter": ";",
        "fields": [
            {"order_index": 0, "key": "lat", "field_type": "float", "is_latitude": True},
            {"order_index": 1, "key": "lon", "field_type": "float", "is_longitude": True},
        ]
    }
    result = parse_line("35.68;139.77", profile)
    assert result["lat"] == 35.68
    assert result["lon"] == 139.77
```

### フロントエンド: コンポーネントテスト

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useTelemetryStore } from '../stores/telemetryStore';

// EChartsのモック (GraphWidgetを使う場合)
vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  })),
}));

describe('MyWidget', () => {
  beforeEach(() => {
    useTelemetryStore.setState({ latest: null, history: [] });
  });

  it('shows --- when no data', () => {
    render(<MyWidget />);
    expect(screen.getByText('---')).toBeInTheDocument();
  });

  it('shows value when data present', () => {
    useTelemetryStore.setState({
      latest: { id: 1, received_at: new Date().toISOString(), altitude: 55.3 },
    });
    render(<MyWidget />);
    expect(screen.getByText('55.3')).toBeInTheDocument();
  });
});
```

### フロントエンド: 時刻フィルターテスト

タイムスタンプ関連のバグは非常に見つけにくいため、専用テストを書くことを推奨:

```typescript
// graphFilter.test.ts のパターン
import { describe, it, expect } from 'vitest';

function parseUtcMs(s: string): number {
  if (s.endsWith('Z') || s.includes('+')) return new Date(s).getTime();
  return new Date(s + 'Z').getTime();
}

it('Python utcnow() format (no Z) is parsed as UTC', () => {
  const tsNoZ = new Date().toISOString().replace('Z', '');
  const diff = Math.abs(parseUtcMs(tsNoZ) - Date.now());
  expect(diff).toBeLessThan(50); // 50ms以内
});
```

## モックの設定 (setup.ts)

`frontend/src/test/setup.ts` でテスト環境に必要なモックを設定:

```typescript
/// <reference types="vitest/globals" />
import '@testing-library/jest-dom';

// MapLibre GL JS のモック (canvas API が jsdom にない)
vi.mock('maplibre-gl', () => ({
  default: {
    Map: vi.fn().mockImplementation(() => ({ ... })),
    Marker: vi.fn().mockImplementation(() => ({ ... })),
    NavigationControl: vi.fn(),
  }
}));

// WebSocket のモック
global.WebSocket = class MockWebSocket { ... } as unknown as typeof WebSocket;

// ResizeObserver のモック (class構文が必要)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
```

> ⚠️ `ResizeObserver` は `vi.fn().mockImplementation()` ではなく、
> `class` 構文で定義する必要があります (`new ResizeObserver()` がコンストラクタとして呼ばれるため)。

## CI/CDへの統合

```yaml
# .github/workflows/test.yml の例
- name: Backend tests
  run: |
    cd backend
    pip install -r requirements.txt
    python -m pytest tests/ -q

- name: Frontend tests
  run: |
    cd frontend
    npm ci
    npm test
```

## テストカバレッジ方針

現在のテストの重点:

1. **パーサー (test_parser.py)**: 全フィールド型・エラーケース・正規化ロジック
2. **タイムスタンプ (graphFilter.test.ts)**: UTC+N環境でのバグ再現と修正確認
3. **ストア (stores.test.ts)**: Zustand の状態遷移・履歴上限
4. **API (test_api.py)**: 全エンドポイントの正常系

意図的にテストしていないもの:
- MapLibre GL JS の描画 (canvas非対応のため)
- EChartsの実際の描画 (canvas非対応のため)
- WebSocketの実際の通信 (E2Eテストが必要)
