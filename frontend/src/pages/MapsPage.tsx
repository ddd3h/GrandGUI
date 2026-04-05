import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { OfflineMapPackage, ActiveMapPackage } from '../types';

export function MapsPage() {
  const [packages, setPackages] = useState<OfflineMapPackage[]>([]);
  const [activePkg, setActivePkg] = useState<ActiveMapPackage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const [pkgs, active] = await Promise.all([
      api.getMapPackages(),
      api.getActiveMapPackage().catch(() => null),
    ]);
    setPackages(pkgs);
    setActivePkg(active);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async () => {
    if (!uploadFile || !uploadName) return;
    setUploading(true);
    setMessage('');
    try {
      const form = new FormData();
      form.append('name', uploadName);
      form.append('format_type', 'mbtiles');
      form.append('file', uploadFile);
      const res = await fetch('/api/maps/offline-packages', { method: 'POST', body: form });
      if (!res.ok) throw new Error(await res.text());
      setMessage('アップロード完了');
      setUploadName('');
      setUploadFile(null);
      await load();
    } catch (e: unknown) {
      setMessage(`エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setUploading(false);
    }
  };

  const handleActivate = async (id: number) => {
    await api.activateMapPackage(id);
    await load();
  };

  const handleDeactivate = async (id: number) => {
    await api.deactivateMapPackage(id);
    await load();
  };

  const handleDelete = async (id: number) => {
    await api.deleteMapPackage(id);
    await load();
  };

  const fmtSize = (bytes?: number | null) => {
    if (!bytes) return '---';
    if (bytes > 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
    if (bytes > 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6 overflow-y-auto h-full">
      <div>
        <h2 className="text-xl font-semibold text-white">オフライン衛星マップ</h2>
        <p className="text-sm text-gray-400 mt-1">
          MBTiles形式の衛星画像をアップロードして、インターネット不要でマップを表示します。
        </p>
      </div>

      {/* Active status */}
      {activePkg ? (
        <div className={`rounded-xl border p-3 flex items-center justify-between ${
          activePkg.is_raster
            ? 'bg-green-900/20 border-green-700/50'
            : 'bg-yellow-900/20 border-yellow-700/50'
        }`}>
          <div>
            <span className={`text-sm font-medium ${activePkg.is_raster ? 'text-green-300' : 'text-yellow-300'}`}>
              {activePkg.is_raster ? '🛰 アクティブ: ' : '⚠ アクティブ (非ラスター): '}
            </span>
            <span className="text-sm text-gray-200">{activePkg.name}</span>
            {activePkg.tile_format && (
              <span className="ml-2 text-xs text-gray-400">({activePkg.tile_format.toUpperCase()})</span>
            )}
          </div>
          {!activePkg.is_raster && (
            <span className="text-xs text-yellow-400">ベクタータイルは衛星表示に使用できません</span>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-3 text-sm text-gray-400">
          アクティブなパッケージなし — マップは衛星モード時にESRI World Imageryを使用します
        </div>
      )}

      {/* Upload */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-3">
        <h3 className="text-sm font-medium text-gray-300">MBTilesをアップロード</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">パッケージ名</label>
            <input
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              placeholder="例: tokyo-satellite-z14"
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white placeholder-gray-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">ファイル (.mbtiles)</label>
            <input
              type="file"
              accept=".mbtiles"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="text-sm text-gray-300 pt-1"
            />
          </div>
        </div>
        <button
          onClick={handleUpload}
          disabled={uploading || !uploadFile || !uploadName}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded text-sm font-medium"
        >
          {uploading ? 'アップロード中...' : 'アップロード'}
        </button>
        {message && (
          <div className={`text-sm p-2 rounded ${
            message.startsWith('エラー') ? 'text-red-400 bg-red-900/20' : 'text-green-400 bg-green-900/20'
          }`}>
            {message}
          </div>
        )}
      </div>

      {/* Package list */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="px-4 py-2 bg-gray-900 text-xs text-gray-400 font-medium">登録済みパッケージ</div>
        {packages.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            パッケージなし
          </div>
        ) : (
          <table className="w-full text-sm text-gray-300">
            <thead className="bg-gray-900/50">
              <tr>
                <th className="text-left px-4 py-2">名前</th>
                <th className="text-left px-4 py-2">サイズ</th>
                <th className="text-left px-4 py-2">ズーム</th>
                <th className="text-left px-4 py-2">状態</th>
                <th className="text-left px-4 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.id} className="border-t border-gray-700/50">
                  <td className="px-4 py-2">
                    <div className="font-medium">{pkg.name}</div>
                    {pkg.description && <div className="text-xs text-gray-500">{pkg.description}</div>}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{fmtSize(pkg.file_size)}</td>
                  <td className="px-4 py-2 text-xs">
                    {pkg.min_zoom != null && pkg.max_zoom != null
                      ? `z${pkg.min_zoom}–${pkg.max_zoom}` : '---'}
                  </td>
                  <td className="px-4 py-2">
                    {pkg.is_active
                      ? <span className="text-green-400 text-xs font-medium">● アクティブ</span>
                      : <span className="text-gray-500 text-xs">○ 待機中</span>}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      {pkg.is_active ? (
                        <button
                          onClick={() => handleDeactivate(pkg.id)}
                          className="text-xs px-2 py-0.5 bg-gray-600 text-white rounded hover:bg-gray-500"
                        >
                          無効化
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivate(pkg.id)}
                          className="text-xs px-2 py-0.5 bg-blue-700 text-white rounded hover:bg-blue-600"
                        >
                          有効化
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(pkg.id)}
                        className="text-xs px-2 py-0.5 bg-red-700 text-white rounded hover:bg-red-600"
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* How-to guide */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-4">
        <h3 className="text-sm font-medium text-gray-300">衛星画像MBTilesの作成方法</h3>

        <div className="space-y-3 text-xs text-gray-400">
          <div>
            <div className="text-gray-300 font-medium mb-1">方法1: QGIS（推奨・無料）</div>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>QGISを開き、XYZタイルレイヤを追加（例: ESRI World Imagery、Google Satellite）</li>
              <li>対象エリアにズームイン</li>
              <li>メニュー → Processing → Toolbox → <code className="bg-gray-700 px-1 rounded">Generate XYZ tiles (MBTiles)</code></li>
              <li>ズームレベル（例: 最小10、最大17）とエクステントを設定して実行</li>
              <li>生成された <code className="bg-gray-700 px-1 rounded">.mbtiles</code> ファイルをここでアップロード</li>
            </ol>
          </div>

          <div>
            <div className="text-gray-300 font-medium mb-1">方法2: gdal2tiles（GeoTIFF衛星画像から）</div>
            <div className="bg-gray-900 rounded p-2 font-mono space-y-1">
              <div><span className="text-gray-500"># タイル生成</span></div>
              <div className="text-green-400">gdal2tiles.py -z 10-17 satellite.tif ./tiles/</div>
              <div><span className="text-gray-500"># MBTilesに変換</span></div>
              <div className="text-green-400">mb-util --image_format=jpg ./tiles/ output.mbtiles</div>
            </div>
          </div>

          <div>
            <div className="text-gray-300 font-medium mb-1">方法3: Python スクリプト（タイルDL）</div>
            <div className="bg-gray-900 rounded p-2 font-mono text-gray-400 text-xs">
              <div><span className="text-gray-500"># tools/download_tiles.py を使用</span></div>
              <div className="text-green-400">python tools/download_tiles.py \</div>
              <div className="text-green-400 pl-4">--bbox 139.5,35.5,140.0,36.0 \</div>
              <div className="text-green-400 pl-4">--zoom 10-16 \</div>
              <div className="text-green-400 pl-4">--output tokyo.mbtiles</div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-3 text-xs text-gray-500">
          <div className="font-medium text-gray-400 mb-1">注意事項</div>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>ズームレベルが高い（高解像度）ほどファイルサイズが大幅に増加します</li>
            <li>z14〜17の範囲で東京全域は数GB〜数十GBになる場合があります</li>
            <li>衛星画像の利用条件はプロバイダーのライセンスに従ってください</li>
            <li>タイル形式はJPEG推奨（PNGは高品質だがサイズ大）</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
