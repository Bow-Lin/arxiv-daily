import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useToastStore } from '../toast';

describe('useToastStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('show', () => {
    it('adds a toast to the list', () => {
      const store = useToastStore();
      store.show('Title', 'Body');
      expect(store.toasts).toHaveLength(1);
      expect(store.toasts[0].title).toBe('Title');
      expect(store.toasts[0].body).toBe('Body');
    });

    it('returns incrementing ids', () => {
      const store = useToastStore();
      const id1 = store.show('A', 'B');
      const id2 = store.show('C', 'D');
      expect(id2).toBe(id1 + 1);
    });

    it('defaults type to info', () => {
      const store = useToastStore();
      store.show('T', 'B');
      expect(store.toasts[0].type).toBe('info');
    });

    it('defaults duration to 3000 for info type', () => {
      const store = useToastStore();
      store.show('T', 'B');
      vi.advanceTimersByTime(2999);
      expect(store.toasts).toHaveLength(1);
      vi.advanceTimersByTime(2);
      // After duration, remove() is called (sets removing=true), then after 250ms filter
      expect(store.toasts[0].removing).toBe(true);
    });

    it('defaults duration to 3000 for success type', () => {
      const store = useToastStore();
      store.show('T', 'B', 'success');
      vi.advanceTimersByTime(3000);
      expect(store.toasts[0].removing).toBe(true);
    });

    it('defaults duration to 0 for error type (no auto-remove)', () => {
      const store = useToastStore();
      store.show('T', 'B', 'error');
      vi.advanceTimersByTime(100000);
      expect(store.toasts[0].removing).toBe(false);
    });

    it('uses 8000 default duration when details present', () => {
      const store = useToastStore();
      store.show('T', 'B', 'info', 'details');
      vi.advanceTimersByTime(7999);
      expect(store.toasts[0].removing).toBe(false);
      vi.advanceTimersByTime(2);
      expect(store.toasts[0].removing).toBe(true);
    });

    it('uses explicit duration when provided', () => {
      const store = useToastStore();
      store.show('T', 'B', 'info', undefined, 5000);
      vi.advanceTimersByTime(4999);
      expect(store.toasts[0].removing).toBe(false);
      vi.advanceTimersByTime(2);
      expect(store.toasts[0].removing).toBe(true);
    });

    it('explicit duration overrides defaults', () => {
      const store = useToastStore();
      store.show('T', 'B', 'error', undefined, 1000);
      vi.advanceTimersByTime(1000);
      expect(store.toasts[0].removing).toBe(true);
    });

    it('stores details when provided', () => {
      const store = useToastStore();
      store.show('T', 'B', 'error', 'error details');
      expect(store.toasts[0].details).toBe('error details');
    });

    it('initializes removing as false', () => {
      const store = useToastStore();
      store.show('T', 'B');
      expect(store.toasts[0].removing).toBe(false);
    });
  });

  describe('remove', () => {
    it('sets removing to true immediately', () => {
      const store = useToastStore();
      const id = store.show('T', 'B', 'error');
      store.remove(id);
      expect(store.toasts[0].removing).toBe(true);
    });

    it('removes toast from array after 250ms', () => {
      const store = useToastStore();
      const id = store.show('T', 'B', 'error');
      store.remove(id);
      expect(store.toasts).toHaveLength(1);
      vi.advanceTimersByTime(250);
      expect(store.toasts).toHaveLength(0);
    });

    it('ignores non-existent id', () => {
      const store = useToastStore();
      expect(() => store.remove(999)).not.toThrow();
      expect(store.toasts).toHaveLength(0);
    });

    it('ignores already-removing toast', () => {
      const store = useToastStore();
      const id = store.show('T', 'B', 'error');
      store.remove(id);
      store.remove(id); // second call should be no-op
      expect(store.toasts).toHaveLength(1);
      vi.advanceTimersByTime(250);
      expect(store.toasts).toHaveLength(0);
    });
  });

  describe('resetToastId', () => {
    it('sets nextId to max existing id + 1', () => {
      const store = useToastStore();
      store.resetToastId(); // Reset first to get predictable starting id
      store.show('A', 'B');
      store.show('C', 'D');
      store.show('E', 'F');
      store.resetToastId();
      const nextId = store.show('X', 'Y');
      expect(nextId).toBe(3);
    });

    it('handles empty toast list', () => {
      const store = useToastStore();
      store.resetToastId();
      const nextId = store.show('A', 'B');
      expect(nextId).toBe(0);
    });
  });

  describe('auto-remove lifecycle', () => {
    it('toast is fully removed after duration + 250ms', () => {
      const store = useToastStore();
      store.show('T', 'B', 'info');
      vi.advanceTimersByTime(3000);
      expect(store.toasts[0].removing).toBe(true);
      expect(store.toasts).toHaveLength(1);
      vi.advanceTimersByTime(250);
      expect(store.toasts).toHaveLength(0);
    });
  });
});
