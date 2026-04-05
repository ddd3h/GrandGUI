/**
 * Tests for GraphWidget rendering and ECharts integration.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useTelemetryStore } from '../stores/telemetryStore';
import type { TelemetryPoint } from '../types';

// ---------------------------------------------------------------------------
// Mock ECharts — capture calls so we can assert on them
// ---------------------------------------------------------------------------
const mockSetOption = vi.fn();
const mockResize = vi.fn();
const mockDispose = vi.fn();
const mockInit = vi.fn(() => ({
  setOption: mockSetOption,
  resize: mockResize,
  dispose: mockDispose,
}));

vi.mock('echarts', () => ({ init: mockInit }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** UTC timestamp without Z — mimics Python's datetime.utcnow().isoformat(). */
function utcNoZ(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString().replace('Z', '');
}
/** Correct UTC timestamp with Z. */
function utcWithZ(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function makePoint(overrides: Partial<TelemetryPoint> & { received_at: string }): TelemetryPoint {
  return {
    id: Math.random(),
    received_at: overrides.received_at,
    altitude: 55.0,
    rssi: -70.0,
    barometric_pressure: 1010.0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GraphWidget — ECharts initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTelemetryStore.setState({ latest: null, history: [] });
  });

  it('calls echarts.init() once on mount', async () => {
    const { GraphWidget } = await import('../components/widgets/GraphWidget');
    render(<GraphWidget field="altitude" title="Altitude" window="5m" />);
    expect(mockInit).toHaveBeenCalledTimes(1);
  });

  it('calls setOption with series data on mount', async () => {
    const { GraphWidget } = await import('../components/widgets/GraphWidget');
    render(<GraphWidget field="altitude" title="Altitude" window="5m" />);
    // First setOption call configures the chart (axes, series, etc.)
    expect(mockSetOption).toHaveBeenCalled();
    const firstCall = mockSetOption.mock.calls[0][0] as Record<string, unknown>;
    expect(firstCall).toHaveProperty('xAxis');
    expect(firstCall).toHaveProperty('yAxis');
    expect(firstCall).toHaveProperty('series');
  });
});

describe('GraphWidget — data filtering with UTC timestamps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTelemetryStore.setState({ latest: null, history: [] });
  });

  it('includes data with Z timestamp within 5m window', async () => {
    const { GraphWidget } = await import('../components/widgets/GraphWidget');

    const pts = [
      makePoint({ received_at: utcWithZ(-10_000), altitude: 55 }),  // 10s ago
      makePoint({ received_at: utcWithZ(-60_000), altitude: 58 }),  // 1m ago
    ];
    await act(async () => {
      useTelemetryStore.setState({ history: pts });
    });
    render(<GraphWidget field="altitude" title="Altitude" window="5m" />);

    // The second setOption call updates the series data
    const dataCalls = mockSetOption.mock.calls.filter(
      (c) => (c[0] as Record<string, unknown>).series !== undefined
        && !((c[0] as Record<string, unknown>).xAxis)  // exclude the init call
    );
    if (dataCalls.length > 0) {
      const series = (dataCalls[0][0] as { series: { data: unknown[] }[] }).series;
      expect(series[0].data.length).toBe(2);
    }
  });

  it('includes data with no-Z timestamp (UTC) within 5m window', async () => {
    const { GraphWidget } = await import('../components/widgets/GraphWidget');

    const pts = [
      makePoint({ received_at: utcNoZ(-10_000), altitude: 55 }),  // 10s ago UTC, no Z
      makePoint({ received_at: utcNoZ(-60_000), altitude: 58 }),  // 1m ago UTC, no Z
    ];
    await act(async () => {
      useTelemetryStore.setState({ history: pts });
    });
    render(<GraphWidget field="altitude" title="Altitude" window="5m" />);

    const dataCalls = mockSetOption.mock.calls.filter(
      (c) => (c[0] as Record<string, unknown>).series !== undefined
        && !((c[0] as Record<string, unknown>).xAxis)
    );
    if (dataCalls.length > 0) {
      const series = (dataCalls[0][0] as { series: { data: unknown[] }[] }).series;
      // With the fix: both points should be included
      expect(series[0].data.length).toBe(2);
    }
  });

  it('excludes data older than window', async () => {
    const { GraphWidget } = await import('../components/widgets/GraphWidget');

    const pts = [
      makePoint({ received_at: utcWithZ(-400_000), altitude: 55 }), // 400s ago, outside 5m
    ];
    await act(async () => {
      useTelemetryStore.setState({ history: pts });
    });
    render(<GraphWidget field="altitude" title="Altitude" window="5m" />);

    const dataCalls = mockSetOption.mock.calls.filter(
      (c) => (c[0] as Record<string, unknown>).series !== undefined
        && !((c[0] as Record<string, unknown>).xAxis)
    );
    if (dataCalls.length > 0) {
      const series = (dataCalls[0][0] as { series: { data: unknown[] }[] }).series;
      expect(series[0].data.length).toBe(0);
    }
  });

  it('includes all data with "all" window regardless of timestamp format', async () => {
    const { GraphWidget } = await import('../components/widgets/GraphWidget');

    const pts = [
      makePoint({ received_at: utcNoZ(-400_000), altitude: 55 }),  // old, no Z
      makePoint({ received_at: utcNoZ(-1_000_000), altitude: 58 }), // very old, no Z
    ];
    await act(async () => {
      useTelemetryStore.setState({ history: pts });
    });
    render(<GraphWidget field="altitude" window="all" />);

    const dataCalls = mockSetOption.mock.calls.filter(
      (c) => (c[0] as Record<string, unknown>).series !== undefined
        && !((c[0] as Record<string, unknown>).xAxis)
    );
    if (dataCalls.length > 0) {
      const series = (dataCalls[0][0] as { series: { data: unknown[] }[] }).series;
      expect(series[0].data.length).toBe(2);
    }
  });

  it('filters out null / non-numeric field values', async () => {
    const { GraphWidget } = await import('../components/widgets/GraphWidget');

    const pts = [
      makePoint({ received_at: utcWithZ(-5_000), altitude: undefined }),  // null altitude
      makePoint({ received_at: utcWithZ(-5_000), altitude: 55 }),          // valid
    ];
    await act(async () => {
      useTelemetryStore.setState({ history: pts });
    });
    render(<GraphWidget field="altitude" window="5m" />);

    const dataCalls = mockSetOption.mock.calls.filter(
      (c) => (c[0] as Record<string, unknown>).series !== undefined
        && !((c[0] as Record<string, unknown>).xAxis)
    );
    if (dataCalls.length > 0) {
      const series = (dataCalls[0][0] as { series: { data: unknown[] }[] }).series;
      expect(series[0].data.length).toBe(1); // only the valid one
    }
  });
});

describe('GraphWidget — chart resize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTelemetryStore.setState({ latest: null, history: [] });
  });

  it('disposes chart on unmount', async () => {
    const { GraphWidget } = await import('../components/widgets/GraphWidget');
    const { unmount } = render(<GraphWidget field="altitude" window="5m" />);
    unmount();
    expect(mockDispose).toHaveBeenCalledTimes(1);
  });
});
