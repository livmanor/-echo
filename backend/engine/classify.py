"""Slang and emoji lexicon blended with a Bernoulli naive Bayes model.

The lexicon decides whether a post is an illegal-sale advertisement.
The model breaks ties when more than one category matches, and it supplies
the confidence shown on the alert.
"""

import math
import re
from collections import Counter, defaultdict

CATEGORIES = [
    "drug_sale",
    "arms_sale",
    "fake_documents",
    "bank_account",
    "atm_card",
    "net_banking",
    "sim_card",
    "benign",
]

FINANCIAL = {"bank_account", "atm_card", "net_banking", "sim_card"}

# Term, weight. Latin terms match on word boundaries. Hindi and emoji match as substrings.
LEXICON = {
    "drug_sale": [
        ("maal", 3.0), ("mal", 2.4), ("माल", 3.2), ("ganja", 2.8), ("charas", 2.8),
        ("weed", 2.6), ("hash", 2.2), ("party pack", 2.6), ("white stuff", 2.6),
        ("party score", 2.4), ("होम डिलीवरी", 1.6), ("🍃", 1.6), ("💊", 2.2), ("❄️", 1.8),
    ],
    "arms_sale": [
        ("katta", 3.2), ("cartridge", 2.6), ("cartridges", 2.6), ("ammo", 2.6), ("🔫", 2.4),
    ],
    "fake_documents": [
        ("aadhaar", 2.2), ("aadhar", 2.2), ("passport and aadhaar", 2.4),
        ("driving licence", 1.6), ("lamination", 1.8), ("pvc", 1.4),
    ],
    "bank_account": [
        ("account for rent", 3.2), ("savings account", 2.4), ("current account", 2.2),
        ("kyc ready", 2.4), ("kyc done", 2.0), ("daily settlement", 2.6), ("mule", 2.4),
    ],
    "atm_card": [
        ("atm card", 2.6), ("atm debit", 2.6), ("debit card", 2.4),
        ("credit card", 2.6), ("physical card", 1.8), ("bank cards", 1.8),
    ],
    "net_banking": [
        ("net banking kit", 3.2), ("netbanking kit", 3.2), ("ready to operate", 1.6),
    ],
    "sim_card": [
        ("sim for rent", 2.6), ("prepaid sim", 2.2), ("otp sim", 2.4), ("fresh sim", 2.0),
        ("otp capable", 2.2),
    ],
}

FINANCIAL_INTENT = re.compile(
    r"for rent|for sale|kyc ready|kyc done|daily settlement|otp capable|ready to operate|in stock",
    re.I,
)
DOC_GATE = re.compile(r"pvc|print|lamination|passport|aadhaar|aadhar", re.I)
WORD_RE = re.compile(r"[\w@]+", re.UNICODE)
EMOJI_RE = re.compile(r"[\U0001F300-\U0001FAFF\u2600-\u27BF]")

RISK_BASE = {
    "drug_sale": "HIGH",
    "arms_sale": "CRITICAL",
    "fake_documents": "HIGH",
    "bank_account": "HIGH",
    "atm_card": "HIGH",
    "net_banking": "HIGH",
    "sim_card": "MEDIUM",
}

TRAINING = [
    ("pure maal available party pack home delivery", "drug_sale"),
    ("charas and ganja delivery tonight", "drug_sale"),
    ("माल उपलब्ध है होम डिलीवरी", "drug_sale"),
    ("party score white stuff 💊❄️", "drug_sale"),
    ("weed and hash delivery quality maal", "drug_sale"),
    ("ganja charas wallet payment", "drug_sale"),
    ("desi katta and cartridges in stock", "arms_sale"),
    ("ammo in stock cash meetup 🔫", "arms_sale"),
    ("katta available cartridges serious buyers", "arms_sale"),
    ("pvc aadhaar pan driving licence print", "fake_documents"),
    ("passport and aadhaar pvc lamination", "fake_documents"),
    ("aadhaar print ready same day", "fake_documents"),
    ("savings account for rent kyc ready daily settlement", "bank_account"),
    ("current account for rent net banking kit", "bank_account"),
    ("account for rent kyc ready", "bank_account"),
    ("savings account for rent fresh sim", "bank_account"),
    ("atm debit card for sale with pin", "atm_card"),
    ("credit card for sale physical card", "atm_card"),
    ("debit atm card for sale bank cards", "atm_card"),
    ("net banking kit for sale otp sim ready to operate", "net_banking"),
    ("netbanking kit for sale login ready", "net_banking"),
    ("fresh prepaid sim for rent otp capable", "sim_card"),
    ("otp sim for rent per day", "sim_card"),
    ("lost my phone near the mall please call", "benign"),
    ("hiring waiters for a cafe meals included", "benign"),
    ("flatmate needed rent share only", "benign"),
    ("chole bhature stall upi welcome food", "benign"),
    ("bank holiday branches closed atms may run out", "benign"),
    ("atm not working card swallowed", "benign"),
    ("lost my sim card do not share otp", "benign"),
    ("wedding photographer available portfolio", "benign"),
    ("textbook for sale library gate", "benign"),
]


def tokenize(text: str):
    raw = text or ""
    return WORD_RE.findall(raw.lower()) + EMOJI_RE.findall(raw)


def _term_hit(text: str, term: str) -> bool:
    if any(ord(ch) > 127 for ch in term):
        return term.casefold() in text.casefold()
    return re.search(rf"(?<!\w){re.escape(term)}(?!\w)", text, flags=re.I) is not None


class _Bayes:
    def __init__(self):
        self.present = defaultdict(Counter)
        self.docs = Counter()
        self.vocab = set()
        for text, label in TRAINING:
            self.docs[label] += 1
            for token in set(tokenize(text)):
                self.present[label][token] += 1
                self.vocab.add(token)

    def predict(self, text: str):
        tokens = set(tokenize(text))
        labels = list(self.docs)
        scores = {}
        for label in labels:
            prior = math.log((self.docs[label] + 1) / (sum(self.docs.values()) + len(labels)))
            total = self.docs[label]
            logp = prior
            for token in self.vocab:
                prob = (self.present[label][token] + 1) / (total + 2)
                logp += math.log(prob if token in tokens else (1 - prob))
            scores[label] = logp
        peak = max(scores.values())
        lifted = {label: math.exp(value - peak) for label, value in scores.items()}
        normal = sum(lifted.values()) or 1
        return {label: lifted[label] / normal for label in lifted}


MODEL = _Bayes()


def _lexicon_scores(text: str):
    scores = {category: 0.0 for category in LEXICON}
    hits = []
    lowered = text or ""
    for category, terms in LEXICON.items():
        for term, weight in terms:
            if _term_hit(lowered, term):
                scores[category] += weight
                hits.append({"term": term, "category": category, "weight": weight})
    if scores["fake_documents"] and not DOC_GATE.search(lowered):
        scores["fake_documents"] *= 0.25
    if any(scores[name] for name in FINANCIAL) and not FINANCIAL_INTENT.search(lowered):
        for name in FINANCIAL:
            scores[name] *= 0.3
    # A rent advertisement that also mentions a kit should stay on the account.
    if scores["bank_account"] >= 2.2 and scores["net_banking"]:
        scores["net_banking"] *= 0.45
    if scores["bank_account"] >= 2.2 and scores["sim_card"]:
        scores["sim_card"] *= 0.45
    return scores, hits


def classify_text(text: str):
    scores, hits = _lexicon_scores(text or "")
    probabilities = MODEL.predict(text or "")
    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    best, best_score = ranked[0]
    runner_up = ranked[1][1] if len(ranked) > 1 else 0
    if best_score < 2.2:
        category = "benign"
    elif runner_up >= 2.2 and abs(best_score - runner_up) < 0.8:
        contenders = [name for name, score in ranked if score >= 2.2]
        category = max(contenders, key=lambda name: probabilities.get(name, 0))
    else:
        category = best

    flagged = category != "benign"
    model_p = probabilities.get(category, 0)
    if flagged:
        confidence = int(min(97, max(58, 48 + best_score * 7 + model_p * 28)))
        risk = RISK_BASE[category]
        if category == "bank_account" and re.search(r"for rent|daily settlement|kyc ready", text or "", re.I):
            risk = "CRITICAL"
        if category == "sim_card" and re.search(r"otp", text or "", re.I):
            risk = "HIGH"
        if category == "net_banking":
            risk = "CRITICAL"
    else:
        confidence = int(max(50, min(96, probabilities.get("benign", 0.5) * 100)))
        risk = "LOW"

    financial_hits = [hit for hit in hits if hit["category"] in FINANCIAL and scores[hit["category"]] >= 2.2]
    financial_flag = flagged and category in FINANCIAL
    intent_found = FINANCIAL_INTENT.findall(text or "")
    evidence = []
    if financial_flag:
        evidence = sorted({hit["term"] for hit in financial_hits})
        evidence += [item.lower() for item in intent_found]
    reasons = []
    if flagged:
        shown = ", ".join(sorted({hit["term"] for hit in hits if hit["category"] == category}))
        reasons.append(f"Lexicon matched {category.replace('_', ' ')}: {shown}")
        reasons.append(f"Naive Bayes vote {category.replace('_', ' ')} at {round(model_p * 100)}%")
    else:
        reasons.append("No illegal-sale lexicon passed the threshold")

    return {
        "category": category,
        "confidence": confidence,
        "risk": risk,
        "flagged": flagged,
        "financial_flag": financial_flag,
        "financial_risk": risk if financial_flag else None,
        "financial_evidence": evidence,
        "lexicon_hits": sorted({hit["term"] for hit in hits if scores[hit["category"]] >= 1.4}),
        "reasons": reasons,
        "model": {name: round(prob, 4) for name, prob in probabilities.items()},
    }
