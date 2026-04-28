import type { Database as SqlJsDatabase } from 'sql.js';

export interface PaperWithAnalysis {
  id: string;
  title: string;
  authors: string[];
  abstract_text: string;
  url: string;
  pdf_url: string;
  published_date: string;
  updated_date: string;
  categories: string[];
  fetched_at: string;
  relevance_topics: string[] | null;
  summary: string | null;
  analysis: string | null;
}

export interface PaginatedResult {
  items: PaperWithAnalysis[];
  total: number;
  page: number;
  page_size: number;
}

export interface FetchDate {
  date: string;
  display: string;
  count: number;
}

export interface TopicCount {
  topic_id: number;
  name: string;
  count: number;
}

import { BASE_SQL, rowToPaper, execResultToPaperRows } from './paper-shared';

/**
 * List papers with pagination and filtering.
 */
export function listPapers(db: SqlJsDatabase, params: {
  topicId?: number;
  search?: string;
  fetchDate?: string;
  page?: number;
  pageSize?: number;
}): PaginatedResult {
  const page = Math.max(params.page ?? 1, 1);
  const pageSize = Math.min(Math.max(params.pageSize ?? 20, 1), 100);
  const offset = (page - 1) * pageSize;

  // Get topic name if filtering by topic
  let topicName: string | null = null;
  if (params.topicId != null) {
    const rows = db.exec('SELECT name FROM topics WHERE id = ?', [params.topicId]);
    if (rows.length > 0 && rows[0].values.length > 0) {
      topicName = rows[0].values[0][0] as string;
    }
  }

  // Build WHERE clauses dynamically
  const conditions: string[] = [];
  const bindValues: unknown[] = [];

  if (params.search) {
    const escaped = params.search.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    const pattern = `%${escaped}%`;
    conditions.push("(p.title LIKE ? ESCAPE '\\' OR p.abstract_text LIKE ? ESCAPE '\\')");
    bindValues.push(pattern, pattern);
  }
  if (params.fetchDate) {
    conditions.push('date(p.updated_date) = ?');
    bindValues.push(params.fetchDate);
  }
  if (topicName) {
    conditions.push('EXISTS (SELECT 1 FROM json_each(p.relevance_topics) WHERE value = ?)');
    bindValues.push(topicName);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total
  const countSql = `SELECT COUNT(*) FROM papers p LEFT JOIN analyses a ON p.id = a.paper_id ${whereClause}`;
  const countResults = db.exec(countSql, bindValues);
  const total = countResults[0]?.values[0]?.[0] ?? 0;

  // Fetch data
  const dataSql = `${BASE_SQL} ${whereClause} ORDER BY p.updated_date DESC LIMIT ? OFFSET ?`;
  const dataResults = db.exec(dataSql, [...bindValues, pageSize, offset]);
  const items = dataResults.length > 0
    ? execResultToPaperRows(dataResults[0]).map(rowToPaper)
    : [];

  return { items, total: total as number, page, page_size: pageSize };
}

/**
 * Get a single paper's full details.
 */
export function getPaperDetail(db: SqlJsDatabase, paperId: string): PaperWithAnalysis {
  const sql = `${BASE_SQL} WHERE p.id = ?`;
  const results = db.exec(sql, [paperId]);
  if (results.length === 0 || results[0].values.length === 0) {
    throw new Error(`Paper ${paperId} not found`);
  }
  return rowToPaper(execResultToPaperRows(results[0])[0]);
}

/**
 * Format a date string as "YYYY年M月D日" for display.
 * dateStr is date-only (YYYY-MM-DD).
 */
function formatDateDisplay(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[0]}年${Number(parts[1])}月${Number(parts[2])}日`;
}

/**
 * List all distinct publish dates with paper counts.
 */
export function listFetchDates(db: SqlJsDatabase): FetchDate[] {
  const results = db.exec(
    `SELECT date(updated_date) as pub_date, COUNT(*) as cnt
     FROM papers
     WHERE published_date IS NOT NULL
     GROUP BY pub_date
     ORDER BY pub_date DESC`,
  );
  if (results.length === 0) return [];
  return results[0].values
    .filter(row => {
      const dateStr = row[0] as string;
      return dateStr && dateStr.length > 0;
    })
    .map(row => ({
      date: row[0] as string,
      display: formatDateDisplay(row[0] as string),
      count: row[1] as number,
    }));
}

/**
 * Count papers per topic using json_each for exact matching.
 */
export function listTopicCounts(db: SqlJsDatabase): TopicCount[] {
  const results = db.exec(
    `SELECT t.id, t.name, COUNT(p.id) as cnt
     FROM topics t
     LEFT JOIN papers p ON EXISTS (
         SELECT 1 FROM json_each(p.relevance_topics) WHERE value = t.name
     )
     GROUP BY t.id, t.name
     ORDER BY cnt DESC`,
  );
  if (results.length === 0) return [];
  return results[0].values.map(row => ({
    topic_id: row[0] as number,
    name: row[1] as string,
    count: row[2] as number,
  }));
}
