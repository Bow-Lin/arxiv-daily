import { app, BrowserWindow, shell, Menu } from 'electron';
import { join } from 'path';
import { Database } from './database/connection';
import { ConferenceAnalysesDb } from './database/conference-analyses';
import { SettingsDb } from './database/settings';
import { PaperTopicsDb } from './database/paper-topics';
import { registerIpcHandlers } from './ipc-handlers';

let mainWindow: BrowserWindow | null = null;
let db: Database | null = null;
let conferenceDb: Database | null = null;
let conferenceAnalysesDb: ConferenceAnalysesDb | null = null;
let settingsDb: SettingsDb | null = null;
let paperTopicsDb: PaperTopicsDb | null = null;

app.on('before-quit', async () => {
  if (db) {
    await db.close();
    db = null;
  }
  if (conferenceAnalysesDb) {
    await conferenceAnalysesDb.close();
    conferenceAnalysesDb = null;
  }
  if (settingsDb) {
    await settingsDb.close();
    settingsDb = null;
  }
  if (paperTopicsDb) {
    await paperTopicsDb.close();
    paperTopicsDb = null;
  }
  // conferenceDb is read-only, no save needed
  if (conferenceDb) {
    conferenceDb.getDb().close();
    conferenceDb = null;
  }
});

function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    title: 'SciPhant',
    width: 1200,
    height: 800,
    minWidth: 842,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (app.isPackaged) {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html')).catch((err) => {
      console.error('Failed to load app:', err);
    });
  } else {
    mainWindow.loadURL('http://localhost:5173').catch((err) => {
      console.error('Failed to load dev server (is Vite running?):', err);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

/**
 * Migrate data from arxiv_papers.db to the new settings.db and paper_topics.db.
 * Called once on first launch after the refactor.
 */
function migrateToSplitDatabases(
  arxivDb: Database,
  newSettingsDb: SettingsDb,
  newPaperTopicsDb: PaperTopicsDb,
): void {
  const sqlDb = arxivDb.getDb();
  const sqlSettingsDb = newSettingsDb.getDb();
  const sqlPaperTopicsDb = newPaperTopicsDb.getDb();

  // Check if topics table exists in arxiv db (i.e., migration needed)
  const tableCheck = sqlDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='topics'");
  if (tableCheck.length === 0 || tableCheck[0].values.length === 0) {
    return; // Already migrated or fresh install
  }

  // Migrate topics
  const topicRows = sqlDb.exec('SELECT id, name, keywords, enabled FROM topics');
  if (topicRows.length > 0) {
    for (const row of topicRows[0].values) {
      sqlPaperTopicsDb.run(
        'INSERT OR IGNORE INTO topics (id, name, keywords, enabled) VALUES (?, ?, ?, ?)',
        [row[0], row[1], row[2], row[3]],
      );
    }
    console.log(`[migration] Migrated ${topicRows[0].values.length} topics`);
  }

  // Migrate app_config
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

  // Migrate relevance_topics to arxiv_paper_topics junction table
  const paperRows = sqlDb.exec(
    `SELECT id, relevance_topics FROM papers WHERE relevance_topics IS NOT NULL AND relevance_topics != 'null' AND relevance_topics != ''`,
  );
  if (paperRows.length > 0) {
    let count = 0;
    sqlPaperTopicsDb.run('BEGIN TRANSACTION');
    for (const row of paperRows[0].values) {
      const paperId = row[0] as string;
      const topicsJson = row[1] as string;
      try {
        const topicNames: string[] = JSON.parse(topicsJson);
        for (const name of topicNames) {
          // Look up topic_id by name
          const idResults = sqlPaperTopicsDb.exec('SELECT id FROM topics WHERE name = ?', [name]);
          if (idResults.length > 0 && idResults[0].values.length > 0) {
            const topicId = idResults[0].values[0][0] as number;
            sqlPaperTopicsDb.run(
              'INSERT OR IGNORE INTO arxiv_paper_topics (paper_id, topic_id) VALUES (?, ?)',
              [paperId, topicId],
            );
            count++;
          }
        }
      } catch {
        // Skip malformed JSON
      }
    }
    sqlPaperTopicsDb.run('COMMIT');
    console.log(`[migration] Migrated ${count} paper-topic associations`);
  }

  // Drop relevance_topics column from papers
  try {
    sqlDb.run('ALTER TABLE papers DROP COLUMN relevance_topics');
    console.log('[migration] Dropped relevance_topics column');
  } catch {
    // Column may not exist or SQLite version doesn't support DROP COLUMN
    console.log('[migration] Could not drop relevance_topics column (may not exist)');
  }

  // Drop topics and app_config from arxiv db (keep categories)
  try { sqlDb.run('DROP TABLE topics'); } catch { /* ignore */ }
  try { sqlDb.run('DROP TABLE app_config'); } catch { /* ignore */ }
  console.log('[migration] Dropped topics and app_config tables from arxiv db');

  // Save the new databases
  // Note: save will be called by the caller or on quit
}

app.setName('SciPhant');

app.whenReady().then(async () => {

  const isMac = process.platform === 'darwin';
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: 'SciPhant',
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const, submenu: [] as Electron.MenuItemConstructorOptions[] },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ] as Electron.MenuItemConstructorOptions[],
    }] : []),
    { role: 'editMenu' as const },
    { role: 'viewMenu' as const },
    { role: 'windowMenu' as const },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  db = new Database(join(app.getPath('userData'), 'arxiv_papers.db'));
  await db.init();

  // Load read-only conference database (bundled with app)
  const conferenceDbPath = app.isPackaged
    ? join(process.resourcesPath, 'conference_papers.db')
    : join(app.getAppPath(), 'resources', 'conference_papers.db');
  conferenceDb = await Database.fromReadOnlyFile(conferenceDbPath, join(__dirname, 'wasm'));

  // Writable database for conference paper analyses
  conferenceAnalysesDb = new ConferenceAnalysesDb(join(app.getPath('userData'), 'conference_analyses.db'));
  await conferenceAnalysesDb.init();

  // Settings database (migrated from arxiv_papers.db)
  settingsDb = new SettingsDb(join(app.getPath('userData'), 'settings.db'));
  await settingsDb.init();

  // Paper topics database (topics + junction tables)
  paperTopicsDb = new PaperTopicsDb(join(app.getPath('userData'), 'paper_topics.db'));
  await paperTopicsDb.init();

  // Migrate data from arxiv_papers.db to new databases
  migrateToSplitDatabases(db, settingsDb, paperTopicsDb);

  // Save migrated data
  await settingsDb.save();
  await paperTopicsDb.save();
  await db.save();

  registerIpcHandlers(db, conferenceDb, conferenceAnalysesDb, settingsDb, paperTopicsDb, createWindow());

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch((err) => {
  console.error('App initialization failed:', err);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
