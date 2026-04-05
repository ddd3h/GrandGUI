import { describe, it, expect, beforeEach } from 'vitest';
import { useTelemetryStore } from '../stores/telemetryStore';
import type { TelemetryPoint } from '../types';

const makePoint = (id: number): TelemetryPoint => ({
  id,
  received_at: new Date().toISOString(),
  latitude: 35.6812 + id * 0.0001,
  longitude: 139.7671 + id * 0.0001,
});

describe('telemetryStore', () => {
  beforeEach(() => {
    useTelemetryStore.setState({ latest: null, history: [], wsConnected: false });
  });

  it('setLatest updates latest point', () => {
    const p = makePoint(1);
    useTelemetryStore.getState().setLatest(p);
    expect(useTelemetryStore.getState().latest?.id).toBe(1);
  });

  it('appendHistory adds points', () => {
    useTelemetryStore.getState().appendHistory(makePoint(1));
    useTelemetryStore.getState().appendHistory(makePoint(2));
    expect(useTelemetryStore.getState().history).toHaveLength(2);
  });

  it('setHistory replaces history', () => {
    useTelemetryStore.getState().appendHistory(makePoint(1));
    useTelemetryStore.getState().setHistory([makePoint(10), makePoint(11)]);
    expect(useTelemetryStore.getState().history).toHaveLength(2);
    expect(useTelemetryStore.getState().history[0].id).toBe(10);
  });

  it('caps history at 1000 points', () => {
    const { appendHistory } = useTelemetryStore.getState();
    for (let i = 0; i < 1005; i++) {
      appendHistory(makePoint(i));
    }
    expect(useTelemetryStore.getState().history.length).toBeLessThanOrEqual(1000);
  });

  it('setSerialStatus merges partial update', () => {
    const { setSerialStatus } = useTelemetryStore.getState();
    setSerialStatus({ connected: true });
    setSerialStatus({ source_type: 'simulator' });
    const s = useTelemetryStore.getState().serialStatus;
    expect(s.connected).toBe(true);
    expect(s.source_type).toBe('simulator');
  });
});

describe('uiStore', () => {
  it('persists coordFormat', async () => {
    const { useUiStore } = await import('../stores/uiStore');
    useUiStore.getState().setCoordFormat('dms');
    expect(useUiStore.getState().coordFormat).toBe('dms');
    useUiStore.getState().setCoordFormat('decimal');
  });
});
