import { describe, it, expect } from 'vitest';
import { formatDate, formatDateFull, truncate, extractErrorMessage } from '../format';

describe('formatDate', () => {
  it('formats ISO date to M月D日', () => {
    expect(formatDate('2024-03-15T10:00:00Z')).toBe('3月15日');
  });

  it('handles date without time', () => {
    expect(formatDate('2024-12-01')).toBe('12月1日');
  });

  it('returns empty string for empty input', () => {
    expect(formatDate('')).toBe('');
  });

  it('returns original for invalid date', () => {
    expect(formatDate('invalid')).toBe('invalid');
  });
});

describe('formatDateFull', () => {
  it('formats ISO date to Y年M月D日', () => {
    expect(formatDateFull('2024-03-15T10:00:00Z')).toBe('2024年3月15日');
  });

  it('returns empty string for empty input', () => {
    expect(formatDateFull('')).toBe('');
  });
});

describe('truncate', () => {
  it('returns original text when within limit', () => {
    expect(truncate('short', 40)).toBe('short');
  });

  it('truncates long text with ellipsis', () => {
    const long = 'a'.repeat(50);
    expect(truncate(long, 40)).toBe('a'.repeat(40) + '...');
  });

  it('uses default max of 40', () => {
    const long = 'a'.repeat(41);
    expect(truncate(long)).toBe('a'.repeat(40) + '...');
  });

  it('handles multi-byte characters', () => {
    expect(truncate('你好世界你好世界', 4)).toBe('你好世界...');
  });
});

describe('extractErrorMessage', () => {
  it('extracts message from Error object', () => {
    expect(extractErrorMessage(new Error('Something went wrong'))).toBe('Something went wrong');
  });

  it('strips IPC error prefix', () => {
    const err = new Error("Error invoking remote method 'fetch': Network timeout");
    expect(extractErrorMessage(err)).toBe('Network timeout');
  });

  it('converts non-error to string', () => {
    expect(extractErrorMessage('plain string')).toBe('plain string');
  });
});
