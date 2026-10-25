'use client';

import React, { useState, useEffect } from 'react';
import { 
  MOCK_STAFF_CAPACITY, 
  MOCK_CLIENT_HISTORY, 
  get30_60_90DayForecast, 
  generateSmartWorkloadRecommendations,
  predictClientDelayRisk
} from '@/lib/compliance/CompliancePredictionEngine';

// Color Mapping for Categories
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  GST: { bg: 'rgba(16, 185, 129, 0.1)', text: 'rgb(16, 185, 129)', border: 'rgba(16, 185, 129, 0.2)' },
  INCOME_TAX: { bg: 'rgba(59, 130, 246, 0.1)', text: 'rgb(59, 130, 246)', border: 'rgba(59, 130, 246, 0.2)' },
  TDS: { bg: 'rgba(139, 92, 246, 0.1)', text: 'rgb(139, 92, 246)', border: 'rgba(139, 92, 246, 0.2)' },
  ROC: { bg: 'rgba(245, 158, 11, 0.1)', text: 'rgb(245, 158, 11)', border: 'rgba(245, 158, 11, 0.2)' },
  PF_ESI: { bg: 'rgba(239, 68, 68, 0.1)', text: 'rgb(239, 68, 68)', border: 'rgba(239, 68, 68, 0.2)' },
  PT: { bg: 'rgba(6, 182, 212, 0.1)', text: 'rgb(6, 182, 212)', border: 'rgba(6, 182, 212, 0.2)' },
  CUSTOM: { bg: 'rgba(107, 114, 128, 0.1)', text: 'rgb(107, 114, 128)', border: 'rgba(107, 114, 128, 0.2)' }
};

const MOCK_COMPANIES: Array<{ id: string; name: string }> = [
  { id: 'c1', name: 'Aegis Infotech Private Limited' },
  { id: 'c2', name: 'Zylos Pharma Limited' },
  { id: 'c3', name: 'Vortex Logistics LLP' }
];

// Initial Mock Datasets
const MOCK_EVENTS = [
  { id: 'ev1', title: 'GSTR-3B Return Filing', category: 'GST', dueDate: '2026-06-20', companyId: 'c1', companyName: 'Aegis Infotech', status: 'PENDING', assignedTo: 'Neha Roy' },
  { id: 'ev2', title: 'TDS Monthly Deposit (Section 192)', category: 'TDS', dueDate: '2026-07-07', companyId: 'c1', companyName: 'Aegis Infotech', status: 'PENDING', assignedTo: 'Priya Sharma' },
  { id: 'ev3', title: 'ITR-6 Tax Return Submission', category: 'INCOME_TAX', dueDate: '2026-07-31', companyId: 'c2', companyName: 'Zylos Pharma', status: 'PENDING', assignedTo: 'Priya Sharma' },
  { id: 'ev4', title: 'Form ADT-1 Auditor Appointment', category: 'ROC', dueDate: '2026-09-15', companyId: 'c1', companyName: 'Aegis Infotech', status: 'COMPLETED', assignedTo: 'Rohan Mehta' },
  { id: 'ev5', title: 'EPF ECR Filing & Challan Pay', category: 'PF_ESI', dueDate: '2026-06-15', companyId: 'c2', companyName: 'Zylos Pharma', status: 'OVERDUE', assignedTo: 'Rohan Mehta' },
  { id: 'ev6', title: 'Monthly Professional Tax (Form 5)', category: 'PT', dueDate: '2026-06-30', companyId: 'c1', companyName: 'Aegis Infotech', status: 'PENDING', assignedTo: 'Amit Verma' }
];

const MOCK_EXTENSIONS = [
  { id: 'ext1', title: 'GSTR-3B Extension Circular 44/2026', category: 'GST', originalDueDate: '2026-05-20', extendedDueDate: '2026-05-27', status: 'APPLIED' }
];

const MOCK_ALERTS = [
  { id: 'a1', title: 'GSTR-3B Due in 5 Days', description: 'GSTR-3B return due on 2026-06-20 for 30 clients.', time: 'Today, 09:00 AM', status: 'SENT', channel: 'WhatsApp' },
  { id: 'a2', title: 'EPF Payment Overdue (24h)', description: 'Challan generation pending for Zylos Pharma.', time: 'Yesterday, 06:30 PM', status: 'SNOOZED', channel: 'SMS' }
];

export default function ComplianceIntelCenter({ simulateEmpty = false }: { simulateEmpty?: boolean }) {
  const [activeTab, setActiveTab] = useState<'calendar' | 'alerts' | 'health' | 'capacity' | 'extensions' | 'copilot'>('calendar');
  const [events, setEvents] = useState(MOCK_EVENTS);
  const [alerts, setAlerts] = useState(MOCK_ALERTS);
  const [extensions, setExtensions] = useState(MOCK_EXTENSIONS);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStaff, setSelectedStaff] = useState<string>('ALL');

  // Client filter
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('ALL');

  // Filtered Events
  const filteredEvents = events.filter(evt => {
    const categoryMatch = selectedCategory === 'ALL' || evt.category === selectedCategory;
    const staffMatch = selectedStaff === 'ALL' || evt.assignedTo === selectedStaff;
    const clientMatch = selectedCompanyId === 'ALL' || evt.companyId === selectedCompanyId;
    return categoryMatch && staffMatch && clientMatch;
  });

  // Calculate stats
  const totalDeadlines = events.length;
  const overdueCount = events.filter(e => e.status === 'OVERDUE').length;
  const completedCount = events.filter(e => e.status === 'COMPLETED').length;
  const pendingCount = events.filter(e => e.status === 'PENDING').length;

  // 1. Calendar view state (Simulating Day/Week/Month grid)
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'day'>('month');

  // 2. Automated Alerts snoozing/acknowledgement
  const handleSnoozeAlert = (id: string, hours: number) => {
    setAlerts(alerts.map(a => a.id === id ? { ...a, status: 'SNOOZED', description: `${a.description} (Snoozed for ${hours}h)` } : a));
    alert(`Alert snoozed for ${hours} hours.`);
  };

  const handleAcknowledgeAlert = (id: string) => {
    setAlerts(alerts.map(a => a.id === id ? { ...a, status: 'ACKNOWLEDGED' } : a));
  };

  // 3. Client Health calculations
  // Weights: GST=25%, TDS=20%, Income Tax=15%, ROC=15%, PF/ESI=10%, Document Submission=10%, Notice Response=5%
  const calculateClientHealth = (companyId: string) => {
    const clientEvents = events.filter(e => e.companyId === companyId);
    const completed = clientEvents.filter(e => e.status === 'COMPLETED').length;
    const total = clientEvents.length;

    // Simulated weights scoring
    let gstScore = 95;
    let tdsScore = 90;
    let itrScore = 85;
    let rocScore = 100;
    let pfEsiScore = companyId === 'c2' ? 40 : 90; // c2 has overdue PF ESI
    let docScore = companyId === 'c2' ? 50 : 90; // c2 has doc delay
    let noticeScore = 95;

    const weightedScore = Math.round(
      (gstScore * 0.25) +
      (tdsScore * 0.20) +
      (itrScore * 0.15) +
      (rocScore * 0.15) +
      (pfEsiScore * 0.10) +
      (docScore * 0.10) +
      (noticeScore * 0.05)
    );

    let grade = 'Excellent';
    let color = 'var(--success)';
    if (weightedScore < 60) { grade = 'Poor'; color = 'var(--danger)'; }
    else if (weightedScore < 80) { grade = 'Good'; color = 'var(--warning)'; }

    return {
      totalScore: weightedScore,
      grade,
      color,
      breakdown: { gstScore, tdsScore, itrScore, rocScore, pfEsiScore, docScore, noticeScore }
    };
  };

  // 4. Smart Workload suggestions
  const workloadRecommendations = generateSmartWorkloadRecommendations(events);

  // 5. Government Extension Engine Trigger
  const handleApplyExtension = (circularId: string) => {
    const ext = extensions.find(ex => ex.id === circularId);
    if (!ext || ext.status === 'APPLIED') return;

    // Shift matching event due dates
    setEvents(events.map(evt => {
      if (evt.category === ext.category && evt.status === 'PENDING') {
        return { ...evt, dueDate: ext.extendedDueDate, title: `${evt.title} (Extended)` };
      }
      return evt;
    }));

    setExtensions(extensions.map(ex => ex.id === circularId ? { ...ex, status: 'APPLIED' } : ex));
    alert(`Circular applied! Due dates for category ${ext.category} updated to ${ext.extendedDueDate}. Staff and clients notified.`);
  };

  // 6. Copilot state
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; time: string }>>([
    { sender: 'ai', text: 'Welcome to the Compliance Intelligence Copilot. Ask me questions about today\'s workload, client delay risks, or capacity imbalances.', time: '20:36' }
  ]);
  const [chatInput, setChatInput] = useState<string>('');

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    const userMsg = { sender: 'user' as const, text: chatInput, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setChatMessages(prev => [...prev, userMsg]);

    let response = "I am search-indexing your compliance database. Try asking:\n• 'What is Zylos Pharma delay risk?'\n• 'Suggest reassignments to balance staff workloads.'\n• 'List next month's bottlenecks.'";
    const query = chatInput.toLowerCase();

    if (query.includes('zylos')) {
      const risk = predictClientDelayRisk(MOCK_CLIENT_HISTORY[1]);
      response = `Zylos Pharma Limited has an AI Delay Risk Score of **${risk.delayRiskScore}%** (${risk.riskLevel} Risk).\n\n**Key factors detected:**\n• Current documents are delayed (ECR records pending).\n• Average historical delay of 5.4 days.\n• 3 unresponsive incidents flagged by staff this quarter.`;
    } else if (query.includes('reassign') || query.includes('workload')) {
      response = `Based on current assignments and utilization:\n\n` + 
        workloadRecommendations.map(r => `• **${r.eventTitle}**: Recommended to ${r.reason}`).join('\n') + 
        `\n\nWould you like me to execute these workload balance updates?`;
    } else if (query.includes('bottleneck') || query.includes('next month')) {
      const forecast = get30_60_90DayForecast(events.length);
      response = `Here is the workload forecast for the next 90 days. Bottlenecks detected:\n\n` + 
        forecast.bottlenecksDetected.map(b => `• **${b.date}**: Load of ${b.loadPercentage}% - ${b.reason}`).join('\n') + 
        `\n\nDirect Tax capacity is currently utilizing 80% of total roster strength.`;
    }

    setChatInput('');
    setTimeout(() => {
      setChatMessages(prev => [...prev, { sender: 'ai', text: response, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    }, 800);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', fontFamily: 'inherit', color: 'var(--text-primary)' }}>
      
      {/* Centralized KPI Card Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div style={{ padding: '16px', background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Total Deadlines</span>
          <span style={{ fontSize: '24px', fontWeight: '800' }}>{simulateEmpty ? 0 : totalDeadlines}</span>
        </div>
        <div style={{ padding: '16px', background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Overdue filings</span>
          <span style={{ fontSize: '24px', fontWeight: '800', color: 'var(--danger)' }}>{simulateEmpty ? 0 : overdueCount}</span>
        </div>
        <div style={{ padding: '16px', background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Pending obligations</span>
          <span style={{ fontSize: '24px', fontWeight: '800', color: 'var(--warning)' }}>{simulateEmpty ? 0 : pendingCount}</span>
        </div>
        <div style={{ padding: '16px', background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Completed tasks</span>
          <span style={{ fontSize: '24px', fontWeight: '800', color: 'var(--success)' }}>{simulateEmpty ? 0 : completedCount}</span>
        </div>
      </div>

      {/* Tabs list */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', overflowX: 'auto', gap: '4px' }}>
        {[
          { id: 'calendar', label: 'Centralized Calendar' },
          { id: 'alerts', label: 'Automated Alert Engine' },
          { id: 'health', label: 'Client Health Scores' },
          { id: 'capacity', label: 'AI Capacity Planner' },
          { id: 'extensions', label: 'Govt Extensions' },
          { id: 'copilot', label: 'AI Compliance Copilot' }
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

      {/* Content panel */}
      <div style={{ minHeight: '500px' }}>

        {/* 1. CENTRALIZED COMPLIANCE CALENDAR */}
        {activeTab === 'calendar' && (
          simulateEmpty ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Empty state box */}
              <div style={{
                background: 'var(--bg-white)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '48px 24px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ fontSize: '48px' }}>📅</div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--primary)', margin: 0 }}>Compliance Calendar Empty</h3>
                  <p style={{ fontSize: '13.0px', color: 'var(--text-secondary)', maxWidth: '420px', margin: '8px auto 0', lineHeight: '1.5' }}>
                    Your compliance calendar is empty. Review client profiles to generate automated deadlines.
                  </p>
                </div>
                <button
                  onClick={() => alert('Reviewing client profiles...')}
                  style={{
                    padding: '8px 16px',
                    background: 'var(--primary)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    fontFamily: 'inherit'
                  }}
                >
                  Review Client Compliance Profiles
                </button>
              </div>

              {/* Watermarked Preview Calendar Mockup */}
              <div style={{ position: 'relative', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(255, 255, 255, 0.7)',
                  backdropFilter: 'blur(1px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 20
                }}>
                  <div style={{
                    padding: '10px 20px',
                    background: 'var(--bg-white)',
                    border: '1.5px solid var(--primary)',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow-md)',
                    fontSize: '13px',
                    fontWeight: '800',
                    color: 'var(--primary)'
                  }}>
                    ✨ Preview Populated Calendar (Add clients to populate)
                  </div>
                </div>

                <div style={{ opacity: 0.2, pointerEvents: 'none', padding: '16px', background: 'var(--bg-white)' }}>
                  <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '700' }}>June 2026</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginTop: '8px', minHeight: '180px' }}>
                    {Array.from({ length: 14 }).map((_, idx) => (
                      <div key={idx} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px', minHeight: '50px', background: 'var(--bg-light)' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{idx + 1}</span>
                        {idx === 4 && (
                          <div style={{ padding: '2px', fontSize: '8px', background: 'rgba(16, 185, 129, 0.1)', color: 'rgb(16, 185, 129)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '4px' }}>GST Return</div>
                        )}
                        {idx === 9 && (
                          <div style={{ padding: '2px', fontSize: '8px', background: 'rgba(59, 130, 246, 0.1)', color: 'rgb(59, 130, 246)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '4px' }}>ITR Form 6</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Filter bar */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', padding: '14px 20px', background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>AUTHORITY CATEGORY</label>
                <select 
                  value={selectedCategory} 
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={{ width: '160px', padding: '6px', border: '1px solid var(--border-color)', borderRadius: '6px', marginTop: '4px', background: 'var(--bg-light)', fontSize: '12.5px', outline: 'none' }}
                >
                  <option value="ALL">All Categories</option>
                  <option value="GST">GST Obligations</option>
                  <option value="INCOME_TAX">Income Tax</option>
                  <option value="TDS">TDS Returns</option>
                  <option value="ROC">ROC Filings</option>
                  <option value="PF_ESI">PF/ESI Payments</option>
                  <option value="PT">Professional Tax</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>ASSIGNED STAFF</label>
                <select 
                  value={selectedStaff} 
                  onChange={(e) => setSelectedStaff(e.target.value)}
                  style={{ width: '160px', padding: '6px', border: '1px solid var(--border-color)', borderRadius: '6px', marginTop: '4px', background: 'var(--bg-light)', fontSize: '12.5px', outline: 'none' }}
                >
                  <option value="ALL">All Staff</option>
                  {MOCK_STAFF_CAPACITY.map(st => (
                    <option key={st.id} value={st.name}>{st.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
                {['month', 'week', 'day'].map(view => (
                  <button
                    key={view}
                    onClick={() => setCalendarView(view as any)}
                    style={{
                      padding: '6px 12px',
                      background: calendarView === view ? 'var(--primary-light)' : 'none',
                      color: calendarView === view ? 'var(--primary)' : 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '700',
                      textTransform: 'capitalize',
                      cursor: 'pointer'
                    }}
                  >
                    {view}
                  </button>
                ))}
              </div>
            </div>

            {/* Simulating FullCalendar Grid Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '20px' }}>
              
              {/* Main Grid Simulator */}
              <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <span style={{ fontSize: '15px', fontWeight: '700' }}>June 2026</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>* Dates mapped with holiday registers</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} style={{ padding: '6px 0', textTransform: 'uppercase' }}>{d}</div>
                  ))}
                </div>

                {/* Calendar Days simulation */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginTop: '8px', minHeight: '320px' }}>
                  {Array.from({ length: 30 }).map((_, idx) => {
                    const dayNum = idx + 1;
                    const dateStr = `2026-06-${dayNum < 10 ? '0' + dayNum : dayNum}`;
                    const dayEvents = filteredEvents.filter(e => e.dueDate === dateStr);

                    return (
                      <div key={idx} style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '6px',
                        minHeight: '75px',
                        background: 'var(--bg-light)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)' }}>{dayNum}</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                          {dayEvents.map(evt => {
                            const colors = CATEGORY_COLORS[evt.category] || CATEGORY_COLORS.CUSTOM;
                            return (
                              <div
                                key={evt.id}
                                title={`${evt.title} - Assinged to: ${evt.assignedTo}`}
                                style={{
                                  padding: '2px 4px',
                                  fontSize: '9px',
                                  fontWeight: '600',
                                  borderRadius: '4px',
                                  background: colors.bg,
                                  color: colors.text,
                                  border: `1px solid ${colors.border}`,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  cursor: 'pointer'
                                }}
                              >
                                {evt.title.split(' ')[0]}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Day details list side-panel */}
              <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700' }}>Compliance List</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '380px', overflowY: 'auto' }}>
                  {filteredEvents.map(evt => {
                    const colors = CATEGORY_COLORS[evt.category] || CATEGORY_COLORS.CUSTOM;
                    return (
                      <div key={evt.id} style={{
                        padding: '10px 12px',
                        border: `1px solid var(--border-color)`,
                        borderLeft: `4px solid ${colors.text}`,
                        borderRadius: '6px',
                        background: 'var(--bg-light)',
                        fontSize: '12px'
                      }}>
                        <div style={{ fontWeight: '700', marginBottom: '4px' }}>{evt.title}</div>
                        <div style={{ color: 'var(--text-secondary)' }}>Client: {evt.companyName}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Due: {evt.dueDate} | Staff: <b>{evt.assignedTo}</b>
                        </div>
                        <div style={{ marginTop: '6px', display: 'flex', justifyItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{
                            padding: '1px 6px',
                            borderRadius: '10px',
                            fontSize: '9px',
                            fontWeight: '700',
                            background: evt.status === 'COMPLETED' ? 'var(--success-light)' : evt.status === 'OVERDUE' ? 'var(--danger-light)' : 'var(--warning-light)',
                            color: evt.status === 'COMPLETED' ? 'var(--success)' : evt.status === 'OVERDUE' ? 'var(--danger)' : 'var(--warning)'
                          }}>
                            {evt.status}
                          </span>
                          {evt.status !== 'COMPLETED' && (
                            <button
                              onClick={() => {
                                setEvents(events.map(e => e.id === evt.id ? { ...e, status: 'COMPLETED' } : e));
                              }}
                              style={{ border: 'none', background: 'none', color: 'var(--primary)', fontWeight: '700', fontSize: '10px', cursor: 'pointer' }}
                            >
                              Mark Done
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )
      )}

        {/* 2. AUTOMATED ALERT ENGINE */}
        {activeTab === 'alerts' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
            
            {/* Active alerts bundled notifications list */}
            <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Centralized Alert Delivery Dashboard</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {alerts.map(al => (
                  <div key={al.id} style={{
                    padding: '16px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    background: 'var(--bg-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: '700', fontSize: '13.5px' }}>{al.title}</span>
                      <span style={{ fontSize: '10px', background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
                        Channel: {al.channel}
                      </span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>{al.description}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sent time: {al.time}</div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                      {al.status !== 'ACKNOWLEDGED' ? (
                        <>
                          <button 
                            onClick={() => handleAcknowledgeAlert(al.id)}
                            style={{ padding: '6px 12px', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                          >
                            ✔ Acknowledge
                          </button>
                          <button 
                            onClick={() => handleSnoozeAlert(al.id, 4)}
                            style={{ padding: '6px 12px', background: 'var(--bg-gray)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                          >
                            Snooze 4h
                          </button>
                          <button 
                            onClick={() => handleSnoozeAlert(al.id, 24)}
                            style={{ padding: '6px 12px', background: 'var(--bg-gray)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                          >
                            Snooze 24h
                          </button>
                        </>
                      ) : (
                        <span style={{ color: 'var(--success)', fontSize: '12px', fontWeight: '700' }}>✔ Acknowledged</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SLA Escalation Rules Viewer */}
            <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700' }}>SLA Escalation Matrix</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
                <div style={{ borderLeft: '3px solid var(--primary)', paddingLeft: '10px' }}>
                  <div style={{ fontWeight: '700' }}>T-7 Days: Roster Staff</div>
                  <div style={{ color: 'var(--text-muted)' }}>Daily in-app nudge to assignee.</div>
                </div>
                <div style={{ borderLeft: '3px solid var(--warning)', paddingLeft: '10px' }}>
                  <div style={{ fontWeight: '700' }}>T-3 Days: Senior Staff</div>
                  <div style={{ color: 'var(--text-muted)' }}>Email copy copy to Senior Article.</div>
                </div>
                <div style={{ borderLeft: '3px solid var(--danger)', paddingLeft: '10px' }}>
                  <div style={{ fontWeight: '700' }}>T-1 Day: Partner CA</div>
                  <div style={{ color: 'var(--text-muted)' }}>WhatsApp notification to direct CA Partner.</div>
                </div>
                <div style={{ borderLeft: '3px solid #000', paddingLeft: '10px' }}>
                  <div style={{ fontWeight: '700' }}>Due Date Overdue: Admin Gate</div>
                  <div style={{ color: 'var(--text-muted)' }}>Full system lock and penalty estimation flag.</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. CLIENT COMPLIANCE HEALTH SCORE */}
        {activeTab === 'health' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '14px' }}>Client Portfolio Compliance health Scorecard</h3>
              
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '10px', color: 'var(--text-secondary)' }}>Company Profile</th>
                    <th style={{ padding: '10px', color: 'var(--text-secondary)' }}>Score</th>
                    <th style={{ padding: '10px', color: 'var(--text-secondary)' }}>Compliance Grade</th>
                    <th style={{ padding: '10px', color: 'var(--text-secondary)' }}>GST / TDS / ITR Breakdowns</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_COMPANIES.map(comp => {
                    const health = calculateClientHealth(comp.id);
                    return (
                      <tr key={comp.id} style={{ borderBottom: '1px solid var(--bg-gray)' }}>
                        <td style={{ padding: '14px 10px', fontWeight: '700' }}>{comp.name}</td>
                        <td style={{ padding: '14px 10px', fontWeight: '800', fontSize: '14px', color: health.color }}>
                          {health.totalScore}%
                        </td>
                        <td style={{ padding: '14px 10px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '600',
                            background: health.grade === 'Excellent' ? 'var(--success-light)' : health.grade === 'Good' ? 'var(--warning-light)' : 'var(--danger-light)',
                            color: health.color
                          }}>
                            {health.grade}
                          </span>
                        </td>
                        <td style={{ padding: '14px 10px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          GST: {health.breakdown.gstScore} | TDS: {health.breakdown.tdsScore} | ITR: {health.breakdown.itrScore} | PF: {health.breakdown.pfEsiScore}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. AI CAPACITY PLANNER */}
        {activeTab === 'capacity' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            
            {/* Roster load levels */}
            <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Active Staff Utilization load</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {MOCK_STAFF_CAPACITY.map(staff => {
                  const pct = Math.round((staff.assignedDeadlinesCount / staff.maxCapacity) * 100);
                  const isOverload = pct > 100;
                  return (
                    <div key={staff.id} style={{ fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span><b>{staff.name}</b> ({staff.department})</span>
                        <span style={{ fontWeight: '700', color: isOverload ? 'var(--danger)' : 'var(--text-primary)' }}>
                          {staff.assignedDeadlinesCount}/{staff.maxCapacity} deadlines ({pct}%)
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'var(--bg-gray)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: isOverload ? 'var(--danger)' : 'var(--primary)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Smart Reassignment recommendations panel */}
            <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700' }}>AI Smart Workload Distribution Recommendations</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '340px', overflowY: 'auto' }}>
                {workloadRecommendations.map((rec, idx) => (
                  <div key={idx} style={{ padding: '12px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px' }}>
                    <div style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '4px' }}>
                      Event: {rec.eventTitle}
                    </div>
                    <div>{rec.reason}</div>
                    <button
                      onClick={() => {
                        setEvents(events.map(e => e.id === rec.eventId ? { ...e, assignedTo: rec.recommendedAssigneeName } : e));
                        alert(`Successfully re-routed obligation to ${rec.recommendedAssigneeName}.`);
                      }}
                      style={{ padding: '4px 10px', background: 'var(--primary-light)', color: 'var(--primary)', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: '700', marginTop: '8px', cursor: 'pointer' }}
                    >
                      Confirm Reassignment SLA
                    </button>
                  </div>
                ))}
                {workloadRecommendations.length === 0 && (
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>
                    Roster workloads are perfectly balanced. No overload warnings.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 5. GOVERNMENT EXTENSIONS ENGINE */}
        {activeTab === 'extensions' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            
            {/* Extensions updates list */}
            <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700' }}>CBDT / CBIC Extension Notifications</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {extensions.map(ext => (
                  <div key={ext.id} style={{
                    padding: '14px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    background: 'var(--bg-light)',
                    fontSize: '13px'
                  }}>
                    <div style={{ fontWeight: '700', marginBottom: '4px' }}>{ext.title}</div>
                    <div>Original Date: <s>{ext.originalDueDate}</s></div>
                    <div style={{ color: 'var(--success)', fontWeight: '700' }}>Extended Date: {ext.extendedDueDate}</div>
                    
                    {ext.status === 'PENDING' ? (
                      <button
                        onClick={() => handleApplyExtension(ext.id)}
                        style={{ padding: '6px 12px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11.5px', fontWeight: '700', marginTop: '8px', cursor: 'pointer' }}
                      >
                        Apply Extension to Calendar
                      </button>
                    ) : (
                      <span style={{ display: 'inline-block', fontSize: '11px', background: 'var(--success-light)', color: 'var(--success)', padding: '2px 8px', borderRadius: '10px', marginTop: '8px', fontWeight: '600' }}>
                        ✔ Applied (Calendar Updated)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Simulating circular fetcher configuration */}
            <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Official Scraper API Staging</h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                The Government Extension Scraper automatically checks CBIC (GST) and Income Tax portals every 60 minutes for newly published notifications or circulars.
              </p>
              <div style={{ padding: '12px', background: 'var(--bg-light)', borderRadius: '8px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div>Last lookup: <b>Just now (2026-06-15 20:36)</b></div>
                <div>Status: <span style={{ color: 'var(--success)', fontWeight: '700' }}>SYNCED</span></div>
                <div>Monitored Portals: 5 Authority Gateways</div>
              </div>
              <button
                onClick={() => {
                  setExtensions([...extensions, {
                    id: `ext-${Date.now()}`,
                    title: 'Circular No. 10/2026: Extension of ITR filings due date',
                    category: 'INCOME_TAX',
                    originalDueDate: '2026-07-31',
                    extendedDueDate: '2026-08-31',
                    status: 'PENDING'
                  }]);
                  alert('Fetched 1 new pending circular from CBDT server staging.');
                }}
                style={{ padding: '10px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
              >
                Trigger Portal Manual Lookup
              </button>
            </div>
          </div>
        )}

        {/* 6. AI COMPLIANCE COPILOT */}
        {activeTab === 'copilot' && (
          <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '480px' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-light)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700' }}>AI Compliance Intelligence Assistant</h3>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Query deadline predictions, delay risks, or request workload balanced reassignments</div>
            </div>

            {/* Chat list */}
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
                </div>
              ))}
            </div>

            {/* Input form */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '10px' }}>
              <input 
                type="text" 
                placeholder="E.g., What is Zylos Pharma delay risk? / Suggest workload reassignments..." 
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
