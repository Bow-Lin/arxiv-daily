import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron net.fetch
vi.mock('electron', () => ({
  net: {
    fetch: vi.fn(),
  },
}));

import { classifyDirectNetworkError } from '../net-fetch';

describe('classifyDirectNetworkError', () => {
  it('classifies TimeoutError', () => {
    const err = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    const result = classifyDirectNetworkError(err);
    expect(result.message).toBe('网络请求超时');
  });

  it('classifies unknown error', () => {
    const result = classifyDirectNetworkError(new Error('unknown'));
    expect(result.message).toBe('网络连接失败');
  });
});
