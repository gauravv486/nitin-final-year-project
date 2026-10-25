'use client';

import React, { useState, useEffect } from 'react';
import {
  CollabTask,
  CollabTicket,
  CollabInvoice,
  ClientRelationshipProfile,
  TimelineEvent,
  calculateRelationshipScore,
  predictClientSuccessAlerts,
  generateAIChatDraft,
  MOCK_TIMELINE,
  calculateRevenueIntelligence,
  checkSlaEscalations
} from '@/lib/collaboration/CollaborationEngine';

// Roster staff list for assignment options
const ROSTER_STAFF = [
  { id: 'u1', name: 'Neha Roy', role: 'Article Assistant' },
  { id: 'u2', name: 'Rohan Mehta', role: 'Senior Consultant' },
  { id: 'u3', name: 'Priya Sharma', role: 'Partner CA' },
  { id: 'u4', name: 'Amit Verma', role: 'Tax Associate' }
];

const COMPANYS_LIST = [
  { id: 'c1', name: 'Aegis Infotech Private Limited' },
  { id: 'c2', name: 'Zylos Pharma Limited' },
  { id: 'c3', name: 'Vortex Logistics LLP' }
];

// Initial Tasks Mock Data
const INITIAL_TASKS: CollabTask[] = [
  { id: 't-101', title: 'Prepare GST Reconciliation GSTR-2B', description: 'Reconcile purchase ledger with GSTR-2B details for Aegis Infotech.', companyId: 'c1', companyName: 'Aegis Infotech', moduleName: 'GST', assigneeName: 'Neha Roy', dueDate: '2026-06-20', priority: 'HIGH', status: 'IN_PROGRESS', subtasks: [{ id: 's1', title: 'Import Purchase Register', completed: true }, { id: 's2', title: 'Match invoices', completed: false }], attachments: [{ fileName: 'purchase_register_may.csv', fileUrl: '#' }], timeSpentMins: 120 },
  { id: 't-102', title: 'ROC Form MGT-7 Filing', description: 'Draft annual return and verify director details.', companyId: 'c1', companyName: 'Aegis Infotech', moduleName: 'Corporate Secretarial', assigneeName: 'Rohan Mehta', dueDate: '2026-06-25', priority: 'NORMAL', status: 'PENDING', subtasks: [], attachments: [], timeSpentMins: 0 },
  { id: 't-103', title: 'ITR-6 Direct Tax Submission', description: 'Verify financial statements and draft ITR filing for Zylos Pharma.', companyId: 'c2', companyName: 'Zylos Pharma', moduleName: 'Income Tax', assigneeName: 'Priya Sharma', dueDate: '2026-07-31', priority: 'URGENT', status: 'PENDING', subtasks: [{ id: 's3', title: 'Verify depreciation schedules', completed: false }], attachments: [], timeSpentMins: 45 },
  { id: 't-104', title: 'Draft Response to GST Scrutiny Notice', description: 'Address discrepancy in input tax credits credits flagged by department.', companyId: 'c2', companyName: 'Zylos Pharma', moduleName: 'GST', assigneeName: 'Amit Verma', dueDate: '2026-06-18', priority: 'URGENT', status: 'IN_PROGRESS', subtasks: [], attachments: [{ fileName: 'notice_gst_sec61.pdf', fileUrl: '#' }], timeSpentMins: 240 }
];

// Initial Tickets Mock Data
const INITIAL_TICKETS: CollabTicket[] = [
  { id: 'tk-201', title: 'Mismatch in GSTR-1 & 3B Credit', description: 'Client flagged a difference of ₹1,20,000 in input credits.', companyId: 'c2', companyName: 'Zylos Pharma', source: 'WHATSAPP', category: 'FILING_QUERY', priority: 'HIGH', status: 'IN_PROGRESS', assigneeName: 'Neha Roy', createdAt: '2026-06-12 11:00 AM' },
  { id: 'tk-202', title: 'Request for Incorporation Certificate', description: 'Lender asking for copy of MOA and COI for loan approval.', companyId: 'c1', companyName: 'Aegis Infotech', source: 'PORTAL', category: 'DOCUMENT_REQUEST', priority: 'NORMAL', status: 'OPEN', assigneeName: 'Rohan Mehta', createdAt: '2026-06-14 02:30 PM' },
  { id: 'tk-203', title: 'ITR Filing Delay Question', description: 'Client querying if audit deadline got extended by CBDT.', companyId: 'c3', companyName: 'Vortex Logistics LLP', source: 'EMAIL', category: 'TAX_ADVISORY', priority: 'LOW', status: 'OPEN', assigneeName: 'Amit Verma', createdAt: '2026-06-15 09:00 AM' }
];

// Initial Invoices Mock Data
const INITIAL_INVOICES: CollabInvoice[] = [
  { id: 'inv-301', invoiceNumber: 'INV-2026-001', companyId: 'c1', companyName: 'Aegis Infotech', status: 'PAID', billingType: 'RETAINER', amount: 25000, taxGst: 4500, totalAmount: 29500, paymentLink: 'https://pay.caos.in/tr-88231', dueDate: '2026-05-15', createdAt: '2026-05-01' },
  { id: 'inv-302', invoiceNumber: 'INV-2026-002', companyId: 'c2', companyName: 'Zylos Pharma', status: 'SENT', billingType: 'SERVICE', amount: 50000, taxGst: 9000, totalAmount: 59000, paymentLink: 'https://pay.caos.in/tr-12093', dueDate: '2026-06-30', createdAt: '2026-06-08' },
  { id: 'inv-303', invoiceNumber: 'INV-2026-003', companyId: 'c3', companyName: 'Vortex Logistics LLP', status: 'OVERDUE', billingType: 'HOURLY', amount: 15000, taxGst: 2700, totalAmount: 17700, paymentLink: 'https://pay.caos.in/tr-45412', dueDate: '2026-06-10', createdAt: '2026-05-25' }
];

// Initial CRM Health Roster Profiles
const INITIAL_HEALTH: ClientRelationshipProfile[] = [
  { companyId: 'c1', companyName: 'Aegis Infotech Private Limited', csatScore: 4.8, billingTimelinessScore: 95, docSubmissionScore: 90, communicationFrequencyScore: 85, queryResolutionScore: 92, complianceHealthScore: 95 },
  { companyId: 'c2', companyName: 'Zylos Pharma Limited', csatScore: 3.2, billingTimelinessScore: 65, docSubmissionScore: 50, communicationFrequencyScore: 90, queryResolutionScore: 78, complianceHealthScore: 40 },
  { companyId: 'c3', companyName: 'Vortex Logistics LLP', csatScore: 4.2, billingTimelinessScore: 80, docSubmissionScore: 85, communicationFrequencyScore: 70, queryResolutionScore: 88, complianceHealthScore: 90 }
];

// Initial Chat History
const INITIAL_CHATS = [
  { id: 'ch-1', title: 'Aegis Staff Project Channel', type: 'GROUP', companyId: 'c1', messages: [
    { sender: 'Priya Sharma', role: 'Partner CA', text: 'Rohan, did we compile the ADT-1 audit auditor credentials for Aegis?', time: 'Yesterday, 04:15 PM' },
    { sender: 'Rohan Mehta', role: 'Senior Consultant', text: 'Yes Priya. Signed credential letter is in the Aegis document locker.', time: 'Yesterday, 04:30 PM' }
  ]},
  { id: 'ch-2', title: 'Zylos Pharma WhatsApp Support', type: 'WHATSAPP', companyId: 'c2', messages: [
    { sender: 'Dr. Srinivas Murthy', role: 'Client MD', text: 'Our accounts team has uploaded the bank transactions. Please draft the GST GSTR-3B reconciliation.', time: 'Today, 10:20 AM' },
    { sender: 'Neha Roy', role: 'Article Assistant', text: 'On it, Doctor. Reconciling with GSTR-2B right away.', time: 'Today, 10:35 AM' }
  ]},
  { id: 'ch-3', title: 'Vortex Logistics Direct Desk', type: 'DIRECT', companyId: 'c3', messages: [
    { sender: 'Priya Sharma', role: 'Partner CA', text: 'Amit, please draft the reply letter to their tax notice summary.', time: '2 days ago' },
    { sender: 'Amit Verma', role: 'Tax Associate', text: 'Drafted. Shared in the approvals panel for client review.', time: '2 days ago' }
  ]}
];

// Initial Approvals Mock Data
const INITIAL_APPROVALS = [
  { id: 'ap-1', title: 'GSTR-3B Filing Package - Aegis', type: 'GST_FILING', companyName: 'Aegis Infotech', status: 'REVIEW', requester: 'Neha Roy', date: '2026-06-14', comments: 'Needs final validation of input credit credits.' },
  { id: 'ap-2', title: 'Form MGT-7 Audit Report - Aegis', type: 'AUDIT_REPORT', companyName: 'Aegis Infotech', status: 'APPROVED', requester: 'Rohan Mehta', date: '2026-06-12', comments: 'Digital signatures verified.' },
  { id: 'ap-3', title: 'GST Scrutiny Notice Draft Reply - Zylos', type: 'NOTICE', companyName: 'Zylos Pharma', status: 'DRAFT', requester: 'Amit Verma', date: '2026-06-15', comments: 'Drafting response to input credit discrepancies.' }
];

export default function CollaborationHub() {
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'tasks' | 'tickets' | 'chat' | 'billing' | 'workspace' | 'approvals' | 'timeline' | 'ai'>('dashboard');

  // Unified States
  const [tasks, setTasks] = useState<CollabTask[]>(INITIAL_TASKS);
  const [tickets, setTickets] = useState<CollabTicket[]>(INITIAL_TICKETS);
  const [invoices, setInvoices] = useState<CollabInvoice[]>(INITIAL_INVOICES);
  const [healthScores, setHealthScores] = useState<ClientRelationshipProfile[]>(INITIAL_HEALTH);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>(MOCK_TIMELINE);
  const [chats, setChats] = useState(INITIAL_CHATS);
  const [approvals, setApprovals] = useState(INITIAL_APPROVALS);

  // Filters
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('ALL');
  const [taskViewMode, setTaskViewMode] = useState<'kanban' | 'list'>('kanban');

  // 1. Task Creation States
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCompany, setNewTaskCompany] = useState('c1');
  const [newTaskModule, setNewTaskModule] = useState('GST');
  const [newTaskAssignee, setNewTaskAssignee] = useState('Neha Roy');
  const [newTaskDue, setNewTaskDue] = useState('2026-06-25');
  const [newTaskPriority, setNewTaskPriority] = useState<'URGENT' | 'HIGH' | 'NORMAL' | 'LOW'>('NORMAL');

  const handleCreateTask = () => {
    if (!newTaskTitle.trim()) return;
    const companyName = COMPANYS_LIST.find(c => c.id === newTaskCompany)?.name.split(' ')[0] || 'Client';
    const created: CollabTask = {
      id: `t-${Date.now()}`,
      title: newTaskTitle,
      companyId: newTaskCompany,
      companyName,
      moduleName: newTaskModule,
      assigneeName: newTaskAssignee,
      dueDate: newTaskDue,
      priority: newTaskPriority,
      status: 'PENDING',
      subtasks: [],
      attachments: [],
      timeSpentMins: 0
    };
    setTasks([...tasks, created]);
    setNewTaskTitle('');
    
    // Add event to timeline
    const timelineEvent: TimelineEvent = {
      id: `tl-${Date.now()}`,
      companyId: newTaskCompany,
      eventType: 'CLIENT_CREATED', // maps to a task creation log
      description: `New task raised: ${newTaskTitle} (Assigned to ${newTaskAssignee})`,
      time: 'Just now'
    };
    setTimelineEvents([timelineEvent, ...timelineEvents]);
    alert('Task successfully registered.');
  };

  // 2. Ticket Actions
  const handleResolveTicket = (id: string) => {
    setTickets(tickets.map(t => t.id === id ? { ...t, status: 'RESOLVED', closedAt: '2026-06-15 20:47' } : t));
  };

  const handleSnoozeTicketSLA = (id: string) => {
    setTickets(tickets.map(t => t.id === id ? { ...t, priority: 'LOW', title: `${t.title} (Snoozed)` } : t));
    alert('Ticket SLA response window snoozed by 24h.');
  };

  const handleCSATSurvey = (id: string, score: number) => {
    setTickets(tickets.map(t => t.id === id ? { ...t, csatScore: score, status: 'CLOSED' } : t));
    alert(`Thank you! CSAT rating of ${score}/5 saved for Ticket #${id}.`);
  };

  // 3. Invoice Generation States
  const [invoiceClient, setInvoiceClient] = useState('c1');
  const [invoiceBillingType, setInvoiceBillingType] = useState<'SERVICE' | 'RETAINER' | 'MILESTONE' | 'HOURLY'>('RETAINER');
  const [invoiceAmount, setInvoiceAmount] = useState(20000);
  const [invoiceDue, setInvoiceDue] = useState('2026-06-30');

  const handleGenerateInvoice = () => {
    const gstRate = 0.18;
    const tax = Math.round(invoiceAmount * gstRate);
    const total = invoiceAmount + tax;
    const invNum = `INV-2026-00${invoices.length + 1}`;
    const companyName = COMPANYS_LIST.find(c => c.id === invoiceClient)?.name.split(' ')[0] || 'Client';

    const inv: CollabInvoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: invNum,
      companyId: invoiceClient,
      companyName,
      status: 'SENT',
      billingType: invoiceBillingType,
      amount: invoiceAmount,
      taxGst: tax,
      totalAmount: total,
      paymentLink: `https://pay.caos.in/tr-${Math.floor(Math.random() * 90000) + 10000}`,
      dueDate: invoiceDue,
      createdAt: '2026-06-15'
    };

    setInvoices([inv, ...invoices]);

    // Push to timeline
    const timelineEvent: TimelineEvent = {
      id: `tl-${Date.now()}`,
      companyId: invoiceClient,
      eventType: 'INVOICE_SENT',
      description: `Invoice ${invNum} raised for ${invoiceBillingType} billing`,
      time: 'Just now',
      metadata: `₹${total.toLocaleString()}`
    };
    setTimelineEvents([timelineEvent, ...timelineEvents]);
    alert(`Invoice ${invNum} generated. Sent payment link to client. Total (with 18% GST): ₹${total.toLocaleString()}`);
  };

  // 4. Chat States
  const [selectedChatId, setSelectedChatId] = useState('ch-1');
  const [chatInput, setChatInput] = useState('');

  const activeChat = chats.find(c => c.id === selectedChatId) || chats[0];

  const handleSendChatMessage = () => {
    if (!chatInput.trim()) return;
    const newMsg = {
      sender: 'Priya Sharma',
      role: 'Partner CA',
      text: chatInput,
      time: 'Just now'
    };

    setChats(chats.map(ch => {
      if (ch.id === selectedChatId) {
        return { ...ch, messages: [...ch.messages, newMsg] };
      }
      return ch;
    }));
    setChatInput('');

    // Simulate automated client response
    setTimeout(() => {
      const responses: Record<string, string> = {
        'ch-1': "Thanks Priya, verified the folder directory. Let's archive.",
        'ch-2': 'Understood Neha. Let us know once GSTR-3B reconciliation is ready for approval.',
        'ch-3': 'Perfect Amit, reviewing the GST Scrutiny draft right now in the approvals tab.'
      };
      const responseMsg = {
        sender: activeChat.type === 'WHATSAPP' ? 'Dr. Srinivas Murthy' : 'Aegis Representative',
        role: 'Client',
        text: responses[selectedChatId] || 'Thanks for the quick update!',
        time: 'Just now'
      };
      setChats(prevChats => prevChats.map(ch => {
        if (ch.id === selectedChatId) {
          return { ...ch, messages: [...ch.messages, responseMsg] };
        }
        return ch;
      }));
    }, 1200);
  };

  // 5. Approvals Handlers
  const handleApproveAction = (id: string, isApproved: boolean) => {
    setApprovals(approvals.map(ap => ap.id === id ? { ...ap, status: isApproved ? 'APPROVED' : 'DRAFT', comments: isApproved ? 'Approved digitally.' : 'Rejected. Revise calculations.' } : ap));
  };

  // 6. AI Draft States
  const [aiDraftTopic, setAiDraftTopic] = useState('payment');
  const [aiDraftChannel, setAiDraftChannel] = useState<'email' | 'whatsapp' | 'notice'>('whatsapp');
  const [aiDraftClient, setAiDraftClient] = useState('c1');
  const [aiGeneratedText, setAiGeneratedText] = useState('');

  const handleGenerateAIDraft = () => {
    const cName = COMPANYS_LIST.find(c => c.id === aiDraftClient)?.name || '';
    const text = generateAIChatDraft(aiDraftTopic, aiDraftChannel, { clientName: cName, extraInfo: 'INV-2026-003' });
    setAiGeneratedText(text);
  };

  // 7. Timeline states
  const [timelineSearch, setTimelineSearch] = useState('');

  // 8. Financial stats calculations
  const revenueStats = calculateRevenueIntelligence(invoices);

  // Escalate ticket routing simulator
  const escalatedTickets = checkSlaEscalations(tickets);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', fontFamily: 'inherit', color: 'var(--text-primary)' }}>
      
      {/* Header bar */}
      <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', letterSpacing: '-0.02em', color: 'var(--primary)' }}>CRM Collaboration Hub</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Centralized workspace for messaging, invoicing, workflows, and task SLAs.</p>
        </div>
        
        {/* Workspace Quick selector */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>CLIENT SCOPE:</span>
          <select 
            value={selectedCompanyId} 
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-light)', color: 'var(--text-primary)', fontWeight: '600', outline: 'none' }}
          >
            <option value="ALL">All Clients (Roster Scope)</option>
            {COMPANYS_LIST.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Sub Tabs menu */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', overflowX: 'auto', gap: '4px' }}>
        {[
          { id: 'dashboard', label: '📊 Command Center' },
          { id: 'tasks', label: '✓ Work Manager' },
          { id: 'tickets', label: '🎟️ Support Desk' },
          { id: 'chat', label: '💬 Chat Lounge' },
          { id: 'billing', label: '📄 Billing Engine' },
          { id: 'workspace', label: '👥 Client Spaces' },
          { id: 'approvals', label: '✍️ Approvals Room' },
          { id: 'timeline', label: '⏳ Timeline Audit' },
          { id: 'ai', label: '🤖 AI Copywriter' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            style={{
              padding: '12px 18px',
              background: 'none',
              border: 'none',
              borderBottom: activeSubTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeSubTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: activeSubTab === tab.id ? '700' : '500',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontSize: '13.5px',
              transition: 'all 0.2s ease'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content wrapper */}
      <div style={{ minHeight: '600px' }}>
        
        {/* ======================= SUB-TAB 1: PRODUCTIVITY COMMAND CENTER ======================= */}
        {activeSubTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* KPI Cards row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Open Tickets</span>
                <span style={{ fontSize: '32px', fontWeight: '800', color: 'var(--warning)' }}>
                  {tickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Average response SLA: 45 mins</span>
              </div>
              <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Overdue Work Tasks</span>
                <span style={{ fontSize: '32px', fontWeight: '800', color: 'var(--danger)' }}>
                  {tasks.filter(t => t.status === 'OVERDUE').length}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Escalation level triggers: active</span>
              </div>
              <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Outstanding Receivables</span>
                <span style={{ fontSize: '32px', fontWeight: '800', color: 'var(--primary)' }}>
                  ₹{revenueStats.outstanding.toLocaleString()}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: '700' }}>Collection efficiency: {revenueStats.collectionEfficiency}%</span>
              </div>
              <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Approval pipeline</span>
                <span style={{ fontSize: '32px', fontWeight: '800', color: 'var(--success)' }}>
                  {approvals.filter(a => a.status === 'REVIEW').length} pending
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Awaiting client digital e-signature</span>
              </div>
            </div>

            {/* Split row: Client Health Score vs Revenue Chart */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flexWrap: 'wrap' }}>
              
              {/* Client Health scorecard list */}
              <div className="card" style={{ padding: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  🤝 CRM Client Relationship Scores
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {healthScores.map(profile => {
                    const health = calculateRelationshipScore(profile);
                    const proactiveAlerts = predictClientSuccessAlerts(profile);
                    return (
                      <div key={profile.companyId} style={{ padding: '12px', background: 'var(--bg-light)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontWeight: '700', fontSize: '13px' }}>{profile.companyName}</span>
                          <span style={{ fontWeight: '800', color: health.color, fontSize: '13.5px' }}>{health.totalScore}% ({health.grade})</span>
                        </div>
                        
                        {/* Progress healthbar */}
                        <div style={{ height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
                          <div style={{ width: `${health.totalScore}%`, height: '100%', background: health.color }} />
                        </div>

                        {/* Breakdown scores */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>
                          <div>CSAT: <b>{profile.csatScore}/5</b></div>
                          <div>Pay: <b>{profile.billingTimelinessScore}</b></div>
                          <div>Doc: <b>{profile.docSubmissionScore}</b></div>
                          <div>Freq: <b>{profile.communicationFrequencyScore}</b></div>
                          <div>Comp: <b>{profile.complianceHealthScore}</b></div>
                        </div>

                        {/* Proactive alert trigger warning */}
                        {proactiveAlerts.length > 0 && (
                          <div style={{ marginTop: '8px', padding: '6px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '4px', borderLeft: '3px solid rgb(239, 68, 68)' }}>
                            {proactiveAlerts.slice(0, 1).map((a, i) => (
                              <div key={i} style={{ fontSize: '11px', color: 'rgb(185, 28, 28)', fontWeight: '600' }}>⚠️ Alert: {a}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Revenue intelligence breakdown widget */}
              <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  💰 Billing & Revenue Intelligence
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', textAlign: 'center' }}>
                  <div style={{ background: 'var(--bg-light)', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>TOTAL BILLED</div>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--primary)' }}>₹{revenueStats.totalBilled.toLocaleString()}</div>
                  </div>
                  <div style={{ background: 'var(--bg-light)', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>COLLECTED</div>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--success)' }}>₹{revenueStats.collected.toLocaleString()}</div>
                  </div>
                  <div style={{ background: 'var(--bg-light)', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>OUTSTANDING</div>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--danger)' }}>₹{revenueStats.outstanding.toLocaleString()}</div>
                  </div>
                </div>

                {/* Simulated Chart Bars */}
                <div>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>Monthly Collection Pipeline Trend:</span>
                  <div style={{ display: 'flex', justifyItems: 'end', justifyContent: 'space-between', height: '100px', padding: '10px 0 4px 0', borderBottom: '1px solid var(--border-color)', marginTop: '8px' }}>
                    {revenueStats.monthlyRevenue.map((mr, idx) => {
                      const maxBilled = 300000;
                      const barHt = Math.round((mr.billed / maxBilled) * 80) + 10;
                      return (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1' }}>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'end', height: '80px' }}>
                            {/* Billed bar */}
                            <div style={{ width: '12px', height: `${barHt}px`, background: 'var(--primary-light)', borderRadius: '3px' }} title={`Billed: ₹${mr.billed}`} />
                            {/* Collected bar */}
                            <div style={{ width: '12px', height: `${Math.round((mr.collected / maxBilled) * 80) + 10}px`, background: 'var(--success)', borderRadius: '3px' }} title={`Collected: ₹${mr.collected}`} />
                          </div>
                          <span style={{ fontSize: '9px', marginTop: '4px', fontWeight: '700' }}>{mr.month}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <span>🔒 Escrow Payment Gateways Linked</span>
                  <span>Average collection delay: <b>4.2 Days</b></span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================= SUB-TAB 2: WORK MANAGEMENT (TASKS) ======================= */}
        {activeSubTab === 'tasks' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Control & Creation row */}
            <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => setTaskViewMode('kanban')}
                    style={{ padding: '6px 12px', background: taskViewMode === 'kanban' ? 'var(--primary)' : 'none', color: taskViewMode === 'kanban' ? '#fff' : 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}
                  >
                    Kanban View
                  </button>
                  <button 
                    onClick={() => setTaskViewMode('list')}
                    style={{ padding: '6px 12px', background: taskViewMode === 'list' ? 'var(--primary)' : 'none', color: taskViewMode === 'list' ? '#fff' : 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}
                  >
                    List View
                  </button>
                </div>
                <h4 style={{ fontSize: '14px', fontWeight: '700' }}>Raise New Client Task / SLA Target</h4>
              </div>

              {/* Task Creation Form inline */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                <input 
                  type="text" 
                  placeholder="Task title (e.g. Audit checklist review)" 
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  style={{ gridColumn: 'span 2', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                />
                <select value={newTaskCompany} onChange={(e) => setNewTaskCompany(e.target.value)} style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}>
                  {COMPANYS_LIST.map(c => <option key={c.id} value={c.id}>{c.name.split(' ')[0]}</option>)}
                </select>
                <select value={newTaskModule} onChange={(e) => setNewTaskModule(e.target.value)} style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}>
                  <option value="GST">GST Module</option>
                  <option value="Income Tax">Income Tax</option>
                  <option value="Corporate Secretarial">Secretarial</option>
                  <option value="Firms Account">Accounts</option>
                </select>
                <select value={newTaskAssignee} onChange={(e) => setNewTaskAssignee(e.target.value)} style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}>
                  {ROSTER_STAFF.map(st => <option key={st.id} value={st.name}>{st.name} ({st.role.split(' ')[0]})</option>)}
                </select>
                <input 
                  type="date" 
                  value={newTaskDue}
                  onChange={(e) => setNewTaskDue(e.target.value)}
                  style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                />
                <button 
                  onClick={handleCreateTask}
                  style={{ padding: '8px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '700', fontSize: '12.5px', cursor: 'pointer' }}
                >
                  Create Task
                </button>
              </div>
            </div>

            {/* Kanban view */}
            {taskViewMode === 'kanban' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                
                {/* PENDING COLUMN */}
                <div style={{ background: 'var(--bg-light)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', minHeight: '380px' }}>
                  <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontWeight: '700', fontSize: '13px' }}>📋 PENDING</span>
                    <span className="badge badge-info">{tasks.filter(t => t.status === 'PENDING').length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {tasks.filter(t => t.status === 'PENDING').map(t => (
                      <div key={t.id} className="card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '10px', background: 'var(--border-color)', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>{t.moduleName}</span>
                          <span className={`badge badge-${t.priority === 'URGENT' ? 'danger' : 'warning'}`} style={{ fontSize: '9px' }}>{t.priority}</span>
                        </div>
                        <div style={{ fontSize: '12.5px', fontWeight: '700' }}>{t.title}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Client: <b>{t.companyName}</b></div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Due: {t.dueDate} | Staff: {t.assigneeName}</div>
                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '6px', display: 'flex', justifyContent: 'flex-end' }}>
                          <button 
                            onClick={() => setTasks(tasks.map(x => x.id === t.id ? { ...x, status: 'IN_PROGRESS' } : x))}
                            style={{ padding: '3px 8px', background: 'var(--primary-light)', color: 'var(--primary)', border: 'none', borderRadius: '4px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}
                          >
                            Start Task →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* IN PROGRESS COLUMN */}
                <div style={{ background: 'var(--bg-light)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontWeight: '700', fontSize: '13px' }}>⚡ IN PROGRESS</span>
                    <span className="badge badge-warning">{tasks.filter(t => t.status === 'IN_PROGRESS').length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {tasks.filter(t => t.status === 'IN_PROGRESS').map(t => (
                      <div key={t.id} className="card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '10px', background: 'var(--border-color)', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>{t.moduleName}</span>
                          <span className={`badge badge-${t.priority === 'URGENT' ? 'danger' : 'warning'}`} style={{ fontSize: '9px' }}>{t.priority}</span>
                        </div>
                        <div style={{ fontSize: '12.5px', fontWeight: '700' }}>{t.title}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Client: <b>{t.companyName}</b></div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Due: {t.dueDate} | Staff: {t.assigneeName}</div>
                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '6px', display: 'flex', justifyItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>⏱️ {t.timeSpentMins} mins logged</span>
                          <button 
                            onClick={() => setTasks(tasks.map(x => x.id === t.id ? { ...x, status: 'COMPLETED' } : x))}
                            style={{ padding: '3px 8px', background: 'var(--success-light)', color: 'var(--success)', border: 'none', borderRadius: '4px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}
                          >
                            Mark Complete ✓
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* COMPLETED COLUMN */}
                <div style={{ background: 'var(--bg-light)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontWeight: '700', fontSize: '13px' }}>✔ COMPLETED</span>
                    <span className="badge badge-success">{tasks.filter(t => t.status === 'COMPLETED').length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {tasks.filter(t => t.status === 'COMPLETED').map(t => (
                      <div key={t.id} className="card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', opacity: 0.8 }}>
                        <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '10px', background: 'var(--border-color)', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>{t.moduleName}</span>
                          <span className="badge badge-success" style={{ fontSize: '9px' }}>DONE</span>
                        </div>
                        <div style={{ fontSize: '12.5px', fontWeight: '700', textDecoration: 'line-through' }}>{t.title}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Client: <b>{t.companyName}</b></div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Finished on: {t.dueDate} | {t.assigneeName}</div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            ) : (
              // List View
              <div className="card" style={{ padding: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Task ID</th>
                      <th style={{ padding: '8px' }}>Title</th>
                      <th style={{ padding: '8px' }}>Client</th>
                      <th style={{ padding: '8px' }}>Assignee</th>
                      <th style={{ padding: '8px' }}>Priority</th>
                      <th style={{ padding: '8px' }}>Due Date</th>
                      <th style={{ padding: '8px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map(t => (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--bg-gray)' }}>
                        <td style={{ padding: '10px 8px', fontWeight: '600' }}>{t.id}</td>
                        <td style={{ padding: '10px 8px' }}>
                          <div style={{ fontWeight: '700' }}>{t.title}</div>
                          {t.description && <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t.description}</div>}
                        </td>
                        <td style={{ padding: '10px 8px' }}>{t.companyName}</td>
                        <td style={{ padding: '10px 8px' }}>{t.assigneeName}</td>
                        <td style={{ padding: '10px 8px' }}>
                          <span className={`badge badge-${t.priority === 'URGENT' ? 'danger' : 'warning'}`}>{t.priority}</span>
                        </td>
                        <td style={{ padding: '10px 8px' }}>{t.dueDate}</td>
                        <td style={{ padding: '10px 8px' }}>
                          <span className={`badge badge-${t.status === 'COMPLETED' ? 'success' : t.status === 'IN_PROGRESS' ? 'warning' : 'info'}`}>
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ======================= SUB-TAB 3: TICKET SUPPORT DESK ======================= */}
        {activeSubTab === 'tickets' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
            
            {/* Active Tickets List */}
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                🎟️ Active Client Support Tickets
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {escalatedTickets.map(tk => (
                  <div key={tk.id} style={{ padding: '16px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: '800', color: 'var(--primary)' }}>#{tk.id.toUpperCase()}</span>
                        <span style={{ fontSize: '10px', background: 'var(--border-color)', padding: '2px 8px', borderRadius: '10px', fontWeight: '700' }}>{tk.category}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span className={`badge badge-${tk.source === 'WHATSAPP' ? 'success' : tk.source === 'PORTAL' ? 'info' : 'warning'}`} style={{ fontSize: '9.5px' }}>
                          {tk.source}
                        </span>
                        <span className={`badge badge-${tk.priority === 'HIGH' || tk.priority === 'URGENT' ? 'danger' : 'info'}`} style={{ fontSize: '9.5px' }}>
                          {tk.priority}
                        </span>
                      </div>
                    </div>

                    <div style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-primary)' }}>{tk.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{tk.description}</div>
                    
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                      Client: <b>{tk.companyName}</b> | Roster Assignee: <b>{tk.assigneeName}</b> | Raised: {tk.createdAt}
                    </div>

                    {/* Action controls based on state */}
                    <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '10px', paddingTop: '8px', display: 'flex', justifyItems: 'center', justifyContent: 'space-between' }}>
                      {tk.status === 'RESOLVED' ? (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ color: 'var(--success)', fontSize: '11.5px', fontWeight: '700' }}>✔ Resolved. Request CSAT:</span>
                          {[1, 2, 3, 4, 5].map(star => (
                            <button 
                              key={star} 
                              onClick={() => handleCSATSurvey(tk.id, star)}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', color: tk.csatScore && tk.csatScore >= star ? 'gold' : '#ccc' }}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                      ) : tk.status === 'CLOSED' ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '700' }}>✔ Ticket Closed (CSAT: {tk.csatScore}/5)</span>
                      ) : (
                        <>
                          <button 
                            onClick={() => handleSnoozeTicketSLA(tk.id)}
                            style={{ padding: '4px 8px', background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                          >
                            Snooze SLA
                          </button>
                          <button 
                            onClick={() => handleResolveTicket(tk.id)}
                            style={{ padding: '4px 12px', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                          >
                            Mark Resolved
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SLA Escaped matrix info */}
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                ⚡ Auto Routing SLA Policy
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Urgent and High priority tickets raised via WhatsApp or Email are automatically escalated to a Senior Associate or Partner if not acknowledged within 30 minutes.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11.5px' }}>
                <div style={{ padding: '8px', background: 'var(--bg-light)', borderRadius: '6px', borderLeft: '3px solid var(--danger)' }}>
                  <b>Urgent Priority SLA:</b> 30 Mins (Routes to Partner)
                </div>
                <div style={{ padding: '8px', background: 'var(--bg-light)', borderRadius: '6px', borderLeft: '3px solid var(--warning)' }}>
                  <b>High Priority SLA:</b> 4 Hours (Routes to Senior)
                </div>
                <div style={{ padding: '8px', background: 'var(--bg-light)', borderRadius: '6px', borderLeft: '3px solid var(--primary)' }}>
                  <b>Normal Priority SLA:</b> 24 Hours (Routes to Associate)
                </div>
              </div>

              <div style={{ background: 'var(--primary-light)', padding: '12px', borderRadius: '8px', border: '1px solid var(--primary)' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary)', display: 'block', marginBottom: '4px' }}>💡 SLA Analytics:</span>
                <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                  Firm is responding to <b>94.5%</b> of statutory tickets within SLA guidelines this quarter.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ======================= SUB-TAB 4: IN-APP CHAT LOUNGE ======================= */}
        {activeSubTab === 'chat' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', height: '520px', background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
            
            {/* Sidebar Room List */}
            <div style={{ borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px', background: 'var(--bg-light)', borderBottom: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Channels & Chats</h4>
              </div>
              <div style={{ flex: '1', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {chats.map(ch => (
                  <button
                    key={ch.id}
                    onClick={() => setSelectedChatId(ch.id)}
                    style={{
                      padding: '16px 14px',
                      background: selectedChatId === ch.id ? 'var(--primary-light)' : 'none',
                      border: 'none',
                      borderBottom: '1px solid var(--bg-gray)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <span style={{ fontWeight: '700', fontSize: '12.5px', color: selectedChatId === ch.id ? 'var(--primary)' : 'var(--text-primary)' }}>{ch.title}</span>
                      <span style={{ fontSize: '8px', background: ch.type === 'WHATSAPP' ? 'var(--success-light)' : 'var(--border-color)', color: ch.type === 'WHATSAPP' ? 'var(--success)' : 'var(--text-secondary)', padding: '2px 6px', borderRadius: '8px', fontWeight: '800' }}>
                        {ch.type}
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '180px' }}>
                      {ch.messages[ch.messages.length - 1]?.text || 'No messages'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Conversation Thread */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              
              {/* Top bar info */}
              <div style={{ padding: '14px 20px', background: 'var(--bg-light)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: '700' }}>{activeChat.title}</h4>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>🔒 End-to-end Encrypted | Presence Status: <b>Online</b></span>
                </div>
              </div>

              {/* Messages viewport */}
              <div style={{ flex: '1', padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-light)' }}>
                {activeChat.messages.map((m, idx) => {
                  const isStaff = m.sender === 'Priya Sharma' || m.sender === 'Rohan Mehta' || m.sender === 'Amit Verma' || m.sender === 'Neha Roy';
                  return (
                    <div 
                      key={idx} 
                      style={{
                        alignSelf: isStaff ? 'flex-end' : 'flex-start',
                        background: isStaff ? 'var(--primary)' : 'var(--bg-white)',
                        color: isStaff ? '#fff' : 'var(--text-primary)',
                        padding: '10px 14px',
                        borderRadius: '12px',
                        maxWidth: '70%',
                        fontSize: '12.5px',
                        boxShadow: 'var(--shadow-sm)',
                        lineHeight: '1.4',
                        border: isStaff ? 'none' : '1px solid var(--border-color)'
                      }}
                    >
                      <div style={{ fontSize: '10px', color: isStaff ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)', fontWeight: '700', marginBottom: '2px' }}>
                        {m.sender} ({m.role})
                      </div>
                      <div>{m.text}</div>
                      <div style={{ fontSize: '8.5px', color: isStaff ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)', textAlign: 'right', marginTop: '4px' }}>
                        {m.time} {isStaff && '✓✓'}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Typing inputs */}
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  placeholder="Type secure reply message..." 
                  value={chatInput} 
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                  style={{ flex: '1', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-light)', fontSize: '12.5px', outline: 'none' }}
                />
                
                {/* Context linker placeholder dropdown */}
                <select style={{ width: '110px', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '11px', background: 'var(--bg-light)' }}>
                  <option>Link Task</option>
                  <option>Link Invoice</option>
                  <option>Link File</option>
                </select>

                <button 
                  onClick={handleSendChatMessage}
                  style={{ padding: '10px 18px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Send
                </button>
              </div>

            </div>

          </div>
        )}

        {/* ======================= SUB-TAB 5: BILLING & INVOICING ======================= */}
        {activeSubTab === 'billing' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
            
            {/* Generate Invoice Card form */}
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                ✍️ Generate Client Invoice
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>CLIENT COMPANY</label>
                <select 
                  value={invoiceClient} 
                  onChange={(e) => setInvoiceClient(e.target.value)}
                  style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                >
                  {COMPANYS_LIST.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>BILLING MODEL</label>
                <select 
                  value={invoiceBillingType} 
                  onChange={(e) => setInvoiceBillingType(e.target.value as any)}
                  style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                >
                  <option value="RETAINER">Retainer Monthly Billing</option>
                  <option value="SERVICE">One-Time Service Billing</option>
                  <option value="MILESTONE">Milestone Project Billing</option>
                  <option value="HOURLY">Hourly Roster Billing</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>BASE SERVICE FEE (₹)</label>
                <input 
                  type="number" 
                  value={invoiceAmount} 
                  onChange={(e) => setInvoiceAmount(Number(e.target.value))}
                  style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                />
              </div>

              {/* Realtime tax computation info */}
              <div style={{ background: 'var(--bg-light)', padding: '10px', borderRadius: '6px', fontSize: '11.5px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>SGST (9%):</span>
                  <span>₹{(invoiceAmount * 0.09).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>CGST (9%):</span>
                  <span>₹{(invoiceAmount * 0.09).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', borderTop: '1px solid var(--border-color)', paddingTop: '4px' }}>
                  <span>Total Amount (GST Incl):</span>
                  <span>₹{(invoiceAmount * 1.18).toLocaleString()}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>DUE DATE</label>
                <input 
                  type="date" 
                  value={invoiceDue}
                  onChange={(e) => setInvoiceDue(e.target.value)}
                  style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                />
              </div>

              <button 
                onClick={handleGenerateInvoice}
                style={{ padding: '10px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
              >
                Sign & Transmit Invoice
              </button>
            </div>

            {/* Invoices List */}
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                📂 Raised Invoices & Receivables
              </h3>
              
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Invoice #</th>
                    <th style={{ padding: '8px' }}>Client</th>
                    <th style={{ padding: '8px' }}>Type</th>
                    <th style={{ padding: '8px' }}>Amount (Incl GST)</th>
                    <th style={{ padding: '8px' }}>Due Date</th>
                    <th style={{ padding: '8px' }}>Status</th>
                    <th style={{ padding: '8px' }}>Links</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--bg-gray)' }}>
                      <td style={{ padding: '12px 8px', fontWeight: '700' }}>{inv.invoiceNumber}</td>
                      <td style={{ padding: '12px 8px' }}>{inv.companyName}</td>
                      <td style={{ padding: '12px 8px', fontSize: '11px' }}>{inv.billingType}</td>
                      <td style={{ padding: '12px 8px', fontWeight: '700' }}>₹{inv.totalAmount.toLocaleString()}</td>
                      <td style={{ padding: '12px 8px' }}>{inv.dueDate}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <span className={`badge badge-${inv.status === 'PAID' ? 'success' : inv.status === 'OVERDUE' ? 'danger' : 'info'}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        {inv.status !== 'PAID' && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(inv.paymentLink || '');
                              alert('Payment link copied to clipboard!');
                            }}
                            style={{ border: 'none', background: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: '700', fontSize: '11px' }}
                          >
                            🔗 Paylink
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* ======================= SUB-TAB 6: CLIENT COLLABORATION WORKSPACE ======================= */}
        {activeSubTab === 'workspace' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700' }}>
                  👥 Client Dedicated Collaboration Workspace
                </h3>
                <span style={{ fontSize: '11px', background: 'var(--primary-light)', color: 'var(--primary)', padding: '4px 10px', borderRadius: '12px', fontWeight: '700' }}>
                  Aegis Infotech Partner Portal Sync: Active
                </span>
              </div>

              {/* Workspace details aggregated */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>📂 Shared Documents (Locker view)</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { name: 'Director_PAN_Vikram.pdf', size: '420 KB', status: 'VERIFIED' },
                      { name: 'Aegis_MOA_Final.pdf', size: '2.4 MB', status: 'VERIFIED' },
                      { name: 'ADT-1_Audit_Appointment_2026.pdf', size: '1.1 MB', status: 'AWAITING_SIGN' }
                    ].map((doc, idx) => (
                      <div key={idx} style={{ padding: '10px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '6px', display: 'flex', justifyItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span>📄 <b>{doc.name}</b> ({doc.size})</span>
                        <span style={{ fontSize: '10px', fontWeight: '700', color: doc.status === 'VERIFIED' ? 'var(--success)' : 'var(--warning)' }}>{doc.status}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>✍️ Digital Approval Statuses</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {approvals.map(ap => (
                      <div key={ap.id} style={{ padding: '10px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <b>{ap.title}</b>
                          <span className={`badge badge-${ap.status === 'APPROVED' ? 'success' : 'warning'}`} style={{ fontSize: '9px' }}>{ap.status}</span>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Requester: {ap.requester} | Date: {ap.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================= SUB-TAB 7: APPROVALS ROOM ======================= */}
        {activeSubTab === 'approvals' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '16px' }}>
                ✍️ Statutory Approval Workflow Engine
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {approvals.map(ap => (
                  <div key={ap.id} style={{ padding: '16px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700' }}>{ap.title}</span>
                        <span style={{ fontSize: '10px', background: 'var(--border-color)', padding: '2px 8px', borderRadius: '10px', fontWeight: '700' }}>{ap.type}</span>
                      </div>
                      <span className={`badge badge-${ap.status === 'APPROVED' ? 'success' : 'warning'}`}>
                        {ap.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Workflow Stage: **Draft** → **Review** → **Client Approval** → **Finalized**</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Comments: <i>{ap.comments}</i></div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>Raised by: <b>{ap.requester}</b> on {ap.date}</div>

                    <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '10px', paddingTop: '8px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      {ap.status !== 'APPROVED' ? (
                        <>
                          <button 
                            onClick={() => handleApproveAction(ap.id, false)}
                            style={{ padding: '4px 10px', background: 'none', border: '1px solid var(--border-color)', color: 'var(--danger)', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                          >
                            Reject (Revise)
                          </button>
                          <button 
                            onClick={() => handleApproveAction(ap.id, true)}
                            style={{ padding: '4px 14px', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                          >
                            Sign & Approve
                          </button>
                        </>
                      ) : (
                        <span style={{ color: 'var(--success)', fontSize: '11.5px', fontWeight: '700' }}>✔ Signed & Finalized. Transmitting to MCA/ROC Portal...</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ======================= SUB-TAB 8: CLIENT TIMELINE AUDIT ======================= */}
        {activeSubTab === 'timeline' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700' }}>
                  ⏳ Searchable Client Timeline Audit
                </h3>
                <input 
                  type="text" 
                  placeholder="Search timeline events..." 
                  value={timelineSearch}
                  onChange={(e) => setTimelineSearch(e.target.value)}
                  style={{ padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)', width: '220px' }}
                />
              </div>

              {/* Vertical timeline list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '2px solid var(--border-color)', paddingLeft: '16px', marginLeft: '8px' }}>
                {timelineEvents
                  .filter(evt => {
                    const matchText = evt.description.toLowerCase().includes(timelineSearch.toLowerCase()) || evt.eventType.includes(timelineSearch.toUpperCase());
                    const matchCompany = selectedCompanyId === 'ALL' || evt.companyId === selectedCompanyId;
                    return matchText && matchCompany;
                  })
                  .map(evt => (
                    <div key={evt.id} style={{ position: 'relative', fontSize: '13px' }}>
                      
                      {/* Circle bullet indicator */}
                      <div style={{
                        position: 'absolute',
                        left: '-23px',
                        top: '4px',
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: evt.eventType === 'PAYMENT_RECEIVED' || evt.eventType === 'TASK_COMPLETED' ? 'var(--success)' : 'var(--primary)',
                        border: '2px solid var(--bg-white)'
                      }} />
                      
                      <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontWeight: '700' }}>{evt.eventType.replace('_', ' ')}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{evt.time}</span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)' }}>{evt.description}</div>
                      {evt.metadata && (
                        <div style={{ fontSize: '11.5px', color: 'var(--primary)', fontWeight: '700', marginTop: '2px' }}>Context: {evt.metadata}</div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ======================= SUB-TAB 9: AI COPYWRITING ENGINE ======================= */}
        {activeSubTab === 'ai' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            
            {/* Draft Configurator */}
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                🤖 AI Copywriter & Summarizer
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>CHOOSE TARGET CLIENT</label>
                <select 
                  value={aiDraftClient} 
                  onChange={(e) => setAiDraftClient(e.target.value)}
                  style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                >
                  {COMPANYS_LIST.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>COMMUNICATION CHANNEL</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {['whatsapp', 'email', 'notice'].map(ch => (
                    <label key={ch} style={{ fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="ai-channel" 
                        value={ch} 
                        checked={aiDraftChannel === ch} 
                        onChange={() => setAiDraftChannel(ch as any)} 
                      />
                      <span style={{ textTransform: 'capitalize' }}>{ch}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>TOPIC / INSTRUCTION PROMPT</label>
                <select 
                  value={aiDraftTopic} 
                  onChange={(e) => setAiDraftTopic(e.target.value)}
                  style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                >
                  <option value="payment">Billing Collection Delay (Follow-up Reminder)</option>
                  <option value="doc">Statutory Document Update Requirement</option>
                  <option value="notice">Summarize Department notice (ITR mismatch explanation)</option>
                </select>
              </div>

              <button 
                onClick={handleGenerateAIDraft}
                style={{ padding: '10px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
              >
                Generate Professional AI Draft
              </button>
            </div>

            {/* Draft Result View */}
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                📝 Resulting Draft Output
              </h3>
              
              {aiGeneratedText ? (
                <>
                  <textarea 
                    value={aiGeneratedText} 
                    onChange={(e) => setAiGeneratedText(e.target.value)}
                    style={{ flex: '1', minHeight: '260px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px', fontFamily: 'monospace', background: 'var(--bg-light)', color: 'var(--text-primary)', resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(aiGeneratedText);
                        alert('Draft copied to clipboard!');
                      }}
                      style={{ padding: '8px 16px', background: 'var(--bg-gray)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Copy Draft
                    </button>
                    <button 
                      onClick={() => {
                        alert(`Draft successfully transmitted to Meta API client webhook.`);
                      }}
                      style={{ padding: '8px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Transmit via {aiDraftChannel.toUpperCase()}
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px', border: '1px dashed var(--border-color)', borderRadius: '8px', minHeight: '260px' }}>
                  Select parameters and click "Generate Professional AI Draft" to begin drafting.
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
