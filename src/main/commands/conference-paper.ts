import type { Database as SqlJsDatabase } from 'sql.js';

export interface ConferencePaper {
  id: string;
  conference_id: number;
  short_name: string;
  year: number;
  full_name: string;
  title: string;
  authors: string[];
  abstract: string;
  pdf_url: string | null;
  supp_url: string | null;
  arxiv_url: string | null;
  bibtex: string | null;
  pages: string | null;
  track: string | null;
  detail_url: string | null;
  summary: string | null;
  analysis: string | null;
}

export interface ConferenceInfo {
  id: number;
  short_name: string;
  year: number;
  full_name: string;
  paper_count: number;
}

export interface ConferencePaginatedResult {
  items: ConferencePaper[];
  total: number;
  page: number;
  page_size: number;
}

export interface TrackCount {
  track: string;
  count: number;
}

const PAPER_SQL = `SELECT
    p.id, p.conference_id, p.title, p.authors, p.abstract,
    p.pdf_url, p.supp_url, p.arxiv_url, p.bibtex, p.pages, p.track, p.detail_url,
    c.short_name, c.year, c.full_name
FROM papers p
JOIN conferences c ON p.conference_id = c.id`;

function parseJson(text: string): unknown {
  if (!text) return text;
  return JSON.parse(text);
}

function rowToConferencePaper(row: Record<string, unknown>, analysesMap: Map<string, { summary: string | null; analysis: string | null }>): ConferencePaper {
  const a = analysesMap.get(row.id as string);
  return {
    id: row.id as string,
    conference_id: row.conference_id as number,
    short_name: row.short_name as string,
    year: row.year as number,
    full_name: row.full_name as string ?? '',
    title: row.title as string,
    authors: parseJson(row.authors as string) as string[],
    abstract: row.abstract as string ?? '',
    pdf_url: row.pdf_url as string | null,
    supp_url: row.supp_url as string | null,
    arxiv_url: row.arxiv_url as string | null,
    bibtex: row.bibtex as string | null,
    pages: row.pages as string | null,
    track: row.track as string | null,
    detail_url: row.detail_url as string | null,
    summary: a?.summary ?? null,
    analysis: a?.analysis ?? null,
  };
}

function execToRows(results: { columns: string[]; values: unknown[][] }): Record<string, unknown>[] {
  return results.values.map(row => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < results.columns.length; i++) {
      obj[results.columns[i]] = row[i];
    }
    return obj;
  });
}

function loadAnalysesMap(analysesDb: SqlJsDatabase, paperIds: string[]): Map<string, { summary: string | null; analysis: string | null }> {
  const map = new Map<string, { summary: string | null; analysis: string | null }>();
  if (paperIds.length === 0) return map;
  const placeholders = paperIds.map(() => '?').join(',');
  const results = analysesDb.exec(
    `SELECT paper_id, summary, analysis FROM analyses WHERE paper_id IN (${placeholders})`,
    paperIds,
  );
  if (results.length === 0) return map;
  for (const row of results[0].values) {
    map.set(row[0] as string, {
      summary: row[1] as string || null,
      analysis: row[2] as string || null,
    });
  }
  return map;
}

export function listConferences(conferenceDb: SqlJsDatabase): ConferenceInfo[] {
  const results = conferenceDb.exec(
    `SELECT c.id, c.short_name, c.year, c.full_name, COUNT(p.id) as paper_count
     FROM conferences c
     LEFT JOIN papers p ON c.id = p.conference_id
     GROUP BY c.id
     ORDER BY c.year DESC, c.short_name`,
  );
  if (results.length === 0) return [];
  return results[0].values.map(row => ({
    id: row[0] as number,
    short_name: row[1] as string,
    year: row[2] as number,
    full_name: (row[3] as string) ?? '',
    paper_count: row[4] as number,
  }));
}

export function listConferencePapers(
  conferenceDb: SqlJsDatabase,
  analysesDb: SqlJsDatabase,
  arxivDb: SqlJsDatabase | null,
  paperTopicsDb: SqlJsDatabase | null,
  params: {
    conferenceId?: number | null;
    search?: string;
    tracks?: string[];
    topicIds?: number[];
    page?: number;
    pageSize?: number;
  },
): ConferencePaginatedResult {
  const page = Math.max(params.page ?? 1, 1);
  const pageSize = Math.min(Math.max(params.pageSize ?? 20, 1), 100);
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const bindValues: unknown[] = [];

  if (params.conferenceId) {
    conditions.push('p.conference_id = ?');
    bindValues.push(params.conferenceId);
  }
  if (params.search) {
    const escaped = params.search.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    const pattern = `%${escaped}%`;
    conditions.push("(p.title LIKE ? ESCAPE '\\' OR p.abstract LIKE ? ESCAPE '\\')");
    bindValues.push(pattern, pattern);
  }
  if (params.tracks && params.tracks.length > 0) {
    const placeholders = params.tracks.map(() => '?').join(',');
    conditions.push(`p.track IN (${placeholders})`);
    bindValues.push(...params.tracks);
  }
  if (params.topicIds && params.topicIds.length > 0 && paperTopicsDb) {
    const placeholders = params.topicIds.map(() => '?').join(',');
    const ptResults = paperTopicsDb.exec(
      `SELECT DISTINCT paper_id FROM conference_paper_topics WHERE topic_id IN (${placeholders})`,
      params.topicIds,
    );
    if (ptResults.length > 0 && ptResults[0].values.length > 0) {
      const paperIds = ptResults[0].values.map(r => r[0] as string);
      conditions.push(`p.id IN (${paperIds.map(() => '?').join(',')})`);
      bindValues.push(...paperIds);
    } else {
      conditions.push('1 = 0');
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count
  const countResults = conferenceDb.exec(`SELECT COUNT(*) FROM papers p ${whereClause}`, bindValues);
  const total = countResults[0]?.values[0]?.[0] ?? 0;

  // Fetch
  const dataSql = `${PAPER_SQL} ${whereClause} ORDER BY p.id ASC LIMIT ? OFFSET ?`;
  const dataResults = conferenceDb.exec(dataSql, [...bindValues, pageSize, offset]);

  let items: ConferencePaper[] = [];
  if (dataResults.length > 0 && dataResults[0].values.length > 0) {
    const rows = execToRows(dataResults[0]);
    const paperIds = rows.map(r => r.id as string);
    const analysesMap = loadAnalysesMap(analysesDb, paperIds);
    items = rows.map(row => rowToConferencePaper(row, analysesMap));
  }

  return { items, total: total as number, page, page_size: pageSize };
}

export function getConferencePaperDetail(
  conferenceDb: SqlJsDatabase,
  analysesDb: SqlJsDatabase,
  paperId: string,
): ConferencePaper {
  const results = conferenceDb.exec(`${PAPER_SQL} WHERE p.id = ?`, [paperId]);
  if (results.length === 0 || results[0].values.length === 0) {
    throw new Error(`Conference paper ${paperId} not found`);
  }
  const row = execToRows(results[0])[0];
  const analysesMap = loadAnalysesMap(analysesDb, [paperId]);
  return rowToConferencePaper(row, analysesMap);
}

export function listConferenceTracks(
  conferenceDb: SqlJsDatabase,
  conferenceId: number,
): TrackCount[] {
  const results = conferenceDb.exec(
    `SELECT track, COUNT(*) as cnt
     FROM papers
     WHERE conference_id = ? AND track IS NOT NULL AND track != ''
     GROUP BY track
     ORDER BY cnt DESC`,
    [conferenceId],
  );
  if (results.length === 0) return [];
  return results[0].values.map(row => ({
    track: row[0] as string,
    count: row[1] as number,
  }));
}

export function getConferencePaperPdfUrl(conferenceDb: SqlJsDatabase, paperId: string): string | null {
  const results = conferenceDb.exec('SELECT pdf_url FROM papers WHERE id = ?', [paperId]);
  if (results.length === 0 || results[0].values.length === 0) return null;
  return results[0].values[0][0] as string || null;
}
