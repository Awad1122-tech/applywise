import hashlib
import re


def normalise(text: str) -> str:
    noise = {"ltd", "limited", "plc", "inc", "llc", "uk", "the", "a", "an", "and", "&"}
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    tokens = [t for t in text.split() if t not in noise]
    return " ".join(sorted(tokens))


def make_fingerprint(company: str, role: str) -> str:
    combined = normalise(company) + "|" + normalise(role)
    return hashlib.sha256(combined.encode()).hexdigest()[:16]