// AI Features Data Models for CA·OS

// Document Collection Portal
export interface Document {
  id: string;
  clientId: string;
  fileName: string;
  type: 'invoice' | 'receipt' | 'bank-statement' | 'gst-file' | 'legal';
  uploadDate: string;
  size: number;
  status: 'pending' | 'processing' | 'extracted' | 'categorized' | 'rejected' | 'verified';
  extractedData?: ExtractedData;
  fy?: string;
  expiryDate?: string;
  versions?: { version: number; date: string; action: string; user: string }[];
}

export interface ExtractedData {
  invoiceNumber?: string;
  vendorName?: string;
  amount?: number;
  gst?: number;
  date?: string;
  description?: string;
  ledgerMapping?: string;
  category?: string;
}

// OCR & Document Processing
export interface OCRResult {
  documentId: string;
  confidence: number;
  fields: {
    invoiceNumber: string;
    vendor: string;
    amount: number;
    gst: number;
    date: string;
    description: string;
  };
}

// Ledger Mapping
export interface LedgerAccount {
  id: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  balance: number;
}

export interface LedgerMapping {
  id: string;
  transactionId: string;
  ledgerAccountId: string;
  amount: number;
  debit: boolean;
  date: string;
  confidence: number;
}

// Expense Categorization
export interface ExpenseCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export interface CategorizedExpense {
  id: string;
  clientId: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  confidence: number;
  status: 'auto' | 'reviewed' | 'manual';
}

// GST Reconciliation
export interface GSTRecord {
  id: string;
  invoiceNumber: string;
  vendor: string;
  amount: number;
  gstAmount: number;
  date: string;
  bookStatus: 'matched' | 'mismatch' | 'missing-portal' | 'missing-book';
  portalAmount?: number;
  difference?: number;
}

// Income Tax Return
export interface ITRData {
  clientId: string;
  assessmentYear: string;
  grossIncome: number;
  deductions: {
    section80C: number;
    section80D: number;
    section80E: number;
    homeLoanInterest: number;
    other: number;
  };
  taxableIncome: number;
  taxLiability: number;
  timestamp: string;
}

// Compliance Calendar
export interface ComplianceDeadline {
  id: string;
  title: string;
  type: 'gst' | 'itr' | 'tds' | 'pf' | 'roc' | 'audit';
  dueDate: string;
  frequency: 'monthly' | 'quarterly' | 'annual' | 'one-time';
  status: 'pending' | 'completed' | 'overdue';
  assignedTo?: string;
  description: string;
}

// Risk Scoring
export interface RiskScoreTransaction {
  id: string;
  clientId: string;
  amount: number;
  date: string;
  vendor: string;
  category: string;
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: string[];
  flagged: boolean;
}

// Financial Insights
export interface FinancialInsight {
  id: string;
  clientId: string;
  type: 'trend' | 'anomaly' | 'recommendation' | 'savings';
  title: string;
  description: string;
  metric: string;
  value: number;
  previousValue?: number;
  percentageChange?: number;
  actionable: boolean;
  suggestedAction?: string;
  timestamp: string;
}

// Copilot Context
export interface CopilotContext {
  clientId?: string;
  mode: 'general' | 'tax' | 'gst' | 'audit' | 'financial';
  recentTransactions?: any[];
  clientProfile?: any;
}

// Mock Data Generators
export function generateMockExpenseCategories(): ExpenseCategory[] {
  return [
    { id: '1', name: 'Travel', description: 'Travel and transportation', icon: '✈️', color: '#3B82F6' },
    { id: '2', name: 'Office Supplies', description: 'Office equipment and supplies', icon: '📎', color: '#10B981' },
    { id: '3', name: 'Food & Meals', description: 'Client meals and entertainment', icon: '🍽️', color: '#F59E0B' },
    { id: '4', name: 'Utilities', description: 'Electricity, water, internet', icon: '💡', color: '#8B5CF6' },
    { id: '5', name: 'Professional Services', description: 'Consulting, legal, audit', icon: '👔', color: '#EF4444' },
    { id: '6', name: 'Software & Tools', description: 'Software subscriptions', icon: '💻', color: '#06B6D4' },
    { id: '7', name: 'Rent & Facilities', description: 'Office rent and maintenance', icon: '🏢', color: '#EC4899' },
    { id: '8', name: 'Insurance', description: 'Business insurance', icon: '🛡️', color: '#6366F1' },
  ];
}

export function generateMockLedgers(): LedgerAccount[] {
  return [
    { id: '1', code: '1000', name: 'Cash', type: 'asset', balance: 250000 },
    { id: '2', code: '1010', name: 'Bank Account', type: 'asset', balance: 500000 },
    { id: '3', code: '2000', name: 'Accounts Payable', type: 'liability', balance: 75000 },
    { id: '4', code: '3000', name: 'Capital', type: 'equity', balance: 500000 },
    { id: '5', code: '4000', name: 'Service Revenue', type: 'revenue', balance: 1500000 },
    { id: '6', code: '5000', name: 'Office Expenses', type: 'expense', balance: 85000 },
    { id: '7', code: '5100', name: 'Travel Expenses', type: 'expense', balance: 42000 },
    { id: '8', code: '5200', name: 'Utilities', type: 'expense', balance: 18000 },
  ];
}

export function generateMockComplianceDeadlines(): ComplianceDeadline[] {
  return [
    {
      id: '1',
      title: 'GSTR-3B Filing',
      type: 'gst',
      dueDate: '2026-06-20',
      frequency: 'monthly',
      status: 'pending',
      description: 'Monthly GST return filing',
    },
    {
      id: '2',
      title: 'TDS Payment',
      type: 'tds',
      dueDate: '2026-07-07',
      frequency: 'quarterly',
      status: 'pending',
      description: 'Tax Deducted at Source payment',
    },
    {
      id: '3',
      title: 'PF Payment',
      type: 'pf',
      dueDate: '2026-07-15',
      frequency: 'monthly',
      status: 'pending',
      description: 'Provident Fund contribution',
    },
    {
      id: '4',
      title: 'Income Tax Return Filing',
      type: 'itr',
      dueDate: '2026-07-31',
      frequency: 'annual',
      status: 'pending',
      description: 'Annual income tax return',
    },
    {
      id: '5',
      title: 'Annual ROC Filing',
      type: 'roc',
      dueDate: '2026-08-31',
      frequency: 'annual',
      status: 'pending',
      description: 'Registrar of Companies annual filing',
    },
  ];
}

export function calculateRiskScore(transaction: any): number {
  let score = 20;
  
  // High amount increases risk
  if (transaction.amount > 100000) score += 15;
  if (transaction.amount > 500000) score += 20;
  
  // Frequency patterns
  if (transaction.frequency === 'unusual') score += 10;
  
  // Round amount (may indicate cash) increases risk
  if (transaction.amount % 1000 === 0 && transaction.amount > 50000) score += 8;
  
  // Time-based risk (late night, weekend transactions)
  const hour = new Date(transaction.date).getHours();
  if (hour > 22 || hour < 6) score += 5;
  
  // Vendor risk (new or high-risk categories)
  if (transaction.isNewVendor) score += 10;
  
  return Math.min(100, score);
}

export function generateFinancialInsights(clientData: any): FinancialInsight[] {
  return [
    {
      id: '1',
      clientId: clientData.id,
      type: 'trend',
      title: 'Revenue Growth',
      description: 'Revenue increased by 15% this quarter',
      metric: 'revenue',
      value: 1500000,
      previousValue: 1304348,
      percentageChange: 15,
      actionable: true,
      suggestedAction: 'Consider scaling operations',
      timestamp: new Date().toISOString(),
    },
    {
      id: '2',
      clientId: clientData.id,
      type: 'anomaly',
      title: 'Unusual Expense Pattern',
      description: 'Office expenses jumped by 45% compared to last month',
      metric: 'expenses',
      value: 125000,
      previousValue: 86000,
      percentageChange: 45,
      actionable: true,
      suggestedAction: 'Review office expense category for potential savings',
      timestamp: new Date().toISOString(),
    },
    {
      id: '3',
      clientId: clientData.id,
      type: 'recommendation',
      title: 'Tax Saving Opportunity',
      description: 'You can save ₹82,500 through Section 80C investments',
      metric: 'tax_savings',
      value: 82500,
      actionable: true,
      suggestedAction: 'Invest in life insurance or ELSS funds',
      timestamp: new Date().toISOString(),
    },
    {
      id: '4',
      clientId: clientData.id,
      type: 'savings',
      title: 'GST Optimization',
      description: 'Unclaimed ITC of ₹45,000 available',
      metric: 'itc',
      value: 45000,
      actionable: true,
      suggestedAction: 'File GST claim for available input tax credit',
      timestamp: new Date().toISOString(),
    },
  ];
}
