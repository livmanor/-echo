import os
import sqlite3

DB_PATH = os.environ.get("MONITOR_DB") or os.path.join(os.path.dirname(__file__), "monitor.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.executescript(
        """
        CREATE TABLE IF NOT EXISTS channels (
            id TEXT PRIMARY KEY,
            platform TEXT NOT NULL,
            title TEXT NOT NULL,
            handle TEXT,
            visibility TEXT NOT NULL,
            mode TEXT NOT NULL,
            note TEXT,
            post_count INTEGER NOT NULL DEFAULT 0,
            flagged_count INTEGER NOT NULL DEFAULT 0,
            last_post TEXT
        );

        CREATE TABLE IF NOT EXISTS posts (
            id TEXT PRIMARY KEY,
            platform TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            channel_title TEXT NOT NULL,
            author TEXT,
            timestamp TEXT NOT NULL,
            text TEXT NOT NULL,
            ocr_text TEXT,
            image_ref TEXT,
            gold_label TEXT,
            category TEXT NOT NULL,
            confidence INTEGER NOT NULL,
            risk TEXT NOT NULL,
            flagged INTEGER NOT NULL,
            financial_flag INTEGER NOT NULL,
            financial_risk TEXT,
            financial_evidence TEXT,
            lexicon_hits TEXT,
            reasons TEXT,
            content_hash TEXT NOT NULL,
            cluster_id TEXT,
            entity_id TEXT
        );

        CREATE TABLE IF NOT EXISTS identifiers (
            id TEXT PRIMARY KEY,
            post_id TEXT NOT NULL,
            kind TEXT NOT NULL,
            value TEXT NOT NULL,
            normalized TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS alerts (
            id TEXT PRIMARY KEY,
            post_id TEXT NOT NULL,
            title TEXT NOT NULL,
            severity TEXT NOT NULL,
            category TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            status TEXT NOT NULL,
            reason TEXT NOT NULL,
            confidence INTEGER NOT NULL,
            evidence_hash TEXT NOT NULL,
            channel_title TEXT NOT NULL,
            platform TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS clusters (
            id TEXT PRIMARY KEY,
            size INTEGER NOT NULL,
            score REAL NOT NULL,
            method TEXT NOT NULL,
            summary TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS entities (
            id TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            risk TEXT NOT NULL,
            confidence INTEGER NOT NULL,
            post_count INTEGER NOT NULL,
            channel_count INTEGER NOT NULL,
            categories TEXT NOT NULL,
            first_seen TEXT NOT NULL,
            last_seen TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            user_officer TEXT NOT NULL,
            role TEXT NOT NULL,
            action TEXT NOT NULL,
            resource_target TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            result TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_identifiers_norm ON identifiers(kind, normalized);
        CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);
        CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
        """
    )
    conn.commit()
    conn.close()
