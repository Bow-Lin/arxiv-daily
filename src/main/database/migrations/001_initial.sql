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
    fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS analyses (
    paper_id TEXT PRIMARY KEY,
    summary TEXT DEFAULT '',
    analysis TEXT DEFAULT '',
    FOREIGN KEY (paper_id) REFERENCES papers(id)
);
