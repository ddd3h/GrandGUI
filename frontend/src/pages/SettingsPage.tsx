import { useUiStore } from '../stores/uiStore';

export function SettingsPage() {
  const { coordFormat, setCoordFormat } = useUiStore();

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6 overflow-y-auto h-full">
      <h2 className="text-xl font-semibold text-white">Settings</h2>

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-4">
        <h3 className="text-sm font-medium text-gray-400">Display</h3>

        <div>
          <label className="text-sm text-gray-300 block mb-2">Coordinate Format</label>
          <div className="flex gap-2">
            <button
              onClick={() => setCoordFormat('decimal')}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                coordFormat === 'decimal' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Decimal (35.6812)
            </button>
            <button
              onClick={() => setCoordFormat('dms')}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                coordFormat === 'dms' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              DMS (35°40'52"N)
            </button>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-2">About</h3>
        <div className="text-sm text-gray-500 space-y-1">
          <p>GrandGUI v0.1.0</p>
          <p>UART telemetry visualization system</p>
          <p>Backend: FastAPI + SQLite</p>
          <p>Frontend: React + MapLibre + ECharts</p>
        </div>
      </div>
    </div>
  );
}
