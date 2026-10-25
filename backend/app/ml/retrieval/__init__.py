"""Retrieval over the case-law corpus - Phase 6.

Hybrid, because the two halves fail differently on legal text:

* **Lexical (BM25)** is exact. A query for "section 16(4)" must find passages
  that say 16(4), and an embedding model happily ranks 16(2) as a near-synonym.
  Statutory references are the single most important thing in a tax query.
* **Dense (sentence embeddings)** finds the passage that discusses "credit
  denied because the supplier never filed" when the judgment's words are
  "non-furnishing of return by the vendor".

Reciprocal rank fusion combines the rankings without having to calibrate two
incomparable score scales against each other.
"""
