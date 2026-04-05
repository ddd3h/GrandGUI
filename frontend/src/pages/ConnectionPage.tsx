import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useTelemetryStore } from '../stores/telemetryStore';
import type { PortInfo, SerialStatus, ConnectRequest } from '../types';

export function ConnectionPage() {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [status, setStatus] = useState<SerialStatus>({ connected: false });
  const [form, setForm] = useState<ConnectRequest>({
    source_type: 'simulator',
    port_name: '',
    baudrate: 9600,
    data_bits: 8,
    stop_bits: 1,
    parity: 'N',
    timeout: 1.0,
    encoding: 'utf-8',
    auto_reconnect: false,
    reconnect_interval: 5,
    simulator_interval: 1.0,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { setSerialStatus } = useTelemetryStore();

  const refreshStatus = useCallback(async () => {
    try {
      const s = await api.getSerialStatus();
      setStatus(s);
      setSerialStatus(s);
    } catch (_) {}
  }, [setSerialStatus]);

  const refreshPorts = useCallback(async () => {
    try {
      const p = await api.getPorts();
      setPorts(p);
    } catch (_) {}
  }, []);

  useEffect(() => {
    refreshStatus();
    refreshPorts();
    const timer = setInterval(refreshStatus, 3000);
    return () => clearInterval(timer);
  }, [refreshStatus, refreshPorts]);

  const handleConnect = async () => {
    setLoading(true);
    setMessage('');
    try {
      await api.connect(form);
      setMessage('Connected successfully');
      await refreshStatus();
    } catch (e: unknown) {
      setMessage(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await api.disconnect();
      setMessage('Disconnected');
      await refreshStatus();
    } catch (e: unknown) {
      setMessage(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6 overflow-y-auto h-full">
      <h2 className="text-xl font-semibold text-white">Connection Settings</h2>

      {/* Status card */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Current Status</h3>
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${status.connected ? 'bg-green-400' : 'bg-gray-500'}`} />
          <span className="text-white font-medium">
            {status.connected ? `Connected (${status.source_type})` : 'Disconnected'}
          </span>
        </div>
        {status.port_name && (
          <div className="mt-1 text-sm text-gray-400">Port: {status.port_name} @ {status.baudrate} baud</div>
        )}
        {status.last_received_at && (
          <div className="mt-1 text-sm text-gray-400">
            Last received: {new Date(status.last_received_at).toLocaleTimeString()}
          </div>
        )}
        {status.error_message && (
          <div className="mt-2 text-sm text-red-400">{status.error_message}</div>
        )}
      </div>

      {/* Connection form */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-4">
        <h3 className="text-sm font-medium text-gray-400">Connection Settings</h3>

        {/* Source type */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Source Type</label>
          <div className="flex gap-2">
            {(['simulator', 'physical', 'virtual'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setForm((f) => ({ ...f, source_type: t }))}
                className={`px-3 py-1.5 rounded text-sm font-medium capitalize ${
                  form.source_type === t
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Port (only for physical/virtual) */}
        {form.source_type !== 'simulator' && (
          <div>
            <label className="block text-sm text-gray-400 mb-1">Serial Port</label>
            <div className="flex gap-2">
              <select
                value={form.port_name}
                onChange={(e) => setForm((f) => ({ ...f, port_name: e.target.value }))}
                className="flex-1 bg-gray-700 border border-gray-600 text-white rounded px-3 py-2 text-sm"
              >
                <option value="">-- Select port --</option>
                {ports.map((p) => (
                  <option key={p.port} value={p.port}>
                    {p.port} {p.description ? `(${p.description})` : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={refreshPorts}
                className="px-3 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 text-sm"
              >
                ↻
              </button>
            </div>
          </div>
        )}

        {/* Baudrate */}
        {form.source_type !== 'simulator' && (
          <div>
            <label className="block text-sm text-gray-400 mb-1">Baudrate</label>
            <select
              value={form.baudrate}
              onChange={(e) => setForm((f) => ({ ...f, baudrate: Number(e.target.value) }))}
              className="w-full bg-gray-700 border border-gray-600 text-white rounded px-3 py-2 text-sm"
            >
              {[1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400].map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        )}

        {/* Simulator interval */}
        {form.source_type === 'simulator' && (
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Interval (seconds): {form.simulator_interval}
            </label>
            <input
              type="range"
              min="0.1"
              max="10"
              step="0.1"
              value={form.simulator_interval}
              onChange={(e) => setForm((f) => ({ ...f, simulator_interval: Number(e.target.value) }))}
              className="w-full"
            />
          </div>
        )}

        {/* Auto-reconnect */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.auto_reconnect}
            onChange={(e) => setForm((f) => ({ ...f, auto_reconnect: e.target.checked }))}
            className="rounded"
          />
          <span className="text-sm text-gray-300">Auto-reconnect</span>
        </label>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleConnect}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded px-4 py-2 text-sm font-medium"
          >
            {loading ? 'Connecting...' : 'Connect'}
          </button>
          <button
            onClick={handleDisconnect}
            disabled={loading || !status.connected}
            className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded px-4 py-2 text-sm font-medium"
          >
            Disconnect
          </button>
        </div>

        {message && (
          <div className={`text-sm p-2 rounded ${message.startsWith('Error') ? 'text-red-400 bg-red-900/20' : 'text-green-400 bg-green-900/20'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
