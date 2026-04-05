# オフライン衛星地図

## 概要

GrandGUI はインターネット接続なしで衛星画像を表示できます。
**MBTiles（ラスターJPEG/PNG）** 形式のファイルをアップロードして使用します。

## 動作の仕組み

```
ブラウザ ──MapLibre──▶ GET /api/maps/tiles/{id}/{z}/{x}/{y}
                              │
                        MBTilesファイルを開く
                              │
                        SQLite クエリ
                        SELECT tile_data FROM tiles
                        WHERE zoom_level=z AND tile_column=x AND tile_row=(flip y)
                              │
                        tile_format に応じたレスポンス
                        ・image/jpeg  (JPEG衛星画像)
                        ・image/png   (PNG衛星画像)
                        ・application/x-protobuf  (ベクタータイル)
```

## MBTilesファイルの作成方法

### 方法1: QGIS（推奨・無料）

1. QGISをインストール: https://qgis.org/
2. XYZタイルレイヤを追加（例: ESRI World Imagery）
   - ブラウザパネル → XYZ Tiles → 右クリック → New Connection
   - URL: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`
3. 対象エリアにズームイン
4. Processing → Toolbox → 検索: "Generate XYZ tiles (MBTiles)"
5. パラメータ設定:
   - Extent: 対象エリアを地図上で選択
   - Minimum zoom: 10 (全体把握用)
   - Maximum zoom: 17 (詳細表示用)
   - Output format: JPEG (サイズ節約)
   - Output file: `output.mbtiles`
6. Run

> **注意**: ズームレベルが上がるとタイル数が指数的に増加します。
> z10〜17の東京23区全域で約2〜5GBになる場合があります。

### 方法2: gdal2tiles + mb-util（大規模処理向け）

```bash
# GeoTIFF衛星画像からタイル生成
gdal2tiles.py -z 10-17 --webviewer=none satellite.tif ./tiles/

# MBTilesに変換
pip install mbutil
mb-util --image_format=jpg ./tiles/ output.mbtiles
```

### 方法3: カスタムDLスクリプト（研究・非商用利用）

```bash
# tools/download_tiles.py (別途実装が必要)
python tools/download_tiles.py \
  --bbox 139.5,35.5,140.0,36.0 \
  --zoom 10-16 \
  --source esri \
  --output tokyo.mbtiles
```

> ⚠️ タイルのダウンロードはプロバイダーの利用規約を確認してください。
> ESRIのタイルはオフライン保存に制限がある場合があります。

## タイル形式の自動判定

バックエンドはアップロードされたMBTilesの形式を自動判定します:

```python
def _mbtiles_tile_format(conn: sqlite3.Connection) -> str:
    # 1. metadata テーブルの format フィールドを確認
    row = conn.execute("SELECT value FROM metadata WHERE name='format'").fetchone()
    if row:
        return row[0].lower()  # 'jpg', 'png', 'webp', 'pbf'

    # 2. タイルデータのマジックバイトで判定
    data = conn.execute("SELECT tile_data FROM tiles LIMIT 1").fetchone()[0]
    if data[:2] == b'\x1f\x8b':       return 'pbf'   # gzip → vector
    if data[:8] == b'\x89PNG\r\n\x1a\n': return 'png'
    if data[:2] == b'\xff\xd8':       return 'jpg'   # JPEG SOI
    if data[:4] == b'RIFF':           return 'webp'
    return 'pbf'  # デフォルト
```

## フロントエンドとの統合

### アクティブパッケージの取得

```typescript
// MapWidget.tsx 初期化時
const activePkg = await api.getActiveMapPackage();
// → { id, name, is_raster, tile_url_template: "/api/maps/tiles/1/{z}/{x}/{y}" }
```

### MapLibreソースの設定

```typescript
// ラスターMBTilesをMapLibreのrasterソースとして登録
map.addSource('satellite-offline', {
  type: 'raster',
  tiles: [activePkg.tile_url_template],
  tileSize: 256,
  attribution: `© ${activePkg.name}`,
});
```

### 表示切替

```typescript
// 衛星ボタン押下時
map.setLayoutProperty('osm-tiles', 'visibility', 'none');
map.setLayoutProperty('satellite-offline-tiles', 'visibility', 'visible');
```

## ズームレベルの目安

| ズームレベル | 縮尺目安 | 用途 |
|---|---|---|
| z8〜10 | 県・地方レベル | エリア全体把握 |
| z11〜13 | 市区町村レベル | 飛行経路確認 |
| z14〜16 | 街区レベル | 精密な位置確認 |
| z17〜19 | 建物レベル | 着陸地点確認 |

## ファイルサイズの目安

> 計算式: タイル数 × 平均タイルサイズ(JPEG: 10〜50KB)

| エリア | z10〜14 | z10〜16 | z10〜17 |
|---|---|---|---|
| 東京23区 | 〜50MB | 〜500MB | 〜2GB |
| 神奈川県 | 〜200MB | 〜2GB | 〜8GB |

JPEGの品質設定で大きく変わります。QGIS のデフォルト品質 (75%) を推奨。

## MBTilesの検証

```bash
# SQLiteとして開いて確認
sqlite3 output.mbtiles "SELECT name, value FROM metadata;"
# → format, minzoom, maxzoom, bounds, center, description ...

sqlite3 output.mbtiles "SELECT COUNT(*) FROM tiles;"
# → タイル総数

sqlite3 output.mbtiles "SELECT zoom_level, COUNT(*) FROM tiles GROUP BY zoom_level;"
# → ズームレベルごとのタイル数
```

## トラブルシューティング

**タイルが表示されない**:
- MBTilesの `format` が `jpg`/`png` であることを確認
- ズーム範囲外にいないか確認
- `TMS y座標` の反転が正しいか: `tms_y = (1 << z) - 1 - y`

**アップロードが失敗する**:
- ファイルサイズが大きすぎる場合は FastAPI の制限を確認
- `uvicorn` に `--limit-concurrency` を設定

**オフライン衛星が選択できない**:
- Maps ページでパッケージを「有効化」しているか確認
- `is_raster: true` になっているか: `GET /api/maps/active` で確認
