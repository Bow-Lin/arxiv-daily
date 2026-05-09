import type { BrowserWindow } from 'electron';
import type { Database as SqlJsDatabase } from 'sql.js';
import { filterPaperTopics } from '../services/filter';
import { LLMClient } from '../services/llm-client';
import { loadLLMConfig, rebuildPaperTopics } from './config';
import { BASE_SQL, rowToPaper, execResultToPaperRows } from './paper-shared';

export interface SummaryProgress {
  current: number;
  total: number;
  title: string;
  status: 'analyzing' | 'done' | 'error' | 'stopped';
  error: string | null;
}

let summaryRunning = false;
let summaryCancelRequested = false;
let summaryAbortController: AbortController | null = null;
let analysisAbortController: AbortController | null = null;

function doSaveSummary(db: SqlJsDatabase, paperId: string, text: string): void {
  db.run(
    `INSERT INTO analyses (paper_id, summary)
     VALUES (?, ?)
     ON CONFLICT(paper_id) DO UPDATE SET
        summary = excluded.summary`,
    [paperId, text],
  );
}

export function stopSummary(): { success: boolean } {
  summaryCancelRequested = true;
  if (summaryAbortController) {
    summaryAbortController.abort();
    summaryAbortController = null;
  }
  return { success: true };
}

export function setSummaryAbortController(controller: AbortController | null): void {
  summaryAbortController = controller;
}

export function setAnalysisAbortController(controller: AbortController | null): void {
  analysisAbortController = controller;
}

export function stopAnalysis(): { success: boolean } {
  if (analysisAbortController) {
    analysisAbortController.abort();
    analysisAbortController = null;
  }
  return { success: true };
}

export async function summarizePaper(db: SqlJsDatabase, paperId: string, skipIfAnalyzed = true, signal?: AbortSignal): Promise<{
  success: boolean;
  summary?: string | null;
  skipped: boolean;
}> {
  const results = db.exec(`${BASE_SQL} WHERE p.id = ?`, [paperId]);
  if (results.length === 0 || results[0].values.length === 0) {
    throw new Error(`Paper ${paperId} not found`);
  }
  const paper = rowToPaper(execResultToPaperRows(results[0])[0]);

  if (skipIfAnalyzed) {
    const hasContent = paper.summary != null
      && paper.summary.length > 0
      && paper.summary !== 'null'
      && !paper.summary.startsWith('SUMMARY_FAILED:');
    if (hasContent) {
      return { success: true, summary: paper.summary, skipped: true };
    }
  }

  if (paper.summary?.startsWith('SUMMARY_FAILED:')) {
    db.run('DELETE FROM analyses WHERE paper_id = ? AND analysis IS NULL', [paperId]);
  }

  const llmConfig = loadLLMConfig(db);
  const topicRows = db.exec('SELECT id, name, keywords, enabled FROM topics WHERE enabled = TRUE');
  const allTopics = topicRows.length > 0
    ? topicRows[0].values.map(row => ({
      id: row[0] as number,
      name: row[1] as string,
      keywords: JSON.parse(row[2] as string),
      enabled: Boolean(row[3]),
    }))
    : [];

  const topicNames = allTopics.map(t => t.name);
  const matchedTopics = filterPaperTopics(paper.title, paper.abstract_text, allTopics);
  const topicsJson = matchedTopics.length > 0 ? JSON.stringify(matchedTopics) : null;
  db.run('UPDATE papers SET relevance_topics = ? WHERE id = ?', [topicsJson, paperId]);

  const client = new LLMClient(llmConfig.api_key, llmConfig.model, llmConfig.base_url, llmConfig.temperature);
  const result = await client.analyzePaper(paper.title, paper.abstract_text, topicNames, signal);

  doSaveSummary(db, paperId, result.analysis);
  return { success: true, summary: result.analysis, skipped: false };
}

export async function summarizeAllUnanalyzed(db: SqlJsDatabase, mainWindow: BrowserWindow, onPaperDone?: () => Promise<void>): Promise<{
  success: boolean;
  total?: number;
  analyzed?: number;
  errors?: number;
  stopped?: boolean;
  message?: string;
}> {
  if (summaryRunning) {
    return { success: false, message: '分析任务正在进行中，请等待完成后再试' };
  }

  summaryRunning = true;
  summaryCancelRequested = false;

  try {
    const topicRows = db.exec('SELECT id, name, keywords, enabled FROM topics WHERE enabled = TRUE');
    const topics = topicRows.length > 0
      ? topicRows[0].values.map(row => ({
        id: row[0] as number,
        name: row[1] as string,
        keywords: JSON.parse(row[2] as string),
        enabled: Boolean(row[3]),
      }))
      : [];

    if (topics.length === 0) {
      return { success: true, analyzed: 0, message: 'No topics configured, skip analysis' };
    }

    rebuildPaperTopics(db);

    const llmConfig = loadLLMConfig(db);
    const topicNames = topics.map(t => t.name);

    const paperResults = db.exec(
      `SELECT p.id, p.title, p.abstract_text, a.summary
       FROM papers p
       LEFT JOIN analyses a ON p.id = a.paper_id
       WHERE (a.summary IS NULL OR a.summary = '' OR a.summary LIKE 'SUMMARY_FAILED:%')
         AND p.relevance_topics IS NOT NULL AND p.relevance_topics != 'null'
       ORDER BY p.published_date DESC`,
    );
    if (paperResults.length === 0) {
      return { success: true, analyzed: 0, message: 'No unanalyzed papers found' };
    }
    const papers = paperResults[0].values.map(row => ({
      id: row[0] as string,
      title: row[1] as string,
      abstract_text: row[2] as string,
    }));
    const total = papers.length;

    if (total === 0) {
      return { success: true, analyzed: 0, message: 'No unanalyzed papers matched configured topics' };
    }

    mainWindow.webContents.send('summary-progress', {
      current: 0, total, title: '', status: 'analyzing', error: null,
    });

    const client = new LLMClient(llmConfig.api_key, llmConfig.model, llmConfig.base_url, llmConfig.temperature);
    let analyzed = 0;
    let errors = 0;

    for (let idx = 0; idx < papers.length; idx++) {
      if (summaryCancelRequested) {
        const displayTitle = truncateTitle(papers[idx].title);
        mainWindow.webContents.send('summary-progress', {
          current: idx, total, title: displayTitle, status: 'stopped', error: null,
        });
        return { success: true, total, analyzed, errors, stopped: true };
      }

      const paper = papers[idx];
      const displayTitle = truncateTitle(paper.title);

      mainWindow.webContents.send('summary-progress', {
        current: idx + 1, total, title: displayTitle, status: 'analyzing', error: null,
      });

      try {
        const result = await client.analyzePaper(paper.title, paper.abstract_text, topicNames);
        doSaveSummary(db, paper.id, result.analysis);
        analyzed += 1;
        await onPaperDone?.();
        mainWindow.webContents.send('summary-progress', {
          current: idx + 1, total, title: displayTitle, status: 'done', error: null,
        });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        try {
          doSaveSummary(db, paper.id, `SUMMARY_FAILED: ${errMsg}`);
        } catch { /* ignore */ }
        errors += 1;
        await onPaperDone?.();
        mainWindow.webContents.send('summary-progress', {
          current: idx + 1, total, title: displayTitle, status: 'error', error: errMsg,
        });
      }

      await new Promise(r => setTimeout(r, 0));
    }

    return { success: true, total, analyzed, errors };
  } finally {
    summaryRunning = false;
  }
}

export function getUnanalyzedPapers(db: SqlJsDatabase): { id: string; title: string }[] {
  const results = db.exec(
    `SELECT p.id, p.title
     FROM papers p
     LEFT JOIN analyses a ON p.id = a.paper_id
     WHERE (a.summary IS NULL OR a.summary = '' OR a.summary LIKE 'SUMMARY_FAILED:%')
       AND p.relevance_topics IS NOT NULL AND p.relevance_topics != 'null'
     ORDER BY p.published_date DESC`,
  );
  if (results.length === 0) return [];
  return results[0].values.map(row => ({ id: row[0] as string, title: row[1] as string }));
}

export async function testLLMConnection(db: SqlJsDatabase): Promise<{
  success: boolean;
  message: string;
}> {
  const llmConfig = loadLLMConfig(db);
  const client = new LLMClient(llmConfig.api_key, llmConfig.model, llmConfig.base_url, llmConfig.temperature);
  const result = await client.testConnection();
  return {
    success: true,
    message: `${result} (model=${llmConfig.model}, temp=${llmConfig.temperature})`,
  };
}

function truncateTitle(title: string): string {
  if (title.length <= 60) return title;
  return `${Array.from(title).slice(0, 60).join('')}...`;
}
