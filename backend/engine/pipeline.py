"""Ingest posts, classify them, extract identifiers, and rebuild links."""

import csv
import hashlib
import io
import json
import uuid
from collections import Counter
from datetime import datetime, timezone

from database import get_db, init_db
from engine.classify import classify_text
from engine.extract import extract_identifiers
from engine.link import link_posts
from sample_corpus import CHANNELS, corpus_posts

RISK_SCORE = {"LOW": 20, "MEDIUM": 48, "HIGH": 74, "CRITICAL": 93}
CATEGORY_LABEL = {
    "drug_sale": "Drug sale",
    "arms_sale": "Illegal arms",
    "fake_documents": "Fake documents",
    "bank_account": "Bank account",
    "atm_card": "ATM / card",
    "net_banking": "Net-banking kit",
    "sim_card": "SIM card",
    "benign": "Not a sale",
}


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def combined_text(post):
    return "\n".join(part for part in (post.get("text") or "", post.get("ocr_text") or "") if part).strip()


def content_hash(post):
    raw = "|".join(
        [
            post.get("platform") or "",
            post.get("channel_id") or "",
            post.get("timestamp") or "",
            post.get("text") or "",
            post.get("ocr_text") or "",
        ]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def analyze_posts(raw_posts):
    posts = []
    for raw in raw_posts:
        post = dict(raw)
        post["text"] = post.get("text") or ""
        post["ocr_text"] = post.get("ocr_text") or ""
        post["image_ref"] = post.get("image_ref") or ""
        post["author"] = post.get("author") or ""
        post["platform"] = post.get("platform") or "import"
        post["channel_title"] = post.get("channel_title") or post.get("channel_id") or "Imported"
        verdict = classify_text(combined_text(post))
        post.update(verdict)
        post["identifiers"] = extract_identifiers(combined_text(post))
        if post["author"] and post["author"] not in {"channel_admin", "admin", "unknown"}:
            handle = post["author"].lstrip("@")
            if handle and not any(item["normalized"] == handle.lower() for item in post["identifiers"]):
                post["identifiers"].append(
                    {"kind": "telegram", "value": "@" + handle, "normalized": handle.lower()}
                )
        post["content_hash"] = content_hash(post)
        posts.append(post)
    clusters, entities = link_posts(posts)
    return posts, clusters, entities


def _rows(conn, query, args=()):
    return [dict(row) for row in conn.execute(query, args).fetchall()]


def _load_posts(conn):
    posts = _rows(conn, "SELECT * FROM posts")
    idents = _rows(conn, "SELECT post_id, kind, value, normalized FROM identifiers")
    grouped = {}
    for ident in idents:
        grouped.setdefault(ident["post_id"], []).append(
            {"kind": ident["kind"], "value": ident["value"], "normalized": ident["normalized"]}
        )
    for post in posts:
        post["identifiers"] = grouped.get(post["id"], [])
        post["flagged"] = bool(post["flagged"])
        post["financial_flag"] = bool(post["financial_flag"])
        post["lexicon_hits"] = json.loads(post["lexicon_hits"] or "[]")
        post["reasons"] = json.loads(post["reasons"] or "[]")
        post["financial_evidence"] = json.loads(post["financial_evidence"] or "[]")
    return posts


def _write_state(conn, posts, clusters, entities, channels):
    previous = {
        row["id"]: row["status"]
        for row in conn.execute("SELECT id, status FROM alerts").fetchall()
    }
    conn.execute("DELETE FROM identifiers")
    conn.execute("DELETE FROM alerts")
    conn.execute("DELETE FROM clusters")
    conn.execute("DELETE FROM entities")
    conn.execute("DELETE FROM posts")
    conn.execute("DELETE FROM channels")

    by_channel = {}
    for post in posts:
        bucket = by_channel.setdefault(post["channel_id"], {"count": 0, "flagged": 0, "last": ""})
        bucket["count"] += 1
        bucket["flagged"] += int(bool(post["flagged"]))
        if post["timestamp"] > bucket["last"]:
            bucket["last"] = post["timestamp"]

    known = {channel["id"]: channel for channel in channels}
    for channel_id, bucket in by_channel.items():
        meta = known.get(channel_id, {})
        conn.execute(
            """
            INSERT INTO channels
            (id, platform, title, handle, visibility, mode, note, post_count, flagged_count, last_post)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                channel_id,
                meta.get("platform") or post_platform(posts, channel_id),
                meta.get("title") or post_title(posts, channel_id),
                meta.get("handle") or "",
                meta.get("visibility") or "public",
                meta.get("mode") or "csv_import",
                meta.get("note") or "Imported public posts.",
                bucket["count"],
                bucket["flagged"],
                bucket["last"],
            ),
        )
    for channel in channels:
        if channel["id"] not in by_channel:
            conn.execute(
                """
                INSERT INTO channels
                (id, platform, title, handle, visibility, mode, note, post_count, flagged_count, last_post)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, NULL)
                """,
                (
                    channel["id"], channel["platform"], channel["title"], channel.get("handle") or "",
                    channel.get("visibility") or "public", channel.get("mode") or "public_export",
                    channel.get("note") or "",
                ),
            )

    for post in posts:
        conn.execute(
            """
            INSERT INTO posts (
                id, platform, channel_id, channel_title, author, timestamp, text, ocr_text, image_ref,
                gold_label, category, confidence, risk, flagged, financial_flag, financial_risk,
                financial_evidence, lexicon_hits, reasons, content_hash, cluster_id, entity_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                post["id"], post["platform"], post["channel_id"], post["channel_title"], post.get("author"),
                post["timestamp"], post["text"], post.get("ocr_text"), post.get("image_ref"),
                post.get("gold_label"), post["category"], post["confidence"], post["risk"],
                int(post["flagged"]), int(post["financial_flag"]), post.get("financial_risk"),
                json.dumps(post.get("financial_evidence") or [], ensure_ascii=False),
                json.dumps(post.get("lexicon_hits") or [], ensure_ascii=False),
                json.dumps(post.get("reasons") or [], ensure_ascii=False),
                post["content_hash"], post.get("cluster_id"), post.get("entity_id"),
            ),
        )
        for index, ident in enumerate(post.get("identifiers") or []):
            conn.execute(
                "INSERT INTO identifiers (id, post_id, kind, value, normalized) VALUES (?, ?, ?, ?, ?)",
                (f"{post['id']}-{ident['kind']}-{index}", post["id"], ident["kind"], ident["value"], ident["normalized"]),
            )
        if post["flagged"]:
            alert_id = f"ALT-{post['id']}"
            title = f"{CATEGORY_LABEL.get(post['category'], post['category'])} in {post['channel_title']}"
            conn.execute(
                """
                INSERT INTO alerts (
                    id, post_id, title, severity, category, timestamp, status, reason, confidence,
                    evidence_hash, channel_title, platform
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    alert_id, post["id"], title, post["risk"], post["category"], post["timestamp"],
                    previous.get(alert_id, "NEW"),
                    " ".join(post.get("reasons") or []),
                    post["confidence"], post["content_hash"], post["channel_title"], post["platform"],
                ),
            )

    for cluster in clusters:
        conn.execute(
            "INSERT INTO clusters (id, size, score, method, summary) VALUES (?, ?, ?, ?, ?)",
            (cluster["id"], cluster["size"], cluster["score"], cluster["method"], cluster["summary"]),
        )
    for entity in entities:
        conn.execute(
            """
            INSERT INTO entities
            (id, label, risk, confidence, post_count, channel_count, categories, first_seen, last_seen)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                entity["id"], entity["label"], entity["risk"], entity["confidence"], entity["post_count"],
                entity["channel_count"], json.dumps(entity["categories"]), entity["first_seen"], entity["last_seen"],
            ),
        )


def post_platform(posts, channel_id):
    for post in posts:
        if post["channel_id"] == channel_id:
            return post["platform"]
    return "import"


def post_title(posts, channel_id):
    for post in posts:
        if post["channel_id"] == channel_id:
            return post["channel_title"]
    return channel_id


def _stored_channels(conn):
    return _rows(conn, "SELECT * FROM channels")


def rebuild(conn, raw_posts, channels):
    posts, clusters, entities = analyze_posts(raw_posts)
    _write_state(conn, posts, clusters, entities, channels)
    conn.commit()
    return {
        "posts": len(posts),
        "flagged": sum(1 for post in posts if post["flagged"]),
        "financial": sum(1 for post in posts if post["financial_flag"]),
        "clusters": len(clusters),
        "entities": len(entities),
    }


def seed_if_empty():
    init_db()
    conn = get_db()
    count = conn.execute("SELECT COUNT(*) FROM posts").fetchone()[0]
    if count == 0:
        summary = rebuild(conn, corpus_posts(), CHANNELS)
        audit(conn, "System", "Administrator", "SEED_SAMPLE", "synthetic corpus", "SUCCESS")
        conn.commit()
        conn.close()
        return summary
    conn.close()
    return None


def reset_sample(officer, role):
    init_db()
    conn = get_db()
    summary = rebuild(conn, corpus_posts(), CHANNELS)
    audit(conn, officer, role, "RESET_SAMPLE", "synthetic corpus", "SUCCESS")
    conn.commit()
    conn.close()
    return summary


def audit(conn, officer, role, action, target, result):
    conn.execute(
        """
        INSERT INTO audit_logs (id, user_officer, role, action, resource_target, timestamp, result)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (f"AUD-{uuid.uuid4().hex[:10]}", officer, role, action, target, now_iso(), result),
    )


def _normalize_import(item, index):
    text = item.get("text") or item.get("message") or ""
    if isinstance(text, list):
        text = "".join(part if isinstance(part, str) else part.get("text", "") for part in text)
    channel = item.get("channel") or item.get("channel_title") or item.get("chat") or "Imported channel"
    channel_id = item.get("channel_id") or "imp-" + hashlib.sha256(channel.encode("utf-8")).hexdigest()[:8]
    platform = (item.get("platform") or item.get("source") or "import").lower()
    timestamp = item.get("timestamp") or item.get("date") or item.get("time") or now_iso()
    post_id = item.get("id") or "IMP-" + hashlib.sha256(f"{channel}|{timestamp}|{text}|{index}".encode("utf-8")).hexdigest()[:8].upper()
    return {
        "id": str(post_id),
        "platform": platform,
        "channel_id": channel_id,
        "channel_title": channel if not item.get("channel_title") else item["channel_title"],
        "author": item.get("author") or item.get("from") or item.get("username") or "",
        "timestamp": str(timestamp),
        "text": text if isinstance(text, str) else str(text),
        "ocr_text": item.get("ocr_text") or "",
        "image_ref": item.get("image_ref") or item.get("image") or "",
        "gold_label": item.get("label") or item.get("gold_label") or "",
    }


def parse_csv(text: str):
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames or "text" not in [name.strip().lower() for name in reader.fieldnames]:
        raise ValueError("CSV must include a text column.")
    rows = []
    for index, row in enumerate(reader):
        lowered = {((key or "").strip().lower()): (value or "") for key, value in row.items()}
        rows.append(_normalize_import(lowered, index))
    if not rows:
        raise ValueError("CSV has no data rows.")
    return rows


def parse_json(text: str):
    data = json.loads(text)
    if isinstance(data, dict) and "chats" in data:
        return _telegram_export(data)
    if isinstance(data, dict):
        posts = data.get("posts") or data.get("messages") or []
    elif isinstance(data, list):
        posts = data
    else:
        raise ValueError("JSON must be a list of posts or an object with a posts array.")
    if not posts:
        raise ValueError("No posts found in JSON.")
    return [_normalize_import(item, index) for index, item in enumerate(posts)]


def _telegram_export(data):
    """Read a Telegram desktop JSON export of public chats. No network call."""
    chats = data.get("chats", {}).get("list") or data.get("chats") or []
    rows = []
    for chat in chats:
        title = chat.get("name") or chat.get("title") or "Telegram export"
        for index, message in enumerate(chat.get("messages") or []):
            if message.get("type") not in (None, "message"):
                continue
            rows.append(
                _normalize_import(
                    {
                        "id": f"TG-{chat.get('id', 'x')}-{message.get('id', index)}",
                        "platform": "telegram",
                        "channel": title,
                        "channel_title": title,
                        "author": message.get("from") or "",
                        "timestamp": message.get("date") or "",
                        "text": message.get("text") or "",
                    },
                    index,
                )
            )
    if not rows:
        raise ValueError("Telegram export contained no messages.")
    return rows


def import_posts(raw_posts, officer, role, source):
    init_db()
    conn = get_db()
    existing = _load_posts(conn)
    channels = _stored_channels(conn) or [dict(channel) for channel in CHANNELS]
    known_ids = {post["id"] for post in existing}
    fresh = []
    for post in raw_posts:
        if post["id"] in known_ids:
            existing = [row for row in existing if row["id"] != post["id"]]
        fresh.append(post)
        known_ids.add(post["id"])
    summary = rebuild(conn, existing + fresh, channels)
    audit(conn, officer, role, "IMPORT", source, f"{len(fresh)} posts")
    conn.commit()
    conn.close()
    summary["imported"] = len(fresh)
    return summary


def agreement():
    posts = corpus_posts()
    analyzed, _, _ = analyze_posts(posts)
    labelled = [post for post in analyzed if post.get("gold_label")]
    if not labelled:
        return {"sample_agreement": None, "labelled_posts": 0, "false_positives": 0, "missed": 0}
    exact = sum(1 for post in labelled if post["category"] == post["gold_label"])
    false_positives = sum(1 for post in labelled if post["gold_label"] == "benign" and post["flagged"])
    missed = sum(1 for post in labelled if post["gold_label"] != "benign" and not post["flagged"])
    return {
        "sample_agreement": round(exact / len(labelled), 3),
        "labelled_posts": len(labelled),
        "false_positives": false_positives,
        "missed": missed,
    }


def stats_payload():
    conn = get_db()
    posts = conn.execute("SELECT category, risk, flagged, financial_flag, platform FROM posts").fetchall()
    alerts = conn.execute("SELECT severity, status FROM alerts").fetchall()
    identifiers = conn.execute("SELECT COUNT(*) FROM identifiers").fetchone()[0]
    entities = conn.execute("SELECT COUNT(*) FROM entities").fetchone()[0]
    channels = conn.execute("SELECT COUNT(*) FROM channels").fetchone()[0]
    clusters = conn.execute("SELECT COUNT(*) FROM clusters").fetchone()[0]
    conn.close()
    by_category = Counter(row["category"] for row in posts if row["flagged"])
    flagged = [row for row in posts if row["flagged"]]
    if flagged:
        threat = round(sum(RISK_SCORE.get(row["risk"], 40) for row in flagged) / len(flagged))
    else:
        threat = 0
    level = "CRITICAL" if threat >= 85 else "HIGH" if threat >= 65 else "MODERATE" if threat >= 40 else "LOW"
    model = agreement()
    return {
        "threat_level": level,
        "threat_score": threat,
        "kpis": {
            "posts_ingested": len(posts),
            "flagged_posts": len(flagged),
            "financial_ads": sum(1 for row in posts if row["financial_flag"]),
            "identifiers": identifiers,
            "seller_clusters": entities,
            "channels": channels,
            "open_alerts": sum(1 for row in alerts if row["status"] != "RESOLVED"),
            "coordinated_groups": clusters,
        },
        "by_category": [
            {"category": name, "count": by_category.get(name, 0)}
            for name in ["drug_sale", "arms_sale", "fake_documents", "bank_account", "atm_card", "net_banking", "sim_card"]
        ],
        "by_platform": [
            {
                "platform": name,
                "count": sum(1 for row in posts if row["platform"] == name),
                "flagged": sum(1 for row in posts if row["platform"] == name and row["flagged"]),
            }
            for name in sorted({row["platform"] for row in posts})
        ],
        "system_status": {
            "collector": "PUBLIC EXPORT + CSV/JSON",
            "classifier": "LEXICON + NAIVE BAYES",
            "languages": "ENGLISH / HINGLISH / HINDI",
            "evidence_seal": "SHA-256",
        },
        "model": {
            "name": "Slang lexicon blended with Bernoulli naive Bayes",
            **model,
        },
    }


def public_post(row, identifiers):
    post = dict(row)
    post["flagged"] = bool(post["flagged"])
    post["financial_flag"] = bool(post["financial_flag"])
    post["lexicon_hits"] = json.loads(post["lexicon_hits"] or "[]")
    post["reasons"] = json.loads(post["reasons"] or "[]")
    post["financial_evidence"] = json.loads(post["financial_evidence"] or "[]")
    post.pop("gold_label", None)
    post["identifiers"] = identifiers
    return post
