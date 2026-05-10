import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { dirname, join } from 'path';

export class ConferenceAnalysesDb {
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
      CREATE TABLE IF NOT EXISTS analyses (
        paper_id TEXT PRIMARY KEY,
        summary TEXT DEFAULT '',
        analysis TEXT DEFAULT ''
      )
    `);
  }

  getDb(): SqlJsDatabase {
    if (!this.db) throw new Error('ConferenceAnalysesDb not initialized');
    return this.db;
  }

  async save(): Promise<void> {
    if (!this.db) throw new Error('ConferenceAnalysesDb not initialized');
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
