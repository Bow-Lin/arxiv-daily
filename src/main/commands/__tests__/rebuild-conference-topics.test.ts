import { describe, it, expect, beforeAll } from 'vitest';
import initSqlJs from 'sql.js';
import { rebuildConferencePaperTopics, updateConferenceTopicAssociations, deleteConferenceTopicAssociations } from '../rebuild-conference-topics';

function setupConferenceDb() {
  const db = new (globalThis as any).__testSQL.Database();
  db.run(`CREATE TABLE IF NOT EXISTS papers (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    abstract TEXT NOT NULL DEFAULT ''
  )`);
  return db;
}

function setupPaperTopicsDb() {
  const db = new (globalThis as any).__testSQL.Database();
  db.run(`CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    keywords TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS conference_paper_topics (
    paper_id TEXT NOT NULL,
    topic_id INTEGER NOT NULL,
    PRIMARY KEY (paper_id, topic_id)
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_conf_pt_tid ON conference_paper_topics(topic_id, paper_id)`);
  return db;
}

beforeAll(async () => {
  const SQL = await initSqlJs();
  (globalThis as any).__testSQL = SQL;
});

describe('rebuildConferencePaperTopics', () => {
  it('rebuilds all conference paper-topic associations', () => {
    const confDb = setupConferenceDb();
    const ptDb = setupPaperTopicsDb();

    confDb.run('INSERT INTO papers VALUES (?, ?, ?)', ['c1', 'Robot Learning', 'Using reinforcement learning for robots']);
    confDb.run('INSERT INTO papers VALUES (?, ?, ?)', ['c2', 'Vision Transformer', 'A new attention mechanism']);

    ptDb.run('INSERT INTO topics (id, name, keywords, enabled) VALUES (?, ?, ?, ?)', [1, 'RL', '["reinforcement learning"]', 1]);
    ptDb.run('INSERT INTO topics (id, name, keywords, enabled) VALUES (?, ?, ?, ?)', [2, 'Vision', '["attention"]', 1]);
    ptDb.run('INSERT INTO topics (id, name, keywords, enabled) VALUES (?, ?, ?, ?)', [3, 'NLP', '["nlp"]', 0]);

    const count = rebuildConferencePaperTopics(confDb, ptDb);
    expect(count).toBe(2);

    const rows1 = ptDb.exec('SELECT topic_id FROM conference_paper_topics WHERE paper_id = ?', ['c1']);
    expect(rows1[0].values.map((r: unknown[]) => r[0])).toContain(1);

    const rows2 = ptDb.exec('SELECT topic_id FROM conference_paper_topics WHERE paper_id = ?', ['c2']);
    expect(rows2[0].values.map((r: unknown[]) => r[0])).toContain(2);

    confDb.close();
    ptDb.close();
  });

  it('clears existing associations before rebuilding', () => {
    const confDb = setupConferenceDb();
    const ptDb = setupPaperTopicsDb();

    confDb.run('INSERT INTO papers VALUES (?, ?, ?)', ['c1', 'RL Paper', 'About reinforcement learning']);
    ptDb.run('INSERT INTO topics (id, name, keywords, enabled) VALUES (?, ?, ?, ?)', [1, 'RL', '["reinforcement learning"]', 1]);

    ptDb.run('INSERT INTO conference_paper_topics VALUES (?, ?)', ['c1', 99]);

    rebuildConferencePaperTopics(confDb, ptDb);

    const rows = ptDb.exec('SELECT topic_id FROM conference_paper_topics WHERE paper_id = ?', ['c1']);
    expect(rows[0].values).toEqual([[1]]);

    confDb.close();
    ptDb.close();
  });

  it('returns 0 when no papers exist', () => {
    const confDb = setupConferenceDb();
    const ptDb = setupPaperTopicsDb();

    ptDb.run('INSERT INTO topics (id, name, keywords, enabled) VALUES (?, ?, ?, ?)', [1, 'RL', '["rl"]', 1]);

    const count = rebuildConferencePaperTopics(confDb, ptDb);
    expect(count).toBe(0);

    confDb.close();
    ptDb.close();
  });
});

describe('updateConferenceTopicAssociations', () => {
  it('updates associations for a single topic', () => {
    const confDb = setupConferenceDb();
    const ptDb = setupPaperTopicsDb();

    confDb.run('INSERT INTO papers VALUES (?, ?, ?)', ['c1', 'RL Paper', 'reinforcement learning for robots']);
    confDb.run('INSERT INTO papers VALUES (?, ?, ?)', ['c2', 'CV Paper', 'object detection']);
    ptDb.run('INSERT INTO topics (id, name, keywords, enabled) VALUES (?, ?, ?, ?)', [1, 'RL', '["reinforcement learning"]', 1]);

    ptDb.run('INSERT INTO conference_paper_topics VALUES (?, ?)', ['c2', 1]);

    const count = updateConferenceTopicAssociations(confDb, ptDb, 1);
    expect(count).toBe(1);

    const rows = ptDb.exec('SELECT paper_id FROM conference_paper_topics WHERE topic_id = 1');
    expect(rows[0].values.map((r: unknown[]) => r[0])).toEqual(['c1']);

    confDb.close();
    ptDb.close();
  });

  it('removes associations when topic is disabled', () => {
    const confDb = setupConferenceDb();
    const ptDb = setupPaperTopicsDb();

    ptDb.run('INSERT INTO topics (id, name, keywords, enabled) VALUES (?, ?, ?, ?)', [1, 'RL', '["rl"]', 0]);
    ptDb.run('INSERT INTO conference_paper_topics VALUES (?, ?)', ['c1', 1]);

    const count = updateConferenceTopicAssociations(confDb, ptDb, 1);
    expect(count).toBe(0);

    const rows = ptDb.exec('SELECT * FROM conference_paper_topics WHERE topic_id = 1');
    expect(rows.length).toBe(0);

    confDb.close();
    ptDb.close();
  });
});

describe('deleteConferenceTopicAssociations', () => {
  it('removes all associations for a topic', () => {
    const ptDb = setupPaperTopicsDb();

    ptDb.run('INSERT INTO conference_paper_topics VALUES (?, ?)', ['c1', 1]);
    ptDb.run('INSERT INTO conference_paper_topics VALUES (?, ?)', ['c2', 1]);
    ptDb.run('INSERT INTO conference_paper_topics VALUES (?, ?)', ['c3', 2]);

    deleteConferenceTopicAssociations(ptDb, 1);

    const rows = ptDb.exec('SELECT * FROM conference_paper_topics WHERE topic_id = 1');
    expect(rows.length).toBe(0);

    const remaining = ptDb.exec('SELECT * FROM conference_paper_topics WHERE topic_id = 2');
    expect(remaining[0].values.length).toBe(1);

    ptDb.close();
  });
});
