"""Extract seller identifiers from public post text. Values are returned as observed."""

import re

PHONE_RE = re.compile(r"(?:\+?\s*91[\s\-]?)?(?<!\d)([6-9](?:[\s\-]?\d){9})(?!\d)")
UPI_RE = re.compile(r"\b([a-zA-Z0-9][\w.\-]{1,40}@[a-zA-Z][a-zA-Z0-9]{1,24})\b")
HANDLE_RE = re.compile(r"(?<!\w)@([A-Za-z][A-Za-z0-9_]{3,31})")
BTC_RE = re.compile(r"\b((?:bc1)[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{20,62})\b", re.I)
ETH_RE = re.compile(r"\b(0x[a-fA-F0-9]{40})\b")
IFSC_RE = re.compile(r"\b([A-Z]{4}0[A-Z0-9]{6})\b")
ACCOUNT_HINT = re.compile(r"account|a/c|ac\s*no", re.I)
ACCOUNT_RE = re.compile(r"(?<!\d)(\d{9,18})(?!\d)")
LOC_RES = [
    re.compile(r"sector\s*-?\s*\d{1,3}", re.I),
    re.compile(
        r"\b(jaipur|jodhpur|udaipur|ajmer|kota|vaishali nagar|mi road)\b",
        re.I,
    ),
]
EMAIL_HOSTS = {"gmail", "yahoo", "outlook", "hotmail", "proton", "icloud", "rediffmail"}
UPI_HOSTS = {
    "okdemo", "okaxis", "okhdfcbank", "oksbi", "okicici", "ybl", "paytm",
    "ibl", "axl", "upi", "apl", "waaxis", "wahdfcbank", "fbl", "pingpay",
}


def _phone_digits(raw: str):
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    if len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if len(digits) != 10 or digits[0] not in "6789":
        return None
    return digits


def _is_upi(value: str) -> bool:
    host = value.split("@", 1)[-1].lower()
    if host in EMAIL_HOSTS:
        return False
    return host in UPI_HOSTS or host.startswith("ok")


def extract_identifiers(text: str):
    if not text:
        return []
    found = []
    seen = set()

    def add(kind, value, normalized):
        key = (kind, normalized)
        if not normalized or key in seen:
            return
        seen.add(key)
        found.append({"kind": kind, "value": value.strip(), "normalized": normalized})

    phones = set()
    for match in PHONE_RE.finditer(text):
        digits = _phone_digits(match.group(1))
        if not digits:
            continue
        phones.add(digits)
        pretty = f"+91 {digits[:5]} {digits[5:]}"
        add("phone", pretty, "+91" + digits)

    for match in UPI_RE.finditer(text):
        value = match.group(1)
        if _is_upi(value):
            add("upi", value, value.lower())

    for match in HANDLE_RE.finditer(text):
        handle = match.group(1)
        add("telegram", "@" + handle, handle.lower())

    for regex, kind in ((BTC_RE, "wallet"), (ETH_RE, "wallet")):
        for match in regex.finditer(text):
            value = match.group(1)
            add(kind, value, value.lower())

    for match in IFSC_RE.finditer(text):
        add("ifsc", match.group(1), match.group(1).upper())

    if ACCOUNT_HINT.search(text):
        for match in ACCOUNT_RE.finditer(text):
            digits = match.group(1)
            if digits in phones or digits[-10:] in phones:
                continue
            add("account", digits, digits)

    for regex in LOC_RES:
        for match in regex.finditer(text):
            value = re.sub(r"\s+", " ", match.group(0)).strip()
            add("location", value, value.lower())

    return found
