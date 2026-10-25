"""Drafting with a language model - notice replies, engagement letters, minutes.

Three rules are written into every prompt, because they are the failure modes
that would make a practice stop trusting the tool:

1. **Only the facts supplied.** Names, dates, amounts and sections come from
   the record; the model is told it has nothing else.
2. **Unknowns stay visible.** Anything missing becomes ``[TO CONFIRM: ...]``
   rather than a plausible invention.
3. **No unsupplied authority.** A notice reply may cite only judgments a person
   selected from the case-law search. Fabricated citations in filings are a
   documented, sanctionable problem; the model is not allowed the opportunity.

When no model is reachable the same structure is produced from a template and
labelled ``provider="template"`` with the reason - a draft is always available,
and it never pretends to be more than it is.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date

from sqlalchemy.orm import Session

from app.llm import complete_or_none
from app.models.compliance import TaxNotice
from app.models.intelligence import AiInteraction
from app.models.practice import Client
from app.models.tenancy import Firm
from app.services.resolutions import ResolutionTemplate, render

GROUNDING_RULES = """\
Rules you must follow:
- Use ONLY the facts given below. You have no other information about this client or matter.
- Where a fact a professional would need is missing, write [TO CONFIRM: what is needed]. Never invent names, dates, amounts, section numbers, case citations, circulars or notifications.
- Do not cite any judgment, circular or notification unless it appears in the AUTHORITIES list below. If the list is empty, cite none.
- Write in the formal register used by Indian chartered accountants. Use Indian number formatting (Rs. 2,84,000).
- Output the document text only, with no preamble or commentary."""


@dataclass(slots=True)
class Draft:
    text: str
    provider: str
    model: str | None
    #: Why the template was used instead of a model, when it was.
    fallback_reason: str | None
    interaction_id: uuid.UUID | None = None


def _inr(value) -> str:
    if value is None:
        return "[TO CONFIRM: amount]"
    whole, _, fraction = f"{float(value):.2f}".partition(".")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        whole = ",".join(groups) + "," + tail
    return f"Rs. {whole}" + (f".{fraction}" if fraction != "00" else "")


def _d(value: date | None) -> str:
    return value.strftime("%d %B %Y") if value else "[TO CONFIRM: date]"


def _log(
    session: Session,
    *,
    firm_id: uuid.UUID,
    user_id: uuid.UUID,
    kind: str,
    prompt: str,
    draft: Draft,
    tokens: tuple[int, int, int],
    citations: list[dict],
) -> uuid.UUID:
    row = AiInteraction(
        firm_id=firm_id,
        user_id=user_id,
        conversation_id=uuid.uuid4(),
        provider=draft.provider,
        model=draft.model,
        prompt=prompt,
        response=draft.text,
        intent=f"draft:{kind}",
        citations=citations,
        prompt_tokens=tokens[0],
        output_tokens=tokens[1],
        latency_ms=tokens[2],
    )
    session.add(row)
    session.flush()
    return row.id


def _generate(
    session: Session,
    *,
    firm_id: uuid.UUID,
    user_id: uuid.UUID,
    kind: str,
    system: str,
    prompt: str,
    template_text: str,
    citations: list[dict],
    max_tokens: int = 1800,
) -> Draft:
    completion, reason = complete_or_none(system, prompt, max_tokens=max_tokens)
    if completion is not None:
        draft = Draft(
            text=completion.text,
            provider=completion.provider,
            model=completion.model,
            fallback_reason=None,
        )
        tokens = (completion.prompt_tokens, completion.output_tokens, completion.latency_ms)
    else:
        draft = Draft(text=template_text, provider="template", model=None, fallback_reason=reason)
        tokens = (0, 0, 0)
    draft.interaction_id = _log(
        session,
        firm_id=firm_id,
        user_id=user_id,
        kind=kind,
        prompt=prompt,
        draft=draft,
        tokens=tokens,
        citations=citations,
    )
    return draft


# ------------------------------------------------------------ notice reply ---


def draft_notice_reply(
    session: Session,
    *,
    user_id: uuid.UUID,
    firm: Firm,
    client: Client,
    notice: TaxNotice,
    instructions: str | None,
) -> Draft:
    authorities = notice.cited_cases or []
    facts = [
        f"Firm (authorised representative): {firm.name}" + (f", FRN {firm.frn}" if firm.frn else ""),
        f"Taxpayer: {client.legal_name}",
        f"PAN: {client.pan or '[not on record]'}",
        f"GSTIN: {client.gstin or '[not on record]'}",
        f"Authority: {notice.authority.value.replace('_', ' ')}",
        f"Notice / DIN: {notice.notice_number}",
        f"Section or form: {notice.section_code or '[not on record]'}",
        f"Subject: {notice.subject or '[not on record]'}",
        f"Issued on: {_d(notice.issued_on)}",
        f"Reply due by: {_d(notice.due_date)}",
        f"Demand: {_inr(notice.demand_amount) if notice.demand_amount is not None else 'none stated'}",
    ]
    excerpt = (notice.extracted_text or "").strip()[:4000]
    authority_lines = (
        "\n".join(f"- {a.get('citation')} ({a.get('court', '')}): {a.get('note', '')}" for a in authorities)
        or "(none)"
    )
    prompt = (
        f"{GROUNDING_RULES}\n\nDraft a reply to the following tax notice on behalf of the taxpayer.\n"
        "Structure: addressee and reference line; subject; preliminary submissions; point-wise reply "
        "to each allegation in the notice; list of documents enclosed; prayer (including a request "
        "for personal hearing); signature block for the authorised representative.\n\n"
        "FACTS:\n" + "\n".join(facts) + "\n\n"
        f"NOTICE TEXT (as extracted, may contain OCR errors):\n{excerpt or '(not available)'}\n\n"
        f"AUTHORITIES (selected by the reviewer - cite only these):\n{authority_lines}\n\n"
        f"REVIEWER'S INSTRUCTIONS:\n{(instructions or '').strip() or '(none)'}"
    )

    template = "\n".join(
        [
            "DRAFT - NOT FOR FILING UNTIL REVIEWED",
            "",
            f"To,\nThe Proper Officer\n{notice.authority.value.replace('_', ' ').title()} Department",
            "[TO CONFIRM: office address of the issuing authority]",
            "",
            f"Ref: {notice.notice_number}" + (f" under {notice.section_code}" if notice.section_code else ""),
            f"Dated: {_d(notice.issued_on)}",
            "",
            f"Subject: Reply to notice in the case of {client.legal_name}"
            + (f" (GSTIN {client.gstin})" if client.gstin else f" (PAN {client.pan})" if client.pan else ""),
            "",
            "Respected Sir/Madam,",
            "",
            "1. Preliminary submissions",
            f"   The noticee, {client.legal_name}, acknowledges receipt of the above notice"
            + (f" relating to {notice.subject.lower()}" if notice.subject else "")
            + ". The noticee denies every allegation not expressly admitted below and reserves the "
            "right to make further submissions.",
            "",
            "2. Facts of the case",
            "   [TO CONFIRM: factual background - nature of business, period involved, returns filed]",
            "",
            "3. Reply to the points raised",
            "   [TO CONFIRM: point-wise response to each allegation in the notice]",
            f"   The demand of {_inr(notice.demand_amount)} proposed in the notice is disputed"
            if notice.demand_amount
            else "   [TO CONFIRM: position on any amount proposed]",
            "",
            "4. Documents enclosed",
            "   [TO CONFIRM: reconciliations, invoices, ledgers relied upon]",
            "",
            "5. Prayer",
            "   In view of the above, it is prayed that the proceedings be dropped, and that the "
            "noticee be granted an opportunity of personal hearing before any adverse order is passed.",
            "",
            *(
                ["Authorities relied upon:", *[f"   - {a.get('citation')}" for a in authorities], ""]
                if authorities
                else []
            ),
            "Yours faithfully,",
            "",
            f"For {firm.name}" + (f" (FRN {firm.frn})" if firm.frn else ""),
            "Authorised Representative",
            "[TO CONFIRM: name, membership number, date]",
        ]
    )
    return _generate(
        session,
        firm_id=firm.id,
        user_id=user_id,
        kind="notice_reply",
        system="You draft replies to Indian tax notices for a chartered accountancy practice.",
        prompt=prompt,
        template_text=template,
        citations=[{"table": "tax_notices", "id": str(notice.id), "label": notice.notice_number}],
    )


# ------------------------------------------------------- engagement letter ---


DEFAULT_SERVICES = [
    "Maintenance of books of account",
    "GST return filing (GSTR-1, GSTR-3B) and GSTR-2B reconciliation",
    "TDS return filing",
    "Income tax return filing",
]


def draft_engagement_letter(
    session: Session,
    *,
    user_id: uuid.UUID,
    firm: Firm,
    legal_name: str,
    entity_type: str | None,
    pan: str | None,
    gstin: str | None,
    services: list[str] | None,
    fee_note: str | None,
) -> Draft:
    scope = services or DEFAULT_SERVICES
    facts = [
        f"Firm: {firm.name}" + (f", FRN {firm.frn}" if firm.frn else ""),
        f"Firm address: {', '.join(p for p in (firm.address_line1, firm.city, firm.state) if p) or '[not on record]'}",
        f"Client: {legal_name}",
        f"Entity type: {entity_type or '[not on record]'}",
        f"PAN: {pan or '[not on record]'}",
        f"GSTIN: {gstin or '[not on record]'}",
        "Services in scope:\n" + "\n".join(f"  - {s}" for s in scope),
        f"Fees: {fee_note or '[not agreed]'}",
    ]
    prompt = (
        f"{GROUNDING_RULES}\n\nDraft an engagement letter from the firm to the client, in the style "
        "recommended by ICAI. Sections: scope of services; responsibilities of the client "
        "(completeness and accuracy of information, timely provision of documents); responsibilities "
        "of the firm; fees and billing; confidentiality and data protection under the Digital "
        "Personal Data Protection Act, 2023; limitation of the engagement (no audit or assurance "
        "unless separately engaged); termination; acceptance block for the client's signature.\n\n"
        "FACTS:\n" + "\n".join(facts)
    )
    template = "\n".join(
        [
            "DRAFT ENGAGEMENT LETTER - FOR REVIEW",
            "",
            f"{firm.name}" + (f" | FRN {firm.frn}" if firm.frn else ""),
            "",
            f"To the Board / Management of {legal_name}",
            "",
            "Dear Sir/Madam,",
            "",
            "1. Scope of services",
            *[f"   - {s}" for s in scope],
            "   Any service not listed above is outside this engagement unless agreed in writing.",
            "",
            "2. Your responsibilities",
            "   You are responsible for the completeness and accuracy of the records and information "
            "provided to us, and for providing them in time for statutory due dates.",
            "",
            "3. Our responsibilities",
            "   We will perform the services with due professional care, in accordance with the "
            "applicable laws and the standards of the Institute of Chartered Accountants of India.",
            "",
            "4. Fees",
            f"   {fee_note or '[TO CONFIRM: fee, billing cycle and payment terms]'}",
            "",
            "5. Confidentiality and data protection",
            "   We will keep your information confidential and process personal data only for the "
            "purposes of this engagement, in accordance with the Digital Personal Data Protection Act, 2023.",
            "",
            "6. Limitations",
            "   This engagement does not constitute an audit or any other assurance engagement.",
            "",
            "7. Termination",
            "   Either party may terminate this engagement by [TO CONFIRM: notice period] written notice.",
            "",
            "Please sign and return a copy of this letter to confirm your acceptance.",
            "",
            f"For {firm.name}",
            "[TO CONFIRM: partner name and membership number]",
            "",
            f"Accepted on behalf of {legal_name}:",
            "Name: ______________  Designation: ______________  Date: ______________",
        ]
    )
    return _generate(
        session,
        firm_id=firm.id,
        user_id=user_id,
        kind="engagement_letter",
        system="You draft engagement letters for an Indian chartered accountancy practice.",
        prompt=prompt,
        template_text=template,
        citations=[],
    )


# ------------------------------------------------------------ board minutes ---


def draft_board_minutes(
    session: Session,
    *,
    user_id: uuid.UUID,
    firm: Firm,
    client: Client,
    template: ResolutionTemplate,
    values: dict[str, str],
    meeting_date: date | None,
    meeting_time: str | None,
    place: str | None,
    chairperson: str | None,
    directors_present: list[str],
) -> tuple[Draft, str]:
    """Returns the minutes draft and the rendered resolution text.

    The resolution itself is always rendered from the template, never by the
    model: operative legal text should be the reviewed wording, word for word.
    The model only drafts the minutes around it.
    """
    resolution = render(template, company=client.legal_name, values=values)
    present = ", ".join(directors_present) if directors_present else "[TO CONFIRM: directors present]"
    facts = [
        f"Company: {client.legal_name}" + (f" (CIN {client.cin})" if client.cin else ""),
        f"Meeting: Board meeting on {_d(meeting_date)} at {meeting_time or '[time]'}, {place or '[place]'}",
        f"Chairperson: {chairperson or '[not stated]'}",
        f"Directors present: {present}",
        f"Business: {template.title} ({template.provision})",
        f"Follow-up filing: {template.follow_up}",
    ]
    prompt = (
        f"{GROUNDING_RULES}\n\nDraft minutes of a board meeting under section 118 of the Companies "
        "Act, 2013 and Secretarial Standard SS-1. Include: heading; directors present and in "
        "attendance; chairperson; quorum; leave of absence; confirmation of previous minutes "
        "([TO CONFIRM] if unknown); the item of business with the resolution reproduced EXACTLY as "
        "given below, without changing a word; vote of thanks; signature line for the chairperson.\n\n"
        "FACTS:\n" + "\n".join(facts) + f"\n\nRESOLUTION (reproduce verbatim):\n{resolution}"
    )
    template_text = "\n".join(
        [
            "DRAFT MINUTES - FOR REVIEW",
            "",
            f"MINUTES OF THE MEETING OF THE BOARD OF DIRECTORS OF {client.legal_name.upper()}",
            f"held on {_d(meeting_date)} at {meeting_time or '[TO CONFIRM: time]'} at "
            f"{place or '[TO CONFIRM: place]'}",
            "",
            f"Directors present: {present}",
            f"Chairperson: {chairperson or '[TO CONFIRM: chairperson]'}",
            "",
            "1. Quorum",
            "   The requisite quorum being present, the meeting was called to order.",
            "",
            "2. Leave of absence",
            "   [TO CONFIRM: directors who sought leave of absence, if any]",
            "",
            "3. Confirmation of minutes of the previous meeting",
            "   [TO CONFIRM: date of the previous meeting]",
            "",
            f"4. {template.title}",
            f"   The Board considered the matter under {template.provision} and passed the "
            "following resolution:",
            "",
            *[f"   {line}" if line else "" for line in resolution.split("\n")],
            "",
            "5. Vote of thanks",
            "   There being no other business, the meeting concluded with a vote of thanks to the chair.",
            "",
            "_________________________",
            "Chairperson",
            "Date of signing: [TO CONFIRM]",
            "",
            f"Note for the file: {template.follow_up}. Verify against the current Act and rules before use.",
        ]
    )
    draft = _generate(
        session,
        firm_id=firm.id,
        user_id=user_id,
        kind="board_minutes",
        system="You draft board meeting minutes for Indian private companies.",
        prompt=prompt,
        template_text=template_text,
        citations=[{"table": "clients", "id": str(client.id), "label": client.legal_name}],
    )
    return draft, resolution
