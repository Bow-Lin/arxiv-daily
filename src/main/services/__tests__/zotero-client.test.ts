import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { fetchCollections } from '../zotero-client';

describe('fetchCollections', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('fetches and maps collections', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { key: 'ABC123', data: { name: 'My Collection' }, meta: { numItems: 5 } },
      ],
    });

    const result = await fetchCollections('12345', 'test-key');
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('ABC123');
    expect(result[0].name).toBe('My Collection');
    expect(result[0].numItems).toBe(5);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.zotero.org/users/12345/collections?limit=100',
      expect.objectContaining({ headers: { 'Zotero-API-Key': 'test-key' } }),
    );
  });

  it('handles 403 error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    });

    await expect(fetchCollections('12345', 'bad-key')).rejects.toThrow('API Key 无权限');
  });

  it('handles 404 error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'Not Found',
    });

    await expect(fetchCollections('99999', 'key')).rejects.toThrow('用户不存在');
  });

  it('handles empty response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const result = await fetchCollections('12345', 'test-key');
    expect(result).toEqual([]);
  });
});
