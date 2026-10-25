"""Copilot intent classification - Module 12.

The copilot answers data questions by running one of a fixed set of vetted,
parameterised queries. It never generates SQL. Text-to-SQL over a multi-tenant
database is one prompt injection away from reading another firm's clients, and
"the model wrote a slightly wrong JOIN" is an unacceptable failure mode for
numbers a CA will repeat to a client.

So the language problem is reduced to classification: which of ~12 questions
is being asked, and with which slots (client, period, form). A small TF-IDF +
logistic-regression model does that well, trains in well under a second on
the utterances below, and - crucially - can say "none of these" through an
explicit out-of-scope class and a confidence floor.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date
from functools import lru_cache

from rapidfuzz import fuzz
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import FeatureUnion, Pipeline

#: Below this the copilot declines and lists what it can answer.
CONFIDENCE_FLOOR = 0.40

UTTERANCES: dict[str, list[str]] = {
    "tasks_overdue": [
        "which returns are overdue", "show overdue filings", "what is overdue", "list late returns",
        "which deadlines have we missed", "overdue compliance tasks", "anything past due",
        "what filings are late for {client}", "missed due dates", "overdue gst returns",
        "show me everything that is overdue", "which clients have overdue tasks",
    ],
    "tasks_due_soon": [
        "what is due this week", "upcoming deadlines", "what's due in the next 7 days",
        "returns due soon", "which filings are due next week", "show upcoming compliance",
        "what do we need to file this week", "deadlines coming up", "due dates for {client}",
        "what is due for {client} this month", "pending returns for {client}", "next due dates",
        "what gstr-3b is due", "when is tds return due",
    ],
    "itc_at_risk": [
        "how much itc is at risk", "itc at risk", "input tax credit at risk",
        "which clients have itc at risk", "how much credit could be disallowed",
        "itc at risk for {client}", "total itc exposure", "unsupported input tax credit",
        "credit not in gstr-2b", "how much gst credit is not supported by 2b",
    ],
    "recon_status": [
        "reconciliation status", "gstr-2b reconciliation for {client}", "show the reconciliation",
        "how many invoices matched", "2b match rate", "reconciliation summary for {client} september",
        "is {client} reconciled", "mismatched invoices for {client}", "invoices missing in 2b",
        "invoices not in books",
    ],
    "risk_open": [
        "open risk findings", "show risk flags", "any red flags", "high severity findings",
        "duplicate payments", "anomalies in {client}'s books", "what did the risk checks find",
        "suspicious transactions", "benford results", "show fraud risk alerts",
        "risk findings for {client}", "round sum payments",
    ],
    "review_queue": [
        "transactions needing review", "entries awaiting review", "unclassified transactions",
        "what does the classifier need help with", "ledger review queue", "low confidence entries",
        "bank entries to approve for {client}", "how many entries are pending review",
        "which transactions were not auto applied", "bookkeeping queue",
    ],
    "documents_review": [
        "documents needing review", "which invoices need verification", "unverified documents",
        "uploads to check", "documents pending review for {client}", "extraction results to verify",
        "low confidence extractions", "failed documents", "what has the client uploaded",
        "show recent uploads",
    ],
    "notices_open": [
        "open notices", "notices due for reply", "which notices are pending", "upcoming hearings",
        "show tax notices", "notices for {client}", "gst notices", "income tax notices pending",
        "what replies are due", "notice deadlines", "any demand notices",
    ],
    "client_lookup": [
        "what is the gstin of {client}", "pan of {client}", "show {client} details",
        "who manages {client}", "contact details for {client}", "cin of {client}",
        "tell me about {client}", "{client} gstin", "entity type of {client}", "{client} profile",
    ],
    "client_list": [
        "list all clients", "how many clients do we have", "show my clients", "client list",
        "which clients do i manage", "active clients", "show the portfolio", "all companies we act for",
    ],
    "payroll_summary": [
        "payroll summary", "salary run for {client}", "how much pf is payable", "esi contribution this month",
        "payroll for {client} september", "professional tax payable", "tds on salaries", "net pay total",
        "show payroll runs",
    ],
    "legal_question": [
        "is itc allowed if the supplier did not file gstr-1", "time limit for claiming itc under section 16(4)",
        "can a notice under section 73 be issued after three years", "what is the penalty under section 122",
        "case law on reassessment under section 148", "is interest payable on delayed refund",
        "judgments on cash deposits during demonetisation", "can itc be denied for supplier default",
        "what did the supreme court say about section 16(2)(c)", "limitation for show cause notice",
        "is a personal hearing mandatory before passing an order", "precedent on fake invoices",
        "rule 36(4) restriction on credit", "addition under section 68 for unexplained credits",
        "is gst payable on liquidated damages", "rulings on place of supply",
    ],
    "out_of_scope": [
        "tell me a joke", "what is the weather today", "write a poem", "who won the cricket match",
        "hello", "how are you", "what is your name", "book a flight", "play some music",
        "translate this to french", "what is the capital of france", "recommend a movie",
        "thanks", "good morning",
    ],
}

INTENT_LABELS = {
    "tasks_overdue": "Overdue filings",
    "tasks_due_soon": "Upcoming deadlines",
    "itc_at_risk": "ITC at risk",
    "recon_status": "GSTR-2B reconciliation",
    "risk_open": "Risk findings",
    "review_queue": "Ledger review queue",
    "documents_review": "Documents to verify",
    "notices_open": "Open notices",
    "client_lookup": "Client details",
    "client_list": "Client list",
    "payroll_summary": "Payroll",
    "legal_question": "Case-law research",
}

_SAMPLE_CLIENTS = ("arora trading", "mehta enterprises", "gupta textiles", "krishna logistics", "shah and co")


def training_set() -> tuple[list[str], list[str]]:
    texts, labels = [], []
    for intent, examples in UTTERANCES.items():
        for example in examples:
            if "{client}" in example:
                # Expand with several names so the model learns the frame,
                # not one particular client.
                for name in _SAMPLE_CLIENTS:
                    texts.append(example.format(client=name))
                    labels.append(intent)
            else:
                texts.append(example)
                labels.append(intent)
    return texts, labels


@lru_cache(maxsize=1)
def classifier() -> Pipeline:
    texts, labels = training_set()
    pipeline = Pipeline(
        [
            (
                "features",
                FeatureUnion(
                    [
                        ("words", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, min_df=1)),
                        ("chars", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True)),
                    ]
                ),
            ),
            ("clf", LogisticRegression(C=8.0, max_iter=3000)),
        ]
    )
    pipeline.fit(texts, labels)
    return pipeline


@dataclass(slots=True)
class Intent:
    name: str
    confidence: float
    alternatives: list[tuple[str, float]] = field(default_factory=list)

    @property
    def accepted(self) -> bool:
        return self.name != "out_of_scope" and self.confidence >= CONFIDENCE_FLOOR


def classify(question: str) -> Intent:
    model = classifier()
    probabilities = model.predict_proba([question.lower()])[0]
    ranked = sorted(zip(model.classes_, probabilities, strict=True), key=lambda kv: -kv[1])
    best, confidence = ranked[0]
    return Intent(
        name=str(best),
        confidence=round(float(confidence), 4),
        alternatives=[(str(n), round(float(p), 4)) for n, p in ranked[1:4]],
    )


# ----------------------------------------------------------------- slots ----

_MONTHS = {
    m: i
    for i, names in enumerate(
        [("jan", "january"), ("feb", "february"), ("mar", "march"), ("apr", "april"), ("may",),
         ("jun", "june"), ("jul", "july"), ("aug", "august"), ("sep", "sept", "september"),
         ("oct", "october"), ("nov", "november"), ("dec", "december")],
        start=1,
    )
    for m in names
}
_FORM_RE = re.compile(
    r"\b(gstr-?\s?(?:1|3b|9c?|2b)|tds\s?(?:24q|26q|27q)?|pf\s?ecr|esi|aoc-?4|mgt-?7a?|itr-?\d|dir-?3\s?kyc|adt-?1|pmt-?06)\b",
    re.IGNORECASE,
)


def extract_period(question: str, today: date | None = None) -> str | None:
    today = today or date.today()
    lower = question.lower()
    iso = re.search(r"\b(20\d{2})-(0[1-9]|1[0-2])\b", lower)
    if iso:
        return f"{iso.group(1)}-{iso.group(2)}"
    if "last month" in lower or "previous month" in lower:
        year, month = (today.year, today.month - 1) if today.month > 1 else (today.year - 1, 12)
        return f"{year:04d}-{month:02d}"
    if "this month" in lower:
        return f"{today.year:04d}-{today.month:02d}"
    for word in re.findall(r"[a-z]+", lower):
        if word in _MONTHS:
            month = _MONTHS[word]
            year_match = re.search(r"\b(20\d{2})\b", lower)
            year = int(year_match.group(1)) if year_match else (today.year if month <= today.month else today.year - 1)
            return f"{year:04d}-{month:02d}"
    return None


def extract_form(question: str) -> str | None:
    match = _FORM_RE.search(question)
    if not match:
        return None
    raw = re.sub(r"\s+", "", match.group(1).upper())
    for prefix in ("GSTR", "AOC", "MGT", "ITR", "ADT", "PMT"):
        if raw.startswith(prefix) and "-" not in raw:
            raw = raw.replace(prefix, f"{prefix}-", 1)
    return {"PFECR": "PF ECR", "TDS24Q": "TDS 24Q", "TDS26Q": "TDS 26Q", "DIR-3KYC": "DIR-3 KYC"}.get(raw, raw)


#: First words too common to identify a client on their own.
_GENERIC_FIRST = {"shree", "shri", "sri", "new", "the", "india", "indian", "national", "global", "united"}


def _core(name: str) -> str:
    core = re.sub(r"[&.]", " ", name.lower())
    core = re.sub(r"\b(private|pvt|limited|ltd|llp|and|co|company)\b", " ", core)
    return re.sub(r"\s+", " ", core).strip()


def match_client(question: str, clients: list[tuple[object, str, str]]) -> tuple[object, str, float] | None:
    """Best client named in the question: ``(id, name, score)``.

    Two tests, either sufficient: the whole core name appears (partial ratio
    >= 85), or the name's distinctive first word appears as a word of its own
    (ratio >= 90) - people say "Gupta", not "Gupta Textiles Private Limited".
    The word test is what keeps "share" from finding Shah & Co: against
    "shah" it scores 67, nowhere near 90.
    """
    lower = question.lower()
    words = re.findall(r"[a-z0-9]+", lower)
    best = None
    for client_id, name, legal in clients:
        score = 0.0
        for candidate in (name, legal):
            core = _core(candidate)
            if len(core) < 3:
                continue
            score = max(score, fuzz.partial_ratio(core, lower) if len(core) >= 6 else 0)
            first = core.split(" ")[0]
            if len(first) >= 4 and first not in _GENERIC_FIRST:
                token = max((fuzz.ratio(first, w) for w in words), default=0)
                if token >= 90:
                    score = max(score, token)
        if score >= 85 and (best is None or score > best[2]):
            best = (client_id, name, float(score))
    return best
