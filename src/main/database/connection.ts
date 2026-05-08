import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { join, dirname } from 'path';

// __dirname at runtime = dist/main/database/, project root = two levels up
const MIGRATIONS_DIR = join(__dirname, 'migrations');

const MIGRATION_FILES = [
  { name: '001_initial', filename: '001_initial.sql' },
  { name: '002_zotero_import', filename: '002_zotero_import.sql' },
];

export class Database {
  private db: SqlJsDatabase | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async init(): Promise<void> {
    const dir = dirname(this.dbPath);
    await fs.mkdir(dir, { recursive: true });

    // Initialize sql.js with explicit WASM path
    const SQL = await initSqlJs({
      locateFile: (file: string) => join(__dirname, '..', 'wasm', file),
    });

    // Load existing database from disk, or create a new in-memory one
    if (fsSync.existsSync(this.dbPath)) {
      const buffer = await fs.readFile(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    // Run migrations
    this.runMigrations();
  }

  private runMigrations(): void {
    if (!this.db) throw new Error('Database not initialized');

    // Ensure migrations tracking table exists
    this.db.run(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    for (const migration of MIGRATION_FILES) {
      const alreadyApplied = this.db
        .exec('SELECT 1 FROM _migrations WHERE name = ?', [migration.name]);
      if (!alreadyApplied || alreadyApplied.length === 0) {
        // Load SQL from file
        const sqlPath = join(MIGRATIONS_DIR, migration.filename);
        const sql = fsSync.readFileSync(sqlPath, 'utf-8');

        // Split multi-statement migrations and run each
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0);

        for (const stmt of statements) {
          this.db.run(stmt);
        }
        this.db.run('INSERT INTO _migrations (name) VALUES (?)', [migration.name]);
      }
    }

    // Runtime schema updates for existing databases
    this.runSchemaUpdates();
  }

  private runSchemaUpdates(): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run("DELETE FROM app_config WHERE key LIKE 'proxy.%'");
    const cols = this.db.exec("PRAGMA table_info(papers)");
    if (cols.length > 0) {
      const colNames = cols[0].values.map(r => r[1] as string);
      if (!colNames.includes('updated_date')) {
        this.db.run("ALTER TABLE papers ADD COLUMN updated_date TEXT NOT NULL DEFAULT ''");
        this.db.run('UPDATE papers SET updated_date = published_date WHERE updated_date = "" OR updated_date IS NULL');
      }
    }
  }

  getDb(): SqlJsDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return this.db;
  }

  async save(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const data = this.db.export();
    const buffer = Buffer.from(data);
    await fs.writeFile(this.dbPath, buffer);
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
