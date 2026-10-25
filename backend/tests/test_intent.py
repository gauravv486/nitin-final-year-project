"""The copilot's router: intent, refusal, and slot extraction.

The paraphrases below are deliberately *not* in the training utterances, so
this measures generalisation rather than recall.
"""

from __future__ import annotations

from datetime import date

import pytest

from app.ml import intent

HELD_OUT = [
    ("anything we missed filing?", "tasks_overdue"),
    ("which returns are late", "tasks_overdue"),
    ("what's coming up this week", "tasks_due_soon"),
    ("how much input credit could be denied", "itc_at_risk"),
    ("show 2b matching for arora trading", "recon_status"),
    ("any duplicate payments flagged", "risk_open"),
    ("entries the model was unsure about", "review_queue"),
    ("invoices waiting to be verified", "documents_review"),
    ("which notices need a reply", "notices_open"),
    ("gstin for gupta textiles", "client_lookup"),
    ("how many clients are there", "client_list"),
    ("pf payable for september", "payroll_summary"),
    ("can itc be reversed when the vendor defaults", "legal_question"),
]


def test_held_out_paraphrases() -> None:
    hits = sum(intent.classify(q).name == expected for q, expected in HELD_OUT)
    # Not 100%: a few-utterance router is not expected to be perfect, and a
    # test demanding it would just get the utterances tuned to the test.
    assert hits / len(HELD_OUT) >= 0.8, [
        (q, expected, intent.classify(q).name) for q, expected in HELD_OUT if intent.classify(q).name != expected
    ]


@pytest.mark.parametrize("question", ["tell me a joke please", "what's the weather in pune", "good evening"])
def test_out_of_scope_is_refused(question: str) -> None:
    assert not intent.classify(question).accepted


CLIENTS = [
    ("a", "Arora Trading", "Arora Trading Private Limited"),
    ("s", "Shah & Co", "Shah and Company"),
    ("g", "Gupta Textiles", "Gupta Textiles Private Limited"),
]


class TestSlots:
    def test_client_by_short_name(self) -> None:
        assert intent.match_client("overdue returns for gupta", CLIENTS)[0] == "g"

    def test_client_by_legal_name(self) -> None:
        assert intent.match_client("what is the pan of arora trading private limited", CLIENTS)[0] == "a"

    def test_short_name_does_not_match_a_similar_word(self) -> None:
        """'share' must not find Shah & Co."""
        assert intent.match_client("what share of itc is at risk", CLIENTS) is None

    @pytest.mark.parametrize(
        ("question", "period"),
        [
            ("payroll for september 2026", "2026-09"),
            ("recon for 2026-08", "2026-08"),
            ("itc for sept", "2026-09"),
            ("what was filed last month", "2026-09"),
        ],
    )
    def test_period(self, question: str, period: str) -> None:
        assert intent.extract_period(question, today=date(2026, 10, 25)) == period

    def test_future_month_without_a_year_means_last_year(self) -> None:
        """Asked in October, "december" is last December, not one to come."""
        assert intent.extract_period("itc for december", today=date(2026, 10, 25)) == "2025-12"

    @pytest.mark.parametrize(
        ("question", "form"),
        [("is gstr 3b overdue", "GSTR-3B"), ("gstr-1 due", "GSTR-1"), ("pf ecr this month", "PF ECR"), ("aoc4", "AOC-4")],
    )
    def test_form(self, question: str, form: str) -> None:
        assert intent.extract_form(question) == form
