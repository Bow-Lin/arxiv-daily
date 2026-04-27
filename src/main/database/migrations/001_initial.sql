CREATE TABLE IF NOT EXISTS papers (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    authors TEXT NOT NULL,
    abstract_text TEXT NOT NULL,
    url TEXT NOT NULL,
    pdf_url TEXT NOT NULL,
    published_date TEXT NOT NULL,
    updated_date TEXT NOT NULL,
    categories TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    relevance_topics TEXT
);

CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    keywords TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT TRUE
);

INSERT OR IGNORE INTO categories (name, enabled) VALUES ('cs.CV', 1);
INSERT OR IGNORE INTO categories (name, enabled) VALUES ('cs.RO', 1);

CREATE TABLE IF NOT EXISTS analyses (
    paper_id TEXT PRIMARY KEY,
    summary TEXT DEFAULT '',
    analysis TEXT DEFAULT '',
    FOREIGN KEY (paper_id) REFERENCES papers(id)
);
