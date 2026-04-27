import type { Database as SqlJsDatabase } from 'sql.js';
import { proxyFetch } from './proxy-agent';
import type { ProxyConfig } from '../commands/config';

// ── Shared types ──────────────────────────────────────────────

export interface RawPaper {
  arxiv_id: string;
  title: string;
  authors: string[];
  abstract_text: string;
  url: string;
  pdf_url: string;
  published_date: string;
  updated_date: string;
  categories: string[];
}

// ── Date helpers ──────────────────────────────────────────────

/** Format a Date as YYYY-MM-DD using local system date. */
function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Get today's date string (YYYY-MM-DD). */
export function todayStr(): string {
  return toDateString(new Date());
}

/** Get date string for N days ago (YYYY-MM-DD). */
export function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateString(d);
}

// ── Database helpers ──────────────────────────────────────────

export function savePapers(db: SqlJsDatabase, papers: RawPaper[]): [number, number] {
  const fetchedDate = todayStr();
  let inserted = 0;
  for (const paper of papers) {
    const authorsJson = JSON.stringify(paper.authors);
    const categoriesJson = JSON.stringify(paper.categories);
    db.run(
      `INSERT INTO papers (id, title, authors, abstract_text, url, pdf_url, published_date, updated_date, categories, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`,
      [paper.arxiv_id, paper.title, authorsJson, paper.abstract_text, paper.url, paper.pdf_url, paper.published_date, paper.updated_date, categoriesJson, fetchedDate],
    );
    if (db.getRowsModified() > 0) {
      inserted++;
    }
  }
  return [inserted, papers.length - inserted];
}

// ── arXiv API ─────────────────────────────────────────────────

const ARXIV_API_BASE = 'https://export.arxiv.org/api/query';
const MAX_PER_PAGE = 200;

function parseArxivId(entryUri: string): string {
  const match = entryUri.match(/(\d{4}\.\d+(?:v\d+)?)/);
  return match ? match[1] : '';
}

export async function fetchFromApi(
  category: string,
  startDate: string,
  endDate: string,
  proxyConfig?: ProxyConfig,
): Promise<RawPaper[]> {
  const allPapers: RawPaper[] = [];
  const seenIds = new Set<string>();
  let start = 0;
  const startCompact = startDate.replace(/-/g, '');
  const endCompact = endDate.replace(/-/g, '');
  const searchQuery = `cat:${category} AND submittedDate:[${startCompact}000000 TO ${endCompact}235959]`;

  while (true) {
    const url = `${ARXIV_API_BASE}?search_query=${encodeURIComponent(searchQuery)}&start=${start}&max_results=${MAX_PER_PAGE}`;
    console.log(`Fetching arXiv API: ${url}`);

    const { body, statusCode } = await proxyFetch(url, {
      headers: { 'User-Agent': 'ArxivDailyGUI/1.0' },
      signal: AbortSignal.timeout(60000),
    }, proxyConfig);

    if (statusCode !== 200) {
      throw new Error(`arXiv API returned ${statusCode}`);
    }

    const xml = body.toString('utf-8');
    const entries = parseAtomXml(xml);
    if (entries.length === 0) break;

    for (const entry of entries) {
      if (!entry || seenIds.has(entry.arxiv_id)) continue;
      seenIds.add(entry.arxiv_id);
      allPapers.push(entry);
    }

    console.log(`  Page ${Math.floor(start / MAX_PER_PAGE) + 1}: ${entries.length} entries, total unique: ${allPapers.length}`);

    if (entries.length < MAX_PER_PAGE) break;
    start += MAX_PER_PAGE;
  }

  return allPapers;
}

function parseAtomXml(xml: string): RawPaper[] {
  const entries: RawPaper[] = [];
  const parts = xml.split(/<entry>/).slice(1);
  for (const part of parts) {
    const entryXml = part.split(/<\/entry>/)[0];
    const entry = parseEntryFromXml(entryXml);
    if (entry) entries.push(entry);
  }
  return entries;
}

function parseEntryFromXml(xml: string): RawPaper | null {
  const getText = (tag: string): string => {
    const match = xml.match(new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`));
    return match ? match[1].trim().replace(/\s+/g, ' ') : '';
  };

  const idMatch = xml.match(/<id>\s*(https?:\/\/arxiv\.org\/abs\/\d+\.\d+(?:v\d+)?)\s*<\/id>/);
  const arxivId = idMatch ? parseArxivId(idMatch[1]) : '';
  if (!arxivId) return null;

  const title = getText('title');
  const summary = getText('summary');
  const published = getText('published') || new Date().toISOString();
  const updated = getText('updated') || published;

  // Parse authors
  const authors: string[] = [];
  const authorParts = xml.split(/<author>/).slice(1);
  for (const ap of authorParts) {
    const authorXml = ap.split(/<\/author>/)[0];
    const nameMatch = authorXml.match(/<name>([\s\S]*?)<\/name>/);
    if (nameMatch) {
      const name = nameMatch[1].trim().replace(/\s+/g, ' ');
      if (name && name !== ':') authors.push(name);
    }
  }

  // Parse categories
  const categories: string[] = [];
  const catRegex = /<category\s+term="([^"]+)"/g;
  let catMatch;
  while ((catMatch = catRegex.exec(xml)) !== null) {
    categories.push(catMatch[1]);
  }

  // Parse links
  let url = '';
  let pdfUrl = '';
  const linkParts = xml.split(/<link/).slice(1);
  for (const lp of linkParts) {
    const linkXml = lp.split(/\/>/)[0] + '/>';
    const hrefMatch = linkXml.match(/href="([^"]*)"/);
    const typeMatch = linkXml.match(/type="([^"]*)"/);
    const href = hrefMatch ? hrefMatch[1] : '';
    const type = typeMatch ? typeMatch[1] : '';

    if (href.includes('/abs/') && !url) url = href;
    if (href.includes('/pdf/') && !pdfUrl) pdfUrl = href;
    if (type.includes('application/pdf') && !pdfUrl) pdfUrl = href;
  }

  if (!url) url = `https://arxiv.org/abs/${arxivId}`;
  if (!pdfUrl) pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;

  return {
    arxiv_id: arxivId,
    title,
    authors,
    abstract_text: summary,
    url,
    pdf_url: pdfUrl,
    published_date: published,
    updated_date: updated,
    categories: categories.length > 0 ? categories : [],
  };
}
