import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
import { getPaperAnalysis, getUnanalyzedPapers } from '../paper-analyzer';

describe('paper-analyzer', () => {
  let SQL: any;
  let db: SqlJsDatabase;

  beforeAll(async () => {
    SQL = await initSqlJs({
      locateFile: () => 'node_modules/sql.js/dist/sql-wasm.wasm',
    });
  });

  beforeEach(() => {
    db = new SQL.Database();
    db.run(`
      CREATE TABLE papers (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        pdf_url TEXT,
        published_date TEXT
      );
      CREATE TABLE analyses (
        paper_id TEXT PRIMARY KEY,
        analysis TEXT
      );
    `);
  });

  describe('getPaperAnalysis', () => {
    it('returns analysis text when paper has analysis', () => {
      db.run("INSERT INTO papers (id, title) VALUES ('1', 'Paper A')");
      db.run("INSERT INTO analyses (paper_id, analysis) VALUES ('1', 'Great paper')");
      expect(getPaperAnalysis(db, '1')).toBe('Great paper');
    });

    it('returns null when paper has no analysis', () => {
      db.run("INSERT INTO papers (id, title) VALUES ('1', 'Paper A')");
      expect(getPaperAnalysis(db, '1')).toBeNull();
    });

    it('returns null for non-existent paper', () => {
      expect(getPaperAnalysis(db, '999')).toBeNull();
    });

    it('returns empty string for empty analysis', () => {
      db.run("INSERT INTO papers (id, title) VALUES ('1', 'Paper A')");
      db.run("INSERT INTO analyses (paper_id, analysis) VALUES ('1', '')");
      expect(getPaperAnalysis(db, '1')).toBe('');
    });
  });

  describe('getUnanalyzedPapers', () => {
    it('returns papers without analysis', () => {
      db.run("INSERT INTO papers (id, title, pdf_url, published_date) VALUES ('1', 'Paper A', 'http://pdf/1', '2024-03-15')");
      db.run("INSERT INTO papers (id, title, pdf_url, published_date) VALUES ('2', 'Paper B', 'http://pdf/2', '2024-03-14')");
      db.run("INSERT INTO analyses (paper_id, analysis) VALUES ('1', 'Analyzed')");

      const result = getUnanalyzedPapers(db);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
      expect(result[0].title).toBe('Paper B');
    });

    it('excludes papers without pdf_url', () => {
      db.run("INSERT INTO papers (id, title, pdf_url, published_date) VALUES ('1', 'Paper A', '', '2024-03-15')");
      db.run("INSERT INTO papers (id, title, pdf_url, published_date) VALUES ('2', 'Paper B', NULL, '2024-03-14')");
      db.run("INSERT INTO papers (id, title, pdf_url, published_date) VALUES ('3', 'Paper C', 'http://pdf/3', '2024-03-13')");

      const result = getUnanalyzedPapers(db);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('3');
    });

    it('includes papers with empty analysis as unanalyzed', () => {
      db.run("INSERT INTO papers (id, title, pdf_url, published_date) VALUES ('1', 'Paper A', 'http://pdf/1', '2024-03-15')");
      db.run("INSERT INTO analyses (paper_id, analysis) VALUES ('1', '')");

      const result = getUnanalyzedPapers(db);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('returns empty array when all papers are analyzed', () => {
      db.run("INSERT INTO papers (id, title, pdf_url, published_date) VALUES ('1', 'Paper A', 'http://pdf/1', '2024-03-15')");
      db.run("INSERT INTO analyses (paper_id, analysis) VALUES ('1', 'Done')");

      expect(getUnanalyzedPapers(db)).toEqual([]);
    });

    it('returns empty array when no papers exist', () => {
      expect(getUnanalyzedPapers(db)).toEqual([]);
    });

    it('orders by published_date DESC', () => {
      db.run("INSERT INTO papers (id, title, pdf_url, published_date) VALUES ('1', 'Old', 'http://pdf/1', '2024-03-10')");
      db.run("INSERT INTO papers (id, title, pdf_url, published_date) VALUES ('2', 'New', 'http://pdf/2', '2024-03-15')");

      const result = getUnanalyzedPapers(db);
      expect(result[0].id).toBe('2');
      expect(result[1].id).toBe('1');
    });
  });
});
