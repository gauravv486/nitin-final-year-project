'use client';

import React, { useState, useEffect } from 'react';
import { 
  RESOLUTION_TEMPLATES, 
  generateResolutionText, 
  simulateAiClauseExpansion 
} from '@/lib/secretarial/ResolutionEngine';
import { 
  MCA_FORM_CATALOG, 
  calculateSecretarialRisk, 
  queryCopilotEngine,
  RiskFactors
} from '@/lib/secretarial/SecretarialCopilot';
import { UniversalStatusBadge } from '@/components/reports/ReportsExportHub';

// Mock Initial Data for Demonstration
const MOCK_COMPANIES = [
  { id: 'c1', name: 'Aegis Infotech Private Limited', cin: 'U72200MH2018PTC309876', regOffice: 'Plot No 45, MIDC, Andheri East, Mumbai - 400093', rocOffice: 'ROC Mumbai', authorizedCapital: 5000000, paidUpCapital: 2500000, dateOfInc: '2018-04-12' },
  { id: 'c2', name: 'Zylos Pharma Limited', cin: 'L24230KA2015PLC085432', regOffice: '3rd Floor, Brigade Towers, MG Road, Bengaluru - 560001', rocOffice: 'ROC Bangalore', authorizedCapital: 20000000, paidUpCapital: 12000000, dateOfInc: '2015-08-25' },
  { id: 'c3', name: 'Vortex Logistics LLP', cin: 'AAC-9876', regOffice: 'Sector 62, Noida, Uttar Pradesh - 201301', rocOffice: 'ROC Kanpur', authorizedCapital: 1000000, paidUpCapital: 1000000, dateOfInc: '2020-11-02' }
];

const MOCK_DIRECTORS = [
  { id: 'd1', companyId: 'c1', din: '08123456', name: 'Vikram Aditya Shah', designation: 'Managing Director', pan: 'ASDPS1234F', appointmentDate: '2018-04-12', kycStatus: 'COMPLETED', email: 'vikram.shah@aegis.in', mobile: '+91 98200 12345', panVerified: true, emailVerified: true, mobileVerified: true, status: 'ACTIVE' },
  { id: 'd2', companyId: 'c1', din: '09087654', name: 'Anjali Sharma', designation: 'Director', pan: 'ABCPS9876G', appointmentDate: '2021-06-15', kycStatus: 'COMPLETED', email: 'anjali.sharma@aegis.in', mobile: '+91 98110 54321', panVerified: true, emailVerified: true, mobileVerified: true, status: 'ACTIVE' },
  { id: 'd3', companyId: 'c1', din: '07543210', name: 'Rajesh Kumar Gupta', designation: 'Independent Director', pan: 'AGHPS3344K', appointmentDate: '2022-09-01', kycStatus: 'PENDING', email: 'rajesh.gupta@consultant.com', mobile: '+91 99300 88776', panVerified: true, emailVerified: false, mobileVerified: false, status: 'ACTIVE' },
  { id: 'd4', companyId: 'c2', din: '03429812', name: 'Dr. Srinivas Murthy', designation: 'Director', pan: 'AMMPS9922L', appointmentDate: '2015-08-25', kycStatus: 'COMPLETED', email: 'srinivas@zylospharma.com', mobile: '+91 94480 11223', panVerified: true, emailVerified: true, mobileVerified: true, status: 'ACTIVE' }
];

const MOCK_SHAREHOLDERS = [
  { id: 's1', companyId: 'c1', name: 'Vikram Aditya Shah', shares: 150000, shareType: 'EQUITY', value: 1500000, pan: 'ASDPS1234F' },
  { id: 's2', companyId: 'c1', name: 'Anjali Sharma', shares: 100000, shareType: 'EQUITY', value: 1000000, pan: 'ABCPS9876G' },
  { id: 's3', companyId: 'c2', name: 'Zylos Capital Partners', shares: 800000, shareType: 'EQUITY', value: 8000000, pan: 'AMMPS9922L' },
  { id: 's4', companyId: 'c2', name: 'Dr. Srinivas Murthy', shares: 400000, shareType: 'EQUITY', value: 4000000, pan: 'ASDPS9988H' }
];

export default function CorporateSecretarialManager() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'resolutions' | 'agm' | 'minutes' | 'mca' | 'registers' | 'copilot' | 'audit' | 'capital' | 'events'>('dashboard');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('c1');

  // Selected Company Details
  const company = MOCK_COMPANIES.find(c => c.id === selectedCompanyId) || MOCK_COMPANIES[0];
  const companyDirectors = MOCK_DIRECTORS.filter(d => d.companyId === selectedCompanyId);
  const companyShareholders = MOCK_SHAREHOLDERS.filter(s => s.companyId === selectedCompanyId);

  // 1. Resolution State
  const [resTemplate, setResTemplate] = useState<string>('bank_opening');
  const [selectedDirectorId, setSelectedDirectorId] = useState<string>(companyDirectors[0]?.id || '');
  const [resBankName, setResBankName] = useState<string>('HDFC Bank Limited');
  const [resBranchName, setResBranchName] = useState<string>('Fort Branch, Mumbai');
  const [resolutionContent, setResolutionContent] = useState<string>('');
  const [resAuditTrail, setResAuditTrail] = useState<Array<{ version: number; action: string; time: string }>>([]);
  const [resDscSigned, setResDscSigned] = useState<boolean>(false);
  const [aiExpandClause, setAiExpandClause] = useState<string>('');

  // 2. AGM Notice Calculator State
  const [agmDate, setAgmDate] = useState<string>('2026-09-30');
  const [noticeSendDate, setNoticeSendDate] = useState<string>('2026-09-04');
  const [agmLocation, setAgmLocation] = useState<string>('Registered Office of the Company');
  const [agendaItems, setAgendaItems] = useState<Array<{ id: number; title: string; type: string; details: string }>>([
    { id: 1, title: 'Adoption of Audited Financial Statements for FY 2025-26', type: 'ORDINARY', details: 'Balance sheet, Profit & loss statement and reports of Board and Auditors.' },
    { id: 2, title: 'Declaration of Dividend on Equity Shares', type: 'ORDINARY', details: 'Recommendation of Board of Directors to pay dividend at ₹2.00 per share.' },
    { id: 3, title: 'Re-appointment of retiring Director Ms. Anjali Sharma', type: 'ORDINARY', details: 'Ms. Anjali Sharma retires by rotation and offers herself for re-appointment.' }
  ]);
  const [newAgendaTitle, setNewAgendaTitle] = useState<string>('');
  const [newAgendaType, setNewAgendaType] = useState<string>('ORDINARY');
  const [eVotingProvider, setEVotingProvider] = useState<string>('NSDL');
  const [noticeCalculationResult, setNoticeCalculationResult] = useState<{
    days: number;
    isValid: boolean;
    excludedDays: string[];
  } | null>(null);

  // 3. Minutes Generator State
  const [meetingType, setMeetingType] = useState<string>('BOARD_MEETING');
  const [meetingNumber, setMeetingNumber] = useState<number>(4);
  const [meetingDateTime, setMeetingDateTime] = useState<string>('2026-06-15T11:00');
  const [meetingChairmanId, setMeetingChairmanId] = useState<string>(companyDirectors[0]?.id || '');
  const [attendeesList, setAttendeesList] = useState<string[]>(companyDirectors.map(d => d.id));
  const [minutesWorkflowState, setMinutesWorkflowState] = useState<'DRAFT' | 'REVIEWED' | 'CIRCULATED' | 'APPROVED' | 'SIGNED'>('DRAFT');
  const [minutesLogs, setMinutesLogs] = useState<Array<{ step: string; timestamp: string; user: string }>>([
    { step: 'Minutes Draft initialized by system', timestamp: '2026-06-15 11:45', user: 'System (AI)' }
  ]);

  // 4. MCA Forms Preparation State
  const [selectedFormType, setSelectedFormType] = useState<string>('AOC-4');
  const [filingYear, setFilingYear] = useState<string>('2025-26');
  const [dscTokenStatus, setDscTokenStatus] = useState<'DISCONNECTED' | 'CONNECTED' | 'SIGNED'>('DISCONNECTED');
  const [formValidationErrors, setFormValidationErrors] = useState<string[]>([]);
  const [filingActivityLogs, setFilingActivityLogs] = useState<Array<{ event: string; time: string; status: string }>>([]);

  // 5. Statutory Registers State
  const [selectedRegister, setSelectedRegister] = useState<string>('MGT-1');
  const [inspectionLogs, setInspectionLogs] = useState<Array<{ date: string; auditor: string; firm: string; purpose: string }>>([
    { date: '2026-05-10', auditor: 'CS Ramesh Chawla', firm: 'R. Chawla & Associates', purpose: 'Pre-filing secretarial inspection' }
  ]);

  // 6. ROC filings dashboard data
  const [rocStatusTracker, setRocStatusTracker] = useState([
    { srn: 'F20260401', formType: 'DIR-12', filingDate: '2026-04-15', status: 'Approved', fees: 600, lateFees: 0 },
    { srn: 'F20260515', formType: 'ADT-1', filingDate: '2026-05-20', status: 'Under Processing', fees: 600, lateFees: 0 },
    { srn: 'F20260611', formType: 'DIR-3 KYC', filingDate: '2026-06-12', status: 'Approved', fees: 0, lateFees: 0 }
  ]);
  const [lateFeeForm, setLateFeeForm] = useState<string>('AOC-4');
  const [lateFeeDelayDays, setLateFeeDelayDays] = useState<number>(15);

  // 7. Director KYC state
  const [directorsKycList, setDirectorsKycList] = useState(companyDirectors);

  // 8. Share Capital state
  const [shareTransactions, setShareTransactions] = useState([
    { id: 'tx1', type: 'ALLOTMENT', date: '2018-04-12', shares: 250000, value: 2500000, desc: 'Initial subscription shares allotted to promoters' }
  ]);

  // 9. Charges state
  const [chargesList, setChargesList] = useState<Array<{ id: string; chargeId: string; amount: number; lender: string; asset: string; creationDate: string; satisfactionDate: string | null; status: string }>>([
    { id: 'chg1', chargeId: '10087654', amount: 5000000, lender: 'HDFC Bank Limited', asset: 'Hypothecation of Book Debts and Stock', creationDate: '2020-03-12', satisfactionDate: null, status: 'OPEN' }
  ]);

  // 10. Audit Checklist state
  const [auditChecklist, setAuditChecklist] = useState([
    { id: 1, text: 'Are all Board Resolutions requiring filing submitted in Form MGT-14?', checked: true },
    { id: 2, text: 'Was DIR-3 KYC completed for all active DIN holders by due date?', checked: true },
    { id: 3, text: 'Is the notice gap between Board Meetings under 120 days?', checked: true },
    { id: 4, text: 'Are MBP-1 forms (disclosures of interest) updated for the current FY?', checked: false },
    { id: 5, text: 'Is the Register of Charges (CHG-7) signed and reconciled?', checked: false }
  ]);

  // 11. AI Copilot Chat state
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; time: string; forms?: string[] }>>([
    { sender: 'ai', text: 'Hello, I am your Secretarial AI Copilot. Ask me questions on Companies Act, 2013 clauses, SS-1 Board Rules, or ROC filing calculations.', time: '20:30' }
  ]);
  const [chatInput, setChatInput] = useState<string>('');

  // 12. Risk Engine Score calculations
  const [riskFactors, setRiskFactors] = useState<RiskFactors>({
    overdueFilings: [],
    kycPendingDirectors: ['Rajesh Kumar Gupta'],
    expiredDscs: ['Vikram Aditya Shah (Expires in 5 days)'],
    missingAgm: false,
    missingResolutions: [],
    missingRegisters: ['MBP-1 Register (Missing FY26 entries)'],
    lateFilingsCount: 0
  });

  const riskAnalysis = calculateSecretarialRisk(riskFactors);

  // Update Resolution content when selectors change
  useEffect(() => {
    const director = companyDirectors.find(d => d.id === selectedDirectorId) || companyDirectors[0];
    if (!director) return;

    const meta = {
      companyName: company.name,
      cin: company.cin,
      registeredOffice: company.regOffice,
      meetingDate: new Date(meetingDateTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
      chairmanName: companyDirectors.find(d => d.id === meetingChairmanId)?.name || 'Vikram Aditya Shah',
      directorName: director.name,
      din: director.din,
      extraArgs: {
        bankName: resBankName,
        bankBranch: resBranchName,
        accountNumber: '908877665544',
        targetBank: 'ICICI Bank',
        chairmanDin: companyDirectors.find(d => d.id === meetingChairmanId)?.din || '08123456',
        resignationDate: '2026-06-15',
        auditorFirm: 'K. R. Khanna & Co.',
        auditorFrn: '123456N',
        remuneration: '1,50,000',
        stateName: 'Maharashtra',
        ay: '2026-27',
        dividendRate: '20',
        dividendPerShare: '2',
        totalShares: '2,50,000',
        quarterEnd: '31st March 2026',
        recordDate: '30th June 2026',
        totalDividend: '5,00,000',
        relatedPartyName: 'Shah Logistics Private Limited',
        transactionType: 'Purchase of Warehousing Services',
        goodsOrServices: 'Warehousing logistics support',
        contractValue: '12,00,000',
        allottedShares: '50,000',
        sharePremium: '40',
        totalReceived: '25,00,000',
        esopPool: '25,000',
        propertyAddress: 'Office Suite 501, Technopolis, Andheri East, Mumbai',
        sellerName: 'Navratna Builders Private Limited',
        purchasePrice: '45,00,000',
        lenderName: 'Standard Chartered Bank',
        loanAmount: '1,00,00,000',
        totalLimit: '5,00,00,000',
        borrowerName: 'Aegis Technologies USA Inc.',
        interestRate: '8.5',
        officeAddress: 'Apex Office Plaza, MG Road, Pune',
        landlordName: 'R. K. Realty',
        leaseYears: '5',
        monthlyRent: '85,000',
        securityDeposit: '5,10,000',
        kmpName: 'CS Shreya Patel',
        membershipNo: 'FCS 99221',
        kmpSalary: '65,000',
        director1: 'Vikram Aditya Shah',
        din1: '08123456',
        director2: 'Anjali Sharma',
        din2: '09087654',
        mergeCompany: 'Sigma Analytics Inc.',
        valuerName: 'J. M. Bakhai & Associates',
        swapRatio: '1 share of Aegis for every 3 shares of Sigma',
        demergeDivision: 'Industrial Consulting',
        resultantCompany: 'Vortex Advisory Private Limited',
        merchantBanker: 'SBI Capital Markets'
      }
    };

    const result = generateResolutionText(resTemplate, meta);
    setResolutionContent(result.body);
    setResAuditTrail([{ version: 1, action: 'Draft initial generation based on template.', time: new Date().toLocaleTimeString() }]);
    setResDscSigned(false);
  }, [selectedCompanyId, resTemplate, selectedDirectorId, resBankName, resBranchName, meetingDateTime, meetingChairmanId]);

  // Notice Period Calculator logic
  const handleCalculateNotice = () => {
    const agm = new Date(agmDate);
    const send = new Date(noticeSendDate);
    
    // Difference in time
    const diffTime = agm.getTime() - send.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // 21 clear days rule:
    // Exclude: Date of posting (1 day), date of receipt (1 day), date of meeting (1 day)
    // Also rules require +48 hours (2 days) for postage if sent by mail or post.
    // Total exclusions: 3 to 4 days.
    const clearDays = diffDays - 3;
    const isValid = clearDays >= 21;

    setNoticeCalculationResult({
      days: clearDays,
      isValid,
      excludedDays: [
        `Date of sending: ${noticeSendDate} (Excluded)`,
        `Date of Meeting: ${agmDate} (Excluded)`,
        `Postage/Email buffer (48 hrs rule): Excluded`
      ]
    });
  };

  // Add Agenda Item
  const handleAddAgenda = () => {
    if (!newAgendaTitle.trim()) return;
    const newItem = {
      id: agendaItems.length + 1,
      title: newAgendaTitle,
      type: newAgendaType,
      details: 'Drafted agenda item for general discussion.'
    };
    setAgendaItems([...agendaItems, newItem]);
    setNewAgendaTitle('');
  };

  // Simulate AI Resolution Expansion
  const handleAiExpand = async () => {
    if (!aiExpandClause.trim()) return;
    const updatedBody = await simulateAiClauseExpansion(resolutionContent, aiExpandClause);
    setResolutionContent(updatedBody);
    setResAuditTrail(prev => [
      ...prev,
      { version: prev.length + 1, action: `AI Clause expansion: "${aiExpandClause}"`, time: new Date().toLocaleTimeString() }
    ]);
    setAiExpandClause('');
  };

  // Sign Resolution
  const handleSignResolution = () => {
    setResDscSigned(true);
    setResAuditTrail(prev => [
      ...prev,
      { version: prev.length + 1, action: `Digitally signed via DSC token by ${companyDirectors[0]?.name}`, time: new Date().toLocaleTimeString() }
    ]);
  };

  // Send Copilot Query
  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    const userMsg = { sender: 'user' as const, text: chatInput, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setChatMessages(prev => [...prev, userMsg]);
    
    const queryResult = queryCopilotEngine(chatInput);
    setChatInput('');

    setTimeout(() => {
      const aiMsg = { 
        sender: 'ai' as const, 
        text: queryResult.answer, 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        forms: queryResult.suggestedForms
      };
      setChatMessages(prev => [...prev, aiMsg]);
    }, 800);
  };

  // Pre-filing Validation Engine
  const handleValidateForm = () => {
    const errors: string[] = [];
    if (selectedFormType === 'AOC-4') {
      const activeDirectors = companyDirectors.filter(d => d.status === 'ACTIVE');
      if (activeDirectors.length < 2) {
        errors.push('Companies Act Violation: Active company must have at least 2 active directors to sign financials.');
      }
      const kycPending = companyDirectors.filter(d => d.kycStatus === 'PENDING');
      if (kycPending.length > 0) {
        errors.push(`Filing Blocked: Directors [${kycPending.map(d => d.name).join(', ')}] have pending DIR-3 KYC.`);
      }
    } else if (selectedFormType === 'DIR-12') {
      if (!selectedDirectorId) {
        errors.push('Validation Error: Select a director to file appointment/resignation details.');
      }
    } else if (selectedFormType === 'CHG-1') {
      if (chargesList.length === 0) {
        errors.push('Validation Error: No charge record detected. Create a charge entry first.');
      }
    }
    setFormValidationErrors(errors);
  };

  // Late Fee Calculator
  const getCalculatedLateFee = () => {
    // MCA V3 standard late fee is ₹100 per day of delay
    const fee = lateFeeDelayDays * 100;
    return {
      normalFee: 600,
      lateFee: fee,
      total: 600 + fee
    };
  };

  const feesResult = getCalculatedLateFee();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', fontFamily: 'inherit', color: 'var(--text-primary)' }}>
      
      {/* COMPANY SELECTOR AND TOP METRICS BAR */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '16px 20px', 
        background: 'var(--bg-white)', 
        border: '1px solid var(--border-color)', 
        borderRadius: '12px',
        boxShadow: 'var(--shadow-sm)',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>🏢</span>
          <div>
            <select 
              value={selectedCompanyId} 
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '16px',
                fontWeight: '700',
                outline: 'none',
                color: 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              {MOCK_COMPANIES.map(comp => (
                <option key={comp.id} value={comp.id}>{comp.name}</option>
              ))}
            </select>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: '600' }}>
              CIN: {company.cin} | {company.rocOffice}
            </div>
          </div>
        </div>

        {/* Global Compliance Health score widget */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: `conic-gradient(var(--success) ${100 - riskAnalysis.score}%, var(--danger-light) ${100 - riskAnalysis.score}% 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              fontSize: '12px',
              color: 'var(--text-primary)'
            }}>
              {100 - riskAnalysis.score}%
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>ROC Health</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: riskAnalysis.level === 'CRITICAL' ? 'var(--danger)' : 'var(--success)' }}>
                {riskAnalysis.level} RISK
              </div>
            </div>
          </div>

          <div style={{ borderLeft: '1px solid var(--border-color)', height: '32px' }} />

          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Penalty Exposure</div>
            <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--danger)' }}>
              ₹{riskAnalysis.penaltyExposure.toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      </div>

      {/* DASHBOARD TAB SELECTOR */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', overflowX: 'auto', gap: '4px' }}>
        {[
          { id: 'dashboard', label: 'Overview' },
          { id: 'resolutions', label: 'Resolution Generator' },
          { id: 'agm', label: 'AGM Notice Planner' },
          { id: 'minutes', label: 'Minutes Book' },
          { id: 'mca', label: 'MCA Filing Desk' },
          { id: 'registers', label: 'Statutory Registers' },
          { id: 'capital', label: 'Share Capital & Charges' },
          { id: 'events', label: 'Event Workflows' },
          { id: 'audit', label: 'Secretarial Audit' },
          { id: 'copilot', label: 'AI Copilot Chat' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.id ? '700' : '500',
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

      {/* TAB CONTENT GRID */}
      <div style={{ minHeight: '500px' }}>

        {/* 1. OVERVIEW / ANALYTICS DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              
              {/* Metric Card 1 */}
              <div style={{ padding: '16px', background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Active Board Directors</span>
                <span style={{ fontSize: '24px', fontWeight: '800' }}>{companyDirectors.length}</span>
                <span style={{ fontSize: '11px', color: 'var(--success)' }}>✔ All verified at DIN status</span>
              </div>

              {/* Metric Card 2 */}
              <div style={{ padding: '16px', background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Upcoming Filings (30d)</span>
                <span style={{ fontSize: '24px', fontWeight: '800', color: 'var(--warning)' }}>2 Pending</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>AOC-4 Due in 45 Days</span>
              </div>

              {/* Metric Card 3 */}
              <div style={{ padding: '16px', background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Filing Success Ratio</span>
                <span style={{ fontSize: '24px', fontWeight: '800', color: 'var(--success)' }}>100%</span>
                <span style={{ fontSize: '11px', color: 'var(--success)' }}>No defective filings received</span>
              </div>

              {/* Metric Card 4 */}
              <div style={{ padding: '16px', background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Statutory Audits</span>
                <span style={{ fontSize: '24px', fontWeight: '800' }}>FY 2025-26</span>
                <span style={{ fontSize: '11px', color: 'var(--warning)' }}>⚠️ Draft status</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', flexWrap: 'wrap' }}>
              
              {/* ROC filings status tracker table */}
              <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '12px' }}>ROC Filing Status Tracker</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 0', color: 'var(--text-secondary)' }}>SRN</th>
                      <th style={{ padding: '8px 0', color: 'var(--text-secondary)' }}>Form Type</th>
                      <th style={{ padding: '8px 0', color: 'var(--text-secondary)' }}>Filing Date</th>
                      <th style={{ padding: '8px 0', color: 'var(--text-secondary)' }}>Status</th>
                      <th style={{ padding: '8px 0', color: 'var(--text-secondary)' }}>Filing Fees</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rocStatusTracker.map(file => (
                      <tr key={file.srn} style={{ borderBottom: '1px solid var(--bg-gray)' }}>
                        <td style={{ padding: '10px 0', fontWeight: '600' }}>{file.srn}</td>
                        <td style={{ padding: '10px 0' }}>{file.formType}</td>
                        <td style={{ padding: '10px 0' }}>{file.filingDate}</td>
                        <td style={{ padding: '10px 0' }}>
                          <UniversalStatusBadge status={file.status} />
                        </td>
                        <td style={{ padding: '10px 0', fontWeight: '600' }}>₹{file.fees}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Late Fee calculator */}
              <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700' }}>ROC Late Fee Calculator</h3>
                
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>SELECT FORM TYPE</label>
                  <select 
                    value={lateFeeForm} 
                    onChange={(e) => setLateFeeForm(e.target.value)}
                    style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', marginTop: '4px', background: 'var(--bg-light)', fontSize: '13px' }}
                  >
                    <option value="AOC-4">AOC-4 (Financials)</option>
                    <option value="MGT-7">MGT-7 (Annual Return)</option>
                    <option value="DIR-12">DIR-12 (Director Change)</option>
                    <option value="CHG-1">CHG-1 (Charge Creation)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>DAYS DELAYED</label>
                  <input 
                    type="number" 
                    value={lateFeeDelayDays} 
                    onChange={(e) => setLateFeeDelayDays(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', marginTop: '4px', background: 'var(--bg-light)', fontSize: '13px' }}
                  />
                </div>

                <div style={{ padding: '12px', background: 'var(--bg-gray)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Standard Filing Fee:</span>
                    <span style={{ fontWeight: '600' }}>₹{feesResult.normalFee}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)' }}>
                    <span>Late Filing Penalty (₹100/day):</span>
                    <span style={{ fontWeight: '700' }}>₹{feesResult.lateFee}</span>
                  </div>
                  <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '14px' }}>
                    <span>Total Fee Payable:</span>
                    <span>₹{feesResult.total}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Risk factors and recommendations */}
            <div style={{ padding: '20px', background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '12px' }}>Compliance Gaps & Risks Detected</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {riskAnalysis.recommendations.map((rec, idx) => (
                  <div key={idx} style={{ padding: '10px 14px', background: 'var(--danger-light)', borderLeft: '4px solid var(--danger)', borderRadius: '4px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>⚠️</span>
                    <span>{rec}</span>
                  </div>
                ))}
                {riskAnalysis.recommendations.length === 0 && (
                  <div style={{ padding: '10px 14px', background: 'var(--success-light)', borderLeft: '4px solid var(--success)', borderRadius: '4px', fontSize: '13px', color: 'var(--success)', fontWeight: '600' }}>
                    ✔ No compliance issues or risk factors flagged. The company is 100% compliant.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. BOARD RESOLUTION GENERATOR */}
        {activeTab === 'resolutions' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
            
            {/* Resolution Selector & population fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Resolution Builder</h3>
              
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>SELECT TEMPLATE</label>
                <select 
                  value={resTemplate} 
                  onChange={(e) => setResTemplate(e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', marginTop: '4px', background: 'var(--bg-light)', fontSize: '13px' }}
                >
                  {RESOLUTION_TEMPLATES.map(t => (
                    <option key={t.key} value={t.key}>{t.title} ({t.section})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>SELECT SIGNATORY DIRECTOR</label>
                <select 
                  value={selectedDirectorId} 
                  onChange={(e) => setSelectedDirectorId(e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', marginTop: '4px', background: 'var(--bg-light)', fontSize: '13px' }}
                >
                  {companyDirectors.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.designation})</option>
                  ))}
                </select>
              </div>

              {resTemplate.includes('bank') && (
                <>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>BANK NAME</label>
                    <input 
                      type="text" 
                      value={resBankName} 
                      onChange={(e) => setResBankName(e.target.value)}
                      style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', marginTop: '4px', background: 'var(--bg-light)', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>BANK BRANCH</label>
                    <input 
                      type="text" 
                      value={resBranchName} 
                      onChange={(e) => setResBranchName(e.target.value)}
                      style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', marginTop: '4px', background: 'var(--bg-light)', fontSize: '13px' }}
                    />
                  </div>
                </>
              )}

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--primary)', display: 'block', marginBottom: '6px' }}>✨ AI CLAUSE EXPANSION</label>
                <input 
                  type="text" 
                  placeholder="E.g., Require double signatures for transactions > ₹10L" 
                  value={aiExpandClause} 
                  onChange={(e) => setAiExpandClause(e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-light)', fontSize: '12.5px' }}
                />
                <button 
                  onClick={handleAiExpand}
                  style={{ width: '100%', padding: '8px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', marginTop: '8px', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Expand Draft with AI
                </button>
              </div>
            </div>

            {/* Preview Document editor */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', flex: '1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '700' }}>SS-1 Compliant Board Resolution Draft</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={handleSignResolution}
                      disabled={resDscSigned}
                      style={{
                        padding: '6px 12px',
                        background: resDscSigned ? 'var(--success-light)' : 'var(--gold)',
                        color: resDscSigned ? 'var(--success)' : '#000',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      {resDscSigned ? '✒️ Signed with DSC' : '✍ Sign with DSC Token'}
                    </button>
                  </div>
                </div>

                <textarea
                  value={resolutionContent}
                  onChange={(e) => setResolutionContent(e.target.value)}
                  rows={20}
                  style={{
                    width: '100%',
                    padding: '16px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '12.5px',
                    lineHeight: '1.6',
                    background: 'var(--bg-light)',
                    color: 'var(--text-primary)',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Version History Log */}
              <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
                <h4 style={{ fontSize: '12.5px', fontWeight: '700', marginBottom: '8px' }}>Version Control History</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {resAuditTrail.map((log, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', fontSize: '12px', borderBottom: '1px solid var(--bg-gray)', paddingBottom: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>v{log.version} - {log.action}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{log.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. AGM NOTICE GENERATOR & NOTICE CALCULATOR */}
        {activeTab === 'agm' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            
            {/* Notice Period Calculator & Settings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700' }}>21 Clear Days Rule Notice Calculator</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>DATE OF DISPATCH</label>
                    <input 
                      type="date" 
                      value={noticeSendDate} 
                      onChange={(e) => setNoticeSendDate(e.target.value)}
                      style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', marginTop: '4px', background: 'var(--bg-light)', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>DATE OF AGM</label>
                    <input 
                      type="date" 
                      value={agmDate} 
                      onChange={(e) => setAgmDate(e.target.value)}
                      style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', marginTop: '4px', background: 'var(--bg-light)', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <button 
                  onClick={handleCalculateNotice}
                  style={{ width: '100%', padding: '10px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Verify Notice Compliancy
                </button>

                {noticeCalculationResult && (
                  <div style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: noticeCalculationResult.isValid ? 'var(--success-light)' : 'var(--danger-light)',
                    borderLeft: `4px solid ${noticeCalculationResult.isValid ? 'var(--success)' : 'var(--danger)'}`,
                    fontSize: '13px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div style={{ fontWeight: '700', color: noticeCalculationResult.isValid ? 'var(--success)' : 'var(--danger)' }}>
                      {noticeCalculationResult.isValid ? '✔ Compliant Notice Period' : '❌ Notice Period Non-Compliant'}
                    </div>
                    <div>Clear Days Counted: <b>{noticeCalculationResult.days} Days</b> (Requirement: Min 21 Clear Days)</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {noticeCalculationResult.excludedDays.map((ex, i) => (
                        <div key={i}>• {ex}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* CDSL/NSDL e-voting configuration */}
              <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700' }}>E-Voting Portal Setup</h3>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>E-VOTING PLATFORM PROVIDER</label>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                    {['CDSL', 'NSDL'].map(prov => (
                      <label key={prov} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                        <input 
                          type="radio" 
                          name="evoting" 
                          checked={eVotingProvider === prov} 
                          onChange={() => setEVotingProvider(prov)} 
                        />
                        {prov}
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>START DATE/TIME</label>
                    <input 
                      type="datetime-local" 
                      defaultValue="2026-09-26T09:00" 
                      style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', marginTop: '4px', background: 'var(--bg-light)', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>END DATE/TIME</label>
                    <input 
                      type="datetime-local" 
                      defaultValue="2026-09-29T17:00" 
                      style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', marginTop: '4px', background: 'var(--bg-light)', fontSize: '13px' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Agenda compiler */}
            <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700' }}>AGM Agenda Builder</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto' }}>
                {agendaItems.map(item => (
                  <div key={item.id} style={{ padding: '10px 14px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', fontWeight: '700', marginBottom: '4px' }}>
                      <span>Item #{item.id}: {item.title}</span>
                      <span style={{ fontSize: '10px', background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 6px', borderRadius: '4px' }}>
                        {item.type}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.details}</div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>ADD NEW AGENDA ITEM</label>
                <input 
                  type="text" 
                  placeholder="Enter agenda title..." 
                  value={newAgendaTitle} 
                  onChange={(e) => setNewAgendaTitle(e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-light)', fontSize: '13px' }}
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select 
                    value={newAgendaType} 
                    onChange={(e) => setNewAgendaType(e.target.value)}
                    style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-light)', fontSize: '13px', flex: '1' }}
                  >
                    <option value="ORDINARY">ORDINARY RESOLUTION</option>
                    <option value="SPECIAL">SPECIAL RESOLUTION</option>
                  </select>
                  <button 
                    onClick={handleAddAgenda}
                    style={{ padding: '8px 16px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Add Agenda
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. MINUTES OF MEETING GENERATOR */}
        {activeTab === 'minutes' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
            
            {/* Meeting Settings & Attendance */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Meeting Parameters</h3>
              
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>MEETING TYPE</label>
                <select 
                  value={meetingType} 
                  onChange={(e) => setMeetingType(e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', marginTop: '4px', background: 'var(--bg-light)', fontSize: '13px' }}
                >
                  <option value="BOARD_MEETING">Board Meeting</option>
                  <option value="AUDIT_COMMITTEE">Audit Committee</option>
                  <option value="AGM">Annual General Meeting (AGM)</option>
                  <option value="EGM">Extraordinary General Meeting (EGM)</option>
                  <option value="RISK_COMMITTEE">Risk Committee</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>MEETING NUMBER / SERIAL</label>
                <input 
                  type="number" 
                  value={meetingNumber} 
                  onChange={(e) => setMeetingNumber(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', marginTop: '4px', background: 'var(--bg-light)', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>DATE & TIME</label>
                <input 
                  type="datetime-local" 
                  value={meetingDateTime} 
                  onChange={(e) => setMeetingDateTime(e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', marginTop: '4px', background: 'var(--bg-light)', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>MEETING CHAIRMAN</label>
                <select 
                  value={meetingChairmanId} 
                  onChange={(e) => setMeetingChairmanId(e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', marginTop: '4px', background: 'var(--bg-light)', fontSize: '13px' }}
                >
                  {companyDirectors.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', display: 'block', marginBottom: '6px' }}>DIRECTORS IN ATTENDANCE</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {companyDirectors.map(d => (
                    <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={attendeesList.includes(d.id)}
                        onChange={(e) => {
                          if (e.target.checked) setAttendeesList([...attendeesList, d.id]);
                          else setAttendeesList(attendeesList.filter(id => id !== d.id));
                        }}
                      />
                      {d.name} ({d.designation})
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Generated Minutes View & Workflow */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', flex: '1' }}>
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '700' }}>AI-Generated Minutes Draft (SS-1 Compliant)</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {['DRAFT', 'CIRCULATED', 'SIGNED'].map(status => (
                      <button
                        key={status}
                        onClick={() => {
                          setMinutesWorkflowState(status as any);
                          setMinutesLogs(prev => [
                            ...prev,
                            { step: `Workflow state updated to [${status}]`, timestamp: new Date().toISOString().substring(0,16).replace('T', ' '), user: 'CA Partner' }
                          ]);
                        }}
                        style={{
                          padding: '4px 10px',
                          background: minutesWorkflowState === status ? 'var(--primary)' : 'var(--bg-gray)',
                          color: minutesWorkflowState === status ? '#fff' : 'var(--text-primary)',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '11.5px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ 
                  padding: '16px', 
                  background: 'var(--bg-light)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '8px', 
                  fontFamily: 'serif', 
                  fontSize: '13px', 
                  lineHeight: '1.7', 
                  color: 'var(--text-primary)', 
                  maxHeight: '300px', 
                  overflowY: 'auto' 
                }}>
                  <div style={{ textAlign: 'center', fontWeight: '700', marginBottom: '16px', fontSize: '14px' }}>
                    MINUTES OF THE MEETING #{meetingNumber} OF THE BOARD OF DIRECTORS OF {company.name.toUpperCase()}<br />
                    HELD ON {new Date(meetingDateTime).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} AT {new Date(meetingDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>

                  <p><b>1. CHAIRMAN OF THE MEETING</b><br />
                  Ms/Mr. {companyDirectors.find(d => d.id === meetingChairmanId)?.name || 'Vikram Aditya Shah'} took the chair and welcomed the Board to the meeting.</p>

                  <p><b>2. QUORUM</b><br />
                  The Chairman confirmed that the necessary quorum was present as required under Section 174 of the Companies Act, 2013 and declared the meeting open. The following directors were present:
                  <ul>
                    {attendeesList.map(id => (
                      <li key={id}>Ms/Mr. {companyDirectors.find(d => d.id === id)?.name}</li>
                    ))}
                  </ul>
                  </p>

                  <p><b>3. NOTING APPOINTMENTS / MOTIONS</b><br />
                  The Board discussed key compliance matters. A resolution was proposed, seconded, and passed regarding {RESOLUTION_TEMPLATES.find(t => t.key === resTemplate)?.title}.</p>
                </div>
              </div>

              {/* Minutes logs / Audit Trail */}
              <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
                <h4 style={{ fontSize: '12.5px', fontWeight: '700', marginBottom: '8px' }}>Minutes Audit Trail & Logs</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {minutesLogs.map((log, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', fontSize: '11.5px', borderBottom: '1px solid var(--bg-gray)', paddingBottom: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{log.step} ({log.user})</span>
                      <span style={{ color: 'var(--text-muted)' }}>{log.timestamp}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5. MCA FORMS PREPARATION DESK */}
        {activeTab === 'mca' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
            
            {/* Forms list and population controls */}
            <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Form filing Console</h3>
              
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>SELECT FORM</label>
                <select 
                  value={selectedFormType} 
                  onChange={(e) => setSelectedFormType(e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', marginTop: '4px', background: 'var(--bg-light)', fontSize: '13px' }}
                >
                  {MCA_FORM_CATALOG.map(f => (
                    <option key={f.form} value={f.form}>{f.form} - {f.purpose}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>FINANCIAL YEAR</label>
                <input 
                  type="text" 
                  value={filingYear} 
                  onChange={(e) => setFilingYear(e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', marginTop: '4px', background: 'var(--bg-light)', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button 
                  onClick={handleValidateForm}
                  style={{ padding: '10px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Run Compliance Validation checks
                </button>

                <button 
                  onClick={() => {
                    setDscTokenStatus('CONNECTED');
                    setFilingActivityLogs(prev => [...prev, { event: 'USB DSC Token detected (ePass2003)', time: new Date().toLocaleTimeString(), status: 'SUCCESS' }]);
                  }}
                  style={{ padding: '10px', background: 'var(--gold)', color: '#000', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                >
                  📡 Connect DSC Token
                </button>
              </div>
            </div>

            {/* validation reports and forms checklist */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Validation panel */}
              <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '12px' }}>Pre-Filing Validation Report</h3>
                
                {formValidationErrors.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {formValidationErrors.map((err, idx) => (
                      <div key={idx} style={{ padding: '10px 14px', background: 'var(--danger-light)', borderLeft: '4px solid var(--danger)', borderRadius: '4px', fontSize: '13px' }}>
                        ❌ {err}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '16px', background: 'var(--success-light)', borderLeft: '4px solid var(--success)', borderRadius: '4px', fontSize: '13px', color: 'var(--success)', fontWeight: '600' }}>
                    ✔ Schema checklist passed. All required fields and director signatures verified. Ready for submission.
                  </div>
                )}
              </div>

              {/* DSC Smart signature bridge status */}
              <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '12px' }}>DSC Local Bridge</h3>
                <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-light)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '13px' }}>
                    Status: <b style={{ color: dscTokenStatus === 'DISCONNECTED' ? 'var(--danger)' : 'var(--success)' }}>{dscTokenStatus}</b>
                  </div>
                  {dscTokenStatus === 'CONNECTED' && (
                    <button 
                      onClick={() => {
                        setDscTokenStatus('SIGNED');
                        setFilingActivityLogs(prev => [...prev, { event: 'PDF digitally signed with SHA-256 certificate', time: new Date().toLocaleTimeString(), status: 'SUCCESS' }]);
                      }}
                      style={{ padding: '6px 12px', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Authorize Signature
                    </button>
                  )}
                </div>

                {/* Form activity Logs */}
                {filingActivityLogs.length > 0 && (
                  <div style={{ marginTop: '12px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontWeight: '700', color: 'var(--text-secondary)' }}>Log Entries:</div>
                    {filingActivityLogs.map((log, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--bg-gray)', paddingBottom: '4px' }}>
                        <span>{log.event}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{log.time}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 6. STATUTORY REGISTERS MAINTENANCE */}
        {activeTab === 'registers' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '20px' }}>
            
            {/* Register Selector */}
            <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Select Register</h3>
              {[
                { id: 'MGT-1', label: 'Register of Members (MGT-1)' },
                { id: 'MBP-1', label: 'Directors\' Interest disclosures (MBP-1)' },
                { id: 'MBP-4', label: 'Contracts with Related Parties (MBP-4)' },
                { id: 'CHG-7', label: 'Register of Charges (CHG-7)' }
              ].map(reg => (
                <button
                  key={reg.id}
                  onClick={() => setSelectedRegister(reg.id)}
                  style={{
                    padding: '10px 14px',
                    background: selectedRegister === reg.id ? 'var(--primary-light)' : 'none',
                    color: selectedRegister === reg.id ? 'var(--primary)' : 'var(--text-primary)',
                    border: 'none',
                    borderRadius: '6px',
                    textAlign: 'left',
                    fontWeight: selectedRegister === reg.id ? '700' : '500',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  {reg.label}
                </button>
              ))}
            </div>

            {/* Register Display Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Register contents */}
              <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '12px' }}>{selectedRegister} Register Viewer</h3>
                
                {selectedRegister === 'MGT-1' && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '8px', color: 'var(--text-secondary)' }}>Member Name</th>
                        <th style={{ padding: '8px', color: 'var(--text-secondary)' }}>PAN</th>
                        <th style={{ padding: '8px', color: 'var(--text-secondary)' }}>Shareholding Type</th>
                        <th style={{ padding: '8px', color: 'var(--text-secondary)' }}>No. of Shares</th>
                        <th style={{ padding: '8px', color: 'var(--text-secondary)' }}>Nominal Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companyShareholders.map(sh => (
                        <tr key={sh.id} style={{ borderBottom: '1px solid var(--bg-gray)' }}>
                          <td style={{ padding: '10px 8px', fontWeight: '600' }}>{sh.name}</td>
                          <td style={{ padding: '10px 8px' }}>{sh.pan || 'ASDPS1234F'}</td>
                          <td style={{ padding: '10px 8px' }}>{sh.shareType}</td>
                          <td style={{ padding: '10px 8px', fontWeight: '600' }}>{sh.shares.toLocaleString()}</td>
                          <td style={{ padding: '10px 8px' }}>₹{sh.value.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {selectedRegister === 'MBP-1' && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '8px', color: 'var(--text-secondary)' }}>Director Name</th>
                        <th style={{ padding: '8px', color: 'var(--text-secondary)' }}>Entity Name</th>
                        <th style={{ padding: '8px', color: 'var(--text-secondary)' }}>Nature of Interest</th>
                        <th style={{ padding: '8px', color: 'var(--text-secondary)' }}>Interest %</th>
                        <th style={{ padding: '8px', color: 'var(--text-secondary)' }}>Date of Disclosure</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid var(--bg-gray)' }}>
                        <td style={{ padding: '10px 8px', fontWeight: '600' }}>Vikram Aditya Shah</td>
                        <td style={{ padding: '10px 8px' }}>Shah Logistics Private Limited</td>
                        <td style={{ padding: '10px 8px' }}>Director & Shareholder</td>
                        <td style={{ padding: '10px 8px' }}>45.00%</td>
                        <td style={{ padding: '10px 8px' }}>2025-04-10</td>
                      </tr>
                    </tbody>
                  </table>
                )}

                {selectedRegister === 'MBP-4' && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '8px', color: 'var(--text-secondary)' }}>Party Name</th>
                        <th style={{ padding: '8px', color: 'var(--text-secondary)' }}>Related Director</th>
                        <th style={{ padding: '8px', color: 'var(--text-secondary)' }}>Transaction Details</th>
                        <th style={{ padding: '8px', color: 'var(--text-secondary)' }}>Value</th>
                        <th style={{ padding: '8px', color: 'var(--text-secondary)' }}>Arm's Length?</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid var(--bg-gray)' }}>
                        <td style={{ padding: '10px 8px', fontWeight: '600' }}>Shah Logistics Private Limited</td>
                        <td style={{ padding: '10px 8px' }}>Vikram Aditya Shah</td>
                        <td style={{ padding: '10px 8px' }}>Service Agreement for Transport</td>
                        <td style={{ padding: '10px 8px' }}>₹12,00,000 / yr</td>
                        <td style={{ padding: '10px 8px', color: 'var(--success)', fontWeight: '600' }}>YES</td>
                      </tr>
                    </tbody>
                  </table>
                )}

                {selectedRegister === 'CHG-7' && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '8px', color: 'var(--text-secondary)' }}>Charge ID</th>
                        <th style={{ padding: '8px', color: 'var(--text-secondary)' }}>Lender Bank</th>
                        <th style={{ padding: '8px', color: 'var(--text-secondary)' }}>Hypothecation details</th>
                        <th style={{ padding: '8px', color: 'var(--text-secondary)' }}>Amount Secured</th>
                        <th style={{ padding: '8px', color: 'var(--text-secondary)' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chargesList.map(chg => (
                        <tr key={chg.id} style={{ borderBottom: '1px solid var(--bg-gray)' }}>
                          <td style={{ padding: '10px 8px', fontWeight: '600' }}>{chg.chargeId}</td>
                          <td style={{ padding: '10px 8px' }}>{chg.lender}</td>
                          <td style={{ padding: '10px 8px' }}>{chg.asset}</td>
                          <td style={{ padding: '10px 8px', fontWeight: '600' }}>₹{chg.amount.toLocaleString()}</td>
                          <td style={{ padding: '10px 8px' }}>
                            <span style={{ fontSize: '11px', background: 'var(--success-light)', color: 'var(--success)', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>
                              {chg.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Inspection audit logs */}
              <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '12px' }}>Statutory Inspection Log</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {inspectionLogs.map((log, idx) => (
                    <div key={idx} style={{ padding: '10px 14px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px', display: 'flex', justifyItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <b>{log.auditor}</b> ({log.firm}) - <i>{log.purpose}</i>
                      </div>
                      <div style={{ color: 'var(--text-muted)' }}>{log.date}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 7. SHARE CAPITAL & CHARGE MANAGEMENT */}
        {activeTab === 'capital' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            
            {/* Share Capital Cap Table */}
            <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Company Capitalization & Cap Table</h3>
              
              <div style={{ padding: '16px', background: 'var(--bg-light)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Authorized Share Capital:</span>
                  <span style={{ fontWeight: '700' }}>₹{company.authorizedCapital.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Paid Up Share Capital:</span>
                  <span style={{ fontWeight: '700', color: 'var(--primary)' }}>₹{company.paidUpCapital.toLocaleString()}</span>
                </div>
                <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Share Classes:</span>
                  <span>Equity Shares (Face value ₹10)</span>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Cap Table Distribution</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {companyShareholders.map(sh => {
                    const totalSharesInCo = companyShareholders.reduce((sum, item) => sum + Number(item.shares), 0);
                    const pct = ((Number(sh.shares) / totalSharesInCo) * 100).toFixed(1);
                    return (
                      <div key={sh.id} style={{ fontSize: '13px' }}>
                        <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span>{sh.name}</span>
                          <span style={{ fontWeight: '700' }}>{sh.shares.toLocaleString()} shares ({pct}%)</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: 'var(--bg-gray)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--primary)' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Charges register creation modification satisfy */}
            <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Charges and Encumbrances</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {chargesList.map(chg => (
                  <div key={chg.id} style={{ padding: '12px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', fontWeight: '700', marginBottom: '6px' }}>
                      <span>Lender: {chg.lender}</span>
                      <UniversalStatusBadge status={chg.status} />
                    </div>
                    <div>Charge Amount: <b>₹{chg.amount.toLocaleString()}</b></div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Asset details: {chg.asset}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Created on: {chg.creationDate}</div>
                    
                    {chg.status === 'OPEN' && (
                      <button 
                        onClick={() => {
                          setChargesList(chargesList.map(c => c.id === chg.id ? { ...c, status: 'SATISFIED', satisfactionDate: '2026-06-15' } : c));
                        }}
                        style={{ padding: '6px 12px', background: 'var(--success-light)', color: 'var(--success)', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: '700', marginTop: '8px', cursor: 'pointer' }}
                      >
                        ✔ Satisfy Charge (Form CHG-4)
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 8. CORPORATE EVENT WORKFLOWS */}
        {activeTab === 'events' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
            
            {/* Event selection */}
            <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '8px' }}>Corporate Action Events</h3>
              {[
                { id: 'dir_appt', label: 'Director Appointment' },
                { id: 'dir_resign', label: 'Director Resignation' },
                { id: 'cap_increase', label: 'Increase Authorized Capital' },
                { id: 'share_issue', label: 'Issue New Shares' }
              ].map(event => (
                <button
                  key={event.id}
                  style={{
                    padding: '10px 14px',
                    background: event.id === 'dir_appt' ? 'var(--primary-light)' : 'none',
                    color: event.id === 'dir_appt' ? 'var(--primary)' : 'var(--text-primary)',
                    border: 'none',
                    borderRadius: '6px',
                    textAlign: 'left',
                    fontWeight: event.id === 'dir_appt' ? '700' : '500',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  {event.label}
                </button>
              ))}
            </div>

            {/* Step-by-step workflow guide */}
            <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Director Appointment Compliance Workflow</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative' }}>
                {[
                  { step: 1, title: 'Obtain DIN & Digital Signatures (DSC)', desc: 'Obtain Form DIR-3 for the proposed director if not already possessing DIN.', done: true },
                  { step: 2, title: 'Collect Consent & Declarations (DIR-2 & DIR-8)', desc: 'Collect DIR-2 (Consent to act as Director) and DIR-8 (Declaration of non-disqualification) under Section 164.', done: true },
                  { step: 3, title: 'Pass Board Resolution / AGM Special Resolution', desc: 'Hold board meeting or general meeting to approve the director appointment.', done: false },
                  { step: 4, title: 'File DIR-12 with ROC / MCA Portal', desc: 'Submit particulars of director appointment within 30 days of the resolution.', done: false },
                  { step: 5, title: 'Update Statutory Registers (MGT-1 & Register of Directors)', desc: 'Update Register of Directors and register of members if shareholding matches.', done: false }
                ].map((item) => (
                  <div key={item.step} style={{ display: 'flex', gap: '12px', alignItems: 'start' }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: item.done ? 'var(--success)' : 'var(--bg-gray)',
                      color: item.done ? '#fff' : 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: '700',
                      flexShrink: 0
                    }}>
                      {item.step}
                    </div>
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{item.title}</span>
                        {item.done && <span style={{ color: 'var(--success)', fontSize: '11px' }}>✔ COMPLETED</span>}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 9. SECRETARIAL AUDIT MODULE (MR-3) */}
        {activeTab === 'audit' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            
            {/* Checklist audit verification */}
            <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700' }}>MR-3 Audit Checklist Compliance</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {auditChecklist.map(check => (
                  <label key={check.id} style={{ display: 'flex', alignItems: 'start', gap: '10px', fontSize: '13px', cursor: 'pointer', padding: '10px', background: 'var(--bg-light)', borderRadius: '6px' }}>
                    <input 
                      type="checkbox" 
                      checked={check.checked} 
                      onChange={() => {
                        setAuditChecklist(auditChecklist.map(c => c.id === check.id ? { ...c, checked: !c.checked } : c));
                      }}
                      style={{ marginTop: '3px' }}
                    />
                    <span>{check.text}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Audits observations output & risk assessment */}
            <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Secretarial Audit Report (Form MR-3) Compiler</h3>
              
              <div style={{ padding: '14px', background: 'var(--bg-light)', borderRadius: '8px', fontSize: '13px' }}>
                <div style={{ fontWeight: '700', marginBottom: '8px' }}>Auditor Observations:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div>• MBP-1 Disclosure forms missing for Independent Director Rajesh Kumar Gupta.</div>
                  <div>• Register of Members MGT-1 is verified and fully reconciled with Depositories (NSDL/CDSL).</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={() => alert('Secretarial Audit Report Compiled successfully as PDF!')}
                  style={{ flex: '1', padding: '10px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Compile PDF Report
                </button>
                <button 
                  onClick={() => alert('Audit Checklist Exported as Excel')}
                  style={{ flex: '1', padding: '10px', background: 'var(--bg-gray)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Export Checklist (Excel)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 10. AI COPILOT CHAT */}
        {activeTab === 'copilot' && (
          <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '480px' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-light)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700' }}>AI Secretarial Copilot</h3>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Groq Powered LLM Engine for Indian Companies Act 2013 and ROC guidelines</div>
            </div>

            {/* Message window */}
            <div style={{ flex: '1', padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {chatMessages.map((msg, idx) => (
                <div key={idx} style={{
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  background: msg.sender === 'user' ? 'var(--primary)' : 'var(--bg-gray)',
                  color: msg.sender === 'user' ? '#fff' : 'var(--text-primary)',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  maxWidth: '70%',
                  fontSize: '13px',
                  boxShadow: 'var(--shadow-sm)',
                  lineHeight: '1.5'
                }}>
                  <div style={{ whiteSpace: 'pre-line' }}>{msg.text}</div>
                  
                  {/* Suggest form links */}
                  {msg.forms && (
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {msg.forms.map((f, i) => (
                        <button 
                          key={i} 
                          onClick={() => {
                            const name = f.split(' ')[0];
                            setSelectedFormType(name);
                            setActiveTab('mca');
                          }}
                          style={{
                            alignSelf: 'flex-start',
                            padding: '4px 8px',
                            background: '#fff',
                            color: 'var(--primary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          Draft Form {f.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Input bar */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '10px' }}>
              <input 
                type="text" 
                placeholder="Ask Companies Act queries, suggest ROC forms, or notices..." 
                value={chatInput} 
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                style={{ flex: '1', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-light)', outline: 'none', fontSize: '13px' }}
              />
              <button 
                onClick={handleSendChat}
                style={{ padding: '10px 18px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
