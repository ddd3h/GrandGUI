# UARTプロファイル設定

## 概要

UARTプロファイルは「どんなフォーマットのデータが来るか」を定義する設定ファイルです。
異なるデバイスを使う際にコードを変更せず、UIから設定を変えるだけで対応できます。

## データフォーマット例

シミュレーターが生成するデフォルトのフォーマット:

```
35.681234, 139.767234, 55.3, 1006.58, -65.3, Mode:active, Bt:Full, Log:ON, WiFi:OK, GNSS:lock
```

- 区切り文字: `,` (カンマ)
- フィールド数: 10

## プロファイルの構成要素

### プロファイル本体
```json
{
  "name": "Default",
  "delimiter": ",",
  "encoding": "utf-8",
  "is_default": true
}
```

### フィールド定義

各フィールドはインデックス順に定義します:

| フィールド | 説明 |
|---|---|
| `order_index` | データ内の位置 (0始まり) |
| `key` | フィールドを識別するキー名 |
| `label` | 表示用ラベル |
| `field_type` | データ型 (後述) |
| `is_latitude` | 緯度として使用 |
| `is_longitude` | 経度として使用 |
| `is_altitude` | 高度として使用 |
| `use_for_graph` | グラフウィジェットに表示 |
| `use_for_status` | ステータスウィジェットに表示 |
| `use_for_map` | マップに関連付け |

## フィールド型 (`field_type`)

### `float` — 浮動小数点数
```
入力: " 55.3"  →  出力: 55.3 (float)
入力: "abc"    →  出力: None (パースエラー)
```

### `int` — 整数
```
入力: " 42"   →  出力: 42 (int)
入力: "abc"   →  出力: None
```

### `string` — 文字列
```
入力: " active"  →  出力: "active" (strip済み)
```

### `key_value_string` — Key:Value 形式
```
入力: " Mode:active"  →  出力: "active"
入力: " Bt:Full"      →  出力: "Full"
入力: " WiFi:OK"      →  出力: "OK"
```
コロンより前のKey部分は捨てられ、Value部分のみが返される。

## データベースへのマッピング

`normalize_to_point()` がパース済み辞書から `TelemetryPoint` の固定カラムに値を配置します。

```python
# 固定カラムへのマッピングルール:
# 1. is_latitude=True  → latitude カラム
# 2. is_longitude=True → longitude カラム
# 3. is_altitude=True  → altitude カラム
# 4. key == "barometric_pressure" → barometric_pressure カラム
# 5. key == "rssi"     → rssi カラム
# 6. key == "mode"     → mode カラム
# ... (battery, logging_status, wifi_status, gnss_status)
# 7. それ以外          → payload_json に {"key": value} として格納
```

## サンプル検証機能

Profiles ページの「Validate Sample」で任意のサンプル行を即座にパース確認できます。

**API:**
```
POST /api/profiles/{id}/validate-sample
Body: {"sample_line": "35.68, 139.77, 50.0, ..."}

Response:
{
  "success": true,
  "parsed": {
    "latitude": 35.68,
    "altitude": 50.0,
    ...
  }
}
```

## カスタムプロファイルの例

### GPS + 温度センサー
データ: `$GNRMC,012345,A,3541.00,N,13946.00,E,0.0,0.0,050426*xx,25.6,3.3`

```json
{
  "name": "GPS+Temperature",
  "delimiter": ",",
  "fields": [
    {"order_index": 0, "key": "nmea_id",    "field_type": "string"},
    {"order_index": 1, "key": "time",        "field_type": "string"},
    {"order_index": 4, "key": "latitude",    "field_type": "float",  "is_latitude": true},
    {"order_index": 6, "key": "longitude",   "field_type": "float",  "is_longitude": true},
    {"order_index": 9, "key": "temperature", "field_type": "float",  "use_for_graph": true},
    {"order_index": 10, "key": "voltage",    "field_type": "float",  "use_for_graph": true}
  ]
}
```

### スペース区切り
データ: `lat=35.68 lon=139.77 alt=50.0 spd=12.5`

現在の実装はCSVスタイルの区切り文字のみ対応。スペース区切りの場合はデリミタを `" "` に設定するか、パーサーを拡張する必要がある。

## パーサーのソースコード

`backend/app/core/parser.py` の主要関数:

```python
def parse_line(raw_line: str, profile: dict) -> Dict[str, Any]:
    delimiter = profile.get("delimiter", ",")
    fields = sorted(profile.get("fields", []), key=lambda f: f["order_index"])
    parts = raw_line.strip().split(delimiter)
    
    result = {}
    errors = []
    for field in fields:
        idx = field["order_index"]
        if idx < len(parts):
            result[field["key"]] = cast_field(parts[idx].strip(), field["field_type"])
        else:
            errors.append(f"Field '{field['key']}' at index {idx} not found")
            result[field["key"]] = None
    
    if errors:
        result["_parse_errors"] = errors
    return result
```

## パーサーの拡張方法

`backend/app/core/parser.py` の `cast_field()` に新しい型を追加:

```python
def cast_field(raw_value: str, field_type: str) -> Any:
    ...
    elif field_type == "hex":  # 新規追加例
        try:
            return int(raw_value, 16)
        except ValueError:
            return None
    ...
```

対応する型は `UartProfileField.field_type` カラムのチェックも緩和する (現状は文字列フリー)。
