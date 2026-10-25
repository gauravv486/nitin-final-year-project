// Security, Access & Administration Logic Engine

export interface UserRoleMatrix {
  module: string;
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
  export: boolean;
}

// 1. GRANULAR PREDEFINED ROLES & PERMISSION MATRIX
// Predefined roles permissions matrices
export const PREDEFINED_ROLES_MATRIX: Record<string, UserRoleMatrix[]> = {
  SUPER_ADMIN: [
    { module: 'all', view: true, create: true, edit: true, delete: true, approve: true, export: true }
  ],
  ADMIN: [
    { module: 'Dashboard', view: true, create: true, edit: true, delete: true, approve: true, export: true },
    { module: 'Clients', view: true, create: true, edit: true, delete: true, approve: true, export: true },
    { module: 'Invoices', view: true, create: true, edit: true, delete: true, approve: true, export: true },
    { module: 'Documents', view: true, create: true, edit: true, delete: true, approve: true, export: true },
    { module: 'Compliance', view: true, create: true, edit: true, delete: true, approve: true, export: true },
    { module: 'Payroll', view: true, create: true, edit: true, delete: true, approve: true, export: true },
    { module: 'Secretarial', view: true, create: true, edit: true, delete: true, approve: true, export: true },
    { module: 'Collaboration', view: true, create: true, edit: true, delete: true, approve: true, export: true }
  ],
  CA_PARTNER: [
    { module: 'Dashboard', view: true, create: true, edit: true, delete: false, approve: true, export: true },
    { module: 'Clients', view: true, create: true, edit: true, delete: false, approve: true, export: true },
    { module: 'Invoices', view: true, create: true, edit: true, delete: false, approve: true, export: true },
    { module: 'Documents', view: true, create: true, edit: true, delete: false, approve: true, export: true },
    { module: 'Compliance', view: true, create: true, edit: true, delete: false, approve: true, export: true },
    { module: 'Payroll', view: true, create: true, edit: true, delete: false, approve: true, export: true },
    { module: 'Secretarial', view: true, create: true, edit: true, delete: false, approve: true, export: true },
    { module: 'Collaboration', view: true, create: true, edit: true, delete: false, approve: true, export: true }
  ],
  SENIOR_STAFF: [
    { module: 'Dashboard', view: true, create: true, edit: true, delete: false, approve: false, export: true },
    { module: 'Clients', view: true, create: true, edit: true, delete: false, approve: false, export: true },
    { module: 'Invoices', view: true, create: false, edit: false, delete: false, approve: false, export: false },
    { module: 'Documents', view: true, create: true, edit: true, delete: false, approve: false, export: true },
    { module: 'Compliance', view: true, create: true, edit: true, delete: false, approve: false, export: false },
    { module: 'Payroll', view: true, create: true, edit: true, delete: false, approve: false, export: false },
    { module: 'Secretarial', view: true, create: true, edit: true, delete: false, approve: false, export: false },
    { module: 'Collaboration', view: true, create: true, edit: true, delete: false, approve: false, export: true }
  ],
  JUNIOR_STAFF: [
    { module: 'Dashboard', view: true, create: true, edit: false, delete: false, approve: false, export: false },
    { module: 'Clients', view: true, create: false, edit: false, delete: false, approve: false, export: false },
    { module: 'Invoices', view: false, create: false, edit: false, delete: false, approve: false, export: false },
    { module: 'Documents', view: true, create: true, edit: false, delete: false, approve: false, export: false },
    { module: 'Compliance', view: true, create: false, edit: false, delete: false, approve: false, export: false },
    { module: 'Payroll', view: true, create: false, edit: false, delete: false, approve: false, export: false },
    { module: 'Secretarial', view: true, create: false, edit: false, delete: false, approve: false, export: false },
    { module: 'Collaboration', view: true, create: true, edit: false, delete: false, approve: false, export: false }
  ],
  BILLING_STAFF: [
    { module: 'Dashboard', view: true, create: false, edit: false, delete: false, approve: false, export: false },
    { module: 'Invoices', view: true, create: true, edit: true, delete: true, approve: true, export: true }
  ],
  VIEW_ONLY: [
    { module: 'Dashboard', view: true, create: false, edit: false, delete: false, approve: false, export: false },
    { module: 'Clients', view: true, create: false, edit: false, delete: false, approve: false, export: false },
    { module: 'Documents', view: true, create: false, edit: false, delete: false, approve: false, export: false },
    { module: 'Compliance', view: true, create: false, edit: false, delete: false, approve: false, export: false }
  ],
  CLIENT: [
    { module: 'Dashboard', view: true, create: false, edit: false, delete: false, approve: false, export: false },
    { module: 'Documents', view: true, create: true, edit: false, delete: false, approve: false, export: false },
    { module: 'Invoices', view: true, create: false, edit: false, delete: false, approve: false, export: false },
    { module: 'Collaboration', view: true, create: true, edit: false, delete: false, approve: false, export: false }
  ]
};

// 2. AUDIT LOG INITIAL MOCK DATA
export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  username: string;
  roleName: string;
  actionType: 'LOGIN' | 'LOGOUT' | 'CREATE' | 'MODIFY' | 'DELETE' | 'EXPORT' | 'CONFIG';
  moduleName: string;
  recordId: string;
  recordName: string;
  oldValue?: string;
  newValue?: string;
  ipAddress: string;
  deviceInfo: string;
  location: string;
}

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  { id: 'al-01', timestamp: '2026-06-15 09:00:12', userId: 'u1', username: 'Neha Roy', roleName: 'Article Assistant', actionType: 'LOGIN', moduleName: 'Authentication', recordId: 'sess-8823', recordName: 'Neha Session', ipAddress: '103.88.24.12', deviceInfo: 'Chrome / MacOS', location: 'New Delhi, India' },
  { id: 'al-02', timestamp: '2026-06-15 09:42:30', userId: 'u1', username: 'Neha Roy', roleName: 'Article Assistant', actionType: 'EXPORT', moduleName: 'Clients', recordId: 'c2', recordName: 'Zylos Pharma GST ledger', ipAddress: '103.88.24.12', deviceInfo: 'Chrome / MacOS', location: 'New Delhi, India' },
  { id: 'al-03', timestamp: '2026-06-15 10:15:00', userId: 'u2', username: 'Rohan Mehta', roleName: 'Senior Consultant', actionType: 'LOGIN', moduleName: 'Authentication', recordId: 'sess-9192', recordName: 'Rohan Session', ipAddress: '46.12.98.4', deviceInfo: 'Safari / iPadOS', location: 'Munich, Germany' }, // anomalous location
  { id: 'al-04', timestamp: '2026-06-15 11:20:18', userId: 'u3', username: 'Priya Sharma', roleName: 'Partner CA', actionType: 'MODIFY', moduleName: 'Corporate Secretarial', recordId: 'ap-1', recordName: 'Form ADT-1 Signature status', oldValue: 'REVIEW', newValue: 'APPROVED', ipAddress: '122.161.42.99', deviceInfo: 'Firefox / Windows 11', location: 'Bengaluru, India' },
  { id: 'al-05', timestamp: '2026-06-15 13:05:44', userId: 'u1', username: 'Neha Roy', roleName: 'Article Assistant', actionType: 'DELETE', moduleName: 'Documents', recordId: 'doc-808', recordName: 'Draft_Tax_Balance_Sheet.xlsx', ipAddress: '103.88.24.12', deviceInfo: 'Chrome / MacOS', location: 'New Delhi, India' },
  { id: 'al-06', timestamp: '2026-06-15 14:10:11', userId: 'u4', username: 'Amit Verma', roleName: 'Tax Associate', actionType: 'LOGIN', moduleName: 'Authentication', recordId: 'sess-4412', recordName: 'Amit Session', ipAddress: '157.48.92.21', deviceInfo: 'Edge / Windows 10', location: 'Noida, India' },
  { id: 'al-07', timestamp: '2026-06-15 14:35:00', userId: 'u1', username: 'Neha Roy', roleName: 'Article Assistant', actionType: 'EXPORT', moduleName: 'Documents', recordId: 'all-c1', recordName: 'Bulk export Aegis Infotech Locker files', ipAddress: '103.88.24.12', deviceInfo: 'Chrome / MacOS', location: 'New Delhi, India' } // anomalous count
];

// 3. AI ANOMALY DETECTION ENGINE
export function detectAuditLogAnomalies(logs: AuditLog[]): string[] {
  const anomalies: string[] = [];

  // Check 1: Geographical deviation
  const externalLogins = logs.filter(l => l.actionType === 'LOGIN' && !l.location.includes('India'));
  externalLogins.forEach(login => {
    anomalies.push(`Geographical Login Anomaly: User ${login.username} logged in from unfamiliar country (${login.location}) via IP ${login.ipAddress}.`);
  });

  // Check 2: Bulk downloads or exports
  const exports = logs.filter(l => l.actionType === 'EXPORT');
  exports.forEach(exp => {
    if (exp.recordName.toLowerCase().includes('bulk') || exp.recordName.toLowerCase().includes('all')) {
      anomalies.push(`Bulk Data Portability Flag: User ${exp.username} executed a bulk download export of '${exp.recordName}'. Action logged.`);
    }
  });

  // Check 3: High frequency deletions
  const deletions = logs.filter(l => l.actionType === 'DELETE');
  if (deletions.length >= 3) {
    anomalies.push(`Security Alert: High frequency record deletions detected within the last session window.`);
  }

  return anomalies;
}

// 4. DPDP DATA MINIMIZATION AUDITOR
export function verifyDPDPMinimizeAudit(): {
  redundantFields: string[];
  lastAuditDate: string;
} {
  return {
    redundantFields: [
      'Directors Secondary Passport IDs (collected but never queried/mapped in any filing form)',
      'Client Employee Home Addresses (collected in payroll upload but unused for ECR/EPF registers)'
    ],
    lastAuditDate: '2026-06-15'
  };
}

// 5. 2FA MULTI-METHOD VALIDATOR
export interface TwoFAState {
  method: 'SMS' | 'EMAIL' | 'TOTP' | 'WHATSAPP';
  isMandatory: boolean;
  lockoutAttempts: number;
}

export function verify2FACredentials(
  code: string,
  attempts: number
): {
  success: boolean;
  lockout: boolean;
  remainingAttempts: number;
} {
  const correctCode = '123456'; // mock TOTP / OTP
  const maxAttempts = 5;

  if (attempts >= maxAttempts) {
    return { success: false, lockout: true, remainingAttempts: 0 };
  }

  if (code === correctCode) {
    return { success: true, lockout: false, remainingAttempts: maxAttempts };
  }

  const currentAttempts = attempts + 1;
  const remaining = Math.max(0, maxAttempts - currentAttempts);
  
  return {
    success: false,
    lockout: currentAttempts >= maxAttempts,
    remainingAttempts: remaining
  };
}

// 6. DPDP DATA PROCESSING AGREEMENT CONTRACT GENERATOR
export function generateDPAAgreementText(firmName: string, clientName: string): string {
  return `DATA PROCESSING AGREEMENT (DPA)
Under Section 8 of Digital Personal Data Protection (DPDP) Act, 2023

BETWEEN:
1. ${firmName} (acting as Data Fiduciary)
2. ${clientName} (acting as Data Principal)

IT IS AGREED AS FOLLOWS:
1. Purpose: The Data Fiduciary collects and processes personal identifiers (PAN, GSTIN, Bank transactions, KYC IDs) strictly for fulfilling compliance filing contracts under Companies Act 2013, GST Act 2017, and Income Tax Act 1961.
2. Consent & Limitations: Personal data will not be processed for any secondary marketing or modeling purposes without additional click-through consent logs.
3. Erasure: Upon termination of services, data will be archived for the statutory 7-year retention limit under Indian Tax Laws, after which deletion audits will wipe it from active tables.
4. Security: All data is local-hosted on servers within India.

Signed Electronically:
For Data Fiduciary: CA OS Board Roster
For Data Principal: Accepted via electronic portal signature log.`;
}
