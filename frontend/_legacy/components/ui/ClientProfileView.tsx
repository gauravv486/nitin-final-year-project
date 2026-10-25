'use client';

import React, { useState } from 'react';
import { useTheme } from '@/lib/theme-context';

interface Client {
  id: string;
  name: string;
  email: string;
  gstin: string;
  type: string;
  gstStatus: 'filed' | 'pending' | 'mismatch';
  itrStatus: 'filed' | 'pending' | 'in-progress';
  riskLevel: 'low' | 'medium' | 'high';
  docs: number;
  totalDocs: number;
}

interface Document {
  id: string;
  clientId: string;
  fileName: string;
  type: string;
  uploadDate: string;
  size: number;
  status: string;
}

interface Invoice {
  id: string;
  number: string;
  client: string;
  amount: number;
  gst: number;
  date: string;
  status: 'paid' | 'pending';
}

interface Task {
  id: string;
  title: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  type: 'gst' | 'itr' | 'audit' | 'pf';
}

interface ClientProfileViewProps {
  client: Client;
  onBack: () => void;
  documents: Document[];
  invoices: Invoice[];
  tasks: Task[];
  initialTab?: string;
}

export default function ClientProfileView({
  client,
  onBack,
  documents,
  invoices,
  tasks,
  initialTab = 'Overview',
}: ClientProfileViewProps) {
  const [activeTab, setActiveTab] = useState(initialTab);

  // Filter client-specific data
  const clientDocs = documents.filter(d => d.clientId === client.id);
  const clientInvoices = invoices.filter(inv => 
    inv.client.toLowerCase().includes(client.name.split(' ')[0].toLowerCase())
  );
  const clientTasks = tasks.filter(t => 
    (t.type === 'gst' && client.gstStatus !== 'filed') || 
    (t.type === 'itr' && client.itrStatus !== 'filed')
  );

  const tabs = [
    { name: 'Overview', icon: '👤' },
    { name: 'Documents', icon: '📁' },
    { name: 'GST', icon: '💳' },
    { name: 'Income Tax', icon: '📈' },
    { name: 'Payroll', icon: '💸' },
    { name: 'Audit', icon: '⚠️' },
    { name: 'Communication', icon: '💬' },
    { name: 'Reports', icon: '📊' },
  ];

  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': return 'danger';
      default: return 'gray';
    }
  };

  return (
    <div className="page active">
      {/* Header breadcrumb & back button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <button onClick={onBack} className="btn btn-secondary btn-sm" style={{ padding: '6px 12px' }}>
          ← Back to Clients
        </button>
        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
          Clients / <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{client.name}</span>
        </div>
      </div>

      {/* Profile Header Card */}
      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, var(--primary) 0%, rgba(27, 58, 107, 0.8) 100%)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            fontWeight: '700',
          }}>
            {client.name.charAt(0)}
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: 'var(--primary)' }}>{client.name}</h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              GSTIN: <b style={{ color: 'var(--text-primary)' }}>{client.gstin}</b> | Entity: <b>{client.type}</b>
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>Risk Status</span>
            <span className={`badge badge-${getRiskBadgeColor(client.riskLevel)}`}>{client.riskLevel.toUpperCase()}</span>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>GST Filings</span>
            <span className={`badge badge-${client.gstStatus === 'filed' ? 'success' : client.gstStatus === 'mismatch' ? 'danger' : 'warning'}`}>{client.gstStatus.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Tabs list */}
      <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border-color)', marginBottom: '24px', overflowX: 'auto', paddingBottom: '6px' }}>
        {tabs.map((tab) => (
          <button
            key={tab.name}
            onClick={() => setActiveTab(tab.name)}
            className={`btn ${activeTab === tab.name ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: activeTab === tab.name ? '700' : '500',
              whiteSpace: 'nowrap',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.name}</span>
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="tab-container" style={{ minHeight: '300px' }}>
        
        {/* OVERVIEW TAB */}
        {activeTab === 'Overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="grid g3">
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }}>Active Invoices</div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--primary)' }}>{clientInvoices.length}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Total billed: ₹{clientInvoices.reduce((sum, inv) => sum + inv.amount, 0).toLocaleString()}
                </div>
              </div>
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }}>Pending Documents</div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--warning)' }}>
                  {clientDocs.filter(d => d.status === 'pending').length}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Out of {clientDocs.length} total uploads
                </div>
              </div>
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }}>Income Tax Return</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--success)', marginTop: '8px' }}>
                  {client.itrStatus.toUpperCase()}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '14px' }}>
                  Assessment Year 2026-27
                </div>
              </div>
            </div>

            <div className="grid g-2-1">
              <div className="card">
                <div className="card-title">Recent Invoices</div>
                <div className="table-wrap" style={{ marginTop: '12px' }}>
                  <table>
                    <thead>
                      <tr><th>Invoice No</th><th>Date</th><th>Amount</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {clientInvoices.length > 0 ? (
                        clientInvoices.map((inv) => (
                          <tr key={inv.id}>
                            <td><b>{inv.number}</b></td>
                            <td>{inv.date}</td>
                            <td>₹{inv.amount.toLocaleString()}</td>
                            <td>
                              <span className={`badge badge-${inv.status === 'paid' ? 'success' : 'warning'}`}>
                                {inv.status.toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No recent invoices.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card">
                <div className="card-title">General Details</div>
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Email ID</span>
                    <span style={{ fontWeight: '600' }}>{client.email}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>GSTIN Registry</span>
                    <span style={{ fontWeight: '600' }}>{client.gstin}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Entity Type</span>
                    <span style={{ fontWeight: '600' }}>{client.type}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Assigned Partner</span>
                    <span style={{ fontWeight: '600' }}>CA Neha Sen</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DOCUMENTS TAB */}
        {activeTab === 'Documents' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div className="card-title">Client Repository Documents</div>
              <button className="btn btn-primary btn-sm" onClick={() => alert('Uploading mock file')}>➕ Upload Document</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>File Name</th><th>Upload Date</th><th>Size</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {clientDocs.length > 0 ? (
                    clientDocs.map((doc) => (
                      <tr key={doc.id}>
                        <td><b>📄 {doc.fileName}</b></td>
                        <td>{doc.uploadDate}</td>
                        <td>{(doc.size / 1024).toFixed(0)} KB</td>
                        <td>
                          <span className={`badge badge-${
                            doc.status === 'verified' || doc.status === 'categorized' ? 'success' : 
                            doc.status === 'pending' ? 'danger' : 'warning'
                          }`}>
                            {doc.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No files uploaded.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* GST TAB */}
        {activeTab === 'GST' && (
          <div className="card">
            <div className="card-title">GST Filings & Returns Summary</div>
            <div style={{ marginTop: '16px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, padding: '16px', background: 'var(--bg-gray)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>GSTR-1 status</h4>
                <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--success)' }}>✓ FILED (June 2026)</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Filed on: 2026-06-08</div>
              </div>
              <div style={{ flex: 1, padding: '16px', background: 'var(--bg-gray)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>GSTR-3B status</h4>
                <div style={{ fontSize: '18px', fontWeight: '700', color: client.gstStatus === 'filed' ? 'var(--success)' : 'var(--danger)' }}>
                  {client.gstStatus === 'filed' ? '✓ FILED (June 2026)' : '⏳ PENDING FILING'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Due date: 2026-06-20</div>
              </div>
            </div>
            
            <div style={{ marginTop: '20px', padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <h4 style={{ fontSize: '13.5px', fontWeight: '700', marginBottom: '10px' }}>GSTR-2B Matching Report</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                We detected a mismatch of <b>₹8,640</b> between the purchase book invoices and the GSTR-2B filing portal data. Action is required.
              </p>
              <button className="btn btn-secondary btn-sm" style={{ marginTop: '10px' }} onClick={() => alert('Matching workbench loaded')}>
                🛠️ Open Reconciliation Matcher
              </button>
            </div>
          </div>
        )}

        {/* INCOME TAX TAB */}
        {activeTab === 'Income Tax' && (
          <div className="card">
            <div className="card-title">Income Tax Return Workspace</div>
            <div style={{ display: 'flex', gap: '16px', flexDirection: 'column', marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-gray)', borderRadius: '6px', fontSize: '13px' }}>
                <div>
                  <div style={{ fontWeight: '600' }}>AY 2026-27 Return Filing (FY 2025-26)</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>Assigned Form: ITR-5 (Partnership/Corporate)</div>
                </div>
                <div>
                  <span className={`badge badge-${client.itrStatus === 'filed' ? 'success' : client.itrStatus === 'in-progress' ? 'warning' : 'danger'}`}>
                    {client.itrStatus.toUpperCase()}
                  </span>
                </div>
              </div>

              <div style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <h4 style={{ fontSize: '13.5px', fontWeight: '700', marginBottom: '12px' }}>Gross Income Breakdown</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Trading Revenue / Sales</span>
                    <span style={{ fontWeight: '600' }}>₹15,42,000</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Other Receipts / Interest</span>
                    <span style={{ fontWeight: '600' }}>₹48,500</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '6px', fontWeight: '700' }}>
                    <span>Gross Taxable Receipts</span>
                    <span>₹15,90,500</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PAYROLL TAB */}
        {activeTab === 'Payroll' && (
          <div className="card">
            <div className="card-title">Monthly Payroll & Statutory Compliance</div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.5' }}>
              Statutory rolls for Professional Tax, Employee Provident Fund (EPF), and ESIC accounts are calculated automatically based on payroll worksheets.
            </p>
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px' }}>
                <span>June 2026 Payroll Run</span>
                <span className="badge badge-success">✓ COMPLETED</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px' }}>
                <span>EPF Return (Form 12A)</span>
                <span className="badge badge-warning">⏳ IN PROCESSING</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px' }}>
                <span>ESI Challan Settlement</span>
                <span className="badge badge-success">✓ PAID</span>
              </div>
            </div>
          </div>
        )}

        {/* AUDIT TAB */}
        {activeTab === 'Audit' && (
          <div className="card">
            <div className="card-title">Benfords Forensic & Audit Exceptions</div>
            <div style={{ marginTop: '16px', padding: '16px', background: 'var(--bg-gray)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ fontSize: '13.5px', fontWeight: '700' }}>Benfords Law Compliance Score</h4>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>Forensic ledger analysis on 145 journals</p>
                </div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: client.riskLevel === 'high' ? 'var(--danger)' : 'var(--success)' }}>
                  {client.riskLevel === 'high' ? '64%' : '94%'}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '20px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>Audit Log & Anomaly Triggers</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                {client.riskLevel === 'high' ? (
                  <>
                    <div style={{ padding: '8px 12px', border: '1px solid var(--danger-light)', borderRadius: '6px', background: 'var(--danger-light)', color: 'var(--danger)' }}>
                      ⚠️ <b>Round Number Anomaly</b>: Detected 5 identical cash payments of ₹15,000 to the same vendor.
                    </div>
                    <div style={{ padding: '8px 12px', border: '1px solid var(--warning-light)', borderRadius: '6px', background: 'var(--warning-light)', color: 'var(--warning)' }}>
                      ⚠️ <b>Holiday Posting</b>: 2 journals entered at 11:30 PM on Sunday, June 14, 2026.
                    </div>
                  </>
                ) : (
                  <div style={{ color: 'var(--success)', padding: '8px' }}>✓ No critical anomalies detected in journals. Compliance score is optimal.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* COMMUNICATION TAB */}
        {activeTab === 'Communication' && (
          <div className="card">
            <div className="card-title">WhatsApp CRM Chat Sync</div>
            <div style={{ marginTop: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', height: '200px', display: 'flex', flexDirection: 'column', background: 'var(--bg-light)' }}>
              <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                <div style={{ background: 'var(--bg-white)', padding: '8px 12px', borderRadius: '8px', maxWidth: '80%', alignSelf: 'flex-start', border: '1px solid var(--border-color)' }}>
                  Hi CA OS, GSTR-1 bills uploaded. Please proceed with file check.
                </div>
                <div style={{ background: 'var(--primary)', color: '#fff', padding: '8px 12px', borderRadius: '8px', maxWidth: '80%', alignSelf: 'flex-end' }}>
                  Received. Initiating automated matching grid analysis. Will share discrepancy dashboard shortly.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', padding: '8px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-white)', borderRadius: '0 0 8px 8px' }}>
                <input
                  type="text"
                  placeholder="Type WhatsApp CRM message..."
                  style={{ flex: 1, padding: '6px 10px', fontSize: '12.5px', border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      alert('Message sent to client phone!');
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <button className="btn btn-primary btn-sm" onClick={() => alert('Message sent!')}>Send</button>
              </div>
            </div>
          </div>
        )}

        {/* REPORTS TAB */}
        {activeTab === 'Reports' && (
          <div className="card">
            <div className="card-title">Reports & Export Hub</div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              Compile ledger balances, forensic reports, compliance filings, and professional logs into Excel or PDF summaries.
            </p>
            <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
              <button className="btn btn-primary btn-sm" onClick={() => alert('Revenue Report Generated')}>
                📊 Revenue Ledger PDF
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => alert('GST Report Generated')}>
                💳 GSTR filing logs CSV
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => alert('Audit Scorecard Generated')}>
                🛡️ Forensic Audit Sheet
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
