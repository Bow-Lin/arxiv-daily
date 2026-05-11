import { app } from 'electron';
import { join } from 'path';
import * as fsSync from 'fs';
import type { Database } from './connection';
import type { SettingsDb } from './settings';
import type { PaperTopicsDb } from './paper-topics';

/**
 * Migrate database files from old app name directory ("arXiv Daily") to current userData.
 * Only copies files that don't already exist in the new location.
 */
export function migrateFromOldAppData(): void {
  const oldPath = join(app.getPath('home'), 'Library', 'Application Support', 'arXiv Daily');
  const newPath = app.getPath('userData');
  if (oldPath === newPath) return;
  if (!fsSync.existsSync(oldPath)) return;

  const dataFiles = ['arxiv_papers.db', 'conference_analyses.db', 'settings.db', 'paper_topics.db'];
  let migrated = false;

  for (const file of dataFiles) {
    const src = join(oldPath, file);
    const dst = join(newPath, file);
    if (fsSync.existsSync(src) && !fsSync.existsSync(dst)) {
      try {
        fsSync.copyFileSync(src, dst);
        migrated = true;
        console.log(`[migration] Copied ${file} from old app data`);
      } catch (e) {
        console.error(`[migration] Failed to copy ${file}:`, e);
      }
    }
  }

  // Migrate pdfs directory
  const oldPdfs = join(oldPath, 'pdfs');
  const newPdfs = join(newPath, 'pdfs');
  if (fsSync.existsSync(oldPdfs) && !fsSync.existsSync(newPdfs)) {
    try {
      fsSync.cpSync(oldPdfs, newPdfs, { recursive: true });
      migrated = true;
      console.log('[migration] Copied pdfs directory from old app data');
    } catch (e) {
      console.error('[migration] Failed to copy pdfs directory:', e);
    }
  }

  if (migrated) {
    console.log('[migration] Data migration from "arXiv Daily" complete');
  }
}

/**
 * Migrate data from arxiv_papers.db to the new split databases (settings.db, paper_topics.db).
 * Detects whether migration is needed by checking for the old `topics` table in arxiv_papers.db.
 *
 * Returns true if migration was performed.
 */
export function migrateToSplitDatabases(
  arxivDb: Database,
  settingsDb: SettingsDb,
  paperTopicsDb: PaperTopicsDb,
): boolean {
  const sqlDb = arxivDb.getDb();
  const sqlSettingsDb = settingsDb.getDb();
  const sqlPtDb = paperTopicsDb.getDb();

  // Check if topics table still exists in arxiv db
  const tableCheck = sqlDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='topics'");
  if (tableCheck.length === 0 || tableCheck[0].values.length === 0) {
    return false;
  }

  // Migrate topics → paper_topics.db
  const topicRows = sqlDb.exec('SELECT id, name, keywords, enabled FROM topics');
  if (topicRows.length > 0) {
    for (const row of topicRows[0].values) {
      sqlPtDb.run(
        'INSERT OR IGNORE INTO topics (id, name, keywords, enabled) VALUES (?, ?, ?, ?)',
        [row[0], row[1], row[2], row[3]],
      );
    }
    console.log(`[migration] Migrated ${topicRows[0].values.length} topics`);
  }

  // Migrate app_config → settings.db
  const configRows = sqlDb.exec('SELECT key, value FROM app_config');
  if (configRows.length > 0) {
    for (const row of configRows[0].values) {
      sqlSettingsDb.run(
        'INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)',
        [row[0], row[1]],
      );
    }
    console.log(`[migration] Migrated ${configRows[0].values.length} config entries`);
  }

  // Migrate papers.relevance_topics (JSON array of topic names) → arxiv_paper_topics junction table
  const paperRows = sqlDb.exec(
    `SELECT id, relevance_topics FROM papers
     WHERE relevance_topics IS NOT NULL AND relevance_topics != 'null' AND relevance_topics != ''`,
  );
  if (paperRows.length > 0) {
    let count = 0;
    sqlPtDb.run('BEGIN TRANSACTION');
    for (const row of paperRows[0].values) {
      const paperId = row[0] as string;
      try {
        const topicNames: string[] = JSON.parse(row[1] as string);
        for (const name of topicNames) {
          const idResults = sqlPtDb.exec('SELECT id FROM topics WHERE name = ?', [name]);
          if (idResults.length > 0 && idResults[0].values.length > 0) {
            sqlPtDb.run(
              'INSERT OR IGNORE INTO arxiv_paper_topics (paper_id, topic_id) VALUES (?, ?)',
              [paperId, idResults[0].values[0][0]],
            );
            count++;
          }
        }
      } catch {
        // Skip malformed JSON
      }
    }
    sqlPtDb.run('COMMIT');
    console.log(`[migration] Migrated ${count} paper-topic associations`);
  }

  // Clean up old schema
  try {
    sqlDb.run('ALTER TABLE papers DROP COLUMN relevance_topics');
    console.log('[migration] Dropped relevance_topics column');
  } catch {
    console.log('[migration] Could not drop relevance_topics column');
  }
  try { sqlDb.run('DROP TABLE topics'); } catch { /* ignore */ }
  try { sqlDb.run('DROP TABLE app_config'); } catch { /* ignore */ }
  console.log('[migration] Dropped topics and app_config tables from arxiv db');

  return true;
}
