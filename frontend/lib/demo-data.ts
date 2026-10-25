/**
 * PLACEHOLDER DATA — frontend development only.
 *
 * Every export here is replaced by a NestJS API call once the backend lands.
 * Nothing in this file should ever reach the marketing pages: a landing page
 * that quotes invented numbers is dishonest, and reviewers notice.
 *
 * Shapes are deliberately close to the planned Prisma models so swapping in
 * real data is a type change, not a rewrite.
 */

export type FilingStatus = 'filed' | 'in-progress' | 'pending' | 'overdue'
export type MatchStatus = 'matched' | 'amount-mismatch' | 'missing-in-books' | 'missing-in-2b'

export interface Client {
  id: string
  name: string
  legalName: string
  gstin: string
  pan: string
  entityType: 'Private Limited' | 'LLP' | 'Proprietorship' | 'Partnership'
  gstStatus: FilingStatus
  itrStatus: FilingStatus
  openItems: number
  assignedTo: string
}

export const clients: Client[] = [
  {
    id: 'cl-001',
    name: 'Arora Trading',
    legalName: 'Arora Trading Private Limited',
    gstin: '27AABCA1234M1Z5',
    pan: 'AABCA1234M',
    entityType: 'Private Limited',
    gstStatus: 'filed',
    itrStatus: 'in-progress',
    openItems: 2,
    assignedTo: 'R. Iyer',
  },
  {
    id: 'cl-002',
    name: 'Mehta Enterprises',
    legalName: 'Mehta Enterprises LLP',
    gstin: '24AAFFM5678K1Z2',
    pan: 'AAFFM5678K',
    entityType: 'LLP',
    gstStatus: 'pending',
    itrStatus: 'pending',
    openItems: 7,
    assignedTo: 'S. Nair',
  },
  {
    id: 'cl-003',
    name: 'Gupta Textiles',
    legalName: 'Gupta Textiles Private Limited',
    gstin: '09AADCG9012P1Z8',
    pan: 'AADCG9012P',
    entityType: 'Private Limited',
    gstStatus: 'overdue',
    itrStatus: 'pending',
    openItems: 11,
    assignedTo: 'R. Iyer',
  },
  {
    id: 'cl-004',
    name: 'Shah & Co',
    legalName: 'Shah and Company',
    gstin: '27AAHFS3456L1Z1',
    pan: 'AAHFS3456L',
    entityType: 'Partnership',
    gstStatus: 'filed',
    itrStatus: 'filed',
    openItems: 0,
    assignedTo: 'A. Desai',
  },
  {
    id: 'cl-005',
    name: 'Krishna Logistics',
    legalName: 'Krishna Logistics Private Limited',
    gstin: '29AABCK7890N1Z4',
    pan: 'AABCK7890N',
    entityType: 'Private Limited',
    gstStatus: 'in-progress',
    itrStatus: 'pending',
    openItems: 4,
    assignedTo: 'S. Nair',
  },
]

/* --- GST reconciliation --------------------------------------------------- */

export interface ReconRow {
  id: string
  supplier: string
  gstin: string
  invoiceNo: string
  invoiceDate: string
  /** Value as recorded in the client's books. */
  booksTaxable: number
  booksTax: number
  /** Value as reported on the GST portal's GSTR-2B. */
  portalTaxable: number | null
  portalTax: number | null
  status: MatchStatus
  /** 0–1. How confident the matcher is in this pairing. */
  confidence: number
}

export const reconRows: ReconRow[] = [
  {
    id: 'r-1',
    supplier: 'Deepak Steel Suppliers',
    gstin: '27AACCD1122E1Z9',
    invoiceNo: 'DS/2026/0441',
    invoiceDate: '2026-09-04',
    booksTaxable: 450000,
    booksTax: 81000,
    portalTaxable: 450000,
    portalTax: 81000,
    status: 'matched',
    confidence: 1,
  },
  {
    id: 'r-2',
    supplier: 'Mehta Packaging',
    gstin: '24AAFFM5678K1Z2',
    invoiceNo: 'MP-8891',
    invoiceDate: '2026-09-11',
    booksTaxable: 75000,
    booksTax: 13500,
    portalTaxable: 78500,
    portalTax: 14130,
    status: 'amount-mismatch',
    confidence: 0.92,
  },
  {
    id: 'r-3',
    supplier: 'Vector Office Solutions',
    gstin: '27AAGCV4455R1Z3',
    invoiceNo: 'VOS/1120',
    invoiceDate: '2026-09-18',
    booksTaxable: 128000,
    booksTax: 23040,
    portalTaxable: null,
    portalTax: null,
    status: 'missing-in-2b',
    confidence: 0.78,
  },
  {
    id: 'r-4',
    supplier: 'Sunrise Chemicals',
    gstin: '33AABCS6677J1Z6',
    invoiceNo: 'SC-2026-307',
    invoiceDate: '2026-09-22',
    booksTaxable: 0,
    booksTax: 0,
    portalTaxable: 96000,
    portalTax: 17280,
    status: 'missing-in-books',
    confidence: 0.85,
  },
  {
    id: 'r-5',
    supplier: 'Deepak Steel Suppliers',
    gstin: '27AACCD1122E1Z9',
    invoiceNo: 'DS/2026/0455',
    invoiceDate: '2026-09-27',
    booksTaxable: 212000,
    booksTax: 38160,
    portalTaxable: 212000,
    portalTax: 38160,
    status: 'matched',
    confidence: 1,
  },
]

/* --- Compliance calendar -------------------------------------------------- */

export interface ComplianceTask {
  id: string
  form: string
  description: string
  dueDate: string
  client: string
  assignedTo: string
  status: FilingStatus
  period: string
}

export const complianceTasks: ComplianceTask[] = [
  {
    id: 't-1',
    form: 'GSTR-3B',
    description: 'Monthly summary return and tax payment',
    dueDate: '2026-11-20',
    client: 'Arora Trading',
    assignedTo: 'R. Iyer',
    status: 'in-progress',
    period: 'Oct 2026',
  },
  {
    id: 't-2',
    form: 'GSTR-1',
    description: 'Outward supplies statement',
    dueDate: '2026-11-11',
    client: 'Mehta Enterprises',
    assignedTo: 'S. Nair',
    status: 'pending',
    period: 'Oct 2026',
  },
  {
    id: 't-3',
    form: 'TDS 26Q',
    description: 'Quarterly TDS return, non-salary payments',
    dueDate: '2026-10-31',
    client: 'Gupta Textiles',
    assignedTo: 'R. Iyer',
    status: 'overdue',
    period: 'Q2 FY26-27',
  },
  {
    id: 't-4',
    form: 'PF ECR',
    description: 'Provident fund electronic challan return',
    dueDate: '2026-11-15',
    client: 'Krishna Logistics',
    assignedTo: 'A. Desai',
    status: 'pending',
    period: 'Oct 2026',
  },
  {
    id: 't-5',
    form: 'AOC-4',
    description: 'Annual financial statements filing with ROC',
    dueDate: '2026-12-30',
    client: 'Arora Trading',
    assignedTo: 'A. Desai',
    status: 'pending',
    period: 'FY 2025-26',
  },
  {
    id: 't-6',
    form: 'GSTR-3B',
    description: 'Monthly summary return and tax payment',
    dueDate: '2026-10-20',
    client: 'Shah & Co',
    assignedTo: 'S. Nair',
    status: 'filed',
    period: 'Sep 2026',
  },
]

/* --- Documents ------------------------------------------------------------ */

export interface DocumentRecord {
  id: string
  fileName: string
  client: string
  kind: 'Purchase invoice' | 'Sales invoice' | 'Bank statement' | 'TDS certificate'
  uploadedAt: string
  sizeKb: number
  status: 'queued' | 'extracting' | 'needs-review' | 'verified'
  /** Populated once extraction completes. */
  extracted?: {
    supplier: string
    invoiceNo: string
    taxable: number
    tax: number
    confidence: number
  }
}

export const documents: DocumentRecord[] = [
  {
    id: 'd-1',
    fileName: 'deepak-steel-0455.pdf',
    client: 'Arora Trading',
    kind: 'Purchase invoice',
    uploadedAt: '2026-10-22T09:14:00+05:30',
    sizeKb: 284,
    status: 'verified',
    extracted: {
      supplier: 'Deepak Steel Suppliers',
      invoiceNo: 'DS/2026/0455',
      taxable: 212000,
      tax: 38160,
      confidence: 0.97,
    },
  },
  {
    id: 'd-2',
    fileName: 'mehta-packaging-8891.jpg',
    client: 'Mehta Enterprises',
    kind: 'Purchase invoice',
    uploadedAt: '2026-10-22T11:02:00+05:30',
    sizeKb: 1840,
    status: 'needs-review',
    extracted: {
      supplier: 'Mehta Packaging',
      invoiceNo: 'MP-8891',
      taxable: 78500,
      tax: 14130,
      confidence: 0.64,
    },
  },
  {
    id: 'd-3',
    fileName: 'hdfc-stmt-sep-2026.pdf',
    client: 'Gupta Textiles',
    kind: 'Bank statement',
    uploadedAt: '2026-10-23T16:40:00+05:30',
    sizeKb: 612,
    status: 'extracting',
  },
  {
    id: 'd-4',
    fileName: 'form-16a-q2.pdf',
    client: 'Krishna Logistics',
    kind: 'TDS certificate',
    uploadedAt: '2026-10-24T08:25:00+05:30',
    sizeKb: 198,
    status: 'queued',
  },
]

/* --- Derived figures for the dashboard ------------------------------------ */

export const reconSummary = {
  total: reconRows.length,
  matched: reconRows.filter((r) => r.status === 'matched').length,
  mismatched: reconRows.filter((r) => r.status !== 'matched').length,
  itcAtRisk: reconRows
    .filter((r) => r.status !== 'matched')
    .reduce((sum, r) => sum + (r.portalTax ?? r.booksTax), 0),
}

export const taskSummary = {
  dueThisWeek: complianceTasks.filter((t) => t.status === 'pending' || t.status === 'in-progress')
    .length,
  overdue: complianceTasks.filter((t) => t.status === 'overdue').length,
  filed: complianceTasks.filter((t) => t.status === 'filed').length,
}

export const statusLabel: Record<FilingStatus, string> = {
  filed: 'Filed',
  'in-progress': 'In progress',
  pending: 'Pending',
  overdue: 'Overdue',
}

export const matchLabel: Record<MatchStatus, string> = {
  matched: 'Matched',
  'amount-mismatch': 'Amount differs',
  'missing-in-books': 'Not in books',
  'missing-in-2b': 'Not in 2B',
}
