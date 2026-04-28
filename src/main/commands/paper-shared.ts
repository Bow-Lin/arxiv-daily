import type { PaperWithAnalysis } from './paper';

export const BASE_SQL = `SELECT
    p.id, p.title, p.authors, p.abstract_text, p.url, p.pdf_url,
    p.published_date, p.updated_date, p.categories, p.fetched_at,
    p.relevance_topics,
    a.summary,
    a.analysis
FROM papers p
LEFT JOIN analyses a ON p.id = a.paper_id`;

export function rowToPaper(row: Record<string, unknown>): PaperWithAnalysis {
  return {
    ...row,
    authors: JSON.parse(row.authors as string),
    categories: JSON.parse(row.categories as string),
    relevance_topics: row.relevance_topics ? JSON.parse(row.relevance_topics as string) : null,
  } as PaperWithAnalysis;
}

export function execResultToPaperRows(results: { columns: string[]; values: unknown[][] }): Record<string, unknown>[] {
  return results.values.map(row => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < results.columns.length; i++) {
      obj[results.columns[i]] = row[i];
    }
    return obj;
  });
}
