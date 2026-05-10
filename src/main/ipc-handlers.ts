import { ipcMain, dialog, app, shell } from 'electron';
import * as fs from 'fs/promises';
import type { BrowserWindow } from 'electron';
import type { Database } from './database/connection';
import type { ConferenceAnalysesDb } from './database/conference-analyses';
import type { SettingsDb } from './database/settings';
import type { PaperTopicsDb } from './database/paper-topics';
import * as paperCmd from './commands/paper';
import * as configCmd from './commands/config';
import * as fetchCmd from './commands/fetch';
import * as summaryCmd from './commands/summary';
import * as analysisCmd from './commands/analysis';
import * as llmCmd from './commands/llm';
import * as paperAnalyzerCmd from './services/paper-analyzer';
import * as rebuildArxivTopics from './commands/rebuild-arxiv-topics';
import * as rebuildConferenceTopics from './commands/rebuild-conference-topics';
import * as conferencePaperCmd from './commands/conference-paper';
import * as conferenceSummaryCmd from './commands/conference-summary';
import * as conferenceAnalysisCmd from './commands/conference-analysis';
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

export function registerIpcHandlers(
  db: Database,
  conferenceDb: Database,
  conferenceAnalysesDb: ConferenceAnalysesDb,
  settingsDb: SettingsDb,
  paperTopicsDb: PaperTopicsDb,
  mainWindow: BrowserWindow,
): void {
  const sqlDb = db.getDb();
  const sqlConferenceDb = conferenceDb.getDb();
  const sqlAnalysesDb = conferenceAnalysesDb.getDb();
  const sqlSettingsDb = settingsDb.getDb();
  const sqlPaperTopicsDb = paperTopicsDb.getDb();

  // Serial queue for topic association updates
  let topicQueueChain = Promise.resolve();
  const enqueueTopicUpdate = (fn: () => void) => {
    topicQueueChain = topicQueueChain.then(fn, fn);
    return topicQueueChain;
  };

  // Paper (read-only)
  handle('list-papers', async (params) => paperCmd.listPapers(sqlDb, sqlPaperTopicsDb, params));
  handle('get-paper-detail', async (paperId) => paperCmd.getPaperDetail(sqlDb, paperId));
  handle('list-fetch-dates', async () => paperCmd.listFetchDates(sqlDb));
  handle('list-topic-counts', async () => paperCmd.listTopicCounts(sqlPaperTopicsDb));

  // Config
  handle('list-topics', async () => configCmd.listTopics(sqlPaperTopicsDb));
  handle('save-topic', async (topic) => {
    try {
      const result = configCmd.saveTopic(sqlPaperTopicsDb, topic);
      const topicId = result.id;
      await enqueueTopicUpdate(() => {
        rebuildArxivTopics.updateArxivTopicAssociations(sqlDb, sqlPaperTopicsDb, topicId);
        rebuildConferenceTopics.updateConferenceTopicAssociations(sqlConferenceDb, sqlPaperTopicsDb, topicId);
        paperTopicsDb.save();
      });
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
    configCmd.deleteTopic(sqlPaperTopicsDb, topicId);
    await enqueueTopicUpdate(() => {
      rebuildArxivTopics.deleteArxivTopicAssociations(sqlPaperTopicsDb, topicId);
      rebuildConferenceTopics.deleteConferenceTopicAssociations(sqlPaperTopicsDb, topicId);
      paperTopicsDb.save();
    });
  });
  handle('rebuild-paper-topics', async () => {
    await enqueueTopicUpdate(() => {
      rebuildArxivTopics.rebuildArxivPaperTopics(sqlDb, sqlPaperTopicsDb);
      rebuildConferenceTopics.rebuildConferencePaperTopics(sqlConferenceDb, sqlPaperTopicsDb);
      paperTopicsDb.save();
    });
    return { success: true };
  });
  handle('get-config', async () => configCmd.getConfig(sqlSettingsDb));
  handle('update-config', async (config) => {
    configCmd.updateConfig(sqlSettingsDb, config.llm, config.output, config.zotero, config.theme);
    await settingsDb.save();
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
  handle('test-zotero-connection', async () => configCmd.testZoteroConnection(sqlSettingsDb));

  // Fetch
  handle('fetch-papers', async (categories) => {
    const result = await fetchCmd.fetchPapers(sqlDb, sqlPaperTopicsDb, categories || []);
    await db.save();
    await paperTopicsDb.save();
    return result;
  });
  handle('fetch-papers-this-week', async (categories) => {
    const result = await fetchCmd.fetchPapersThisWeek(sqlDb, sqlPaperTopicsDb, categories || []);
    await db.save();
    await paperTopicsDb.save();
    return result;
  });
  ipcMain.handle('fetch-papers-by-date', async (_event, params) => {
    try {
      const result = await fetchCmd.fetchPapersByDate(sqlDb, sqlPaperTopicsDb, params);
      await db.save();
      await paperTopicsDb.save();
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
      const result = await summaryCmd.summarizePaper(sqlDb, sqlSettingsDb, sqlPaperTopicsDb, paperId, skipIfAnalyzed, controller.signal);
      await db.save();
      await paperTopicsDb.save();
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
    const result = await summaryCmd.summarizeAllUnanalyzed(sqlDb, sqlSettingsDb, sqlPaperTopicsDb, mainWindow, async () => {
      await db.save();
      await paperTopicsDb.save();
    });
    return result;
  });
  handle('stop-summary', async () => summaryCmd.stopSummary());
  handle('get-unanalyzed-paper-ids', async () => summaryCmd.getUnsummarizedPapers(sqlDb, sqlPaperTopicsDb));
  handle('test-llm-connection', async () => llmCmd.testLLMConnection(sqlSettingsDb));

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
    analysisCmd.setAnalysisAbortController(controller);
    try {
      const result = await paperAnalyzerCmd.analyzeFullPaper(sqlDb, sqlSettingsDb, paperId, controller.signal, app.getPath('userData'), (phase) => {
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
      analysisCmd.setAnalysisAbortController(null);
    }
  });
  handle('get-paper-analysis', async (paperId) => paperAnalyzerCmd.getPaperAnalysis(sqlDb, paperId));
  handle('get-unanalyzed-analysis-papers', async () => paperAnalyzerCmd.getUnanalyzedPapers(sqlDb));
  handle('stop-analysis', async () => analysisCmd.stopAnalysis());

  // Zotero
  handle('list-zotero-collections', async () => {
    const config = loadZoteroConfig(sqlSettingsDb);
    if (!config.api_key || !config.user_id) {
      throw new Error('Zotero API Key 和 User ID 未配置');
    }
    return fetchCollections(config.user_id, config.api_key);
  });

  handle('export-paper-to-zotero', async (paperId: string, collectionKey: string, summaryHtml?: string, analysisHtml?: string) => {
    const config = loadZoteroConfig(sqlSettingsDb);
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

  // ── Conference mode ──

  // Conference papers (read-only from bundled DB)
  handle('conference:list-conferences', async () => conferencePaperCmd.listConferences(sqlConferenceDb));
  handle('conference:list-papers', async (params) =>
    conferencePaperCmd.listConferencePapers(sqlConferenceDb, sqlAnalysesDb, sqlDb, sqlPaperTopicsDb, params),
  );
  handle('conference:get-paper-detail', async (paperId) =>
    conferencePaperCmd.getConferencePaperDetail(sqlConferenceDb, sqlAnalysesDb, paperId),
  );
  handle('conference:list-tracks', async (conferenceId) =>
    conferencePaperCmd.listConferenceTracks(sqlConferenceDb, conferenceId),
  );

  // Conference summary
  ipcMain.handle('conference:summarize-paper', async (_event, paperId, skipIfAnalyzed) => {
    const controller = new AbortController();
    conferenceSummaryCmd.setConferenceSummaryAbortController(controller);
    try {
      const result = await conferenceSummaryCmd.summarizeConferencePaper(
        sqlConferenceDb, sqlAnalysesDb, sqlSettingsDb, paperId, skipIfAnalyzed, controller.signal,
      );
      await conferenceAnalysesDb.save();
      return result;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { success: false, cancelled: true };
      }
      throw err;
    } finally {
      conferenceSummaryCmd.setConferenceSummaryAbortController(null);
    }
  });
  handle('conference:stop-summary', async () => conferenceSummaryCmd.stopConferenceSummary());
  handle('conference:get-unanalyzed-ids', async () =>
    conferenceSummaryCmd.getUnsummarizedConferencePapers(sqlConferenceDb, sqlAnalysesDb),
  );

  // Conference analysis (full paper)
  ipcMain.handle('conference:analyze-full-paper', async (_event, paperId) => {
    const controller = new AbortController();
    conferenceAnalysisCmd.setConferenceAnalysisAbortController(controller);
    try {
      const result = await conferenceAnalysisCmd.analyzeConferenceFullPaper(
        sqlConferenceDb, sqlAnalysesDb, sqlSettingsDb, paperId, controller.signal,
        app.getPath('userData'), (phase) => {
          mainWindow.webContents.send('analysis-progress', phase);
        },
      );
      await conferenceAnalysesDb.save();
      return result;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { success: false, cancelled: true };
      }
      throw err;
    } finally {
      conferenceAnalysisCmd.setConferenceAnalysisAbortController(null);
    }
  });
  handle('conference:get-paper-analysis', async (paperId) =>
    conferenceAnalysisCmd.getConferencePaperAnalysis(sqlAnalysesDb, paperId),
  );
  handle('conference:stop-analysis', async () => conferenceAnalysisCmd.stopConferenceAnalysis());

  // Conference PDF
  handle('conference:download-pdf', async (paperId) => {
    const pdfUrl = conferencePaperCmd.getConferencePaperPdfUrl(sqlConferenceDb, paperId);
    if (!pdfUrl) throw new Error(`Paper ${paperId} has no PDF URL`);
    const filePath = await ensurePdfDownloaded(pdfUrl, undefined, app.getPath('userData'), (loaded, total) => {
      mainWindow.webContents.send('pdf-download-progress', { paperId, loaded, total });
    });
    return filePath;
  });

  handle('conference:open-pdf', async (paperId) => {
    const pdfUrl = conferencePaperCmd.getConferencePaperPdfUrl(sqlConferenceDb, paperId);
    if (!pdfUrl) return;
    const localPath = getPdfPath(app.getPath('userData'), pdfUrl);
    await shell.openPath(localPath);
  });

  handle('conference:is-pdf-cached', async (paperId) => {
    const pdfUrl = conferencePaperCmd.getConferencePaperPdfUrl(sqlConferenceDb, paperId);
    if (!pdfUrl) return false;
    const localPath = getPdfPath(app.getPath('userData'), pdfUrl);
    try { await fs.access(localPath); return true; } catch { return false; }
  });

  handle('conference:delete-pdf', async (paperId) => {
    const pdfUrl = conferencePaperCmd.getConferencePaperPdfUrl(sqlConferenceDb, paperId);
    if (!pdfUrl) return;
    const localPath = getPdfPath(app.getPath('userData'), pdfUrl);
    try { await fs.unlink(localPath); } catch { /* ignore */ }
  });

  handle('conference:delete-summary', async (paperId) => {
    sqlAnalysesDb.exec('UPDATE analyses SET summary = \'\' WHERE paper_id = ?', [paperId]);
    await conferenceAnalysesDb.save();
  });

  handle('conference:delete-analysis', async (paperId) => {
    sqlAnalysesDb.exec('UPDATE analyses SET analysis = \'\' WHERE paper_id = ?', [paperId]);
    await conferenceAnalysesDb.save();
  });

  // Conference Zotero export
  handle('conference:export-to-zotero', async (paperId: string, collectionKey: string, summaryHtml?: string, analysisHtml?: string) => {
    const zoteroConfig = loadZoteroConfig(sqlSettingsDb);
    if (!zoteroConfig.api_key || !zoteroConfig.user_id) {
      throw new Error('Zotero API Key 和 User ID 未配置');
    }
    const results = sqlConferenceDb.exec(
      `SELECT p.id, p.title, p.authors, p.abstract, p.detail_url, p.pdf_url, p.pages,
              c.short_name, c.year, c.full_name
       FROM papers p JOIN conferences c ON p.conference_id = c.id
       WHERE p.id = ?`,
      [paperId],
    );
    if (results.length === 0 || results[0].values.length === 0) {
      throw new Error(`Conference paper ${paperId} not found`);
    }
    const row = results[0].values[0];
    const authors: string[] = JSON.parse(row[2] as string);
    const creators = authors.map(name => {
      const parts = name.trim().split(/\s+/);
      if (parts.length === 1) return { creatorType: 'author' as const, firstName: '', lastName: parts[0] };
      return { creatorType: 'author' as const, firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
    });

    const pdfUrl = (row[5] as string) || '';
    const shortName = row[7] as string;
    const year = row[8] as number;
    const fullName = (row[9] as string) || `${shortName} ${year}`;
    const pages = (row[6] as string) || '';
    const detailUrl = (row[4] as string) || '';

    const extraLines: string[] = [];
    if ((row[3] as string)) {
      const abstractText = (row[3] as string).substring(0, 200);
      extraLines.push(`Abstract: ${abstractText}...`);
    }

    const itemKey = await createItem(zoteroConfig.user_id, zoteroConfig.api_key, collectionKey, {
      itemType: 'conferencePaper',
      title: row[1] as string,
      abstractNote: (row[3] as string) || '',
      date: String(year),
      DOI: '',
      url: detailUrl,
      proceedingsTitle: fullName,
      conferenceName: `${shortName} ${year}`,
      pages: pages,
      repository: shortName,
      archiveID: paperId,
      extra: extraLines.join('\n'),
      creators,
      tags: [],
      collections: [],
    });

    const children: ChildItemPayload[] = [];

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
          tags: [{ tag: shortName }],
        });
      } catch { /* PDF not cached */ }
    }

    const noteParts: string[] = [];
    if (summaryHtml) noteParts.push(`<h1>论文总结</h1>${summaryHtml}`);
    if (analysisHtml) noteParts.push(`<h1>论文分析</h1>${analysisHtml}`);
    if (noteParts.length > 0) {
      children.push({
        itemType: 'note',
        parentItem: itemKey,
        note: noteParts.join('\n<hr>\n'),
        tags: [],
      });
    }

    if (children.length > 0) {
      await createChildItems(zoteroConfig.user_id, zoteroConfig.api_key, children);
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
