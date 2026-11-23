"""Check the sample corpus classifies, extracts, and links as the demo expects."""

import os
import tempfile

os.environ["MONITOR_DB"] = os.path.join(tempfile.gettempdir(), "echo-monitor-selfcheck.db")
if os.path.exists(os.environ["MONITOR_DB"]):
    os.remove(os.environ["MONITOR_DB"])

from engine.classify import classify_text
from engine.pipeline import analyze_posts, agreement
from sample_corpus import CHANNELS, corpus_posts

posts, clusters, entities = analyze_posts(corpus_posts())
by_id = {post["id"]: post for post in posts}
metrics = agreement()
print("agreement", metrics)

mismatches = [
    (post["id"], post["gold_label"], post["category"], post["flagged"], post["lexicon_hits"])
    for post in posts
    if post["category"] != post["gold_label"]
]
print("mismatches", mismatches)

assert metrics["false_positives"] == 0, metrics
assert metrics["missed"] == 0, metrics
assert metrics["sample_agreement"] >= 0.9, metrics

phone = next(item for item in by_id["P-001"]["identifiers"] if item["kind"] == "phone")
assert phone["normalized"] == "+919999910021"
assert by_id["P-001"]["entity_id"] == by_id["P-002"]["entity_id"] == by_id["P-030"]["entity_id"]
assert by_id["P-001"]["entity_id"] == by_id["P-028"]["entity_id"]
assert by_id["P-007"]["entity_id"] == by_id["P-008"]["entity_id"] == by_id["P-027"]["entity_id"]
assert by_id["P-004"]["entity_id"] == by_id["P-026"]["entity_id"]
assert by_id["P-021"]["flagged"] is False
assert any(item["kind"] == "upi" for item in by_id["P-021"]["identifiers"])
assert by_id["P-022"]["flagged"] is False
assert by_id["P-023"]["flagged"] is False
assert by_id["P-024"]["flagged"] is False
assert by_id["P-027"]["category"] == "bank_account"
assert by_id["P-027"]["financial_flag"] is True
assert any(item["kind"] == "wallet" for item in by_id["P-031"]["identifiers"])
assert any(cluster["size"] >= 2 for cluster in clusters)
assert len(entities) >= 6
assert len(CHANNELS) == 4

sandbox = classify_text("Lost my SIM card. Please block it.")
assert sandbox["flagged"] is False, sandbox
print("clusters", [(c["id"], c["size"], c["score"]) for c in clusters])
print("entities", [(e["id"], e["label"], e["risk"], e["channel_count"], e["post_count"]) for e in entities])
print("selfcheck ok")
