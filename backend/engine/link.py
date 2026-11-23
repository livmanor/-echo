"""Link repeated advertisements and the same identifier across channels."""

import hashlib
import re
from collections import defaultdict

TOKEN_RE = re.compile(r"[\w@]+", re.UNICODE)
RISK_RANK = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}
RISK_NAME = {1: "LOW", 2: "MEDIUM", 3: "HIGH", 4: "CRITICAL"}


def _tokens(text: str):
    return TOKEN_RE.findall((text or "").lower())


def _shingles(tokens, n=3):
    if len(tokens) < n:
        return set(tokens)
    return {" ".join(tokens[i : i + n]) for i in range(len(tokens) - n + 1)}


def _jaccard(a, b):
    if not a or not b:
        return 0.0
    inter = len(a & b)
    if inter == 0:
        return 0.0
    return inter / len(a | b)


def _overlap(a, b):
    if not a or not b:
        return 0.0
    return len(a & b) / min(len(a), len(b))


class _UnionFind:
    def __init__(self, items):
        self.parent = {item: item for item in items}

    def find(self, item):
        while self.parent[item] != item:
            self.parent[item] = self.parent[self.parent[item]]
            item = self.parent[item]
        return item

    def union(self, left, right):
        root_left, root_right = self.find(left), self.find(right)
        if root_left != root_right:
            self.parent[root_right] = root_left


def _stable_id(prefix, members):
    raw = "|".join(sorted(members))
    return prefix + hashlib.sha256(raw.encode("utf-8")).hexdigest()[:6].upper()


def _bump(risk: str) -> str:
    return RISK_NAME[min(4, RISK_RANK.get(risk, 2) + 1)]


def link_posts(posts):
    """Mutates posts with cluster_id and entity_id. Returns clusters and entities."""
    flagged = [post for post in posts if post["flagged"]]
    features = {}
    token_sets = {}
    for post in flagged:
        tokens = _tokens(f"{post.get('text') or ''}\n{post.get('ocr_text') or ''}")
        features[post["id"]] = _shingles(tokens)
        token_sets[post["id"]] = set(tokens)

    def seller_keys(post):
        return {
            (item["kind"], item["normalized"])
            for item in post.get("identifiers") or []
            if item["kind"] in {"phone", "upi", "wallet", "telegram", "account"}
        }

    by_id = {post["id"]: post for post in flagged}
    cluster_uf = _UnionFind([post["id"] for post in flagged])
    pair_scores = []
    ids = [post["id"] for post in flagged]
    for i, left in enumerate(ids):
        for right in ids[i + 1 :]:
            score = _jaccard(features[left], features[right])
            cover = _overlap(features[left], features[right])
            token_cover = _overlap(token_sets[left], token_sets[right])
            same_seller = bool(seller_keys(by_id[left]) & seller_keys(by_id[right]))
            linked = (
                score >= 0.42
                or (min(len(features[left]), len(features[right])) >= 5 and cover >= 0.72)
                or token_cover >= 0.82
                or (same_seller and token_cover >= 0.6)
            )
            if linked:
                cluster_uf.union(left, right)
                pair_scores.append((left, right, round(max(score, cover, token_cover), 3)))

    groups = defaultdict(list)
    for post in flagged:
        groups[cluster_uf.find(post["id"])].append(post["id"])

    clusters = []
    cluster_of = {}
    for members in groups.values():
        if len(members) < 2:
            continue
        cid = _stable_id("CLU-", members)
        related = [score for left, right, score in pair_scores if left in members and right in members]
        summary_post = next(post for post in flagged if post["id"] == members[0])
        snippet = (summary_post.get("text") or summary_post.get("ocr_text") or "").strip().replace("\n", " ")
        clusters.append(
            {
                "id": cid,
                "size": len(members),
                "score": round(sum(related) / len(related), 3) if related else 1.0,
                "method": "text_shingle",
                "summary": snippet[:180],
                "post_ids": members,
            }
        )
        for member in members:
            cluster_of[member] = cid

    by_key = defaultdict(set)
    for post in flagged:
        for ident in post.get("identifiers") or []:
            if ident["kind"] in {"phone", "upi", "wallet", "telegram", "account"}:
                by_key[(ident["kind"], ident["normalized"])].add(post["id"])

    entity_uf = _UnionFind([post["id"] for post in flagged])
    for members in by_key.values():
        members = list(members)
        for other in members[1:]:
            entity_uf.union(members[0], other)

    entity_groups = defaultdict(list)
    for post in flagged:
        entity_groups[entity_uf.find(post["id"])].append(post)

    entities = []
    entity_of = {}
    for members in entity_groups.values():
        member_ids = [post["id"] for post in members]
        eid = _stable_id("ENT-", member_ids)
        channels = {post["channel_id"] for post in members}
        categories = sorted({post["category"] for post in members})
        risk = max(members, key=lambda post: RISK_RANK.get(post["risk"], 0))["risk"]
        if len(channels) >= 2 and risk != "CRITICAL":
            risk = _bump(risk)
        confidence = max(post["confidence"] for post in members)
        handle = next(
            (
                ident["value"]
                for post in members
                for ident in post.get("identifiers") or []
                if ident["kind"] == "telegram"
            ),
            None,
        )
        phone = next(
            (
                ident["value"]
                for post in members
                for ident in post.get("identifiers") or []
                if ident["kind"] == "phone"
            ),
            None,
        )
        label = handle or phone or members[0].get("author") or eid
        stamps = sorted(post["timestamp"] for post in members)
        entities.append(
            {
                "id": eid,
                "label": label,
                "risk": risk,
                "confidence": confidence,
                "post_count": len(members),
                "channel_count": len(channels),
                "categories": categories,
                "first_seen": stamps[0],
                "last_seen": stamps[-1],
                "post_ids": member_ids,
            }
        )
        for post in members:
            entity_of[post["id"]] = (eid, risk if len(channels) >= 2 else post["risk"])

    for post in posts:
        post["cluster_id"] = cluster_of.get(post["id"])
        if post["id"] in entity_of:
            eid, bumped = entity_of[post["id"]]
            post["entity_id"] = eid
            if RISK_RANK.get(bumped, 0) > RISK_RANK.get(post["risk"], 0):
                post["risk"] = bumped
                if post.get("financial_flag"):
                    post["financial_risk"] = bumped
        else:
            post["entity_id"] = None

    return clusters, entities
