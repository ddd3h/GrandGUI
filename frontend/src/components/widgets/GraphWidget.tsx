import { useEffect, useRef, useMemo } from 'react';
import * as echarts from 'echarts';
import { useTelemetryStore } from '../../stores/telemetryStore';
import type { TelemetryPoint } from '../../types';

type TimeWindow = '1m' | '5m' | '15m' | 'all';

interface GraphWidgetProps {
  field: keyof TelemetryPoint;
  title?: string;
  window?: TimeWindow;
  color?: string;
}

const WINDOW_MS: Record<TimeWindow, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  'all': Infinity,
};

/**
 * Parse a timestamp string as UTC milliseconds.
 *
 * Python's datetime.utcnow().isoformat() produces strings like
 * "2026-04-05T01:00:00.123456" — no timezone designator.
 * JavaScript treats these as LOCAL time, not UTC.
 * In UTC+9 this makes all data appear 9 hours in the past,
 * causing every point to fail the 5-minute window filter.
 *
 * Fix: if the string has no tz designator, append "Z" so JS
 * parses it as UTC (which is what the backend intended).
 */
function parseUtcMs(s: string): number {
  if (s.endsWith('Z') || s.includes('+') || /[+-]\d{2}:\d{2}$/.test(s)) {
    return new Date(s).getTime();
  }
  return new Date(s + 'Z').getTime();
}

export function GraphWidget({
  field,
  title,
  window = '5m',
  color = '#3b82f6',
}: GraphWidgetProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);
  const { history } = useTelemetryStore();

  // Initialize ECharts — use explicit height so canvas always has real dimensions
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = echarts.init(chartRef.current, null, { renderer: 'canvas' });
    chart.setOption({
      backgroundColor: 'transparent',
      grid: { top: 10, right: 10, bottom: 28, left: 48 },
      xAxis: {
        type: 'time',
        axisLabel: {
          fontSize: 10,
          color: '#9ca3af',
          formatter: (val: number) =>
            new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        },
        splitLine: { lineStyle: { color: '#4b5563' } },
        axisLine: { lineStyle: { color: '#6b7280' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 10, color: '#9ca3af' },
        splitLine: { lineStyle: { color: '#4b5563' } },
        axisLine: { lineStyle: { color: '#6b7280' } },
      },
      series: [{
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { color, width: 2 },
        areaStyle: { color: `${color}30` },
        data: [],
      }],
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1f2937',
        borderColor: '#374151',
        textStyle: { color: '#f9fafb', fontSize: 11 },
      },
    });
    instanceRef.current = chart;

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(chartRef.current);

    return () => {
      observer.disconnect();
      chart.dispose();
      instanceRef.current = null;
    };
  }, [color]);

  // Filter and map history to chart data points.
  // Use parseUtcMs to correctly handle Python's no-tz UTC timestamps.
  const filtered = useMemo(() => {
    const cutoff = Date.now() - WINDOW_MS[window];
    return history
      .filter((p) => {
        const val = p[field];
        if (val == null || typeof val !== 'number') return false;
        if (window === 'all') return true;
        return parseUtcMs(p.received_at) >= cutoff;
      })
      .map((p) => [parseUtcMs(p.received_at), p[field] as number]);
  }, [history, field, window]);

  useEffect(() => {
    instanceRef.current?.setOption({ series: [{ data: filtered }] }, { notMerge: false });
  }, [filtered]);

  const latest = filtered.length > 0 ? filtered[filtered.length - 1][1] : null;

  return (
    <div className="flex flex-col" style={{ minHeight: 200 }}>
      {/* Stats row */}
      <div className="flex items-baseline justify-between px-3 py-2 flex-shrink-0">
        <span className="text-sm font-medium text-gray-300">{title || String(field)}</span>
        {latest != null && (
          <span className="text-lg font-bold" style={{ color }}>
            {latest.toFixed(1)}
          </span>
        )}
      </div>
      {/* Chart — fixed height so ECharts always gets real dimensions */}
      <div ref={chartRef} style={{ height: 160, flexShrink: 0 }} />
    </div>
  );
}
