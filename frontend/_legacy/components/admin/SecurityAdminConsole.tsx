'use client';

import React, { useState, useEffect } from 'react';
import {
  UserRoleMatrix,
  PREDEFINED_ROLES_MATRIX,
  AuditLog,
  INITIAL_AUDIT_LOGS,
  detectAuditLogAnomalies,
  verifyDPDPMinimizeAudit,
  verify2FACredentials,
  generateDPAAgreementText
} from '@/lib/admin/AdminSecurityEngine';

// Roster Users data for Administration
const MOCK_USERS_LIST = [
  { id: 'u1', name: 'Neha Roy', email: 'neha.roy@caos.in', role: 'JUNIOR_STAFF', status: 'ACTIVE', lastLogin: '2026-06-15 09:00 AM' },
  { id: 'u2', name: 'Rohan Mehta', email: 'rohan.mehta@caos.in', role: 'SENIOR_STAFF', status: 'ACTIVE', lastLogin: '2026-06-15 10:15 AM' },
  { id: 'u3', name: 'Priya Sharma', email: 'priya.sharma@caos.in', role: 'CA_PARTNER', status: 'ACTIVE', lastLogin: '2026-06-15 11:20 AM' },
  { id: 'u4', name: 'Amit Verma', email: 'amit.verma@caos.in', role: 'SENIOR_STAFF', status: 'SUSPENDED', lastLogin: '2026-06-14 02:40 PM' }
];

const MOCK_CLIENTS = [
  { id: 'c1', name: 'Aegis Infotech Private Limited' },
  { id: 'c2', name: 'Zylos Pharma Limited' },
  { id: 'c3', name: 'Vortex Logistics LLP' }
];

// Active Sessions
const INITIAL_SESSIONS = [
  { token: 'sess-8823', username: 'Neha Roy', device: 'Chrome / MacOS', location: 'New Delhi, India', ip: '103.88.24.12', active: true },
  { token: 'sess-9192', username: 'Rohan Mehta', device: 'Safari / iPadOS', location: 'Munich, Germany', ip: '46.12.98.4', active: true },
  { token: 'sess-4412', username: 'Amit Verma', device: 'Edge / Windows 10', location: 'Noida, India', ip: '157.48.92.21', active: true }
];

// Backups Mock List
const INITIAL_BACKUPS = [
  { id: 'b1', type: 'DAILY_INCREMENTAL', date: '2026-06-15 02:00 AM', size: '1.2 GB', status: 'SUCCESS' },
  { id: 'b2', type: 'WEEKLY_FULL', date: '2026-06-14 01:00 AM', size: '24.8 GB', status: 'SUCCESS' },
  { id: 'b3', type: 'DAILY_INCREMENTAL', date: '2026-06-13 02:00 AM', size: '1.1 GB', status: 'SUCCESS' }
];

// DPDP Grievances Mock
const INITIAL_GRIEVANCES = [
  { id: 'gr-01', clientName: 'Zylos Pharma', desc: 'Requesting deletion of auxiliary employee data fields collected in 2024.', status: 'OPEN', dpo: 'Priya Sharma', date: '2026-06-12' },
  { id: 'gr-02', clientName: 'Aegis Infotech', desc: 'Queries on PAN card storage encryption keys.', status: 'RESOLVED', dpo: 'Priya Sharma', date: '2026-06-10' }
];

// Access Requests Mock
const INITIAL_REQUESTS = [
  { id: 'req-01', user: 'Neha Roy', client: 'Zylos Pharma', module: 'Invoices', rationale: 'Need to audit outstanding payments for reconciliation.', status: 'PENDING' },
  { id: 'req-02', user: 'Rohan Mehta', client: 'Vortex Logistics', module: 'Payroll', rationale: 'Reviewing statutory PF logs.', status: 'APPROVED' }
];

export default function SecurityAdminConsole() {
  const [activeTab, setActiveTab] = useState<'matrix' | 'logs' | 'dpdp' | 'ai' | 'mfa' | 'sessions' | 'backups'>('matrix');

  // Core States
  const [users, setUsers] = useState(MOCK_USERS_LIST);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [activeSessions, setActiveSessions] = useState(INITIAL_SESSIONS);
  const [backups, setBackups] = useState(INITIAL_BACKUPS);
  const [grievances, setGrievances] = useState(INITIAL_GRIEVANCES);
  const [accessRequests, setAccessRequests] = useState(INITIAL_REQUESTS);
  const [permissionsMatrix, setPermissionsMatrix] = useState(PREDEFINED_ROLES_MATRIX);

  // 1. Permission Matrix Edit State
  const [selectedRole, setSelectedRole] = useState<string>('JUNIOR_STAFF');
  const [temporaryUser, setTemporaryUser] = useState('u2');
  const [temporaryClient, setTemporaryClient] = useState('c1');
  const [temporaryHrs, setTemporaryHrs] = useState(7);

  const handleTogglePermission = (moduleName: string, action: 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export') => {
    const rolePermissions = permissionsMatrix[selectedRole] || [];
    const updated = rolePermissions.map(row => {
      if (row.module === moduleName) {
        return { ...row, [action]: !row[action] };
      }
      return row;
    });
    setPermissionsMatrix({ ...permissionsMatrix, [selectedRole]: updated });
  };

  const handleGrantTemporaryAccess = () => {
    const uName = users.find(u => u.id === temporaryUser)?.name || 'User';
    const cName = MOCK_CLIENTS.find(c => c.id === temporaryClient)?.name.split(' ')[0] || 'Client';
    
    // Add to audit log
    const log: AuditLog = {
      id: `al-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      userId: 'u3', // Partner
      username: 'Priya Sharma',
      roleName: 'Partner CA',
      actionType: 'CONFIG',
      moduleName: 'Access Control',
      recordId: temporaryUser,
      recordName: `Temporary client override access`,
      newValue: `Granted ${uName} access to ${cName} for ${temporaryHrs} days`,
      ipAddress: '127.0.0.1',
      deviceInfo: 'Console Admin Panel',
      location: 'Local Roster'
    };
    setAuditLogs([log, ...auditLogs]);
    alert(`Temporary elevated access granted. ${uName} has view/edit override rights to ${cName} data for the next ${temporaryHrs} days.`);
  };

  // 2. Access Request approvals
  const handleApproveAccessRequest = (id: string, approve: boolean) => {
    setAccessRequests(accessRequests.map(req => req.id === id ? { ...req, status: approve ? 'APPROVED' : 'REJECTED' } : req));
    
    // Log in audit trail
    const req = accessRequests.find(r => r.id === id);
    if (req) {
      const log: AuditLog = {
        id: `al-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        userId: 'u3',
        username: 'Priya Sharma',
        roleName: 'Partner CA',
        actionType: 'CONFIG',
        moduleName: 'Access Control',
        recordId: id,
        recordName: `Request by ${req.user}`,
        newValue: approve ? 'APPROVED' : 'REJECTED',
        ipAddress: '127.0.0.1',
        deviceInfo: 'Console Admin Panel',
        location: 'Local Roster'
      };
      setAuditLogs([log, ...auditLogs]);
    }
  };

  // 3. Audit log filters
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logActionFilter, setLogActionFilter] = useState('ALL');
  
  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = log.username.toLowerCase().includes(logSearchQuery.toLowerCase()) || 
                          log.moduleName.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
                          log.recordName.toLowerCase().includes(logSearchQuery.toLowerCase());
    const matchesAction = logActionFilter === 'ALL' || log.actionType === logActionFilter;
    return matchesSearch && matchesAction;
  });

  const runAnomalies = detectAuditLogAnomalies(auditLogs);

  const handleExportComplianceLogs = () => {
    const dataString = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(auditLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataString);
    downloadAnchor.setAttribute("download", `CAOS_Regulator_Audit_Logs_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    alert('Regulator audit log report downloaded successfully in JSON format.');
  };

  // 4. DPDP Rights erasure desk
  const handleDPDPErasure = (clientName: string) => {
    const confirmDelete = window.confirm(`DPDP ERASURE REQUEST: Are you sure you want to execute erasure audits for ${clientName}? This wipes all secondary/unnecessary fields while retaining statutory tax logs for 7 years.`);
    if (confirmDelete) {
      alert(`Erasure completed. Deletion script wiped ${clientName} auxiliary profiles. Immutable audit logs generated.`);
      
      const log: AuditLog = {
        id: `al-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        userId: 'u3',
        username: 'Priya Sharma',
        roleName: 'Partner CA',
        actionType: 'DELETE',
        moduleName: 'DPDP Compliance',
        recordId: 'c2',
        recordName: `Erasure request completed for ${clientName}`,
        ipAddress: '127.0.0.1',
        deviceInfo: 'Console Admin Panel',
        location: 'Local Roster'
      };
      setAuditLogs([log, ...auditLogs]);
    }
  };

  // DPO Grievances resolution
  const handleResolveGrievance = (id: string) => {
    setGrievances(grievances.map(g => g.id === id ? { ...g, status: 'RESOLVED' } : g));
    alert('Grievance status resolved and notification transmitted to the client.');
  };

  // 5. Private AI Deployment Settings
  const [aiDeploymentMode, setAiDeploymentMode] = useState<'CLOUD' | 'VPC' | 'ON_PREM'>('CLOUD');
  const [dataLocalRegion, setDataLocalRegion] = useState('AWS AP-SOUTH-1 (Mumbai)');

  const handleDownloadAttestation = () => {
    const text = `CRYPTOGRAPHIC ISOLATION ATTESTATION\n\nGenerated: June 15, 2026\nDeployment Mode: ${aiDeploymentMode}\n\nWe hereby certify that all processing of client financial ledgers, tax documents, and secretarial signatures is restricted to the local network boundaries. No data egress occurred.`;
    const dataString = "data:text/plain;charset=utf-8," + encodeURIComponent(text);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataString);
    downloadAnchor.setAttribute("download", `Cryptographic_Attestation_${aiDeploymentMode}.txt`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // 6. Two-Factor Authentication
  const [mfaMandatoryPolicy, setMfaMandatoryPolicy] = useState('MANDATORY_ALL');
  const [mfaDefaultMethod, setMfaDefaultMethod] = useState<'SMS' | 'EMAIL' | 'TOTP' | 'WHATSAPP'>('TOTP');
  const [lockoutLimit, setLockoutLimit] = useState(5);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaAttempts, setMfaAttempts] = useState(0);

  const handleTest2FACode = () => {
    const res = verify2FACredentials(mfaCode, mfaAttempts);
    if (res.success) {
      alert('2FA token verification successful! Setup complete.');
      setMfaAttempts(0);
    } else {
      if (res.lockout) {
        alert('ALERT: Excessive failed attempts (5/5). Admin account temporarily locked for 15 minutes.');
      } else {
        alert(`MFA Code verification failed. ${res.remainingAttempts} attempts remaining.`);
        setMfaAttempts(prev => prev + 1);
      }
    }
    setMfaCode('');
  };

  // 7. Sessions Management & Lifecycle
  const handleToggleUserStatus = (id: string) => {
    setUsers(users.map(u => {
      if (u.id === id) {
        const nextStatus = u.status === 'ACTIVE' ? 'SUSPENDED' : u.status === 'SUSPENDED' ? 'DEACTIVATED' : 'ACTIVE';
        return { ...u, status: nextStatus };
      }
      return u;
    }));
  };

  const handleRevokeSession = (token: string) => {
    setActiveSessions(activeSessions.map(sess => sess.token === token ? { ...sess, active: false } : sess));
    alert('User session revoked in real-time. Auth token cleared.');
  };

  // 8. Backups & Full Encrypted Portability Exports
  const [backupRunning, setBackupRunning] = useState(false);
  const [exportPassword, setExportPassword] = useState('SecureCAOS123');

  const handleTriggerBackup = () => {
    setBackupRunning(true);
    setTimeout(() => {
      const newB = {
        id: `b-${Date.now()}`,
        type: 'ON_DEMAND',
        date: new Date().toISOString().replace('T', ' ').slice(0, 19),
        size: '14.2 GB',
        status: 'SUCCESS'
      };
      setBackups([newB, ...backups]);
      setBackupRunning(false);
      alert('Backup snapshot complete. Metadata synced.');
    }, 2000);
  };

  const handleOnDemandZipExport = (cId: string) => {
    const cName = MOCK_CLIENTS.find(c => c.id === cId)?.name.split(' ')[0] || 'Client';
    const text = `ENCRYPTED CLIENT ZIP BUNDLE\nClient: ${cName}\nPassword Protected: TRUE\nGenerated by: Priya Sharma\n\nThis archive contains GST registers, ROC meeting minutes, director KYC papers, and communication history logs.`;
    const dataString = "data:text/plain;charset=utf-8," + encodeURIComponent(text);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataString);
    downloadAnchor.setAttribute("download", `${cName}_Full_Locker_Backup_${new Date().toISOString().slice(0,10)}.zip`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    
    // Log full zip export
    const log: AuditLog = {
      id: `al-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      userId: 'u3',
      username: 'Priya Sharma',
      roleName: 'Partner CA',
      actionType: 'EXPORT',
      moduleName: 'Backup & Export Center',
      recordId: cId,
      recordName: `Encrypted Client Locker ZIP download: ${cName}`,
      newValue: `ZIP package encrypted with user password`,
      ipAddress: '127.0.0.1',
      deviceInfo: 'Console Admin Panel',
      location: 'Local Roster'
    };
    setAuditLogs([log, ...auditLogs]);
    alert(`Encrypted Client Locker ZIP bundle generated. Password applied.`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', fontFamily: 'inherit', color: 'var(--text-primary)' }}>
      
      {/* Header section */}
      <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', letterSpacing: '-0.02em', color: 'var(--primary)' }}>Security & Admin Console</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Granular authorization, immutable audit records, DPDP tools, and private model isolation setups.</p>
        </div>
        
        {/* Status Region badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', background: 'var(--success)', borderRadius: '50%' }} />
          <span><b>Security Level:</b> Regulatory Compliant | Local Node</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', overflowX: 'auto', gap: '4px' }}>
        {[
          { id: 'matrix', label: '🔑 Access Matrix' },
          { id: 'logs', label: '📜 Audit Logs' },
          { id: 'dpdp', label: '🇮🇳 DPDP Compliance' },
          { id: 'ai', label: '🤖 Private AI Setup' },
          { id: 'mfa', label: '📱 MFA & Lockouts' },
          { id: 'sessions', label: '👥 Users & Sessions' },
          { id: 'backups', label: '💾 Backup & Exports' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '12px 18px',
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

      {/* Container views */}
      <div style={{ minHeight: '550px' }}>

        {/* ======================= TAB 1: ACCESS MATRIX & OVERRIDES ======================= */}
        {activeTab === 'matrix' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Split view: Predefined roles matrix vs Temporary Override overrides */}
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '20px', flexWrap: 'wrap' }}>
              
              {/* Grandular permission matrix grid */}
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '700' }}>🛡️ Granular Module Permissions</h3>
                  <select 
                    value={selectedRole} 
                    onChange={(e) => setSelectedRole(e.target.value)}
                    style={{ padding: '6px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)', fontWeight: '600' }}
                  >
                    <option value="SUPER_ADMIN">Super Admin</option>
                    <option value="ADMIN">Firm Admin</option>
                    <option value="CA_PARTNER">CA / Partner</option>
                    <option value="SENIOR_STAFF">Senior Staff</option>
                    <option value="JUNIOR_STAFF">Junior Staff / Article</option>
                    <option value="BILLING_STAFF">Billing Staff</option>
                    <option value="VIEW_ONLY">View Only</option>
                    <option value="CLIENT">Client</option>
                  </select>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Module Namespace</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>View</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Create</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Edit</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Delete</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Approve</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Export</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(permissionsMatrix[selectedRole] || []).map(row => (
                      <tr key={row.module} style={{ borderBottom: '1px solid var(--bg-gray)' }}>
                        <td style={{ padding: '10px 8px', fontWeight: '700' }}>{row.module}</td>
                        {['view', 'create', 'edit', 'delete', 'approve', 'export'].map(action => (
                          <td key={action} style={{ padding: '10px 8px', textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={(row as any)[action]}
                              onChange={() => handleTogglePermission(row.module, action as any)}
                              disabled={selectedRole === 'SUPER_ADMIN'}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '14px' }}>
                  * Super Admin rights are statically read-only in database. Matrix overrides are updated globally.
                </div>
              </div>

              {/* Time-limited Client Overrides */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Temporary access override builder */}
                <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    ⏳ Time-Limited Access Override
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>SELECT USER</label>
                    <select 
                      value={temporaryUser} 
                      onChange={(e) => setTemporaryUser(e.target.value)}
                      style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                    >
                      {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>TARGET CLIENT LOCKER</label>
                    <select 
                      value={temporaryClient} 
                      onChange={(e) => setTemporaryClient(e.target.value)}
                      style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                    >
                      {MOCK_CLIENTS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>ACCESS RETENTION DURATION (DAYS)</label>
                    <input 
                      type="number" 
                      value={temporaryHrs}
                      onChange={(e) => setTemporaryHrs(Number(e.target.value))}
                      style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                    />
                  </div>

                  <button 
                    onClick={handleGrantTemporaryAccess}
                    style={{ padding: '10px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Grant Time-Limited Override
                  </button>
                </div>

                {/* Pending Access requests */}
                <div className="card" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '12px' }}>
                    🔔 User Access Request Workflow
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {accessRequests.map(req => (
                      <div key={req.id} style={{ padding: '10px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px' }}>
                        <div><b>User:</b> {req.user} requests <b>{req.module}</b> for client <i>{req.client}</i>.</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Rationale: "{req.rationale}"</div>
                        
                        <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '8px', paddingTop: '6px', display: 'flex', justifyItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{
                            padding: '1px 6px',
                            borderRadius: '10px',
                            fontSize: '9px',
                            fontWeight: '700',
                            background: req.status === 'APPROVED' ? 'var(--success-light)' : req.status === 'REJECTED' ? 'var(--danger-light)' : 'var(--warning-light)',
                            color: req.status === 'APPROVED' ? 'var(--success)' : req.status === 'REJECTED' ? 'var(--danger)' : 'var(--warning)'
                          }}>
                            {req.status}
                          </span>
                          
                          {req.status === 'PENDING' && (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button 
                                onClick={() => handleApproveAccessRequest(req.id, false)}
                                style={{ border: 'none', background: 'none', color: 'var(--danger)', fontWeight: '700', cursor: 'pointer', fontSize: '10.5px' }}
                              >
                                Reject
                              </button>
                              <button 
                                onClick={() => handleApproveAccessRequest(req.id, true)}
                                style={{ border: 'none', background: 'none', color: 'var(--success)', fontWeight: '700', cursor: 'pointer', fontSize: '10.5px' }}
                              >
                                Approve
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* ======================= TAB 2: AUDIT LOGS & SCANNER ======================= */}
        {activeTab === 'logs' && (
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '20px' }}>
            
            {/* Audit log trail table */}
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700' }}>📜 Immutable Platform Audit Trail</h3>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    placeholder="Search logs..." 
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    style={{ padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                  />
                  <select 
                    value={logActionFilter}
                    onChange={(e) => setLogActionFilter(e.target.value)}
                    style={{ padding: '6px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                  >
                    <option value="ALL">All Actions</option>
                    <option value="LOGIN">LOGIN</option>
                    <option value="EXPORT">EXPORT</option>
                    <option value="MODIFY">MODIFY</option>
                    <option value="DELETE">DELETE</option>
                    <option value="CONFIG">CONFIG</option>
                  </select>
                  <button 
                    onClick={handleExportComplianceLogs}
                    style={{ padding: '6px 12px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Export regulator file
                  </button>
                </div>
              </div>

              <div style={{ maxHeight: '440px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', background: 'var(--bg-light)' }}>
                      <th style={{ padding: '10px' }}>Timestamp</th>
                      <th style={{ padding: '10px' }}>User</th>
                      <th style={{ padding: '10px' }}>Role</th>
                      <th style={{ padding: '10px' }}>Action</th>
                      <th style={{ padding: '10px' }}>Module Namespace</th>
                      <th style={{ padding: '10px' }}>Record Context</th>
                      <th style={{ padding: '10px' }}>IP / Geography</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map(log => (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--bg-gray)' }}>
                        <td style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}><b>{log.timestamp}</b></td>
                        <td style={{ padding: '12px 10px' }}>{log.username}</td>
                        <td style={{ padding: '12px 10px', fontSize: '10.5px', color: 'var(--text-muted)' }}>{log.roleName}</td>
                        <td style={{ padding: '12px 10px' }}>
                          <span className={`badge badge-${log.actionType === 'LOGIN' ? 'success' : log.actionType === 'DELETE' ? 'danger' : log.actionType === 'EXPORT' ? 'warning' : 'info'}`}>
                            {log.actionType}
                          </span>
                        </td>
                        <td style={{ padding: '12px 10px' }}>{log.moduleName}</td>
                        <td style={{ padding: '12px 10px' }}>
                          <div><b>{log.recordName}</b></div>
                          {log.newValue && <div style={{ fontSize: '10.5px', color: 'var(--primary)', marginTop: '2px' }}>Value: {log.newValue}</div>}
                        </td>
                        <td style={{ padding: '12px 10px' }}>
                          <div>{log.ipAddress}</div>
                          <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>{log.location}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '12px' }}>
                🔒 Immutability Notice: Logs are stored in an append-only archive and cannot be modified by any Super Admin account. Retained for 7 Years (statutory requirement).
              </div>
            </div>

            {/* AI Security scan alerts */}
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                🤖 AI Security log Scanner
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Runs real-time search scans on security login logs, checking bulk downloads, geographic mismatches, and multi-lockouts.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {runAnomalies.map((anom, idx) => (
                  <div key={idx} style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', fontSize: '12px', borderLeft: '4px solid var(--danger)' }}>
                    <div style={{ fontWeight: '700', color: 'var(--danger)', marginBottom: '4px' }}>🚨 Threat Flagged</div>
                    <div>{anom}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ======================= TAB 3: DPDP COMPLIANCE DESK ======================= */}
        {activeTab === 'dpdp' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            
            {/* DPDP Consent & rights manager */}
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                🇮🇳 Data Subject Rights & Consent Logs
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ padding: '12px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <div style={{ fontWeight: '700', fontSize: '12.5px', marginBottom: '4px' }}>Section 11 Right to Access (Client Data Portability)</div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Download all personal logs, identity papers, and records filed under client profile.</span>
                  <button 
                    onClick={() => {
                      alert('Personal Profile downloaded in structured DPDP compliance format.');
                    }}
                    style={{ padding: '6px 12px', background: 'none', border: '1px solid var(--border-color)', color: 'var(--primary)', borderRadius: '6px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Export Personal Locker Data
                  </button>
                </div>

                <div style={{ padding: '12px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <div style={{ fontWeight: '700', fontSize: '12.5px', marginBottom: '4px' }}>Section 12 Right to Correction / Erasure</div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Requests for auxiliary field wipe out of inactive database columns.</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => handleDPDPErasure('Zylos Pharma')}
                      style={{ padding: '6px 12px', background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: 'var(--danger)', borderRadius: '6px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Trigger Erasure Audit
                    </button>
                  </div>
                </div>

                {/* Consent version tracking list */}
                <div style={{ padding: '12px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <div style={{ fontWeight: '700', fontSize: '12.5px', marginBottom: '6px' }}>Electronic Consent Log Version (Onboarding Clickthroughs)</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px' }}>
                    <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between' }}>
                      <span>Aegis Infotech:</span>
                      <span>v2.1 Clickthrough (IP: 103.88.24.12, 2026-04-12)</span>
                    </div>
                    <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between' }}>
                      <span>Zylos Pharma:</span>
                      <span>v2.1 Clickthrough (IP: 46.12.98.4, 2026-05-10)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* DPO Grievances list & Breach manual */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Grievance list */}
              <div className="card" style={{ padding: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '12px' }}>
                  👥 Grievance Redressal Desk (DPO)
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {grievances.map(gr => (
                    <div key={gr.id} style={{ padding: '10px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <b>{gr.clientName}</b>
                        <span className={`badge badge-${gr.status === 'RESOLVED' ? 'success' : 'warning'}`} style={{ fontSize: '9px' }}>{gr.status}</span>
                      </div>
                      <div>{gr.desc}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>DPO Assignee: {gr.dpo} | Date: {gr.date}</div>
                      {gr.status === 'OPEN' && (
                        <button 
                          onClick={() => handleResolveGrievance(gr.id)}
                          style={{ marginTop: '8px', padding: '3px 8px', background: 'var(--primary-light)', color: 'var(--primary)', border: 'none', borderRadius: '4px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          Mark Grievance Resolved
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Breach playbook */}
              <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  🛡️ 72-Hour Data Breach Playbook
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Assists the DPO in drafting notifications to the Indian Data Protection Board within 72 hours under DPDP regulation limits.
                </p>
                <button 
                  onClick={() => {
                    const text = `DATA BREACH NOTIFICATION TEMPLATE\nTo: Data Protection Board of India\nDate: June 15, 2026\n\n1. Nature of Breach: [Select System Nodes]\n2. Estimated Impact: [Count of Data Principals]\n3. Countermeasures Implemented: System locked, logs archived.`;
                    navigator.clipboard.writeText(text);
                    alert('Draft notification copied. Transmit copy within 72 hours.');
                  }}
                  style={{ padding: '8px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Generate Board Notification Draft
                </button>
              </div>

            </div>

          </div>
        )}

        {/* ======================= TAB 4: PRIVATE AI DEPLOYMENT SETUP ======================= */}
        {activeTab === 'ai' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            
            {/* Deploy configuration toggle */}
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                🤖 AI Deployment Roster Configuration
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { mode: 'CLOUD', title: 'Cloud-Hosted (Standard)', desc: 'AI queries process in secure, compliant Indian AWS cloud region. Complies with local storage.' },
                  { mode: 'VPC', title: 'Private Cloud VPC', desc: 'All model processing runs in CA Firm own AWS/Azure Virtual Private Cloud. Cryptographically isolated.' },
                  { mode: 'ON_PREM', title: 'On-Premises Local Host', desc: 'Models run completely local on CA Firm server nodes. 100% data isolated from external APIs.' }
                ].map(item => (
                  <label 
                    key={item.mode} 
                    style={{ 
                      padding: '12px', 
                      background: aiDeploymentMode === item.mode ? 'var(--primary-light)' : 'var(--bg-light)', 
                      border: aiDeploymentMode === item.mode ? '1.5px solid var(--primary)' : '1px solid var(--border-color)', 
                      borderRadius: '8px', 
                      display: 'flex', 
                      alignItems: 'start', 
                      gap: '10px', 
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <input 
                      type="radio" 
                      name="ai-deploy" 
                      value={item.mode} 
                      checked={aiDeploymentMode === item.mode}
                      onChange={() => {
                        setAiDeploymentMode(item.mode as any);
                        if (item.mode === 'ON_PREM') {
                          setDataLocalRegion('Local Server Node (CA Office)');
                        } else {
                          setDataLocalRegion('AWS AP-SOUTH-1 (Mumbai)');
                        }
                      }}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '13px', color: aiDeploymentMode === item.mode ? 'var(--primary)' : 'var(--text-primary)' }}>{item.title}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>{item.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Isolation Attestations and regional verification */}
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                🔒 Network Isolation attestation
              </h3>

              <div style={{ padding: '14px', background: 'var(--bg-light)', borderRadius: '8px', fontSize: '12.5px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div>Data processing region: <b>{dataLocalRegion}</b></div>
                <div>External API querying: <b>{aiDeploymentMode === 'CLOUD' ? 'Compliant HTTPS Tunnel' : 'DISABLED'}</b></div>
                <div>Model precision consistency: <b>98.8% Accuracy (Synced packages)</b></div>
              </div>

              {aiDeploymentMode !== 'CLOUD' ? (
                <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', fontSize: '12.5px', borderLeft: '4px solid rgb(16, 185, 129)' }}>
                  <div style={{ fontWeight: '700', color: 'rgb(16, 185, 129)', marginBottom: '4px' }}>✔ Crytographic Isolation verified</div>
                  No data egress detected across network boundary this session. Isolation certificate generated.
                </div>
              ) : (
                <div style={{ padding: '12px', background: 'var(--primary-light)', borderRadius: '8px', fontSize: '12px' }}>
                  Cloud deployment complies with Indian AWS nodes. Attestation available for local deployments only.
                </div>
              )}

              <button 
                onClick={handleDownloadAttestation}
                disabled={aiDeploymentMode === 'CLOUD'}
                style={{ padding: '10px', background: aiDeploymentMode === 'CLOUD' ? '#ccc' : 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
              >
                Download Cryptographic Attestation File
              </button>
            </div>

          </div>
        )}

        {/* ======================= TAB 5: MFA & LOCKOUTS ======================= */}
        {activeTab === 'mfa' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            
            {/* MFA Options policy setup */}
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                📱 Two-Factor Authentication Configuration
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>ENFORCEMENT POLICY</label>
                <select 
                  value={mfaMandatoryPolicy} 
                  onChange={(e) => setMfaMandatoryPolicy(e.target.value)}
                  style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                >
                  <option value="MANDATORY_ALL">Mandatory for all Roster Users</option>
                  <option value="MANDATORY_ADMIN">Mandatory for Admin & Partners Only</option>
                  <option value="OPTIONAL">Optional for all</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>DEFAULT MFA METHOD</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px', marginTop: '4px' }}>
                  {[
                    { method: 'SMS', label: 'SMS One-Time Passcode (Twilio gateway)' },
                    { method: 'EMAIL', label: 'Email OTP Verification' },
                    { method: 'TOTP', label: 'TOTP Authenticator App (Google/Authy - Recommended)' },
                    { method: 'WHATSAPP', label: 'WhatsApp Sandbox OTP' }
                  ].map(item => (
                    <label key={item.method} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="mfa-method" 
                        value={item.method} 
                        checked={mfaDefaultMethod === item.method}
                        onChange={() => setMfaDefaultMethod(item.method as any)}
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>MAX CONSECUTIVE FAILED ATTEMPTS (LOCKOUT LIMIT)</label>
                <input 
                  type="number" 
                  value={lockoutLimit}
                  onChange={(e) => setLockoutLimit(Number(e.target.value))}
                  style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                />
              </div>
            </div>

            {/* Test validation & Backup Codes */}
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                🔑 Authenticator Setup Staging
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Verify your TOTP configuration by entering the 6-digit code shown on your authenticator app (Test key: 123456).
              </p>

              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="text" 
                  placeholder="Enter 6-digit code..." 
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  style={{ flex: '1', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-light)' }}
                />
                <button 
                  onClick={handleTest2FACode}
                  style={{ padding: '8px 16px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Verify Code
                </button>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', display: 'block', marginBottom: '6px' }}>📂 Emergency Backup Codes</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                  Download single-use codes to access your account if your device is lost.
                </span>
                <button 
                  onClick={() => {
                    const text = "EMERGENCY 2FA BACKUP CODES\n\n1. 8823-9091\n2. 4142-2311\n3. 9922-1209\n4. 4541-1122\n5. 8089-9192\n6. 4412-2157\n7. 8921-1220\n8. 1092-2244";
                    const dataString = "data:text/plain;charset=utf-8," + encodeURIComponent(text);
                    const downloadAnchor = document.createElement('a');
                    downloadAnchor.setAttribute("href", dataString);
                    downloadAnchor.setAttribute("download", "MFA_Backup_Codes.txt");
                    document.body.appendChild(downloadAnchor);
                    downloadAnchor.click();
                    downloadAnchor.remove();
                    alert('Backup codes saved to disk.');
                  }}
                  style={{ padding: '8px 14px', background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Download Backup Codes (TXT)
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ======================= TAB 6: USERS & ACTIVE SESSIONS ======================= */}
        {activeTab === 'sessions' && (
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '20px' }}>
            
            {/* Roster list lifecycle status */}
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                👥 User Account Lifecycle Status
              </h3>
              
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Name</th>
                    <th style={{ padding: '8px' }}>Email</th>
                    <th style={{ padding: '8px' }}>Role</th>
                    <th style={{ padding: '8px' }}>Status</th>
                    <th style={{ padding: '8px' }}>Last Login</th>
                    <th style={{ padding: '8px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--bg-gray)' }}>
                      <td style={{ padding: '12px 8px', fontWeight: '700' }}>{u.name}</td>
                      <td style={{ padding: '12px 8px' }}>{u.email}</td>
                      <td style={{ padding: '12px 8px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>{u.role}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <span className={`badge badge-${u.status === 'ACTIVE' ? 'success' : u.status === 'SUSPENDED' ? 'warning' : 'danger'}`}>
                          {u.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px' }}>{u.lastLogin}</td>
                      <td style={{ padding: '12px 8px' }}>
                        {u.role !== 'SUPER_ADMIN' && (
                          <button 
                            onClick={() => handleToggleUserStatus(u.id)}
                            style={{ border: 'none', background: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}
                          >
                            Toggle Status
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sessions manager & Password Policy */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Terminate sessions */}
              <div className="card" style={{ padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '12px' }}>
                  💻 Session Management Console
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {activeSessions.map(sess => (
                    <div key={sess.token} style={{ padding: '10px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', display: 'flex', justifyItems: 'center', justifyContent: 'space-between', opacity: sess.active ? 1 : 0.6 }}>
                      <div>
                        <div><b>{sess.username}</b> ({sess.device})</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>IP: {sess.ip} | Location: {sess.location}</div>
                      </div>
                      {sess.active ? (
                        <button 
                          onClick={() => handleRevokeSession(sess.token)}
                          style={{ padding: '4px 8px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: 'none', borderRadius: '4px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          Revoke
                        </button>
                      ) : (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700' }}>REVOKED</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Password complexity metrics sliders */}
              <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  🔐 Password Complexity Policy
                </h3>
                <div style={{ fontSize: '12.5px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div>Min Length: <b>12 characters</b></div>
                  <div>Require Symbols / Numbers: <b>TRUE</b></div>
                  <div>Password Expiry lifecycle: <b>Every 90 Days</b></div>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ======================= TAB 7: BACKUP & PORTABILITY EXPORTS ======================= */}
        {activeTab === 'backups' && (
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '20px' }}>
            
            {/* Backup checkpoints history */}
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700' }}>💾 Platform Backup Checkpoints</h3>
                <button 
                  onClick={handleTriggerBackup}
                  disabled={backupRunning}
                  style={{ padding: '6px 14px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer' }}
                >
                  {backupRunning ? 'Running Snapshot...' : 'Trigger On-Demand Backup'}
                </button>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Backup Type</th>
                    <th style={{ padding: '8px' }}>Checkpoint Time</th>
                    <th style={{ padding: '8px' }}>File size</th>
                    <th style={{ padding: '8px' }}>Status</th>
                    <th style={{ padding: '8px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map(b => (
                    <tr key={b.id} style={{ borderBottom: '1px solid var(--bg-gray)' }}>
                      <td style={{ padding: '12px 8px', fontWeight: '700' }}>{b.type}</td>
                      <td style={{ padding: '12px 8px' }}>{b.date}</td>
                      <td style={{ padding: '12px 8px' }}>{b.size}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <span className="badge badge-success">{b.status}</span>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <button 
                          onClick={() => {
                            const conf = window.confirm(`Restore Preview: This will roll back active transaction tables to backup point ${b.date}. Confirm restore?`);
                            if (conf) {
                              alert(`System successfully restored to checkpoint: ${b.date}.`);
                            }
                          }}
                          style={{ border: 'none', background: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}
                        >
                          Restore point
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* On-demand zip exports */}
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                📦 On-Demand ZIP Exporter (Portability)
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                Packages documents, secretarial board resolutions, tax summaries, and chat histories into an encrypted password-secured ZIP file.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>ENCRYPTION KEY PASSWORD</label>
                <input 
                  type="text" 
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                {MOCK_CLIENTS.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', padding: '10px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px' }}>
                    <span>📦 <b>{c.name.split(' ')[0]}</b> full bundle</span>
                    <button 
                      onClick={() => handleOnDemandZipExport(c.id)}
                      style={{ border: 'none', background: 'none', color: 'var(--primary)', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Export ZIP
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
