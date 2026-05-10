import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
import { listPapers, getPaperDetail, listFetchDates, listTopicCounts } from '../paper';

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
CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  keywords TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS arxiv_paper_topics (
  paper_id TEXT NOT NULL,
  topic_id INTEGER NOT NULL,
  PRIMARY KEY (paper_id, topic_id)
);
CREATE INDEX IF NOT EXISTS idx_arxiv_pt_tid ON arxiv_paper_topics(topic_id, paper_id);
`;

function insertPaper(db: SqlJsDatabase, id: string, title: string, updatedDate: string) {
  db.run(
    `INSERT INTO papers (id, title, authors, abstract_text, url, pdf_url, published_date, updated_date, categories, fetched_at)
     VALUES (?, ?, '[]', '', '', '', ?, ?, '[]', ?)`,
    [id, title, updatedDate, updatedDate, updatedDate],
  );
}

function setupTopicDb(): SqlJsDatabase {
  const ptDb = new (globalThis as any).__testSQL.Database();
  ptDb.run(TOPICS_SCHEMA);
  return ptDb;
}

describe('listPapers', () => {
  let SQL: any;
  let db: SqlJsDatabase;

  beforeAll(async () => {
    SQL = await initSqlJs({
      locateFile: () => 'node_modules/sql.js/dist/sql-wasm.wasm',
    });
    (globalThis as any).__testSQL = SQL;
  });

  beforeEach(() => {
    db = new SQL.Database();
    db.run(SCHEMA);
  });

  it('returns empty result for no papers', () => {
    const result = listPapers(db, null, {});
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
    expect(result.page_size).toBe(20);
  });

  it('paginates results', () => {
    for (let i = 1; i <= 5; i++) {
      insertPaper(db, `${i}`, `Paper ${i}`, '2024-03-10');
    }
    const page1 = listPapers(db, null, { page: 1, pageSize: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.total).toBe(5);
    expect(page1.page).toBe(1);

    const page2 = listPapers(db, null, { page: 2, pageSize: 2 });
    expect(page2.items).toHaveLength(2);
    expect(page2.page).toBe(2);

    const page3 = listPapers(db, null, { page: 3, pageSize: 2 });
    expect(page3.items).toHaveLength(1);
  });

  it('filters by search query on title', () => {
    insertPaper(db, '1', 'Machine Learning Advances', '2024-03-10');
    insertPaper(db, '2', 'Biology Study', '2024-03-10');
    insertPaper(db, '3', 'Deep Learning Methods', '2024-03-10');
    const result = listPapers(db, null, { search: 'learning' });
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('filters by search query on abstract', () => {
    insertPaper(db, '1', 'Paper A', '2024-03-10');
    db.run("UPDATE papers SET abstract_text = 'This is about neural networks' WHERE id = '1'");
    insertPaper(db, '2', 'Paper B', '2024-03-10');
    const result = listPapers(db, null, { search: 'neural' });
    expect(result.items).toHaveLength(1);
  });

  it('filters by fetch date', () => {
    insertPaper(db, '1', 'Old Paper', '2024-03-10');
    insertPaper(db, '2', 'New Paper', '2024-03-15');
    const result = listPapers(db, null, { fetchDate: '2024-03-10' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('1');
  });

  it('filters by topic via junction table', () => {
    const ptDb = setupTopicDb();
    ptDb.run("INSERT INTO topics VALUES (1, 'AI', '[]', 1)");
    ptDb.run("INSERT INTO arxiv_paper_topics VALUES ('1', 1)");
    insertPaper(db, '1', 'AI Paper', '2024-03-10');
    insertPaper(db, '2', 'Bio Paper', '2024-03-10');
    const result = listPapers(db, ptDb, { topicId: 1 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('1');
  });

  it('returns no results when topic filter matches nothing', () => {
    const ptDb = setupTopicDb();
    ptDb.run("INSERT INTO topics VALUES (1, 'AI', '[]', 1)");
    insertPaper(db, '1', 'Paper', '2024-03-10');
    const result = listPapers(db, ptDb, { topicId: 1 });
    expect(result.items).toHaveLength(0);
  });

  it('orders by updated_date DESC', () => {
    insertPaper(db, '1', 'Old', '2024-03-01');
    insertPaper(db, '2', 'New', '2024-03-15');
    const result = listPapers(db, null, {});
    expect(result.items[0].id).toBe('2');
    expect(result.items[1].id).toBe('1');
  });

  it('clamps page_size to [1, 100]', () => {
    insertPaper(db, '1', 'Paper', '2024-03-10');
    expect(listPapers(db, null, { pageSize: 0 }).page_size).toBe(1);
    expect(listPapers(db, null, { pageSize: 200 }).page_size).toBe(100);
  });

  it('defaults page to 1', () => {
    expect(listPapers(db, null, { page: undefined }).page).toBe(1);
    expect(listPapers(db, null, { page: -1 }).page).toBe(1);
  });

  it('handles special characters in search', () => {
    insertPaper(db, '1', 'Paper with % symbol', '2024-03-10');
    const result = listPapers(db, null, { search: '% symbol' });
    expect(result.items).toHaveLength(1);
  });
});

describe('getPaperDetail', () => {
  let SQL: any;
  let db: SqlJsDatabase;

  beforeAll(async () => {
    SQL = await initSqlJs({
      locateFile: () => 'node_modules/sql.js/dist/sql-wasm.wasm',
    });
    (globalThis as any).__testSQL = SQL;
  });

  beforeEach(() => {
    db = new SQL.Database();
    db.run(SCHEMA);
  });

  it('returns paper details', () => {
    insertPaper(db, '1234.5678', 'Test Paper', '2024-03-10');
    const paper = getPaperDetail(db, '1234.5678');
    expect(paper.id).toBe('1234.5678');
    expect(paper.title).toBe('Test Paper');
    expect(paper.authors).toEqual([]);
  });

  it('throws for non-existent paper', () => {
    expect(() => getPaperDetail(db, '999')).toThrow('Paper 999 not found');
  });
});

describe('listFetchDates', () => {
  let SQL: any;
  let db: SqlJsDatabase;

  beforeAll(async () => {
    SQL = await initSqlJs({
      locateFile: () => 'node_modules/sql.js/dist/sql-wasm.wasm',
    });
    (globalThis as any).__testSQL = SQL;
  });

  beforeEach(() => {
    db = new SQL.Database();
    db.run(SCHEMA);
  });

  it('returns empty for no papers', () => {
    expect(listFetchDates(db)).toEqual([]);
  });

  it('groups papers by date and counts', () => {
    insertPaper(db, '1', 'A', '2024-03-10');
    insertPaper(db, '2', 'B', '2024-03-10');
    insertPaper(db, '3', 'C', '2024-03-15');
    const dates = listFetchDates(db);
    expect(dates).toHaveLength(2);
    // Ordered DESC
    expect(dates[0].date).toBe('2024-03-15');
    expect(dates[0].count).toBe(1);
    expect(dates[1].date).toBe('2024-03-10');
    expect(dates[1].count).toBe(2);
  });

  it('formats display date', () => {
    insertPaper(db, '1', 'A', '2024-03-10');
    const dates = listFetchDates(db);
    expect(dates[0].display).toBe('2024年3月10日');
  });
});

describe('listTopicCounts', () => {
  let SQL: any;

  beforeAll(async () => {
    SQL = await initSqlJs({
      locateFile: () => 'node_modules/sql.js/dist/sql-wasm.wasm',
    });
    (globalThis as any).__testSQL = SQL;
  });

  beforeEach(() => {
    // Only need paper_topics DB for this test
  });

  it('returns zero counts when no papers match', () => {
    const ptDb = setupTopicDb();
    ptDb.run("INSERT INTO topics VALUES (1, 'AI', '[]', 1)");
    const counts = listTopicCounts(ptDb);
    expect(counts).toHaveLength(1);
    expect(counts[0].count).toBe(0);
  });

  it('counts papers per topic via junction table', () => {
    const ptDb = setupTopicDb();
    ptDb.run("INSERT INTO topics VALUES (1, 'AI', '[]', 1)");
    ptDb.run("INSERT INTO topics VALUES (2, 'Bio', '[]', 1)");
    ptDb.run("INSERT INTO arxiv_paper_topics VALUES ('1', 1)");
    ptDb.run("INSERT INTO arxiv_paper_topics VALUES ('2', 1)");
    ptDb.run("INSERT INTO arxiv_paper_topics VALUES ('3', 2)");

    const counts = listTopicCounts(ptDb);
    expect(counts).toHaveLength(2);
    const ai = counts.find(c => c.name === 'AI');
    const bio = counts.find(c => c.name === 'Bio');
    expect(ai!.count).toBe(2);
    expect(bio!.count).toBe(1);
  });

  it('orders by count DESC', () => {
    const ptDb = setupTopicDb();
    ptDb.run("INSERT INTO topics VALUES (1, 'Popular', '[]', 1)");
    ptDb.run("INSERT INTO topics VALUES (2, 'Niche', '[]', 1)");
    ptDb.run("INSERT INTO arxiv_paper_topics VALUES ('1', 1)");
    ptDb.run("INSERT INTO arxiv_paper_topics VALUES ('2', 1)");
    ptDb.run("INSERT INTO arxiv_paper_topics VALUES ('3', 2)");

    const counts = listTopicCounts(ptDb);
    expect(counts[0].name).toBe('Popular');
    expect(counts[1].name).toBe('Niche');
  });

  it('returns empty for no topics', () => {
    const ptDb = setupTopicDb();
    expect(listTopicCounts(ptDb)).toEqual([]);
  });
});
