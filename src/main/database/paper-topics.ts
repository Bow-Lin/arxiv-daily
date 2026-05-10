import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { dirname, join } from 'path';

export class PaperTopicsDb {
  private db: SqlJsDatabase | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async init(): Promise<void> {
    const dir = dirname(this.dbPath);
    await fs.mkdir(dir, { recursive: true });

    const SQL = await initSqlJs({
      locateFile: (file: string) => join(__dirname, '..', 'wasm', file),
    });

    if (fsSync.existsSync(this.dbPath)) {
      const buffer = await fs.readFile(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    this.db.run(`
      CREATE TABLE IF NOT EXISTS topics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        keywords TEXT NOT NULL,
        enabled BOOLEAN DEFAULT TRUE
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS arxiv_paper_topics (
        paper_id TEXT NOT NULL,
        topic_id INTEGER NOT NULL,
        PRIMARY KEY (paper_id, topic_id)
      )
    `);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_arxiv_pt_tid ON arxiv_paper_topics(topic_id, paper_id)`);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS conference_paper_topics (
        paper_id TEXT NOT NULL,
        topic_id INTEGER NOT NULL,
        PRIMARY KEY (paper_id, topic_id)
      )
    `);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_conf_pt_tid ON conference_paper_topics(topic_id, paper_id)`);
  }

  getDb(): SqlJsDatabase {
    if (!this.db) throw new Error('PaperTopicsDb not initialized');
    return this.db;
  }

  async save(): Promise<void> {
    if (!this.db) throw new Error('PaperTopicsDb not initialized');
    const data = this.db.export();
    const tmpPath = this.dbPath + '.tmp';
    await fs.writeFile(tmpPath, Buffer.from(data));
    await fs.rename(tmpPath, this.dbPath);
  }

  async close(): Promise<void> {
    try {
      await this.save();
    } finally {
      if (this.db) {
        this.db.close();
        this.db = null;
      }
    }
  }
}
