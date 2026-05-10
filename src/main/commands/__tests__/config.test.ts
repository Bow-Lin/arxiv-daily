import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
import {
  loadLLMConfig,
  loadZoteroConfig,
  listTopics,
  saveTopic,
  deleteTopic,
  getConfig,
  updateConfig,
  listCategories,
  saveCategory,
  deleteCategory,
  clearData,
  clearAnalyses,
} from '../config';

const ARXIV_SCHEMA = `
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
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS analyses (
  paper_id TEXT PRIMARY KEY,
  summary TEXT DEFAULT '',
  analysis TEXT DEFAULT '',
  FOREIGN KEY (paper_id) REFERENCES papers(id)
);
`;

const SETTINGS_SCHEMA = `
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
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
`;

function createDb(): SqlJsDatabase {
  return new (globalThis as any).__testSQL.Database();
}

describe('config commands', () => {
  let SQL: any;
  let db: SqlJsDatabase;
  let settingsDb: SqlJsDatabase;
  let topicsDb: SqlJsDatabase;

  beforeAll(async () => {
    SQL = await initSqlJs({
      locateFile: () => 'node_modules/sql.js/dist/sql-wasm.wasm',
    });
    (globalThis as any).__testSQL = SQL;
  });

  beforeEach(() => {
    db = createDb();
    db.run(ARXIV_SCHEMA);
    settingsDb = createDb();
    settingsDb.run(SETTINGS_SCHEMA);
    topicsDb = createDb();
    topicsDb.run(TOPICS_SCHEMA);
  });

  describe('loadLLMConfig', () => {
    it('returns defaults when no config exists', () => {
      const config = loadLLMConfig(settingsDb);
      expect(config.api_key).toBe('');
      expect(config.base_url).toBe('');
      expect(config.model).toBe('');
      expect(config.temperature).toBe(1.0);
    });

    it('loads saved LLM config', () => {
      settingsDb.run("INSERT INTO app_config VALUES ('llm.api_key', 'sk-test')");
      settingsDb.run("INSERT INTO app_config VALUES ('llm.base_url', 'https://api.example.com')");
      settingsDb.run("INSERT INTO app_config VALUES ('llm.model', 'gpt-4')");
      settingsDb.run("INSERT INTO app_config VALUES ('llm.temperature', '0.5')");
      const config = loadLLMConfig(settingsDb);
      expect(config.api_key).toBe('sk-test');
      expect(config.base_url).toBe('https://api.example.com');
      expect(config.model).toBe('gpt-4');
      expect(config.temperature).toBe(0.5);
    });

    it('clamps temperature to [0.0, 2.0]', () => {
      settingsDb.run("INSERT INTO app_config VALUES ('llm.temperature', '5.0')");
      expect(loadLLMConfig(settingsDb).temperature).toBe(2.0);
      settingsDb.run("UPDATE app_config SET value = '-1.0' WHERE key = 'llm.temperature'");
      expect(loadLLMConfig(settingsDb).temperature).toBe(0.0);
    });

    it('handles invalid temperature gracefully', () => {
      settingsDb.run("INSERT INTO app_config VALUES ('llm.temperature', 'abc')");
      expect(loadLLMConfig(settingsDb).temperature).toBe(1.0);
    });
  });

  describe('loadZoteroConfig', () => {
    it('returns defaults when no config exists', () => {
      const config = loadZoteroConfig(settingsDb);
      expect(config.api_key).toBe('');
      expect(config.user_id).toBe('');
    });

    it('loads saved Zotero config', () => {
      settingsDb.run("INSERT INTO app_config VALUES ('zotero.api_key', 'key-123')");
      settingsDb.run("INSERT INTO app_config VALUES ('zotero.user_id', '456')");
      const config = loadZoteroConfig(settingsDb);
      expect(config.api_key).toBe('key-123');
      expect(config.user_id).toBe('456');
    });
  });

  describe('topics', () => {
    it('lists empty topics', () => {
      expect(listTopics(topicsDb)).toEqual([]);
    });

    it('saves and lists a new topic', () => {
      const topic = saveTopic(topicsDb, { name: 'AI', keywords: ['ai', 'ml'], enabled: true });
      expect(topic.id).toBe(1);
      expect(topic.name).toBe('AI');
      const topics = listTopics(topicsDb);
      expect(topics).toHaveLength(1);
      expect(topics[0]).toEqual(topic);
    });

    it('updates an existing topic', () => {
      saveTopic(topicsDb, { name: 'AI', keywords: ['ai'], enabled: true });
      const updated = saveTopic(topicsDb, { id: 1, name: 'ML', keywords: ['ml', 'machine learning'], enabled: false });
      expect(updated.id).toBe(1);
      expect(updated.name).toBe('ML');
      expect(updated.enabled).toBe(false);
      const topics = listTopics(topicsDb);
      expect(topics).toHaveLength(1);
      expect(topics[0].name).toBe('ML');
    });

    it('throws on update of non-existent topic', () => {
      expect(() => saveTopic(topicsDb, { id: 999, name: 'X', keywords: [], enabled: true }))
        .toThrow('Topic 999 not found');
    });

    it('deletes a topic', () => {
      saveTopic(topicsDb, { name: 'AI', keywords: ['ai'], enabled: true });
      deleteTopic(topicsDb, 1);
      expect(listTopics(topicsDb)).toEqual([]);
    });

    it('throws on delete of non-existent topic', () => {
      expect(() => deleteTopic(topicsDb, 999)).toThrow('Topic 999 not found');
    });

    it('prevents duplicate topic names', () => {
      saveTopic(topicsDb, { name: 'AI', keywords: ['ai'], enabled: true });
      expect(() => saveTopic(topicsDb, { name: 'AI', keywords: ['ml'], enabled: true }))
        .toThrow('UNIQUE constraint failed');
    });
  });

  describe('categories', () => {
    it('lists empty categories', () => {
      expect(listCategories(db)).toEqual([]);
    });

    it('saves and lists a new category', () => {
      const cat = saveCategory(db, { name: 'cs.AI', enabled: true });
      expect(cat.id).toBe(1);
      expect(cat.name).toBe('cs.AI');
      expect(listCategories(db)).toHaveLength(1);
    });

    it('updates an existing category', () => {
      saveCategory(db, { name: 'cs.AI', enabled: true });
      const updated = saveCategory(db, { id: 1, name: 'cs.AI', enabled: false });
      expect(updated.enabled).toBe(false);
      expect(listCategories(db)[0].enabled).toBe(false);
    });

    it('throws on update of non-existent category', () => {
      expect(() => saveCategory(db, { id: 999, name: 'X', enabled: true }))
        .toThrow('Category 999 not found');
    });

    it('deletes a category', () => {
      saveCategory(db, { name: 'cs.AI', enabled: true });
      deleteCategory(db, 1);
      expect(listCategories(db)).toEqual([]);
    });

    it('throws on delete of non-existent category', () => {
      expect(() => deleteCategory(db, 999)).toThrow('Category 999 not found');
    });
  });

  describe('getConfig / updateConfig', () => {
    it('returns defaults when nothing saved', () => {
      const config = getConfig(settingsDb);
      expect(config.llm.api_key).toBe('');
      expect(config.output.output_dir).toBe('');
      expect(config.output.auto_save).toBe(false);
      expect(config.zotero).toBeDefined();
      expect(config.zotero!.api_key).toBe('');
      expect(config.theme).toBeUndefined();
    });

    it('saves and loads full config', () => {
      updateConfig(
        settingsDb,
        { api_key: 'sk-1', base_url: 'https://api.test.com', model: 'test', temperature: 0.7 },
        { output_dir: '/tmp/out', auto_save: true },
        { api_key: 'z-key', user_id: '123' },
        'dark',
      );
      const config = getConfig(settingsDb);
      expect(config.llm.api_key).toBe('sk-1');
      expect(config.llm.temperature).toBe(0.7);
      expect(config.output.output_dir).toBe('/tmp/out');
      expect(config.output.auto_save).toBe(true);
      expect(config.zotero!.api_key).toBe('z-key');
      expect(config.zotero!.user_id).toBe('123');
      expect(config.theme).toBe('dark');
    });

    it('updates partial config without overwriting other fields', () => {
      updateConfig(
        settingsDb,
        { api_key: 'sk-1', base_url: '', model: '', temperature: 1.0 },
        { output_dir: '', auto_save: false },
        undefined,
        'light',
      );
      updateConfig(
        settingsDb,
        { api_key: 'sk-2', base_url: 'https://new.com', model: 'gpt-4', temperature: 0.5 },
        { output_dir: '', auto_save: false },
        undefined,
        undefined,
      );
      const config = getConfig(settingsDb);
      expect(config.llm.api_key).toBe('sk-2');
      expect(config.llm.base_url).toBe('https://new.com');
      expect(config.theme).toBe('light');
    });
  });

  describe('clearData', () => {
    it('clears papers and analyses', () => {
      db.run("INSERT INTO papers VALUES ('1', 'T', '[]', '', '', '', '', '', '[]', '')");
      db.run("INSERT INTO analyses VALUES ('1', 'Summary', 'Analysis')");

      clearData(db);

      expect(db.exec("SELECT COUNT(*) FROM papers")[0].values[0][0]).toBe(0);
      expect(db.exec("SELECT COUNT(*) FROM analyses")[0].values[0][0]).toBe(0);
    });
  });

  describe('clearAnalyses', () => {
    it('clears only analyses, keeps papers', () => {
      db.run("INSERT INTO papers VALUES ('1', 'T', '[]', '', '', '', '', '', '[]', '')");
      db.run("INSERT INTO analyses VALUES ('1', 'Summary', 'Analysis')");

      clearAnalyses(db);

      expect(db.exec("SELECT COUNT(*) FROM papers")[0].values[0][0]).toBe(1);
      expect(db.exec("SELECT COUNT(*) FROM analyses")[0].values[0][0]).toBe(0);
    });
  });
});
