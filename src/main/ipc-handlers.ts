import { ipcMain, dialog, app, shell } from 'electron';
import * as fs from 'fs/promises';
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

function handle(channel: string, fn: (...args: any[]) => Promise<any>) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      console.error(`[IPC] ${channel} error:`, err);
      throw err;
    }
  });
}

export function registerIpcHandlers(db: Database, mainWindow: BrowserWindow): void {
  const sqlDb = db.getDb();

  // Paper (read-only)
  handle('list-papers', async (params) => paperCmd.listPapers(sqlDb, params));
  handle('get-paper-detail', async (paperId) => paperCmd.getPaperDetail(sqlDb, paperId));
  handle('list-fetch-dates', async () => paperCmd.listFetchDates(sqlDb));
  handle('list-topic-counts', async () => paperCmd.listTopicCounts(sqlDb));

  // Config
  handle('list-topics', async () => configCmd.listTopics(sqlDb));
  handle('save-topic', async (topic) => {
    try {
      const result = configCmd.saveTopic(sqlDb, topic);
      await db.save();
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('UNIQUE constraint failed')) {
        return { error: '主题名称已存在' };
      }
      throw err;
    }
  });
  handle('delete-topic', async (topicId) => {
    configCmd.deleteTopic(sqlDb, topicId);
    await db.save();
  });
  handle('rebuild-paper-topics', async () => {
    const count = configCmd.rebuildPaperTopics(sqlDb);
    await db.save();
    return { success: true, count };
  });
  handle('get-config', async () => configCmd.getConfig(sqlDb));
  handle('update-config', async (config) => {
    configCmd.updateConfig(sqlDb, config.llm, config.output, config.zotero, config.theme);
    await db.save();
  });
  handle('list-categories', async () => configCmd.listCategories(sqlDb));
  handle('save-category', async (category) => {
    const result = configCmd.saveCategory(sqlDb, category);
    await db.save();
    return result;
  });
  handle('delete-category', async (categoryId) => {
    configCmd.deleteCategory(sqlDb, categoryId);
    await db.save();
  });
  handle('clear-data', async () => {
    const result = configCmd.clearData(sqlDb);
    await db.save();
    return result;
  });
  handle('clear-analyses', async () => {
    const result = configCmd.clearAnalyses(sqlDb);
    await db.save();
    return result;
  });
  handle('test-zotero-connection', async () => configCmd.testZoteroConnection(sqlDb));

  // Fetch
  handle('fetch-papers', async (categories) => {
    const result = await fetchCmd.fetchPapers(sqlDb, categories || []);
    await db.save();
    return result;
  });
  handle('fetch-papers-this-week', async (categories) => {
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
  handle('summarize-all-unanalyzed', async () => {
    const result = await summaryCmd.summarizeAllUnanalyzed(sqlDb, mainWindow, async () => {
      await db.save();
    });
    return result;
  });
  handle('stop-summary', async () => summaryCmd.stopSummary());
  handle('get-unanalyzed-paper-ids', async () => summaryCmd.getUnanalyzedPapers(sqlDb));
  handle('test-llm-connection', async () => summaryCmd.testLLMConnection(sqlDb));

  // PDF download
  handle('download-pdf', async (paperId) => {
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

  handle('open-pdf', async (paperId) => {
    const results = sqlDb.exec('SELECT pdf_url FROM papers WHERE id = ?', [paperId]);
    if (results.length === 0 || results[0].values.length === 0) return;
    const pdfUrl = results[0].values[0][0] as string;
    if (!pdfUrl) return;
    const localPath = getPdfPath(app.getPath('userData'), pdfUrl);
    await shell.openPath(localPath);
  });

  handle('is-pdf-cached', async (paperId) => {
    const results = sqlDb.exec('SELECT pdf_url FROM papers WHERE id = ?', [paperId]);
    if (results.length === 0 || results[0].values.length === 0) return false;
    const pdfUrl = results[0].values[0][0] as string;
    if (!pdfUrl) return false;
    const localPath = getPdfPath(app.getPath('userData'), pdfUrl);
    try {
      await fs.access(localPath);
      return true;
    } catch {
      return false;
    }
  });

  handle('delete-pdf', async (paperId) => {
    const results = sqlDb.exec('SELECT pdf_url FROM papers WHERE id = ?', [paperId]);
    if (results.length === 0 || results[0].values.length === 0) return;
    const pdfUrl = results[0].values[0][0] as string;
    if (!pdfUrl) return;
    const localPath = getPdfPath(app.getPath('userData'), pdfUrl);
    try {
      await fs.unlink(localPath);
    } catch { /* ignore */ }
  });

  handle('delete-summary', async (paperId) => {
    sqlDb.exec('UPDATE analyses SET summary = \'\' WHERE paper_id = ?', [paperId]);
    await db.save();
  });

  handle('delete-analysis', async (paperId) => {
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
  handle('get-paper-analysis', async (paperId) => analysisCmd.getPaperAnalysis(sqlDb, paperId));
  handle('get-unanalyzed-analysis-papers', async () => analysisCmd.getUnanalyzedPapers(sqlDb));
  handle('stop-analysis', async () => summaryCmd.stopAnalysis());

  // Zotero
  handle('list-zotero-collections', async () => {
    const config = loadZoteroConfig(sqlDb);
    if (!config.api_key || !config.user_id) {
      throw new Error('Zotero API Key 和 User ID 未配置');
    }
    return fetchCollections(config.user_id, config.api_key);
  });

  handle('export-paper-to-zotero', async (paperId: string, collectionKey: string, summaryHtml?: string, analysisHtml?: string) => {
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
        await fs.access(localPath);
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
    }

    return { success: true, itemKey };
  });

  // Dialog
  handle('open-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    if (result.canceled) return undefined;
    return result.filePaths[0];
  });
}
