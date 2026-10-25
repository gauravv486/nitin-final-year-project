# Ledger classification

Predicts the accounting ledger for a bank transaction from its narration,
amount and direction, and returns a **calibrated** confidence so that lines the
model is unsure about go to a human instead of into the books.

This replaces the `if "ZOMATO" in merchant: confidence = 0.95` in the original
`fastapi-ai-backend/services/transaction_ai.py`, which was a hardcoded lookup
table with invented confidence numbers attached.

---

## Results

Trained on 9,575 rows, evaluated on a 2,397-row frozen holdout, 41 classes.

| Metric | Value |
| --- | --- |
| Accuracy | **0.9787** |
| Macro F1 | **0.9768** |
| Expected calibration error | **0.0263** |

### The number that actually matters

Accuracy is the wrong headline. The model's job is not to be right about
everything — it is to be right about the lines it *claims* confidence on, and
to hand the rest over. That makes this the real result:

| Confidence threshold | Lines answered | Accuracy on those | Sent to a human |
| --- | --- | --- | --- |
| 0.00 (answer everything) | 100.0% | 0.9787 | 0 |
| 0.80 | 94.4% | 0.9969 | 134 |
| **0.90** (default) | **91.4%** | **0.9982** | **207** |
| 0.95 | 85.0% | 0.9980 | 359 |

At the default threshold the model books **91.4% of transactions unattended and
is wrong on 0.18% of them**, leaving 8.6% for review. That pair of numbers is
the product claim, and it is the one to put in the report.

### Calibration

The confidence is shown in the UI and compared against the auto-apply
threshold, so it has to mean something. Measured ECE is 0.0263, and the
reliability table shows the error is almost entirely in the *safe* direction —
the model is mildly under-confident at low confidences and nearly exact where
it matters, in the top bin where most predictions land.

An uncalibrated model would make the whole auto-apply design dishonest: a
threshold of 0.90 against a raw SVM margin means nothing at all.

---

## How it works

```
narration ──▶ parse ──▶ strip identifiers ──▶ TF-IDF (char + word)  ──┐
amount    ──────────────────────────────────▶ log10, scaled to [0,1] ──┼─▶ logistic
direction ──────────────────────────────────▶ one-hot                 ──┤   regression
channel   ◀── derived by the parser ────────▶ one-hot                 ──┘
```

Four feature blocks, each earning its place:

- **`char_wb` TF-IDF, 2–5 grams.** The workhorse. Narrations are short,
  abbreviated and corrupted, so character n-grams degrade gracefully where word
  features fall off a cliff — `TVS ATMBLS` (a vowel-stripped `TVS AUTOMOBILES`)
  shares most of its character grams with the clean form but not one whole word.
- **Word TF-IDF, 1–2 grams.** Carries multi-word merchant identity that
  character grams blur: `RELIANCE JIO` / `RELIANCE PETRO` / `RELIANCE DIGITAL`
  are three different ledgers and nearly the same character soup.
- **`log10(amount)`.** Genuinely discriminative, and demonstrably so — see the
  worked example below.
- **`direction` + `channel`.** An ACH debit is almost always a recurring bill.

### Why a linear model and not a transformer

The input is 100-character noisy strings, ~40 classes, ~10k examples. A linear
model over character n-grams is the established strong baseline for exactly
that shape. It also trains in two minutes on a CPU — which this machine is,
having no NVIDIA GPU — and its coefficients can be inspected to explain any
single prediction. That last point is not a nicety: a CA will ask why a line
was booked to a particular account, and "the network felt strongly" is not an
answer that survives an audit.

Three candidates are trained and compared every run:

| Model | Macro F1 | Accuracy | ECE |
| --- | --- | --- | --- |
| `logreg` ← selected | 0.9768 | 0.9787 | **0.0263** |
| `linear_svc` + Platt | 0.9788 | 0.9808 | 0.0388 |
| `complement_nb` | 0.9753 | 0.9758 | 0.0459 |

`linear_svc` has a 0.002 higher macro F1 — noise on a 2,400-row holdout — but
its calibration error is 47% worse. The selection rule in `select_best()`
therefore takes the best F1 and then breaks near-ties on calibration, which is
why `logreg` ships. Picking the other way would trade a real calibration loss
for an accuracy difference that is not real.

---

## Identifier stripping, and why it matters

`narration.py` removes UTR numbers, masked card digits, IFSC codes, VPAs, CPINs
and bare digit runs before vectorising.

Left in, a TF-IDF model happily learns that the 12-digit reference
`412345678901` means Swiggy. That is useless at serving time — the next Swiggy
payment has a different reference — and it inflates holdout accuracy, because
the same identifiers appear on both sides of the split. Stripping them is the
difference between a measurement and a flattering illusion.

`min_df=2` does the same job for whatever survives: a character n-gram seen
once is almost always identifier debris.

---

## A worked example

Identical narration, different amount:

```
POS 412345XXXXXX1234 AMAZON RETAIL BENGALURU   ₹1,250
  → Office Supplies           0.960   auto-applied
    next best: Computers & Peripherals (0.008)

POS 412345XXXXXX1234 AMAZON RETAIL BENGALURU   ₹68,000
  → Office Supplies           0.707   sent for review
    next best: Computers & Peripherals (0.214)
```

The amount feature moves `Computers & Peripherals` from 0.008 to 0.214 and
drops confidence below the threshold. That is the capitalise-or-expense
judgement, correctly identified as a human decision rather than guessed at.

And on something it has never seen:

```
TOTALLY UNKNOWN VENDOR XYZPQR   ₹5,000
  → 0.074   sent for review
```

It declines to guess. The original hardcoded version would have returned
`Suspense Account` with `confidence = 0.50` — a number with no meaning.

---

## The data, and its limits

**There is no public corpus** of Indian bank narrations labelled to a chart of
accounts, and real statements are client-confidential. So the training set is
synthetic — `scripts/generate_dataset.py` — and four things stop it being a toy:

1. **Real channel grammars.** Narrations are built from the formats Indian
   banks actually emit (UPI/NEFT/IMPS/RTGS/ACH/POS/cheque/ATM), not one
   template.
2. **Deliberate class overlap.** `AMAZON` is sampled across Office Supplies,
   Computers and Meals in realistic proportions, because in real books it
   genuinely spans all three. A generator with one merchant per class produces
   a linearly separable dataset and a model reporting 99% accuracy it will
   never see again.
3. **Corruption.** 18% of rows get truncation, OCR-style character
   substitution, eaten delimiters or vowel-stripping.
4. **A frozen holdout.** The split is decided by hashing each row's content,
   not by a random shuffle, so it cannot move between runs — regenerating with
   more rows does not shuffle previously held-out examples into training and
   quietly invalidate last week's metric.

The generator reports the accuracy ceiling implied by its own ambiguity:
**98.5% overall, 72.2% on the ambiguous rows.** The model scores 97.9%, which
is *below* the ceiling — confirming it is learning the patterns rather than
memorising identifiers. A reported accuracy above 98.5% would have been
evidence of a leak, not of a better model.

### A worked example of why the leak mattered

An earlier version of the parser scored 96.9% with ECE 0.031. Two bugs found by
`tests/test_narration.py`:

1. The VPA pattern allowed `-` in its local part, so it matched greedily across
   the delimiter — `TVS AUTOMOBILES-x@ybl` stripped **the merchant name** along
   with the address.
2. Letter+digit stubs (`HDFC0123`, a truncated `N098765432`) were neither a
   full IFSC nor a pure digit run, so they survived into the features as
   per-row noise.

Fixing both took accuracy to 97.9% and ECE to 0.026. Worth noting because the
naive expectation — removing features makes a model worse — is wrong here: the
first bug was destroying signal, and the second was diluting it.

### What this number cannot tell you

**Accuracy on synthetic data is an upper bound.** The vocabulary is finite, so
the model never meets a merchant it has not seen — and real statements are full
of them. Quote this as "96.9% on a synthetic holdout" and keep a hand-labelled
sample of real statements for the figure you actually claim. The caveat is
written into `artifacts/ledger_clf.meta.json` so it travels with the model.

### The data that will actually make this good

`journal_entries.overridden` is the most valuable column in the schema. Every
time a reviewer picks a different ledger from the one suggested, that is a real
labelled example of a real mistake. `ledger_training_examples.source`
distinguishes `synthetic` / `correction` / `curated` precisely so the
evaluation can report them separately instead of averaging a flattering number
with a truthful one.

---

## Running it

```bash
python scripts/generate_dataset.py --rows 12000     # ~2 seconds
python scripts/train_ledger_classifier.py           # ~2 minutes, CPU
```

Artifacts land in `artifacts/`:

| File | Purpose |
| --- | --- |
| `ledger_clf.joblib` | the fitted pipeline, loaded at app startup |
| `ledger_clf.meta.json` | version, classes, metrics, and the caveat |
| `ledger_clf.report.txt` | full evaluation, for the project report |

The version string (`ledger-clf-20261025-0051-logreg`) is written onto every
prediction in `journal_entries.model_version`, so a bad batch can always be
traced back to the model that produced it.

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/v1/ledger/classify` | one transaction |
| `POST` | `/api/v1/ledger/classify-batch` | up to 1,000; the real import path |
| `GET` | `/api/v1/ledger/parse` | narration parse only — the first thing to check when a prediction looks wrong |
| `GET` | `/api/v1/ledger/chart` | the chart, and which accounts the model may predict |

None of these need a database.

## Known weaknesses

Worst classes by F1, straight from the holdout:

| Code | Account | F1 | Why |
| --- | --- | --- | --- |
| 5310 | Office Supplies | 0.876 | shares AMAZON/FLIPKART/JIOMART with Computers and Meals |
| 6100 | Meals & Entertainment | 0.896 | the other side of that overlap |
| 2100 | Output GST Payable | 0.901 | precision 0.82 — over-predicted; GST/TDS/PF challans all read alike |
| 5320 | Postage & Courier | 0.906 | DELHIVERY and GATI do both parcels and freight |
| 6000 | Freight & Transport | 0.927 | the other side of that one |

These are the designed ambiguities, not surprises — the top confusions are
exactly `Meals ↔ Office Supplies` and `Postage ↔ Freight`. Most are also benign
in practice: two expense accounts a reviewer would accept either way. The
confusion worth watching is expense-vs-fixed-asset (`5310 → 1510`), because
that one misstates profit rather than just miscategorising cost.

## Not implemented

- **Per-firm fine-tuning.** The chart is firm-scoped, but one global model is
  trained. A firm's own corrections should eventually specialise it.
- **Active learning.** The review queue should be ordered by how much a label
  would teach the model, not just by confidence.
- **Counterparty memory.** Once a firm maps `DEEPAK STEEL` to `2000` three
  times, that should become a deterministic rule and bypass the model entirely.
  Cheaper and more accurate than any classifier for repeat payees.
