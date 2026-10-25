"""Risk and anomaly checks.

The important tests here are the *negative* ones: a check that fires on clean
data is worse than no check, because a reviewer who learns the report cries
wolf stops reading it.
"""

from __future__ import annotations

import random
from datetime import date
from decimal import Decimal

from app.ml.risk.checks import (
    BENFORD_MIN_SAMPLE,
    analyse,
    check_amount_outliers,
    check_backdated_entries,
    check_benford,
    check_duplicate_payments,
    check_round_sums,
    check_vendor_concentration,
    check_weekend_entries,
)
from app.ml.risk.types import RiskCheck, Severity, Transaction


def txn(
    ref: str,
    amount: str,
    *,
    counterparty: str = "ACME TRADERS",
    day: int = 10,
    month: int = 9,
    direction: str = "DEBIT",
    entered_on: date | None = None,
) -> Transaction:
    return Transaction(
        ref=ref,
        txn_date=date(2026, month, day),
        counterparty=counterparty,
        amount=Decimal(amount),
        direction=direction,
        entered_on=entered_on,
    )


def benford_like(n: int, seed: int = 1) -> list[Transaction]:
    """Amounts that genuinely follow Benford.

    Generated as 10**U where U is uniform - a scale-invariant distribution,
    which is exactly the condition under which Benford's law holds.
    """
    rng = random.Random(seed)
    out = []
    for i in range(n):
        value = 10 ** rng.uniform(2.0, 6.0)
        out.append(txn(f"t{i}", f"{value:.2f}", day=(i % 28) + 1))
    return out


class TestBenford:
    def test_silent_on_a_benford_population(self) -> None:
        """The negative case. A check that fires on clean data is useless."""
        assert check_benford(benford_like(600)) is None

    def test_detects_a_fabricated_population(self) -> None:
        """Invented numbers cluster in the middle of the digit range.

        Here every amount starts with 4, 5 or 6 - which Benford says should be
        about 22% of the population, not 100%.
        """
        rigged = [
            txn(f"t{i}", f"{rigged_amount}.00", day=(i % 28) + 1)
            for i, rigged_amount in enumerate(
                [random.Random(i).choice([42000, 51000, 65000]) for i in range(300)]
            )
        ]
        finding = check_benford(rigged)

        assert finding is not None
        assert finding.check is RiskCheck.BENFORD_DEVIATION
        assert finding.evidence["p_value"] < 0.01
        assert finding.evidence["n"] == 300

    def test_refuses_to_run_on_a_small_sample(self) -> None:
        """The statistical honesty guard.

        With 40 transactions the expected count for digit 9 is under 5, which
        breaks the chi-square assumption. Reporting a p-value anyway is how
        audit analytics produces confident nonsense.
        """
        assert check_benford(benford_like(40)) is None

    def test_skip_reason_is_reported_not_hidden(self) -> None:
        """An empty findings list looks like a pass, so the reason has to
        travel with the report."""
        report = analyse(benford_like(40), period="2026-09")

        assert RiskCheck.BENFORD_DEVIATION in report.skipped
        assert str(BENFORD_MIN_SAMPLE) in report.skipped[RiskCheck.BENFORD_DEVIATION]

    def test_evidence_is_defensible(self) -> None:
        """The finding has to be arguable, not just asserted."""
        rigged = [txn(f"t{i}", "45000.00", day=(i % 28) + 1) for i in range(200)]
        finding = check_benford(rigged)

        assert finding is not None
        for key in ("chi_square", "p_value", "observed", "expected", "standardised_residuals"):
            assert key in finding.evidence


class TestDuplicatePayments:
    def test_detects_a_double_payment(self) -> None:
        transactions = [
            txn("a", "45000", day=4),
            txn("b", "45000", day=11),
            txn("c", "12000", counterparty="OTHER", day=6),
        ]
        findings = check_duplicate_payments(transactions)

        assert len(findings) == 1
        assert findings[0].severity is Severity.HIGH
        # One payment is legitimate; only the second is the exposure.
        assert findings[0].amount == Decimal("45000")
        assert set(findings[0].refs) == {"a", "b"}

    def test_three_payments_is_critical_and_counts_two_as_exposure(self) -> None:
        transactions = [txn(r, "45000", day=d) for r, d in [("a", 4), ("b", 8), ("c", 14)]]
        finding = check_duplicate_payments(transactions)[0]

        assert finding.severity is Severity.CRITICAL
        assert finding.amount == Decimal("90000")

    def test_outside_the_window_is_not_a_duplicate(self) -> None:
        """A monthly retainer of the same amount is not a duplicate payment."""
        transactions = [
            txn("a", "45000", month=7, day=1),
            txn("b", "45000", month=9, day=1),
        ]
        assert check_duplicate_payments(transactions, window_days=30) == []

    def test_small_repeated_amounts_are_ignored(self) -> None:
        """A daily cab fare to the same operator is legitimate and would
        otherwise generate a finding every month."""
        transactions = [txn(f"t{i}", "200", counterparty="OLA", day=i + 1) for i in range(5)]
        assert check_duplicate_payments(transactions) == []

    def test_credits_are_ignored(self) -> None:
        transactions = [
            txn("a", "45000", day=4, direction="CREDIT"),
            txn("b", "45000", day=11, direction="CREDIT"),
        ]
        assert check_duplicate_payments(transactions) == []

    def test_different_counterparties_are_not_duplicates(self) -> None:
        transactions = [
            txn("a", "45000", counterparty="ALPHA", day=4),
            txn("b", "45000", counterparty="BETA", day=5),
        ]
        assert check_duplicate_payments(transactions) == []


class TestRoundSums:
    def test_detects_a_cluster_of_round_payments(self) -> None:
        transactions = [txn(f"r{i}", "100000", day=i + 1) for i in range(8)] + [
            txn(f"n{i}", f"{87431 + i * 137}", day=i + 1) for i in range(8)
        ]
        finding = check_round_sums(transactions)

        assert finding is not None
        assert finding.evidence["round_payments"] == 8
        assert finding.evidence["rate"] == 0.5

    def test_silent_when_amounts_look_like_real_invoices(self) -> None:
        """GST on anything produces awkward totals, so clean books have few
        round numbers."""
        transactions = [txn(f"t{i}", f"{59000 + i * 331}.40", day=i + 1) for i in range(20)]
        assert check_round_sums(transactions) is None

    def test_needs_enough_large_payments(self) -> None:
        transactions = [txn(f"t{i}", "100000", day=i + 1) for i in range(4)]
        assert check_round_sums(transactions) is None


class TestVendorConcentration:
    def test_detects_a_dominant_vendor(self) -> None:
        transactions = [txn("big", "900000", counterparty="DOMINANT")] + [
            txn(f"s{i}", "20000", counterparty=f"VENDOR{i}") for i in range(5)
        ]
        findings = check_vendor_concentration(transactions)

        assert len(findings) == 1
        assert findings[0].evidence["vendor"] == "DOMINANT"
        assert findings[0].evidence["share"] > 0.85
        assert findings[0].severity is Severity.HIGH

    def test_silent_on_a_spread_supplier_base(self) -> None:
        transactions = [txn(f"t{i}", "50000", counterparty=f"VENDOR{i}") for i in range(10)]
        assert check_vendor_concentration(transactions) == []

    def test_needs_a_minimum_number_of_vendors(self) -> None:
        """With two suppliers, one holding 60% is arithmetic, not a finding."""
        transactions = [
            txn("a", "60000", counterparty="ALPHA"),
            txn("b", "40000", counterparty="BETA"),
        ]
        assert check_vendor_concentration(transactions) == []


class TestWeekendEntries:
    def test_detects_weekend_payments(self) -> None:
        # September 2026: the 5th and 6th are Sat/Sun; 7-11 and 14-18 are the
        # two full working weeks. Listing the weekdays explicitly rather than
        # with arithmetic - an earlier version used `7 + i` and silently
        # included Saturday the 12th.
        weekend = [txn(f"w{i}", "60000", day=5 + (i % 2)) for i in range(6)]
        weekdays = [
            txn(f"d{i}", "60000", day=d)
            for i, d in enumerate([7, 8, 9, 10, 11, 14])
        ]
        finding = check_weekend_entries(weekend + weekdays)

        assert finding is not None
        assert finding.evidence["weekend_payments"] == 6
        assert finding.evidence["large_payments"] == 12

    def test_silent_on_weekday_only_books(self) -> None:
        # 2026-09-07 is a Monday; ten consecutive weekdays from there.
        transactions = [
            txn(f"t{i}", "60000", day=d)
            for i, d in enumerate([7, 8, 9, 10, 11, 14, 15, 16, 17, 18])
        ]
        assert check_weekend_entries(transactions) is None


class TestBackdatedEntries:
    def test_detects_a_late_entry(self) -> None:
        transactions = [
            txn("a", "50000", month=3, day=20, entered_on=date(2026, 9, 30)),
            txn("b", "10000", month=9, day=20, entered_on=date(2026, 9, 21)),
        ]
        finding = check_backdated_entries(transactions)

        assert finding is not None
        assert finding.refs == ["a"]
        assert finding.evidence["worst_lag_days"] > 180
        assert finding.severity is Severity.HIGH

    def test_silent_when_entries_are_prompt(self) -> None:
        transactions = [
            txn(f"t{i}", "50000", day=i + 1, entered_on=date(2026, 9, i + 3))
            for i in range(5)
        ]
        assert check_backdated_entries(transactions) is None

    def test_skipped_when_no_entry_dates_exist(self) -> None:
        report = analyse([txn(f"t{i}", "50000", day=i + 1) for i in range(5)])
        assert RiskCheck.BACKDATED_ENTRY in report.skipped


class TestAmountOutliers:
    def test_flags_an_extreme_value(self) -> None:
        transactions = [txn(f"t{i}", f"{45000 + i * 100}", day=(i % 28) + 1) for i in range(90)]
        transactions.append(txn("huge", "50000000", day=15))

        findings = check_amount_outliers(transactions)

        assert findings
        assert "huge" in {ref for f in findings for ref in f.refs}

    def test_refuses_to_run_on_a_small_sample(self) -> None:
        """Below the floor, `contamination` would flag rows for no reason other
        than having been told to flag 2% of them."""
        transactions = [txn(f"t{i}", f"{45000 + i}", day=(i % 28) + 1) for i in range(20)]
        assert check_amount_outliers(transactions) == []

    def test_is_deterministic(self) -> None:
        transactions = [txn(f"t{i}", f"{45000 + i * 77}", day=(i % 28) + 1) for i in range(100)]
        first = {ref for f in check_amount_outliers(transactions) for ref in f.refs}
        second = {ref for f in check_amount_outliers(transactions) for ref in f.refs}
        assert first == second


class TestReport:
    def test_findings_sort_worst_first(self) -> None:
        transactions = (
            [txn(r, "250000", day=d) for r, d in [("d1", 4), ("d2", 8), ("d3", 12)]]
            + [txn(f"v{i}", "20000", counterparty=f"VENDOR{i}") for i in range(6)]
        )
        report = analyse(transactions, period="2026-09")

        assert report.findings
        assert report.findings[0].severity is Severity.CRITICAL
        severities = [f.severity for f in report.findings]
        order = {Severity.CRITICAL: 0, Severity.HIGH: 1, Severity.MEDIUM: 2, Severity.LOW: 3}
        assert severities == sorted(severities, key=lambda s: order[s])

    def test_clean_books_produce_no_findings(self) -> None:
        """The headline negative test for the whole module."""
        rng = random.Random(7)
        transactions = [
            txn(
                f"t{i}",
                f"{10 ** rng.uniform(3.5, 5.5):.2f}",
                counterparty=f"VENDOR{i % 25}",
                # Weekdays only: 2026-09-07 is a Monday.
                day=[7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25][i % 15],
            )
            for i in range(200)
        ]
        report = analyse(transactions, period="2026-09")

        serious = [
            f for f in report.findings
            if f.severity in (Severity.CRITICAL, Severity.HIGH)
            and f.check is not RiskCheck.OUTLIER_AMOUNT
        ]
        assert not serious, f"false positives on clean books: {[f.title for f in serious]}"

    def test_headline_is_informative(self) -> None:
        report = analyse(benford_like(200), period="2026-09")
        assert "2026-09" in report.headline()
        assert "200 transactions" in report.headline()

    def test_every_finding_has_evidence_and_a_bounded_score(self) -> None:
        transactions = [txn(r, "250000", day=d) for r, d in [("a", 4), ("b", 9)]] + [
            txn(f"v{i}", "15000", counterparty=f"VENDOR{i}") for i in range(6)
        ]
        report = analyse(transactions)

        for finding in report.findings:
            assert finding.evidence, f"{finding.check} has no evidence"
            assert 0.0 <= finding.score <= 100.0
            assert len(finding.detail) > 30
