"""Risk and anomaly checks over a client's ledger - Module 8.

Every check here is **unsupervised or rule-based**, and that is a deliberate
choice rather than a shortcut: there are no labelled fraud cases in this domain
to train a supervised model on. Manufacturing some would produce a model with
an impressive accuracy figure that means nothing, which is worse than no model.

What these checks are for is *directing attention*. The spec calls Module 8
"100% audit": the point is not that a machine decides what is fraudulent, but
that no transaction goes unexamined, and the ones with statistical reasons to
be suspicious reach a human first.

Each check reports its own statistics in ``Finding.evidence`` so the conclusion
can be argued with.
"""

from __future__ import annotations

import math
from collections import defaultdict
from datetime import timedelta
from decimal import Decimal

import numpy as np
from scipy import stats

from app.ml.risk.types import Finding, RiskCheck, RiskReport, Severity, Transaction

# ---------------------------------------------------------------- Benford ----

#: Benford's law: P(first digit = d) = log10(1 + 1/d).
BENFORD_EXPECTED: dict[int, float] = {d: math.log10(1 + 1 / d) for d in range(1, 10)}

#: Below this, the chi-square test on nine categories is not meaningful - the
#: expected count for digit 9 alone falls under 5, which violates the test's
#: assumption. Running Benford on 40 invoices and reporting a p-value is one of
#: the most common ways audit analytics produces confident nonsense.
BENFORD_MIN_SAMPLE = 150


def _first_digit(value: Decimal) -> int | None:
    digits = str(abs(value)).lstrip("0.")
    for char in digits:
        if char.isdigit() and char != "0":
            return int(char)
    return None


def check_benford(
    transactions: list[Transaction],
    *,
    alpha: float = 0.01,
) -> Finding | None:
    """Compare the first-digit distribution against Benford's law.

    Naturally occurring accounting amounts follow Benford closely; numbers a
    person invented usually do not, because people reach for digits in the
    middle of the range. A significant deviation does **not** mean fraud - it
    can equally mean the population is bounded (all invoices under a ₹50,000
    approval limit) or dominated by one repeated price. It means look.

    ``alpha`` is 0.01 rather than the conventional 0.05: at 0.05 roughly one
    clean period in twenty is flagged, and a check that cries wolf monthly gets
    switched off.
    """
    digits = [d for d in (_first_digit(t.amount) for t in transactions) if d is not None]
    if len(digits) < BENFORD_MIN_SAMPLE:
        return None

    n = len(digits)
    observed = np.array([digits.count(d) for d in range(1, 10)], dtype=float)
    expected = np.array([BENFORD_EXPECTED[d] * n for d in range(1, 10)])

    chi_square = float(((observed - expected) ** 2 / expected).sum())
    # 8 degrees of freedom: nine categories, one constraint (they sum to n).
    p_value = float(stats.chi2.sf(chi_square, df=8))

    if p_value >= alpha:
        return None

    # Which digits drive the deviation, as standardised residuals.
    residuals = (observed - expected) / np.sqrt(expected)
    worst = sorted(
        ((d, float(residuals[d - 1])) for d in range(1, 10)),
        key=lambda item: abs(item[1]),
        reverse=True,
    )[:3]
    worst_text = ", ".join(
        f"digit {d} appears {'more' if r > 0 else 'less'} often than expected "
        f"({abs(r):.1f} sd)"
        for d, r in worst
    )

    severity = Severity.HIGH if p_value < 0.001 else Severity.MEDIUM

    return Finding(
        check=RiskCheck.BENFORD_DEVIATION,
        severity=severity,
        title="First-digit distribution departs from Benford's law",
        detail=(
            f"Across {n} transactions, chi-square = {chi_square:.1f} "
            f"(p = {p_value:.2g}). {worst_text}. This is a reason to sample the "
            f"population, not a conclusion - a bounded approval limit or one "
            f"repeated price produces the same signal."
        ),
        score=min(100.0, 50.0 + 10.0 * math.log10(1 / max(p_value, 1e-12))),
        evidence={
            "n": n,
            "chi_square": round(chi_square, 3),
            "p_value": p_value,
            "alpha": alpha,
            "observed": {str(d): int(observed[d - 1]) for d in range(1, 10)},
            "expected": {str(d): round(float(expected[d - 1]), 1) for d in range(1, 10)},
            "standardised_residuals": {
                str(d): round(float(residuals[d - 1]), 2) for d in range(1, 10)
            },
        },
    )


# ------------------------------------------------------- duplicate payment ---


def check_duplicate_payments(
    transactions: list[Transaction],
    *,
    window_days: int = 30,
    min_amount: Decimal = Decimal("1000"),
) -> list[Finding]:
    """Same counterparty, same amount, close together.

    The commonest real error in accounts payable, and usually genuinely a
    double payment rather than anything sinister - an invoice paid once against
    the email and again against the posted copy.

    ``min_amount`` exists because small repeated amounts are overwhelmingly
    legitimate: a ₹200 daily cab fare to the same operator is not a duplicate.
    """
    groups: dict[tuple[str, Decimal], list[Transaction]] = defaultdict(list)
    for txn in transactions:
        if txn.direction == "DEBIT" and abs(txn.amount) >= min_amount:
            groups[(txn.counterparty.upper().strip(), abs(txn.amount))].append(txn)

    findings: list[Finding] = []

    for (counterparty, amount), members in groups.items():
        if len(members) < 2:
            continue
        members.sort(key=lambda t: t.txn_date)

        # Walk the sorted dates and keep runs that fall inside the window.
        cluster: list[Transaction] = [members[0]]
        for txn in members[1:]:
            if txn.txn_date - cluster[-1].txn_date <= timedelta(days=window_days):
                cluster.append(txn)
                continue
            if len(cluster) > 1:
                findings.append(_duplicate_finding(counterparty, amount, cluster, window_days))
            cluster = [txn]

        if len(cluster) > 1:
            findings.append(_duplicate_finding(counterparty, amount, cluster, window_days))

    return findings


def _duplicate_finding(
    counterparty: str,
    amount: Decimal,
    cluster: list[Transaction],
    window_days: int,
) -> Finding:
    count = len(cluster)
    span = (cluster[-1].txn_date - cluster[0].txn_date).days
    # Everything after the first payment is the potential overpayment.
    exposure = amount * (count - 1)

    severity = Severity.CRITICAL if count > 2 or amount >= Decimal("100000") else Severity.HIGH

    return Finding(
        check=RiskCheck.DUPLICATE_PAYMENT,
        severity=severity,
        title=f"{count} identical payments to {counterparty}",
        detail=(
            f"Rs {amount:,.2f} paid {count} times within {span} day(s) "
            f"({', '.join(t.txn_date.isoformat() for t in cluster)}). "
            f"If these are not separate invoices, Rs {exposure:,.2f} has been "
            f"overpaid and is recoverable."
        ),
        refs=[t.ref for t in cluster],
        amount=exposure,
        score=min(100.0, 60.0 + 15.0 * (count - 1)),
        evidence={
            "counterparty": counterparty,
            "amount": str(amount),
            "occurrences": count,
            "dates": [t.txn_date.isoformat() for t in cluster],
            "span_days": span,
            "window_days": window_days,
            "potential_overpayment": str(exposure),
        },
    )


# -------------------------------------------------------------- round sums ---


def check_round_sums(
    transactions: list[Transaction],
    *,
    min_amount: Decimal = Decimal("50000"),
    divisor: Decimal = Decimal("10000"),
    rate_threshold: float = 0.25,
) -> Finding | None:
    """An unusual concentration of suspiciously round amounts.

    Real invoices carry GST, so their totals are rarely round: 18% on anything
    produces awkward figures. A cluster of exact ₹50,000 and ₹1,00,000 debits
    suggests estimates, inter-party transfers or round-tripping rather than
    priced supply.

    Reported as *one* finding about a rate, not one per transaction - a single
    round payment is meaningless, and flagging each would drown the report.
    """
    large = [t for t in transactions if abs(t.amount) >= min_amount and t.direction == "DEBIT"]
    if len(large) < 10:
        return None

    round_ones = [t for t in large if abs(t.amount) % divisor == 0]
    rate = len(round_ones) / len(large)
    if rate < rate_threshold:
        return None

    exposure = sum((abs(t.amount) for t in round_ones), Decimal("0"))
    severity = Severity.HIGH if rate >= 0.5 else Severity.MEDIUM

    return Finding(
        check=RiskCheck.ROUND_SUM,
        severity=severity,
        title=f"{rate:.0%} of large payments are exact multiples of Rs {divisor:,.0f}",
        detail=(
            f"{len(round_ones)} of {len(large)} payments above Rs {min_amount:,.0f} "
            f"are exactly divisible by Rs {divisor:,.0f}, totalling "
            f"Rs {exposure:,.2f}. Invoices carrying GST rarely produce round "
            f"totals, so these are likely estimates or transfers rather than "
            f"priced supply - check that each has a tax invoice behind it."
        ),
        refs=[t.ref for t in round_ones],
        amount=exposure,
        score=min(100.0, 40.0 + rate * 60.0),
        evidence={
            "large_payments": len(large),
            "round_payments": len(round_ones),
            "rate": round(rate, 4),
            "threshold": rate_threshold,
            "divisor": str(divisor),
        },
    )


# ------------------------------------------------- vendor concentration ------


def check_vendor_concentration(
    transactions: list[Transaction],
    *,
    share_threshold: float = 0.40,
    min_vendors: int = 5,
) -> list[Finding]:
    """One counterparty taking an outsized share of total spend.

    Not an error - a manufacturer legitimately buys most of its input from one
    supplier. It is a *dependency* worth stating, and in a related-party
    context it is the first thing an auditor looks for.
    """
    spend: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    refs: dict[str, list[str]] = defaultdict(list)

    for txn in transactions:
        if txn.direction == "DEBIT":
            key = txn.counterparty.upper().strip()
            spend[key] += abs(txn.amount)
            refs[key].append(txn.ref)

    total = sum(spend.values(), Decimal("0"))
    if total == 0 or len(spend) < min_vendors:
        return []

    findings: list[Finding] = []
    for vendor, amount in sorted(spend.items(), key=lambda kv: kv[1], reverse=True):
        share = float(amount / total)
        if share < share_threshold:
            break  # sorted, so nothing after this qualifies either

        findings.append(
            Finding(
                check=RiskCheck.VENDOR_CONCENTRATION,
                severity=Severity.MEDIUM if share < 0.6 else Severity.HIGH,
                title=f"{vendor} accounts for {share:.0%} of total spend",
                detail=(
                    f"Rs {amount:,.2f} of Rs {total:,.2f} across {len(spend)} "
                    f"counterparties went to one party, over {len(refs[vendor])} "
                    f"transactions. Confirm this is an arm's-length trading "
                    f"relationship and not a related party requiring disclosure."
                ),
                refs=refs[vendor],
                amount=amount,
                score=min(100.0, share * 100.0),
                evidence={
                    "vendor": vendor,
                    "vendor_spend": str(amount),
                    "total_spend": str(total),
                    "share": round(share, 4),
                    "vendor_count": len(spend),
                    "transaction_count": len(refs[vendor]),
                },
            )
        )

    return findings


# ------------------------------------------------------------- weekend -------


def check_weekend_entries(
    transactions: list[Transaction],
    *,
    min_amount: Decimal = Decimal("25000"),
    rate_threshold: float = 0.15,
) -> Finding | None:
    """Large payments dated on a Saturday or Sunday.

    Banking channels run every day, so a weekend date is not impossible - but
    an approval-requiring payment dated when nobody is in the office is a
    control question. Reported as a rate for the same reason as round sums.
    """
    large = [t for t in transactions if abs(t.amount) >= min_amount and t.direction == "DEBIT"]
    if len(large) < 10:
        return None

    weekend = [t for t in large if t.txn_date.weekday() >= 5]
    rate = len(weekend) / len(large)
    if rate < rate_threshold or not weekend:
        return None

    exposure = sum((abs(t.amount) for t in weekend), Decimal("0"))

    return Finding(
        check=RiskCheck.WEEKEND_ENTRY,
        severity=Severity.MEDIUM,
        title=f"{len(weekend)} large payments dated at a weekend",
        detail=(
            f"{rate:.0%} of payments above Rs {min_amount:,.0f} are dated on a "
            f"Saturday or Sunday, totalling Rs {exposure:,.2f}. Confirm the "
            f"authorisation trail for payments made outside working hours."
        ),
        refs=[t.ref for t in weekend],
        amount=exposure,
        score=min(100.0, 30.0 + rate * 50.0),
        evidence={
            "large_payments": len(large),
            "weekend_payments": len(weekend),
            "rate": round(rate, 4),
            "dates": sorted({t.txn_date.isoformat() for t in weekend})[:20],
        },
    )


# ----------------------------------------------------------- back-dating -----


def check_backdated_entries(
    transactions: list[Transaction],
    *,
    lag_days: int = 45,
) -> Finding | None:
    """Entries recorded long after the date they claim.

    Only runs where ``entered_on`` is populated. A transaction dated in March
    and entered in June is how a period gets closed and then quietly reopened.
    """
    with_entry = [t for t in transactions if t.entered_on is not None]
    if not with_entry:
        return None

    backdated = [
        t for t in with_entry if (t.entered_on - t.txn_date).days > lag_days  # type: ignore[operator]
    ]
    if not backdated:
        return None

    exposure = sum((abs(t.amount) for t in backdated), Decimal("0"))
    worst = max(backdated, key=lambda t: (t.entered_on - t.txn_date).days)  # type: ignore[operator]
    worst_lag = (worst.entered_on - worst.txn_date).days  # type: ignore[operator]

    return Finding(
        check=RiskCheck.BACKDATED_ENTRY,
        severity=Severity.HIGH if worst_lag > 180 else Severity.MEDIUM,
        title=f"{len(backdated)} entries recorded more than {lag_days} days late",
        detail=(
            f"Rs {exposure:,.2f} was entered well after the transaction date; the "
            f"worst is {worst_lag} days ({worst.counterparty}, dated "
            f"{worst.txn_date.isoformat()}, entered "
            f"{worst.entered_on.isoformat()}). Check whether a closed period was "  # type: ignore[union-attr]
            f"reopened."
        ),
        refs=[t.ref for t in backdated],
        amount=exposure,
        score=min(100.0, 40.0 + worst_lag / 10.0),
        evidence={
            "count": len(backdated),
            "lag_days_threshold": lag_days,
            "worst_lag_days": worst_lag,
        },
    )


# --------------------------------------------------------- amount outliers ---

#: IsolationForest needs enough data to model normality. Below this the
#: "contamination" fraction would flag a couple of rows for no real reason.
OUTLIER_MIN_SAMPLE = 60


def check_amount_outliers(
    transactions: list[Transaction],
    *,
    contamination: float = 0.02,
    random_state: int = 20261025,
) -> list[Finding]:
    """Unusually large or oddly-shaped amounts, via IsolationForest.

    Fitted on ``log10(amount)`` plus the day of month. Logged because raw rupee
    amounts span five orders of magnitude and the forest would otherwise split
    almost entirely on scale, rediscovering "big payments are big".

    ``contamination`` is the share of rows the model is told to treat as
    anomalous - it is an instruction, not a discovery, which is why it is low
    and explicit. At 0.02 a 500-row period yields about ten findings, which a
    person can actually work through.
    """
    from sklearn.ensemble import IsolationForest

    usable = [t for t in transactions if abs(t.amount) > 0]
    if len(usable) < OUTLIER_MIN_SAMPLE:
        return []

    features = np.array(
        [
            [float(np.log10(float(abs(t.amount)) + 1.0)), float(t.txn_date.day)]
            for t in usable
        ]
    )

    forest = IsolationForest(
        contamination=contamination,
        random_state=random_state,
        n_estimators=200,
    )
    labels = forest.fit_predict(features)
    scores = forest.score_samples(features)

    median = float(np.median([float(abs(t.amount)) for t in usable]))
    findings: list[Finding] = []

    for txn, label, score in zip(usable, labels, scores, strict=True):
        if label != -1:
            continue
        multiple = float(abs(txn.amount)) / median if median else 0.0
        findings.append(
            Finding(
                check=RiskCheck.OUTLIER_AMOUNT,
                severity=Severity.MEDIUM if multiple < 20 else Severity.HIGH,
                title=f"Unusual amount: Rs {abs(txn.amount):,.2f} to {txn.counterparty}",
                detail=(
                    f"This transaction sits outside the normal pattern for the "
                    f"period - {multiple:.1f}x the median of Rs {median:,.2f}. "
                    f"Isolation score {score:.3f} (more negative is more unusual). "
                    f"Unusual is not wrong; confirm the supporting document."
                ),
                refs=[txn.ref],
                amount=abs(txn.amount),
                score=min(100.0, 30.0 + abs(score) * 60.0),
                evidence={
                    "isolation_score": round(float(score), 4),
                    "median_amount": round(median, 2),
                    "multiple_of_median": round(multiple, 2),
                    "contamination": contamination,
                    "sample_size": len(usable),
                },
            )
        )

    findings.sort(key=lambda f: f.score, reverse=True)
    return findings


# ----------------------------------------------------------------- runner ----


def analyse(transactions: list[Transaction], *, period: str = "") -> RiskReport:
    """Run every check and collect the findings.

    Checks that cannot run on this sample size are recorded in
    ``report.skipped`` with the reason. That matters: an empty result section
    looks like a pass, and "Benford needs 150 transactions, this period has 40"
    is something the reviewer has to know before concluding anything.
    """
    report = RiskReport(period=period, transactions_examined=len(transactions))

    benford = check_benford(transactions)
    if benford:
        report.findings.append(benford)
    elif len(transactions) < BENFORD_MIN_SAMPLE:
        report.skipped[RiskCheck.BENFORD_DEVIATION] = (
            f"needs at least {BENFORD_MIN_SAMPLE} transactions for the chi-square "
            f"test to be valid; this period has {len(transactions)}"
        )

    report.findings.extend(check_duplicate_payments(transactions))

    round_sums = check_round_sums(transactions)
    if round_sums:
        report.findings.append(round_sums)

    report.findings.extend(check_vendor_concentration(transactions))

    weekend = check_weekend_entries(transactions)
    if weekend:
        report.findings.append(weekend)

    backdated = check_backdated_entries(transactions)
    if backdated:
        report.findings.append(backdated)
    elif not any(t.entered_on for t in transactions):
        report.skipped[RiskCheck.BACKDATED_ENTRY] = (
            "no entry dates supplied, so recording lag cannot be measured"
        )

    outliers = check_amount_outliers(transactions)
    report.findings.extend(outliers)
    if not outliers and len(transactions) < OUTLIER_MIN_SAMPLE:
        report.skipped[RiskCheck.OUTLIER_AMOUNT] = (
            f"needs at least {OUTLIER_MIN_SAMPLE} transactions to model normality; "
            f"this period has {len(transactions)}"
        )

    severity_order = {
        Severity.CRITICAL: 0,
        Severity.HIGH: 1,
        Severity.MEDIUM: 2,
        Severity.LOW: 3,
    }
    report.findings.sort(key=lambda f: (severity_order[f.severity], -f.score))
    return report
