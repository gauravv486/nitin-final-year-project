"""Properties the generated dataset must hold.

These are the assertions that keep the reported metrics meaningful. If the
holdout split drifts or impossible rows appear, the accuracy figure stops
describing anything.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

from app.ml.ledger.chart import CLASSIFIABLE_CODES, is_classifiable

# The generator is a script, not a package module.
_SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "generate_dataset.py"
_spec = importlib.util.spec_from_file_location("generate_dataset", _SCRIPT)
assert _spec and _spec.loader
generate_dataset = importlib.util.module_from_spec(_spec)
sys.modules["generate_dataset"] = generate_dataset
_spec.loader.exec_module(generate_dataset)


@pytest.fixture(scope="module")
def generated():
    rows, bayes = generate_dataset.generate(
        rows=3000, seed=42, corrupt_rate=0.18, holdout_frac=0.2
    )
    return rows, bayes


class TestLabels:
    def test_every_label_is_classifiable(self, generated) -> None:
        """A label the chart marks unpredictable must never be a target.

        This caught a real bug: ambiguity relabelling was leaking Staff Welfare
        (classifiable=False) in with eight examples behind it.
        """
        rows, _ = generated
        offenders = {r["ledger_code"] for r in rows if not is_classifiable(r["ledger_code"])}
        assert not offenders, f"unpredictable labels present: {offenders}"

    def test_labels_are_within_the_declared_space(self, generated) -> None:
        rows, _ = generated
        assert {r["ledger_code"] for r in rows} <= set(CLASSIFIABLE_CODES)


class TestDirectionRealism:
    #: Templates that can only produce money leaving the account.
    DEBIT_ONLY = ("POS ", "DEBIT CARD", "ACH D", "NACH DR", "ECS DR", "CHQ PAID", "TRANSFER TO")

    def test_no_debit_only_template_on_a_credit_row(self, generated) -> None:
        """A card swipe cannot produce rental income.

        The channel tag is one of the strongest features available, so emitting
        `POS ... RENTAL INCOME` teaches the model a transaction shape that does
        not exist and costs real accuracy.
        """
        rows, _ = generated
        bad = [
            r
            for r in rows
            if r["direction"] == "CREDIT"
            and any(t in r["narration"].upper() for t in self.DEBIT_ONLY)
        ]
        assert not bad, f"{len(bad)} impossible rows, e.g. {bad[0]['narration']!r}"


class TestHoldoutSplit:
    def test_split_is_deterministic_across_runs(self) -> None:
        """Hash-based, not shuffled.

        Regenerating with a different row count must not move a row from test
        to train - otherwise last week's reported metric silently stops being
        reproducible.
        """
        small, _ = generate_dataset.generate(
            rows=1500, seed=7, corrupt_rate=0.0, holdout_frac=0.2
        )
        large, _ = generate_dataset.generate(
            rows=4500, seed=7, corrupt_rate=0.0, holdout_frac=0.2
        )
        large_lookup = {(r["narration"], r["ledger_code"]): r["is_holdout"] for r in large}

        shared = 0
        for row in small:
            key = (row["narration"], row["ledger_code"])
            if key in large_lookup:
                shared += 1
                assert large_lookup[key] == row["is_holdout"], f"split moved for {key}"
        assert shared > 50, "not enough overlap to make this a real check"

    def test_holdout_is_roughly_the_requested_fraction(self, generated) -> None:
        rows, _ = generated
        fraction = sum(int(r["is_holdout"]) for r in rows) / len(rows)
        assert 0.15 < fraction < 0.25

    def test_both_splits_are_populated(self, generated) -> None:
        rows, _ = generated
        assert any(int(r["is_holdout"]) for r in rows)
        assert any(not int(r["is_holdout"]) for r in rows)


class TestAmbiguity:
    def test_ceiling_is_below_one(self, generated) -> None:
        """Deliberate class overlap means part of the error is irreducible.

        A dataset where perfect accuracy is achievable is a dataset that
        flatters the model.
        """
        _, bayes = generated
        assert bayes, "no ambiguity measured - the overlap design is not working"
        assert 0.9 < bayes["overall_ceiling"] < 1.0
        assert bayes["ambiguous_ceiling"] < 0.9

    def test_ambiguous_rows_exist_and_are_flagged(self, generated) -> None:
        rows, _ = generated
        assert sum(int(r["ambiguous"]) for r in rows) > 0


class TestSchema:
    def test_required_columns_present(self, generated) -> None:
        rows, _ = generated
        expected = {
            "narration", "amount", "direction",
            "ledger_code", "source", "is_holdout", "ambiguous",
        }
        assert set(rows[0]) == expected

    def test_amounts_are_positive_numbers(self, generated) -> None:
        rows, _ = generated
        assert all(float(r["amount"]) > 0 for r in rows)

    def test_narrations_are_non_empty(self, generated) -> None:
        rows, _ = generated
        assert all(r["narration"].strip() for r in rows)

    def test_source_is_declared(self, generated) -> None:
        """Every row says where it came from, so the evaluation can report
        synthetic and curated performance separately rather than averaging a
        flattering number with a truthful one."""
        rows, _ = generated
        assert {r["source"] for r in rows} == {"synthetic"}
