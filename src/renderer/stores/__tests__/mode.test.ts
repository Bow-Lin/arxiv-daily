import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

vi.stubGlobal('localStorage', localStorageMock);

describe('useModeStore', () => {
  beforeEach(() => {
    localStorageMock.clear();
    setActivePinia(createPinia());
  });

  it('defaults to arxiv mode', async () => {
    const { useModeStore } = await import('../mode');
    const store = useModeStore();
    expect(store.mode).toBe('arxiv');
    expect(store.isConference).toBe(false);
  });

  it('persists mode to localStorage', async () => {
    localStorageMock.setItem('app-mode', 'conference');
    const { useModeStore } = await import('../mode');
    const store = useModeStore();
    expect(store.mode).toBe('conference');
    expect(store.isConference).toBe(true);
  });

  it('toggles mode', async () => {
    const { useModeStore } = await import('../mode');
    const store = useModeStore();
    expect(store.mode).toBe('arxiv');
    store.mode = 'conference';
    expect(store.isConference).toBe(true);
    store.mode = 'arxiv';
    expect(store.isConference).toBe(false);
  });
});
