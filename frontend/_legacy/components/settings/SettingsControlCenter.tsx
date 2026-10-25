'use client';

import React, { useState, useEffect } from 'react';
import {
  FirmSettings,
  BrandingConfig,
  IntegrationStatus,
  TemplateConfig,
  FeatureFlag,
  CustomFieldDefinition,
  SystemHealthMetrics,
  INITIAL_FIRM_SETTINGS,
  INITIAL_BRANDING,
  INITIAL_INTEGRATIONS,
  INITIAL_TEMPLATES,
  INITIAL_FEATURE_FLAGS,
  INITIAL_CUSTOM_FIELDS,
  generateSystemHealthMetrics,
  triggerTallySync,
  validateCustomFieldInput,
  compileConfigurationJSON
} from '@/lib/settings/SettingsControlEngine';

// Global Universal Status Badge component mapping to strict status keys
import { UniversalStatusBadge } from '@/components/reports/ReportsExportHub';

// Interfaces for Workflows
interface WorkflowRule {
  id: string;
  name: string;
  trigger: string;
  condition: string;
  action: string;
  isEnabled: boolean;
}

const INITIAL_WORKFLOWS: WorkflowRule[] = [
  { id: 'wf-1', name: 'GST Filing Confirmation', trigger: 'ON_GST_FILED', condition: 'status === "SUCCESS"', action: 'SEND_WHATSAPP_NOTICE', isEnabled: true },
  { id: 'wf-2', name: 'Escrow Payment Auto-Billing', trigger: 'ON_PAYMENT_RECEIVED', condition: 'amount > 50000', action: 'RAISE_INVOICE_DRAFT', isEnabled: true },
  { id: 'wf-3', name: 'Notice Audit SLA Trigger', trigger: 'ON_NOTICE_RECEIVED', condition: 'priority === "HIGH"', action: 'FLAG_AUDIT_TEAM', isEnabled: false }
];

interface SettingsControlCenterProps {
  globalSimulateEmpty?: boolean;
  setGlobalSimulateEmpty?: (val: boolean) => void;
  globalSimulateAiError?: boolean;
  setGlobalSimulateAiError?: (val: boolean) => void;
}

export default function SettingsControlCenter({
  globalSimulateEmpty = false,
  setGlobalSimulateEmpty,
  globalSimulateAiError = false,
  setGlobalSimulateAiError
}: SettingsControlCenterProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'branding' | 'integrations' | 'ai' | 'workflows' | 'templates' | 'fields' | 'health' | 'backups'>('profile');

  // Roster viewports states
  const [isMobile, setIsMobile] = useState(false);
  const [showDesktopBlocker, setShowDesktopBlocker] = useState(false);

  // Profile Empty State Simulation
  const [isEmptyStateActive, setIsEmptyStateActive] = useState(false);

  useEffect(() => {
    if (globalSimulateEmpty !== undefined) {
      setIsEmptyStateActive(globalSimulateEmpty);
    }
  }, [globalSimulateEmpty]);

  // Master State Managers
  const [firmSettings, setFirmSettings] = useState<FirmSettings>(INITIAL_FIRM_SETTINGS);
  const [branding, setBranding] = useState<BrandingConfig>(INITIAL_BRANDING);
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>(INITIAL_INTEGRATIONS);
  const [templates, setTemplates] = useState<TemplateConfig[]>(INITIAL_TEMPLATES);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>(INITIAL_FEATURE_FLAGS);
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>(INITIAL_CUSTOM_FIELDS);
  const [workflows, setWorkflows] = useState<WorkflowRule[]>(INITIAL_WORKFLOWS);
  const [healthMetrics, setHealthMetrics] = useState<SystemHealthMetrics>(generateSystemHealthMetrics());

  // 1. Profile & Branch Sub-States
  const [branches, setBranches] = useState([
    { code: 'MUM-01', name: 'Mumbai Head Office', city: 'Mumbai', partner: 'CA Priya Sharma', contact: '+91 22 88992321' },
    { code: 'DEL-02', name: 'Delhi NCR Desk', city: 'Noida', partner: 'CA Rohan Mehta', contact: '+91 120 7766551' }
  ]);
  const [newBranch, setNewBranch] = useState({ code: '', name: '', city: '', partner: '', contact: '' });
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [bankInfo, setBankInfo] = useState({
    bankName: 'HDFC Bank Limited',
    accountNo: '50200088921102',
    ifsc: 'HDFC0000060',
    branchName: 'Andheri East Branch'
  });

  // 2. Integration Hub Progress Simulation States
  const [syncingService, setSyncingService] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncLogs, setSyncLogs] = useState<string>('System ready. Ready for gateway connection.');

  // 3. AI Config Desk States
  const [aiConfidenceThreshold, setAiConfidenceThreshold] = useState(85);

  // 4. Workflows & Rules States
  const [newRule, setNewRule] = useState({
    name: '',
    trigger: 'ON_GST_FILED',
    condition: 'Always Run',
    action: 'SEND_WHATSAPP_NOTICE'
  });
  const [showAddRule, setShowAddRule] = useState(false);

  // 5. Template Locker States
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('tmp-01');
  const [templateEditorBody, setTemplateEditorBody] = useState<string>('');
  const [templateSubject, setTemplateSubject] = useState<string>('');
  const [templateName, setTemplateName] = useState<string>('');
  const [mockPreviewRendered, setMockPreviewRendered] = useState<string>('');

  // 6. Custom Fields Sub-States
  const [newField, setNewField] = useState({
    entityType: 'CLIENT' as 'CLIENT' | 'EMPLOYEE' | 'DOCUMENT',
    fieldLabel: '',
    fieldType: 'TEXT' as 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT',
    validationRegex: '',
    isRequired: false,
    optionsListRaw: ''
  });
  const [testFieldValues, setTestFieldValues] = useState<Record<string, string>>({});
  const [testFieldErrors, setTestFieldErrors] = useState<Record<string, string>>({});

  // 7. Developer Portal State
  const [apiKeys, setApiKeys] = useState([
    { keyId: 'key_prod_88291a', name: 'Tally AutoSync Service', scope: 'READ_WRITE', rateLimit: '5,000 / day', created: '2026-05-10' },
    { keyId: 'key_sandbox_99218d', name: 'Local Ledger Connector', scope: 'READ_ONLY', rateLimit: '10,000 / day', created: '2026-06-01' }
  ]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScope, setNewKeyScope] = useState('READ_ONLY');

  // 8. White Label DNS Check State
  const [customDomain, setCustomDomain] = useState('portal.mycafirm.in');
  const [dnsStatus, setDnsStatus] = useState({
    cnameVerified: true,
    sslActive: true,
    propagationPercent: 100
  });

  // 9. Backups & Data Retention Policy States
  const [backupRestoreStatus, setBackupRestoreStatus] = useState<string>('');
  const [retentionPolicy, setRetentionPolicy] = useState({
    auditLogMonths: 84, // 7 years statutory
    invoiceMonths: 36,
    documentMonths: 24,
    autoPurgeExpired: true
  });

  // Viewport resize hook
  useEffect(() => {
    const checkSize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  // Generate new health metrics every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setHealthMetrics(generateSystemHealthMetrics());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Update Template editing fields when selection changes
  useEffect(() => {
    const tmpl = templates.find(t => t.id === selectedTemplateId);
    if (tmpl) {
      setTemplateEditorBody(tmpl.bodyTemplate);
      setTemplateSubject(tmpl.subjectTemplate || '');
      setTemplateName(tmpl.name);
    }
  }, [selectedTemplateId, templates]);

  // Update Mock Preview on body changes
  useEffect(() => {
    let text = templateEditorBody;
    const mockVals: Record<string, string> = {
      client_name: 'Apex Enterprises Pvt Ltd',
      invoice_number: 'INV/2026-27/041',
      billing_month: 'May 2026',
      total_amount: '45,800.00',
      payment_link: 'https://razorpay.me/l/apex-551',
      module_name: 'ROC Form MGT-7',
      due_date: '30-10-2026',
      document_list: 'Director KYC, Audited Balance Sheet'
    };

    Object.keys(mockVals).forEach(key => {
      text = text.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), mockVals[key]);
    });
    setMockPreviewRendered(text);
  }, [templateEditorBody]);

  // Profile completion calculation
  const calculateProfileCompletion = () => {
    if (isEmptyStateActive) return 0;
    let score = 0;
    if (firmSettings.financialYearStart) score += 15;
    if (firmSettings.currency) score += 15;
    if (bankInfo.accountNo) score += 20;
    if (bankInfo.ifsc) score += 10;
    if (branches.length > 0) score += 20;
    if (branding.primaryColor) score += 20;
    return score;
  };

  // Branch Handlers
  const handleAddBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranch.code || !newBranch.name) {
      alert('Branch Code and Name are required.');
      return;
    }
    setBranches([...branches, newBranch]);
    setNewBranch({ code: '', name: '', city: '', partner: '', contact: '' });
    setShowAddBranch(false);
  };

  const handleRemoveBranch = (code: string) => {
    setBranches(branches.filter(b => b.code !== code));
  };

  // Sync Simulation Handler
  const handleTriggerSync = (serviceName: string) => {
    setSyncingService(serviceName);
    setSyncProgress(5);
    setSyncLogs(`Initializing sync stream connection for ${serviceName}...`);

    let progress = 5;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 25) + 5;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        const result = triggerTallySync(serviceName);
        setSyncProgress(100);
        setSyncLogs(prev => `${prev}\n[SUCCESS] Synchronization thread complete.\n[METRIC] ${result.syncedRecordsCount} records processed successfully.\n[LOG] ${result.syncLog}`);
        
        // Update lastSyncAt for integrations list
        setIntegrations(prev => prev.map(item => {
          if (item.serviceName === serviceName) {
            return {
              ...item,
              status: 'CONNECTED',
              lastSyncAt: new Date().toLocaleTimeString() + ' (Simulated)'
            };
          }
          return item;
        }));

        setTimeout(() => setSyncingService(null), 1000);
      } else {
        setSyncProgress(progress);
        setSyncLogs(prev => `${prev}\n[SYNCING] Downloading delta pack: ${progress}% complete...`);
      }
    }, 400);
  };

  // Integration Toggle Status
  const handleToggleIntegration = (serviceName: string) => {
    setIntegrations(prev => prev.map(item => {
      if (item.serviceName === serviceName) {
        const nextStatus = item.status === 'CONNECTED' ? 'DISCONNECTED' : 'CONNECTED';
        return { ...item, status: nextStatus };
      }
      return item;
    }));
  };

  // Template Save Handler
  const handleSaveTemplate = () => {
    setTemplates(prev => prev.map(t => {
      if (t.id === selectedTemplateId) {
        return {
          ...t,
          name: templateName,
          subjectTemplate: templateSubject,
          bodyTemplate: templateEditorBody,
          version: t.version + 1
        };
      }
      return t;
    }));
    alert(`Template "${templateName}" saved successfully. Incremented to Version ${templates.find(t => t.id === selectedTemplateId)!.version + 1}.`);
  };

  // Variable insertion in editor
  const handleInsertVariable = (variable: string) => {
    setTemplateEditorBody(prev => prev + ` {{${variable}}}`);
  };

  // Rule Builder Handlers
  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.name.trim()) {
      alert('Please enter a descriptive rule name.');
      return;
    }
    const rule: WorkflowRule = {
      id: `wf-${Date.now()}`,
      name: newRule.name,
      trigger: newRule.trigger,
      condition: newRule.condition,
      action: newRule.action,
      isEnabled: true
    };
    setWorkflows([...workflows, rule]);
    setNewRule({ name: '', trigger: 'ON_GST_FILED', condition: 'Always Run', action: 'SEND_WHATSAPP_NOTICE' });
    setShowAddRule(false);
    alert('Workflow automation rule successfully compiled and added.');
  };

  const handleToggleWorkflow = (id: string) => {
    setWorkflows(prev => prev.map(w => w.id === id ? { ...w, isEnabled: !w.isEnabled } : w));
  };

  const handleDeleteWorkflow = (id: string) => {
    setWorkflows(prev => prev.filter(w => w.id !== id));
  };

  // Custom Field Form Submit
  const handleAddCustomField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newField.fieldLabel.trim()) {
      alert('Label is required');
      return;
    }
    const targetId = `cf-${Date.now()}`;
    const options = newField.optionsListRaw ? newField.optionsListRaw.split(',').map(s => s.trim()) : undefined;
    
    const def: CustomFieldDefinition = {
      id: targetId,
      entityType: newField.entityType,
      fieldLabel: newField.fieldLabel,
      fieldType: newField.fieldType,
      validationRegex: newField.validationRegex || undefined,
      isRequired: newField.isRequired,
      optionsList: options
    };

    setCustomFields([...customFields, def]);
    setNewField({
      entityType: 'CLIENT',
      fieldLabel: '',
      fieldType: 'TEXT',
      validationRegex: '',
      isRequired: false,
      optionsListRaw: ''
    });
    alert(`Custom metadata field "${def.fieldLabel}" added to the ${def.entityType} model template.`);
  };

  const handleRemoveCustomField = (id: string) => {
    setCustomFields(customFields.filter(cf => cf.id !== id));
    // Clear test values
    const cleaned = { ...testFieldValues };
    delete cleaned[id];
    setTestFieldValues(cleaned);
  };

  // Test custom field values validator
  const handleTestFieldInput = (id: string, value: string, definition: CustomFieldDefinition) => {
    setTestFieldValues(prev => ({ ...prev, [id]: value }));
    const check = validateCustomFieldInput(value, definition.validationRegex, definition.isRequired);
    if (!check.valid) {
      setTestFieldErrors(prev => ({ ...prev, [id]: check.message || 'Invalid value format.' }));
    } else {
      setTestFieldErrors(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  // Generate API key
  const handleGenerateApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) {
      alert('Please enter a client context name.');
      return;
    }
    const newK = {
      keyId: `key_${newKeyScope.toLowerCase()}_` + Math.random().toString(36).substring(2, 8),
      name: newKeyName,
      scope: newKeyScope,
      rateLimit: newKeyScope === 'READ_WRITE' ? '5,000 / day' : '15,000 / day',
      created: new Date().toISOString().slice(0, 10)
    };
    setApiKeys([...apiKeys, newK]);
    setNewKeyName('');
    alert(`Developer Credential created: ID ${newK.keyId}. Scope limits applied.`);
  };

  const handleRevokeKey = (keyId: string) => {
    setApiKeys(apiKeys.filter(k => k.keyId !== keyId));
  };

  // DNS State check pinger
  const handleVerifyDNS = () => {
    setDnsStatus({ cnameVerified: false, sslActive: false, propagationPercent: 10 });
    setTimeout(() => {
      setDnsStatus({
        cnameVerified: true,
        sslActive: true,
        propagationPercent: 100
      });
      alert('DNS ping completed. Custom white-labeled domain verified.');
    }, 1000);
  };

  // Backups Serialization & Rollback
  const handleExportConfig = () => {
    const jsonStr = compileConfigurationJSON(firmSettings, branding, featureFlags, customFields);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CAOS_Firm_Settings_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setBackupRestoreStatus(`Exported configuration bundle successfully at ${new Date().toLocaleTimeString()}`);
  };

  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawJson = event.target?.result as string;
        const parsed = JSON.parse(rawJson);
        
        if (parsed.settings && parsed.branding && parsed.flags && parsed.fields) {
          setFirmSettings(parsed.settings);
          setBranding(parsed.branding);
          setFeatureFlags(parsed.flags);
          setCustomFields(parsed.fields);
          setBackupRestoreStatus(`Settings rollback successful! Restored metadata fields and color maps from file timestamp ${parsed.exportedAt}`);
          alert('Configuration rollback applied! Local parameters loaded.');
        } else {
          setBackupRestoreStatus('Error: Selected JSON structure is not a valid CAOS configuration schema.');
        }
      } catch (err) {
        setBackupRestoreStatus('Error: Failed to parse backup file. Please select a valid JSON payload.');
      }
    };
    reader.readAsText(file);
  };

  // Open advanced configurations check warning
  const handleOpenAdvancedAIConfig = () => {
    if (isMobile) {
      setShowDesktopBlocker(true);
    } else {
      alert('Advanced AI Fine-Tuning Console launched successfully.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', fontFamily: 'inherit', color: 'var(--text-primary)' }}>
      
      {/* Header section with setup completion progress */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', letterSpacing: '-0.02em', color: 'var(--primary)' }}>Settings & Configuration Center</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Configure firm identity, document themes, API integrations, workflow rules, white-label client portals, custom field validators, and system backups.</p>
        </div>
        
        {/* Profile Completion / Blocker Config */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', background: 'var(--bg-white)', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow)' }}>
            <input
              type="checkbox"
              checked={isEmptyStateActive}
              onChange={(e) => {
                setIsEmptyStateActive(e.target.checked);
                setGlobalSimulateEmpty?.(e.target.checked);
              }}
              style={{ cursor: 'pointer' }}
            />
            <span>Simulate Empty State</span>
          </label>

          <button
            onClick={handleOpenAdvancedAIConfig}
            className="btn btn-sm btn-secondary"
            style={{ fontWeight: '700' }}
          >
            🤖 Advanced AI Config
          </button>

          <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: 'var(--shadow)' }}>
            <div style={{ position: 'relative', width: '45px', height: '45px', borderRadius: '50%', background: `conic-gradient(var(--success) ${calculateProfileCompletion()}%, var(--bg-gray) 0%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '37px', height: '37px', borderRadius: '50%', background: 'var(--bg-white)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800', color: 'var(--success)' }}>
                {calculateProfileCompletion()}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '700' }}>Setup Completion</div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                {calculateProfileCompletion() === 100 ? 'Firm fully configured' : 'Pending configuration parameters'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', overflowX: 'auto', gap: '4px' }}>
        {[
          { id: 'profile', label: '🏢 Firm Profile & Branches' },
          { id: 'branding', label: '🎨 Branding & Domain' },
          { id: 'integrations', label: '🔌 Integrations Hub' },
          { id: 'ai', label: '🤖 AI Config Desk' },
          { id: 'workflows', label: '⚙️ Workflows & Rules' },
          { id: 'templates', label: '📝 Doc Templates' },
          { id: 'fields', label: '👥 Custom Fields' },
          { id: 'health', label: '🏥 System Health & API' },
          { id: 'backups', label: '💾 Backups & Policies' }
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

        {/* ================= TAB 1: FIRM PROFILE & BRANCHES ================= */}
        {activeTab === 'profile' && (
          isEmptyStateActive ? (
            /* Context Empty state illustration */
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center', gap: '16px' }}>
              <div style={{ fontSize: '64px' }}>🏢</div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary)' }}>Initialize Firm Roster Profile</h3>
                <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '480px', margin: '8px auto 0', lineHeight: '1.5' }}>
                  Register your Chartered Accountant firm identity, corporate PAN keys, bank parameters, and multi-branch offices to coordinate statutory filings.
                </p>
              </div>
              <button
                onClick={() => setIsEmptyStateActive(false)}
                className="btn btn-primary"
                style={{ padding: '10px 24px', fontWeight: '700' }}
              >
                Configure Firm details
              </button>
            </div>
          ) : (
            /* Standard Profile View */
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
              {/* Master Settings & Bank Details */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  ⚙️ Master Global Settings
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>FINANCIAL YEAR START</label>
                    <select
                      value={firmSettings.financialYearStart}
                      onChange={(e) => setFirmSettings({ ...firmSettings, financialYearStart: e.target.value })}
                      style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                    >
                      <option value="04-01">April 1st (Indian Standard FY)</option>
                      <option value="01-01">January 1st (Calendar Year)</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>DEFAULT CURRENCY</label>
                    <select
                      value={firmSettings.currency}
                      onChange={(e) => setFirmSettings({ ...firmSettings, currency: e.target.value })}
                      style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                    >
                      <option value="INR">INR (₹) Rupees</option>
                      <option value="USD">USD ($) Dollars</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>TIMEZONE</label>
                    <input
                      type="text"
                      value={firmSettings.timezone}
                      onChange={(e) => setFirmSettings({ ...firmSettings, timezone: e.target.value })}
                      style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>NUMBER FORMAT</label>
                    <select
                      value={firmSettings.numberFormat}
                      onChange={(e) => setFirmSettings({ ...firmSettings, numberFormat: e.target.value as any })}
                      style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                    >
                      <option value="INDIAN">Lakhs / Crores (e.g. 10,00,000)</option>
                      <option value="INTERNATIONAL">Millions / Billions (e.g. 1,000,000)</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>BUSINESS HOURS START</label>
                    <input
                      type="time"
                      value={firmSettings.businessHoursStart}
                      onChange={(e) => setFirmSettings({ ...firmSettings, businessHoursStart: e.target.value })}
                      style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>BUSINESS HOURS END</label>
                    <input
                      type="time"
                      value={firmSettings.businessHoursEnd}
                      onChange={(e) => setFirmSettings({ ...firmSettings, businessHoursEnd: e.target.value })}
                      style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                    />
                  </div>
                </div>

                <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginTop: '10px' }}>
                  🏦 Corporate Bank Credentials
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>BANK NAME</label>
                    <input
                      type="text"
                      value={bankInfo.bankName}
                      onChange={(e) => setBankInfo({ ...bankInfo, bankName: e.target.value })}
                      style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>ACCOUNT NUMBER</label>
                    <input
                      type="text"
                      value={bankInfo.accountNo}
                      onChange={(e) => setBankInfo({ ...bankInfo, accountNo: e.target.value })}
                      style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>IFSC CODE</label>
                    <input
                      type="text"
                      value={bankInfo.ifsc}
                      onChange={(e) => setBankInfo({ ...bankInfo, ifsc: e.target.value })}
                      style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>BRANCH DETAIL</label>
                    <input
                      type="text"
                      value={bankInfo.branchName}
                      onChange={(e) => setBankInfo({ ...bankInfo, branchName: e.target.value })}
                      style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                    />
                  </div>
                </div>
                <button 
                  onClick={() => alert('Firm Profile configurations updated in persistent scope.')}
                  className="btn btn-primary" 
                  style={{ alignSelf: 'flex-start', marginTop: '10px' }}
                >
                  Save Profile Configuration
                </button>
              </div>

              {/* Branch Management List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="card">
                  <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '14px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '700' }}>📍 Branches & Offices</h3>
                    <button 
                      onClick={() => setShowAddBranch(!showAddBranch)}
                      style={{ padding: '4px 8px', background: 'none', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: '700', color: 'var(--primary)' }}
                    >
                      {showAddBranch ? 'Cancel' : '+ Add Branch'}
                    </button>
                  </div>

                  {showAddBranch && (
                    <form onSubmit={handleAddBranch} style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-light)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '14px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px' }}>
                        <input 
                          type="text" 
                          placeholder="Code" 
                          value={newBranch.code} 
                          onChange={(e) => setNewBranch({ ...newBranch, code: e.target.value })} 
                          style={{ padding: '6px', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '12px' }}
                          required
                        />
                        <input 
                          type="text" 
                          placeholder="Branch Name" 
                          value={newBranch.name} 
                          onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })} 
                          style={{ padding: '6px', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '12px' }}
                          required
                        />
                      </div>
                      <input 
                        type="text" 
                        placeholder="City" 
                        value={newBranch.city} 
                        onChange={(e) => setNewBranch({ ...newBranch, city: e.target.value })} 
                        style={{ padding: '6px', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '12px' }}
                      />
                      <input 
                        type="text" 
                        placeholder="Partner-In-Charge" 
                        value={newBranch.partner} 
                        onChange={(e) => setNewBranch({ ...newBranch, partner: e.target.value })} 
                        style={{ padding: '6px', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '12px' }}
                      />
                      <input 
                        type="text" 
                        placeholder="Contact Number" 
                        value={newBranch.contact} 
                        onChange={(e) => setNewBranch({ ...newBranch, contact: e.target.value })} 
                        style={{ padding: '6px', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '12px' }}
                      />
                      <button type="submit" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>Save Branch</button>
                    </form>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {branches.map(br => (
                      <div key={br.code} style={{ padding: '12px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12.5px', position: 'relative' }}>
                        <button 
                          onClick={() => handleRemoveBranch(br.code)}
                          style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: 'var(--danger)', fontSize: '12px', cursor: 'pointer' }}
                          title="Remove Branch"
                        >
                          🗑️
                        </button>
                        <div style={{ fontWeight: '700', color: 'var(--primary)' }}>{br.name} ({br.code})</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          📍 City: {br.city} | Partner: {br.partner}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>📞 Tel: {br.contact}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        )}

        {/* ================= TAB 2: BRANDING & PORTAL ================= */}
        {activeTab === 'branding' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '20px' }}>
            {/* Customizer */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                🎨 Document Styles & Themes
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: '700' }}>PRIMARY BRAND COLOR</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={branding.primaryColor}
                      onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                      style={{ border: 'none', width: '36px', height: '36px', borderRadius: '4px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '12.5px', fontWeight: '600' }}>{branding.primaryColor}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: '700' }}>SECONDARY BRAND COLOR</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={branding.secondaryColor}
                      onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                      style={{ border: 'none', width: '36px', height: '36px', borderRadius: '4px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '12.5px', fontWeight: '600' }}>{branding.secondaryColor}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: '700' }}>DOCUMENT THEME PRESET</label>
                <select
                  value={branding.documentThemePreset}
                  onChange={(e) => setBranding({ ...branding, documentThemePreset: e.target.value as any })}
                  style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)', fontWeight: '600' }}
                >
                  <option value="PROFESSIONAL">Professional Corporate (Bold Dark Headings)</option>
                  <option value="MODERN">Modern Minimalist (High contrast sans-serif)</option>
                  <option value="CLASSIC">Classic Serif (Chartered Accountant Standard)</option>
                  <option value="ELEGANT">Elegant Navy Gold (Attestation Seal template)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: '700' }}>FIRM LETTERHEAD DETAILS TEXT</label>
                <textarea
                  rows={3}
                  value={branding.letterheadTemplate}
                  onChange={(e) => setBranding({ ...branding, letterheadTemplate: e.target.value })}
                  style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)', resize: 'vertical' }}
                  placeholder="Address, contacts, license codes to appear in headers."
                />
              </div>

              {/* Logo & Seal Upload Simulators */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ padding: '12px', border: '1px dashed var(--border-color)', borderRadius: '8px', textAlign: 'center', background: 'var(--bg-light)' }}>
                  <div style={{ fontSize: '18px', marginBottom: '4px' }}>🏢</div>
                  <div style={{ fontSize: '11px', fontWeight: '700' }}>FIRM LOGO FILE</div>
                  <input
                    type="file"
                    id="logo-upload"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const name = e.target.files?.[0]?.name;
                      if (name) {
                        setBranding({ ...branding, logoUrl: name });
                        alert(`Mock uploaded firm logo file: ${name}`);
                      }
                    }}
                  />
                  <label htmlFor="logo-upload" style={{ display: 'inline-block', marginTop: '6px', padding: '3px 8px', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', background: 'var(--bg-white)', fontWeight: '700' }}>
                    {branding.logoUrl ? branding.logoUrl : 'Select File'}
                  </label>
                </div>

                <div style={{ padding: '12px', border: '1px dashed var(--border-color)', borderRadius: '8px', textAlign: 'center', background: 'var(--bg-light)' }}>
                  <div style={{ fontSize: '18px', marginBottom: '4px' }}>🔏</div>
                  <div style={{ fontSize: '11px', fontWeight: '700' }}>DIGITAL SEAL / STAMP</div>
                  <input
                    type="file"
                    id="stamp-upload"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const name = e.target.files?.[0]?.name;
                      if (name) {
                        setBranding({ ...branding, stampUrl: name });
                        alert(`Mock uploaded attestation seal: ${name}`);
                      }
                    }}
                  />
                  <label htmlFor="stamp-upload" style={{ display: 'inline-block', marginTop: '6px', padding: '3px 8px', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', background: 'var(--bg-white)', fontWeight: '700' }}>
                    {branding.stampUrl ? branding.stampUrl : 'Select File'}
                  </label>
                </div>
              </div>

              {/* White Label domain setup */}
              <h3 style={{ fontSize: '14px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginTop: '10px' }}>
                🌐 White-Label Custom Client Portal
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>CUSTOM PORTAL DOMAIN</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={customDomain}
                      onChange={(e) => setCustomDomain(e.target.value)}
                      style={{ flex: 1, padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                    />
                    <button 
                      onClick={handleVerifyDNS}
                      style={{ padding: '8px 12px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Verify DNS Status
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '10px', background: 'var(--bg-light)', borderRadius: '6px', fontSize: '11px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: dnsStatus.cnameVerified ? 'var(--success)' : 'var(--danger)' }}>{dnsStatus.cnameVerified ? '✔' : '✖'}</span>
                    <span>CNAME verified (points to ca-os.net)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: dnsStatus.sslActive ? 'var(--success)' : 'var(--danger)' }}>{dnsStatus.sslActive ? '✔' : '✖'}</span>
                    <span>SSL Certificate ACTIVE</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>Propagation:</span>
                    <span style={{ fontWeight: '700', color: 'var(--primary)' }}>{dnsStatus.propagationPercent}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Live white-labeled document preview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  📄 Live Document Letterhead Preview
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                  This preview renders dynamically using selected font themes, brand primary color lines, and uploaded metadata assets.
                </p>

                <div style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  background: '#ffffff',
                  minHeight: '340px',
                  padding: '24px',
                  fontFamily: branding.documentThemePreset === 'CLASSIC' ? 'Georgia, serif' : 'inherit',
                  color: '#111827',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}>
                  {/* Top Branding Section */}
                  <div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: `3px solid ${branding.primaryColor}`,
                      paddingBottom: '10px',
                      marginBottom: '16px'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontWeight: '800',
                          fontSize: '15px',
                          color: branding.primaryColor,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}>
                          {branding.letterheadTemplate ? branding.letterheadTemplate.split('\n')[0] : 'CA OS ADVISORY GROUP'}
                        </div>
                        <div style={{
                          fontSize: '10px',
                          color: '#6b7280',
                          marginTop: '4px',
                          whiteSpace: 'pre-line',
                          lineHeight: '1.4'
                        }}>
                          {branding.letterheadTemplate ? branding.letterheadTemplate.split('\n').slice(1).join('\n') : 'Andheri, Mumbai'}
                        </div>
                      </div>
                      
                      {/* Logo placeholder */}
                      <div style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '6px',
                        background: '#f3f4f6',
                        border: '1px solid #e5e7eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '9px',
                        fontWeight: '700',
                        color: '#9ca3af'
                      }}>
                        {branding.logoUrl ? branding.logoUrl.slice(0, 10) + '...' : 'LOGO'}
                      </div>
                    </div>

                    {/* Preview Document Body */}
                    <div style={{ fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                        <span><b>Reference:</b> CA/AUD/2026/089</span>
                        <span><b>Date:</b> {new Date().toLocaleDateString()}</span>
                      </div>

                      <div style={{ textAlign: 'center', fontWeight: '800', textTransform: 'uppercase', fontSize: '13px', color: branding.primaryColor, margin: '12px 0' }}>
                        AUDIT & ATTESTATION REPORT
                      </div>

                      <p style={{ lineHeight: '1.5', color: '#374151', marginBottom: '10px' }}>
                        We have conducted the statutory verification of client accounts under Section 143(3) of the Companies Act, 2013, applying regional guidelines.
                      </p>
                    </div>
                  </div>

                  {/* Stamp & Signatures */}
                  <div style={{ display: 'flex', justifyItems: 'flex-end', justifyContent: 'flex-end', alignItems: 'center', gap: '14px' }}>
                    <div style={{ textAlign: 'center', fontSize: '11px' }}>
                      <div style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        background: '#f3f4f6',
                        border: `1.5px dashed ${branding.secondaryColor}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '8px',
                        color: branding.secondaryColor,
                        fontWeight: '700',
                        margin: '0 auto 4px'
                      }}>
                        {branding.stampUrl ? branding.stampUrl.slice(0, 8) + '..' : 'OFFICIAL SEAL'}
                      </div>
                      <b>Authorized Attestor</b>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: INTEGRATIONS HUB ================= */}
        {activeTab === 'integrations' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
            {/* Integration List */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                🔌 Connected Government Platforms & Tools
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {integrations.map(srv => {
                  const isSyncing = syncingService === srv.serviceName;
                  return (
                    <div key={srv.serviceName} style={{ padding: '14px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '16px' }}>
                            {srv.serviceName.includes('Tally') ? '📊' : srv.serviceName.includes('GSTIN') ? '🧾' : srv.serviceName.includes('Income') ? '📈' : srv.serviceName.includes('Razorpay') ? '💳' : '💬'}
                          </span>
                          <span style={{ fontWeight: '700', fontSize: '13px' }}>{srv.serviceName}</span>
                          <UniversalStatusBadge status={srv.status === 'CONNECTED' ? 'Completed' : 'Not Started'} />
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          Sync Schedule: <b>{srv.syncSchedule}</b>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          onClick={() => handleToggleIntegration(srv.serviceName)}
                          className={`btn btn-sm ${srv.status === 'CONNECTED' ? 'btn-secondary' : 'btn-primary'}`}
                          disabled={isSyncing}
                        >
                          {srv.status === 'CONNECTED' ? 'Disconnect' : 'Connect'}
                        </button>
                        
                        {srv.status === 'CONNECTED' && !srv.serviceName.includes('Webhook') && (
                          <button
                            onClick={() => handleTriggerSync(srv.serviceName)}
                            className="btn btn-sm btn-success"
                            disabled={isSyncing}
                          >
                            {isSyncing ? 'Syncing...' : 'Sync Now'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sync Progress Logs Terminal */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card" style={{ background: '#0F172A', border: '1px solid #1E293B', color: '#38BDF8', fontFamily: 'monospace', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1E293B', paddingBottom: '8px' }}>
                  <span style={{ color: '#E2E8F0', fontWeight: '700', fontSize: '13px' }}>📡 Sync Stream Console logs</span>
                  <span style={{ color: '#F1F5F9', fontSize: '11px', background: '#1E293B', padding: '2px 8px', borderRadius: '4px' }}>TallyPrime API v3.4</span>
                </div>

                {syncingService && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#94A3B8' }}>
                      <span>Syncing: <b>{syncingService}</b></span>
                      <span>{syncProgress}%</span>
                    </div>
                    <div style={{ height: '6px', background: '#1E293B', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${syncProgress}%`, background: '#38BDF8', transition: 'width 0.2s ease' }} />
                    </div>
                  </div>
                )}

                <textarea
                  readOnly
                  rows={12}
                  value={syncLogs}
                  style={{
                    background: '#020617',
                    border: '1px solid #1E293B',
                    borderRadius: '6px',
                    color: '#A7F3D0',
                    fontSize: '11px',
                    padding: '10px',
                    resize: 'none',
                    fontFamily: 'monospace'
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: AI CONFIG DESK ================= */}
        {activeTab === 'ai' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Threshold sliders */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                🤖 AI Confidence & Threshold Rules
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                Set the minimum confidence threshold required before the system automatically approves GST mappings, parses invoice PDF files, or auto-classifies ledger codes.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '10px 0' }}>
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', fontSize: '12.5px' }}>
                  <span><b>Auto-Approve OCR Threshold:</b></span>
                  <span style={{ color: 'var(--primary)', fontWeight: '800', fontSize: '14px' }}>{aiConfidenceThreshold}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="98"
                  value={aiConfidenceThreshold}
                  onChange={(e) => setAiConfidenceThreshold(Number(e.target.value))}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>

              {/* Threshold status badge */}
              <div style={{
                padding: '12px',
                background: aiConfidenceThreshold >= 90 ? 'rgba(39, 174, 96, 0.08)' : 'var(--primary-light)',
                border: aiConfidenceThreshold >= 90 ? '1px solid rgba(39, 174, 96, 0.2)' : '1.5px solid var(--primary)',
                borderRadius: '8px',
                fontSize: '12.5px'
              }}>
                <div style={{ fontWeight: '700', color: aiConfidenceThreshold >= 90 ? 'var(--success)' : 'var(--primary)', marginBottom: '4px' }}>
                  {aiConfidenceThreshold >= 90 ? '✔ High Confidence Mode Active' : '⚡ Balanced Operation Mode'}
                </div>
                {aiConfidenceThreshold >= 90 
                  ? 'All automated ledger transactions undergo heavy dual-verify checks. Reduces errors but flags more items for human verification.'
                  : 'Standard balance of automatic classification and moderate anomaly checks. Ideal for general monthly accounting workflows.'
                }
              </div>

              {/* Global Simulator Controls */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--primary)' }}>🎛️ Global Simulator Controls</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'space-between', padding: '10px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer' }}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '12.5px', color: 'var(--text-primary)' }}>Simulate Global Empty States</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Forces all 12 modules into empty state screens.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isEmptyStateActive}
                      onChange={(e) => {
                        setIsEmptyStateActive(e.target.checked);
                        setGlobalSimulateEmpty?.(e.target.checked);
                      }}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'space-between', padding: '10px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer' }}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '12.5px', color: 'var(--text-primary)' }}>Simulate AI Fallbacks / Errors</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Triggers AI errors, portal downtimes, and manual overrides.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={globalSimulateAiError}
                      onChange={(e) => {
                        setGlobalSimulateAiError?.(e.target.checked);
                      }}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* AI Flags Toggles with AI Visual Language Accent */}
            <div style={{
              background: '#F5F3FF', // AI Background Color
              border: '1.5px solid #DDD6FE',
              borderLeft: '4px solid #7C3AED', // AI Left 3px Border Accent
              borderRadius: '12px',
              padding: '24px',
              boxShadow: 'var(--shadow)',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: '#7C3AED',
                color: '#fff',
                fontSize: '9.5px',
                fontWeight: '800',
                padding: '2px 8px',
                borderRadius: '10px'
              }}>
                ✨ AI PLATFORM FLAGS
              </div>

              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#5B21B6', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                ✨ Dynamic Cognitive Features Flags
              </h3>
              
              <p style={{ fontSize: '12.5px', color: '#6D28D9', marginBottom: '14px' }}>
                Suggested by AI. Click to accept or modify toggles.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {featureFlags.map(flag => (
                  <label 
                    key={flag.flagKey} 
                    title="Suggested by AI. Click to accept or modify."
                    style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#ffffff', borderRadius: '8px', border: '1px solid #DDD6FE', cursor: 'help' }}
                  >
                    <div style={{ flex: 1, paddingRight: '12px' }}>
                      <div style={{ fontWeight: '700', fontSize: '12.5px', color: '#4C1D95' }}>
                        {flag.flagKey.replace(/_/g, ' ')}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6D28D9', marginTop: '2px' }}>{flag.description}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={flag.isEnabled}
                        onChange={() => {
                          setFeatureFlags(prev => prev.map(f => f.flagKey === flag.flagKey ? { ...f, isEnabled: !f.isEnabled } : f));
                        }}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 5: WORKFLOWS & RULES ================= */}
        {activeTab === 'workflows' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
            {/* Active Rule Chart List */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700' }}>⛓️ Active Trigger-Action Workflows</h3>
                <button
                  onClick={() => setShowAddRule(!showAddRule)}
                  className="btn btn-sm btn-secondary"
                >
                  {showAddRule ? 'Cancel' : '+ Create Rule'}
                </button>
              </div>

              {/* rule items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {workflows.map(wf => (
                  <div key={wf.id} style={{
                    padding: '16px',
                    border: '1.5px solid var(--border-color)',
                    borderRadius: '8px',
                    background: 'var(--bg-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--primary)' }}>{wf.name}</span>
                      
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={wf.isEnabled}
                          onChange={() => handleToggleWorkflow(wf.id)}
                          style={{ cursor: 'pointer' }}
                        />
                        <UniversalStatusBadge status={wf.isEnabled ? 'Completed' : 'On Hold'} />
                        
                        <button 
                          onClick={() => handleDeleteWorkflow(wf.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '12px', cursor: 'pointer', marginLeft: '6px' }}
                          title="Delete Rule"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'var(--bg-white)',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      fontSize: '11px',
                      overflowX: 'auto'
                    }}>
                      <div style={{ padding: '4px 8px', background: 'var(--primary-light)', borderRadius: '4px', fontWeight: '700' }}>
                        ⚡ TRIGGER: {wf.trigger}
                      </div>
                      <span style={{ color: 'var(--text-light)' }}>➔</span>
                      <div style={{ padding: '4px 8px', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '4px', color: '#D97706', fontWeight: '700' }}>
                        IF: {wf.condition}
                      </div>
                      <span style={{ color: 'var(--text-light)' }}>➔</span>
                      <div style={{ padding: '4px 8px', background: 'var(--success-light)', borderRadius: '4px', color: 'var(--success)', fontWeight: '700' }}>
                        🎬 ACTION: {wf.action}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rule Builder Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card">
                <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '14px' }}>
                  ⚡ Visual Rule Compiler
                </h3>

                <form onSubmit={handleCreateRule} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>RULE NAME</label>
                    <input
                      type="text"
                      placeholder="e.g. GST Notice SMS Alert"
                      value={newRule.name}
                      onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                      style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>SELECT EVENT TRIGGER</label>
                    <select
                      value={newRule.trigger}
                      onChange={(e) => setNewRule({ ...newRule, trigger: e.target.value })}
                      style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                    >
                      <option value="ON_GST_FILED">On GST Filing Successfully Completed</option>
                      <option value="ON_PAYMENT_RECEIVED">On ESCROW Invoice Payment Clear</option>
                      <option value="ON_NOTICE_RECEIVED">On Income Tax Notice Registry Received</option>
                      <option value="ON_CLIENT_ONBOARDED">On New Client KYC Verification</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>FILTER CONDITIONS</label>
                    <input
                      type="text"
                      placeholder="e.g. amount > 100000 or status === 'SUCCESS'"
                      value={newRule.condition}
                      onChange={(e) => setNewRule({ ...newRule, condition: e.target.value })}
                      style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>EXECUTE COMPLIANCE ACTION</label>
                    <select
                      value={newRule.action}
                      onChange={(e) => setNewRule({ ...newRule, action: e.target.value })}
                      style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                    >
                      <option value="SEND_WHATSAPP_NOTICE">Send WhatsApp Client Notification</option>
                      <option value="RAISE_INVOICE_DRAFT">Create Draft GST Advisory Invoice</option>
                      <option value="FLAG_AUDIT_TEAM">Flag Partner Audit Escalation Checklist</option>
                      <option value="EMAIL_SUMMARY">Send PDF Summary Ledger Email</option>
                    </select>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', marginTop: '6px' }}>
                    Save & Initialize Rule
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 6: DOCUMENT TEMPLATES ================= */}
        {activeTab === 'templates' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px' }}>
            {/* Template Selector */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                📁 Communication Templates Locker
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {templates.map(tmpl => (
                  <button
                    key={tmpl.id}
                    onClick={() => setSelectedTemplateId(tmpl.id)}
                    style={{
                      padding: '12px',
                      background: selectedTemplateId === tmpl.id ? 'var(--primary-light)' : 'var(--bg-white)',
                      border: selectedTemplateId === tmpl.id ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
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
                      <span style={{ fontWeight: '700', fontSize: '13px', color: selectedTemplateId === tmpl.id ? 'var(--primary)' : 'var(--text-primary)' }}>
                        {tmpl.name}
                      </span>
                      <span className="badge badge-gray" style={{ fontSize: '8px' }}>v{tmpl.version}</span>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                      Namespace: <b>{tmpl.templateType}</b>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Template Editor */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                📝 Edit Template Configuration
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>TEMPLATE DISCLOSURE NAME</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                />
              </div>

              {templateSubject !== '' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>EMAIL SUBJECT LINE</label>
                  <input
                    type="text"
                    value={templateSubject}
                    onChange={(e) => setTemplateSubject(e.target.value)}
                    style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>TEMPLATE BODY</label>
                </div>
                
                {/* Clickable Variable inserts */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '4px 0', padding: '6px', background: 'var(--bg-gray)', borderRadius: '6px' }}>
                  {templates.find(t => t.id === selectedTemplateId)?.variables.map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => handleInsertVariable(v)}
                      style={{ padding: '3px 8px', background: 'var(--bg-white)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '10.5px', cursor: 'pointer', fontWeight: '600' }}
                    >
                      +{v}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={8}
                  value={templateEditorBody}
                  onChange={(e) => setTemplateEditorBody(e.target.value)}
                  style={{ padding: '10px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)', fontFamily: 'monospace', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
                <button onClick={handleSaveTemplate} className="btn btn-primary">
                  Save Template Changes
                </button>
              </div>

              {/* Dynamic live simulation output */}
              <div style={{ background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px', marginTop: '10px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '6px' }}>👁️ LIVE SIMULATED PARSER PREVIEW</div>
                <div style={{
                  fontSize: '12.5px',
                  whiteSpace: 'pre-wrap',
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-white)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '12px'
                }}>
                  {mockPreviewRendered}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 7: CUSTOM FIELDS & FLAGS ================= */}
        {activeTab === 'fields' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
            {/* Custom Field List and preview emulator */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                👥 Active Custom Metadata Fields
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {customFields.map(cf => (
                  <div key={cf.id} style={{ padding: '14px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '8px', position: 'relative' }}>
                    <button
                      onClick={() => handleRemoveCustomField(cf.id)}
                      style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: 'var(--danger)', fontSize: '12px', cursor: 'pointer' }}
                      title="Remove Field"
                    >
                      🗑️
                    </button>
                    <div style={{ fontWeight: '700', fontSize: '13px' }}>{cf.fieldLabel}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '11px', marginTop: '4px' }}>
                      <span className="badge badge-indigo" style={{ fontSize: '8px' }}>Scope: {cf.entityType}</span>
                      <span className="badge badge-gray" style={{ fontSize: '8px' }}>Type: {cf.fieldType}</span>
                      {cf.isRequired && <span className="badge badge-danger" style={{ fontSize: '8px' }}>Required</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Dynamic Client Form Emulator */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '10px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '10px', color: 'var(--primary)' }}>
                  🖥️ Live Client Workspace Form Emulator
                </h4>

                <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {customFields.map(cf => (
                    <div key={cf.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '700' }}>
                        {cf.fieldLabel} {cf.isRequired && <span style={{ color: 'var(--danger)' }}>*</span>}
                      </label>

                      {cf.fieldType === 'SELECT' ? (
                        <select
                          value={testFieldValues[cf.id] || ''}
                          onChange={(e) => handleTestFieldInput(cf.id, e.target.value, cf)}
                          style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                        >
                          <option value="">-- Choose Option --</option>
                          {cf.optionsList?.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input
                          type={cf.fieldType === 'NUMBER' ? 'number' : cf.fieldType === 'DATE' ? 'date' : 'text'}
                          value={testFieldValues[cf.id] || ''}
                          onChange={(e) => handleTestFieldInput(cf.id, e.target.value, cf)}
                          placeholder={cf.validationRegex ? `Matches pattern: ${cf.validationRegex}` : 'Enter value'}
                          style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                        />
                      )}

                      {testFieldErrors[cf.id] && (
                        <span style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: '700' }}>
                          ✖ {testFieldErrors[cf.id]}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Custom Field Definition compiler */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card">
                <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '14px' }}>
                  🔨 Custom Field Schema Builder
                </h3>

                <form onSubmit={handleAddCustomField} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>FIELD TYPE SCOPE</label>
                    <select
                      value={newField.entityType}
                      onChange={(e) => setNewField({ ...newField, entityType: e.target.value as any })}
                      style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                    >
                      <option value="CLIENT">Client Profile Template</option>
                      <option value="EMPLOYEE">Employee Payroll Template</option>
                      <option value="DOCUMENT">Document Locker Metadata</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>FIELD LABEL NAME</label>
                    <input
                      type="text"
                      placeholder="e.g. GST Registration Date"
                      value={newField.fieldLabel}
                      onChange={(e) => setNewField({ ...newField, fieldLabel: e.target.value })}
                      style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>INPUT CONTROL VIEW</label>
                    <select
                      value={newField.fieldType}
                      onChange={(e) => setNewField({ ...newField, fieldType: e.target.value as any })}
                      style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                    >
                      <option value="TEXT">Short Text input</option>
                      <option value="NUMBER">Numeric values</option>
                      <option value="DATE">Calendar Date Selector</option>
                      <option value="SELECT">Single-Select Dropdown</option>
                    </select>
                  </div>

                  {newField.fieldType === 'SELECT' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>OPTIONS LIST (COMMA SEPARATED)</label>
                      <input
                        type="text"
                        placeholder="e.g. Option A, Option B, Option C"
                        value={newField.optionsListRaw}
                        onChange={(e) => setNewField({ ...newField, optionsListRaw: e.target.value })}
                        style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                      />
                    </div>
                  )}

                  {newField.fieldType === 'TEXT' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>VALIDATION REGEX TEMPLATE</label>
                      <input
                        type="text"
                        placeholder="e.g. ^[A-Z]{5}[0-9]{4}[A-Z]{1}$ (For PAN IDs)"
                        value={newField.validationRegex}
                        onChange={(e) => setNewField({ ...newField, validationRegex: e.target.value })}
                        style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)', fontFamily: 'monospace' }}
                      />
                    </div>
                  )}

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '6px', fontSize: '12.5px' }}>
                    <input
                      type="checkbox"
                      checked={newField.isRequired}
                      onChange={(e) => setNewField({ ...newField, isRequired: e.target.checked })}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>Force user input validation (Required Field)</span>
                  </label>

                  <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', marginTop: '8px' }}>
                    Deploy Custom Field
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 8: SYSTEM HEALTH & API ================= */}
        {activeTab === 'health' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
            {/* Health indicators */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700' }}>🏥 Live Host Node Performance</h3>
                <UniversalStatusBadge status="Completed" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* CPU Utilization */}
                <div style={{ padding: '12px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '4px' }}>HOST CPU UTILIZATION</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--primary)' }}>{healthMetrics.cpuUtilization}%</div>
                </div>

                {/* Memory Utilization */}
                <div style={{ padding: '12px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '4px' }}>RAM ALLOCATION</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--primary)' }}>{healthMetrics.memoryUtilization}%</div>
                </div>

                {/* DB Connections */}
                <div style={{ padding: '12px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '4px' }}>DB CONNECTION POOL</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--primary)' }}>{healthMetrics.dbConnectionCount} active</div>
                </div>

                {/* API Response Time */}
                <div style={{ padding: '12px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '4px' }}>API LATENCY (P95)</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--success)' }}>{healthMetrics.apiResponseTimeMs} ms</div>
                </div>
              </div>
            </div>

            {/* Developer credentials console */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  🔑 Developer API Credential Manager
                </h3>

                <form onSubmit={handleGenerateApiKey} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="e.g. Office Tally Server"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    style={{ flex: 1, minWidth: '150px', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                    required
                  />
                  <select
                    value={newKeyScope}
                    onChange={(e) => setNewKeyScope(e.target.value)}
                    style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                  >
                    <option value="READ_ONLY">Read Only</option>
                    <option value="READ_WRITE">Read Write</option>
                  </select>
                  <button type="submit" className="btn btn-primary btn-sm">Generate Key</button>
                </form>

                {/* API Key lists */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                  {apiKeys.map(k => (
                    <div key={k.keyId} style={{ padding: '12px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px', position: 'relative' }}>
                      <button
                        onClick={() => handleRevokeKey(k.keyId)}
                        style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: 'var(--danger)', fontSize: '12px', cursor: 'pointer' }}
                        title="Revoke Token"
                      >
                        Revoke
                      </button>
                      <div style={{ fontWeight: '700' }}>{k.name}</div>
                      <div style={{ fontFamily: 'monospace', color: 'var(--primary)', marginTop: '2px', fontSize: '11px' }}>{k.keyId}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 9: BACKUPS & POLICIES ================= */}
        {activeTab === 'backups' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Serialization and Rollback */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                💾 Configuration Backup & Rollback Checkpoint
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                Serialize and download all your firm branding preferences, custom field definitions, and feature configurations into a local JSON archive. Upload a saved checkpoint file to restore settings immediately.
              </p>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={handleExportConfig}
                  className="btn btn-primary"
                >
                  📥 Download Config JSON Bundle
                </button>

                <div style={{ position: 'relative' }}>
                  <input
                    type="file"
                    id="restore-upload"
                    accept=".json"
                    onChange={handleImportConfig}
                    style={{ display: 'none' }}
                  />
                  <label
                    htmlFor="restore-upload"
                    className="btn btn-secondary"
                    style={{ cursor: 'pointer', display: 'inline-block' }}
                  >
                    📤 Restore / Upload Checkpoint
                  </label>
                </div>
              </div>

              {backupRestoreStatus && (
                <div style={{
                  padding: '12px',
                  background: backupRestoreStatus.includes('Error') ? 'rgba(192, 57, 43, 0.08)' : 'var(--primary-light)',
                  border: backupRestoreStatus.includes('Error') ? '1px solid rgba(192, 57, 43, 0.2)' : '1.5px solid var(--primary)',
                  color: backupRestoreStatus.includes('Error') ? 'var(--danger)' : 'var(--text-primary)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  lineHeight: '1.4'
                }}>
                  {backupRestoreStatus}
                </div>
              )}
            </div>

            {/* GDPR & DPDP Retention policies */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                ⚖️ GDPR & Indian DPDP Data Retention Policies
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                Set retention locks for client records. Retained databases are stored in write-once-read-many (WORM) storage zones for auditing, then automatically purged.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700' }}>IMMUTABLE AUDIT LOGS RETENTION</label>
                  <select
                    value={retentionPolicy.auditLogMonths}
                    onChange={(e) => setRetentionPolicy({ ...retentionPolicy, auditLogMonths: Number(e.target.value) })}
                    style={{ padding: '6px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                  >
                    <option value="84">7 Years (Statutory Minimum)</option>
                    <option value="120">10 Years (Extended Audits)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700' }}>CLIENT INVOICES & PAYMENTS RETENTION</label>
                  <select
                    value={retentionPolicy.invoiceMonths}
                    onChange={(e) => setRetentionPolicy({ ...retentionPolicy, invoiceMonths: Number(e.target.value) })}
                    style={{ padding: '6px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                  >
                    <option value="36">3 Years (Standard Limitation)</option>
                    <option value="60">5 Years (Audit Reference)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700' }}>AUXILIARY KYC & UPLOADED DOCUMENTS</label>
                  <select
                    value={retentionPolicy.documentMonths}
                    onChange={(e) => setRetentionPolicy({ ...retentionPolicy, documentMonths: Number(e.target.value) })}
                    style={{ padding: '6px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12.5px', background: 'var(--bg-light)' }}
                  >
                    <option value="24">2 Years Post Client-Exit</option>
                    <option value="12">1 Year Post Client-Exit</option>
                  </select>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '6px', fontSize: '12.5px' }}>
                  <input
                    type="checkbox"
                    checked={retentionPolicy.autoPurgeExpired}
                    onChange={(e) => setRetentionPolicy({ ...retentionPolicy, autoPurgeExpired: e.target.checked })}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>Automatically execute background script to purge expired data subject profiles</span>
                </label>

                <button 
                  onClick={() => alert('Data retention policies saved and locked to compliance engine.')}
                  className="btn btn-primary" 
                  style={{ alignSelf: 'flex-start', marginTop: '6px' }}
                >
                  Lock Retention Policies
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

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
            <div style={{ fontSize: '48px' }}>🤖</div>
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--primary)' }}>Desktop Platform Required</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              “Please use a desktop device for the best experience.”
            </p>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
              Advanced AI Fine-Tuning controls operate only on larger desktop display monitors.
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

    </div>
  );
}
