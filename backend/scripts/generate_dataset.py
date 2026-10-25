#!/usr/bin/env python
"""Generate the synthetic (narration -> ledger) training set.

    python scripts/generate_dataset.py --rows 12000

Writes ``data/generated/ledger_train.csv`` with columns:
``narration, amount, direction, ledger_code, source, is_holdout, ambiguous``.

Why synthetic at all
--------------------
There is no public corpus of Indian bank narrations labelled to a chart of
accounts, and real statements are client-confidential. The honest options are a
synthetic set or no model, so: synthetic, declared as such, with the limits
stated.

What stops it being a toy
-------------------------
Four things, each of which makes the measured accuracy *lower* and more
truthful:

1. **Real channel grammars.** Narrations are built from the actual formats
   Indian banks emit (see ``app/ml/ledger/narration.py``), not from a single
   template.
2. **Deliberate class overlap.** Shared merchants like AMAZON are sampled
   across several ledgers in realistic proportions, so part of the error is
   irreducible by construction. ``--report-bayes`` prints that floor.
3. **Corruption.** A tunable share of rows get truncation, character typos,
   dropped spaces or vowel-stripping - the things OCR and bank exports
   actually do to text.
4. **A frozen holdout.** The split is decided by hashing the narration, not by
   a random shuffle, so it does not move between runs and a row can never
   migrate from test to train when the row count changes.

What it still cannot tell you
-----------------------------
Accuracy here is an upper bound. The vocabulary is finite, so the model never
meets a merchant it has not seen; real statements are full of them. Report this
number as "synthetic holdout" and keep a hand-labelled sample for the figure
you actually quote. See ``app/ml/ledger/README.md``.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import random
import sys
from collections import Counter
from pathlib import Path

# Allow `python scripts/generate_dataset.py` from the backend root.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.ml.ledger.chart import CLASSIFIABLE_CODES, name_for
from app.ml.ledger.vocabulary import (
    AMOUNT_BANDS,
    COUNTERPARTIES,
    DEFAULT_AMOUNT_BAND,
    DEFAULT_DIRECTION,
    DIRECTIONS,
    ambiguous_distribution,
)

# ------------------------------------------------------------- templates ----

#: Bank/IFSC prefixes, for the routing fragments inside narrations.
_BANKS = (
    ("HDFC", "HDFC0000"), ("ICIC", "ICIC0001"), ("SBIN", "SBIN0001"),
    ("UTIB", "UTIB0000"), ("KKBK", "KKBK0000"), ("PUNB", "PUNB0123"),
    ("BARB", "BARB0VJ"), ("IDIB", "IDIB000"), ("YESB", "YESB0000"),
)
_VPA_HANDLES = ("okhdfcbank", "oksbi", "okicici", "okaxis", "paytm", "ybl", "ibl", "axl")
_CITIES = (
    "MUMBAI", "PUNE", "BENGALURU", "CHENNAI", "HYDERABAD", "DELHI",
    "GURGAON", "NOIDA", "AHMEDABAD", "KOLKATA", "JAIPUR", "INDORE",
)

#: ``(weight, template, direction)``. ``{cp}`` is the counterparty; the other
#: placeholders are filled with plausible identifiers.
#:
#: Weights reflect how common each channel is in an SME current account: UPI
#: and NEFT dominate, RTGS is rare and large.
#:
#: ``direction`` restricts a template to money out, money in, or either. This
#: is not pedantry - a card swipe or a standing-instruction debit cannot
#: produce rental income, and a generator that emits
#: ``POS 5600XXXX1749 RENTAL INCOME`` teaches the model a transaction shape
#: that does not exist. The channel tag is one of the strongest features the
#: classifier has, so poisoning it costs real accuracy.
_DEBIT, _CREDIT, _EITHER = "DEBIT", "CREDIT", None

_TEMPLATES: tuple[tuple[int, str, str | None], ...] = (
    # UPI - the most common, and the most format-varied
    (14, "UPI/DR/{utr12}/{cp}/{bank}/{vpa}/Payment", _DEBIT),
    (10, "UPI-{cp}-{vpa}-{bank}0{n6}-{utr12}", _EITHER),
    (8, "UPI/{utr12}/Payment to {cp}/{bank}/{vpa}", _DEBIT),
    (6, "UPI/CR/{utr12}/{cp}/{bank}/{vpa}/UPI", _CREDIT),
    (5, "UPI/{cp}/{vpa}/{utr12}/NA", _EITHER),
    # NEFT
    (10, "NEFT DR-{ifsc}{n6}-{cp}-N{utr15}-PAYMENT", _DEBIT),
    (8, "NEFT-{ifsc}{n6}-{cp}-N{utr15}", _EITHER),
    (7, "NEFT Cr-{ifsc}{n6}-{cp}-{utr12}", _CREDIT),
    # IMPS - used in both directions
    (7, "IMPS-{utr12}-{cp}-{bank}-{masked}", _EITHER),
    (5, "IMPS/P2A/{utr12}/{cp}/{bank}", _EITHER),
    # RTGS - rare, high value
    (2, "RTGS-{bank}R{utr14}-{cp}-PAYMENT", _DEBIT),
    (1, "RTGS CR-{bank}R{utr14}-{cp}", _CREDIT),
    # ACH / mandates - recurring outgoings only
    (7, "ACH D- TP ACH {cp}-{utr10}", _DEBIT),
    (5, "ACH DR*{cp}*{utr10}", _DEBIT),
    (4, "NACH DR-{cp}-{utr10}", _DEBIT),
    (3, "ECS DR {cp} {utr10}", _DEBIT),
    # Cards - money out, always
    (6, "POS {masked} {cp} {city}", _DEBIT),
    (4, "DEBIT CARD PUR {n4} {cp} {city}", _DEBIT),
    (3, "ECOM PUR {masked} {cp}", _DEBIT),
    # Cheque
    (4, "CHQ PAID-{n6}-{cp}", _DEBIT),
    (3, "CLG/{n6}/{cp}", _EITHER),
    (3, "INWARD CLG-{n6}-{cp}", _CREDIT),
    # Bare - some banks emit almost nothing
    (6, "{cp}", _EITHER),
    (4, "{cp}-{city}", _EITHER),
    (3, "TRANSFER TO {cp}", _DEBIT),
    (2, "TRANSFER FROM {cp}", _CREDIT),
)

#: Channels whose narration never carries a counterparty name, so they get
#: their own templates keyed off the ledger's own vocabulary.
_SELF_TEMPLATES: dict[str, tuple[str, ...]] = {
    "5800": ("{cp}", "{cp}-{n4}", "BANK CHARGES-{cp}", "{cp} FOR {city}"),
    "4100": ("INT.PD:{d1} TO {d2}", "{cp}", "{cp}-{n6}", "INTEREST CREDIT {cp}"),
    "1000": ("{cp}-{city}", "ATW-{masked}-{bank} ATM {city}", "NWD-{masked}-{cp}", "{cp}"),
    "2100": ("{cp} CPIN {cpin}", "{cp}-{cpin}", "{cp}"),
    "2200": ("{cp} ITNS281 {utr10}", "{cp}-{utr10}", "{cp}"),
    "2310": ("{cp} ECR {utr10}", "{cp}-{n6}", "{cp}"),
    "2320": ("{cp}-{utr10}", "{cp} CHALLAN {n6}", "{cp}"),
    "2330": ("{cp}-{utr10}", "{cp} {city}", "{cp}"),
    "5810": ("{cp}", "{cp}-{n6}", "{cp} A/C {masked}"),
}


def _digits(rng: random.Random, n: int) -> str:
    return "".join(rng.choice("0123456789") for _ in range(n))


def _fill(template: str, counterparty: str, rng: random.Random) -> str:
    bank, ifsc = rng.choice(_BANKS)
    vpa_local = counterparty.split()[0].lower()[:12] or "user"
    return (
        template.replace("{cp}", counterparty)
        .replace("{bank}", bank)
        .replace("{ifsc}", ifsc)
        .replace("{vpa}", f"{vpa_local}@{rng.choice(_VPA_HANDLES)}")
        .replace("{city}", rng.choice(_CITIES))
        .replace("{utr15}", _digits(rng, 15))
        .replace("{utr14}", _digits(rng, 14))
        .replace("{utr12}", _digits(rng, 12))
        .replace("{utr10}", _digits(rng, 10))
        .replace("{cpin}", _digits(rng, 14))
        .replace("{masked}", f"{_digits(rng, 6)}XXXXXX{_digits(rng, 4)}")
        .replace("{n6}", _digits(rng, 6))
        .replace("{n4}", _digits(rng, 4))
        .replace("{d1}", f"{rng.randint(1, 28):02d}-{rng.randint(1, 12):02d}-2026")
        .replace("{d2}", f"{rng.randint(1, 28):02d}-{rng.randint(1, 12):02d}-2026")
    )


# ------------------------------------------------------------ corruption ----

def _corrupt(text: str, rng: random.Random) -> str:
    """Apply one realistic distortion.

    These are the four things that genuinely happen to narration text: bank
    exports truncate at a fixed width, OCR substitutes visually similar
    characters, delimiters get eaten, and some banks compress by dropping
    vowels. Training through them is what makes the model robust to a statement
    it has not seen the format of.
    """
    choice = rng.random()

    if choice < 0.35 and len(text) > 28:
        # Fixed-width truncation.
        return text[: rng.randint(24, max(25, len(text) - 2))]

    if choice < 0.60:
        # OCR-style character substitution.
        confusions = {"O": "0", "0": "O", "I": "1", "1": "I", "S": "5", "5": "S", "B": "8"}
        chars = list(text)
        for _ in range(rng.randint(1, 2)):
            positions = [i for i, c in enumerate(chars) if c.upper() in confusions]
            if not positions:
                break
            idx = rng.choice(positions)
            chars[idx] = confusions[chars[idx].upper()]
        return "".join(chars)

    if choice < 0.80:
        # Eaten delimiters.
        return text.replace("/", "", 1) if "/" in text else text.replace(" ", "", 1)

    # Vowel stripping, but only inside the longest word, so the line stays
    # recognisable the way a real compressed narration does.
    words = text.split()
    if words:
        longest = max(range(len(words)), key=lambda i: len(words[i]))
        if len(words[longest]) > 6:
            words[longest] = words[longest][0] + "".join(
                c for c in words[longest][1:] if c.upper() not in "AEIOU"
            )
    return " ".join(words)


# ---------------------------------------------------------------- split -----

#: Fast membership test for the label space, used when narrowing an ambiguous
#: merchant's distribution.
_CLASSIFIABLE_SET = frozenset(CLASSIFIABLE_CODES)


def _is_holdout(narration: str, ledger_code: str, holdout_frac: float) -> bool:
    """Deterministic split, keyed on the row's own content.

    Hash-based rather than ``train_test_split``: the assignment for a given
    narration never changes, so regenerating with ``--rows 20000`` does not
    shuffle previously-held-out rows into training and quietly invalidate the
    metric you reported last week.
    """
    digest = hashlib.sha256(f"{narration}|{ledger_code}".encode()).digest()
    bucket = int.from_bytes(digest[:4], "big") / 0xFFFFFFFF
    return bucket < holdout_frac


# ----------------------------------------------------------- generation -----

def generate(
    rows: int,
    seed: int,
    corrupt_rate: float,
    holdout_frac: float,
) -> tuple[list[dict], dict[str, float]]:
    rng = random.Random(seed)

    codes = [c for c in CLASSIFIABLE_CODES if c in COUNTERPARTIES]
    missing = [c for c in CLASSIFIABLE_CODES if c not in COUNTERPARTIES]
    if missing:
        print(
            f"note: {len(missing)} classifiable codes have no vocabulary and are "
            f"skipped: {', '.join(missing)}",
            file=sys.stderr,
        )

    # One weighted pool per direction, built once.
    pools: dict[str, list[str]] = {_DEBIT: [], _CREDIT: []}
    for weight, template, allowed in _TEMPLATES:
        for direction in (_DEBIT, _CREDIT):
            if allowed in (direction, _EITHER):
                pools[direction].extend([template] * weight)

    out: list[dict] = []
    per_class = max(1, rows // len(codes))

    for code in codes:
        names = COUNTERPARTIES[code]
        low, high = AMOUNT_BANDS.get(code, DEFAULT_AMOUNT_BAND)
        direction = DIRECTIONS.get(code, DEFAULT_DIRECTION)
        self_templates = _SELF_TEMPLATES.get(code)

        for _ in range(per_class):
            counterparty = rng.choice(names)

            # An ambiguous merchant is relabelled to whichever class it really
            # belongs to this time. This is what injects irreducible error.
            #
            # The distribution is restricted to classifiable codes first: some
            # shared merchants list a target the chart marks unpredictable
            # (URBAN COMPANY -> Staff Welfare), and letting that through would
            # create a label the model is not supposed to have, with a handful
            # of examples behind it.
            raw_dist = ambiguous_distribution(counterparty)
            dist = (
                {c: w for c, w in raw_dist.items() if c in _CLASSIFIABLE_SET}
                if raw_dist
                else None
            )
            if dist:
                label = rng.choices(list(dist), weights=list(dist.values()), k=1)[0]
                is_ambiguous = len(dist) > 1
            else:
                label = code
                is_ambiguous = False

            row_direction = DIRECTIONS.get(label, direction)
            template = (
                rng.choice(self_templates)
                if self_templates
                else rng.choice(pools[row_direction])
            )
            narration = _fill(template, counterparty, rng)

            if rng.random() < corrupt_rate:
                narration = _corrupt(narration, rng)

            # Log-uniform, so small amounts dominate the way they do in a real
            # statement instead of being spread evenly to the cap.
            band_low, band_high = AMOUNT_BANDS.get(label, (low, high))
            exponent = rng.uniform(0, 1)
            amount = round(band_low * (band_high / band_low) ** exponent, 2)

            out.append(
                {
                    "narration": narration,
                    "amount": f"{amount:.2f}",
                    "direction": row_direction,
                    "ledger_code": label,
                    "source": "synthetic",
                    "is_holdout": int(_is_holdout(narration, label, holdout_frac)),
                    "ambiguous": int(is_ambiguous),
                }
            )

    rng.shuffle(out)

    # Bayes-optimal accuracy on the ambiguous rows: the best any model can do
    # is to always answer each shared merchant's single most likely class, so
    # its expected accuracy on that merchant is max(distribution).
    #
    # The merchant has to be recovered by scanning every ambiguous name, not by
    # looking up the row's label: an AMAZON row relabelled to 1510 is no longer
    # in 1510's vocabulary, and keying off the label would silently score those
    # rows as unambiguous and inflate the ceiling.
    bayes: dict[str, float] = {}
    # Same narrowing as above, and renormalised: the ceiling has to be computed
    # over the distribution the generator actually sampled from, or it describes
    # a dataset that was never produced.
    narrowed: dict[str, dict[str, float]] = {}
    for names in COUNTERPARTIES.values():
        for name in names:
            raw = ambiguous_distribution(name)
            if not raw:
                continue
            kept = {c: w for c, w in raw.items() if c in _CLASSIFIABLE_SET}
            total = sum(kept.values())
            if len(kept) > 1 and total > 0:
                narrowed[name] = {c: w / total for c, w in kept.items()}

    # Longest first, so "AMAZON RETAIL" wins over "AMAZON".
    ambiguous_names = sorted(narrowed, key=len, reverse=True)
    ambiguous_rows = [r for r in out if r["ambiguous"]]

    if ambiguous_rows:
        best_possible = 0.0
        unmatched = 0
        for row in ambiguous_rows:
            upper = row["narration"].upper()
            for name in ambiguous_names:
                if name in upper:
                    best_possible += max(narrowed[name].values())
                    break
            else:
                # Corruption mangled the name past recognition. Counting it as
                # perfectly predictable would be the optimistic lie; treat it
                # as unrecoverable instead.
                unmatched += 1

        matched = len(ambiguous_rows) - unmatched
        bayes["ambiguous_rows"] = float(len(ambiguous_rows))
        bayes["ambiguous_unrecognisable"] = float(unmatched)
        if matched:
            bayes["ambiguous_ceiling"] = best_possible / matched
        bayes["overall_ceiling"] = (
            len(out) - len(ambiguous_rows) + best_possible
        ) / len(out)

    return out, bayes


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rows", type=int, default=12_000, help="approximate total rows")
    parser.add_argument("--seed", type=int, default=20261025)
    parser.add_argument(
        "--corrupt-rate",
        type=float,
        default=0.18,
        help="share of rows given a realistic distortion",
    )
    parser.add_argument("--holdout", type=float, default=0.20)
    parser.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "generated" / "ledger_train.csv",
    )
    args = parser.parse_args()

    if not 0.0 <= args.corrupt_rate <= 1.0:
        parser.error("--corrupt-rate must be between 0 and 1")
    if not 0.05 <= args.holdout <= 0.5:
        parser.error("--holdout must be between 0.05 and 0.5")

    rows, bayes = generate(args.rows, args.seed, args.corrupt_rate, args.holdout)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "narration", "amount", "direction",
                "ledger_code", "source", "is_holdout", "ambiguous",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)

    counts = Counter(r["ledger_code"] for r in rows)
    holdout = sum(int(r["is_holdout"]) for r in rows)

    print(f"wrote {len(rows):,} rows -> {args.out}")
    print(f"  classes      : {len(counts)}")
    print(f"  train/holdout: {len(rows) - holdout:,} / {holdout:,}")
    print(f"  corrupted    : ~{args.corrupt_rate:.0%}")
    if bayes:
        print(f"  ambiguous    : {int(bayes['ambiguous_rows']):,} rows")
        print(
            f"  accuracy ceiling from ambiguity alone: "
            f"{bayes['overall_ceiling']:.1%} overall, "
            f"{bayes['ambiguous_ceiling']:.1%} on ambiguous rows"
        )
        print("  (a model reporting above the overall ceiling is memorising identifiers)")

    print("\n  least represented classes:")
    for code, n in counts.most_common()[:-6:-1]:
        print(f"    {code} {name_for(code):<28} {n:>5}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
