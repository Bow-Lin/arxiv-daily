import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProgressStore } from '../progress';

describe('useProgressStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('has correct defaults', () => {
    const store = useProgressStore();
    expect(store.isFetching).toBe(false);
    expect(store.isAnalyzing).toBe(false);
    expect(store.progressPhase).toBe('');
    expect(store.progressCurrent).toBe(0);
    expect(store.progressTotal).toBe(0);
    expect(store.currentPaper).toBe('');
    expect(store.lastError).toBe('');
  });

  it('showProgress is computed from isFetching and isAnalyzing', () => {
    const store = useProgressStore();
    expect(store.showProgress).toBe(false);
    store.isFetching = true;
    expect(store.showProgress).toBe(true);
    store.isFetching = false;
    store.isAnalyzing = true;
    expect(store.showProgress).toBe(true);
  });

  it('progressPercent calculates correctly', () => {
    const store = useProgressStore();
    expect(store.progressPercent).toBe(0);
    store.progressTotal = 100;
    store.progressCurrent = 50;
    expect(store.progressPercent).toBe(50);
    store.progressCurrent = 100;
    expect(store.progressPercent).toBe(100);
  });

  it('progressCounter formats correctly', () => {
    const store = useProgressStore();
    expect(store.progressCounter).toBe('');
    store.progressTotal = 10;
    store.progressCurrent = 3;
    expect(store.progressCounter).toBe('3 / 10');
  });

  it('reset clears fetching/analyzing state', () => {
    const store = useProgressStore();
    store.isFetching = true;
    store.isAnalyzing = true;
    store.progressPhase = 'testing';
    store.currentPaper = 'paper1';
    store.lastError = 'error';

    store.reset();

    expect(store.isFetching).toBe(false);
    expect(store.isAnalyzing).toBe(false);
    expect(store.progressPhase).toBe('');
    expect(store.currentPaper).toBe('');
    expect(store.lastError).toBe('');
  });
});
