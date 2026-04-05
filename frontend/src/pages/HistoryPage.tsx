import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { TelemetryPoint } from '../types';
import { useUiStore } from '../stores/uiStore';
import { toDms } from '../types';

export function HistoryPage() {
  const [history, setHistory] = useState<TelemetryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [limit, setLimit] = useState(100);
  const { coordFormat } = useUiStore();

  const load = async () => {
    setLoading(true);
    try {
      const pts = await api.getHistory({
        start: startDate || undefined,
        end: endDate || undefined,
        limit,
      });
      setHistory(pts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleExport = async (format: 'csv' | 'json') => {
    const res = await api.exportData(format, {
      start: startDate || undefined,
      end: endDate || undefined,
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telemetry.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmtCoord = (v: number | null | undefined, isLat: boolean) => {
    if (v == null) return '---';
    return coordFormat === 'dms' ? toDms(v, isLat) : v.toFixed(6);
  };

  return (
    <div className="p-4 flex flex-col gap-4 h-full">
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Filter & Export</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">From</label>
            <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">To</label>
            <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Limit</label>
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white">
              {[50, 100, 500, 1000, 5000].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <button onClick={load} disabled={loading}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium disabled:opacity-50">
            {loading ? 'Loading...' : 'Search'}
          </button>
          <button onClick={() => handleExport('csv')}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-sm">
            Export CSV
          </button>
          <button onClick={() => handleExport('json')}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-sm">
            Export JSON
          </button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 flex-1 overflow-hidden">
        <div className="overflow-auto h-full">
          <table className="w-full text-xs text-gray-300">
            <thead className="bg-gray-900 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2">Time</th>
                <th className="text-left px-3 py-2">Latitude</th>
                <th className="text-left px-3 py-2">Longitude</th>
                <th className="text-left px-3 py-2">Alt (m)</th>
                <th className="text-left px-3 py-2">Pressure</th>
                <th className="text-left px-3 py-2">RSSI</th>
                <th className="text-left px-3 py-2">Mode</th>
                <th className="text-left px-3 py-2">Battery</th>
                <th className="text-left px-3 py-2">GNSS</th>
              </tr>
            </thead>
            <tbody>
              {history.map((p) => (
                <tr key={p.id} className="border-t border-gray-700/50 hover:bg-gray-700/30">
                  <td className="px-3 py-1.5 font-mono">{new Date(p.received_at).toLocaleTimeString()}</td>
                  <td className="px-3 py-1.5 font-mono">{fmtCoord(p.latitude, true)}</td>
                  <td className="px-3 py-1.5 font-mono">{fmtCoord(p.longitude, false)}</td>
                  <td className="px-3 py-1.5 font-mono">{p.altitude?.toFixed(1) ?? '---'}</td>
                  <td className="px-3 py-1.5 font-mono">{p.barometric_pressure?.toFixed(2) ?? '---'}</td>
                  <td className="px-3 py-1.5 font-mono">{p.rssi?.toFixed(1) ?? '---'}</td>
                  <td className="px-3 py-1.5">{p.mode ?? '---'}</td>
                  <td className="px-3 py-1.5">{p.battery ?? '---'}</td>
                  <td className="px-3 py-1.5">{p.gnss_status ?? '---'}</td>
                </tr>
              ))}
              {history.length === 0 && !loading && (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-500">No data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-gray-500">{history.length} records shown</div>
    </div>
  );
}
