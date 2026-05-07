import type { Database as SqlJsDatabase } from 'sql.js';
import { fetchFromApi, savePapers, todayStr, daysAgoStr } from '../services/arxiv-api';
import { refreshAllPaperTopics, loadProxyConfig } from './config';

export interface FetchPapersResult {
  success: boolean;
  new_count: number;
  existing_count: number;
  failed_categories: string[];
}

export interface FetchPapersByDateParams {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  categories?: string[];
}

export interface FetchPapersByDateResult {
  success: boolean;
  local_count: number;
  new_count: number;
  total_count: number;
  failed_categories: string[];
  error?: string;
}

// ── Internal shared logic ─────────────────────────────────────

async function fetchPapersInRange(
  db: SqlJsDatabase,
  startDate: string,
  endDate: string,
  categories: string[],
): Promise<{ new_count: number; total_count: number; failed_categories: string[] }> {
  let totalNew = 0;
  const failed: string[] = [];
  const allApiIds = new Set<string>();
  const proxyConfig = loadProxyConfig(db);

  for (const category of categories) {
    try {
      const papers = await fetchFromApi(category, startDate, endDate, proxyConfig);
      for (const p of papers) {
        allApiIds.add(p.arxiv_id);
      }
      const [inserted] = savePapers(db, papers);
      totalNew += inserted;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error(`[fetch] Failed for ${category}:`, errMsg);
      failed.push(category);
    }
  }

  // Refresh topic matching for all papers
  try {
    refreshAllPaperTopics(db);
  } catch (e) {
    console.error('[fetch] Failed to refresh topics:', e);
  }

  return { new_count: totalNew, total_count: allApiIds.size, failed_categories: failed };
}

function resolveCategories(db: SqlJsDatabase, categories: string[]): string[] {
  if (categories.length > 0) return categories;
  const rows = db.exec('SELECT name FROM categories WHERE enabled = TRUE');
  if (rows.length === 0) return [];
  return rows[0].values.map(row => row[0] as string);
}

// ── Public commands ───────────────────────────────────────────

/**
 * Fetch latest papers (yesterday + today) via arXiv API.
 */
export async function fetchPapers(db: SqlJsDatabase, categories: string[]): Promise<FetchPapersResult> {
  const cats = resolveCategories(db, categories);
  if (cats.length === 0) {
    return { success: false, new_count: 0, existing_count: 0, failed_categories: [] };
  }

  const startDate = daysAgoStr(1);
  const endDate = todayStr();
  const { new_count, total_count, failed_categories } = await fetchPapersInRange(db, startDate, endDate, cats);

  return {
    success: true,
    new_count: new_count,
    existing_count: total_count - new_count,
    failed_categories: failed_categories,
  };
}

/**
 * Fetch this week's papers via arXiv API (last 7 days including today).
 */
export async function fetchPapersThisWeek(db: SqlJsDatabase, categories: string[]): Promise<FetchPapersResult> {
  const cats = resolveCategories(db, categories);
  if (cats.length === 0) {
    return { success: false, new_count: 0, existing_count: 0, failed_categories: [] };
  }

  const startDate = daysAgoStr(6);
  const endDate = todayStr();
  const { new_count, total_count, failed_categories } = await fetchPapersInRange(db, startDate, endDate, cats);

  return {
    success: true,
    new_count: new_count,
    existing_count: total_count - new_count,
    failed_categories: failed_categories,
  };
}

/**
 * Fetch papers for a specific date range via arXiv API.
 */
export async function fetchPapersByDate(
  db: SqlJsDatabase,
  params: FetchPapersByDateParams,
): Promise<FetchPapersByDateResult> {
  const { startDate, endDate } = params;
  const cats = params.categories || [];

  if (cats.length === 0) {
    return { success: false, local_count: 0, new_count: 0, total_count: 0, failed_categories: [] };
  }

  const { new_count, total_count, failed_categories } = await fetchPapersInRange(db, startDate, endDate, cats);

  return {
    success: true,
    local_count: Math.max(0, total_count - new_count),
    new_count,
    total_count,
    failed_categories: failed_categories,
  };
}
