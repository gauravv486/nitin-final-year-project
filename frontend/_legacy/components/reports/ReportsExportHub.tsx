'use client';

import React, { useState, useEffect } from 'react';
import {
  ReportDefinition,
  KPIMetrics,
  DrillDownNode,
  AIReportResult,
  ScheduledDeliveryLog,
  INITIAL_REPORT_LIBRARY,
  MOCK_DRILLDOWN_DATA,
  executeAIReportQuery,
  processExportSigning,
  generateExecutiveMetrics,
  INITIAL_SCHEDULED_LOGS
} from '@/lib/reports/ReportsControlEngine';

interface ExportLogItem {
  id: string;
  reportName: string;
  format: string;
  size: string;
  timestamp: string;
  path: string;
  signedHash?: string;
  encryption?: string;
}

// Global Universal Status Badge component
export function UniversalStatusBadge({ status }: { status: string }) {
  let color = '#6B7280';
  let bg = '#F9FAFB';
  let border = '#E5E7EB';
  let textDec = 'none';

  const s = status.toUpperCase();

  if (s === 'NOT STARTED' || s === 'DRAFT') {
    color = '#6B7280'; bg = '#F3F4F6'; border = '#E5E7EB';
  } else if (s === 'IN PROGRESS' || s === 'PENDING') {
    color = '#3B82F6'; bg = '#EFF6FF'; border = '#BFDBFE';
  } else if (s === 'UNDER REVIEW') {
    color = '#F59E0B'; bg = '#FEF3C7'; border = '#FDE68A';
  } else if (s === 'COMPLETED' || s === 'FILED' || s === 'APPROVED' || s === 'DELIVERED' || s === 'MATCHED' || s === 'FINAL' || s === 'SUCCESS') {
    color = '#22C55E'; bg = '#DCFCE7'; border = '#BBF7D0';
  } else if (s === 'OVERDUE') {
    color = '#EF4444'; bg = '#FEE2E2'; border = '#FCA5A5';
  } else if (s === 'NOT APPLICABLE') {
    color = '#6B7280'; bg = '#E5E7EB'; border = '#D1D5DB'; textDec = 'line-through';
  } else if (s === 'ON HOLD') {
    color = '#7C3AED'; bg = '#F5F3FF'; border = '#DDD6FE';
  } else if (s === 'AI REVIEW REQUIRED' || s === 'RECONCILIATION_FLAGGED') {
    color = '#8B5CF6'; bg = '#F5F3FF'; border = '#DDD6FE';
  } else if (s === 'ERROR' || s === 'FAILED') {
    color = '#B91C1C'; bg = '#FEE2E2'; border = '#FCA5A5';
  }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '4px 10px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: '600',
      color: color,
      backgroundColor: bg,
      border: `1.5px solid ${border}`,
      textDecoration: textDec,
      whiteSpace: 'nowrap'
    }}>
      {s === 'AI REVIEW REQUIRED' && <span style={{ marginRight: '2px' }}>✨</span>}
      {status}
    </span>
  );
}

interface ReportsExportHubProps {
  simulateEmpty?: boolean;
  simulateAiError?: boolean;
}

export default function ReportsExportHub({ simulateEmpty, simulateAiError }: ReportsExportHubProps) {
  const [activeTab, setActiveTab] = useState<'kpis' | 'library' | 'ai' | 'schedules' | 'history' | 'whitelabel'>('kpis');

  // Roster viewports size states
  const [isMobile, setIsMobile] = useState(false);
  const [showDesktopBlocker, setShowDesktopBlocker] = useState(false);

  // Global Empty State toggle
  const [isEmptyStateActive, setIsEmptyStateActive] = useState(false);

  // AI Fallback states
  const [simulatedAiError, setSimulatedAiError] = useState(false);

  useEffect(() => {
    if (simulateEmpty !== undefined) {
      setIsEmptyStateActive(simulateEmpty);
    }
  }, [simulateEmpty]);

  useEffect(() => {
    if (simulateAiError !== undefined) {
      setSimulatedAiError(simulateAiError);
    }
  }, [simulateAiError]);
  const [manualReportConfig, setManualReportConfig] = useState({
    tableName: 'gst_outbound_ledgers',
    columns: ['client_name', 'gstin', 'tax_due', 'status'],
    sortBy: 'due_date'
  });
  const [manualFeedbackText, setManualFeedbackText] = useState('');
  const [manualReportData, setManualReportData] = useState<any[] | null>(null);

  // Master states
  const [reportLibrary, setReportLibrary] = useState<ReportDefinition[]>(INITIAL_REPORT_LIBRARY);
  const [scheduledLogs, setScheduledLogs] = useState<ScheduledDeliveryLog[]>(INITIAL_SCHEDULED_LOGS);
  const [kpiMetrics, setKpiMetrics] = useState<KPIMetrics>(generateExecutiveMetrics());
  
  // 1. Executive Dashboard & Drill-down
  const [drillPath, setDrillPath] = useState<string[]>(['root']);
  const [selectedDashboardRole, setSelectedDashboardRole] = useState<'MANAGING_PARTNER' | 'CA_PARTNER' | 'SENIOR_STAFF' | 'CLIENT'>('MANAGING_PARTNER');

  // 2. Report Library Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'FINANCIAL' | 'GST' | 'INCOME_TAX' | 'AUDIT' | 'PAYROLL' | 'COMPLIANCE' | 'PRACTICE' | 'AI'>('ALL');

  // 3. Filter Builder & Export Panel
  const [selectedReportId, setSelectedReportId] = useState<string>('rep-001');
  const [filterFY, setFilterFY] = useState('FY 2026-27');
  const [filterClientGroup, setFilterClientGroup] = useState('ALL');
  const [exportFormat, setExportFormat] = useState<'PDF' | 'EXCEL' | 'CSV' | 'JSON' | 'ZIP'>('PDF');
  const [passwordProtection, setPasswordProtection] = useState(false);
  const [exportPassword, setExportPassword] = useState('Secret123');
  const [digitalSigning, setDigitalSigning] = useState(true);
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL - CA OS');
  
  // Export Compilation Simulation
  const [compilingExport, setCompilingExport] = useState(false);
  const [compileProgress, setCompileProgress] = useState(0);
  const [exportsList, setExportsList] = useState<ExportLogItem[]>([
    { id: 'exp-01', reportName: 'GSTR-1 vs GSTR-3B Quarterly Reconciliation', format: 'PDF', size: '284 KB', timestamp: '2026-06-15 01:20 PM', path: '/exports/GST_Recon_1712.pdf', signedHash: 'sha256:cert_thumbprint_99x88a2', encryption: 'AES-256-GCM' },
    { id: 'exp-02', reportName: 'Section 43B(h) MSME Payment Scrutiny Audit', format: 'EXCEL', size: '1.4 MB', timestamp: '2026-06-14 11:00 AM', path: '/exports/MSME_Scrutiny_2210.xlsx' }
  ]);

  // 4. AI Report Generator
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiReportData, setAiReportData] = useState<AIReportResult | null>(null);
  const [generatingAI, setGeneratingAI] = useState(false);

  // 5. Scheduling States
  const [newSchedule, setNewSchedule] = useState({
    reportId: 'rep-001',
    frequency: 'MONTHLY',
    cronExpression: '0 0 1 * *',
    recipientRaw: 'compliance@corporate.in',
    channelEmail: true,
    channelWhatsApp: false,
    channelPortal: true
  });

  // 6. Share Center States
  const [selectedExportForShare, setSelectedExportForShare] = useState<ExportLogItem | null>(null);
  const [shareExpiry, setShareExpiry] = useState<'24H' | '7D' | '30D'>('7D');
  const [sharePasswordLocked, setSharePasswordLocked] = useState(false);
  const [sharePassword, setSharePassword] = useState('ClientSecure88');
  const [generatedShareLink, setGeneratedShareLink] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  
  // Share access logs simulate
  const [simulatedAccessLogs, setSimulatedAccessLogs] = useState([
    { timestamp: '2026-06-15 03:00 PM', ip: '103.88.24.12', device: 'Chrome / MacOS', location: 'Mumbai, India' },
    { timestamp: '2026-06-14 09:12 AM', ip: '46.12.98.4', device: 'Safari / iPadOS', location: 'Munich, Germany' }
  ]);

  // 7. Collaboration States
  const [reportComments, setReportComments] = useState([
    { id: 'c-01', user: 'Neha Roy (Article Assistant)', text: 'I have checked the May mismatch logs. The outward voucher sequence PV-08291 has an extra ledger classification that caused the tax discrepancy. Awaiting partner approval.', date: '2026-06-15 02:30 PM' },
    { id: 'c-02', user: 'CA Priya Sharma (Partner)', text: 'Reviewed. Please tag Computech to re-upload their corrected invoice in the portal so we can clear the hold.', date: '2026-06-15 03:15 PM' }
  ]);
  const [newCommentText, setNewCommentText] = useState('');

  // 8. White-Label Settings Preview
  const [whiteLabelColors, setWhiteLabelColors] = useState({
    primary: '#1B3A6B',
    secondary: '#D4AF37',
    footerText: 'Generated by CA OS Advisory Portal. All rights reserved.'
  });

  // Screen resize checker
  useEffect(() => {
    const checkViewport = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // Drill Down Navigation Helper
  const currentDrillNode = MOCK_DRILLDOWN_DATA[drillPath[drillPath.length - 1]] || MOCK_DRILLDOWN_DATA['root'];

  const handleDrillClick = (childId: string) => {
    setDrillPath([...drillPath, childId]);
  };

  const handleBreadcrumbClick = (index: number) => {
    setDrillPath(drillPath.slice(0, index + 1));
  };

  // Run Export Simulation
  const handleTriggerExport = () => {
    if (simulatedAiError && selectedReportId === 'rep-001') {
      alert("Error: Financial statements cannot be generated because the trial balance is not balanced. The difference is ₹1,42,500.00. Please review the Ledger Reconciliation view to identify and correct the discrepancy before generating statements.");
      return;
    }
    const rName = reportLibrary.find(r => r.id === selectedReportId)?.name || 'Statutory Report';
    setCompilingExport(true);
    setCompileProgress(10);

    let pct = 10;
    const interval = setInterval(() => {
      pct += Math.floor(Math.random() * 20) + 5;
      if (pct >= 100) {
        pct = 100;
        clearInterval(interval);
        
        const res = processExportSigning(rName, exportFormat, passwordProtection ? exportPassword : undefined, digitalSigning);
        const sizeStr = isEmptyStateActive ? "0 KB" : `${(res.fileSizeBytes / 1024).toFixed(0)} KB`;
        const newLog: ExportLogItem = {
          id: `exp-${Date.now()}`,
          reportName: rName,
          format: exportFormat,
          size: sizeStr,
          timestamp: new Date().toLocaleString(),
          path: res.filePath,
          signedHash: isEmptyStateActive ? undefined : res.digitalSignatureHash,
          encryption: res.encryptionAlgorithm
        };
        
        setExportsList([newLog, ...exportsList]);
        setCompilingExport(false);
        if (isEmptyStateActive) {
          alert(`Compilation complete! [Note: No operational data found for this period. Report contains empty tables.] Generated empty dataset for ${rName} in ${exportFormat} format.`);
        } else {
          alert(`Compilation complete! ${rName} generated as ${exportFormat}. Path: ${res.filePath}`);
        }
      } else {
        setCompileProgress(pct);
      }
    }, 300);
  };

  // AI Generator Prompt Submit
  const handleTriggerAISubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;

    if (simulatedAiError) {
      // Simulate AI Error
      setGeneratingAI(true);
      setAiReportData(null);
      setTimeout(() => {
        setGeneratingAI(false);
      }, 500);
      return;
    }

    setGeneratingAI(true);
    setAiReportData(null);

    setTimeout(() => {
      const res = executeAIReportQuery(aiPrompt);
      setAiReportData(res);
      setGeneratingAI(false);
    }, 1200);
  };

  // Manual fallback compilation
  const handleManualReportCompile = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate manual report compilation
    setManualReportData([
      { 'client_name': 'Zylos Pharma Limited', 'gstin': '27ZZZZZ9999Z9Z9', 'tax_due': '₹1,12,000', 'status': 'Completed' },
      { 'client_name': 'Aegis Infotech Private Limited', 'gstin': '27AAAAA1111A1Z1', 'tax_due': '₹84,200', 'status': 'AI Review Required' },
      { 'client_name': 'Vortex Logistics LLP', 'gstin': '27BBBBB2222B2Z2', 'tax_due': '₹12,400', 'status': 'In Progress' }
    ]);
    alert('Manual fallback report compiled successfully. Roster loaded below.');
  };

  // Add Comment annotation
  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    const comment = {
      id: `c-${Date.now()}`,
      user: 'CA Rohan Mehta (Partner CA)',
      text: newCommentText,
      date: new Date().toLocaleString()
    };
    setReportComments([...reportComments, comment]);
    setNewCommentText('');
  };

  // Recurrent schedule creation
  const handleCreateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    const rName = reportLibrary.find(r => r.id === newSchedule.reportId)?.name || 'Custom Report';
    
    const channelsList: string[] = [];
    if (newSchedule.channelEmail) channelsList.push('Email');
    if (newSchedule.channelWhatsApp) channelsList.push('WhatsApp');
    if (newSchedule.channelPortal) channelsList.push('Portal');

    const newLog: ScheduledDeliveryLog = {
      id: `sdl-${Date.now()}`,
      reportName: rName,
      recipients: newSchedule.recipientRaw.split(',').map(s => s.trim()),
      frequency: newSchedule.frequency,
      channels: channelsList,
      status: 'DELIVERED',
      timestamp: 'Just scheduled',
      retryCount: 0
    };

    setScheduledLogs([newLog, ...scheduledLogs]);
    setNewSchedule({
      reportId: 'rep-001',
      frequency: 'MONTHLY',
      cronExpression: '0 0 1 * *',
      recipientRaw: 'compliance@corporate.in',
      channelEmail: true,
      channelWhatsApp: false,
      channelPortal: true
    });
    alert(`Scheduled recurrent delivery for "${rName}". Next dispatch loaded.`);
  };

  // Generate share link
  const handleGenerateShareLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExportForShare) return;
    const token = 'shr_' + Math.random().toString(36).substring(2, 12);
    setGeneratedShareLink(`https://ca-os.net/secure/share/${token}`);
    setShowShareModal(true);
  };

  // Filter lists
  const filteredReports = reportLibrary.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = categoryFilter === 'ALL' || r.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  // Hook trigger for mobile desktop block warning
  const handleOpenAdvancedBuilder = () => {
    if (isMobile) {
      setShowDesktopBlocker(true);
    } else {
      alert('Opening Advanced Report Builder grid customizer...');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', fontFamily: 'inherit', color: 'var(--text-primary)' }}>
      
      {/* Top section with config checks */}
      <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', letterSpacing: '-0.02em', color: 'var(--primary)' }}>Reports & Export Hub</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Central intelligence scorecard, dynamic drill-down tables, AI prompts, recurrence scheduler, and white-labeled document exports.</p>
        </div>

        {/* Global Empty State & Viewport Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', background: 'var(--bg-white)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <input
              type="checkbox"
              checked={isEmptyStateActive}
              onChange={(e) => setIsEmptyStateActive(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>Simulate Empty State</span>
          </label>

          <button
            onClick={handleOpenAdvancedBuilder}
            className="btn btn-sm btn-secondary"
            style={{ fontWeight: '700' }}
          >
            ⚙ Advanced Report Builder
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>Roster Role:</span>
            <select
              value={selectedDashboardRole}
              onChange={(e) => setSelectedDashboardRole(e.target.value as any)}
              style={{ padding: '6px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', background: 'var(--bg-white)', fontWeight: '700', color: 'var(--primary)' }}
            >
              <option value="MANAGING_PARTNER">Managing Partner</option>
              <option value="CA_PARTNER">CA / Partner</option>
              <option value="SENIOR_STAFF">Senior Staff</option>
              <option value="CLIENT">Client Portal view</option>
            </select>
          </div>
        </div>
      </div>

      {/* Primary tabs navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', overflowX: 'auto', gap: '4px' }}>
        {[
          { id: 'kpis', label: '📊 Executive Analytics & Drill-Down' },
          { id: 'library', label: '📁 Searchable Library' },
          { id: 'ai', label: '🤖 AI Report Builder' },
          { id: 'schedules', label: '📅 Recurrent Scheduler' },
          { id: 'history', label: '📜 Export Logs & Collaboration' },
          { id: 'whitelabel', label: '🎨 White-Label Preview' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '12px 18px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2.5px solid var(--primary)' : '2.5px solid transparent',
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

      {/* Tab Panels */}
      <div style={{ minHeight: '600px' }}>

        {/* ================= TAB 1: EXECUTIVE ANALYTICS ================= */}
        {activeTab === 'kpis' && (
          isEmptyStateActive ? (
            /* Empty State rendering */
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center', gap: '16px' }}>
              {/* Illustration suggest */}
              <div style={{ fontSize: '64px' }}>📊</div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary)' }}>Unified Business Intelligence Analytics</h3>
                <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '480px', margin: '8px auto 0', lineHeight: '1.5' }}>
                  Aggregates operational metadata from GST portals, payroll statutory runs, and corporate filings into professional charts and partner scorecards automatically.
                </p>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Provide complete drill-down access to raw transaction entries for human audits.
                </div>
              </div>
              <button
                onClick={() => setIsEmptyStateActive(false)}
                className="btn btn-primary"
                style={{ padding: '10px 24px', fontWeight: '700' }}
              >
                Generate First Report Dashboard
              </button>
            </div>
          ) : (
            /* Dashboard Renders */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* KPI grid cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--primary)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>TOTAL FIRM REVENUE</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', margin: '4px 0', color: 'var(--primary)' }}>
                    ₹{(kpiMetrics.revenueAmount / 100000).toFixed(2)} Lakhs
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--success)', fontWeight: '700' }}>
                    ▲ +{kpiMetrics.revenueChangePct}% vs last month
                  </div>
                </div>

                <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--success)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>NET OPERATING PROFIT</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', margin: '4px 0', color: 'var(--success)' }}>
                    ₹{(kpiMetrics.profitAmount / 100000).toFixed(2)} Lakhs
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--success)', fontWeight: '700' }}>
                    ▲ +{kpiMetrics.profitChangePct}% margin
                  </div>
                </div>

                <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--warning)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>OVERALL COMPLIANCE SCORE</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', margin: '4px 0', color: 'var(--primary)' }}>
                    {kpiMetrics.overallComplianceScore}%
                  </div>
                  <div style={{ height: '4px', background: 'var(--bg-gray)', borderRadius: '2px', overflow: 'hidden', marginTop: '6px' }}>
                    <div style={{ height: '100%', width: `${kpiMetrics.overallComplianceScore}%`, background: 'var(--success)' }} />
                  </div>
                </div>

                <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--info)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>STAFF PRODUCTIVITY SLA</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', margin: '4px 0', color: 'var(--primary)' }}>
                    {kpiMetrics.staffProductivityScore}%
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Avg Task turnaround: 2.4 days
                  </div>
                </div>

                <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--danger)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>PORTFOLIO RISK INDEX</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', margin: '4px 0', color: 'var(--danger)' }}>
                    {kpiMetrics.firmRiskScore}% Low Risk
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Only 2 penalty items open
                  </div>
                </div>
              </div>

              {/* Drill down interface */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '700' }}>🔍 Interactive Transaction Drill-Down Explorer</h3>
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    <UniversalStatusBadge status="Completed" />
                  </span>
                </div>

                {/* Breadcrumbs */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-light)', padding: '10px 14px', borderRadius: '6px', fontSize: '12.5px', overflowX: 'auto' }}>
                  {drillPath.map((nodeId, idx) => {
                    const node = MOCK_DRILLDOWN_DATA[nodeId];
                    return (
                      <React.Fragment key={nodeId}>
                        {idx > 0 && <span style={{ color: 'var(--text-light)' }}>➔</span>}
                        <button
                          onClick={() => handleBreadcrumbClick(idx)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: idx === drillPath.length - 1 ? 'var(--primary)' : 'var(--text-secondary)',
                            fontWeight: idx === drillPath.length - 1 ? '800' : '500',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {node ? node.label : nodeId}
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Drill view block */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', flexWrap: 'wrap' }}>
                  <div style={{ background: 'var(--bg-light)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>ACTIVE HIERARCHY LEVEL: {currentDrillNode.level}</span>
                      <span style={{ fontWeight: '800', color: 'var(--primary)' }}>{currentDrillNode.value}</span>
                    </div>

                    <h4 style={{ fontSize: '13px', fontWeight: '700' }}>Children Sub-directories:</h4>
                    
                    {currentDrillNode.children && currentDrillNode.children.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {currentDrillNode.children.map(childId => {
                          const childNode = MOCK_DRILLDOWN_DATA[childId];
                          if (!childNode) return null;
                          return (
                            <button
                              key={childId}
                              onClick={() => handleDrillClick(childId)}
                              style={{
                                padding: '12px',
                                background: '#ffffff',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                textAlign: 'left',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyItems: 'center',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'transform 0.15s ease'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(4px)'}
                              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(0)'}
                            >
                              <div>
                                <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--primary)' }}>{childNode.label}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Level: {childNode.level}</div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '12px', fontWeight: '700' }}>{childNode.value}</span>
                                <span style={{ color: 'var(--text-light)' }}>➔</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                        🏁 Terminal leaf node reached. All source details listed in metadata console.
                      </div>
                    )}
                  </div>

                  {/* Metadata Details panel */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div className="card" style={{ background: 'var(--bg-white)', padding: '16px' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '10px', color: 'var(--primary)' }}>
                        📝 Selected Level Metadata
                      </h4>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block' }}>NODE TITLE:</span>
                          <b>{currentDrillNode.label}</b>
                        </div>

                        {currentDrillNode.details && Object.keys(currentDrillNode.details).map(key => (
                          <div key={key}>
                            <span style={{ color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>{key}:</span>
                            <span style={{ fontFamily: key.includes('Hash') || key.includes('GSTIN') ? 'monospace' : 'inherit' }}>
                              <b>{currentDrillNode.details![key]}</b>
                            </span>
                          </div>
                        ))}
                      </div>
                      
                      {drillPath.length > 1 && (
                        <button
                          onClick={() => setDrillPath(['root'])}
                          style={{ marginTop: '16px', width: '100%', padding: '6px', background: 'none', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: '700' }}
                        >
                          ↩ Reset back to Root Summary
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        )}

        {/* ================= TAB 2: SEARCHABLE LIBRARY ================= */}
        {activeTab === 'library' && (
          isEmptyStateActive ? (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center', gap: '16px' }}>
              <div style={{ fontSize: '64px' }}>📁</div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary)' }}>Roster Templates Library Empty</h3>
                <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '450px', margin: '8px auto 0' }}>
                  Search and run regulatory reports for GST reconcilements, payroll deductions, and audit sampling. Click primary CTA to initialize.
                </p>
              </div>
              <button
                onClick={() => setIsEmptyStateActive(false)}
                className="btn btn-primary"
              >
                Load Roster Templates
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
              {/* Library list */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Search templates, regulations, schedules..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-light)' }}
                    />
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value as any)}
                      style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)', fontWeight: '600' }}
                    >
                      <option value="ALL">All Categories</option>
                      <option value="GST">GST Reports</option>
                      <option value="INCOME_TAX">Income Tax</option>
                      <option value="AUDIT">Audit Desk</option>
                      <option value="PAYROLL">Payroll Statutory</option>
                      <option value="COMPLIANCE">Compliance Calendar</option>
                      <option value="PRACTICE">Practice scorecards</option>
                      <option value="AI">AI Forensics</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto' }}>
                  {filteredReports.map(rep => (
                    <button
                      key={rep.id}
                      onClick={() => setSelectedReportId(rep.id)}
                      style={{
                        padding: '12px',
                        background: selectedReportId === rep.id ? 'var(--primary-light)' : 'var(--bg-white)',
                        border: selectedReportId === rep.id ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                        borderRadius: '8px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: '700', fontSize: '13px', color: selectedReportId === rep.id ? 'var(--primary)' : 'var(--text-primary)' }}>
                            {rep.name}
                          </span>
                          {rep.isTrending && <span className="badge badge-warning" style={{ fontSize: '8px', padding: '1px 4px' }}>Trending</span>}
                          {rep.isNew && <span className="badge badge-success" style={{ fontSize: '8px', padding: '1px 4px' }}>New</span>}
                        </div>
                        <span 
                          onClick={(e) => {
                            e.stopPropagation();
                            setReportLibrary(prev => prev.map(r => r.id === rep.id ? { ...r, isFavorite: !r.isFavorite } : r));
                          }}
                          style={{ fontSize: '14px', cursor: 'pointer', color: rep.isFavorite ? 'var(--gold)' : 'var(--text-light)' }}
                          title="Toggle Favorite"
                        >
                          ★
                        </span>
                      </div>

                      <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{rep.description}</p>
                      
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {rep.tags.map(t => (
                          <span key={t} className="badge badge-gray" style={{ fontSize: '8px', padding: '1px 4px' }}>{t}</span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter builder & Run Export pane */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', color: 'var(--primary)' }}>
                  ⚙️ Filter Options & Document Export Compiler
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>FINANCIAL YEAR</label>
                    <select
                      value={filterFY}
                      onChange={(e) => setFilterFY(e.target.value)}
                      style={{ padding: '6px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', background: 'var(--bg-light)' }}
                    >
                      <option value="FY 2026-27">FY 2026-27 (Current)</option>
                      <option value="FY 2025-26">FY 2025-26 (Audit period)</option>
                      <option value="FY 2024-25">FY 2024-25</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>CLIENT SCOPE GROUP</label>
                    <select
                      value={filterClientGroup}
                      onChange={(e) => setFilterClientGroup(e.target.value)}
                      style={{ padding: '6px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', background: 'var(--bg-light)' }}
                    >
                      <option value="ALL">All Portfolios (140 clients)</option>
                      <option value="MSME">MSME suppliers only</option>
                      <option value="PVT_LTD">Private Limited Corporations</option>
                      <option value="LLP">LLP Partner Desks</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>WATERMARK OVERRIDE STRING</label>
                  <input
                    type="text"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    style={{ padding: '6px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', background: 'var(--bg-light)' }}
                  />
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px' }}>
                  <h4 style={{ fontSize: '12.5px', fontWeight: '700', marginBottom: '8px' }}>🔒 Export Safety & Formatting</h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '12px', fontWeight: '700' }}>OUTPUT FORMAT</label>
                      <select
                        value={exportFormat}
                        onChange={(e) => setExportFormat(e.target.value as any)}
                        style={{ padding: '4px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', background: 'var(--bg-light)', fontWeight: '700' }}
                      >
                        <option value="PDF">PDF Document</option>
                        <option value="EXCEL">Excel Worksheet (.xlsx)</option>
                        <option value="CSV">Comma Separated CSV</option>
                        <option value="JSON">Raw JSON Payload</option>
                        <option value="ZIP">ZIP Archive Locker</option>
                      </select>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px' }}>
                      <input
                        type="checkbox"
                        checked={passwordProtection}
                        onChange={(e) => setPasswordProtection(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span>Encrypt with Password Lock</span>
                    </label>

                    {passwordProtection && (
                      <input
                        type="password"
                        value={exportPassword}
                        onChange={(e) => setExportPassword(e.target.value)}
                        placeholder="Password"
                        style={{ padding: '6px', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '12px', width: '200px', marginLeft: '22px' }}
                      />
                    )}

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px' }}>
                      <input
                        type="checkbox"
                        checked={digitalSigning}
                        onChange={(e) => setDigitalSigning(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span>Attach Cryptographic Digital Signature Certs</span>
                    </label>
                  </div>
                </div>

                {compilingExport ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                    <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      <span>Compiling dataset blocks...</span>
                      <span>{compileProgress}%</span>
                    </div>
                    <div style={{ height: '6px', background: 'var(--bg-gray)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${compileProgress}%`, background: 'var(--primary)', transition: 'width 0.2s ease' }} />
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleTriggerExport}
                    className="btn btn-primary"
                    style={{ marginTop: '10px', width: '100%', display: 'flex', justifyItems: 'center', justifyContent: 'center' }}
                  >
                    🚀 Run Report & Generate Export
                  </button>
                )}
              </div>
            </div>
          )
        )}

        {/* ================= TAB 3: AI REPORT BUILDER & FALLBACK ================= */}
        {activeTab === 'ai' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
            
            {/* Left Col: Query and Table */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700' }}>
                  🤖 AI Copilot Statutory Report Generator
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setSimulatedAiError(!simulatedAiError);
                    setAiReportData(null);
                    setManualReportData(null);
                  }}
                  className={`btn btn-sm ${simulatedAiError ? 'btn-success' : 'btn-secondary'}`}
                  style={{ fontSize: '11px', fontWeight: '700' }}
                >
                  {simulatedAiError ? '✔ AI Connected' : '⚡ Simulate AI Outage'}
                </button>
              </div>

              {/* Simulated AI Fallback error display */}
              {simulatedAiError && (
                <div style={{
                  padding: '16px',
                  backgroundColor: '#FFFBEB',
                  border: '1.5px solid #FCD34D',
                  borderLeft: '5px solid #D97706',
                  borderRadius: '8px',
                  fontSize: '13px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', fontWeight: '700', color: '#B45309' }}>
                    <span>🚨 AI Fallback State Triggered</span>
                    <span style={{ fontSize: '10.5px', background: '#FEF3C7', padding: '2px 6px', borderRadius: '4px' }}>Error: private_model_timeout</span>
                  </div>
                  <div>
                    <b>Reason:</b> Private LLM model pipeline timed out after 15,000ms latency limits.
                  </div>
                  <div>
                    <b>Manual Alternative:</b> Please compile parameters manually using the visual query schema selector below. No data was fabricated.
                  </div>
                  
                  <div style={{ borderTop: '1px solid #FCD34D', paddingTop: '10px', marginTop: '4px', display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setSimulatedAiError(false)}
                      style={{ padding: '6px 12px', background: '#D97706', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '700', fontSize: '11px' }}
                    >
                      🔁 Retry AI Connection
                    </button>
                    <span style={{ fontSize: '11px', color: '#6B7280', alignSelf: 'center' }}>
                      (Human overrides permitted)
                    </span>
                  </div>

                  {/* Learning feedback inputs */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                    <label style={{ fontSize: '10px', color: '#B45309', fontWeight: '700' }}>AI ENGINE LEARNING FEEDBACK LOOP</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        placeholder="What query failed? Describe expectations..."
                        value={manualFeedbackText}
                        onChange={(e) => setManualFeedbackText(e.target.value)}
                        style={{ flex: 1, padding: '6px', border: '1px solid #FCD34D', borderRadius: '4px', fontSize: '11.5px' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          alert(`Feedback log processed: "${manualFeedbackText}". AI training queue updated.`);
                          setManualFeedbackText('');
                        }}
                        style={{ padding: '6px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}
                      >
                        Submit
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {!simulatedAiError ? (
                <form onSubmit={handleTriggerAISubmit} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Ask AI e.g. 'Show clients with overdue filings' or 'Top billings'..."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-light)' }}
                    disabled={generatingAI}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={generatingAI}
                  >
                    {generatingAI ? 'Building...' : 'Build Report'}
                  </button>
                </form>
              ) : (
                /* Manual Fallback form builder */
                <form onSubmit={handleManualReportCompile} style={{
                  padding: '16px',
                  background: 'var(--bg-light)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--primary)' }}>🔨 Manual Report Configuration</div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>DATABASE SOURCE TABLE</label>
                      <input
                        type="text"
                        value={manualReportConfig.tableName}
                        onChange={(e) => setManualReportConfig({ ...manualReportConfig, tableName: e.target.value })}
                        style={{ padding: '6px', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '12px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>SORT COLUMN</label>
                      <select
                        value={manualReportConfig.sortBy}
                        onChange={(e) => setManualReportConfig({ ...manualReportConfig, sortBy: e.target.value })}
                        style={{ padding: '6px', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '12px', background: '#fff' }}
                      >
                        <option value="due_date">Due Date</option>
                        <option value="client_name">Client Name</option>
                        <option value="tax_due">Tax Owed</option>
                      </select>
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>
                    Compile Manual Ledger
                  </button>
                </form>
              )}

              {/* Prompt Suggestions */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {[
                  'Show clients with overdue filings.',
                  'Generate revenue client scorecard.',
                  'GST compliance report for FY25.'
                ].map(suggest => (
                  <button
                    key={suggest}
                    type="button"
                    onClick={() => {
                      setAiPrompt(suggest);
                    }}
                    style={{ padding: '4px 10px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '20px', fontSize: '11px', cursor: 'pointer', color: 'var(--primary)', fontWeight: '600' }}
                  >
                    "{suggest}"
                  </button>
                ))}
              </div>

              {/* Renders table based on state */}
              {aiReportData && !simulatedAiError && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
                  <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <h4 style={{ fontWeight: '700', fontSize: '14px', color: 'var(--primary)' }}>{aiReportData.title}</h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{aiReportData.explanation}</p>
                  </div>

                  <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-light)' }}>
                          {aiReportData.headers.map(head => (
                            <th key={head} style={{ padding: '8px' }}>{head}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {aiReportData.rows.map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--bg-gray)' }}>
                            {aiReportData.headers.map(head => (
                              <td key={head} style={{ padding: '8px' }}>{String(row[head])}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '11px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Database Sources Queried:</span>
                    {aiReportData.sources.map(src => (
                      <span key={src} className="badge badge-gray" style={{ fontSize: '8px' }}>{src}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual Output table */}
              {simulatedAiError && manualReportData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                  <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--primary)' }}>📋 Compiled Manual Results Table:</div>
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-light)' }}>
                          <th style={{ padding: '8px' }}>Client Name</th>
                          <th style={{ padding: '8px' }}>GSTIN</th>
                          <th style={{ padding: '8px' }}>Tax Due</th>
                          <th style={{ padding: '8px' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {manualReportData.map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--bg-gray)' }}>
                            <td style={{ padding: '8px' }}>{row.client_name}</td>
                            <td style={{ padding: '8px', fontFamily: 'monospace' }}>{row.gstin}</td>
                            <td style={{ padding: '8px' }}>{row.tax_due}</td>
                            <td style={{ padding: '8px' }}>
                              <UniversalStatusBadge status={row.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {generatingAI && (
                <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px', animation: 'spin 1.5s linear infinite' }}>⏳</div>
                  <div style={{ fontSize: '13px', fontWeight: '700' }}>AI parsing raw tables and aggregating cash flows...</div>
                </div>
              )}
            </div>

            {/* Right Col: AI Visual language accents */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{
                background: '#F5F3FF', // AI Light Background
                border: '1px solid #DDD6FE',
                borderLeft: '4px solid #7C3AED', // AI Purple Left Border
                borderRadius: '12px',
                padding: '24px',
                boxShadow: 'var(--shadow)',
                position: 'relative'
              }}>
                {/* AI Sparkles badge */}
                <div style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: '#7C3AED',
                  color: '#fff',
                  fontSize: '9.5px',
                  fontWeight: '800',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span>✨ AI SUGGESTION</span>
                </div>

                <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#5B21B6', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  ✨ AI Actionable Insights Desk
                </h3>
                
                <p style={{ fontSize: '12px', color: '#6D28D9', lineHeight: '1.5', marginBottom: '14px' }}>
                  These suggestions are automatically derived from timesheet logs, tax due summaries, and past compliance scores.
                </p>

                {aiReportData ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: '#7C3AED', fontWeight: '800', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.05em' }}>
                        Analytical Insights
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {aiReportData.insights.map((ins, idx) => (
                          <div
                            key={idx}
                            title="Suggested by AI. Click to accept or modify."
                            style={{ padding: '8px 12px', background: '#ffffff', border: '1px solid #DDD6FE', borderRadius: '6px', fontSize: '11.5px', color: '#4C1D95', cursor: 'help' }}
                          >
                            💡 {ins}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '10px', color: '#7C3AED', fontWeight: '800', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.05em' }}>
                        Recommended Tasks
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {aiReportData.recommendations.map((rec, idx) => (
                          <div
                            key={idx}
                            title="Suggested by AI. Click to accept or modify."
                            style={{ padding: '8px 12px', background: '#ffffff', border: '1.5px solid #22C55E', borderRadius: '6px', fontSize: '11.5px', color: '#14532D', cursor: 'help' }}
                          >
                            ✔ {rec}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#6D28D9', fontStyle: 'italic' }}>
                    No AI insights currently generated. Run an AI prompt query to initialize analytics pipelines.
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* ================= TAB 4: RECURRENT SCHEDULER ================= */}
        {activeTab === 'schedules' && (
          isEmptyStateActive ? (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center', gap: '16px' }}>
              <div style={{ fontSize: '64px' }}>📅</div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary)' }}>No Scheduled Dispatches</h3>
                <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '450px', margin: '8px auto 0' }}>
                  No recurrences have been scheduled. Set dispatches for weekly client emails or monthly partner digests.
                </p>
              </div>
              <button
                onClick={() => setIsEmptyStateActive(false)}
                className="btn btn-primary"
              >
                Set First Schedule
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
              {/* Active Schedules List */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  📅 Recurrent Report Dispatches
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {scheduledLogs.map(sdl => (
                    <div key={sdl.id} style={{ padding: '14px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '800', fontSize: '13.5px', color: 'var(--primary)' }}>{sdl.reportName}</span>
                        <UniversalStatusBadge status={sdl.status} />
                      </div>

                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Interval: <b>{sdl.frequency}</b> | Channels: <b>{sdl.channels.join(', ')}</b>
                      </div>

                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Recipients: <i>{sdl.recipients.join(', ')}</i>
                      </div>

                      <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '6px', fontSize: '10.5px' }}>
                        <span style={{ color: 'var(--text-light)' }}>Last trigger: {sdl.timestamp}</span>
                        {sdl.status === 'FAILED' && (
                          <button
                            onClick={() => {
                              alert('Retrying dispatch immediately...');
                              setScheduledLogs(prev => prev.map(item => item.id === sdl.id ? { ...item, status: 'DELIVERED', retryCount: 0 } : item));
                            }}
                            style={{ border: 'none', background: 'none', color: 'var(--primary)', fontWeight: '800', cursor: 'pointer' }}
                          >
                            Trigger Manual Retry ({sdl.retryCount}/3 retries failed)
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recurrence Setup Form */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', color: 'var(--primary)' }}>
                  ⏰ Setup Scheduled Distribution
                </h3>

                <form onSubmit={handleCreateSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>REPORT TO SCHEDULE</label>
                    <select
                      value={newSchedule.reportId}
                      onChange={(e) => setNewSchedule({ ...newSchedule, reportId: e.target.value })}
                      style={{ padding: '6px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', background: 'var(--bg-light)', fontWeight: '600' }}
                    >
                      {reportLibrary.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>DISPATCH INTERVAL</label>
                      <select
                        value={newSchedule.frequency}
                        onChange={(e) => {
                          const freq = e.target.value;
                          let cron = '0 0 1 * *';
                          if (freq === 'DAILY') cron = '0 9 * * *';
                          if (freq === 'WEEKLY') cron = '0 9 * * 1';
                          if (freq === 'MONTHLY') cron = '0 0 1 * *';
                          if (freq === 'QUARTERLY') cron = '0 0 1 */3 *';
                          setNewSchedule({ ...newSchedule, frequency: freq, cronExpression: cron });
                        }}
                        style={{ padding: '6px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', background: 'var(--bg-light)' }}
                      >
                        <option value="DAILY">Daily (9:00 AM)</option>
                        <option value="WEEKLY">Weekly (Monday 9:00 AM)</option>
                        <option value="MONTHLY">Monthly (1st at 12:00 AM)</option>
                        <option value="QUARTERLY">Quarterly (1st month Qrt)</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>CRON SPECIFICATION</label>
                      <input
                        type="text"
                        value={newSchedule.cronExpression}
                        onChange={(e) => setNewSchedule({ ...newSchedule, cronExpression: e.target.value })}
                        style={{ padding: '6px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', background: 'var(--bg-light)', fontFamily: 'monospace' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>RECIPIENTS (COMMA SEPARATED)</label>
                    <input
                      type="text"
                      value={newSchedule.recipientRaw}
                      onChange={(e) => setNewSchedule({ ...newSchedule, recipientRaw: e.target.value })}
                      style={{ padding: '6px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', background: 'var(--bg-light)' }}
                      required
                    />
                  </div>

                  {/* Delivery Channels */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '4px 0' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>DELIVERY CHANNELS</label>
                    
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px' }}>
                        <input
                          type="checkbox"
                          checked={newSchedule.channelEmail}
                          onChange={(e) => setNewSchedule({ ...newSchedule, channelEmail: e.target.checked })}
                        />
                        <span>Email Delivery</span>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px' }}>
                        <input
                          type="checkbox"
                          checked={newSchedule.channelWhatsApp}
                          onChange={(e) => setNewSchedule({ ...newSchedule, channelWhatsApp: e.target.checked })}
                        />
                        <span>WhatsApp Notify</span>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px' }}>
                        <input
                          type="checkbox"
                          checked={newSchedule.channelPortal}
                          onChange={(e) => setNewSchedule({ ...newSchedule, channelPortal: e.target.checked })}
                        />
                        <span>Portal Locker</span>
                      </label>
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', marginTop: '6px' }}>
                    Lock Recurrence Dispatch
                  </button>
                </form>
              </div>
            </div>
          )
        )}

        {/* ================= TAB 5: EXPORT LOGS & COLLABORATION ================= */}
        {activeTab === 'history' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
            {/* Export log list */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                📜 Audit Logs & Generated Exports
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {exportsList.map(log => (
                  <div key={log.id} style={{ padding: '12px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12.5px', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '700', color: 'var(--primary)' }}>{log.reportName}</span>
                      <UniversalStatusBadge status={log.format === 'PDF' ? 'Completed' : 'Under Review'} />
                    </div>

                    <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      <span>Size: <b>{log.size}</b></span>
                      <span>Run Time: <b>{log.timestamp}</b></span>
                    </div>

                    {log.signedHash && (
                      <div style={{ fontFamily: 'monospace', fontSize: '9.5px', color: 'var(--success)', marginTop: '4px' }}>
                        ✔ SHA-256 Digitally Signed: {log.signedHash.slice(0, 24)}...
                      </div>
                    )}
                    {log.encryption && (
                      <div style={{ fontSize: '10px', color: 'var(--primary)', marginTop: '2px' }}>
                        🔒 Encrypted Block Lock: {log.encryption}
                      </div>
                    )}

                    <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '8px', paddingTop: '6px', display: 'flex', justifyItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Path: {log.path}</span>
                      
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => {
                            setSelectedExportForShare(log);
                            setShowShareModal(true);
                          }}
                          style={{ border: 'none', background: 'none', color: 'var(--primary)', fontWeight: '700', cursor: 'pointer', fontSize: '11px' }}
                        >
                          🔗 Share Lock
                        </button>
                        <button
                          onClick={() => alert(`Initiating mock file download from local storage: ${log.path}`)}
                          style={{ border: 'none', background: 'none', color: 'var(--success)', fontWeight: '700', cursor: 'pointer', fontSize: '11px' }}
                        >
                          📥 Download
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Comment Annotations pane */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', color: 'var(--primary)' }}>
                💬 Report Collaboration & Review Annotations
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
                {reportComments.map(comm => (
                  <div key={comm.id} style={{ padding: '10px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <b>{comm.user}</b>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{comm.date.split(' ')[1] + ' ' + comm.date.split(' ')[2]}</span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: '1.4' }}>{comm.text}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddComment} style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <textarea
                  rows={3}
                  placeholder="Write a comment or highlight audit notes to client..."
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)', resize: 'vertical' }}
                  required
                />
                <button type="submit" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>
                  Post Comment Note
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ================= TAB 6: WHITE-LABEL PREVIEW ================= */}
        {activeTab === 'whitelabel' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px' }}>
            {/* Design Controls */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                🎨 Export PDF Branding Configurator
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>PRIMARY HIGHLIGHT COLOR</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={whiteLabelColors.primary}
                    onChange={(e) => setWhiteLabelColors({ ...whiteLabelColors, primary: e.target.value })}
                    style={{ border: 'none', width: '36px', height: '36px', borderRadius: '4px', cursor: 'pointer' }}
                  />
                  <span>{whiteLabelColors.primary}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>SECONDARY HIGHLIGHT COLOR</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={whiteLabelColors.secondary}
                    onChange={(e) => setWhiteLabelColors({ ...whiteLabelColors, secondary: e.target.value })}
                    style={{ border: 'none', width: '36px', height: '36px', borderRadius: '4px', cursor: 'pointer' }}
                  />
                  <span>{whiteLabelColors.secondary}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>FOOTER NOTE TEXT</label>
                <textarea
                  rows={2}
                  value={whiteLabelColors.footerText}
                  onChange={(e) => setWhiteLabelColors({ ...whiteLabelColors, footerText: e.target.value })}
                  style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', background: 'var(--bg-light)' }}
                />
              </div>

              <button
                onClick={() => alert('Export custom layout templates updated.')}
                className="btn btn-primary"
                style={{ alignSelf: 'flex-start', marginTop: '6px' }}
              >
                Save Layout Configuration
              </button>
            </div>

            {/* Generated PDF Wireframe preview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  📄 White-Labeled Export Document Preview
                </h3>

                <div style={{
                  background: '#ffffff',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '24px',
                  color: '#111827',
                  minHeight: '380px',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {/* Diagonal Watermark String */}
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%) rotate(-30deg)',
                    color: 'rgba(0,0,0,0.04)',
                    fontSize: '34px',
                    fontWeight: '800',
                    fontFamily: 'sans-serif',
                    letterSpacing: '0.1em',
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                    textTransform: 'uppercase'
                  }}>
                    {watermarkText}
                  </div>

                  <div>
                    {/* Header */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: `2.5px solid ${whiteLabelColors.primary}`,
                      paddingBottom: '8px',
                      marginBottom: '14px'
                    }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: whiteLabelColors.primary }}>
                          CA OS CLIENT ADVISORY
                        </div>
                        <span style={{ fontSize: '9px', color: '#9ca3af' }}>Firm ID: CA-OS-MUM-01</span>
                      </div>
                      
                      <div style={{ fontSize: '9px', color: '#6b7280', textAlign: 'right' }}>
                        Ref: FY27/RPT/0912<br />
                        Date: {new Date().toLocaleDateString()}
                      </div>
                    </div>

                    {/* Chart wireframe visualization preview */}
                    <div>
                      <div style={{ textAlign: 'center', fontSize: '11px', color: whiteLabelColors.primary, fontWeight: '700', marginBottom: '12px' }}>
                        GSTR-1 VS GSTR-3B OUTWARD RECONCILIATION
                      </div>

                      {/* Mock Chart representation */}
                      <div style={{
                        height: '140px',
                        background: '#f9fafb',
                        border: '1.5px dashed #e5e7eb',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'space-around',
                        padding: '16px',
                        position: 'relative'
                      }}>
                        {/* Bar 1 */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ width: '20px', height: '90px', background: whiteLabelColors.primary, borderRadius: '3px 3px 0 0' }} />
                          <span style={{ fontSize: '8px', marginTop: '4px', color: '#6b7280' }}>Apr</span>
                        </div>
                        {/* Bar 2 */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ width: '20px', height: '110px', background: whiteLabelColors.primary, borderRadius: '3px 3px 0 0' }} />
                          <span style={{ fontSize: '8px', marginTop: '4px', color: '#6b7280' }}>May</span>
                        </div>
                        {/* Bar 3 */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ width: '20px', height: '100px', background: whiteLabelColors.secondary, borderRadius: '3px 3px 0 0' }} />
                          <span style={{ fontSize: '8px', marginTop: '4px', color: '#6b7280' }}>Jun</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{
                    borderTop: '1px solid #e5e7eb',
                    paddingTop: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '9px',
                    color: '#6b7280'
                  }}>
                    <span>{whiteLabelColors.footerText}</span>
                    <span style={{ fontWeight: '700' }}>Page 1 of 1</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Share settings Locker Modal */}
      {showShareModal && selectedExportForShare && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ background: 'var(--bg-white)', width: '440px', padding: '24px', position: 'relative' }}>
            <button
              onClick={() => {
                setShowShareModal(false);
                setGeneratedShareLink('');
              }}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer' }}
            >
              ✖
            </button>

            <h3 style={{ fontSize: '15px', fontWeight: '800', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '14px', color: 'var(--primary)' }}>
              🔗 External Secure Shared Lock
            </h3>
            
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Generate custom URL token with security overrides for file: <b>{selectedExportForShare.reportName}</b>
            </p>

            <form onSubmit={handleGenerateShareLink} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>LINK EXPIRY RETENTION</label>
                <select
                  value={shareExpiry}
                  onChange={(e) => setShareExpiry(e.target.value as any)}
                  style={{ padding: '4px', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '12px', background: 'var(--bg-light)' }}
                >
                  <option value="24H">24 Hours</option>
                  <option value="7D">7 Days</option>
                  <option value="30D">30 Days</option>
                </select>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px' }}>
                <input
                  type="checkbox"
                  checked={sharePasswordLocked}
                  onChange={(e) => setSharePasswordLocked(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>Force access password check</span>
              </label>

              {sharePasswordLocked && (
                <input
                  type="text"
                  value={sharePassword}
                  onChange={(e) => setSharePassword(e.target.value)}
                  placeholder="Enter Link Password"
                  style={{ padding: '6px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', width: '200px', marginLeft: '22px' }}
                />
              )}

              {!generatedShareLink ? (
                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '6px' }}>
                  Generate Secure Token Link
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>SECURE EXPORT SHARE LINK</span>
                    <input
                      type="text"
                      readOnly
                      value={generatedShareLink}
                      style={{ padding: '8px', border: '1.5px solid var(--primary)', borderRadius: '6px', fontSize: '12px', background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: '600' }}
                    />
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedShareLink);
                        alert('Link copied to clipboard.');
                      }}
                      className="btn btn-sm btn-primary"
                    >
                      Copy Link
                    </button>
                    <button
                      type="button"
                      onClick={() => alert('Simulated QR Code generated and emailed to client.')}
                      className="btn btn-sm btn-secondary"
                    >
                      Generate QR Code
                    </button>
                  </div>

                  {/* Access log details */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', display: 'block', marginBottom: '6px' }}>LINK VISITOR ACCESS LOGS</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10.5px' }}>
                      {simulatedAccessLogs.map((log, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', padding: '4px', background: 'var(--bg-light)', borderRadius: '4px' }}>
                          <span>IP: {log.ip} ({log.location})</span>
                          <span>{log.timestamp}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Desktop-Only Warning Overlay */}
      {showDesktopBlocker && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '24px',
          color: '#ffffff',
          textAlign: 'center'
        }}>
          <div style={{
            background: 'var(--bg-white)',
            color: 'var(--text-primary)',
            padding: '40px 24px',
            borderRadius: '12px',
            maxWidth: '380px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            alignItems: 'center',
            boxShadow: 'var(--shadow-md)'
          }}>
            <div style={{ fontSize: '48px' }}>💻</div>
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--primary)' }}>Desktop Platform Required</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              “Please use a desktop device for the best experience.”
            </p>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
              Statistical tools and advanced multi-dimensional report customizers operate only on larger desktop display monitors.
            </p>
            <button
              onClick={() => setShowDesktopBlocker(false)}
              className="btn btn-primary"
              style={{ width: '100%', padding: '10px' }}
            >
              Close Blocker Warning
            </button>
          </div>
        </div>
      )}

      {/* Mobile-Only Bottom Navigation chip bar simulated */}
      {isMobile && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'var(--bg-white)',
          borderTop: '1.5px solid var(--border-color)',
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          height: '60px',
          zIndex: 50,
          boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
        }}>
          {[
            { label: 'Dashboard', icon: '📊' },
            { label: 'Clients', icon: '👥' },
            { label: 'Documents', icon: '📁' },
            { label: 'Tasks', icon: '✓' },
            { label: 'Notifications', icon: '🔔' }
          ].map(item => (
            <button
              key={item.label}
              onClick={() => alert(`Simulated Mobile Nav: Go to ${item.label}`)}
              style={{
                background: 'none',
                border: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                cursor: 'pointer',
                minWidth: '44px',
                minHeight: '44px' // Standard min target compliance 44x44
              }}
            >
              <span style={{ fontSize: '18px' }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}

    </div>
  );
}
