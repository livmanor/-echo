import csv
import io
import json
from typing import Optional

from fastapi import FastAPI, File, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from database import get_db, init_db
from engine.classify import CATEGORIES, classify_text
from engine.extract import extract_identifiers
from engine.pipeline import (
    CATEGORY_LABEL,
    import_posts,
    parse_csv,
    parse_json,
    public_post,
    reset_sample,
    seed_if_empty,
    stats_payload,
)
from sample_corpus import CHANNELS, corpus_posts

app = FastAPI(
    title="ECHO Public Channel Trade Monitor",
    description="Rajasthan Police OSINT dashboard for public Telegram and social-media advertisements. Synthetic demo data only.",
    version="2.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ClassifyRequest(BaseModel):
    text: str
    ocr_text: str = ""


class ImportBody(BaseModel):
    posts: list
    source: str = "json"


class AlertStatus(BaseModel):
    status: str


@app.on_event("startup")
def startup():
    init_db()
    seed_if_empty()


def actor(officer: Optional[str], role: Optional[str]):
    return (officer or "DySP, Cyber Cell", role or "Investigator")


def _identifiers_for(conn, post_ids):
    if not post_ids:
        return {}
    marks = ",".join("?" for _ in post_ids)
    rows = conn.execute(
        f"SELECT post_id, kind, value, normalized FROM identifiers WHERE post_id IN ({marks})",
        list(post_ids),
    ).fetchall()
    grouped = {post_id: [] for post_id in post_ids}
    for row in rows:
        grouped[row["post_id"]].append(
            {"kind": row["kind"], "value": row["value"], "normalized": row["normalized"]}
        )
    return grouped


def _load_public(conn, where="1=1", args=()):
    rows = conn.execute(f"SELECT * FROM posts WHERE {where} ORDER BY timestamp DESC", args).fetchall()
    grouped = _identifiers_for(conn, [row["id"] for row in rows])
    return [public_post(row, grouped.get(row["id"], [])) for row in rows]


@app.get("/api/health")
def health():
    return {"status": "ok", "product": "ECHO", "scope": "public posts and imported datasets"}


@app.get("/api/stats")
def stats():
    return stats_payload()


@app.get("/api/channels")
def channels():
    conn = get_db()
    rows = [dict(row) for row in conn.execute("SELECT * FROM channels ORDER BY flagged_count DESC").fetchall()]
    conn.close()
    return rows


@app.get("/api/posts")
def posts(
    category: Optional[str] = None,
    platform: Optional[str] = None,
    risk: Optional[str] = None,
    flagged: Optional[bool] = None,
    financial: Optional[bool] = None,
    q: Optional[str] = None,
):
    conn = get_db()
    rows = _load_public(conn)
    conn.close()
    if category:
        rows = [row for row in rows if row["category"] == category]
    if platform:
        rows = [row for row in rows if row["platform"] == platform]
    if risk:
        rows = [row for row in rows if row["risk"] == risk]
    if flagged is not None:
        rows = [row for row in rows if row["flagged"] is flagged]
    if financial:
        rows = [row for row in rows if row["financial_flag"]]
    if q:
        needle = q.lower().strip()
        def hit(row):
            blob = " ".join(
                [
                    row["text"], row.get("ocr_text") or "", row.get("author") or "",
                    row["channel_title"], row["id"],
                    " ".join(item["value"] for item in row["identifiers"]),
                ]
            ).lower()
            return needle in blob
        rows = [row for row in rows if hit(row)]
    return rows


@app.get("/api/posts/{post_id}")
def post_detail(post_id: str):
    conn = get_db()
    row = conn.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Post not found")
    grouped = _identifiers_for(conn, [post_id])
    post = public_post(row, grouped.get(post_id, []))
    related = []
    if post.get("entity_id"):
        related = _load_public(conn, "entity_id = ? AND id != ?", (post["entity_id"], post_id))
    cluster = []
    if post.get("cluster_id"):
        cluster = _load_public(conn, "cluster_id = ?", (post["cluster_id"],))
    entity = None
    if post.get("entity_id"):
        found = conn.execute("SELECT * FROM entities WHERE id = ?", (post["entity_id"],)).fetchone()
        if found:
            entity = dict(found)
            entity["categories"] = json.loads(entity["categories"])
    conn.close()
    return {"post": post, "entity": entity, "related_posts": related, "cluster_posts": cluster}


@app.get("/api/alerts")
def alerts(status: Optional[str] = None, severity: Optional[str] = None):
    conn = get_db()
    rows = [dict(row) for row in conn.execute("SELECT * FROM alerts ORDER BY timestamp DESC").fetchall()]
    posts_by_id = {post["id"]: post for post in _load_public(conn)}
    conn.close()
    results = []
    for row in rows:
        if status and row["status"] != status:
            continue
        if severity and row["severity"] != severity:
            continue
        post = posts_by_id.get(row["post_id"])
        results.append({**row, "post": post})
    return results


@app.patch("/api/alerts/{alert_id}/status")
def update_alert(
    alert_id: str,
    body: AlertStatus,
    x_officer: Optional[str] = Header(default=None),
    x_role: Optional[str] = Header(default=None),
):
    allowed = {"NEW", "ACKNOWLEDGED", "INVESTIGATING", "RESOLVED"}
    if body.status not in allowed:
        raise HTTPException(400, "Unknown alert status")
    officer, role = actor(x_officer, x_role)
    conn = get_db()
    found = conn.execute("SELECT id FROM alerts WHERE id = ?", (alert_id,)).fetchone()
    if not found:
        conn.close()
        raise HTTPException(404, "Alert not found")
    conn.execute("UPDATE alerts SET status = ? WHERE id = ?", (body.status, alert_id))
    from engine.pipeline import audit
    audit(conn, officer, role, "ALERT_STATUS", f"{alert_id} -> {body.status}", "SUCCESS")
    conn.commit()
    conn.close()
    return {"id": alert_id, "status": body.status}


@app.get("/api/identifiers")
def identifiers(kind: Optional[str] = None, q: Optional[str] = None):
    conn = get_db()
    rows = conn.execute(
        """
        SELECT i.kind, i.value, i.normalized, i.post_id, p.category, p.flagged, p.risk,
               p.channel_title, p.platform, p.timestamp, p.entity_id
        FROM identifiers i JOIN posts p ON p.id = i.post_id
        ORDER BY i.kind, i.normalized
        """
    ).fetchall()
    conn.close()
    grouped = {}
    for row in rows:
        if kind and row["kind"] != kind:
            continue
        if q and q.lower() not in (row["value"] + row["normalized"]).lower():
            continue
        key = (row["kind"], row["normalized"])
        bucket = grouped.setdefault(
            key,
            {
                "kind": row["kind"],
                "value": row["value"],
                "normalized": row["normalized"],
                "posts": [],
                "channels": set(),
                "flagged_posts": 0,
            },
        )
        bucket["posts"].append(
            {
                "id": row["post_id"],
                "category": row["category"],
                "flagged": bool(row["flagged"]),
                "risk": row["risk"],
                "channel_title": row["channel_title"],
                "platform": row["platform"],
                "timestamp": row["timestamp"],
                "entity_id": row["entity_id"],
            }
        )
        bucket["channels"].add(row["channel_title"])
        bucket["flagged_posts"] += int(bool(row["flagged"]))
    results = []
    for bucket in grouped.values():
        bucket["channels"] = sorted(bucket["channels"])
        bucket["cross_channel"] = len(bucket["channels"]) > 1
        results.append(bucket)
    results.sort(key=lambda item: (item["flagged_posts"], item["cross_channel"]), reverse=True)
    return results


@app.get("/api/entities")
def entities():
    conn = get_db()
    rows = []
    for row in conn.execute("SELECT * FROM entities ORDER BY channel_count DESC, post_count DESC").fetchall():
        item = dict(row)
        item["categories"] = json.loads(item["categories"])
        rows.append(item)
    conn.close()
    return rows


@app.get("/api/entities/{entity_id}")
def entity_detail(entity_id: str):
    conn = get_db()
    row = conn.execute("SELECT * FROM entities WHERE id = ?", (entity_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Seller cluster not found")
    entity = dict(row)
    entity["categories"] = json.loads(entity["categories"])
    posts = _load_public(conn, "entity_id = ?", (entity_id,))
    conn.close()
    return {"entity": entity, "posts": posts}


@app.get("/api/clusters")
def clusters():
    conn = get_db()
    rows = [dict(row) for row in conn.execute("SELECT * FROM clusters ORDER BY size DESC, score DESC").fetchall()]
    posts = _load_public(conn, "cluster_id IS NOT NULL")
    conn.close()
    grouped = {}
    for post in posts:
        grouped.setdefault(post["cluster_id"], []).append(post)
    for row in rows:
        row["posts"] = grouped.get(row["id"], [])
    return rows


@app.get("/api/network")
def network():
    conn = get_db()
    entities_rows = [dict(row) for row in conn.execute("SELECT * FROM entities").fetchall()]
    posts = _load_public(conn)
    channel_rows = [dict(row) for row in conn.execute("SELECT * FROM channels").fetchall()]
    conn.close()
    nodes = []
    edges = []
    seen = set()

    def add_node(node_id, label, kind, **extra):
        if node_id in seen:
            return
        seen.add(node_id)
        nodes.append({"data": {"id": node_id, "label": label, "type": kind, **extra}})

    def add_edge(source, target, relationship):
        edges.append(
            {
                "data": {
                    "id": f"{source}|{target}|{relationship}",
                    "source": source,
                    "target": target,
                    "relationship": relationship,
                }
            }
        )

    channels = {row["id"]: row for row in channel_rows}
    for entity in entities_rows:
        add_node(entity["id"], entity["label"], "seller", risk=entity["risk"], confidence=entity["confidence"])
    for post in posts:
        if not post.get("entity_id"):
            continue
        channel = channels.get(post["channel_id"])
        if channel:
            add_node(channel["id"], channel["title"], "channel", platform=channel["platform"])
            add_edge(post["entity_id"], channel["id"], "posted_in")
        for ident in post["identifiers"]:
            if ident["kind"] == "location":
                continue
            node_id = f"{ident['kind']}:{ident['normalized']}"
            add_node(node_id, ident["value"], ident["kind"])
            add_edge(post["entity_id"], node_id, "uses")
    return {"nodes": nodes, "edges": edges}


@app.post("/api/classify")
def classify(body: ClassifyRequest):
    text = "\n".join(part for part in (body.text, body.ocr_text) if part)
    verdict = classify_text(text)
    verdict.pop("model", None)
    return {**verdict, "identifiers": extract_identifiers(text), "category_label": CATEGORY_LABEL.get(verdict["category"], verdict["category"])}


@app.post("/api/import")
async def import_file(
    file: UploadFile = File(...),
    x_officer: Optional[str] = Header(default=None),
    x_role: Optional[str] = Header(default=None),
):
    raw = await file.read()
    if len(raw) > 2_000_000:
        raise HTTPException(400, "File is larger than 2 MB.")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(400, "File must be UTF-8 CSV or JSON.")
    name = (file.filename or "upload").lower()
    try:
        parsed = parse_csv(text) if name.endswith(".csv") else parse_json(text)
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(400, str(exc))
    officer, role = actor(x_officer, x_role)
    return import_posts(parsed, officer, role, file.filename or "upload")


@app.post("/api/import/json")
def import_json(
    body: ImportBody,
    x_officer: Optional[str] = Header(default=None),
    x_role: Optional[str] = Header(default=None),
):
    try:
        parsed = parse_json(json.dumps(body.posts))
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(400, str(exc))
    officer, role = actor(x_officer, x_role)
    return import_posts(parsed, officer, role, body.source)


@app.post("/api/sample/reset")
def sample_reset(
    x_officer: Optional[str] = Header(default=None),
    x_role: Optional[str] = Header(default=None),
):
    officer, role = actor(x_officer, x_role)
    return reset_sample(officer, role)


@app.get("/api/sample.json")
def sample_json():
    return {
        "notice": "Synthetic posts for the Rajasthan Police demo. Do not add real personal data.",
        "channels": CHANNELS,
        "posts": corpus_posts(),
    }


@app.get("/api/sample.csv")
def sample_csv():
    buffer = io.StringIO()
    fieldnames = ["id", "platform", "channel_id", "channel_title", "author", "timestamp", "text", "ocr_text", "image_ref", "label"]
    writer = csv.DictWriter(buffer, fieldnames=fieldnames)
    writer.writeheader()
    for post in corpus_posts():
        writer.writerow(
            {
                "id": post["id"],
                "platform": post["platform"],
                "channel_id": post["channel_id"],
                "channel_title": post["channel_title"],
                "author": post["author"],
                "timestamp": post["timestamp"],
                "text": post["text"],
                "ocr_text": post["ocr_text"],
                "image_ref": post["image_ref"],
                "label": post["gold_label"],
            }
        )
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=echo-sample.csv"},
    )


@app.get("/api/audit")
def audit_log():
    conn = get_db()
    rows = [dict(row) for row in conn.execute("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 200").fetchall()]
    conn.close()
    return rows


@app.get("/api/meta")
def meta():
    return {
        "categories": [{"id": key, "label": CATEGORY_LABEL[key]} for key in CATEGORIES if key != "benign"],
        "out_of_scope": [
            "Joining private groups",
            "Using a cover identity",
            "Contacting sellers or making purchases",
            "Collecting from private accounts",
        ],
    }
