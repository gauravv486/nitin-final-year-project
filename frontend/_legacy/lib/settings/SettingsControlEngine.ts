// Settings & Configuration Logic Engine

export interface FirmSettings {
  financialYearStart: string;
  currency: string;
  timezone: string;
  dateFormat: string;
  numberFormat: 'INDIAN' | 'INTERNATIONAL';
  businessHoursStart: string;
  businessHoursEnd: string;
}

export interface BrandingConfig {
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
  stampUrl?: string;
  letterheadTemplate?: string;
  documentThemePreset: 'PROFESSIONAL' | 'MODERN' | 'CLASSIC' | 'ELEGANT';
}

export interface IntegrationStatus {
  serviceName: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  syncSchedule: string;
  lastSyncAt?: string;
  errorLogs?: string;
}

export interface TemplateConfig {
  id: string;
  templateType: 'INVOICE' | 'EMAIL' | 'WHATSAPP' | 'PAYSLIP' | 'RESOLUTION';
  name: string;
  subjectTemplate?: string;
  bodyTemplate: string;
  variables: string[];
  version: number;
}

export interface FeatureFlag {
  flagKey: string;
  description: string;
  isEnabled: boolean;
  rolloutPercentage: number;
}

export interface CustomFieldDefinition {
  id: string;
  entityType: 'CLIENT' | 'EMPLOYEE' | 'DOCUMENT';
  fieldLabel: string;
  fieldType: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT';
  validationRegex?: string;
  isRequired: boolean;
  optionsList?: string[];
}

export interface SystemHealthMetrics {
  cpuUtilization: number;
  memoryUtilization: number;
  dbConnectionCount: number;
  activeJobsQueue: number;
  apiResponseTimeMs: number;
  storageUsedBytes: number;
  healthScore: number;
}

// 1. Initial Mock Settings Datasets
export const INITIAL_FIRM_SETTINGS: FirmSettings = {
  financialYearStart: '04-01',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  dateFormat: 'DD-MM-YYYY',
  numberFormat: 'INDIAN',
  businessHoursStart: '09:00:00',
  businessHoursEnd: '18:00:00'
};

export const INITIAL_BRANDING: BrandingConfig = {
  primaryColor: '#1e3a8a', // deep blue
  secondaryColor: '#10b981', // emerald green
  documentThemePreset: 'PROFESSIONAL',
  letterheadTemplate: 'CA OS ADVISORY GROUP\nPlot No. 45, MIDC Andheri East, Mumbai - 400093\nEmail: contact@caos.in | Tel: +91 22 88992321'
};

export const INITIAL_INTEGRATIONS: IntegrationStatus[] = [
  { serviceName: 'Tally Prime Gateway', status: 'CONNECTED', syncSchedule: 'Every day at 12:00 AM', lastSyncAt: '2026-06-15 00:00 AM' },
  { serviceName: 'GSTIN Government Portal', status: 'CONNECTED', syncSchedule: 'Every 6 hours', lastSyncAt: '2026-06-15 06:00 PM' },
  { serviceName: 'CBDT Income Tax Gateway', status: 'CONNECTED', syncSchedule: 'Every 12 hours', lastSyncAt: '2026-06-15 12:00 PM' },
  { serviceName: 'Razorpay Escrow Webhook', status: 'CONNECTED', syncSchedule: 'Real-time Webhook sync', lastSyncAt: 'Just now' },
  { serviceName: 'WhatsApp Cloud API Client', status: 'DISCONNECTED', syncSchedule: 'Real-time API sync' }
];

export const INITIAL_TEMPLATES: TemplateConfig[] = [
  { id: 'tmp-01', templateType: 'INVOICE', name: 'Standard GST Invoice Template', bodyTemplate: 'Dear {{client_name}},\n\nKindly find attached invoice #{{invoice_number}} for services rendered during {{billing_month}}.\n\nTotal Fee (with 18% GST): ₹{{total_amount}}\nPayment Link: {{payment_link}}\n\nWarm regards,\nCA OS Advisory Group', variables: ['client_name', 'invoice_number', 'billing_month', 'total_amount', 'payment_link'], version: 2 },
  { id: 'tmp-02', templateType: 'EMAIL', name: 'Statutory Document Request Follow-up', subjectTemplate: 'Action Required: Pending Compliance Documents - {{client_name}}', bodyTemplate: 'Dear Directors,\n\nOur compliance calendar indicates the filing deadline for your {{module_name}} is approaching on {{due_date}}.\n\nPlease upload the pending records listed under your portal locker: {{document_list}}.\n\nBest,\nAdvisory Team', variables: ['client_name', 'module_name', 'due_date', 'document_list'], version: 1 }
];

export const INITIAL_FEATURE_FLAGS: FeatureFlag[] = [
  { flagKey: 'AI_DOCUMENT_OCR_PARSING', description: 'Enable automated AI OCR parsing of uploaded client tax files.', isEnabled: true, rolloutPercentage: 100 },
  { flagKey: 'BENFORDS_FORENSIC_SCRUTINY', description: 'Enable forensic Benfords anomaly detection on transactions ledger.', isEnabled: true, rolloutPercentage: 100 },
  { flagKey: 'WHATSAPP_AUTOMATED_NOTICES', description: 'Trigger automatic WhatsApp reminders on government circular updates.', isEnabled: false, rolloutPercentage: 0 },
  { flagKey: 'VOICE_ASSISTANT_REPORTS_BETA', description: 'Conversational audio reports generator in portal sidebar.', isEnabled: false, rolloutPercentage: 10 }
];

export const INITIAL_CUSTOM_FIELDS: CustomFieldDefinition[] = [
  { id: 'cf-01', entityType: 'CLIENT', fieldLabel: 'Director Spouse PAN ID', fieldType: 'TEXT', validationRegex: '^[A-Z]{5}[0-9]{4}[A-Z]{1}$', isRequired: false },
  { id: 'cf-02', entityType: 'DOCUMENT', fieldLabel: 'Government Letter Section Code', fieldType: 'SELECT', optionsList: ['Sec 143(1)', 'Sec 148', 'Sec 61 (GST)', 'Sec 73 (GST)'], isRequired: true }
];

// 2. SYSTEM HEALTH METRICS GENERATOR
export function generateSystemHealthMetrics(): SystemHealthMetrics {
  // Simulate active host server parameters
  const cpu = parseFloat((Math.random() * 20 + 15).toFixed(2)); // 15-35%
  const mem = parseFloat((Math.random() * 15 + 40).toFixed(2)); // 40-55%
  const dbConns = Math.floor(Math.random() * 10) + 14; // 14-24 connections
  const queueJobs = Math.floor(Math.random() * 5); // 0-5 jobs
  const responseTime = Math.floor(Math.random() * 50) + 80; // 80-130ms
  
  // Storage: 42.6 GB of 100 GB
  const storageUsed = 45789230112; 

  const healthScore = Math.round(100 - (cpu * 0.2 + mem * 0.2 + queueJobs * 2));

  return {
    cpuUtilization: cpu,
    memoryUtilization: mem,
    dbConnectionCount: dbConns,
    activeJobsQueue: queueJobs,
    apiResponseTimeMs: responseTime,
    storageUsedBytes: storageUsed,
    healthScore
  };
}

// 3. TALLY PRIME & GOVERNMENT API SYNC SIMULATOR
export function triggerTallySync(serviceName: string): {
  success: boolean;
  syncedRecordsCount: number;
  syncLog: string;
} {
  const count = Math.floor(Math.random() * 120) + 10;
  return {
    success: true,
    syncedRecordsCount: count,
    syncLog: `Initiated sync thread. Contacting gateway node. Synced ${count} client ledger mappings and updated account balances.`
  };
}

// 4. CUSTOM FIELDS VALUE VALIDATOR
export function validateCustomFieldInput(
  value: string,
  regex?: string,
  required?: boolean
): {
  valid: boolean;
  message?: string;
} {
  if (required && !value.trim()) {
    return { valid: false, message: 'This custom field is required.' };
  }

  if (value.trim() && regex) {
    const reg = new RegExp(regex);
    if (!reg.test(value)) {
      return { valid: false, message: 'Value does not match validation regex template.' };
    }
  }

  return { valid: true };
}

// 5. CONFIGURATION SERIALIZER
export function compileConfigurationJSON(
  settings: FirmSettings,
  branding: BrandingConfig,
  flags: FeatureFlag[],
  fields: CustomFieldDefinition[]
): string {
  const payload = {
    settings,
    branding,
    flags,
    fields,
    exportedAt: new Date().toISOString(),
    schemaVersion: 1.5
  };
  return JSON.stringify(payload, null, 2);
}
