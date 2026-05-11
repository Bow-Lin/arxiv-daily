import { app, BrowserWindow, shell, Menu } from 'electron';
import { join } from 'path';
import { Database } from './database/connection';
import { ConferenceAnalysesDb } from './database/conference-analyses';
import { SettingsDb } from './database/settings';
import { PaperTopicsDb } from './database/paper-topics';
import { migrateFromOldAppData, migrateToSplitDatabases } from './database/migrations';
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

  // Step 1: Migrate data files from old app name ("arXiv Daily") directory
  migrateFromOldAppData();

  // Step 2: Initialize all databases
  db = new Database(join(app.getPath('userData'), 'arxiv_papers.db'));
  await db.init();

  const conferenceDbPath = app.isPackaged
    ? join(process.resourcesPath, 'conference_papers.db')
    : join(app.getAppPath(), 'resources', 'conference_papers.db');
  conferenceDb = await Database.fromReadOnlyFile(conferenceDbPath, join(__dirname, 'wasm'));

  conferenceAnalysesDb = new ConferenceAnalysesDb(join(app.getPath('userData'), 'conference_analyses.db'));
  await conferenceAnalysesDb.init();

  settingsDb = new SettingsDb(join(app.getPath('userData'), 'settings.db'));
  await settingsDb.init();

  paperTopicsDb = new PaperTopicsDb(join(app.getPath('userData'), 'paper_topics.db'));
  await paperTopicsDb.init();

  // Step 3: Migrate schema data (topics, config) from arxiv_papers.db to split databases
  const migrated = migrateToSplitDatabases(db, settingsDb, paperTopicsDb);
  if (migrated) {
    await settingsDb.save();
    await paperTopicsDb.save();
    await db.save();
  }

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
