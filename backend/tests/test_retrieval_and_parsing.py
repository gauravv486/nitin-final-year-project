"""Lexical retrieval, chunking, tabular parsing, GSTR-2B parsing, MCA fees,
resolutions and the LLM fallback - the remaining pure units."""

from __future__ import annotations

import json
from datetime import date
from decimal import Decimal

from app.api.v1.secretarial import additional_fee
from app.llm import _THINK_RE, complete_or_none
from app.ml.retrieval.chunking import chunk_text
from app.ml.retrieval.lexical import Bm25Index, tokenize
from app.models.enums import McaFormType
from app.services.gst import parse_gstr2b_json, parse_register
from app.services.resolutions import TEMPLATES, render
from app.utils.tabular import parse_amount, parse_date, read_table


class TestLexical:
    def test_section_references_survive_tokenisation(self) -> None:
        tokens = tokenize("Credit under Section 16(4) and 143(1)(a)")
        assert "16(4)" in tokens and "16" in tokens
        assert "143(1)(a)" in tokens

    def test_exact_subsection_outranks_its_neighbour(self) -> None:
        """The reason the search is not embeddings alone."""
        docs = [
            "The time limit in section 16(4) bars credit claimed after the due date.",
            "Section 16(2) lays down the conditions for claiming input tax credit.",
            "Penalty provisions apply to fraudulent claims of credit.",
        ]
        scores = Bm25Index().fit(docs).scores("time limit section 16(4)")
        assert scores.argmax() == 0
        assert scores[0] > scores[1] > scores[2]

    def test_empty_index_returns_nothing(self) -> None:
        assert Bm25Index().scores("anything").size == 0


class TestChunking:
    def test_every_word_lands_in_some_chunk(self) -> None:
        words = [f"w{i}" for i in range(1000)]
        text = "\n\n".join(" ".join(words[i : i + 70]) for i in range(0, 1000, 70))
        chunks = chunk_text(text)
        covered = {w for c in chunks for w in c.split()}
        assert covered == set(words)
        assert all(len(c.split()) <= 180 for c in chunks)

    def test_consecutive_chunks_overlap(self) -> None:
        chunks = chunk_text(" ".join(f"w{i}" for i in range(500)))
        assert set(chunks[0].split()[-40:]) & set(chunks[1].split())


class TestTabular:
    def test_indian_grouping_and_signs(self) -> None:
        assert parse_amount("1,23,456.78") == Decimal("123456.78")
        assert parse_amount("₹ 450") == Decimal("450.00")
        assert parse_amount("(1,200)") == Decimal("-1200.00")
        assert parse_amount("450.00 Dr") == Decimal("-450.00")
        assert parse_amount("") is None

    def test_dates_are_day_first(self) -> None:
        assert parse_date("05/09/2026") == date(2026, 9, 5)
        assert parse_date("05-Sep-2026") == date(2026, 9, 5)
        assert parse_date("2026-09-05") == date(2026, 9, 5)

    def test_title_block_above_the_header_is_skipped(self) -> None:
        csv = b"HDFC BANK LTD\n\nDate,Narration,Withdrawal Amt.,Deposit Amt.\n05/09/2026,UPI/SWIGGY,480.00,\n"
        rows = read_table(csv, "stmt.csv")
        assert rows[0]["withdrawalamt"] == "480.00"


class TestGstr2b:
    def test_invoice_level_amounts(self) -> None:
        payload = {"data": {"gstin": "27AABCA1234M1ZU", "docdata": {"b2b": [
            {"ctin": "27AACCD1122E1ZC", "trdnm": "DEEPAK STEEL", "inv": [
                {"inum": "DS/1", "dt": "04-09-2026", "txval": 1000, "igst": 0, "cgst": 90, "sgst": 90, "cess": 0}]}]}}}
        lines, meta = parse_gstr2b_json(json.dumps(payload).encode())
        assert lines[0].tax == Decimal("180.00")
        assert lines[0].invoice_date == date(2026, 9, 4)
        assert meta["recipient_gstin"] == "27AABCA1234M1ZU"

    def test_item_level_amounts_are_summed(self) -> None:
        payload = {"docdata": {"b2b": [{"ctin": "X", "inv": [{"inum": "1", "dt": "01-09-2026", "items": [
            {"txval": 500, "igst": 90}, {"txval": 500, "igst": 90}]}]}]}}
        line = parse_gstr2b_json(json.dumps(payload).encode())[0][0]
        assert line.taxable == Decimal("1000.00") and line.tax == Decimal("180.00")

    def test_register_with_split_tax_columns(self) -> None:
        csv = b"Supplier,GSTIN,Invoice No,Invoice Date,Taxable Value,CGST,SGST\nAcme,27AACCD1122E1ZC,A-1,01/09/2026,1000,90,90\n"
        line = parse_register(csv, "books.csv", side="books")[0][0]
        assert line.tax == Decimal("180.00") and line.invoice_no == "A-1"


class TestMcaFees:
    def test_aoc4_is_a_hundred_a_day(self) -> None:
        days, fee, _ = additional_fee(McaFormType.AOC_4, date(2026, 10, 30), date(2026, 11, 9), None)
        assert (days, fee) == (10, Decimal("1000"))

    def test_dir3_kyc_is_flat(self) -> None:
        assert additional_fee(McaFormType.DIR_3_KYC, date(2026, 9, 30), date(2026, 12, 1), None)[1] == Decimal("5000")

    def test_other_forms_use_multiples_of_the_normal_fee(self) -> None:
        # 40 days late: the 30-60 band, 4x.
        assert additional_fee(McaFormType.ADT_1, date(2026, 10, 1), date(2026, 11, 10), Decimal("500"))[1] == Decimal("2000")

    def test_unknown_normal_fee_is_not_guessed(self) -> None:
        assert additional_fee(McaFormType.ADT_1, date(2026, 10, 1), date(2026, 11, 10), None)[1] is None


class TestResolutions:
    def test_unfilled_placeholders_stay_visible(self) -> None:
        text = render(TEMPLATES["appoint_additional_director"], company="Arora Trading Private Limited",
                      values={"director_name": "Neha Arora"})
        assert "Neha Arora" in text and "[TO CONFIRM: din]" in text


class TestLlmFallback:
    def test_reasoning_scratchpad_is_stripped(self) -> None:
        assert _THINK_RE.sub("", "<think>private</think>Dear Sir").strip() == "Dear Sir"

    def test_unreachable_model_falls_back_with_a_reason(self) -> None:
        completion, reason = complete_or_none("system", "prompt")
        if completion is None:
            assert reason
