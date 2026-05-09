import { describe, it, expect } from 'vitest';
import { matchesKeywords, filterPaperTopics, type Topic } from '../filter';

describe('matchesKeywords', () => {
  it('returns true when text contains a keyword', () => {
    expect(matchesKeywords('Hello World', ['world'])).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(matchesKeywords('Hello World', ['WORLD'])).toBe(true);
    expect(matchesKeywords('HELLO WORLD', ['hello'])).toBe(true);
  });

  it('returns false when no keyword matches', () => {
    expect(matchesKeywords('Hello World', ['foo', 'bar'])).toBe(false);
  });

  it('returns false for empty keywords', () => {
    expect(matchesKeywords('Hello World', [])).toBe(false);
  });

  it('handles partial matches', () => {
    expect(matchesKeywords('machine learning', ['learn'])).toBe(true);
  });
});

describe('filterPaperTopics', () => {
  const topics: Topic[] = [
    { id: 1, name: 'AI', keywords: ['ai', 'artificial intelligence'], enabled: true },
    { id: 2, name: 'Crypto', keywords: ['crypto', 'blockchain'], enabled: true },
    { id: 3, name: 'Unused', keywords: ['unused'], enabled: true },
  ];

  it('returns matching topic names', () => {
    const result = filterPaperTopics('Advances in AI', 'We study artificial intelligence.', topics);
    expect(result).toContain('AI');
    expect(result).not.toContain('Crypto');
    expect(result).not.toContain('Unused');
  });

  it('matches keywords in both title and abstract', () => {
    const result = filterPaperTopics('Title', 'Abstract mentions blockchain.', topics);
    expect(result).toContain('Crypto');
  });

  it('returns multiple matches', () => {
    const result = filterPaperTopics('AI and crypto', 'Abstract.', topics);
    expect(result).toEqual(['AI', 'Crypto']);
  });

  it('returns empty array when nothing matches', () => {
    const result = filterPaperTopics('Biology', 'Genetics study.', topics);
    expect(result).toEqual([]);
  });
});
