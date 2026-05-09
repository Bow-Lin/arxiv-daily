import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { todayStr, daysAgoStr } from '../arxiv-api';

describe('todayStr', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns today as YYYY-MM-DD', () => {
    vi.setSystemTime(new Date('2024-03-15T12:00:00'));
    expect(todayStr()).toBe('2024-03-15');
  });

  it('handles month boundary correctly', () => {
    vi.setSystemTime(new Date('2024-01-05T00:00:00'));
    expect(todayStr()).toBe('2024-01-05');
  });
});

describe('daysAgoStr', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns correct date for 1 day ago', () => {
    vi.setSystemTime(new Date('2024-03-15T12:00:00'));
    expect(daysAgoStr(1)).toBe('2024-03-14');
  });

  it('returns correct date for 7 days ago', () => {
    vi.setSystemTime(new Date('2024-03-15T12:00:00'));
    expect(daysAgoStr(7)).toBe('2024-03-08');
  });

  it('handles month rollover', () => {
    vi.setSystemTime(new Date('2024-03-01T12:00:00'));
    expect(daysAgoStr(1)).toBe('2024-02-29');
  });

  it('returns today when n is 0', () => {
    vi.setSystemTime(new Date('2024-03-15T12:00:00'));
    expect(daysAgoStr(0)).toBe('2024-03-15');
  });
});
