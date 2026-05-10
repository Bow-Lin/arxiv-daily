import type { Database as SqlJsDatabase } from 'sql.js';
import type { DeepAnalysisResult } from './llm-client';
import { LLMClient } from './llm-client';
import { extractTextFromUrl } from './pdf-extractor';
import { loadLLMConfig } from '../commands/config';

export type ProgressCallback = (phase: string) => void;

export async function analyzeFullPaper(
  db: SqlJsDatabase,
  settingsDb: SqlJsDatabase,
  paperId: string,
  signal?: AbortSignal,
  dataDir?: string,
  onProgress?: ProgressCallback,
): Promise<{ success: boolean; result?: DeepAnalysisResult }> {
  const results = db.exec('SELECT title, pdf_url FROM papers WHERE id = ?', [paperId]);
  if (results.length === 0 || results[0].values.length === 0) {
    throw new Error(`Paper ${paperId} not found`);
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

  db.run(
    `INSERT INTO analyses (paper_id, analysis)
     VALUES (?, ?)
     ON CONFLICT(paper_id) DO UPDATE SET
        analysis = excluded.analysis`,
    [paperId, analysisResult.analysis],
  );

  return { success: true, result: analysisResult };
}

export function getPaperAnalysis(
  db: SqlJsDatabase,
  paperId: string,
): string | null {
  const results = db.exec('SELECT analysis FROM analyses WHERE paper_id = ?', [paperId]);
  if (results.length === 0 || results[0].values.length === 0) return null;
  return results[0].values[0][0] as string;
}

export function getUnanalyzedPapers(db: SqlJsDatabase): { id: string; title: string }[] {
  const results = db.exec(
    `SELECT p.id, p.title
     FROM papers p
     LEFT JOIN analyses a ON p.id = a.paper_id
     WHERE (a.analysis IS NULL OR a.analysis = '')
       AND p.pdf_url IS NOT NULL AND p.pdf_url != ''
     ORDER BY p.published_date DESC`,
  );
  if (results.length === 0) return [];
  return results[0].values.map(row => ({ id: row[0] as string, title: row[1] as string }));
}
