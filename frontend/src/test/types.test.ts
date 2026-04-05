import { describe, it, expect } from 'vitest';
import { toDms } from '../types';

describe('toDms', () => {
  it('converts positive latitude (N)', () => {
    const result = toDms(35.6812, true);
    expect(result).toContain('N');
    expect(result).toContain('35°');
  });

  it('converts negative latitude (S)', () => {
    const result = toDms(-35.6812, true);
    expect(result).toContain('S');
  });

  it('converts positive longitude (E)', () => {
    const result = toDms(139.7671, false);
    expect(result).toContain('E');
    expect(result).toContain('139°');
  });

  it('converts negative longitude (W)', () => {
    const result = toDms(-139.7671, false);
    expect(result).toContain('W');
  });

  it('zero coordinate is N/E', () => {
    expect(toDms(0, true)).toContain('N');
    expect(toDms(0, false)).toContain('E');
  });
});
