import { ipcMain, dialog, app, shell } from 'electron';
import type { BrowserWindow } from 'electron';
import type { Database } from './database/connection';
import * as paperCmd from './commands/paper';
import * as configCmd from './commands/config';
import * as fetchCmd from './commands/fetch';
import * as summaryCmd from './commands/analysis';
import * as analysisCmd from './services/paper-analyzer';
import { ensurePdfDownloaded, getPdfPath } from './services/pdf-extractor';
import { fetchCollections, createItem, createChildItems, type ChildItemPayload } from './services/zotero-client';
import { loadZoteroConfig } from './commands/config';

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
    configCmd.updateConfig(sqlDb, config.llm, config.output, config.zotero, config.theme);
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
        failed_details: [],
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

  // PDF download
  ipcMain.handle('download-pdf', async (_event, paperId) => {
    const results = sqlDb.exec('SELECT pdf_url FROM papers WHERE id = ?', [paperId]);
    if (results.length === 0 || results[0].values.length === 0) {
      throw new Error(`Paper ${paperId} not found`);
    }
    const pdfUrl = results[0].values[0][0] as string;
    if (!pdfUrl) {
      throw new Error(`Paper ${paperId} has no PDF URL`);
    }
    const filePath = await ensurePdfDownloaded(pdfUrl, undefined, app.getPath('userData'), (loaded, total) => {
      mainWindow.webContents.send('pdf-download-progress', { paperId, loaded, total });
    });
    return filePath;
  });

  ipcMain.handle('open-pdf', async (_event, paperId) => {
    const results = sqlDb.exec('SELECT pdf_url FROM papers WHERE id = ?', [paperId]);
    if (results.length === 0 || results[0].values.length === 0) return;
    const pdfUrl = results[0].values[0][0] as string;
    if (!pdfUrl) return;
    const localPath = getPdfPath(app.getPath('userData'), pdfUrl);
    await shell.openPath(localPath);
  });

  ipcMain.handle('is-pdf-cached', async (_event, paperId) => {
    const results = sqlDb.exec('SELECT pdf_url FROM papers WHERE id = ?', [paperId]);
    if (results.length === 0 || results[0].values.length === 0) return false;
    const pdfUrl = results[0].values[0][0] as string;
    if (!pdfUrl) return false;
    const localPath = getPdfPath(app.getPath('userData'), pdfUrl);
    try {
      await require('fs/promises').access(localPath);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('delete-pdf', async (_event, paperId) => {
    const results = sqlDb.exec('SELECT pdf_url FROM papers WHERE id = ?', [paperId]);
    if (results.length === 0 || results[0].values.length === 0) return;
    const pdfUrl = results[0].values[0][0] as string;
    if (!pdfUrl) return;
    const localPath = getPdfPath(app.getPath('userData'), pdfUrl);
    try {
      await require('fs/promises').unlink(localPath);
    } catch { /* ignore */ }
  });

  ipcMain.handle('delete-summary', async (_event, paperId) => {
    sqlDb.exec('UPDATE analyses SET summary = \'\' WHERE paper_id = ?', [paperId]);
    await db.save();
  });

  ipcMain.handle('delete-analysis', async (_event, paperId) => {
    sqlDb.exec('UPDATE analyses SET analysis = \'\' WHERE paper_id = ?', [paperId]);
    await db.save();
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

  // Zotero
  ipcMain.handle('list-zotero-collections', async () => {
    const config = loadZoteroConfig(sqlDb);
    if (!config.api_key || !config.user_id) {
      throw new Error('Zotero API Key 和 User ID 未配置');
    }
    return fetchCollections(config.user_id, config.api_key);
  });

  ipcMain.handle('export-paper-to-zotero', async (_event, paperId: string, collectionKey: string, summaryHtml?: string, analysisHtml?: string) => {
    const config = loadZoteroConfig(sqlDb);
    if (!config.api_key || !config.user_id) {
      throw new Error('Zotero API Key 和 User ID 未配置');
    }
    // Fetch paper from DB
    const results = sqlDb.exec(
      'SELECT id, title, authors, abstract_text, url, pdf_url, doi, published_date, categories FROM papers WHERE id = ?',
      [paperId],
    );
    if (results.length === 0 || results[0].values.length === 0) {
      throw new Error(`Paper ${paperId} not found`);
    }
    const row = results[0].values[0];
    const authors: string[] = JSON.parse(row[2] as string);
    const creators = authors.map(name => {
      const parts = name.trim().split(/\s+/);
      if (parts.length === 1) return { creatorType: 'author' as const, firstName: '', lastName: parts[0] };
      return { creatorType: 'author' as const, firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
    });

    // Strip version suffix from arXiv ID (e.g. "2401.12345v2" → "2401.12345")
    const arxivId = (row[0] as string).replace(/v\d+$/, '');
    const pdfUrl = (row[5] as string) || '';
    const doi = (row[6] as string) || '';
    const publishedDate = (row[7] as string) || '';
    const categories: string[] = JSON.parse(row[8] as string);

    // 1. Create main item
    const arxivRef = `arXiv:${arxivId}`;
    const extraLines: string[] = [];
    if (categories.length > 0) {
      extraLines.push(`Categories: ${categories.join(', ')}`);
    }
    const itemKey = await createItem(config.user_id, config.api_key, collectionKey, {
      itemType: 'preprint',
      title: row[1] as string,
      abstractNote: (row[3] as string) || '',
      date: publishedDate,
      DOI: doi,
      url: ((row[4] as string) || '').replace(/v\d+$/, ''),
      repository: 'arXiv',
      archiveID: arxivRef,
      extra: extraLines.join('\n'),
      creators,
      tags: [],
      collections: [],
    });

    // 2. Build child items (PDF attachment + notes)
    const children: ChildItemPayload[] = [];

    // 2a. PDF attachment — only if already cached locally
    if (pdfUrl) {
      const localPath = getPdfPath(app.getPath('userData'), pdfUrl);
      try {
        await require('fs/promises').access(localPath);
        children.push({
          itemType: 'attachment',
          parentItem: itemKey,
          linkMode: 'linked_file',
          path: localPath,
          title: 'Full Text PDF',
          contentType: 'application/pdf',
          tags: [{ tag: 'arXiv' }],
        });
      } catch {
        // PDF not cached locally, skip attachment
      }
    }

    // 2b. Notes — use pre-converted HTML from renderer
    const noteParts: string[] = [];
    if (summaryHtml) {
      noteParts.push(`<h1>论文总结</h1>${summaryHtml}`);
    }
    if (analysisHtml) {
      noteParts.push(`<h1>论文分析</h1>${analysisHtml}`);
    }
    if (noteParts.length > 0) {
      children.push({
        itemType: 'note',
        parentItem: itemKey,
        note: noteParts.join('\n<hr>\n'),
        tags: [],
      });
    }

    // 3. Create all child items
    if (children.length > 0) {
      await createChildItems(config.user_id, config.api_key, children);
    } else {
    }

    return { success: true, itemKey };
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
