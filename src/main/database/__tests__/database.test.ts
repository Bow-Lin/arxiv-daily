import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { SettingsDb } from '../../database/settings';
import { PaperTopicsDb } from '../../database/paper-topics';
import { ConferenceAnalysesDb } from '../../database/conference-analyses';

beforeAll(async () => {
  const SQL = await initSqlJs();
  (globalThis as any).__testSQL = SQL;
});

describe('SettingsDb', () => {
  let dbPath: string;
  let settingsDb: SettingsDb;

  beforeEach(async () => {
    dbPath = path.join(os.tmpdir(), `test-settings-${Date.now()}.db`);
    settingsDb = new SettingsDb(dbPath);
    await settingsDb.init();
  });

  afterEach(async () => {
    try { await settingsDb.close(); } catch {}
    try { await fs.unlink(dbPath); } catch {}
  });

  it('creates app_config table on init', () => {
    const rows = settingsDb.getDb().exec('SELECT name FROM sqlite_master WHERE type = ? AND name = ?', ['table', 'app_config']);
    expect(rows.length).toBe(1);
  });

  it('throws error if getDb called before init', async () => {
    const fresh = new SettingsDb(':memory:');
    expect(() => fresh.getDb()).toThrow('not initialized');
  });

  it('allows read/write through getDb', () => {
    settingsDb.getDb().run('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)', ['llm.api_key', 'sk-test']);
    const rows = settingsDb.getDb().exec('SELECT value FROM app_config WHERE key = ?', ['llm.api_key']);
    expect(rows[0].values[0][0]).toBe('sk-test');
  });

  it('persists data to disk on save', async () => {
    settingsDb.getDb().run('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)', ['theme', 'dark']);
    await settingsDb.save();

    const fresh = new SettingsDb(dbPath);
    await fresh.init();
    const rows = fresh.getDb().exec('SELECT value FROM app_config WHERE key = ?', ['theme']);
    expect(rows[0].values[0][0]).toBe('dark');
    await fresh.close();
  });

  it('close nulls the db instance', async () => {
    await settingsDb.close();
    expect(() => settingsDb.getDb()).toThrow('not initialized');
  });
});

describe('PaperTopicsDb', () => {
  let dbPath: string;
  let db: PaperTopicsDb;

  beforeEach(async () => {
    dbPath = path.join(os.tmpdir(), `test-paper-topics-${Date.now()}.db`);
    db = new PaperTopicsDb(dbPath);
    await db.init();
  });

  afterEach(async () => {
    try { await db.close(); } catch {}
    try { await fs.unlink(dbPath); } catch {}
  });

  it('creates topics and junction tables on init', () => {
    const tables = db.getDb().exec("SELECT name FROM sqlite_master WHERE type = 'table'");
    const tableNames = tables[0].values.map(r => r[0] as string);
    expect(tableNames).toContain('topics');
    expect(tableNames).toContain('arxiv_paper_topics');
    expect(tableNames).toContain('conference_paper_topics');
  });

  it('allows topic CRUD', () => {
    const d = db.getDb();
    d.run('INSERT INTO topics (name, keywords, enabled) VALUES (?, ?, ?)', ['AI', '["ai"]', 1]);
    const rows = d.exec('SELECT * FROM topics');
    expect(rows[0].values.length).toBe(1);
    expect(rows[0].values[0][1]).toBe('AI');
  });

  it('persists data to disk', async () => {
    db.getDb().run('INSERT INTO topics (name, keywords, enabled) VALUES (?, ?, ?)', ['RL', '["rl"]', 1]);
    await db.save();

    const fresh = new PaperTopicsDb(dbPath);
    await fresh.init();
    const rows = fresh.getDb().exec('SELECT * FROM topics');
    expect(rows[0].values.length).toBe(1);
    await fresh.close();
  });
});

describe('ConferenceAnalysesDb', () => {
  let dbPath: string;
  let db: ConferenceAnalysesDb;

  beforeEach(async () => {
    dbPath = path.join(os.tmpdir(), `test-conf-analyses-${Date.now()}.db`);
    db = new ConferenceAnalysesDb(dbPath);
    await db.init();
  });

  afterEach(async () => {
    try { await db.close(); } catch {}
    try { await fs.unlink(dbPath); } catch {}
  });

  it('creates analyses table on init', () => {
    const rows = db.getDb().exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'analyses'");
    expect(rows.length).toBe(1);
  });

  it('allows read/write analysis data', () => {
    db.getDb().run('INSERT OR REPLACE INTO analyses (paper_id, summary, analysis) VALUES (?, ?, ?)', ['p1', 'summary text', 'analysis text']);
    const rows = db.getDb().exec('SELECT summary, analysis FROM analyses WHERE paper_id = ?', ['p1']);
    expect(rows[0].values[0][0]).toBe('summary text');
    expect(rows[0].values[0][1]).toBe('analysis text');
  });

  it('persists data to disk', async () => {
    db.getDb().run('INSERT INTO analyses (paper_id, summary) VALUES (?, ?)', ['p1', 'test summary']);
    await db.save();

    const fresh = new ConferenceAnalysesDb(dbPath);
    await fresh.init();
    const rows = fresh.getDb().exec('SELECT summary FROM analyses WHERE paper_id = ?', ['p1']);
    expect(rows[0].values[0][0]).toBe('test summary');
    await fresh.close();
  });
});
