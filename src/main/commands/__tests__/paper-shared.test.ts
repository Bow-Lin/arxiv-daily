import { describe, it, expect } from 'vitest';
import { rowToPaper, execResultToPaperRows } from '../paper-shared';

describe('execResultToPaperRows', () => {
  it('converts sql.js result to row objects', () => {
    const result = {
      columns: ['id', 'title', 'authors'],
      values: [
        ['1', 'Paper A', '["Alice"]'],
        ['2', 'Paper B', '["Bob", "Charlie"]'],
      ],
    };
    const rows = execResultToPaperRows(result);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ id: '1', title: 'Paper A', authors: '["Alice"]' });
    expect(rows[1]).toEqual({ id: '2', title: 'Paper B', authors: '["Bob", "Charlie"]' });
  });

  it('handles empty result', () => {
    const rows = execResultToPaperRows({ columns: ['id'], values: [] });
    expect(rows).toEqual([]);
  });

  it('handles columns with special characters in values', () => {
    const result = {
      columns: ['id', 'abstract_text'],
      values: [['1', 'This has "quotes" and new\nlines']],
    };
    const rows = execResultToPaperRows(result);
    expect(rows[0].abstract_text).toBe('This has "quotes" and new\nlines');
  });
});

describe('rowToPaper', () => {
  it('parses JSON authors and categories', () => {
    const row: Record<string, unknown> = {
      id: '1234.5678',
      title: 'Test Paper',
      authors: '["Alice", "Bob"]',
      abstract_text: 'Abstract',
      url: 'https://arxiv.org/abs/1234.5678',
      pdf_url: 'https://arxiv.org/pdf/1234.5678.pdf',
      published_date: '2024-03-15',
      updated_date: '2024-03-15',
      categories: '["cs.AI", "cs.LG"]',
      fetched_at: '2024-03-15',
      summary: 'Summary',
      analysis: 'Analysis',
    };
    const paper = rowToPaper(row);
    expect(paper.authors).toEqual(['Alice', 'Bob']);
    expect(paper.categories).toEqual(['cs.AI', 'cs.LG']);
  });

  it('handles null summary and analysis', () => {
    const row: Record<string, unknown> = {
      id: '1',
      title: 'T',
      authors: '[]',
      abstract_text: '',
      url: '',
      pdf_url: '',
      published_date: '',
      updated_date: '',
      categories: '[]',
      fetched_at: '',
      summary: null,
      analysis: null,
    };
    const paper = rowToPaper(row);
    expect(paper.summary).toBeNull();
    expect(paper.analysis).toBeNull();
  });

  it('handles empty arrays', () => {
    const row: Record<string, unknown> = {
      id: '1',
      title: 'T',
      authors: '[]',
      abstract_text: '',
      url: '',
      pdf_url: '',
      published_date: '',
      updated_date: '',
      categories: '[]',
      fetched_at: '',
      summary: null,
      analysis: null,
    };
    const paper = rowToPaper(row);
    expect(paper.authors).toEqual([]);
    expect(paper.categories).toEqual([]);
  });
});
