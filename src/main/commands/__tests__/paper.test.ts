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
  fetched_at TEXT NOT NULL,
  relevance_topics TEXT
);
CREATE TABLE IF NOT EXISTS analyses (
  paper_id TEXT PRIMARY KEY,
  summary TEXT DEFAULT '',
  analysis TEXT DEFAULT '',
  FOREIGN KEY (paper_id) REFERENCES papers(id)
);
CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  keywords TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE
);
`;

function insertPaper(db: SqlJsDatabase, id: string, title: string, updatedDate: string, relevanceTopics: string | null = null) {
  db.run(
    `INSERT INTO papers (id, title, authors, abstract_text, url, pdf_url, published_date, updated_date, categories, fetched_at, relevance_topics)
     VALUES (?, ?, '[]', '', '', '', ?, ?, '[]', ?, ?)`,
    [id, title, updatedDate, updatedDate, updatedDate, relevanceTopics],
  );
}

describe('listPapers', () => {
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

  it('returns empty result for no papers', () => {
    const result = listPapers(db, {});
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
    expect(result.page_size).toBe(20);
  });

  it('paginates results', () => {
    for (let i = 1; i <= 5; i++) {
      insertPaper(db, `${i}`, `Paper ${i}`, '2024-03-10');
    }
    const page1 = listPapers(db, { page: 1, pageSize: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.total).toBe(5);
    expect(page1.page).toBe(1);

    const page2 = listPapers(db, { page: 2, pageSize: 2 });
    expect(page2.items).toHaveLength(2);
    expect(page2.page).toBe(2);

    const page3 = listPapers(db, { page: 3, pageSize: 2 });
    expect(page3.items).toHaveLength(1);
  });

  it('filters by search query on title', () => {
    insertPaper(db, '1', 'Machine Learning Advances', '2024-03-10');
    insertPaper(db, '2', 'Biology Study', '2024-03-10');
    insertPaper(db, '3', 'Deep Learning Methods', '2024-03-10');
    const result = listPapers(db, { search: 'learning' });
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('filters by search query on abstract', () => {
    insertPaper(db, '1', 'Paper A', '2024-03-10');
    db.run("UPDATE papers SET abstract_text = 'This is about neural networks' WHERE id = '1'");
    insertPaper(db, '2', 'Paper B', '2024-03-10');
    const result = listPapers(db, { search: 'neural' });
    expect(result.items).toHaveLength(1);
  });

  it('filters by fetch date', () => {
    insertPaper(db, '1', 'Old Paper', '2024-03-10');
    insertPaper(db, '2', 'New Paper', '2024-03-15');
    const result = listPapers(db, { fetchDate: '2024-03-10' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('1');
  });

  it('filters by topic', () => {
    db.run("INSERT INTO topics VALUES (1, 'AI', '[]', 1)");
    insertPaper(db, '1', 'AI Paper', '2024-03-10', '["AI"]');
    insertPaper(db, '2', 'Bio Paper', '2024-03-10', '["Bio"]');
    const result = listPapers(db, { topicId: 1 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('1');
  });

  it('orders by updated_date DESC', () => {
    insertPaper(db, '1', 'Old', '2024-03-01');
    insertPaper(db, '2', 'New', '2024-03-15');
    const result = listPapers(db, {});
    expect(result.items[0].id).toBe('2');
    expect(result.items[1].id).toBe('1');
  });

  it('clamps page_size to [1, 100]', () => {
    insertPaper(db, '1', 'Paper', '2024-03-10');
    expect(listPapers(db, { pageSize: 0 }).page_size).toBe(1);
    expect(listPapers(db, { pageSize: 200 }).page_size).toBe(100);
  });

  it('defaults page to 1', () => {
    expect(listPapers(db, { page: undefined }).page).toBe(1);
    expect(listPapers(db, { page: -1 }).page).toBe(1);
  });

  it('handles special characters in search', () => {
    insertPaper(db, '1', 'Paper with % symbol', '2024-03-10');
    const result = listPapers(db, { search: '% symbol' });
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

  it('returns zero counts when no papers match', () => {
    db.run("INSERT INTO topics VALUES (1, 'AI', '[]', 1)");
    const counts = listTopicCounts(db);
    expect(counts).toHaveLength(1);
    expect(counts[0].count).toBe(0);
  });

  it('counts papers per topic using json_each', () => {
    db.run("INSERT INTO topics VALUES (1, 'AI', '[]', 1)");
    db.run("INSERT INTO topics VALUES (2, 'Bio', '[]', 1)");
    insertPaper(db, '1', 'A', '2024-03-10', '["AI"]');
    insertPaper(db, '2', 'B', '2024-03-10', '["AI"]');
    insertPaper(db, '3', 'C', '2024-03-10', '["Bio"]');

    const counts = listTopicCounts(db);
    expect(counts).toHaveLength(2);
    const ai = counts.find(c => c.name === 'AI');
    const bio = counts.find(c => c.name === 'Bio');
    expect(ai!.count).toBe(2);
    expect(bio!.count).toBe(1);
  });

  it('orders by count DESC', () => {
    db.run("INSERT INTO topics VALUES (1, 'Popular', '[]', 1)");
    db.run("INSERT INTO topics VALUES (2, 'Niche', '[]', 1)");
    insertPaper(db, '1', 'A', '2024-03-10', '["Popular"]');
    insertPaper(db, '2', 'B', '2024-03-10', '["Popular"]');
    insertPaper(db, '3', 'C', '2024-03-10', '["Niche"]');

    const counts = listTopicCounts(db);
    expect(counts[0].name).toBe('Popular');
    expect(counts[1].name).toBe('Niche');
  });

  it('returns empty for no topics', () => {
    expect(listTopicCounts(db)).toEqual([]);
  });
});
