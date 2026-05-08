import type { Database as SqlJsDatabase } from 'sql.js';
import { filterPaperTopics, type Topic } from '../services/filter';

export interface LLMConfig {
  api_key: string;
  base_url: string;
  model: string;
  temperature: number;
}

export interface OutputConfig {
  output_dir: string;
  auto_save: boolean;
}

export interface ZoteroConfig {
  api_key: string;
  user_id: string;
}

export interface ConfigResponse {
  llm: LLMConfig;
  output: OutputConfig;
  zotero?: ZoteroConfig;
  theme?: string;
}

export interface Category {
  id: number;
  name: string;
  enabled: boolean;
}

/**
 * Load LLM config from app_config table, with temperature clamped to [0.0, 2.0].
 */
export function loadLLMConfig(db: SqlJsDatabase): LLMConfig {
  const config: LLMConfig = {
    api_key: '',
    base_url: '',
    model: '',
    temperature: 1.0,
  };

  const rows = db.exec("SELECT key, value FROM app_config WHERE key LIKE 'llm.%'");
  if (rows.length === 0) return config;

  for (const row of rows[0].values) {
    const key = row[0] as string;
    const value = row[1] as string;
    switch (key) {
      case 'llm.api_key':
        config.api_key = value;
        break;
      case 'llm.base_url':
        config.base_url = value;
        break;
      case 'llm.model':
        config.model = value;
        break;
      case 'llm.temperature': {
        const parsed = parseFloat(value);
        config.temperature = isNaN(parsed) ? 1.0 : Math.max(0.0, Math.min(2.0, parsed));
        break;
      }
    }
  }
  return config;
}

/**
 * Load Zotero config from app_config table.
 */
export function loadZoteroConfig(db: SqlJsDatabase): ZoteroConfig {
  const config: ZoteroConfig = { api_key: '', user_id: '' };

  const rows = db.exec("SELECT key, value FROM app_config WHERE key LIKE 'zotero.%'");
  if (rows.length === 0) return config;

  for (const row of rows[0].values) {
    const key = row[0] as string;
    const value = row[1] as string;
    if (key === 'zotero.api_key') config.api_key = value;
    if (key === 'zotero.user_id') config.user_id = value;
  }
  return config;
}

/**
 * Refresh all papers' relevance_topics based on current enabled topics.
 */
export function refreshAllPaperTopics(db: SqlJsDatabase): number {
  // Load enabled topics
  const topicRows = db.exec('SELECT id, name, keywords, enabled FROM topics WHERE enabled = TRUE');
  const topics: Topic[] = topicRows.length > 0
    ? topicRows[0].values.map(row => ({
      id: row[0] as number,
      name: row[1] as string,
      keywords: JSON.parse(row[2] as string),
      enabled: Boolean(row[3]),
    }))
    : [];

  // Load all papers
  const paperRows = db.exec('SELECT id, title, abstract_text FROM papers');
  if (paperRows.length === 0) return 0;

  const count = paperRows[0].values.length;

  // Update each paper's relevance_topics
  for (const row of paperRows[0].values) {
    const paperId = row[0];
    const title = row[1] as string;
    const abstractText = row[2] as string;
    const matched = filterPaperTopics(title, abstractText, topics);
    const topicsJson = matched.length > 0
      ? JSON.stringify(matched)
      : null;
    db.run('UPDATE papers SET relevance_topics = ? WHERE id = ?', [topicsJson, paperId]);
  }

  return count;
}

/**
 * List all topics.
 */
export function listTopics(db: SqlJsDatabase): Topic[] {
  const rows = db.exec('SELECT id, name, keywords, enabled FROM topics ORDER BY id');
  if (rows.length === 0) return [];
  return rows[0].values.map(row => ({
    id: row[0] as number,
    name: row[1] as string,
    keywords: JSON.parse(row[2] as string),
    enabled: Boolean(row[3]),
  }));
}

/**
 * Save a topic (insert or update). Refreshes paper topics after.
 */
export function saveTopic(db: SqlJsDatabase, topic: {
  id?: number;
  name: string;
  keywords: string[];
  enabled: boolean;
}): Topic {
  const keywordsJson = JSON.stringify(topic.keywords);
  let id: number;

  if (topic.id != null) {
    // Update existing
    db.run('UPDATE topics SET name = ?, keywords = ?, enabled = ? WHERE id = ?',
      [topic.name, keywordsJson, topic.enabled ? 1 : 0, topic.id]);
    if (db.getRowsModified() === 0) {
      throw new Error(`Topic ${topic.id} not found`);
    }
    id = topic.id;
  } else {
    // Insert new
    db.run('INSERT INTO topics (name, keywords, enabled) VALUES (?, ?, ?)',
      [topic.name, keywordsJson, topic.enabled ? 1 : 0]);
    // Get the last inserted rowid
    const lastId = db.exec('SELECT last_insert_rowid()');
    id = lastId[0].values[0][0] as number;
  }

  // Refresh paper topics after topic change
  try {
    refreshAllPaperTopics(db);
  } catch (e) {
    console.error('Failed to refresh paper topics after topic change:', e);
  }

  return { id, name: topic.name, keywords: topic.keywords, enabled: topic.enabled };
}

/**
 * Delete a topic. Refreshes paper topics after.
 */
export function deleteTopic(db: SqlJsDatabase, topicId: number): void {
  db.run('DELETE FROM topics WHERE id = ?', [topicId]);
  if (db.getRowsModified() === 0) {
    throw new Error(`Topic ${topicId} not found`);
  }
  // Refresh paper topics after topic change
  try {
    refreshAllPaperTopics(db);
  } catch (e) {
    console.error('Failed to refresh paper topics after topic change:', e);
  }
}

/**
 * Get full application config (LLM + output + theme).
 */
export function getConfig(db: SqlJsDatabase): ConfigResponse {
  const llmConfig = loadLLMConfig(db);
  const outputConfig: OutputConfig = {
    output_dir: '',
    auto_save: false,
  };
  const zoteroConfig = loadZoteroConfig(db);
  let theme: string | undefined;

  const configRows = db.exec("SELECT key, value FROM app_config WHERE key LIKE 'output.%' OR key = 'theme'");
  if (configRows.length > 0) {
    for (const row of configRows[0].values) {
      const key = row[0] as string;
      const value = row[1] as string;
      switch (key) {
        case 'output.dir':
          outputConfig.output_dir = value;
          break;
        case 'output.auto_save':
          outputConfig.auto_save = value === 'true';
          break;
        case 'theme':
          theme = value;
          break;
      }
    }
  }

  return { llm: llmConfig, output: outputConfig, zotero: zoteroConfig, theme };
}

/**
 * Update application config (LLM + output + theme).
 */
export function updateConfig(db: SqlJsDatabase, llm: LLMConfig, output: OutputConfig, zotero?: ZoteroConfig, theme?: string): void {
  // Save LLM config
  db.run(
    `INSERT INTO app_config (key, value) VALUES ('llm.api_key', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [llm.api_key],
  );
  db.run(
    `INSERT INTO app_config (key, value) VALUES ('llm.base_url', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [llm.base_url],
  );
  db.run(
    `INSERT INTO app_config (key, value) VALUES ('llm.model', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [llm.model],
  );
  db.run(
    `INSERT INTO app_config (key, value) VALUES ('llm.temperature', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [String(Math.max(0.0, Math.min(2.0, llm.temperature)))],
  );

  // Save output config
  db.run(
    `INSERT INTO app_config (key, value) VALUES ('output.dir', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [output.output_dir],
  );
  db.run(
    `INSERT INTO app_config (key, value) VALUES ('output.auto_save', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [String(output.auto_save)],
  );

  // Save Zotero config
  if (zotero) {
    db.run(
      `INSERT INTO app_config (key, value) VALUES ('zotero.api_key', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [zotero.api_key],
    );
    db.run(
      `INSERT INTO app_config (key, value) VALUES ('zotero.user_id', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [zotero.user_id],
    );
  }

  // Save theme
  if (theme) {
    db.run(
      `INSERT INTO app_config (key, value) VALUES ('theme', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [theme],
    );
  }
}

/**
 * List all categories.
 */
export function listCategories(db: SqlJsDatabase): Category[] {
  const rows = db.exec('SELECT id, name, enabled FROM categories ORDER BY id');
  if (rows.length === 0) return [];
  return rows[0].values.map(row => ({
    id: row[0] as number,
    name: row[1] as string,
    enabled: Boolean(row[2]),
  }));
}

/**
 * Save a category (insert or update).
 */
export function saveCategory(db: SqlJsDatabase, category: {
  id?: number;
  name: string;
  enabled: boolean;
}): Category {
  let id: number;
  if (category.id != null) {
    // Update existing
    db.run('UPDATE categories SET name = ?, enabled = ? WHERE id = ?',
      [category.name, category.enabled ? 1 : 0, category.id]);
    if (db.getRowsModified() === 0) {
      throw new Error(`Category ${category.id} not found`);
    }
    id = category.id;
  } else {
    // Insert new
    db.run('INSERT INTO categories (name, enabled) VALUES (?, ?)',
      [category.name, category.enabled ? 1 : 0]);
    // Get the last inserted rowid
    const lastId = db.exec('SELECT last_insert_rowid()');
    id = lastId[0].values[0][0] as number;
  }
  return { id, name: category.name, enabled: category.enabled };
}

/**
 * Delete a category.
 */
export function deleteCategory(db: SqlJsDatabase, categoryId: number): void {
  db.run('DELETE FROM categories WHERE id = ?', [categoryId]);
  if (db.getRowsModified() === 0) {
    throw new Error(`Category ${categoryId} not found`);
  }
}

/**
 * Clear all paper data, keep user config (topics, categories, app_config).
 */
export function clearData(db: SqlJsDatabase): { success: boolean } {
  db.run('DELETE FROM analyses');
  db.run('DELETE FROM papers');
  return { success: true };
}

/**
 * Clear only analysis data, keep papers.
 */
export function clearAnalyses(db: SqlJsDatabase): { success: boolean } {
  db.run('DELETE FROM analyses');
  return { success: true };
}
