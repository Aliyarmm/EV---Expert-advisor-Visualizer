"""
SQLite database layer for EV — Expert Advisor Visualizer.
Stores MetaTrader EA trade history, equity curves, and performance metrics.
Provides connection management and schema initialization.
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "uv_visualizer.db"


def new_db_connection():
    """Create a fresh SQLite connection (also usable via FastAPI Depends)."""
    # check_same_thread=False: FastAPI runs sync handlers in a threadpool and
    # each request may create + use the connection from different threads.
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def get_db():
    """Yield a SQLite connection. Called as dependency in FastAPI routes."""
    conn = new_db_connection()
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    """Create tables if they don't exist."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.executescript(_SCHEMA)
    conn.commit()
    conn.close()


_SCHEMA = """
CREATE TABLE IF NOT EXISTS strategies (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    family      TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'Under Review',
    symbol      TEXT NOT NULL,
    timeframe   TEXT NOT NULL,
    logic       TEXT,
    params      TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS metrics (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    strategy_id TEXT NOT NULL,
    label       TEXT NOT NULL,
    value       REAL,
    FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS equity_curve (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    strategy_id TEXT NOT NULL,
    date        TEXT NOT NULL,
    value       REAL NOT NULL,
    FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS books (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    weights     TEXT,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS book_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id     TEXT NOT NULL,
    strategy_id TEXT NOT NULL,
    weight      REAL,
    side        TEXT NOT NULL DEFAULT 'long',
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS data_versions (
    id          TEXT PRIMARY KEY,
    filename    TEXT NOT NULL,
    checksum    TEXT NOT NULL,
    columns     TEXT,
    row_count   INTEGER DEFAULT 0,
    file_size   INTEGER DEFAULT 0,
    uploaded_at TEXT NOT NULL,
    cleaned     INTEGER DEFAULT 0,
    outliers_removed INTEGER DEFAULT 0
);
"""
