import { useTelemetryStore } from '../../stores/telemetryStore';

interface StatusItem {
  key: string;
  label: string;
  colorMap?: Record<string, string>;
}

const DEFAULT_STATUS_ITEMS: StatusItem[] = [
  {
    key: 'mode',
    label: 'Mode',
    colorMap: { active: '#22c55e', wait: '#f59e0b', sleep: '#6b7280', transmit: '#3b82f6' },
  },
  {
    key: 'battery',
    label: 'Battery',
    colorMap: { Full: '#22c55e', High: '#84cc16', Middle: '#f59e0b', Low: '#f97316', Critical: '#ef4444' },
  },
  { key: 'logging_status', label: 'Log', colorMap: { ON: '#22c55e', OFF: '#6b7280' } },
  { key: 'wifi_status', label: 'WiFi', colorMap: { OK: '#22c55e', NG: '#ef4444' } },
  { key: 'gnss_status', label: 'GNSS', colorMap: { lock: '#22c55e', unlock: '#f97316' } },
];

interface StatusWidgetProps {
  items?: StatusItem[];
}

export function StatusWidget({ items = DEFAULT_STATUS_ITEMS }: StatusWidgetProps) {
  const { latest } = useTelemetryStore();

  const getValue = (key: string): string | null => {
    if (!latest) return null;
    const v = (latest as unknown as Record<string, unknown>)[key];
    return v != null ? String(v) : null;
  };

  const getColor = (item: StatusItem, value: string | null): string => {
    if (!value || !item.colorMap) return '#6b7280';
    return item.colorMap[value] || '#6b7280';
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2">
      {items.map((item) => {
        const value = getValue(item.key);
        const color = getColor(item, value);
        return (
          <div
            key={item.key}
            className="bg-gray-800 rounded-lg p-3 flex flex-col gap-1"
          >
            <span className="text-xs text-gray-500 uppercase tracking-wide">{item.label}</span>
            <span
              className="text-base font-semibold"
              style={{ color }}
            >
              {value ?? '---'}
            </span>
            {latest && (
              <span className="text-xs text-gray-600">
                {new Date(latest.received_at).toLocaleTimeString()}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
