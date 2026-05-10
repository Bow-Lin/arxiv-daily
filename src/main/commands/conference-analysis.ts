import type { Database as SqlJsDatabase } from 'sql.js';
import type { DeepAnalysisResult } from '../services/llm-client';
import { LLMClient } from '../services/llm-client';
import { extractTextFromUrl } from '../services/pdf-extractor';
import { loadLLMConfig } from './config';

let analysisAbortController: AbortController | null = null;

export function stopConferenceAnalysis(): { success: boolean } {
  if (analysisAbortController) {
    analysisAbortController.abort();
    analysisAbortController = null;
  }
  return { success: true };
}

export function setConferenceAnalysisAbortController(controller: AbortController | null): void {
  analysisAbortController = controller;
}

export type ProgressCallback = (phase: string) => void;

export async function analyzeConferenceFullPaper(
  conferenceDb: SqlJsDatabase,
  analysesDb: SqlJsDatabase,
  settingsDb: SqlJsDatabase,
  paperId: string,
  signal?: AbortSignal,
  dataDir?: string,
  onProgress?: ProgressCallback,
): Promise<{ success: boolean; result?: DeepAnalysisResult }> {
  // Read paper from conference DB
  const results = conferenceDb.exec('SELECT title, pdf_url FROM papers WHERE id = ?', [paperId]);
  if (results.length === 0 || results[0].values.length === 0) {
    throw new Error(`Conference paper ${paperId} not found`);
  }
  const title = results[0].values[0][0] as string;
  const pdfUrl = results[0].values[0][1] as string;

  if (!pdfUrl) {
    throw new Error(`Paper ${paperId} has no PDF URL`);
  }

  const fullText = await extractTextFromUrl(pdfUrl, signal, dataDir, onProgress);

  if (!fullText.trim()) {
    throw new Error('Failed to extract text from PDF');
  }

  onProgress?.('分析中');
  const llmConfig = loadLLMConfig(settingsDb);
  const client = new LLMClient(llmConfig.api_key, llmConfig.model, llmConfig.base_url, llmConfig.temperature);
  const analysisResult = await client.analyzeFullPaper(title, fullText, signal);

  // Save to analyses DB
  analysesDb.run(
    `INSERT INTO analyses (paper_id, analysis)
     VALUES (?, ?)
     ON CONFLICT(paper_id) DO UPDATE SET analysis = excluded.analysis`,
    [paperId, analysisResult.analysis],
  );

  return { success: true, result: analysisResult };
}

export function getConferencePaperAnalysis(
  analysesDb: SqlJsDatabase,
  paperId: string,
): string | null {
  const results = analysesDb.exec('SELECT analysis FROM analyses WHERE paper_id = ?', [paperId]);
  if (results.length === 0 || results[0].values.length === 0) return null;
  return results[0].values[0][0] as string || null;
}

export function getUnanalyzedConferencePapers(
  conferenceDb: SqlJsDatabase,
  analysesDb: SqlJsDatabase,
): { id: string; title: string }[] {
  // Get paper IDs that have analyses
  const analyzedResults = analysesDb.exec('SELECT paper_id FROM analyses WHERE analysis IS NOT NULL AND analysis != \'\'');
  const analyzedIds = new Set<string>();
  if (analyzedResults.length > 0) {
    for (const row of analyzedResults[0].values) {
      analyzedIds.add(row[0] as string);
    }
  }

  const papersResults = conferenceDb.exec(
    'SELECT id, title FROM papers WHERE pdf_url IS NOT NULL AND pdf_url != \'\' ORDER BY id ASC',
  );
  if (papersResults.length === 0) return [];

  return papersResults[0].values
    .filter(row => !analyzedIds.has(row[0] as string))
    .map(row => ({ id: row[0] as string, title: row[1] as string }));
}
