"""Board resolution templates - Module 10.

Each template names the provision it rests on and the e-form that usually
follows, because the follow-up filing is the step most often missed. The
operative text is conventional drafting, not legal advice: every draft is
rendered with ``[TO CONFIRM: ...]`` markers for facts the system cannot know,
and a note to check the current Act and rules before use.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ResolutionTemplate:
    key: str
    title: str
    provision: str
    follow_up: str
    #: Operative text. ``{company}`` and the named placeholders are filled from
    #: the request; anything left unfilled becomes a TO CONFIRM marker.
    body: str
    placeholders: tuple[str, ...] = ()


TEMPLATES: dict[str, ResolutionTemplate] = {
    t.key: t
    for t in (
        ResolutionTemplate(
            key="appoint_additional_director",
            title="Appointment of an additional director",
            provision="Section 161(1), Companies Act 2013",
            follow_up="DIR-12 within 30 days of appointment; consent in DIR-2 and DIR-8 to be on record",
            body=(
                "RESOLVED THAT pursuant to section 161(1) of the Companies Act, 2013 and the "
                "Articles of Association of {company}, {director_name} (DIN {din}) be and is hereby "
                "appointed as an Additional Director of the Company with effect from {effective_date}, "
                "to hold office up to the date of the next Annual General Meeting.\n\n"
                "RESOLVED FURTHER THAT any Director of the Company be and is hereby authorised to "
                "file the necessary e-forms with the Registrar of Companies and to do all acts "
                "necessary to give effect to this resolution."
            ),
            placeholders=("director_name", "din", "effective_date"),
        ),
        ResolutionTemplate(
            key="approve_annual_accounts",
            title="Approval of annual accounts",
            provision="Section 134(1), Companies Act 2013",
            follow_up="AOC-4 within 30 days of the AGM; MGT-7/7A within 60 days of the AGM",
            body=(
                "RESOLVED THAT the Balance Sheet as at {year_end}, the Statement of Profit and Loss "
                "and the Cash Flow Statement for the year ended on that date, together with the notes "
                "thereto, as placed before the Board, be and are hereby approved pursuant to section "
                "134(1) of the Companies Act, 2013.\n\n"
                "RESOLVED FURTHER THAT {signatories} be and are hereby authorised to sign the "
                "financial statements on behalf of the Board, and that the same be submitted to the "
                "auditors for their report."
            ),
            placeholders=("year_end", "signatories"),
        ),
        ResolutionTemplate(
            key="open_bank_account",
            title="Opening a bank account",
            provision="General powers of the Board, section 179, Companies Act 2013",
            follow_up="Certified copy of this resolution to the bank; no ROC filing",
            body=(
                "RESOLVED THAT a current account in the name of {company} be opened with "
                "{bank_name}, {branch} branch, and that {authorised_signatories} be and are hereby "
                "authorised to operate the said account {mode_of_operation}.\n\n"
                "RESOLVED FURTHER THAT a certified copy of this resolution be furnished to the bank."
            ),
            placeholders=("bank_name", "branch", "authorised_signatories", "mode_of_operation"),
        ),
        ResolutionTemplate(
            key="authorise_borrowing",
            title="Authorising a borrowing",
            provision="Section 179(3)(d), Companies Act 2013",
            follow_up=(
                "MGT-14 within 30 days for a public company; private companies are exempt from "
                "filing section 179(3) resolutions under the June 2015 exemption notification. "
                "CHG-1 within 30 days if a charge is created."
            ),
            body=(
                "RESOLVED THAT pursuant to section 179(3)(d) of the Companies Act, 2013, consent of "
                "the Board be and is hereby accorded to borrow a sum not exceeding Rs. {amount} from "
                "{lender} on the terms placed before the Board, {security_description}.\n\n"
                "RESOLVED FURTHER THAT {authorised_person} be and is hereby authorised to negotiate, "
                "sign and execute the loan documents and to do all acts necessary to give effect to "
                "this resolution."
            ),
            placeholders=("amount", "lender", "security_description", "authorised_person"),
        ),
        ResolutionTemplate(
            key="appoint_statutory_auditor",
            title="Appointment of statutory auditor",
            provision="Section 139, Companies Act 2013",
            follow_up=(
                "ADT-1 within 15 days of the meeting at which the auditor is appointed. First "
                "auditors are appointed by the Board within 30 days of incorporation (s.139(6)); "
                "thereafter the members appoint at the AGM on the Board's recommendation."
            ),
            body=(
                "RESOLVED THAT, subject to the approval of the members, {auditor_firm}, Chartered "
                "Accountants (Firm Registration No. {auditor_frn}), who have confirmed their "
                "eligibility under section 141 of the Companies Act, 2013, be and are hereby "
                "recommended for appointment as Statutory Auditors of the Company under section 139, "
                "to hold office {term}, at a remuneration to be mutually agreed.\n\n"
                "RESOLVED FURTHER THAT any Director be and is hereby authorised to file ADT-1 with "
                "the Registrar of Companies."
            ),
            placeholders=("auditor_firm", "auditor_frn", "term"),
        ),
        ResolutionTemplate(
            key="change_registered_office_local",
            title="Change of registered office within the same city",
            provision="Section 12(4), Companies Act 2013",
            follow_up=(
                "INC-22 within 30 days. A move outside the local limits of the city needs a "
                "special resolution of members under section 12(5) instead of this template."
            ),
            body=(
                "RESOLVED THAT the registered office of {company} be shifted from {old_address} to "
                "{new_address}, within the local limits of the same city, with effect from "
                "{effective_date}.\n\n"
                "RESOLVED FURTHER THAT any Director be and is hereby authorised to file INC-22 with "
                "the Registrar of Companies within 30 days."
            ),
            placeholders=("old_address", "new_address", "effective_date"),
        ),
    )
}


class _Marked(dict):
    """Leaves an unknown placeholder visibly unfilled instead of raising."""

    def __missing__(self, key: str) -> str:
        return f"[TO CONFIRM: {key.replace('_', ' ')}]"


def render(template: ResolutionTemplate, *, company: str, values: dict[str, str]) -> str:
    filled = _Marked({k: v for k, v in values.items() if v})
    filled["company"] = company
    return template.body.format_map(filled)
