/**
 * Backend enum values, their human labels, and the badge tone each maps to.
 *
 * The API speaks SCREAMING_SNAKE (`AMOUNT_MISMATCH`); the UI must not. Every
 * label lives here rather than in the page that renders it, so "Not in 2B"
 * reads the same on the dashboard, the GST worklist and the copilot.
 *
 * `tone` is restricted to the five sanctioned status colours — status colour is
 * reserved for data meaning, never decoration.
 */

export type Tone = 'neutral' | 'ok' | 'warn' | 'risk' | 'info' | 'accent'

export type FilingStatus = 'NOT_STARTED' | 'PENDING' | 'IN_PROGRESS' | 'FILED' | 'OVERDUE'
export type MatchStatus = 'MATCHED' | 'AMOUNT_MISMATCH' | 'MISSING_IN_BOOKS' | 'MISSING_IN_2B'
export type DocumentStatus = 'QUEUED' | 'EXTRACTING' | 'NEEDS_REVIEW' | 'VERIFIED' | 'FAILED'
export type JournalStatus = 'SUGGESTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED'
export type RiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type RiskStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'FALSE_POSITIVE'
export type NoticeStatus =
  | 'RECEIVED'
  | 'UNDER_REVIEW'
  | 'RESPONSE_DRAFTED'
  | 'RESPONSE_FILED'
  | 'HEARING_SCHEDULED'
  | 'CLOSED'
export type PayrollStatus = 'DRAFT' | 'CALCULATED' | 'APPROVED' | 'PAID'
export type ThreadStatus = 'OPEN' | 'AWAITING_CLIENT' | 'AWAITING_FIRM' | 'CLOSED'
export type ReportStatus = 'QUEUED' | 'READY' | 'FAILED' | 'EXPIRED'
export type ClientStatus = 'PROSPECT' | 'ONBOARDING' | 'ACTIVE' | 'DORMANT' | 'EXITED'
export type UserStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED'

interface Meta {
  label: string
  tone: Tone
}

function table<K extends string>(rows: Record<K, Meta>) {
  return {
    label: (key: K | null | undefined) => (key ? (rows[key]?.label ?? humanise(key)) : '—'),
    tone: (key: K | null | undefined): Tone => (key ? (rows[key]?.tone ?? 'neutral') : 'neutral'),
  }
}

/** Fallback for an enum member added to the backend after this file was written. */
export function humanise(value: string) {
  const text = value.replace(/_/g, ' ').toLowerCase()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export const filing = table<FilingStatus>({
  NOT_STARTED: { label: 'Not started', tone: 'neutral' },
  PENDING: { label: 'Pending', tone: 'warn' },
  IN_PROGRESS: { label: 'In progress', tone: 'info' },
  FILED: { label: 'Filed', tone: 'ok' },
  OVERDUE: { label: 'Overdue', tone: 'risk' },
})

export const match = table<MatchStatus>({
  MATCHED: { label: 'Matched', tone: 'ok' },
  AMOUNT_MISMATCH: { label: 'Amount differs', tone: 'warn' },
  MISSING_IN_BOOKS: { label: 'Not in books', tone: 'risk' },
  MISSING_IN_2B: { label: 'Not in 2B', tone: 'risk' },
})

export const docStatus = table<DocumentStatus>({
  QUEUED: { label: 'Queued', tone: 'neutral' },
  EXTRACTING: { label: 'Extracting', tone: 'info' },
  NEEDS_REVIEW: { label: 'Needs review', tone: 'warn' },
  VERIFIED: { label: 'Verified', tone: 'ok' },
  FAILED: { label: 'Failed', tone: 'risk' },
})

export const journal = table<JournalStatus>({
  SUGGESTED: { label: 'Unclassified', tone: 'neutral' },
  UNDER_REVIEW: { label: 'Awaiting review', tone: 'warn' },
  APPROVED: { label: 'Posted', tone: 'ok' },
  REJECTED: { label: 'Rejected', tone: 'risk' },
})

export const severity = table<RiskSeverity>({
  LOW: { label: 'Low', tone: 'neutral' },
  MEDIUM: { label: 'Medium', tone: 'info' },
  HIGH: { label: 'High', tone: 'warn' },
  CRITICAL: { label: 'Critical', tone: 'risk' },
})

export const riskStatus = table<RiskStatus>({
  OPEN: { label: 'Open', tone: 'warn' },
  ACKNOWLEDGED: { label: 'Acknowledged', tone: 'info' },
  RESOLVED: { label: 'Resolved', tone: 'ok' },
  FALSE_POSITIVE: { label: 'False positive', tone: 'neutral' },
})

export const noticeStatus = table<NoticeStatus>({
  RECEIVED: { label: 'Received', tone: 'warn' },
  UNDER_REVIEW: { label: 'Under review', tone: 'info' },
  RESPONSE_DRAFTED: { label: 'Reply drafted', tone: 'info' },
  RESPONSE_FILED: { label: 'Reply filed', tone: 'ok' },
  HEARING_SCHEDULED: { label: 'Hearing scheduled', tone: 'warn' },
  CLOSED: { label: 'Closed', tone: 'neutral' },
})

export const payrollStatus = table<PayrollStatus>({
  DRAFT: { label: 'Draft', tone: 'neutral' },
  CALCULATED: { label: 'Calculated', tone: 'info' },
  APPROVED: { label: 'Approved', tone: 'ok' },
  PAID: { label: 'Paid', tone: 'ok' },
})

export const threadStatus = table<ThreadStatus>({
  OPEN: { label: 'Open', tone: 'info' },
  AWAITING_CLIENT: { label: 'Awaiting client', tone: 'warn' },
  AWAITING_FIRM: { label: 'Awaiting us', tone: 'risk' },
  CLOSED: { label: 'Closed', tone: 'neutral' },
})

export const reportStatus = table<ReportStatus>({
  QUEUED: { label: 'Queued', tone: 'neutral' },
  READY: { label: 'Ready', tone: 'ok' },
  FAILED: { label: 'Failed', tone: 'risk' },
  EXPIRED: { label: 'Expired', tone: 'neutral' },
})

export const clientStatus = table<ClientStatus>({
  PROSPECT: { label: 'Prospect', tone: 'neutral' },
  ONBOARDING: { label: 'Onboarding', tone: 'info' },
  ACTIVE: { label: 'Active', tone: 'ok' },
  DORMANT: { label: 'Dormant', tone: 'warn' },
  EXITED: { label: 'Exited', tone: 'neutral' },
})

export const userStatus = table<UserStatus>({
  INVITED: { label: 'Invited', tone: 'info' },
  ACTIVE: { label: 'Active', tone: 'ok' },
  SUSPENDED: { label: 'Suspended', tone: 'risk' },
})

/* --- Plain label maps (no tone) ------------------------------------------- */

export const ENTITY_TYPES: Record<string, string> = {
  PRIVATE_LIMITED: 'Private Limited',
  PUBLIC_LIMITED: 'Public Limited',
  LLP: 'LLP',
  PARTNERSHIP: 'Partnership',
  PROPRIETORSHIP: 'Proprietorship',
  HUF: 'HUF',
  TRUST: 'Trust',
  SOCIETY: 'Society',
  INDIVIDUAL: 'Individual',
}

export const DOCUMENT_KINDS: Record<string, string> = {
  PURCHASE_INVOICE: 'Purchase invoice',
  SALES_INVOICE: 'Sales invoice',
  BANK_STATEMENT: 'Bank statement',
  TDS_CERTIFICATE: 'TDS certificate',
  GST_RETURN: 'GST return',
  AIS_TIS: 'AIS / TIS',
  NOTICE: 'Notice',
  ROC_DOCUMENT: 'ROC document',
  PAYROLL_INPUT: 'Payroll input',
  OTHER: 'Other',
}

export const AUTHORITIES: Record<string, string> = {
  INCOME_TAX: 'Income Tax',
  GST: 'GST',
  ROC_MCA: 'ROC / MCA',
  TDS_CPC: 'TDS CPC',
  STATE_TAX: 'State Tax',
  OTHER: 'Other',
}

export const RISK_CHECKS: Record<string, string> = {
  DUPLICATE_PAYMENT: 'Duplicate payment',
  ROUND_SUM: 'Round-sum payment',
  BENFORD_DEVIATION: "Benford's law deviation",
  WEEKEND_ENTRY: 'Weekend / holiday entry',
  VENDOR_CONCENTRATION: 'Vendor concentration',
  OUTLIER_AMOUNT: 'Outlier amount',
  BACKDATED_ENTRY: 'Backdated entry',
}

export const FIRM_ROLES: Record<string, string> = {
  OWNER: 'Owner',
  PARTNER: 'Partner',
  MANAGER: 'Manager',
  STAFF: 'Staff',
  ARTICLE: 'Article',
  BILLING: 'Billing',
  CLIENT: 'Client',
}

export const AIS_HEADS: Record<string, string> = {
  SALARY: 'Salary',
  INTEREST: 'Interest',
  DIVIDEND: 'Dividend',
  CAPITAL_GAINS: 'Capital gains',
  BUSINESS_RECEIPTS: 'Business receipts',
  RENT: 'Rent',
  TDS_TCS: 'TDS / TCS',
  FOREIGN_REMITTANCE: 'Foreign remittance',
  OTHER: 'Other',
}

export const MCA_FORMS: Record<string, string> = {
  AOC_4: 'AOC-4',
  MGT_7: 'MGT-7',
  MGT_7A: 'MGT-7A',
  ADT_1: 'ADT-1',
  DIR_3_KYC: 'DIR-3 KYC',
  DPT_3: 'DPT-3',
  INC_20A: 'INC-20A',
  MSME_1: 'MSME-1',
  PAS_3: 'PAS-3',
  OTHER: 'Other',
}

export const CHANNELS: Record<string, string> = {
  CLIENT_PORTAL: 'Client portal',
  EMAIL: 'Email',
  WHATSAPP: 'WhatsApp',
}
