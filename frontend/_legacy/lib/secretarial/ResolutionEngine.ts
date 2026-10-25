// Resolution Generator Engine - Companies Act 2013 & SS-1 Compliant
export interface ResolutionMetadata {
  companyName: string;
  cin: string;
  registeredOffice: string;
  meetingDate: string;
  chairmanName: string;
  directorName: string;
  din: string;
  extraArgs?: Record<string, string>;
}

export interface ResolutionTemplate {
  key: string;
  title: string;
  section: string;
  defaultDraft: string;
}

export const RESOLUTION_TEMPLATES: ResolutionTemplate[] = [
  {
    key: 'bank_opening',
    title: 'Opening of Bank Account',
    section: 'Section 179(3)',
    defaultDraft: `RESOLVED THAT a current account in the name of the Company, **{companyName}**, be opened with **{bankName}** at their **{bankBranch}** branch, and the Company be and is hereby authorized to operate the said account in accordance with the bank's terms and conditions.

RESOLVED FURTHER THAT any one of the following Directors/Officers of the Company, namely:
1. **{directorName}** (DIN: **{din}**)
be and are hereby authorized to sign, execute, and deliver all documents, deeds, applications, and forms required for the opening and operation of the said account, and to operate the same under their single/joint signatures.

RESOLVED FURTHER THAT the bank be and is hereby instructed to accept and act upon all cheques, bills, notes, and instructions signed or executed by the said authorized signatories, and that a copy of this resolution, certified as true by any of the Directors, be forwarded to the bank for their record.`
  },
  {
    key: 'bank_closure',
    title: 'Closure of Bank Account',
    section: 'Section 179(3)',
    defaultDraft: `RESOLVED THAT the current account No. **{accountNumber}** maintained in the name of **{companyName}** with **{bankName}** at their **{bankBranch}** branch be closed with immediate effect, as it is no longer required for business operations.

RESOLVED FURTHER THAT the balance amount remaining in the said account, if any, be transferred to the Company's primary bank account with **{targetBank}** via RTGS/NEFT.

RESOLVED FURTHER THAT **{directorName}** (DIN: **{din}**) be and is hereby authorized to sign the closure application, surrender cheque books, debit cards, and perform all other necessary actions to give effect to this resolution, and that a certified true copy of this resolution be delivered to the bank.`
  },
  {
    key: 'director_appointment',
    title: 'Appointment of Director',
    section: 'Section 161 & 152',
    defaultDraft: `RESOLVED THAT pursuant to the provisions of Section 161 and other applicable provisions, if any, of the Companies Act, 2013 and the Rules made thereunder, **{directorName}** (DIN: **{din}**), who has given consent in Form DIR-2 and declared eligibility in Form DIR-8, be and is hereby appointed as an Additional Director of the Company with effect from **{meetingDate}**, to hold office up to the date of the next Annual General Meeting (AGM) of the Company.

RESOLVED FURTHER THAT **{chairmanName}** (DIN: **{chairmanDin}**), Director of the Company, be and is hereby authorized to file Form DIR-12 with the Registrar of Companies (ROC), MCA, and to take all such steps as may be necessary, desirable, or expedient to give effect to this resolution.`
  },
  {
    key: 'director_resignation',
    title: 'Noting Resignation of Director',
    section: 'Section 168',
    defaultDraft: `RESOLVED THAT the resignation of **{directorName}** (DIN: **{din}**) from the office of Director of the Company be and is hereby accepted and noted with effect from **{resignationDate}**. The Board places on record its deep appreciation for the valuable contributions made by **{directorName}** during his tenure as a Director.

RESOLVED FURTHER THAT **{chairmanName}** (DIN: **{chairmanDin}**), Director of the Company, be and is hereby authorized to file Form DIR-12 with the Registrar of Companies (ROC), and to update the Statutory Register of Directors and Key Managerial Personnel accordingly.`
  },
  {
    key: 'auditor_appointment',
    title: 'Appointment of First Auditor',
    section: 'Section 139(6)',
    defaultDraft: `RESOLVED THAT pursuant to the provisions of Section 139(6) and other applicable provisions of the Companies Act, 2013, M/s. **{auditorFirm}**, Chartered Accountants (FRN: **{auditorFrn}**), having given their consent and eligibility certificate under Section 141, be and are hereby appointed as the First Auditors of **{companyName}** to hold office from the date of this meeting until the conclusion of the first Annual General Meeting at a remuneration of ₹**{remuneration}** plus out-of-pocket expenses.

RESOLVED FURTHER THAT any Director of the Company be and is hereby authorized to file Form ADT-1 with the Registrar of Companies (ROC) and to execute the engagement letter and other necessary documents.`
  },
  {
    key: 'gst_registration',
    title: 'Authorization for GST Registration',
    section: 'GST Act 2017',
    defaultDraft: `RESOLVED THAT the Company, **{companyName}**, apply for GST Registration in the State of **{stateName}** in compliance with the Goods and Services Tax Act, 2017, and rules made thereunder.

RESOLVED FURTHER THAT **{directorName}** (DIN: **{din}**) of the Company be and is hereby nominated as the Authorized Signatory under the GST portal, with full power to sign applications, execute declarations, respond to queries, submit returns, and represent the Company before the GST Authorities.`
  },
  {
    key: 'it_return',
    title: 'Authorization for Income Tax Filing',
    section: 'Income Tax Act 1961',
    defaultDraft: `RESOLVED THAT the Income Tax Return of the Company for the Assessment Year **{ay}** under Section 139 of the Income Tax Act, 1961 be approved and finalized by the Board.

RESOLVED FURTHER THAT **{directorName}** (DIN: **{din}**) be and is hereby authorized to sign and digitally verify the Income Tax Return in Form ITR-6, sign tax audit reports under Section 44AB, file declarations, and represent the Company in all proceedings before the Income Tax Department.`
  },
  {
    key: 'dividend_declaration',
    title: 'Recommendation of Interim Dividend',
    section: 'Section 123',
    defaultDraft: `RESOLVED THAT in accordance with the provisions of Section 123 and other applicable rules of the Companies Act, 2013, an interim dividend at the rate of **{dividendRate}**% (₹**{dividendPerShare}** per equity share) on **{totalShares}** equity shares of ₹10/- each, out of the profits of the current financial year up to the quarter ended **{quarterEnd}**, be and is hereby declared and paid to those shareholders whose names appear in the Register of Members on **{recordDate}**.

RESOLVED FURTHER THAT a separate bank account named "Interim Dividend Account of **{companyName}**" be opened with **{bankName}** and the total dividend amount of ₹**{totalDividend}** be deposited within five days from the declaration date.`
  },
  {
    key: 'rpt_approval',
    title: 'Approval of Related Party Transactions',
    section: 'Section 188',
    defaultDraft: `RESOLVED THAT pursuant to the provisions of Section 188 of the Companies Act, 2013 and the rules thereunder, consent of the Board of Directors be and is hereby accorded to the transaction with **{relatedPartyName}** (a related party as defined under Section 2(76)), for the **{transactionType}** of **{goodsOrServices}** at arm's length basis and in the ordinary course of business, for a total contract value not exceeding ₹**{contractValue}** per annum.

RESOLVED FURTHER THAT Directors who are interested in the transaction do not vote on this resolution and their presence is not counted towards quorum. Any non-interested Director of the Company is authorized to execute the agreement.`
  },
  {
    key: 'share_allotment',
    title: 'Allotment of Equity Shares',
    section: 'Section 42 & 62',
    defaultDraft: `RESOLVED THAT pursuant to Section 42 & 62 of the Companies Act, 2013 and rules thereunder, the Board hereby approves the allotment of **{allottedShares}** Equity Shares of face value ₹10/- each at a premium of ₹**{sharePremium}** per share, total amounting to ₹**{totalReceived}**, to the applicants as listed in the allotment register.

RESOLVED FURTHER THAT the Share Certificates be prepared and issued to the allottees under the common seal of the company (if any) and signatures of two Directors and the Company Secretary, and that Form PAS-3 (Return of Allotment) be filed with the ROC within 30 days.`
  },
  {
    key: 'esop_approval',
    title: 'Approval of Employee Stock Option Plan',
    section: 'Section 62(1)(b)',
    defaultDraft: `RESOLVED THAT pursuant to Section 62(1)(b) of the Companies Act, 2013 and rules thereunder, the draft "Employee Stock Option Scheme 2026" (ESOP 2026), creating up to **{esopPool}** options convertible into equal number of equity shares, be and is hereby approved, subject to the approval of shareholders in a general meeting.

RESOLVED FURTHER THAT the Nomination and Remuneration Committee (NRC) be and is hereby authorized to administer the scheme, grant options, and allot shares upon option exercise.`
  },
  {
    key: 'property_purchase',
    title: 'Approval for Purchase of Property',
    section: 'Section 179(3)',
    defaultDraft: `RESOLVED THAT the Company purchase the immovable commercial property situated at **{propertyAddress}** from **{sellerName}** for a total consideration of ₹**{purchasePrice}** plus applicable registration fees and stamp duties.

RESOLVED FURTHER THAT **{directorName}** (DIN: **{din}**) be and is hereby authorized to negotiate, execute the Sale Deed, pay the consideration, and represent the Company before the Sub-Registrar of Assurances.`
  },
  {
    key: 'borrowing_approval',
    title: 'Approval of Borrowing Limits',
    section: 'Section 179(3) & 180(1)(c)',
    defaultDraft: `RESOLVED THAT pursuant to Section 179(3)(d) and subject to Section 180(1)(c) of the Companies Act, 2013, the consent of the Board be and is hereby accorded to borrow from **{lenderName}** a term loan of ₹**{loanAmount}** on terms and conditions set out in the draft loan agreement.

RESOLVED FURTHER THAT the total borrowings of the Company (apart from temporary loans) shall not exceed the limit of ₹**{totalLimit}** approved by the shareholders.`
  },
  {
    key: 'loan_approval',
    title: 'Giving Loans or Guarantees',
    section: 'Section 186',
    defaultDraft: `RESOLVED THAT in accordance with Section 186 of the Companies Act, 2013, the Company grant a loan of ₹**{loanAmount}** to M/s. **{borrowerName}** at an interest rate of **{interestRate}**% per annum, which is not less than the prevailing yield of government securities, for their capital expansion.

RESOLVED FURTHER THAT the aggregate of loans, guarantees, and investments does not exceed 60% of paid-up capital and free reserves or 100% of free reserves and securities premium, whichever is more.`
  },
  {
    key: 'lease_agreement',
    title: 'Execution of Lease Agreement',
    section: 'Section 179(3)',
    defaultDraft: `RESOLVED THAT the Company take on lease office premises situated at **{officeAddress}** from **{landlordName}** for a period of **{leaseYears}** years at a monthly rent of ₹**{monthlyRent}** on terms contained in the draft Lease Deed.

RESOLVED FURTHER THAT **{directorName}** (DIN: **{din}**) be authorized to sign the lease deed, pay security deposit of ₹**{securityDeposit}**, and execute the agreement on behalf of the company.`
  },
  {
    key: 'kmp_appointment',
    title: 'Appointment of KMP (Company Secretary)',
    section: 'Section 203',
    defaultDraft: `RESOLVED THAT pursuant to the provisions of Section 203 and other applicable provisions of the Companies Act, 2013, **{kmpName}** (ICSI Membership No. **{membershipNo}**), who has given consent, be and is hereby appointed as Company Secretary (KMP) of the company with effect from **{meetingDate}** on a salary of ₹**{kmpSalary}** per month.

RESOLVED FURTHER THAT Form MR-1 / DIR-12 be filed with the ROC within 30 days and Register of KMPs be updated.`
  },
  {
    key: 'financial_approval',
    title: 'Approval of Audited Financial Statements',
    section: 'Section 134',
    defaultDraft: `RESOLVED THAT the audited Balance Sheet as at March 31, 2026, the Statement of Profit and Loss, and cash flows for the year ended on that date, along with notes annexed, be and are hereby approved.

RESOLVED FURTHER THAT the financial statements be signed on behalf of the Board by **{director1}** (DIN: **{din1}**) and **{director2}** (DIN: **{din2}**), and be submitted to the Statutory Auditors for their Report.`
  },
  {
    key: 'annual_report',
    title: 'Approval of Board\'s Report',
    section: 'Section 134(3)',
    defaultDraft: `RESOLVED THAT the draft Board\'s Report of the Company for the financial year ended March 31, 2026, prepared under Section 134(3), be and is hereby approved.

RESOLVED FURTHER THAT **{directorName}** (DIN: **{din}**) be authorized to sign the Board's Report and place it before the shareholders at the ensuing AGM along with the Audited Accounts and Auditors' Report.`
  },
  {
    key: 'merger_approval',
    title: 'Approval of Scheme of Merger',
    section: 'Section 230-232',
    defaultDraft: `RESOLVED THAT subject to the approval of NCLT, ROC, shareholders, and creditors, the scheme of merger/amalgamation between the Company (**{companyName}**) and M/s. **{mergeCompany}** be and is hereby approved in principle.

RESOLVED FURTHER THAT the Valuation Report of Registered Valuer M/s. **{valuerName}** recommending swap ratio of **{swapRatio}** be accepted and any Director be authorized to submit applications to regulatory bodies.`
  },
  {
    key: 'demerger_approval',
    title: 'Approval of Scheme of Demerger',
    section: 'Section 230-232',
    defaultDraft: `RESOLVED THAT the draft scheme of demerger of the **{demergeDivision}** division of the Company into M/s. **{resultantCompany}** be and is hereby approved, subject to approval from NCLT and other statutory authorities.

RESOLVED FURTHER THAT the draft share entitlement ratio report be accepted and M/s. **{merchantBanker}** be appointed to submit notifications to stock exchanges (if applicable).`
  }
];

export function generateResolutionText(templateKey: string, meta: ResolutionMetadata): { title: string; body: string; section: string } {
  const template = RESOLUTION_TEMPLATES.find(t => t.key === templateKey);
  if (!template) {
    return { title: 'Unknown', body: '', section: '' };
  }

  let body = template.defaultDraft;
  const replacements: Record<string, string> = {
    companyName: meta.companyName,
    cin: meta.cin,
    registeredOffice: meta.registeredOffice,
    meetingDate: meta.meetingDate,
    chairmanName: meta.chairmanName,
    directorName: meta.directorName,
    din: meta.din,
    ...(meta.extraArgs || {})
  };

  Object.entries(replacements).forEach(([key, val]) => {
    body = body.replace(new RegExp(`{${key}}`, 'g'), val || `[Missing ${key}]`);
  });

  // Standard SS-1 header prepended
  const header = `CERTIFIED TRUE COPY OF THE RESOLUTION PASSED AT THE MEETING OF THE BOARD OF DIRECTORS OF **${meta.companyName.toUpperCase()}** HELD ON **${meta.meetingDate}** AT THE REGISTERED OFFICE AT **${meta.registeredOffice.toUpperCase()}**\n\n`;

  const footer = `\n\n**For ${meta.companyName.toUpperCase()}**\n\n\n\n___________________\n**${meta.chairmanName}**\nChairman / Director\nDIN: ${meta.extraArgs?.chairmanDin || '01234567'}`;

  return {
    title: template.title,
    section: template.section,
    body: header + body + footer
  };
}

export async function simulateAiClauseExpansion(baseBody: string, clauseRequirement: string): Promise<string> {
  // Simulate AI Copilot adding specific sub-clauses
  const lines = baseBody.split('\n\n');
  const insertIndex = Math.max(0, lines.length - 2); // Insert before signature block
  
  const additionalClause = `RESOLVED FURTHER THAT in addition to the powers granted above, the Board hereby records that **${clauseRequirement}** shall also be complied with, and any action taken in this regard is hereby ratified and confirmed.`;

  lines.splice(insertIndex, 0, additionalClause);
  return lines.join('\n\n');
}
