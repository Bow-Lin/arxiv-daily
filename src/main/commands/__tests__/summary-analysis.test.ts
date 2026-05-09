import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
import { getUnsummarizedPapers, stopSummary, setSummaryAbortController } from '../summary';
import { stopAnalysis, setAnalysisAbortController } from '../analysis';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS papers (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  authors TEXT NOT NULL,
  abstract_text TEXT NOT NULL,
  url TEXT NOT NULL,
  pdf_url TEXT NOT NULL,
  published_date TEXT NOT NULL,
  updated_date TEXT NOT NULL,
  categories TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  relevance_topics TEXT
);
CREATE TABLE IF NOT EXISTS analyses (
  paper_id TEXT PRIMARY KEY,
  summary TEXT DEFAULT '',
  analysis TEXT DEFAULT '',
  FOREIGN KEY (paper_id) REFERENCES papers(id)
);
`;

function insertPaper(db: SqlJsDatabase, id: string, title: string, relevanceTopics: string | null = null) {
  db.run(
    `INSERT INTO papers (id, title, authors, abstract_text, url, pdf_url, published_date, updated_date, categories, fetched_at, relevance_topics)
     VALUES (?, ?, '[]', '', '', '', '2024-03-10', '2024-03-10', '[]', '2024-03-10', ?)`,
    [id, title, relevanceTopics],
  );
}

describe('getUnsummarizedPapers', () => {
  let SQL: any;
  let db: SqlJsDatabase;

  beforeAll(async () => {
    SQL = await initSqlJs({
      locateFile: () => 'node_modules/sql.js/dist/sql-wasm.wasm',
    });
  });

  beforeEach(() => {
    db = new SQL.Database();
    db.run(SCHEMA);
  });

  it('returns papers without summary', () => {
    insertPaper(db, '1', 'Paper A', '["AI"]');
    insertPaper(db, '2', 'Paper B', '["AI"]');
    db.run("INSERT INTO analyses VALUES ('1', 'Summary text', '')");

    const result = getUnsummarizedPapers(db);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('includes papers with empty summary', () => {
    insertPaper(db, '1', 'Paper A', '["AI"]');
    db.run("INSERT INTO analyses VALUES ('1', '', '')");

    const result = getUnsummarizedPapers(db);
    expect(result).toHaveLength(1);
  });

  it('includes papers with failed summary', () => {
    insertPaper(db, '1', 'Paper A', '["AI"]');
    db.run("INSERT INTO analyses VALUES ('1', 'SUMMARY_FAILED: timeout', '')");

    const result = getUnsummarizedPapers(db);
    expect(result).toHaveLength(1);
  });

  it('excludes papers without relevance_topics', () => {
    insertPaper(db, '1', 'Paper A', null);

    const result = getUnsummarizedPapers(db);
    expect(result).toHaveLength(0);
  });

  it('orders by published_date DESC', () => {
    insertPaper(db, '1', 'Old', '["AI"]');
    db.run("UPDATE papers SET published_date = '2024-03-01', updated_date = '2024-03-01' WHERE id = '1'");
    insertPaper(db, '2', 'New', '["AI"]');
    db.run("UPDATE papers SET published_date = '2024-03-15', updated_date = '2024-03-15' WHERE id = '2'");

    const result = getUnsummarizedPapers(db);
    expect(result[0].id).toBe('2');
    expect(result[1].id).toBe('1');
  });

  it('returns empty when all papers are summarized', () => {
    insertPaper(db, '1', 'Paper A', '["AI"]');
    db.run("INSERT INTO analyses VALUES ('1', 'Done', '')");

    expect(getUnsummarizedPapers(db)).toEqual([]);
  });

  it('returns empty when no papers exist', () => {
    expect(getUnsummarizedPapers(db)).toEqual([]);
  });
});

describe('summary abort controller', () => {
  it('stopSummary returns success', () => {
    expect(stopSummary()).toEqual({ success: true });
  });

  it('setSummaryAbortController sets and clears controller', () => {
    const ctrl = new AbortController();
    setSummaryAbortController(ctrl);
    stopSummary(); // should abort
    expect(ctrl.signal.aborted).toBe(true);
    setSummaryAbortController(null);
  });
});

describe('analysis abort controller', () => {
  it('stopAnalysis returns success when no controller', () => {
    expect(stopAnalysis()).toEqual({ success: true });
  });

  it('stopAnalysis aborts the controller', () => {
    const ctrl = new AbortController();
    setAnalysisAbortController(ctrl);
    stopAnalysis();
    expect(ctrl.signal.aborted).toBe(true);
    // Controller should be cleared
    stopAnalysis(); // should not throw
  });

  it('setAnalysisAbortController can set null', () => {
    expect(() => setAnalysisAbortController(null)).not.toThrow();
  });
});
