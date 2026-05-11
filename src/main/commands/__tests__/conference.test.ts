import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import initSqlJs from 'sql.js';
import {
  listConferences, listConferencePapers, getConferencePaperDetail,
  listConferenceTracks, getConferencePaperPdfUrl,
} from '../conference-paper';
import {
  stopConferenceSummary,
} from '../conference-summary';
import {
  stopConferenceAnalysis,
} from '../conference-analysis';

function createDb() {
  return new (globalThis as any).__testSQL.Database();
}

function setupConferenceDb(): ReturnType<typeof createDb> {
  const db = createDb();
  db.run(`CREATE TABLE IF NOT EXISTS conferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    short_name TEXT NOT NULL,
    year INTEGER NOT NULL,
    full_name TEXT NOT NULL DEFAULT ''
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS papers (
    id TEXT PRIMARY KEY,
    conference_id INTEGER NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    authors TEXT NOT NULL DEFAULT '[]',
    abstract TEXT NOT NULL DEFAULT '',
    pdf_url TEXT,
    supp_url TEXT,
    arxiv_url TEXT,
    bibtex TEXT,
    pages TEXT,
    track TEXT,
    detail_url TEXT
  )`);
  return db;
}

function setupAnalysesDb(): ReturnType<typeof createDb> {
  const db = createDb();
  db.run(`CREATE TABLE IF NOT EXISTS analyses (
    paper_id TEXT PRIMARY KEY,
    summary TEXT DEFAULT '',
    analysis TEXT DEFAULT ''
  )`);
  return db;
}

beforeAll(async () => {
  const SQL = await initSqlJs();
  (globalThis as any).__testSQL = SQL;
});

describe('conference-paper commands', () => {
  let confDb: ReturnType<typeof createDb>;
  let analysesDb: ReturnType<typeof createDb>;

  beforeEach(() => {
    confDb = setupConferenceDb();
    analysesDb = setupAnalysesDb();
  });

  afterEach(() => {
    confDb.close();
    analysesDb.close();
  });

  describe('listConferences', () => {
    it('returns empty array for no conferences', () => {
      expect(listConferences(confDb)).toEqual([]);
    });

    it('lists conferences with paper counts', () => {
      confDb.run("INSERT INTO conferences VALUES (1, 'CVPR', 2024, 'CVPR 2024')");
      confDb.run("INSERT INTO conferences VALUES (2, 'ICML', 2024, 'ICML 2024')");
      confDb.run("INSERT INTO papers VALUES ('p1', 1, 'Paper 1', '[]', '', NULL, NULL, NULL, NULL, NULL, 'Main', NULL)");
      confDb.run("INSERT INTO papers VALUES ('p2', 1, 'Paper 2', '[]', '', NULL, NULL, NULL, NULL, NULL, 'Main', NULL)");

      const result = listConferences(confDb);
      expect(result).toHaveLength(2);
      expect(result[0].paper_count).toBe(2);
      expect(result[1].paper_count).toBe(0);
    });
  });

  describe('listConferencePapers', () => {
    beforeEach(() => {
      confDb.run("INSERT INTO conferences VALUES (1, 'CVPR', 2024, 'CVPR 2024')");
      confDb.run("INSERT INTO papers VALUES ('p1', 1, 'AI Paper', '[]', 'ai abstract', NULL, NULL, NULL, NULL, NULL, 'Main', NULL)");
      confDb.run("INSERT INTO papers VALUES ('p2', 1, 'CV Paper', '[]', 'cv abstract', NULL, NULL, NULL, NULL, NULL, 'Workshop', NULL)");
      confDb.run("INSERT INTO papers VALUES ('p3', 1, 'RL Paper', '[]', 'rl abstract', NULL, NULL, NULL, NULL, NULL, NULL, NULL)");
    });

    it('returns paginated results', () => {
      const result = listConferencePapers(confDb, analysesDb, null, null, { conferenceId: 1 });
      expect(result.items).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
    });

    it('filters by search', () => {
      const result = listConferencePapers(confDb, analysesDb, null, null, { conferenceId: 1, search: 'AI' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('p1');
    });

    it('filters by tracks', () => {
      const result = listConferencePapers(confDb, analysesDb, null, null, { conferenceId: 1, tracks: ['Main'] });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('p1');
    });

    it('includes summary/analysis from analysesDb', () => {
      analysesDb.run("INSERT INTO analyses VALUES ('p1', 'test summary', 'test analysis')");
      const result = listConferencePapers(confDb, analysesDb, null, null, { conferenceId: 1 });
      const p1 = result.items.find(p => p.id === 'p1');
      expect(p1!.summary).toBe('test summary');
      expect(p1!.analysis).toBe('test analysis');
    });

    it('paginates correctly', () => {
      const result = listConferencePapers(confDb, analysesDb, null, null, { conferenceId: 1, page: 1, pageSize: 2 });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(3);

      const page2 = listConferencePapers(confDb, analysesDb, null, null, { conferenceId: 1, page: 2, pageSize: 2 });
      expect(page2.items).toHaveLength(1);
    });
  });

  describe('getConferencePaperDetail', () => {
    it('throws for missing paper', () => {
      expect(() => getConferencePaperDetail(confDb, analysesDb, 'nonexistent')).toThrow('not found');
    });

    it('returns paper with analyses', () => {
      confDb.run("INSERT INTO conferences VALUES (1, 'CVPR', 2024, '')");
      confDb.run("INSERT INTO papers VALUES ('p1', 1, 'Test', '[]', 'abstract', NULL, NULL, NULL, NULL, NULL, NULL, NULL)");
      analysesDb.run("INSERT INTO analyses VALUES ('p1', 'summary', 'analysis')");

      const paper = getConferencePaperDetail(confDb, analysesDb, 'p1');
      expect(paper.id).toBe('p1');
      expect(paper.summary).toBe('summary');
      expect(paper.analysis).toBe('analysis');
    });
  });

  describe('listConferenceTracks', () => {
    it('returns tracks with counts', () => {
      confDb.run("INSERT INTO conferences VALUES (1, 'CVPR', 2024, '')");
      confDb.run("INSERT INTO papers VALUES ('p1', 1, 'A', '[]', '', NULL, NULL, NULL, NULL, NULL, 'Oral', NULL)");
      confDb.run("INSERT INTO papers VALUES ('p2', 1, 'B', '[]', '', NULL, NULL, NULL, NULL, NULL, 'Poster', NULL)");
      confDb.run("INSERT INTO papers VALUES ('p3', 1, 'C', '[]', '', NULL, NULL, NULL, NULL, NULL, 'Oral', NULL)");

      const tracks = listConferenceTracks(confDb, 1);
      expect(tracks).toHaveLength(2);
      expect(tracks[0].track).toBe('Oral');
      expect(tracks[0].count).toBe(2);
    });
  });

  describe('getConferencePaperPdfUrl', () => {
    it('returns pdf_url', () => {
      confDb.run("INSERT INTO conferences VALUES (1, 'CVPR', 2024, '')");
      confDb.run("INSERT INTO papers VALUES ('p1', 1, 'Test', '[]', '', 'http://pdf', NULL, NULL, NULL, NULL, NULL, NULL)");

      expect(getConferencePaperPdfUrl(confDb, 'p1')).toBe('http://pdf');
    });

    it('returns null for missing paper', () => {
      expect(getConferencePaperPdfUrl(confDb, 'nonexistent')).toBeNull();
    });
  });

});

describe('stopConferenceSummary', () => {
  it('returns success', () => {
    expect(stopConferenceSummary()).toEqual({ success: true });
  });
});

describe('stopConferenceAnalysis', () => {
  it('returns success', () => {
    expect(stopConferenceAnalysis()).toEqual({ success: true });
  });
});
