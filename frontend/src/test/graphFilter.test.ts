/**
 * Tests for GraphWidget time-window filtering logic.
 *
 * Root-cause reproduction: Python's datetime.utcnow().isoformat() produces
 * timestamps like "2026-04-05T01:00:00.000000" (no tz designator).
 * JavaScript parses these as LOCAL time, not UTC.
 * In UTC+9, that shifts data 9 hours into the past relative to Date.now(),
 * so the 5-minute filter rejects ALL data.
 */
import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers — mirror the logic in GraphWidget
// ---------------------------------------------------------------------------

const WINDOW_MS: Record<string, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  'all': Infinity,
};

/** BROKEN: parses timestamp naively — JS treats no-tz as LOCAL. */
function filterBroken(receivedAt: string, window: string, nowMs = Date.now()): boolean {
  if (window === 'all') return true;
  const cutoff = nowMs - WINDOW_MS[window];
  return new Date(receivedAt).getTime() >= cutoff;
}

/** FIXED: always treat no-tz timestamp as UTC by appending Z. */
function parseUtcMs(s: string): number {
  if (s.endsWith('Z') || s.includes('+') || s.includes('-', 10)) return new Date(s).getTime();
  return new Date(s + 'Z').getTime();
}
function filterFixed(receivedAt: string, window: string, nowMs = Date.now()): boolean {
  if (window === 'all') return true;
  const cutoff = nowMs - WINDOW_MS[window];
  return parseUtcMs(receivedAt) >= cutoff;
}

// ---------------------------------------------------------------------------
// Helper to build timestamps
// ---------------------------------------------------------------------------

/** Python utcnow().isoformat() style: UTC time, NO tz designator. */
function utcNoZ(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString().replace('Z', '');
}
/** ISO8601 with Z (correct). */
function utcWithZ(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}
/** Simulate JST (UTC+9) offset making the timestamp look like 9h in the past. */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Tests: root-cause reproduction
// ---------------------------------------------------------------------------

describe('Timestamp parsing — root-cause reproduction', () => {
  it('Date.now() equals a timestamp parsed with Z (within 10ms)', () => {
    const ts = utcWithZ();
    const diff = Math.abs(new Date(ts).getTime() - Date.now());
    expect(diff).toBeLessThan(10);
  });

  it('timestamp WITHOUT Z is misinterpreted as local time in non-UTC zones', () => {
    const offset = new Date().getTimezoneOffset(); // minutes, negative in UTC+N
    if (offset === 0) {
      // In UTC the bug does not manifest — skip assertion but document it.
      console.log('Skipped: system is UTC, timezone bug does not apply here');
      return;
    }
    const tsNoZ = utcNoZ();       // UTC time, no Z
    const tsZ   = utcWithZ();     // same instant, with Z

    const parsedNoZ = new Date(tsNoZ).getTime();
    const parsedZ   = new Date(tsZ).getTime();

    // They should differ by the timezone offset
    const diffMs = Math.abs(parsedNoZ - parsedZ);
    const expectedDiffMs = Math.abs(offset) * 60 * 1000;
    expect(diffMs).toBeCloseTo(expectedDiffMs, -3); // within 1s
  });
});

// ---------------------------------------------------------------------------
// Tests: broken filter
// ---------------------------------------------------------------------------

describe('filterBroken — shows the bug in non-UTC zones', () => {
  it('passes for timestamp with Z (correct UTC)', () => {
    const ts = utcWithZ(-1000); // 1 second ago, with Z
    expect(filterBroken(ts, '5m')).toBe(true);
  });

  it('passes for "all" window regardless of timestamp format', () => {
    const ancient = '2000-01-01T00:00:00'; // very old, no Z
    expect(filterBroken(ancient, 'all')).toBe(true);
  });

  it('FAILS for no-Z timestamp in non-UTC timezone (the actual bug)', () => {
    const offset = new Date().getTimezoneOffset();
    if (offset === 0) {
      console.log('Skipped: system is UTC, filterBroken works by coincidence');
      return;
    }
    // Simulate UTC now, no tz designator — as Python sends it
    const ts = utcNoZ(-1000); // 1 second ago UTC, no Z

    // In a UTC+N zone, JS parses this as N hours BEFORE UTC now → fails 5m filter
    const result = filterBroken(ts, '5m');
    expect(result).toBe(false); // BUG: should be true but isn't
  });

  it('FAILS for no-Z timestamp simulating UTC+9 (hard-coded check)', () => {
    const nowMs = Date.now();
    // A timestamp that IS within 5 minutes in UTC but appears 9h old when parsed as local
    const tsNoZ = new Date(nowMs - 30_000).toISOString().replace('Z', ''); // 30s ago UTC, no Z
    const simulatedLocalMs = new Date(tsNoZ).getTime(); // JS interprets as local
    const cutoff = nowMs - WINDOW_MS['5m'];

    // If the offset is 9h, simulatedLocalMs will be ~9h before nowMs → fails
    if (Math.abs(simulatedLocalMs - nowMs) > WINDOW_MS['5m']) {
      expect(filterBroken(tsNoZ, '5m', nowMs)).toBe(false);
    } else {
      // Already UTC, bug doesn't apply
      expect(filterBroken(tsNoZ, '5m', nowMs)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: fixed filter
// ---------------------------------------------------------------------------

describe('filterFixed — correct behavior', () => {
  it('passes for timestamp with Z', () => {
    const ts = utcWithZ(-1000); // 1 second ago
    expect(filterFixed(ts, '5m')).toBe(true);
  });

  it('passes for timestamp without Z (treats as UTC)', () => {
    const ts = utcNoZ(-1000); // 1 second ago UTC, no Z
    expect(filterFixed(ts, '5m')).toBe(true);
  });

  it('passes for timestamp without Z within 1m window', () => {
    const ts = utcNoZ(-30_000); // 30 seconds ago
    expect(filterFixed(ts, '1m')).toBe(true);
  });

  it('rejects timestamp older than window', () => {
    const ts = utcNoZ(-400_000); // 400 seconds ago, outside 5m
    expect(filterFixed(ts, '5m')).toBe(false);
  });

  it('always passes for "all" window', () => {
    expect(filterFixed('2000-01-01T00:00:00', 'all')).toBe(true);
    expect(filterFixed('2000-01-01T00:00:00Z', 'all')).toBe(true);
  });

  it('handles ISO8601 with +00:00 offset', () => {
    const ts = new Date(Date.now() - 2000).toISOString().replace('Z', '+00:00');
    expect(filterFixed(ts, '5m')).toBe(true);
  });

  it('handles Python-style microsecond precision without Z', () => {
    // Python: datetime.utcnow().isoformat() → "2026-04-05T01:00:00.123456"
    const ts = utcNoZ(-5000).replace(/\.\d+$/, '.123456');
    expect(filterFixed(ts, '5m')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: parseUtcMs utility
// ---------------------------------------------------------------------------

describe('parseUtcMs', () => {
  it('returns same ms for Z and no-Z of the same instant', () => {
    const base = new Date().toISOString(); // has Z
    const noZ  = base.replace('Z', '');
    expect(parseUtcMs(base)).toBe(parseUtcMs(noZ));
  });

  it('handles +00:00 suffix', () => {
    const ts = new Date().toISOString().replace('Z', '+00:00');
    const diff = Math.abs(parseUtcMs(ts) - Date.now());
    expect(diff).toBeLessThan(50);
  });

  it('is close to Date.now() for a just-created no-Z timestamp', () => {
    const ts = new Date().toISOString().replace('Z', '');
    const diff = Math.abs(parseUtcMs(ts) - Date.now());
    expect(diff).toBeLessThan(50);
  });
});
