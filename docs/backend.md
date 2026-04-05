# バックエンド詳細

## 起動の流れ

`app/main.py` の `lifespan` コンテキストマネージャが以下を行う:

1. `data/` `data/maps/` ディレクトリを作成
2. `init_db()` → SQLAlchemy で全テーブルを CREATE TABLE IF NOT EXISTS
3. `seed_default_data()` → UARTプロファイルとダッシュボードが未登録なら初期データを挿入

```python
# 初期UARTプロファイルのフィールド定義 (main.py)
fields_def = [
    (0, "latitude",             "float",            is_lat=True, ...),
    (1, "longitude",            "float",            is_lon=True, ...),
    (2, "altitude",             "float",            is_alt=True, ...),
    (3, "barometric_pressure",  "float",            ...),
    (4, "rssi",                 "float",            ...),
    (5, "mode",                 "key_value_string", ...),  # "Mode:active" → "active"
    (6, "battery",              "key_value_string", ...),
    (7, "logging_status",       "key_value_string", ...),
    (8, "wifi_status",          "key_value_string", ...),
    (9, "gnss_status",          "key_value_string", ...),
]
```

## データベース設計

### テーブル一覧

| テーブル | 役割 |
|---|---|
| `uart_profiles` | UARTパースプロファイル (区切り文字・文字コード等) |
| `uart_profile_fields` | プロファイルのフィールド定義 |
| `serial_connections` | 接続設定の履歴 |
| `telemetry_raw` | 全受信行 (パース失敗含む) |
| `telemetry_points` | 正規化済みテレメトリデータ |
| `dashboards` | ダッシュボード定義 |
| `widgets` | ウィジェット (type/title/config) |
| `widget_layouts` | ウィジェット配置 (order/area) |
| `offline_map_packages` | アップロード済みMBTilesパッケージ |
| `app_settings` | アプリ設定 (key-value) |

### telemetry_points の固定カラム

```python
class TelemetryPoint(Base):
    id                  # PK
    received_at         # 受信日時 (UTC)
    raw_id              # telemetry_raw への外部キー
    latitude            # 緯度 (float)
    longitude           # 経度 (float)
    altitude            # 高度 (float)
    barometric_pressure # 気圧 (float)
    rssi                # 電波強度 (float)
    mode                # 動作モード (string)
    battery             # バッテリー状態 (string)
    logging_status      # ログ状態 (string)
    wifi_status         # WiFi状態 (string)
    gnss_status         # GNSS状態 (string)
    payload_json        # 上記以外の全フィールド (JSON)
```

固定カラム以外のフィールドは `payload_json` に `{"key": value}` で格納される。

## API エンドポイント一覧

### Serial (接続制御)
| Method | Path | 説明 |
|---|---|---|
| GET | `/api/serial/ports` | 利用可能なシリアルポート一覧 |
| POST | `/api/serial/connect` | 接続開始 |
| POST | `/api/serial/disconnect` | 接続停止 |
| GET | `/api/serial/status` | 接続状態取得 |

**connect リクエスト例:**
```json
{
  "source_type": "simulator",
  "baudrate": 9600,
  "data_bits": 8,
  "stop_bits": 1.0,
  "parity": "N",
  "timeout": 1.0,
  "encoding": "utf-8",
  "auto_reconnect": false,
  "reconnect_interval": 5,
  "simulator_interval": 1.0
}
```

### Profiles (UARTプロファイル)
| Method | Path | 説明 |
|---|---|---|
| GET | `/api/profiles` | プロファイル一覧 |
| POST | `/api/profiles` | プロファイル作成 |
| GET | `/api/profiles/{id}` | プロファイル取得 |
| PATCH | `/api/profiles/{id}` | プロファイル更新 |
| DELETE | `/api/profiles/{id}` | プロファイル削除 |
| POST | `/api/profiles/{id}/validate-sample` | サンプル行のパース検証 |

### Telemetry
| Method | Path | 説明 |
|---|---|---|
| GET | `/api/telemetry/latest` | 最新1件 |
| GET | `/api/telemetry/history` | 履歴 (start/end/limit/offset) |
| GET | `/api/telemetry/export` | CSV/JSON エクスポート |

### Dashboard / Widgets
| Method | Path | 説明 |
|---|---|---|
| GET | `/api/dashboard` | 全ダッシュボード + ウィジェット |
| POST | `/api/dashboard` | ダッシュボード作成 |
| POST | `/api/widgets` | ウィジェット追加 |
| PATCH | `/api/widgets/{id}` | ウィジェット設定更新 |
| DELETE | `/api/widgets/{id}` | ウィジェット削除 |
| PATCH | `/api/dashboard/layout` | レイアウト一括更新 |

### Maps (オフライン地図)
| Method | Path | 説明 |
|---|---|---|
| GET | `/api/maps/active` | アクティブパッケージ情報 |
| GET | `/api/maps/offline-packages` | 登録済みパッケージ一覧 |
| POST | `/api/maps/offline-packages` | MBTilesアップロード |
| POST | `/api/maps/offline-packages/{id}/activate` | アクティブ化 |
| POST | `/api/maps/offline-packages/{id}/deactivate` | 非アクティブ化 |
| DELETE | `/api/maps/offline-packages/{id}` | 削除 |
| GET | `/api/maps/tiles/{id}/{z}/{x}/{y}` | タイル配信 |

### WebSocket
| Path | 説明 |
|---|---|
| `ws://localhost:8000/ws/telemetry` | リアルタイムテレメトリストリーム |

**WebSocketメッセージ形式:**
```json
{
  "type": "telemetry",
  "data": {
    "id": 123,
    "received_at": "2026-04-05T01:00:00.000000Z",
    "latitude": 35.681234,
    "longitude": 139.767234,
    "altitude": 55.3,
    "barometric_pressure": 1006.58,
    "rssi": -65.3,
    "mode": "active",
    "battery": "Full",
    "logging_status": "ON",
    "wifi_status": "OK",
    "gnss_status": "lock",
    "payload_json": {}
  },
  "timestamp": "2026-04-05T01:00:00.000000Z"
}
```

## コアモジュール解説

### `core/parser.py`

```python
# フィールド型キャスト
cast_field(raw_value, field_type)
# → float/int: 数値変換、失敗時 None
# → string: そのまま
# → key_value_string: "Key:Value" → "Value" を返す

# 1行パース
parse_line(raw_line, profile_dict) → dict
# → {"latitude": 35.68, "altitude": 55.3, ..., "_parse_errors": [...]}

# TelemetryPoint 正規化
normalize_to_point(parsed, fields) → dict
# → is_latitude/is_longitude/is_altitude フラグで固定カラムに配置
# → 不明キーは payload_json に格納
```

### `core/uart_receiver.py`

3つのソースタイプを統一インターフェースで提供:

```python
source_type = "physical"   # pySerial で実デバイスから受信
source_type = "virtual"    # socat で作成した仮想PTYから受信
source_type = "simulator"  # TelemetrySimulator が生成するデータを使用
```

全ソースタイプで `line_callback(line, source_type, port_name)` が呼ばれる。

### `core/simulator.py`

シミュレーターが生成するデータ形式:
```
35.681234, 139.767234, 55.3, 1006.58, -65.3, Mode:active, Bt:Full, Log:ON, WiFi:OK, GNSS:lock
```

- 位置: 東京を中心に半径約100mの円軌道
- 高度: 50m + sin波 + ランダムノイズ
- 気圧: 高度から逆算
- RSSI: -70dBm + sin波 + ノイズ
- バッテリー: ステップごとに減少
- モード/ステータス: 時間経過で変化

## 新しいAPIエンドポイントを追加する方法

1. `app/api/` に新しい `.py` ファイルを作成
2. `APIRouter` を定義してエンドポイントを実装
3. `app/api/__init__.py` に import を追加
4. `app/main.py` の `app.include_router()` に登録

```python
# app/api/example.py
from fastapi import APIRouter
router = APIRouter(prefix="/api/example", tags=["example"])

@router.get("/hello")
def hello():
    return {"message": "hello"}
```

```python
# app/api/__init__.py に追加
from .example import router as example_router
```

```python
# app/main.py に追加
app.include_router(example_router)
```

## DBモデルを追加・変更する方法

> ⚠️ SQLite を使用しているため、カラム追加は `ALTER TABLE` が必要。
> 開発中は `data/grandgui.db` を削除して再起動するのが最も簡単。

1. `app/db/models.py` にモデルクラスを追加
2. `app/schemas/` にPydanticスキーマを追加
3. DB再作成: `rm data/grandgui.db && (再起動)` または Alembic でマイグレーション
