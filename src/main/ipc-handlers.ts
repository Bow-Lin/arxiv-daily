import { ipcMain, dialog, app } from 'electron';
import type { BrowserWindow } from 'electron';
import type { Database } from './database/connection';
import * as paperCmd from './commands/paper';
import * as configCmd from './commands/config';
import * as fetchCmd from './commands/fetch';
import * as summaryCmd from './commands/analysis';
import * as analysisCmd from './services/paper-analyzer';

export function registerIpcHandlers(db: Database, mainWindow: BrowserWindow): void {
  const sqlDb = db.getDb();

  // Paper (read-only)
  ipcMain.handle('list-papers', async (_event, params) => {
    return paperCmd.listPapers(sqlDb, params);
  });
  ipcMain.handle('get-paper-detail', async (_event, paperId) => {
    return paperCmd.getPaperDetail(sqlDb, paperId);
  });
  ipcMain.handle('list-fetch-dates', async () => {
    return paperCmd.listFetchDates(sqlDb);
  });
  ipcMain.handle('list-topic-counts', async () => {
    return paperCmd.listTopicCounts(sqlDb);
  });

  // Config
  ipcMain.handle('list-topics', async () => {
    return configCmd.listTopics(sqlDb);
  });
  ipcMain.handle('save-topic', async (_event, topic) => {
    const result = configCmd.saveTopic(sqlDb, topic);
    await db.save();
    return result;
  });
  ipcMain.handle('delete-topic', async (_event, topicId) => {
    configCmd.deleteTopic(sqlDb, topicId);
    await db.save();
  });
  ipcMain.handle('get-config', async () => {
    return configCmd.getConfig(sqlDb);
  });
  ipcMain.handle('update-config', async (_event, config) => {
    configCmd.updateConfig(sqlDb, config.llm, config.output, config.proxy);
    await db.save();
  });
  ipcMain.handle('list-categories', async () => {
    return configCmd.listCategories(sqlDb);
  });
  ipcMain.handle('save-category', async (_event, category) => {
    const result = configCmd.saveCategory(sqlDb, category);
    await db.save();
    return result;
  });
  ipcMain.handle('delete-category', async (_event, categoryId) => {
    configCmd.deleteCategory(sqlDb, categoryId);
    await db.save();
  });
  ipcMain.handle('clear-data', async () => {
    const result = configCmd.clearData(sqlDb);
    await db.save();
    return result;
  });
  ipcMain.handle('clear-analyses', async () => {
    const result = configCmd.clearAnalyses(sqlDb);
    await db.save();
    return result;
  });

  // Fetch
  ipcMain.handle('fetch-papers', async (_event, categories) => {
    const result = await fetchCmd.fetchPapers(sqlDb, categories || []);
    await db.save();
    return result;
  });
  ipcMain.handle('fetch-papers-this-week', async (_event, categories) => {
    const result = await fetchCmd.fetchPapersThisWeek(sqlDb, categories || []);
    await db.save();
    return result;
  });
  ipcMain.handle('fetch-papers-by-date', async (_event, params) => {
    try {
      const result = await fetchCmd.fetchPapersByDate(sqlDb, params);
      await db.save();
      return result;
    } catch (err) {
      console.error('[IPC] fetch-papers-by-date error:', err);
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        local_count: 0,
        new_count: 0,
        total_count: 0,
        failed_categories: [],
        error: message,
      };
    }
  });

  // Summary (shallow analysis)
  ipcMain.handle('summarize-paper', async (_event, paperId, skipIfAnalyzed) => {
    const controller = new AbortController();
    summaryCmd.setSummaryAbortController(controller);
    try {
      const result = await summaryCmd.summarizePaper(sqlDb, paperId, skipIfAnalyzed, controller.signal);
      await db.save();
      return result;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { success: false, cancelled: true };
      }
      throw err;
    } finally {
      summaryCmd.setSummaryAbortController(null);
    }
  });
  ipcMain.handle('summarize-all-unanalyzed', async () => {
    const result = await summaryCmd.summarizeAllUnanalyzed(sqlDb, mainWindow, async () => {
      await db.save();
    });
    return result;
  });
  ipcMain.handle('stop-summary', async () => {
    return summaryCmd.stopSummary();
  });
  ipcMain.handle('get-unanalyzed-paper-ids', async () => {
    return summaryCmd.getUnanalyzedPapers(sqlDb);
  });
  ipcMain.handle('test-llm-connection', async () => {
    return summaryCmd.testLLMConnection(sqlDb);
  });

  // Analysis (full paper)
  ipcMain.handle('analyze-full-paper', async (_event, paperId) => {
    const controller = new AbortController();
    summaryCmd.setAnalysisAbortController(controller);
    try {
      const result = await analysisCmd.analyzeFullPaper(sqlDb, paperId, controller.signal, app.getPath('userData'), (phase) => {
        mainWindow.webContents.send('analysis-progress', phase);
      });
      await db.save();
      return result;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { success: false, cancelled: true };
      }
      console.error(`[Analysis] FAILED for paper ${paperId}:`, err);
      throw err;
    } finally {
      summaryCmd.setAnalysisAbortController(null);
    }
  });
  ipcMain.handle('get-paper-analysis', async (_event, paperId) => {
    return analysisCmd.getPaperAnalysis(sqlDb, paperId);
  });
  ipcMain.handle('get-unanalyzed-analysis-papers', async () => {
    return analysisCmd.getUnanalyzedPapers(sqlDb);
  });
  ipcMain.handle('stop-analysis', async () => {
    return summaryCmd.stopAnalysis();
  });

  // Dialog
  ipcMain.handle('open-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    if (result.canceled) return undefined;
    return result.filePaths[0];
  });
}
