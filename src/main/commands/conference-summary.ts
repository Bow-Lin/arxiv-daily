import type { Database as SqlJsDatabase } from 'sql.js';
import { LLMClient } from '../services/llm-client';
import { loadLLMConfig } from './config';

let summaryAbortController: AbortController | null = null;

export function stopConferenceSummary(): { success: boolean } {
  if (summaryAbortController) {
    summaryAbortController.abort();
    summaryAbortController = null;
  }
  return { success: true };
}

export function setConferenceSummaryAbortController(controller: AbortController | null): void {
  summaryAbortController = controller;
}

export async function summarizeConferencePaper(
  conferenceDb: SqlJsDatabase,
  analysesDb: SqlJsDatabase,
  settingsDb: SqlJsDatabase,
  paperId: string,
  skipIfAnalyzed = true,
  signal?: AbortSignal,
): Promise<{ success: boolean; summary?: string | null; skipped: boolean }> {
  // Read paper from conference DB
  const results = conferenceDb.exec(
    'SELECT id, title, abstract FROM papers WHERE id = ?',
    [paperId],
  );
  if (results.length === 0 || results[0].values.length === 0) {
    throw new Error(`Conference paper ${paperId} not found`);
  }
  const row = results[0].values[0];
  const title = row[1] as string;
  const abstractText = row[2] as string;

  // Check existing summary
  if (skipIfAnalyzed) {
    const existing = analysesDb.exec('SELECT summary FROM analyses WHERE paper_id = ?', [paperId]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      const summary = existing[0].values[0][0] as string;
      if (summary && summary.length > 0 && !summary.startsWith('SUMMARY_FAILED:')) {
        return { success: true, summary, skipped: true };
      }
    }
  }

  // Load LLM config from settings DB (shared config)
  const llmConfig = loadLLMConfig(settingsDb);
  const client = new LLMClient(llmConfig.api_key, llmConfig.model, llmConfig.base_url, llmConfig.temperature);
  const result = await client.analyzePaper(title, abstractText, [], signal);

  // Save to analyses DB
  analysesDb.run(
    `INSERT INTO analyses (paper_id, summary)
     VALUES (?, ?)
     ON CONFLICT(paper_id) DO UPDATE SET summary = excluded.summary`,
    [paperId, result.analysis],
  );

  return { success: true, summary: result.analysis, skipped: false };
}

export function getUnsummarizedConferencePapers(
  conferenceDb: SqlJsDatabase,
  analysesDb: SqlJsDatabase,
): { id: string; title: string }[] {
  // Get paper IDs that have summaries
  const summarizedResults = analysesDb.exec('SELECT paper_id FROM analyses WHERE summary IS NOT NULL AND summary != \'\' AND summary NOT LIKE \'SUMMARY_FAILED:%\'');
  const summarizedIds = new Set<string>();
  if (summarizedResults.length > 0) {
    for (const row of summarizedResults[0].values) {
      summarizedIds.add(row[0] as string);
    }
  }

  const papersResults = conferenceDb.exec(
    'SELECT id, title FROM papers WHERE abstract IS NOT NULL AND abstract != \'\' ORDER BY id ASC',
  );
  if (papersResults.length === 0) return [];

  return papersResults[0].values
    .filter(row => !summarizedIds.has(row[0] as string))
    .map(row => ({ id: row[0] as string, title: row[1] as string }));
}
