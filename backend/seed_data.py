"""Seed the monitor database when it has no posts. Safe to run on every boot."""

from database import init_db
from engine.pipeline import seed_if_empty

if __name__ == "__main__":
    init_db()
    summary = seed_if_empty()
    if summary:
        print(f"[seed] Loaded synthetic corpus: {summary}")
    else:
        print("[seed] Database already has posts. Left it unchanged.")
