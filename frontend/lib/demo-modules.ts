/**
 * PLACEHOLDER DATA — frontend development only, part two.
 *
 * `demo-data.ts` covers the Practice and core Compliance modules; this file
 * covers the remaining eleven screens. Split by volume, not by meaning — both
 * get replaced by API calls together.
 *
 * Nothing here may reach the marketing pages.
 */

import type { FilingStatus } from './demo-data'

/* ========================================================================== */
/* Module 2 · Onboarding                                                      */
/* ========================================================================== */

export interface OnboardingStep {
  id: string
  title: string
  detail: string
  status: 'done' | 'active' | 'todo'
}

export const onboardingSteps: OnboardingStep[] = [
  { id: 'o1', title: 'Identity', detail: 'PAN and GSTIN lookup, legal name confirmed', status: 'done' },
  { id: 'o2', title: 'Registrations', detail: 'Which statutes apply — this drives the calendar', status: 'done' },
  { id: 'o3', title: 'Signatories', detail: 'Directors, partners and authorised signatories', status: 'active' },
  { id: 'o4', title: 'Engagement letter', detail: 'Drafted from the firm template, awaiting sign-off', status: 'todo' },
  { id: 'o5', title: 'Document folders', detail: 'Folder tree created for the financial year', status: 'todo' },
]

/* ========================================================================== */
/* Module 4 · Bookkeeping                                                     */
/* ========================================================================== */

export interface LedgerAccount {
  code: string
  name: string
  group: 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense'
  balance: number
}

export const ledgerAccounts: LedgerAccount[] = [
  { code: '1001', name: 'Cash in hand', group: 'Asset', balance: 84500 },
  { code: '1002', name: 'HDFC current account', group: 'Asset', balance: 1842000 },
  { code: '1200', name: 'Trade receivables', group: 'Asset', balance: 965400 },
  { code: '2001', name: 'Trade payables', group: 'Liability', balance: -612300 },
  { code: '2200', name: 'GST payable', group: 'Liability', balance: -148600 },
  { code: '3001', name: 'Partners capital', group: 'Equity', balance: -2000000 },
  { code: '4001', name: 'Professional fees', group: 'Income', balance: -3420000 },
  { code: '5010', name: 'Office rent', group: 'Expense', balance: 480000 },
  { code: '5020', name: 'Travel and conveyance', group: 'Expense', balance: 212400 },
  { code: '5030', name: 'Software subscriptions', group: 'Expense', balance: 168900 },
]

export interface LedgerSuggestion {
  id: string
  narration: string
  amount: number
  suggested: string
  confidence: number
}

export const ledgerSuggestions: LedgerSuggestion[] = [
  { id: 'ls1', narration: 'UPI/AIRTEL BROADBAND/OCT', amount: 2360, suggested: '5040 Communication', confidence: 0.96 },
  { id: 'ls2', narration: 'NEFT INDIGO AIR TICKET BLR', amount: 14870, suggested: '5020 Travel and conveyance', confidence: 0.91 },
  { id: 'ls3', narration: 'ACH DR ZOHO BOOKS ANNUAL', amount: 24000, suggested: '5030 Software subscriptions', confidence: 0.88 },
  { id: 'ls4', narration: 'CHQ 441023 CASH WITHDRAWAL', amount: 50000, suggested: '1001 Cash in hand', confidence: 0.54 },
]

/* ========================================================================== */
/* Module 6 · Income tax & AIS                                                */
/* ========================================================================== */

export interface AisRow {
  id: string
  source: string
  head: string
  aisAmount: number
  booksAmount: number | null
  tds: number
}

export const aisRows: AisRow[] = [
  { id: 'a1', source: 'HDFC Bank Ltd', head: 'Interest from savings', aisAmount: 48200, booksAmount: 48200, tds: 0 },
  { id: 'a2', source: 'Arora Trading Pvt Ltd', head: 'Professional receipts 194J', aisAmount: 1250000, booksAmount: 1250000, tds: 125000 },
  { id: 'a3', source: 'Mehta Enterprises LLP', head: 'Professional receipts 194J', aisAmount: 480000, booksAmount: 432000, tds: 48000 },
  { id: 'a4', source: 'ICICI Securities', head: 'Dividend income', aisAmount: 18600, booksAmount: null, tds: 1860 },
  { id: 'a5', source: 'Gupta Textiles Pvt Ltd', head: 'Contract payments 194C', aisAmount: 96000, booksAmount: 96000, tds: 960 },
]

/* ========================================================================== */
/* Module 7 · Notices & litigation                                            */
/* ========================================================================== */

export interface Notice {
  id: string
  ref: string
  section: string
  authority: string
  client: string
  received: string
  replyBy: string
  stage: 'parsed' | 'drafting' | 'filed' | 'closed'
  demand: number
}

export const notices: Notice[] = [
  { id: 'n1', ref: 'DIN/2026/GST/4471', section: 'GST s.73', authority: 'CGST Mumbai', client: 'Gupta Textiles', received: '2026-09-28', replyBy: '2026-11-02', stage: 'drafting', demand: 284000 },
  { id: 'n2', ref: 'ITBA/143(1)/8812', section: 'IT s.143(1)', authority: 'CPC Bengaluru', client: 'Arora Trading', received: '2026-10-04', replyBy: '2026-11-18', stage: 'parsed', demand: 46500 },
  { id: 'n3', ref: 'DIN/2026/GST/4102', section: 'GST s.61', authority: 'SGST Gujarat', client: 'Mehta Enterprises', received: '2026-08-12', replyBy: '2026-09-15', stage: 'filed', demand: 0 },
  { id: 'n4', ref: 'ITBA/139(9)/2290', section: 'IT s.139(9)', authority: 'CPC Bengaluru', client: 'Krishna Logistics', received: '2026-07-19', replyBy: '2026-08-20', stage: 'closed', demand: 0 },
]

export const noticeStageLabel: Record<Notice['stage'], string> = {
  parsed: 'Parsed',
  drafting: 'Drafting reply',
  filed: 'Reply filed',
  closed: 'Closed',
}

/* ========================================================================== */
/* Module 9 · Payroll                                                         */
/* ========================================================================== */

export interface PayrollRow {
  id: string
  employee: string
  designation: string
  gross: number
  pfEmployee: number
  esiEmployee: number
  pt: number
  tds: number
}

export const payrollRows: PayrollRow[] = [
  { id: 'p1', employee: 'Anita Raghavan', designation: 'Senior associate', gross: 78000, pfEmployee: 1800, esiEmployee: 0, pt: 200, tds: 4800 },
  { id: 'p2', employee: 'Vikram Shetty', designation: 'Associate', gross: 46000, pfEmployee: 1800, esiEmployee: 345, pt: 200, tds: 1200 },
  { id: 'p3', employee: 'Priya Menon', designation: 'Article assistant', gross: 18000, pfEmployee: 1800, esiEmployee: 135, pt: 150, tds: 0 },
  { id: 'p4', employee: 'Rahul Bose', designation: 'Article assistant', gross: 18000, pfEmployee: 1800, esiEmployee: 135, pt: 150, tds: 0 },
  { id: 'p5', employee: 'Sneha Kulkarni', designation: 'Office administrator', gross: 32000, pfEmployee: 1800, esiEmployee: 240, pt: 200, tds: 0 },
]

export function netPay(r: PayrollRow) {
  return r.gross - r.pfEmployee - r.esiEmployee - r.pt - r.tds
}

/* ========================================================================== */
/* Module 10 · Secretarial (MCA / ROC)                                        */
/* ========================================================================== */

export interface RocFiling {
  id: string
  form: string
  purpose: string
  client: string
  cin: string
  dueDate: string
  srn: string | null
  status: FilingStatus
}

export const rocFilings: RocFiling[] = [
  { id: 'r1', form: 'AOC-4', purpose: 'Financial statements', client: 'Arora Trading', cin: 'U51909MH2018PTC301442', dueDate: '2026-12-30', srn: null, status: 'pending' },
  { id: 'r2', form: 'MGT-7', purpose: 'Annual return', client: 'Arora Trading', cin: 'U51909MH2018PTC301442', dueDate: '2027-01-28', srn: null, status: 'pending' },
  { id: 'r3', form: 'DIR-3 KYC', purpose: 'Director KYC', client: 'Gupta Textiles', cin: 'U17110UP2015PTC072118', dueDate: '2026-09-30', srn: 'X98412771', status: 'filed' },
  { id: 'r4', form: 'ADT-1', purpose: 'Auditor appointment', client: 'Krishna Logistics', cin: 'U63030KA2020PTC134560', dueDate: '2026-10-14', srn: 'X98107233', status: 'filed' },
  { id: 'r5', form: 'MGT-14', purpose: 'Board resolution filing', client: 'Krishna Logistics', cin: 'U63030KA2020PTC134560', dueDate: '2026-11-08', srn: null, status: 'in-progress' },
]

export const resolutionTemplates = [
  'Appointment of a director',
  'Approval of annual accounts',
  'Opening a bank account',
  'Authorising a borrowing',
  'Appointment of statutory auditor',
  'Change of registered office',
]

/* ========================================================================== */
/* Module 8 · Risk & audit                                                    */
/* ========================================================================== */

export interface RiskTxn {
  id: string
  date: string
  narration: string
  counterparty: string
  amount: number
  score: number
  flags: string[]
}

export const riskTxns: RiskTxn[] = [
  { id: 'rk1', date: '2026-09-14', narration: 'Consultancy charges', counterparty: 'Unregistered vendor', amount: 85000, score: 68, flags: ['New counterparty', 'Round amount', 'No invoice attached'] },
  { id: 'rk2', date: '2026-09-21', narration: 'Office supplies', counterparty: 'Vector Office Solutions', amount: 128000, score: 54, flags: ['Not in GSTR-2B', 'Above category average'] },
  { id: 'rk3', date: '2026-09-29', narration: 'Transport charges', counterparty: 'Krishna Logistics', amount: 42000, score: 22, flags: [] },
  { id: 'rk4', date: '2026-09-30', narration: 'Professional fees', counterparty: 'Shah & Co', amount: 250000, score: 41, flags: ['Period-end entry'] },
]

/** First-digit distribution against the Benford expected frequencies. */
export const benford = [
  { digit: 1, expected: 30.1, observed: 28.4 },
  { digit: 2, expected: 17.6, observed: 18.9 },
  { digit: 3, expected: 12.5, observed: 11.2 },
  { digit: 4, expected: 9.7, observed: 10.4 },
  { digit: 5, expected: 7.9, observed: 12.8 },
  { digit: 6, expected: 6.7, observed: 5.9 },
  { digit: 7, expected: 5.8, observed: 4.6 },
  { digit: 8, expected: 5.1, observed: 4.2 },
  { digit: 9, expected: 4.6, observed: 3.6 },
]

/* ========================================================================== */
/* Module 13 · Collaboration                                                  */
/* ========================================================================== */

export interface Thread {
  id: string
  subject: string
  client: string
  lastMessage: string
  author: string
  at: string
  unread: number
  awaiting: 'client' | 'firm' | null
}

export const threads: Thread[] = [
  { id: 't1', subject: 'September purchase bills', client: 'Arora Trading', lastMessage: 'Uploaded the remaining four invoices.', author: 'Client', at: '2026-10-24T09:40:00+05:30', unread: 2, awaiting: 'firm' },
  { id: 't2', subject: 'GSTR-3B sign-off, October', client: 'Mehta Enterprises', lastMessage: 'Please confirm the ITC figure before we file.', author: 'S. Nair', at: '2026-10-23T17:12:00+05:30', unread: 0, awaiting: 'client' },
  { id: 't3', subject: 'Notice DIN/2026/GST/4471', client: 'Gupta Textiles', lastMessage: 'Draft reply attached for your review.', author: 'R. Iyer', at: '2026-10-22T11:05:00+05:30', unread: 1, awaiting: 'client' },
  { id: 't4', subject: 'Form 16 distribution', client: 'Krishna Logistics', lastMessage: 'All fourteen certificates issued.', author: 'A. Desai', at: '2026-10-20T15:30:00+05:30', unread: 0, awaiting: null },
]

/* ========================================================================== */
/* Module 14 · Security & access                                              */
/* ========================================================================== */

export interface Member {
  id: string
  name: string
  email: string
  role: 'Partner' | 'Staff' | 'Article' | 'Client'
  lastActive: string
  mfa: boolean
}

export const members: Member[] = [
  { id: 'm1', name: 'Ramesh Iyer', email: 'ramesh@iyerassociates.in', role: 'Partner', lastActive: '2026-10-24T10:02:00+05:30', mfa: true },
  { id: 'm2', name: 'Sudha Nair', email: 'sudha@iyerassociates.in', role: 'Staff', lastActive: '2026-10-24T09:15:00+05:30', mfa: true },
  { id: 'm3', name: 'Amit Desai', email: 'amit@iyerassociates.in', role: 'Staff', lastActive: '2026-10-23T18:40:00+05:30', mfa: false },
  { id: 'm4', name: 'Priya Menon', email: 'priya@iyerassociates.in', role: 'Article', lastActive: '2026-10-24T08:55:00+05:30', mfa: false },
  { id: 'm5', name: 'Arora Trading', email: 'accounts@aroratrading.in', role: 'Client', lastActive: '2026-10-24T09:40:00+05:30', mfa: true },
]

export interface AuditEntry {
  id: string
  at: string
  actor: string
  action: string
  target: string
}

export const auditLog: AuditEntry[] = [
  { id: 'au1', at: '2026-10-24T10:04:00+05:30', actor: 'Ramesh Iyer', action: 'Viewed reconciliation', target: 'Arora Trading · Sep 2026' },
  { id: 'au2', at: '2026-10-24T09:41:00+05:30', actor: 'Arora Trading', action: 'Uploaded document', target: 'deepak-steel-0455.pdf' },
  { id: 'au3', at: '2026-10-24T09:18:00+05:30', actor: 'Sudha Nair', action: 'Edited ledger mapping', target: 'Txn LS-2214 to 5020' },
  { id: 'au4', at: '2026-10-23T18:42:00+05:30', actor: 'Amit Desai', action: 'Exported report', target: 'Trial balance · Gupta Textiles' },
  { id: 'au5', at: '2026-10-23T17:12:00+05:30', actor: 'Sudha Nair', action: 'Requested approval', target: 'GSTR-3B · Mehta Enterprises' },
]

/** DPDP consent records held per client. */
export const consents = [
  { id: 'c1', client: 'Arora Trading', purpose: 'Bookkeeping and GST filing', granted: '2026-04-02', expires: '2027-03-31' },
  { id: 'c2', client: 'Mehta Enterprises', purpose: 'GST filing only', granted: '2026-05-18', expires: '2027-03-31' },
  { id: 'c3', client: 'Gupta Textiles', purpose: 'Full practice engagement', granted: '2026-04-11', expires: '2027-03-31' },
]

/* ========================================================================== */
/* Module 16 · Reports                                                        */
/* ========================================================================== */

export interface ReportDef {
  id: string
  name: string
  scope: string
  formats: string[]
  schedule: string | null
}

export const reportDefs: ReportDef[] = [
  { id: 'rp1', name: 'Trial balance', scope: 'Per client, per period', formats: ['PDF', 'XLSX'], schedule: null },
  { id: 'rp2', name: 'GST reconciliation summary', scope: 'Per client, per period', formats: ['PDF', 'XLSX'], schedule: 'Monthly, 22nd' },
  { id: 'rp3', name: 'Compliance status', scope: 'All clients', formats: ['PDF'], schedule: 'Weekly, Monday' },
  { id: 'rp4', name: 'ITC at risk', scope: 'All clients', formats: ['XLSX'], schedule: null },
  { id: 'rp5', name: 'Payroll register', scope: 'Per client, per month', formats: ['PDF', 'XLSX'], schedule: 'Monthly, 1st' },
  { id: 'rp6', name: 'Audit log extract', scope: 'Firm, date range', formats: ['CSV'], schedule: null },
]
