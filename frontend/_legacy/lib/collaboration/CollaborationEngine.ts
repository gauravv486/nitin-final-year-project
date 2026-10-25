// Client Communication & Collaboration Logic Engine

export interface CollabTask {
  id: string;
  title: string;
  description?: string;
  companyId: string;
  companyName: string;
  moduleName: string;
  assigneeName: string;
  dueDate: string;
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
  subtasks: Array<{ id: string; title: string; completed: boolean }>;
  attachments: Array<{ fileName: string; fileUrl: string }>;
  timeSpentMins: number;
  slaLimitHrs?: number;
}

export interface CollabTicket {
  id: string;
  title: string;
  description?: string;
  companyId: string;
  companyName: string;
  source: 'PORTAL' | 'EMAIL' | 'WHATSAPP';
  category: 'TAX_ADVISORY' | 'DOCUMENT_REQUEST' | 'FILING_QUERY' | 'PAYMENT_DISPUTE' | 'ACCOUNT_ACCESS' | 'GENERAL';
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  assigneeName?: string;
  csatScore?: number;
  createdAt: string;
  closedAt?: string;
}

export interface CollabInvoice {
  id: string;
  invoiceNumber: string;
  companyId: string;
  companyName: string;
  status: 'DRAFT' | 'SENT' | 'VIEWED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  billingType: 'SERVICE' | 'RETAINER' | 'MILESTONE' | 'HOURLY';
  amount: number;
  taxGst: number;
  totalAmount: number;
  paymentLink?: string;
  dueDate: string;
  createdAt: string;
}

export interface ClientRelationshipProfile {
  companyId: string;
  companyName: string;
  csatScore: number; // 0 to 5
  billingTimelinessScore: number; // 0 to 100
  docSubmissionScore: number; // 0 to 100
  communicationFrequencyScore: number; // 0 to 100
  queryResolutionScore: number; // 0 to 100
  complianceHealthScore: number; // 0 to 100
}

// 1. Relationship Health Calculator
export function calculateRelationshipScore(profile: ClientRelationshipProfile): {
  totalScore: number;
  grade: 'Excellent' | 'Healthy' | 'Needs Attention' | 'At Risk' | 'Critical';
  color: string;
} {
  // Weighted aggregate relationship health
  const totalScore = Math.round(
    profile.csatScore * 20 * 0.20 +              // CSAT (20%)
    profile.billingTimelinessScore * 0.20 +       // Payments (20%)
    profile.docSubmissionScore * 0.20 +           // Documents (20%)
    profile.communicationFrequencyScore * 0.15 +  // Frequency (15%)
    profile.queryResolutionScore * 0.15 +         // Ticket resolution (15%)
    profile.complianceHealthScore * 0.10          // Compliance Health (10%)
  );

  let grade: 'Excellent' | 'Healthy' | 'Needs Attention' | 'At Risk' | 'Critical' = 'Healthy';
  let color = 'var(--success)';

  if (totalScore >= 90) {
    grade = 'Excellent';
    color = 'rgb(16, 185, 129)'; // emerald
  } else if (totalScore >= 75) {
    grade = 'Healthy';
    color = 'rgb(59, 130, 246)'; // blue
  } else if (totalScore >= 60) {
    grade = 'Needs Attention';
    color = 'rgb(245, 158, 11)'; // amber
  } else if (totalScore >= 40) {
    grade = 'At Risk';
    color = 'rgb(239, 68, 68)'; // orange-red
  } else {
    grade = 'Critical';
    color = 'rgb(185, 28, 28)'; // dark-red
  }

  return { totalScore, grade, color };
}

// 2. Client Success Engine: Proactive Alerts
export function predictClientSuccessAlerts(profile: ClientRelationshipProfile): string[] {
  const alerts: string[] = [];

  if (profile.billingTimelinessScore < 70) {
    alerts.push(`Billing Collection Delay: Payment history is lagging behind SLA standard (Score: ${profile.billingTimelinessScore}).`);
  }
  if (profile.docSubmissionScore < 75) {
    alerts.push(`Document Expiry Pipeline Risk: Client is slow in responding to missing/expired KYC license requests.`);
  }
  if (profile.csatScore < 3.5) {
    alerts.push(`CSAT At-Risk: Post-filing survey response dropped to ${profile.csatScore}/5. Prompt contact recommended.`);
  }
  if (profile.communicationFrequencyScore < 60) {
    alerts.push(`Low Engagement Warning: Zero outbound communications logged for 14 days.`);
  }
  if (profile.complianceHealthScore < 70) {
    alerts.push(`Critical Compliance Breach: Late ROC filings and overdue PF ESI accounts logged.`);
  }

  return alerts;
}

// 3. AI Communication Assistant
export function generateAIChatDraft(
  topic: string, 
  channel: 'email' | 'whatsapp' | 'notice', 
  context: { clientName: string; extraInfo?: string }
): string {
  const clientName = context.clientName || 'Valued Client';
  const detail = context.extraInfo || '';

  if (channel === 'whatsapp') {
    if (topic.includes('invoice') || topic.includes('payment')) {
      return `Dear ${clientName},\n\nThis is a friendly reminder from your CA Advisory Desk. Invoice #${detail || 'INV-2026-004'} is outstanding. Kindly complete the payment using this link: https://pay.caos.in/tr-${Math.floor(Math.random() * 90000) + 10000}\n\nThank you!\nCA Roster System`;
    }
    if (topic.includes('doc') || topic.includes('kyc')) {
      return `Hello ${clientName},\n\nOur compliance tracker indicates your statutory GST/Pan records require update. Please upload the requested files through your portal dashboard before this weekend. \n\nRegards,\nCompliance Team`;
    }
    return `Hello ${clientName},\n\nThis is regarding your filing query "${detail}". Our team has reviewed the advisory rules, and we have updated your ticket status on the portal. Please log in to review.\n\nCA Support`;
  }

  if (channel === 'notice') {
    return `OFFICIAL COMPLIANCE ADVISORY - NOTICES DESK\n\nTo: ${clientName}\nDate: June 15, 2026\nSubject: Summary of Notice Under Section 143(1) of Income Tax Act\n\nDear Sir/Madam,\n\nWe have parsed the notice received on your behalf. A minor adjustment of ₹${detail || '12,500'} has been proposed by the department due to a mismatch between TDS credit claimed and Form 26AS records. \n\nWe recommend approving our draft response response so that we can e-file it before the deadline.\n\nSincerely,\nCA Advisory Services`;
  }

  // Default Email Channel
  return `Subject: Action Required: Important Statutory Filing Update - ${clientName}\n\nDear team at ${clientName},\n\nWe trust you are doing well.\n\nThis is to notify you that our team is preparing the filing package for your ${detail || 'GST & Corporate secretarial filings'}.\n\nTo ensure we complete all e-filing submissions within the government deadlines, we require you to review and digitally sign the draft approvals under your "Approvals" tab.\n\nIf you have any questions or require modifications, please respond to this thread or ping us on the portal messenger.\n\nBest regards,\nCA OS Advisory Services\nNew Delhi, India`;
}

// 4. Client Timeline Engine mock data
export interface TimelineEvent {
  id: string;
  companyId: string;
  eventType: 'CLIENT_CREATED' | 'DOCUMENT_UPLOADED' | 'GST_FILED' | 'NOTICE_RECEIVED' | 'TICKET_RAISED' | 'INVOICE_SENT' | 'PAYMENT_RECEIVED' | 'TASK_COMPLETED';
  description: string;
  time: string;
  metadata?: string;
}

export const MOCK_TIMELINE: TimelineEvent[] = [
  { id: 't1', companyId: 'c1', eventType: 'CLIENT_CREATED', description: 'Aegis Infotech account created and onboarded', time: '2026-04-12 10:00 AM' },
  { id: 't2', companyId: 'c1', eventType: 'DOCUMENT_UPLOADED', description: 'PAN Card PDF uploaded & OCR parsed successfully', time: '2026-04-15 02:30 PM', metadata: 'PAN_Aegis.pdf' },
  { id: 't3', companyId: 'c1', eventType: 'INVOICE_SENT', description: 'Invoice INV-2026-001 raised for incorporation retainer', time: '2026-05-01 09:00 AM', metadata: '₹25,000' },
  { id: 't4', companyId: 'c1', eventType: 'PAYMENT_RECEIVED', description: 'Retainer payment successfully captured via Razorpay', time: '2026-05-03 04:15 PM', metadata: '₹29,500 (Incl GST)' },
  { id: 't5', companyId: 'c1', eventType: 'TASK_COMPLETED', description: 'ROC Form ADT-1 auditor appointment task finalized', time: '2026-06-12 11:30 AM' },
  
  { id: 't6', companyId: 'c2', eventType: 'CLIENT_CREATED', description: 'Zylos Pharma account created', time: '2026-05-10 11:00 AM' },
  { id: 't7', companyId: 'c2', eventType: 'TICKET_RAISED', description: 'Filing Query raised: Mismatch in input tax credit credits', time: '2026-05-18 01:15 PM', metadata: 'Ticket #TK-902' },
  { id: 't8', companyId: 'c2', eventType: 'NOTICE_RECEIVED', description: 'Notice parsed from GSTIN under Section 61 (Scrutiny of return)', time: '2026-06-05 10:45 AM', metadata: 'Notice #GST-SCR-2026' },
  { id: 't9', companyId: 'c2', eventType: 'INVOICE_SENT', description: 'Invoice INV-2026-002 sent for monthly retainership', time: '2026-06-08 09:00 AM', metadata: '₹40,000' }
];

// 5. Revenue Intelligence Calculations
export function calculateRevenueIntelligence(invoices: CollabInvoice[]) {
  const totalBilled = invoices.reduce((acc, inv) => acc + inv.totalAmount, 0);
  const outstanding = invoices
    .filter(inv => inv.status === 'SENT' || inv.status === 'VIEWED' || inv.status === 'PARTIALLY_PAID' || inv.status === 'OVERDUE')
    .reduce((acc, inv) => acc + inv.totalAmount, 0);
  const collected = invoices
    .filter(inv => inv.status === 'PAID')
    .reduce((acc, inv) => acc + inv.totalAmount, 0);

  const collectionEfficiency = totalBilled > 0 ? Math.round((collected / totalBilled) * 100) : 100;

  // Monthly breakdowns (simulated)
  const monthlyRevenue = [
    { month: 'Jan', billed: 120000, collected: 110000 },
    { month: 'Feb', billed: 145000, collected: 130000 },
    { month: 'Mar', billed: 210000, collected: 195000 },
    { month: 'Apr', billed: 180000, collected: 170000 },
    { month: 'May', billed: 240000, collected: 210000 },
    { month: 'Jun', billed: totalBilled, collected: collected }
  ];

  return {
    totalBilled,
    outstanding,
    collected,
    collectionEfficiency,
    monthlyRevenue
  };
}

// 6. SLA Escalation Router
export function checkSlaEscalations(tickets: CollabTicket[]): CollabTicket[] {
  // If status is OPEN or IN_PROGRESS and they are URGENT/HIGH priority, simulate escalation check
  return tickets.map(t => {
    if ((t.status === 'OPEN' || t.status === 'IN_PROGRESS') && t.priority === 'URGENT') {
      return { ...t, assigneeName: 'Partner CA (Escalated)', priority: 'URGENT' };
    }
    return t;
  });
}
