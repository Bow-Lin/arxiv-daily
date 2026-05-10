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
  fetched_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS analyses (
  paper_id TEXT PRIMARY KEY,
  summary TEXT DEFAULT '',
  analysis TEXT DEFAULT '',
  FOREIGN KEY (paper_id) REFERENCES papers(id)
);
`;

const TOPICS_SCHEMA = `
CREATE TABLE IF NOT EXISTS arxiv_paper_topics (
  paper_id TEXT NOT NULL,
  topic_id INTEGER NOT NULL,
  PRIMARY KEY (paper_id, topic_id)
);
`;

function insertPaper(db: SqlJsDatabase, id: string, title: string) {
  db.run(
    `INSERT INTO papers (id, title, authors, abstract_text, url, pdf_url, published_date, updated_date, categories, fetched_at)
     VALUES (?, ?, '[]', '', '', '', '2024-03-10', '2024-03-10', '[]', '2024-03-10')`,
    [id, title],
  );
}

describe('getUnsummarizedPapers', () => {
  let SQL: any;
  let db: SqlJsDatabase;
  let topicsDb: SqlJsDatabase;

  beforeAll(async () => {
    SQL = await initSqlJs({
      locateFile: () => 'node_modules/sql.js/dist/sql-wasm.wasm',
    });
    (globalThis as any).__testSQL = SQL;
  });

  beforeEach(() => {
    db = new SQL.Database();
    db.run(SCHEMA);
    topicsDb = new SQL.Database();
    topicsDb.run(TOPICS_SCHEMA);
  });

  it('returns papers with topic associations that have no summary', () => {
    topicsDb.run("INSERT INTO arxiv_paper_topics VALUES ('1', 1)");
    topicsDb.run("INSERT INTO arxiv_paper_topics VALUES ('2', 1)");
    insertPaper(db, '1', 'Paper A');
    insertPaper(db, '2', 'Paper B');
    insertPaper(db, '3', 'Paper C'); // no topic association
    db.run("INSERT INTO analyses VALUES ('1', 'Summary text', '')");

    const result = getUnsummarizedPapers(db, topicsDb);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('includes papers with empty summary', () => {
    topicsDb.run("INSERT INTO arxiv_paper_topics VALUES ('1', 1)");
    insertPaper(db, '1', 'Paper A');
    db.run("INSERT INTO analyses VALUES ('1', '', '')");

    const result = getUnsummarizedPapers(db, topicsDb);
    expect(result).toHaveLength(1);
  });

  it('includes papers with failed summary', () => {
    topicsDb.run("INSERT INTO arxiv_paper_topics VALUES ('1', 1)");
    insertPaper(db, '1', 'Paper A');
    db.run("INSERT INTO analyses VALUES ('1', 'SUMMARY_FAILED: timeout', '')");

    const result = getUnsummarizedPapers(db, topicsDb);
    expect(result).toHaveLength(1);
  });

  it('excludes papers without topic associations', () => {
    insertPaper(db, '1', 'Paper A'); // no entry in arxiv_paper_topics

    const result = getUnsummarizedPapers(db, topicsDb);
    expect(result).toHaveLength(0);
  });

  it('returns empty when no papers exist', () => {
    expect(getUnsummarizedPapers(db, topicsDb)).toEqual([]);
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
