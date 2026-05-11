import { describe, it, expect, beforeAll } from 'vitest';
import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
import { rebuildArxivPaperTopics, updateArxivTopicAssociations, deleteArxivTopicAssociations } from '../rebuild-arxiv-topics';

function setupArxivDb(): SqlJsDatabase {
  const db = new (globalThis as any).__testSQL.Database();
  db.run(`CREATE TABLE IF NOT EXISTS papers (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    abstract_text TEXT NOT NULL DEFAULT ''
  )`);
  return db;
}

function setupPaperTopicsDb(): SqlJsDatabase {
  const db = new (globalThis as any).__testSQL.Database();
  db.run(`CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    keywords TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS arxiv_paper_topics (
    paper_id TEXT NOT NULL,
    topic_id INTEGER NOT NULL,
    PRIMARY KEY (paper_id, topic_id)
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_arxiv_pt_tid ON arxiv_paper_topics(topic_id, paper_id)`);
  return db;
}

beforeAll(async () => {
  const SQL = await initSqlJs();
  (globalThis as any).__testSQL = SQL;
});

describe('rebuildArxivPaperTopics', () => {
  it('rebuilds all paper-topic associations', () => {
    const arxivDb = setupArxivDb();
    const ptDb = setupPaperTopicsDb();

    arxivDb.run('INSERT INTO papers VALUES (?, ?, ?)', ['p1', 'Deep Learning for AI', 'We study neural networks and artificial intelligence']);
    arxivDb.run('INSERT INTO papers VALUES (?, ?, ?)', ['p2', 'Blockchain Security', 'A study on crypto protocols']);
    arxivDb.run('INSERT INTO papers VALUES (?, ?, ?)', ['p3', 'Biology Basics', 'A survey of genetics']);

    ptDb.run('INSERT INTO topics (id, name, keywords, enabled) VALUES (?, ?, ?, ?)', [1, 'AI', '["ai", "neural networks"]', 1]);
    ptDb.run('INSERT INTO topics (id, name, keywords, enabled) VALUES (?, ?, ?, ?)', [2, 'Crypto', '["crypto", "blockchain"]', 1]);
    ptDb.run('INSERT INTO topics (id, name, keywords, enabled) VALUES (?, ?, ?, ?)', [3, 'Biology', '["genetics", "biology"]', 0]);

    const count = rebuildArxivPaperTopics(arxivDb, ptDb);
    expect(count).toBe(3);

    // p1 matches AI (neural networks, ai)
    const rows1 = ptDb.exec('SELECT topic_id FROM arxiv_paper_topics WHERE paper_id = ?', ['p1']);
    expect(rows1[0].values.map(r => r[0])).toContain(1);

    // p2 matches Crypto
    const rows2 = ptDb.exec('SELECT topic_id FROM arxiv_paper_topics WHERE paper_id = ?', ['p2']);
    expect(rows2[0].values.map(r => r[0])).toContain(2);

    // p3 matches Biology but topic is disabled
    const rows3 = ptDb.exec('SELECT topic_id FROM arxiv_paper_topics WHERE paper_id = ?', ['p3']);
    expect(rows3.length).toBe(0);

    arxivDb.close();
    ptDb.close();
  });

  it('clears existing associations before rebuilding', () => {
    const arxivDb = setupArxivDb();
    const ptDb = setupPaperTopicsDb();

    arxivDb.run('INSERT INTO papers VALUES (?, ?, ?)', ['p1', 'AI Paper', 'About ai']);
    ptDb.run('INSERT INTO topics (id, name, keywords, enabled) VALUES (?, ?, ?, ?)', [1, 'AI', '["ai"]', 1]);

    // Pre-insert a stale association
    ptDb.run('INSERT INTO arxiv_paper_topics VALUES (?, ?)', ['p1', 99]);

    rebuildArxivPaperTopics(arxivDb, ptDb);

    const rows = ptDb.exec('SELECT topic_id FROM arxiv_paper_topics WHERE paper_id = ?', ['p1']);
    expect(rows[0].values).toEqual([[1]]);

    arxivDb.close();
    ptDb.close();
  });

  it('returns 0 when no papers exist', () => {
    const arxivDb = setupArxivDb();
    const ptDb = setupPaperTopicsDb();

    ptDb.run('INSERT INTO topics (id, name, keywords, enabled) VALUES (?, ?, ?, ?)', [1, 'AI', '["ai"]', 1]);

    const count = rebuildArxivPaperTopics(arxivDb, ptDb);
    expect(count).toBe(0);

    arxivDb.close();
    ptDb.close();
  });
});

describe('updateArxivTopicAssociations', () => {
  it('updates associations for a single topic', () => {
    const arxivDb = setupArxivDb();
    const ptDb = setupPaperTopicsDb();

    arxivDb.run('INSERT INTO papers VALUES (?, ?, ?)', ['p1', 'AI Research', 'Deep learning']);
    arxivDb.run('INSERT INTO papers VALUES (?, ?, ?)', ['p2', 'Biology Study', 'DNA analysis']);
    ptDb.run('INSERT INTO topics (id, name, keywords, enabled) VALUES (?, ?, ?, ?)', [1, 'AI', '["ai", "deep learning"]', 1]);
    ptDb.run('INSERT INTO topics (id, name, keywords, enabled) VALUES (?, ?, ?, ?)', [2, 'Bio', '["dna"]', 1]);

    // Pre-insert a stale association for topic 1
    ptDb.run('INSERT INTO arxiv_paper_topics VALUES (?, ?)', ['p2', 1]);

    const count = updateArxivTopicAssociations(arxivDb, ptDb, 1);
    expect(count).toBe(1);

    const rows = ptDb.exec('SELECT paper_id FROM arxiv_paper_topics WHERE topic_id = 1');
    expect(rows[0].values.map(r => r[0])).toEqual(['p1']);

    arxivDb.close();
    ptDb.close();
  });

  it('removes associations when topic is disabled', () => {
    const arxivDb = setupArxivDb();
    const ptDb = setupPaperTopicsDb();

    arxivDb.run('INSERT INTO papers VALUES (?, ?, ?)', ['p1', 'AI Paper', 'ai']);
    ptDb.run('INSERT INTO topics (id, name, keywords, enabled) VALUES (?, ?, ?, ?)', [1, 'AI', '["ai"]', 0]);

    ptDb.run('INSERT INTO arxiv_paper_topics VALUES (?, ?)', ['p1', 1]);

    const count = updateArxivTopicAssociations(arxivDb, ptDb, 1);
    expect(count).toBe(0);

    const rows = ptDb.exec('SELECT * FROM arxiv_paper_topics WHERE topic_id = 1');
    expect(rows.length).toBe(0);

    arxivDb.close();
    ptDb.close();
  });

  it('returns 0 when topic does not exist', () => {
    const arxivDb = setupArxivDb();
    const ptDb = setupPaperTopicsDb();

    const count = updateArxivTopicAssociations(arxivDb, ptDb, 999);
    expect(count).toBe(0);

    arxivDb.close();
    ptDb.close();
  });
});

describe('deleteArxivTopicAssociations', () => {
  it('removes all associations for a topic', () => {
    const ptDb = setupPaperTopicsDb();

    ptDb.run('INSERT INTO arxiv_paper_topics VALUES (?, ?)', ['p1', 1]);
    ptDb.run('INSERT INTO arxiv_paper_topics VALUES (?, ?)', ['p2', 1]);
    ptDb.run('INSERT INTO arxiv_paper_topics VALUES (?, ?)', ['p3', 2]);

    deleteArxivTopicAssociations(ptDb, 1);

    const rows = ptDb.exec('SELECT * FROM arxiv_paper_topics WHERE topic_id = 1');
    expect(rows.length).toBe(0);

    const remaining = ptDb.exec('SELECT * FROM arxiv_paper_topics WHERE topic_id = 2');
    expect(remaining[0].values.length).toBe(1);

    ptDb.close();
  });
});
