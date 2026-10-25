'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from '@/lib/theme-context';
import Gstr2bMatchingGrid from '@/components/gst/Gstr2bMatchingGrid';
import BenfordsForensicDashboard from '@/components/audit/BenfordsForensicDashboard';
import NoticeDraftingPanel from '@/components/litigation/NoticeDraftingPanel';
import ClientOnboardingWizard from '@/components/onboarding/ClientOnboardingWizard';
import PayrollConsole from '@/components/payroll/PayrollConsole';
import CorporateSecretarialManager from '@/components/secretarial/CorporateSecretarialManager';
import ComplianceIntelCenter from '@/components/compliance/ComplianceIntelCenter';
import CollaborationHub from '@/components/collaboration/CollaborationHub';
import SecurityAdminConsole from '@/components/admin/SecurityAdminConsole';
import SettingsControlCenter from '@/components/settings/SettingsControlCenter';
import ReportsExportHub from '@/components/reports/ReportsExportHub';
import AIInvoiceAnalysisModal from '@/components/ai-dashboard/AIInvoiceAnalysisModal';

// Enterprise Dashboard Reusable UI Components
import DashboardCard from '@/components/ui/DashboardCard';
import ClickableWidget from '@/components/ui/ClickableWidget';
import NavigationAction from '@/components/ui/NavigationAction';
import ContextMenu from '@/components/ui/ContextMenu';
import CommandPalette from '@/components/ui/CommandPalette';
import TaskDetailsModal from '@/components/ui/TaskDetailsModal';
import ClientProfileView from '@/components/ui/ClientProfileView';
import { ROUTES, isRouteAllowed } from '@/lib/routes';
import {
  generateMockExpenseCategories,
  generateMockLedgers,
  generateMockComplianceDeadlines,
  calculateRiskScore,
  generateFinancialInsights,
  type ExpenseCategory,
  type LedgerAccount,
  type ComplianceDeadline,
  type RiskScoreTransaction,
  type FinancialInsight,
  type Document,
} from '@/lib/ai-models';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
}

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
  assignedStaffId?: string;
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

// Mock data
const mockClients: Client[] = [
  { id: '1', name: 'Arora Trading Co.', email: 'arora@trade.com', gstin: '27AAACA1234F1Z5', type: 'Proprietor', gstStatus: 'filed', itrStatus: 'pending', riskLevel: 'low', docs: 14, totalDocs: 14 },
  { id: '2', name: 'Mehta Enterprises', email: 'mehta@ent.com', gstin: '27AABCM5678G1Z2', type: 'Partnership', gstStatus: 'filed', itrStatus: 'filed', riskLevel: 'low', docs: 11, totalDocs: 12 },
  { id: '3', name: 'Gupta Pvt Ltd', email: 'gupta@pvt.com', gstin: '27AADCG9012H1Z3', type: 'Pvt Ltd', gstStatus: 'mismatch', itrStatus: 'pending', riskLevel: 'high', docs: 8, totalDocs: 15 },
  { id: '4', name: 'Sharma Foods', email: 'sharma@foods.com', gstin: '27AACCS3456J1Z4', type: 'Pvt Ltd', gstStatus: 'filed', itrStatus: 'in-progress', riskLevel: 'medium', docs: 19, totalDocs: 19 },
  { id: '5', name: 'Patel & Sons', email: 'patel@sons.com', gstin: '27AADCP7890K1Z6', type: 'Proprietor', gstStatus: 'mismatch', itrStatus: 'pending', riskLevel: 'high', docs: 6, totalDocs: 10 },
];

const mockInvoices: Invoice[] = [
  { id: '1', number: 'INV-2026-001', client: 'Arora Trading', amount: 45000, gst: 8100, date: '2026-06-01', status: 'paid' },
  { id: '2', number: 'INV-2026-002', client: 'Mehta Enterprises', amount: 78500, gst: 14130, date: '2026-06-05', status: 'pending' },
  { id: '3', number: 'INV-2026-003', client: 'Gupta Pvt Ltd', amount: 125000, gst: 22500, date: '2026-06-08', status: 'paid' },
  { id: '4', number: 'INV-2026-004', client: 'Sharma Foods', amount: 52000, gst: 9360, date: '2026-06-10', status: 'pending' },
  { id: '5', number: 'INV-2026-005', client: 'Patel & Sons', amount: 38000, gst: 6840, date: '2026-06-12', status: 'paid' },
];

const mockTasks: Task[] = [
  { id: '1', title: 'GSTR-3B Filing - May 2026', dueDate: '2026-06-20', priority: 'high', completed: false, type: 'gst' },
  { id: '2', title: 'TDS Deposit Q1', dueDate: '2026-07-07', priority: 'medium', completed: false, type: 'itr' },
  { id: '3', title: 'PF Payment - June', dueDate: '2026-07-15', priority: 'medium', completed: false, type: 'pf' },
  { id: '4', title: 'ITR Filing AY 2026-27', dueDate: '2026-07-31', priority: 'high', completed: false, type: 'itr' },
  { id: '5', title: 'ROC Compliance Check', dueDate: '2026-06-25', priority: 'low', completed: true, type: 'audit' },
];

const mockDocuments: Document[] = [
  {
    id: 'd1',
    clientId: '1',
    fileName: 'Arora_Purchase_June_2026.pdf',
    type: 'invoice',
    uploadDate: '2026-06-12',
    size: 124000,
    status: 'extracted',
    fy: '2026-27',
    extractedData: {
      invoiceNumber: 'INV-2026-098',
      vendorName: 'Super Distributing',
      amount: 48000,
      gst: 8640,
      date: '2026-06-10',
      description: 'Purchase of raw packaging materials',
      ledgerMapping: '5000',
      category: 'Office Supplies'
    },
    versions: [
      { version: 1, date: '2026-06-12 10:30', action: 'Uploaded via Web Portal', user: 'Arora Admin (Client)' },
      { version: 2, date: '2026-06-12 10:32', action: 'AI OCR Field Extraction Completed', user: 'Groq AI Agent' }
    ]
  },
  {
    id: 'd2',
    clientId: '2',
    fileName: 'HDFC_Current_May_2026.pdf',
    type: 'bank-statement',
    uploadDate: '2026-06-08',
    size: 2450000,
    status: 'categorized',
    fy: '2026-27',
    versions: [
      { version: 1, date: '2026-06-08 09:15', action: 'Uploaded via WhatsApp API', user: 'Mehta Director (Client)' },
      { version: 2, date: '2026-06-08 09:30', action: 'Auto-categorization & audit check done', user: 'System Parser' }
    ]
  },
  {
    id: 'd3',
    clientId: '3',
    fileName: 'GSTR2B_Report_May.json',
    type: 'gst-file',
    uploadDate: '2026-06-10',
    size: 48000,
    status: 'pending',
    fy: '2026-27',
    versions: [
      { version: 1, date: '2026-06-10 16:45', action: 'Fetched from GST Portal API', user: 'Karan Mehra (Staff)' }
    ]
  },
  {
    id: 'd4',
    clientId: '4',
    fileName: 'Factory_Lease_Agreement_2026.pdf',
    type: 'legal',
    uploadDate: '2026-05-15',
    size: 5400000,
    status: 'verified',
    fy: '2025-26',
    expiryDate: '2026-07-31',
    versions: [
      { version: 1, date: '2026-05-15 14:00', action: 'Uploaded via Wizard Step 4', user: 'Sharma Foods Partner' },
      { version: 2, date: '2026-05-16 11:20', action: 'Document verified & approved', user: 'Neha Sen (CA)' }
    ]
  },
  {
    id: 'd5',
    clientId: '5',
    fileName: 'FSSAI_License_Patel.pdf',
    type: 'legal',
    uploadDate: '2026-04-10',
    size: 850000,
    status: 'verified',
    fy: '2025-26',
    expiryDate: '2026-06-25',
    versions: [
      { version: 1, date: '2026-04-10 11:00', action: 'Uploaded via Email Import', user: 'Patel Partner (Client)' },
      { version: 2, date: '2026-04-10 15:40', action: 'Document verified & approved', user: 'Neha Sen (CA)' }
    ]
  },
  {
    id: 'd6',
    clientId: '3',
    fileName: 'Shop_Establishment_Act_License.pdf',
    type: 'legal',
    uploadDate: '2025-06-18',
    size: 1040000,
    status: 'verified',
    fy: '2025-26',
    expiryDate: '2026-06-18',
    versions: [
      { version: 1, date: '2025-06-18 10:00', action: 'Uploaded via Portal', user: 'Gupta Pvt Ltd Admin' },
      { version: 2, date: '2025-06-19 12:10', action: 'License status verified', user: 'Neha Sen (CA)' }
    ]
  },
  {
    id: 'd7',
    clientId: '1',
    fileName: 'Partnership_Deed_Signed.pdf',
    type: 'legal',
    uploadDate: '2024-03-01',
    size: 12000000,
    status: 'verified',
    fy: '2023-24',
    expiryDate: '2029-03-01',
    versions: [
      { version: 1, date: '2024-03-01 12:00', action: 'Uploaded at onboarding setup', user: 'Arora Trading' }
    ]
  }
];

export default function AppContent() {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedRole, setSelectedRole] = useState<'CA/Partner' | 'Admin' | 'Staff/Article' | 'Client'>('CA/Partner');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Route/Page states
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [activeTabParam, setActiveTabParam] = useState<string | null>(null);
  
  // Custom interactive states
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clientId: string } | null>(null);
  
  // GSTIN copy and display modal state
  const [gstRegClient, setGstRegClient] = useState<Client | null>(null);
  const [showGstRegModal, setShowGstRegModal] = useState(false);

  // Floating button quick action states
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);
  const [showAIAnalysisModal, setShowAIAnalysisModal] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<any>(null);
  const [editInvoice, setEditInvoice] = useState<any>(null);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [categoryDetails, setCategoryDetails] = useState<string | null>(null);
  
  // Live Sync state
  const [liveSyncState, setLiveSyncState] = useState<{ status: 'connected' | 'disconnected', platform: string, email: string }>({
    status: 'connected',
    platform: 'Tally Prime',
    email: 'admin@company.com'
  });
  const [showLiveSyncModal, setShowLiveSyncModal] = useState(false);

  // Loading and Error states
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [pageError, setPageError] = useState<boolean>(false);
  const [simulatePageFail, setSimulatePageFail] = useState(false);
  const [showAISMismatchesModal, setShowAISMismatchesModal] = useState(false);

  // URL State Sync useEffect
  useEffect(() => {
    if (!isAuthenticated) return;

    // Check RBAC before resolving route
    if (!isRouteAllowed(pathname, selectedRole)) {
      setActivePage('access-denied');
      return;
    }

    setPageError(false);

    // Simulate page load skeleton
    setIsLoadingPage(true);
    const loadingTimeout = setTimeout(() => {
      setIsLoadingPage(false);
      
      // If simulate failure is active, trigger page load error
      if (simulatePageFail && pathname !== '/') {
        setPageError(true);
      }
    }, 250);

    const pathSegments = pathname.split('/').filter(Boolean);
    const primaryPath = pathSegments[0] || 'dashboard';

    // Map URL pathname to activePage state
    if (primaryPath === 'dashboard') {
      setActivePage('dashboard');
      setSelectedClientId(null);
    } else if (primaryPath === 'clients') {
      setActivePage('clients');
      if (pathSegments[1]) {
        setSelectedClientId(pathSegments[1]);
      } else {
        setSelectedClientId(null);
      }
    } else if (primaryPath === 'billing') {
      setActivePage('invoices');
    } else if (primaryPath === 'banking') {
      setActivePage('banking');
    } else if (primaryPath === 'documents') {

      setActivePage('documents');
    } else if (primaryPath === 'ledger') {
      setActivePage('ledger');
    } else if (primaryPath === 'expenses') {
      setActivePage('expenses');
    } else if (primaryPath === 'gst') {
      setActivePage('gst');
      if (pathSegments[1] === 'gstr-3b') {
        const t3b = allTasks.find(t => t.id === '1' || t.title.includes('GSTR-3B'));
        if (t3b) {
          setSelectedTask(t3b);
          setShowTaskModal(true);
        }
      } else if (pathSegments[1] === 'history') {
        setActiveTabParam('history');
      } else if (pathSegments[1] === 'gstr-2b-reconciliation') {
        setActiveTabParam('reconciliation');
      }
    } else if (primaryPath === 'itr') {
      setActivePage('itr');
    } else if (primaryPath === 'compliance') {
      setActivePage('compliance');
    } else if (primaryPath === 'risk') {
      setActivePage('risk');
    } else if (primaryPath === 'insights') {
      setActivePage('insights');
    } else if (primaryPath === 'tasks') {
      setActivePage('tasks');
      const tId = searchParams.get('id');
      if (tId) {
        const found = allTasks.find(t => t.id === tId);
        if (found) {
          setSelectedTask(found);
          setShowTaskModal(true);
        }
      }
    } else if (primaryPath === 'litigation') {
      setActivePage('litigation');
    } else if (primaryPath === 'payroll') {
      setActivePage('payroll');
    } else if (primaryPath === 'secretarial') {
      setActivePage('secretarial');
    } else if (primaryPath === 'collaboration') {
      setActivePage('collaboration');
    } else if (primaryPath === 'admin') {
      setActivePage('admin');
    } else if (primaryPath === 'reports') {
      setActivePage('reports');
    } else if (primaryPath === 'settings') {
      setActivePage('settings');
    } else if (primaryPath === 'copilot') {
      setActivePage('copilot');
    }

    return () => clearTimeout(loadingTimeout);
  }, [pathname, searchParams, isAuthenticated, selectedRole, simulatePageFail]);

  // Real-time synchronization simulation (setInterval polling)
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      const shouldUpdate = Math.random() > 0.6;
      if (shouldUpdate) {
        // Add a mock real-time notification
        const alertsList = [
          { id: 'n5', title: 'Real-time GST Update', message: 'GSTR-1 Filed successfully for Arora Trading Co.', type: 'insight', timestamp: 'Just now', read: false },
          { id: 'n6', title: 'AI Extraction Success', message: 'Document "RentReceipt_July.pdf" parsed with 97% confidence.', type: 'insight', timestamp: 'Just now', read: false }
        ];
        const newAlert = alertsList[Math.floor(Math.random() * alertsList.length)];
        
        setNotifications(prev => {
          if (prev.some(n => n.id === newAlert.id)) return prev;
          return [newAlert, ...prev];
        });
        
        setNudgeToast({
          show: true,
          message: `Sync: New notification: ${newAlert.title}`,
          clientName: 'System sync'
        });
        
        setTimeout(() => {
          setNudgeToast(null);
        }, 3000);
      }
    }, 12000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);
  const [chatMessages, setChatMessages] = useState([{ type: 'ai', text: 'Hi! I\'m your AI Copilot. Ask me anything about compliance.' }]);
  const [chatInput, setChatInput] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientGstin, setNewClientGstin] = useState('');
  const [allClients, setClients] = useState(mockClients);
  const [allInvoices, setInvoices] = useState(mockInvoices);
  const [allTasks, setTasks] = useState(mockTasks);
  const [expenseCategories] = useState(generateMockExpenseCategories());
  const [ledgers] = useState(generateMockLedgers());
  const [complianceDeadlines, setComplianceDeadlines] = useState(generateMockComplianceDeadlines());
  const [financialInsights] = useState(generateFinancialInsights({ id: user?.id }));
  const [documents, setDocuments] = useState<Document[]>(mockDocuments);
  const [uploadedFile, setUploadedFile] = useState<string>('');

  const [globalSimulateEmpty, setGlobalSimulateEmpty] = useState(false);
  const [globalSimulateAiError, setGlobalSimulateAiError] = useState(false);
  const [showPwaPrompt, setShowPwaPrompt] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && isAuthenticated) {
      const logins = parseInt(localStorage.getItem('caos_login_count') || '0', 10);
      const newLogins = logins + 1;
      localStorage.setItem('caos_login_count', newLogins.toString());
      if (newLogins >= 3) {
        setShowPwaPrompt(true);
      }
    }
  }, [isAuthenticated]);

  // Module 3: Document Management States
  const [activeDocTab, setActiveDocTab] = useState<'repo' | 'whatsapp' | 'expiry'>('repo');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [selectedFy, setSelectedFy] = useState<string>('all');

  // OCR processing state
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [ocrForm, setOcrForm] = useState({
    fileName: '',
    type: 'invoice' as 'invoice' | 'receipt' | 'bank-statement' | 'gst-file' | 'legal',
    clientId: '1',
    invoiceNumber: '',
    vendorName: '',
    amount: 0,
    gst: 0,
    date: new Date().toISOString().split('T')[0],
    description: '',
    fy: '2026-27'
  });

  // WhatsApp sandbox state
  const [waClientId, setWaClientId] = useState('3'); // Gupta Pvt Ltd
  const [waFilePreset, setWaFilePreset] = useState('invoice_raw_678.pdf');
  const [waMessageText, setWaMessageText] = useState('Hey CA OS, here is the new invoice from Super Foods. Please file it!');
  const [waPhoneInputText, setWaPhoneInputText] = useState('');
  const [waChatHistory, setWaChatHistory] = useState<any[]>([
    { sender: 'client', text: 'Hi, sending the bank statement for Mehta Enterprises for verification.', time: 'Yesterday' },
    { sender: 'ai', text: '📁 Received "HDFC_Current_May_2026.pdf". It has been auto-categorized into Bank Statements. Confidence: 98%.', time: 'Yesterday' }
  ]);
  const [isWaUploading, setIsWaUploading] = useState(false);

  // Version Trail Modal state
  const [selectedDocTrail, setSelectedDocTrail] = useState<Document | null>(null);
  const [showTrailModal, setShowTrailModal] = useState(false);
  const [nudgeToast, setNudgeToast] = useState<{ show: boolean; message: string; clientName: string } | null>(null);
  const [gstRecords, setGstRecords] = useState<any[]>([
    { id: '1', invoiceNumber: 'INV-001', vendor: 'Arora Trading', amount: 45000, gstAmount: 8100, bookStatus: 'matched', date: '2026-06-01' },
    { id: '2', invoiceNumber: 'INV-002', vendor: 'Mehta Ent', amount: 78500, gstAmount: 14130, bookStatus: 'mismatch', portalAmount: 75000, difference: -3500, date: '2026-06-05' },
    { id: '3', invoiceNumber: 'INV-003', vendor: 'Gupta Ltd', amount: 125000, gstAmount: 22500, bookStatus: 'matched', date: '2026-06-08' },
  ]);
  const [riskTransactions, setRiskTransactions] = useState<RiskScoreTransaction[]>([
    { id: '1', clientId: '1', amount: 85000, date: '2026-06-05', vendor: 'Unknown Vendor', category: 'Services', riskScore: 68, riskLevel: 'high', riskFactors: ['New vendor', 'Round amount', 'No invoice'], flagged: true },
    { id: '2', clientId: '2', amount: 42000, date: '2026-06-10', vendor: 'Regular Supplier', category: 'Materials', riskScore: 22, riskLevel: 'low', riskFactors: [], flagged: false },
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Module 1 Core Shell States
  const [selectedBranch, setSelectedBranch] = useState<'Mumbai (HQ)' | 'New Delhi' | 'Bengaluru'>('Mumbai (HQ)');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [isBranchLoading, setIsBranchLoading] = useState(false);
  const [clientDuesPaid, setClientDuesPaid] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Credit card form state for payment modal
  const [ccNumber, setCcNumber] = useState('');
  const [ccExpiry, setCcExpiry] = useState('');
  const [ccCvv, setCcCvv] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  const [notifications, setNotifications] = useState<any[]>([
    { id: 'n1', title: 'Patel & Sons Mismatch', message: 'GSTR-2B mismatch of -₹2,300 detected in Patel & Sons.', type: 'alert', timestamp: '10m ago', read: false },
    { id: 'n2', title: 'Deadline Reminder', message: 'ITR filing for Arora Trading Co. is due by July 31, 2026.', type: 'reminder', timestamp: '2h ago', read: false },
    { id: 'n3', title: 'AI Risk Flagged', message: 'Groq AI flagged 2 high-risk transactions in Gupta Pvt Ltd.', type: 'insight', timestamp: '1d ago', read: false },
    { id: 'n4', title: 'System Backup', message: 'Database backup completed successfully.', type: 'system', timestamp: '2d ago', read: true }
  ]);

  // Module 2 AI Onboarding & Team States
  const [activeClientTab, setActiveClientTab] = useState<'directory' | 'wizard' | 'import' | 'staff'>('directory');
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [wizardName, setWizardName] = useState('');
  const [wizardGstin, setWizardGstin] = useState('');
  const [wizardPan, setWizardPan] = useState('');
  const [wizardAddress, setWizardAddress] = useState('');
  const [wizardSignatory, setWizardSignatory] = useState('');
  const [wizardEmail, setWizardEmail] = useState('');
  const [wizardPhone, setWizardPhone] = useState('');
  const [wizardBank, setWizardBank] = useState('');
  const [wizardAccount, setWizardAccount] = useState('');
  const [wizardIfsc, setWizardIfsc] = useState('');
  const [wizardType, setWizardType] = useState('Proprietorship');
  const [wizardIndustry, setWizardIndustry] = useState('Retail');
  const [wizardPlan, setWizardPlan] = useState('Basic');
  const [wizardSignature, setWizardSignature] = useState('');
  const [wizardSigned, setWizardSigned] = useState(false);
  const [wizardFiles, setWizardFiles] = useState<string[]>([]);
  const [isAutoFetching, setIsAutoFetching] = useState(false);

  // Bulk Import States
  const [bulkFile, setBulkFile] = useState<string>('');
  const [bulkClients, setBulkClients] = useState<any[]>([]);
  const [isBulkImporting, setIsBulkImporting] = useState(false);

  // Staff List States
  const [staffList, setStaffList] = useState<any[]>([
    {
      id: 's1',
      name: 'Amit Sharma',
      email: 'amit@firm.com',
      role: 'Article Clerk',
      trainingProgress: 66,
      trainingChecklist: [
        { id: 't1', label: 'GST GSTR-3B Reconciliation process', completed: true },
        { id: 't2', label: 'Auto-Ledger mapping and mismatch detection', completed: true },
        { id: 't3', label: 'AIS tax recommendations generation', completed: false }
      ]
    },
    {
      id: 's2',
      name: 'Rohan Mehta',
      email: 'rohan@firm.com',
      role: 'Article Clerk',
      trainingProgress: 33,
      trainingChecklist: [
        { id: 't1', label: 'GST GSTR-3B Reconciliation process', completed: true },
        { id: 't2', label: 'Auto-Ledger mapping and mismatch detection', completed: false },
        { id: 't3', label: 'AIS tax recommendations generation', completed: false }
      ]
    },
    {
      id: 's3',
      name: 'Neha Roy',
      email: 'neha@firm.com',
      role: 'Manager',
      trainingProgress: 100,
      trainingChecklist: [
        { id: 't1', label: 'GST GSTR-3B Reconciliation process', completed: true },
        { id: 't2', label: 'Auto-Ledger mapping and mismatch detection', completed: true },
        { id: 't3', label: 'AIS tax recommendations generation', completed: true }
      ]
    }
  ]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('s1');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('Article Clerk');

  const handleRoleChange = (role: any) => {
    setSelectedRole(role);
    if (user) {
      const updatedUser = { ...user, role };
      setUser(updatedUser);
      localStorage.setItem('ca-os-user', JSON.stringify(updatedUser));
    }
  };

  const markAllNotificationsAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const toggleNotificationRead = (id: string) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: !n.read } : n));
  };

  // Module 2 Helper Functions
  const autoFetchBusinessInfo = () => {
    if (!wizardGstin) {
      alert('Please enter a GSTIN first.');
      return;
    }
    setIsAutoFetching(true);
    setTimeout(() => {
      setIsAutoFetching(false);
      setWizardName('Apex Digital Solutions Pvt Ltd');
      setWizardPan(wizardGstin.substring(2, 12));
      setWizardAddress('404, Signature Towers, BKC, Mumbai, MH 400051');
      setWizardType('Pvt Ltd');
      setWizardIndustry('Technology & SaaS');
      setNotifications(prev => [
        { id: `fetch-${Date.now()}`, title: 'Business Data Auto-Fetched', message: 'Auto-populated Apex Digital Solutions Pvt Ltd from GSTIN.', type: 'insight', timestamp: 'Just now', read: false },
        ...prev
      ]);
    }, 1200);
  };

  const handleWizardSubmit = () => {
    if (!wizardName || !wizardGstin) {
      alert('Please complete Step 1: Business details first.');
      return;
    }
    const newClient: Client = {
      id: (allClients.length + 1).toString(),
      name: wizardName,
      email: wizardEmail || `${wizardName.toLowerCase().replace(/\s/g, '')}@example.com`,
      gstin: wizardGstin,
      type: wizardType,
      gstStatus: 'pending',
      itrStatus: 'pending',
      riskLevel: 'low',
      docs: wizardFiles.length,
      totalDocs: wizardFiles.length,
      assignedStaffId: 's1' // Assign Amit Sharma by default
    };

    // Add client
    setClients([...allClients, newClient]);
    setNotifications(prev => [
      { id: `onb-${Date.now()}`, title: 'Client Onboarded Successfully', message: `Client ${wizardName} has been enrolled and assigned to Amit Sharma.`, type: 'system', timestamp: 'Just now', read: false },
      ...prev
    ]);

    // Reset wizard values
    setWizardStep(1);
    setWizardName('');
    setWizardGstin('');
    setWizardPan('');
    setWizardAddress('');
    setWizardSignatory('');
    setWizardEmail('');
    setWizardPhone('');
    setWizardBank('');
    setWizardAccount('');
    setWizardIfsc('');
    setWizardSignature('');
    setWizardSigned(false);
    setWizardFiles([]);
    setActiveClientTab('directory');
    alert('Client onboarding completed successfully!');
  };

  const parseBulkCSV = () => {
    if (!bulkFile) {
      alert('Please select a file to import.');
      return;
    }
    setIsBulkImporting(true);
    setTimeout(() => {
      setIsBulkImporting(false);
      setBulkClients([
        { name: 'Zenith Logistics', email: 'contact@zenith.in', gstin: '27AAACZ1111A1Z1', type: 'Partnership', risk: 'low' },
        { name: 'Phoenix Healthcare Ltd', email: 'info@phoenix.com', gstin: '27AAACP2222B1Z2', type: 'Pvt Ltd', risk: 'medium' },
        { name: 'Alpha IT Consultants', email: 'help@alpha.consulting', gstin: '27AAACA3333C1Z3', type: 'LLP', risk: 'low' },
        { name: 'Bose Audio India', email: 'billing@boseaudio.in', gstin: '27AAACB4444D1Z4', type: 'Pvt Ltd', risk: 'high' }
      ]);
    }, 1000);
  };

  const handleBulkImportSubmit = () => {
    if (bulkClients.length === 0) return;
    const newClientsList = [
      ...allClients,
      ...bulkClients.map((bc, idx) => ({
        id: (allClients.length + idx + 1).toString(),
        name: bc.name,
        email: bc.email,
        gstin: bc.gstin,
        type: bc.type,
        gstStatus: 'pending' as any,
        itrStatus: 'pending' as any,
        riskLevel: bc.risk as any,
        docs: 0,
        totalDocs: 0,
        assignedStaffId: 's2' // Assign Rohan Mehta
      }))
    ];
    setClients(newClientsList);
    setNotifications(prev => [
      { id: `bulk-${Date.now()}`, title: 'Bulk Import Success', message: `Imported ${bulkClients.length} clients into Mumbai (HQ).`, type: 'system', timestamp: 'Just now', read: false },
      ...prev
    ]);
    setBulkClients([]);
    setBulkFile('');
    setActiveClientTab('directory');
    alert(`Successfully imported ${bulkClients.length} clients!`);
  };

  const handleAssignStaff = (clientId: string, staffId: string) => {
    setClients(allClients.map(c => c.id === clientId ? { ...c, assignedStaffId: staffId } : c));
  };

  const handleAddStaff = () => {
    if (!newStaffName || !newStaffEmail) {
      alert('Please fill out Name and Email.');
      return;
    }
    const newStaff = {
      id: `s${staffList.length + 1}`,
      name: newStaffName,
      email: newStaffEmail,
      role: newStaffRole,
      trainingProgress: 0,
      trainingChecklist: [
        { id: 't1', label: 'GST GSTR-3B Reconciliation process', completed: false },
        { id: 't2', label: 'Auto-Ledger mapping and mismatch detection', completed: false },
        { id: 't3', label: 'AIS tax recommendations generation', completed: false }
      ]
    };
    setStaffList([...staffList, newStaff]);
    setNewStaffName('');
    setNewStaffEmail('');
    setNotifications(prev => [
      { id: `staff-${Date.now()}`, title: 'Staff Account Created', message: `Invited ${newStaffName} (${newStaffRole}) to the firm workspace.`, type: 'system', timestamp: 'Just now', read: false },
      ...prev
    ]);
    alert(`Staff member ${newStaffName} created and invited!`);
  };

  const handleToggleTrainingChecklist = (staffId: string, itemId: string) => {
    const updatedStaffList = staffList.map(s => {
      if (s.id === staffId) {
        const updatedChecklist = s.trainingChecklist.map((item: any) =>
          item.id === itemId ? { ...item, completed: !item.completed } : item
        );
        const completedCount = updatedChecklist.filter((item: any) => item.completed).length;
        const progress = Math.round((completedCount / updatedChecklist.length) * 100);
        return { ...s, trainingChecklist: updatedChecklist, trainingProgress: progress };
      }
      return s;
    });
    setStaffList(updatedStaffList);
  };

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem('ca-os-user');
      if (stored) {
        const userData = JSON.parse(stored);
        if (!userData || !userData.id) {
          // Invalid user object
          localStorage.removeItem('ca-os-user');
          router.replace('/login');
          return;
        }
        setUser(userData);
        setIsAuthenticated(true);
        // Map caRole/role to selectedRole — support all known formats
        const roleToCheck = (userData.caRole || userData.role || '').trim();
        if (roleToCheck === 'CA/Partner' || roleToCheck === 'Senior CA' || roleToCheck === 'admin') {
          setSelectedRole('CA/Partner');
        } else if (roleToCheck === 'Admin') {
          setSelectedRole('Admin');
        } else if (roleToCheck === 'Staff/Article' || roleToCheck === 'staff' || roleToCheck === 'Staff') {
          setSelectedRole('Staff/Article');
        } else if (roleToCheck === 'Client' || roleToCheck === 'client') {
          setSelectedRole('Client');
        } else {
          // Unknown role — default to CA/Partner
          setSelectedRole('CA/Partner');
        }
      } else {
        router.replace('/login');
      }
    } catch (e) {
      console.error('[CA-OS] Failed to parse stored user:', e);
      localStorage.removeItem('ca-os-user');
      router.replace('/login');
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('ca-os-user');
    router.replace('/login');
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    setChatMessages(prev => [...prev, { type: 'user', text: chatInput }]);
    const query = chatInput;
    setChatInput('');
    setTimeout(() => {
      let response = '';
      if (globalSimulateAiError) {
        response = `I don't have enough information to answer this accurately. The bookkeeping data for this client only goes back to April 2024, but your question "${query}" references March 2024. You can upload older bank statements or manually input trial balance records for the prior fiscal year.`;
      } else {
        response = 'I can help you with that. ';
        if (query.toLowerCase().includes('gst')) response += 'Current GST filing status shows 132/148 clients filed.';
        else if (query.toLowerCase().includes('client')) response += `You have ${clients.length} active clients.`;
        else if (query.toLowerCase().includes('invoice')) response += `Total invoices: ${invoices.length}. Paid: ${invoices.filter(i => i.status === 'paid').length}. Pending: ${invoices.filter(i => i.status === 'pending').length}.`;
        else if (query.toLowerCase().includes('deadline')) response += 'Next deadline: GSTR-3B filing on June 20, 2026.';
        else response += 'Let me help you with that task.';
      }
      setChatMessages(prev => [...prev, { type: 'ai', text: response }]);
    }, 500);
  };

  const addClient = () => {
    if (!newClientName || !newClientEmail || !newClientGstin) return;
    const newClient: Client = {
      id: (clients.length + 1).toString(),
      name: newClientName,
      email: newClientEmail,
      gstin: newClientGstin,
      type: 'Proprietor',
      gstStatus: 'pending',
      itrStatus: 'pending',
      riskLevel: 'low',
      docs: 0,
      totalDocs: 0,
    };
    setClients([...clients, newClient]);
    setNewClientName('');
    setNewClientEmail('');
    setNewClientGstin('');
  };

  const toggleTask = (id: string) => {
    setTasks(allTasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const markInvoiceAsPaid = (id: string) => {
    setInvoices(allInvoices.map(i => i.id === id ? { ...i, status: 'paid' } : i));
  };

  if (!mounted || !isAuthenticated) {
    return null;
  }

  // Branch Filtering
  const clients = selectedBranch === 'New Delhi'
    ? allClients.filter(c => c.type === 'Proprietor' || c.id === '1' || c.id === '5')
    : selectedBranch === 'Bengaluru'
      ? allClients.filter(c => c.type === 'Pvt Ltd' || c.id === '3' || c.id === '4')
      : allClients;

  const invoices = selectedBranch === 'Mumbai (HQ)' ? allInvoices :
    selectedBranch === 'New Delhi' ? allInvoices.slice(0, 3) : allInvoices.slice(2, 5);

  const tasks = selectedBranch === 'Mumbai (HQ)' ? allTasks :
    selectedBranch === 'New Delhi' ? allTasks.filter(t => t.type === 'gst' || t.type === 'itr') : allTasks.filter(t => t.type === 'pf' || t.type === 'audit');

  // Search Results
  const getSearchResults = () => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase();
    return {
      clients: allClients.filter(c => c.name.toLowerCase().includes(query) || c.gstin.toLowerCase().includes(query)),
      documents: documents.filter(d => d.fileName.toLowerCase().includes(query) || d.type.toLowerCase().includes(query)),
      invoices: allInvoices.filter(i => i.number.toLowerCase().includes(query) || i.client.toLowerCase().includes(query)),
      tasks: allTasks.filter(t => t.title.toLowerCase().includes(query))
    };
  };

  const searchResults = getSearchResults();

  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalGst = invoices.reduce((sum, inv) => sum + inv.gst, 0);
  const paidCount = invoices.filter(i => i.status === 'paid').length;
  const pendingCount = invoices.filter(i => i.status === 'pending').length;

  // Module 3: Document Management Helper Functions
  const triggerOcrProcess = (fileName: string) => {
    setIsOcrProcessing(true);
    setUploadedFile(fileName);
    setTimeout(() => {
      setIsOcrProcessing(false);
      const isReceipt = fileName.toLowerCase().includes('receipt') || fileName.toLowerCase().includes('bill');
      const isBank = fileName.toLowerCase().includes('bank') || fileName.toLowerCase().includes('statement');
      const isGst = fileName.toLowerCase().includes('gst');
      const isLegal = fileName.toLowerCase().includes('license') || fileName.toLowerCase().includes('lease') || fileName.toLowerCase().includes('agree') || fileName.toLowerCase().includes('deed');

      let type: 'invoice' | 'receipt' | 'bank-statement' | 'gst-file' | 'legal' = 'invoice';
      if (isReceipt) type = 'receipt';
      else if (isBank) type = 'bank-statement';
      else if (isGst) type = 'gst-file';
      else if (isLegal) type = 'legal';

      const invNum = 'INV-2026-' + Math.floor(Math.random() * 900 + 100);
      const amt = type === 'receipt' ? Math.floor(Math.random() * 8000 + 500) : Math.floor(Math.random() * 150000 + 10000);
      const gst = Math.floor(amt * 0.18);
      const vendors = ['Delta Services', 'National Distributing', 'Zenith Tech', 'Apex Solutions', 'Super Foods Ltd'];
      const vendorName = vendors[Math.floor(Math.random() * vendors.length)];

      setOcrForm({
        fileName: fileName,
        type: type,
        clientId: '1', // Default client
        invoiceNumber: type === 'invoice' || type === 'receipt' ? invNum : '',
        vendorName: type === 'invoice' || type === 'receipt' ? vendorName : '',
        amount: amt,
        gst: gst,
        date: new Date().toISOString().split('T')[0],
        description: `Simulated OCR extraction for ${fileName}`,
        fy: '2026-27'
      });
      setShowOcrModal(true);
    }, 1500);
  };

  const saveOcrData = () => {
    const newDoc: Document = {
      id: 'd_' + Date.now(),
      clientId: ocrForm.clientId,
      fileName: ocrForm.fileName,
      type: ocrForm.type,
      uploadDate: new Date().toISOString().split('T')[0],
      size: Math.floor(Math.random() * 450000 + 50000),
      status: 'extracted',
      fy: ocrForm.fy,
      extractedData: {
        invoiceNumber: ocrForm.invoiceNumber,
        vendorName: ocrForm.vendorName,
        amount: ocrForm.amount,
        gst: ocrForm.gst,
        date: ocrForm.date,
        description: ocrForm.description,
        ledgerMapping: ocrForm.type === 'invoice' ? '5000' : undefined,
        category: ocrForm.type === 'invoice' ? 'Office Supplies' : undefined
      },
      versions: [
        { version: 1, date: new Date().toISOString().replace('T', ' ').substring(0, 16), action: 'Uploaded via OCR Engine', user: 'System (AI Parser)' },
        { version: 2, date: new Date().toISOString().replace('T', ' ').substring(0, 16), action: 'Metadata approved & verified', user: `${selectedRole} (${user?.name || 'Staff'})` }
      ]
    };

    setDocuments(prev => [newDoc, ...prev]);

    if (ocrForm.type === 'invoice' || ocrForm.type === 'receipt') {
      const clientObj = allClients.find(c => c.id === ocrForm.clientId);
      const newInv = {
        id: 'inv_' + Date.now(),
        number: ocrForm.invoiceNumber || ('INV-' + Date.now().toString().slice(-4)),
        client: clientObj ? clientObj.name : 'Unknown Client',
        amount: ocrForm.amount,
        gst: ocrForm.gst,
        date: ocrForm.date,
        status: 'pending' as 'paid' | 'pending'
      };
      setInvoices(prev => [newInv, ...prev]);
    }

    setShowOcrModal(false);

    const clientObj = allClients.find(c => c.id === ocrForm.clientId);
    const newNotif = {
      id: 'notif_' + Date.now(),
      title: 'New Document Extracted',
      message: `"${ocrForm.fileName}" uploaded for ${clientObj?.name || 'Client'} has been parsed by AI.`,
      type: 'insight',
      timestamp: 'Just now',
      read: false
    };
    setNotifications(prev => [newNotif, ...prev]);
    alert(`Document "${ocrForm.fileName}" successfully processed and categorized!`);
  };

  const handlePhoneWaSend = (overrideText?: string) => {
    const textToSend = typeof overrideText === 'string' ? overrideText : waPhoneInputText;
    if (!textToSend.trim()) return;

    const clientMsg = {
      sender: 'client',
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setWaChatHistory(prev => [...prev, clientMsg]);
    setWaPhoneInputText('');
    
    // Simulate some AI response for generic messages if they don't have attachments
    if (!textToSend.includes('[Attached:')) {
      setTimeout(() => {
        const aiReply = {
          sender: 'ai',
          text: `I've received your message. Please attach a document (invoice, receipt, bank statement) for me to process.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setWaChatHistory(prev => [...prev, aiReply]);
      }, 1500);
    } else {
      // If it has attachment, simulate uploading
      setIsWaUploading(true);
      setTimeout(() => {
        setIsWaUploading(false);
        const aiReply = {
          sender: 'ai',
          text: `📁 Received your attachment. It has been auto-categorized based on content. Confidence: 94%.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setWaChatHistory(prev => [...prev, aiReply]);
      }, 2000);
    }
  };

  const handleWaSend = () => {
    if (!waMessageText.trim()) return;

    const clientObj = allClients.find(c => c.id === waClientId);
    if (!clientObj) return;

    const clientMsg = {
      sender: 'client',
      text: `${waMessageText} [Attached: ${waFilePreset}]`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setWaChatHistory(prev => [...prev, clientMsg]);
    setIsWaUploading(true);
    setWaMessageText('');

    setTimeout(() => {
      if (globalSimulateAiError) {
        const newDoc: Document = {
          id: 'd_wa_fail_' + Date.now(),
          clientId: waClientId,
          fileName: waFilePreset,
          type: 'invoice',
          uploadDate: new Date().toISOString().split('T')[0],
          size: 350000,
          status: 'rejected',
          fy: '2026-27',
          extractedData: {
            description: `Unprocessable: Image too blurry or file format is unsupported. Ingested via WhatsApp.`,
          },
          versions: [
            { version: 1, date: new Date().toISOString().replace('T', ' ').substring(0, 16), action: 'Received via WhatsApp sandbox upload', user: `${clientObj.name} Signatory` },
            { version: 2, date: new Date().toISOString().replace('T', ' ').substring(0, 16), action: 'Failed parsing (marked as Unprocessable)', user: 'Groq AI Agent' }
          ]
        };

        setDocuments(prev => [newDoc, ...prev]);

        const aiReply = {
          sender: 'ai',
          text: `We received your file but couldn't process it. Please send a clearer photo or a PDF of the document. Supported formats: JPG, PNG, PDF.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setWaChatHistory(prev => [...prev, aiReply]);
        setIsWaUploading(false);

        const newNotif = {
          id: 'notif_wa_err_' + Date.now(),
          title: 'WhatsApp Ingest Failed',
          message: `Unprocessable file "${waFilePreset}" submitted via WhatsApp for ${clientObj.name}. Staff alert raised.`,
          type: 'alert',
          timestamp: 'Just now',
          read: false
        };
        setNotifications(prev => [newNotif, ...prev]);
        return;
      }

      const isReceipt = waFilePreset.toLowerCase().includes('receipt') || waFilePreset.toLowerCase().includes('bill');
      const isBank = waFilePreset.toLowerCase().includes('bank') || waFilePreset.toLowerCase().includes('statement');

      let type: 'invoice' | 'receipt' | 'bank-statement' | 'gst-file' | 'legal' = 'invoice';
      if (isReceipt) type = 'receipt';
      else if (isBank) type = 'bank-statement';

      const amt = type === 'receipt' ? 3420 : 124500;
      const gst = Math.floor(amt * 0.18);
      const vName = type === 'receipt' ? 'Superstar Fuel Station' : 'HDFC Bank';

      const newDoc: Document = {
        id: 'd_wa_' + Date.now(),
        clientId: waClientId,
        fileName: waFilePreset,
        type: type,
        uploadDate: new Date().toISOString().split('T')[0],
        size: 350000,
        status: 'extracted',
        fy: '2026-27',
        extractedData: {
          invoiceNumber: 'INV-WA-' + Math.floor(Math.random() * 9000 + 1000),
          vendorName: vName,
          amount: amt,
          gst: gst,
          date: new Date().toISOString().split('T')[0],
          description: `Ingested automatically via client WhatsApp upload.`,
          ledgerMapping: type === 'invoice' || type === 'receipt' ? '5000' : '1010',
        },
        versions: [
          { version: 1, date: new Date().toISOString().replace('T', ' ').substring(0, 16), action: 'Received via WhatsApp sandbox upload', user: `${clientObj.name} Signatory` },
          { version: 2, date: new Date().toISOString().replace('T', ' ').substring(0, 16), action: 'Groq AI Auto-extracted Metadata', user: 'Groq AI Agent' }
        ]
      };

      setDocuments(prev => [newDoc, ...prev]);

      if (type === 'invoice' || type === 'receipt') {
        const newInv = {
          id: 'inv_wa_' + Date.now(),
          number: newDoc.extractedData?.invoiceNumber || ('INV-' + Date.now().toString().slice(-4)),
          client: clientObj.name,
          amount: amt,
          gst: gst,
          date: new Date().toISOString().split('T')[0],
          status: 'pending' as 'paid' | 'pending'
        };
        setInvoices(prev => [newInv, ...prev]);
      }

      const aiReply = {
        sender: 'ai',
        text: `📁 Received "${waFilePreset}". Automatically parsed type: ${type.toUpperCase()}. Extracted vendor "${vName}" and total amount ₹${amt.toLocaleString('en-IN')}. Document status set to [Extracted].`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setWaChatHistory(prev => [...prev, aiReply]);
      setIsWaUploading(false);

      const newNotif = {
        id: 'notif_wa_' + Date.now(),
        title: 'WhatsApp File Ingested',
        message: `New WhatsApp submission "${waFilePreset}" processed for ${clientObj.name}.`,
        type: 'insight',
        timestamp: 'Just now',
        read: false
      };
      setNotifications(prev => [newNotif, ...prev]);
    }, 2000);
  };

  const sendNudge = (doc: Document) => {
    const clientObj = allClients.find(c => c.id === doc.clientId);
    if (!clientObj) return;

    const nudgeMessage = `⚠️ CA OS automated reminder: Hello ${clientObj.name}, the document "${doc.fileName}" is currently listed as pending/missing for FY ${doc.fy || '2026-27'}. Please upload it at your earliest convenience.`;

    setNudgeToast({
      show: true,
      message: nudgeMessage,
      clientName: clientObj.name
    });

    setTimeout(() => {
      setNudgeToast(null);
    }, 5000);
  };

  const handleStatusChange = (docId: string, newStatus: 'pending' | 'processing' | 'extracted' | 'categorized' | 'verified' | 'rejected') => {
    setDocuments(prev => prev.map(doc => {
      if (doc.id === docId) {
        const newVersionNum = (doc.versions?.length || 0) + 1;
        const newVer = {
          version: newVersionNum,
          date: new Date().toISOString().replace('T', ' ').substring(0, 16),
          action: `Status manually changed to [${newStatus.toUpperCase()}]`,
          user: `${selectedRole} (${user?.name || 'Staff'})`
        };
        return {
          ...doc,
          status: newStatus,
          versions: doc.versions ? [...doc.versions, newVer] : [newVer]
        };
      }
      return doc;
    }));
  };

  return (
    <div className="app" style={{ background: isDark ? 'var(--bg-light)' : 'var(--bg-light)' }}>
      {/* SIDEBAR */}
      <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`} style={{ position: 'relative', overflow: 'visible' }}>
        <div className="sidebar-logo">
          <div className="logo-icon">⚖️</div>
          <div>
            <div className="logo-text">CA·OS</div>
            <div className="logo-sub">Compliance Platform</div>
          </div>
        </div>

        {/* Multi-Firm / Multi-Branch Switcher */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', position: 'relative', zIndex: 50 }}>
          <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.4px' }}>Active Branch</div>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setShowBranchDropdown(!showBranchDropdown);
                setShowRoleDropdown(false);
                setShowProfileMenu(false);
                setShowNotificationsDropdown(false);
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: 'var(--bg-gray)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: '600',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <span>🏢 {selectedBranch}</span>
              <span style={{ fontSize: '10px' }}>▼</span>
            </button>
            {showBranchDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '4px',
                background: 'var(--bg-white)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                boxShadow: 'var(--shadow-md)',
                zIndex: 1000,
              }}>
                {['Mumbai (HQ)', 'New Delhi', 'Bengaluru'].map(branch => (
                  <button
                    key={branch}
                    onClick={() => {
                      setSelectedBranch(branch as any);
                      setShowBranchDropdown(false);
                      setIsBranchLoading(true);
                      setTimeout(() => setIsBranchLoading(false), 500);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: selectedBranch === branch ? 'var(--gold-light)' : 'none',
                      border: 'none',
                      textAlign: 'left',
                      fontSize: '12.5px',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontWeight: selectedBranch === branch ? '700' : '500',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedBranch !== branch) e.currentTarget.style.background = 'var(--bg-light)';
                    }}
                    onMouseLeave={(e) => {
                      if (selectedBranch !== branch) e.currentTarget.style.background = 'none';
                    }}
                  >
                    🏢 {branch}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="sidebar-section" style={{ flex: 1, overflowY: 'auto' }}>
          <div className="sidebar-label">MODULES</div>
          {[
            { id: 'dashboard', icon: '📊', label: 'Dashboard', route: ROUTES.dashboard },
            { id: 'banking', icon: '🏦', label: 'Banking', route: ROUTES.banking },
            { id: 'clients', icon: '👥', label: 'Clients', route: ROUTES.clients },
            { id: 'invoices', icon: '📄', label: 'Invoices', route: ROUTES.invoices },
            { id: 'documents', icon: '📁', label: 'Documents', route: ROUTES.documents },
            { id: 'ledger', icon: '📋', label: 'Ledger', route: ROUTES.ledger },
            { id: 'expenses', icon: '💰', label: 'Expenses', route: ROUTES.expenses },
            { id: 'gst', icon: '💳', label: 'GST', route: ROUTES.gst },
            { id: 'itr', icon: '📈', label: 'Income Tax', route: ROUTES.itr },
            { id: 'compliance', icon: '📅', label: 'Compliance', route: ROUTES.compliance },
            { id: 'risk', icon: '⚠️', label: 'Risk Audit', route: ROUTES.risk },
            { id: 'insights', icon: '💡', label: 'Insights', route: ROUTES.insights },
            { id: 'tasks', icon: '✓', label: 'Tasks', route: ROUTES.tasks },
            { id: 'litigation', icon: '⚖️', label: 'Litigation', route: ROUTES.litigation },
            { id: 'payroll', icon: '💸', label: 'Payroll', route: ROUTES.payroll },
            { id: 'secretarial', icon: '💼', label: 'Corporate Secretarial', route: ROUTES.secretarial },
            { id: 'collaboration', icon: '💬', label: 'Collaboration Hub', route: ROUTES.collaboration },
            { id: 'admin', icon: '🛡️', label: 'Security & Admin', route: ROUTES.admin },
            { id: 'reports', icon: '📊', label: 'Reports Hub', route: ROUTES.reports },
            { id: 'settings', icon: '⚙️', label: 'Settings Control', route: ROUTES.settings },
            { id: 'copilot', icon: '🤖', label: 'AI Copilot', route: ROUTES.copilot },
          ].map(item => {
            const isAllowed = isRouteAllowed(item.route, selectedRole);
            
            return (
              <Link
                key={item.id}
                href={isAllowed ? item.route : '#'}
                className={`nav-item ${activePage === item.id || (item.id === 'invoices' && activePage === 'invoices') ? 'active' : ''}`}
                style={{
                  opacity: isAllowed ? 1 : 0.5,
                  cursor: isAllowed ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  textDecoration: 'none',
                  color: 'inherit'
                }}
                onClick={(e) => {
                  if (!isAllowed) {
                    e.preventDefault();
                    alert(`Access Denied: Your role "${selectedRole}" does not have permissions to view this module.`);
                    return;
                  }
                  // Hide dropdowns on page switch
                  setShowBranchDropdown(false);
                  setShowRoleDropdown(false);
                  setShowProfileMenu(false);
                  setShowNotificationsDropdown(false);
                }}
              >
                <span style={{ marginRight: '10px' }}>{item.icon}</span>
                <span>{item.label}</span>
                {!isAllowed && <span style={{ marginLeft: 'auto', fontSize: '11px' }}>🔒</span>}
              </Link>
            );
          })}
        </div>

        <div className="sidebar-bottom">
          <div className="user-chip" onClick={() => setShowProfileMenu(!showProfileMenu)}>
            <div className="avatar">{user?.avatar}</div>
            <div className="user-info">
              <div className="user-name">{user?.name}</div>
              <div className="user-role">{selectedRole}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="main">
        <div className="topbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 40, position: 'relative' }}>
          <div className="topbar-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: '500' }}>
            {/* Hamburger Menu Icon */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hamburger-btn"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '20px',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                marginRight: '4px',
                zIndex: 50
              }}
              title="Toggle Menu"
            >
              ☰
            </button>
            <Link href="/" style={{ textDecoration: 'none', color: pathname === '/' ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: pathname === '/' ? '700' : '500' }}>
              📊 Dashboard
            </Link>
            {pathname !== '/' && (
              <>
                <span style={{ color: 'var(--text-muted)', margin: '0 6px', fontWeight: 500 }}>/</span>
                {pathname.startsWith('/clients') && (
                  <>
                    <Link href="/clients" style={{ textDecoration: 'none', color: selectedClientId ? 'var(--text-muted)' : 'var(--text-primary)', fontWeight: selectedClientId ? '500' : '700' }}>Clients</Link>
                    {selectedClientId && (
                      <>
                        <span style={{ color: 'var(--text-muted)', margin: '0 6px', fontWeight: 500 }}>/</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>
                          {allClients.find(c => c.id === selectedClientId)?.name || 'Profile'}
                        </span>
                      </>
                    )}
                  </>
                )}
                {pathname.startsWith('/billing') && (
                  <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>Invoices</span>
                )}
                {pathname.startsWith('/documents') && (
                  <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>Documents</span>
                )}
                {pathname.startsWith('/ledger') && (
                  <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>Ledger Mapping</span>
                )}
                {pathname.startsWith('/expenses') && (
                  <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>Expenses</span>
                )}
                {pathname.startsWith('/gst') && (
                  <>
                    <Link href="/gst" style={{ textDecoration: 'none', color: pathname === '/gst' ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: pathname === '/gst' ? '700' : '500' }}>GST</Link>
                    {pathname.includes('gstr-3b') && (
                      <>
                        <span style={{ color: 'var(--text-muted)', margin: '0 6px', fontWeight: 500 }}>/</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>GSTR-3B Filing</span>
                      </>
                    )}
                    {pathname.includes('history') && (
                      <>
                        <span style={{ color: 'var(--text-muted)', margin: '0 6px', fontWeight: 500 }}>/</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>History</span>
                      </>
                    )}
                    {pathname.includes('gstr-2b-reconciliation') && (
                      <>
                        <span style={{ color: 'var(--text-muted)', margin: '0 6px', fontWeight: 500 }}>/</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>GSTR-2B Reconciliation</span>
                      </>
                    )}
                  </>
                )}
                {pathname.startsWith('/itr') && (
                  <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>Income Tax</span>
                )}
                {pathname.startsWith('/compliance') && (
                  <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>Compliance Calendar</span>
                )}
                {pathname.startsWith('/risk') && (
                  <>
                    <Link href="/risk" style={{ textDecoration: 'none', color: pathname === '/risk' ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: pathname === '/risk' ? '700' : '500' }}>Risk & Audit</Link>
                    {pathname.includes('vendor-report') && (
                      <>
                        <span style={{ color: 'var(--text-muted)', margin: '0 6px', fontWeight: 500 }}>/</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>Vendor Risk Report</span>
                      </>
                    )}
                  </>
                )}
                {pathname.startsWith('/insights') && (
                  <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>Financial Insights</span>
                )}
                {pathname.startsWith('/tasks') && (
                  <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>Compliance Tasks</span>
                )}
                {pathname.startsWith('/litigation') && (
                  <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>Litigation</span>
                )}
                {pathname.startsWith('/payroll') && (
                  <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>Payroll</span>
                )}
                {pathname.startsWith('/secretarial') && (
                  <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>Corporate Secretarial</span>
                )}
                {pathname.startsWith('/collaboration') && (
                  <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>Collaboration Hub</span>
                )}
                {pathname.startsWith('/admin') && (
                  <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>Admin Console</span>
                )}
                {pathname.startsWith('/reports') && (
                  <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>Reports Hub</span>
                )}
                {pathname.startsWith('/settings') && (
                  <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>Settings</span>
                )}
                {pathname.startsWith('/copilot') && (
                  <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>AI Copilot</span>
                )}
              </>
            )}
          </div>

          {/* Global Search Bar */}
          {/* Global Search Bar */}
          <div className="search-bar" style={{ position: 'relative', flex: '0 1 300px', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'var(--bg-gray)', border: 'none', borderRadius: '24px' }}>
            <span style={{ fontSize: '13px' }}>🔍</span>
            <input
              type="text"
              placeholder="Search... (Press Ctrl + K)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', border: 'none', background: 'none', outline: 'none', fontSize: '14px', fontFamily: 'inherit', color: 'var(--text-primary)', cursor: 'text' }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px' }}
              >
                ✕
              </button>
            )}

            {/* Search Results Dropdown */}
            {searchResults && searchQuery && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '8px',
                background: 'var(--bg-white)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                boxShadow: 'var(--shadow-md)',
                zIndex: 1000,
                maxHeight: '300px',
                overflowY: 'auto',
                padding: '12px',
              }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '.4px' }}>Search Results</div>

                {/* Clients Group */}
                {searchResults.clients.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '10.5px', color: 'var(--primary)', fontWeight: '700', marginBottom: '4px' }}>👥 Clients ({searchResults.clients.length})</div>
                    {searchResults.clients.map(c => (
                      <div
                        key={c.id}
                        onClick={() => { router.push(ROUTES.clientProfile(c.id)); setSearchQuery(''); }}
                        style={{ padding: '6px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-primary)' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-gray)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                      >
                        <b>{c.name}</b> <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({c.gstin})</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Documents Group */}
                {searchResults.documents.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '10.5px', color: 'var(--primary)', fontWeight: '700', marginBottom: '4px' }}>📁 Documents ({searchResults.documents.length})</div>
                    {searchResults.documents.map(d => (
                      <div
                        key={d.id}
                        onClick={() => { router.push(ROUTES.documents); setSearchQuery(''); }}
                        style={{ padding: '6px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-primary)' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-gray)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                      >
                        📄 {d.fileName} <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({d.status})</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Invoices Group */}
                {searchResults.invoices.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '10.5px', color: 'var(--primary)', fontWeight: '700', marginBottom: '4px' }}>📄 Invoices ({searchResults.invoices.length})</div>
                    {searchResults.invoices.map(i => (
                      <div
                        key={i.id}
                        onClick={() => { router.push(`${ROUTES.invoices}?id=${i.id}`); setSearchQuery(''); }}
                        style={{ padding: '6px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-primary)' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-gray)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                      >
                        🧾 {i.number} - {i.client} <span style={{ color: 'var(--success)', fontSize: '11px' }}>₹{i.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tasks Group */}
                {searchResults.tasks.length > 0 && (
                  <div>
                    <div style={{ fontSize: '10.5px', color: 'var(--primary)', fontWeight: '700', marginBottom: '4px' }}>✓ Tasks ({searchResults.tasks.length})</div>
                    {searchResults.tasks.map(t => (
                      <div
                        key={t.id}
                        onClick={() => { router.push(`${ROUTES.tasks}?id=${t.id}`); setSearchQuery(''); }}
                        style={{ padding: '6px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-primary)' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-gray)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                      >
                        ✓ {t.title} <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({t.dueDate})</span>
                      </div>
                    ))}
                  </div>
                )}

                {searchResults.clients.length === 0 && searchResults.documents.length === 0 && searchResults.invoices.length === 0 && searchResults.tasks.length === 0 && (
                  <div style={{ padding: '8px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>No results match "{searchQuery}"</div>
                )}
              </div>
            )}
          </div>

          <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Multi-Firm Role Switcher Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => {
                  setShowRoleDropdown(!showRoleDropdown);
                  setShowBranchDropdown(false);
                  setShowNotificationsDropdown(false);
                  setShowProfileMenu(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '24px',
                  background: 'var(--bg-gray)',
                  color: 'var(--text-primary)',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <span>👤 Role: {selectedRole}</span>
                <span style={{ fontSize: '10px' }}>▼</span>
              </button>
              {showRoleDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '8px',
                  background: 'var(--bg-white)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  minWidth: '160px',
                  boxShadow: 'var(--shadow-md)',
                  zIndex: 1000,
                }}>
                  {['CA/Partner', 'Admin', 'Staff/Article', 'Client'].map(role => (
                    <button
                      key={role}
                      onClick={() => {
                        handleRoleChange(role);
                        setShowRoleDropdown(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: selectedRole === role ? 'var(--gold-light)' : 'none',
                        border: 'none',
                        textAlign: 'left',
                        fontSize: '12.5px',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontWeight: selectedRole === role ? '700' : '500',
                      }}
                      onMouseEnter={(e) => {
                        if (selectedRole !== role) e.currentTarget.style.background = 'var(--bg-light)';
                      }}
                      onMouseLeave={(e) => {
                        if (selectedRole !== role) e.currentTarget.style.background = 'none';
                      }}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notification Center */}
            <div style={{ position: 'relative' }}>
              <button
                className="topbar-icon"
                onClick={() => {
                  setShowNotificationsDropdown(!showNotificationsDropdown);
                  setShowBranchDropdown(false);
                  setShowRoleDropdown(false);
                  setShowProfileMenu(false);
                }}
                style={{ position: 'relative', background: 'var(--bg-gray)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <span style={{ fontSize: '16px' }}>🔔</span>
                {notifications.filter(n => !n.read).length > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    background: 'var(--danger)',
                    color: '#fff',
                    fontSize: '9px',
                    fontWeight: '700',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>
              {showNotificationsDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '8px',
                  background: 'var(--bg-white)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  minWidth: '320px',
                  boxShadow: 'var(--shadow-md)',
                  zIndex: 1000,
                  padding: '12px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>Practice Alerts</span>
                    <button
                      onClick={markAllNotificationsAsRead}
                      style={{ background: 'none', border: 'none', fontSize: '11px', color: 'var(--primary)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600' }}
                    >
                      Mark all read
                    </button>
                  </div>
                  <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>No notifications</div>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          onClick={() => {
                            if (!n.read) {
                              toggleNotificationRead(n.id);
                            }
                            setShowNotificationsDropdown(false);
                            
                            if (n.title.toLowerCase().includes('mismatch') || n.message.toLowerCase().includes('gstr-2b')) {
                              router.push(ROUTES.gstReconciliation);
                            } else if (n.type === 'reminder' || n.title.toLowerCase().includes('deadline')) {
                              router.push(ROUTES.tasks);
                            } else if (n.type === 'insight' || n.title.toLowerCase().includes('risk')) {
                              router.push(ROUTES.risk);
                            } else if (n.title.toLowerCase().includes('payment') || n.title.toLowerCase().includes('billing')) {
                              router.push(ROUTES.invoices);
                            } else {
                              router.push(ROUTES.dashboard);
                            }
                          }}
                          style={{
                            padding: '8px',
                            borderBottom: '1px solid var(--bg-gray)',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            background: n.read ? 'none' : 'var(--warning-light)',
                            marginBottom: '4px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-primary)' }}>
                              {n.type === 'alert' && '⚠️ '}
                              {n.type === 'reminder' && '📅 '}
                              {n.type === 'insight' && '🤖 '}
                              {n.type === 'system' && '⚙️ '}
                              {n.title}
                            </span>
                            <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{n.timestamp}</span>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.4' }}>{n.message}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button className="topbar-icon" onClick={toggleTheme} title={isDark ? 'Light Mode' : 'Dark Mode'} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '8px', width: '36px', height: '36px', cursor: 'pointer' }}>
              {isDark ? '☀️' : '🌙'}
            </button>
            <div style={{ position: 'relative' }}>
              <button className="topbar-icon" onClick={() => {
                setShowProfileMenu(!showProfileMenu);
                setShowBranchDropdown(false);
                setShowRoleDropdown(false);
                setShowNotificationsDropdown(false);
              }} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '8px', width: '36px', height: '36px', cursor: 'pointer' }}>
                {user?.avatar}
              </button>
              {showProfileMenu && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '8px',
                  background: 'var(--bg-white)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  minWidth: '200px',
                  boxShadow: 'var(--shadow-md)',
                  zIndex: 1000,
                }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{user?.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{user?.email}</div>
                  </div>
                  <button
                    onClick={() => { setShowProfileMenu(false); logout(); }}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    🚪 Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="content" style={{ position: 'relative' }}>
          {activePage !== 'dashboard' && (
            <div style={{ marginBottom: '24px' }}>
              <Link 
                href="/" 
                className="group inline-flex items-center text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors w-fit"
                style={{ textDecoration: 'none' }}
              >
                <div className="p-2 rounded-full bg-white shadow-sm border border-slate-100 mr-3 group-hover:shadow-md transition-all flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
                </div>
                Back to Dashboard
              </Link>
            </div>
          )}
          {/* Branch Switching Loader Overlay */}
          {isBranchLoading && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(255, 255, 255, 0.75)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              borderRadius: '12px',
              animation: 'fadeIn 0.2s ease',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', border: '4px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary)' }}>Syncing branch data...</div>
              </div>
            </div>
          )}

          {/* Page Load Skeletons */}
          {isLoadingPage && (
            <div className="page active" style={{ animation: 'fadeIn 0.15s ease' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Skeleton Header */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="skeleton shimmer" style={{ width: '220px', height: '28px', borderRadius: '4px' }}></div>
                  <div className="skeleton shimmer" style={{ width: '340px', height: '16px', borderRadius: '4px' }}></div>
                </div>
                
                {/* Skeleton KPI Cards Grid */}
                <div className="grid g4">
                  {[1, 2, 3, 4].map(n => (
                    <div key={n} className="card skeleton shimmer" style={{ height: '115px', borderRadius: '12px' }}></div>
                  ))}
                </div>

                {/* Skeleton Grid */}
                <div className="grid g-2-1">
                  <div className="card skeleton shimmer" style={{ height: '280px', borderRadius: '12px' }}></div>
                  <div className="card skeleton shimmer" style={{ height: '280px', borderRadius: '12px' }}></div>
                </div>
              </div>
            </div>
          )}

          {/* Access Denied Interceptor */}
          {!isLoadingPage && activePage === 'access-denied' && (
            <div className="page active" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '420px', textAlign: 'center', gap: '16px' }}>
              <div style={{ fontSize: '64px' }}>🔒</div>
              <h2 style={{ color: 'var(--danger)', fontWeight: 800 }}>Access Denied</h2>
              <p style={{ maxWidth: '460px', color: 'var(--text-secondary)', fontSize: '13.5px', lineHeight: 1.5 }}>
                Your active role profile <b>({selectedRole})</b> does not have permissions to access this module.
              </p>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <Link href="/" className="btn btn-primary" style={{ textDecoration: 'none', color: '#fff', padding: '10px 20px', display: 'flex', alignItems: 'center' }}>Go to Dashboard</Link>
                <button className="btn btn-secondary" onClick={() => router.back()}>← Go Back</button>
              </div>
            </div>
          )}

          {/* Error Boundary Interceptor */}
          {!isLoadingPage && pageError && (
            <div className="page active" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '420px', textAlign: 'center', gap: '16px' }}>
              <div style={{ fontSize: '64px' }}>⚠️</div>
              <h2 style={{ color: 'var(--danger)', fontWeight: 800 }}>Unable to open page</h2>
              <p style={{ maxWidth: '460px', color: 'var(--text-secondary)', fontSize: '13.5px', lineHeight: 1.5 }}>
                The requested route failed to execute because the server connection was interrupted. Please check your network or try again.
              </p>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button className="btn btn-primary" onClick={() => { setSimulatePageFail(false); setPageError(false); }}>🔄 Retry Connection</button>
                <button className="btn btn-secondary" onClick={() => router.back()}>← Go Back</button>
                <button className="btn btn-secondary" onClick={() => alert('Support ticket raised. Team is investigating.')}>📞 Contact Support</button>
              </div>
            </div>
          )}

          {/* Client Profile Subview Interceptor */}
          {!isLoadingPage && !pageError && activePage === 'clients' && selectedClientId && (
            <ClientProfileView
              client={allClients.find(c => c.id === selectedClientId) || allClients[0]}
              onBack={() => router.push(ROUTES.clients)}
              documents={documents}
              invoices={allInvoices}
              tasks={allTasks}
            />
          )}

          {/* DUES PAYMENT MODAL CHECKOUT */}
          {showPaymentModal && (
            <div style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              animation: 'fadeIn 0.2s ease',
            }}>
              <div style={{
                background: 'var(--bg-white)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                width: '100%',
                maxWidth: '400px',
                padding: '24px',
                boxShadow: 'var(--shadow-md)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>💳 Secure Checkout</h3>
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ marginBottom: '16px', background: 'var(--bg-light)', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Amount Due</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--primary)', marginTop: '2px' }}>₹25,000</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>CA Audit Services FY 2025-26</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>Card Number</label>
                    <input
                      type="text"
                      placeholder="4111 2222 3333 4444"
                      value={ccNumber}
                      onChange={(e) => setCcNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                      style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-light)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>Expiry</label>
                      <input
                        type="text"
                        placeholder="MM/YY"
                        value={ccExpiry}
                        onChange={(e) => setCcExpiry(e.target.value.slice(0, 5))}
                        style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-light)', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>CVV</label>
                      <input
                        type="password"
                        placeholder="123"
                        value={ccCvv}
                        onChange={(e) => setCcCvv(e.target.value.replace(/\D/g, '').slice(0, 3))}
                        style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-light)', color: 'var(--text-primary)' }}
                      />
                    </div>
                  </div>

                  <button
                    disabled={isPaying || !ccNumber || !ccExpiry || !ccCvv}
                    onClick={() => {
                      setIsPaying(true);
                      setTimeout(() => {
                        setIsPaying(false);
                        setClientDuesPaid(true);
                        setShowPaymentModal(false);
                        // Add successful payment notification
                        setNotifications([
                          { id: `pay-${Date.now()}`, title: 'Payment Successful', message: 'CA Audit Fee payment of ₹25,000 was successfully processed.', type: 'system', timestamp: 'Just now', read: false },
                          ...notifications
                        ]);
                      }, 1200);
                    }}
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center', marginTop: '12px', padding: '12px' }}
                  >
                    {isPaying ? 'Processing Secure Payment...' : '🔒 Pay ₹25,000 Now'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CA/PARTNER + ADMIN UNIFIED DASHBOARD — full access to all firm features */}
          {activePage === 'dashboard' && (selectedRole === 'CA/Partner' || selectedRole === 'Admin') && (
            <div className="page active">
              <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h1>Welcome, {user?.name} 👋</h1>
                  <p>Your compliance dashboard overview</p>
                </div>
                <div 
                  onClick={() => setShowLiveSyncModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'var(--bg-gray)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s ease' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-gray)'; }}
                >
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', background: liveSyncState.status === 'connected' ? 'var(--success)' : 'var(--error)', borderRadius: '50%', animation: liveSyncState.status === 'connected' ? 'pulse 1.5s infinite' : 'none' }} />
                  <span>Live Sync {liveSyncState.status === 'connected' ? 'Connected' : 'Disconnected'}</span>
                </div>
              </div>

              {/* Primary KPI Cards Grid */}
              <div className="grid g4" style={{ marginBottom: '20px' }}>
                <DashboardCard
                  title="Total Invoices"
                  value={invoices.length}
                  targetRoute={ROUTES.invoices}
                  filters={{ status: 'all' }}
                  icon="📄"
                  permission={['CA/Partner', 'Admin', 'Staff/Article']}
                  changeText={`₹${(totalRevenue / 100000).toFixed(1)}L revenue`}
                  colorClass="indigo"
                  userRole={selectedRole}
                />
                <DashboardCard
                  title="Paid Invoices"
                  value={paidCount}
                  targetRoute={ROUTES.invoices}
                  filters={{ status: 'paid' }}
                  icon="✓"
                  permission={['CA/Partner', 'Admin', 'Staff/Article']}
                  changeText={`${invoices.length > 0 ? Math.round((paidCount / invoices.length) * 100) : 0}% collected`}
                  colorClass="green"
                  userRole={selectedRole}
                />
                <DashboardCard
                  title="Pending Invoices"
                  value={pendingCount}
                  targetRoute={ROUTES.invoices}
                  filters={{ status: 'pending' }}
                  icon="⏳"
                  permission={['CA/Partner', 'Admin', 'Staff/Article']}
                  changeText="awaiting payment"
                  colorClass="amber"
                  userRole={selectedRole}
                />
                <DashboardCard
                  title="GST Collected"
                  value={`₹${(totalGst / 100000).toFixed(1)}L`}
                  targetRoute={ROUTES.gst}
                  filters={{ tab: 'collection' }}
                  icon="💰"
                  permission={['CA/Partner', 'Admin', 'Staff/Article']}
                  changeText="this period"
                  colorClass="red"
                  userRole={selectedRole}
                />
              </div>

              {/* Secondary KPI Cards Grid */}
              <div className="grid g4" style={{ marginBottom: '24px' }}>
                <DashboardCard
                  title="Revenue"
                  value={`₹${(totalRevenue / 100000).toFixed(1)}L`}
                  targetRoute={ROUTES.reports}
                  filters={{ type: 'revenue' }}
                  icon="📈"
                  permission={['CA/Partner', 'Admin']}
                  changeText="Target: ₹4.0L"
                  colorClass="green"
                  userRole={selectedRole}
                />
                <DashboardCard
                  title="Total Clients"
                  value={clients.length}
                  targetRoute={ROUTES.clients}
                  filters={{ tab: 'directory' }}
                  icon="👥"
                  permission={['CA/Partner', 'Admin', 'Staff/Article']}
                  changeText="Active practice"
                  colorClass="indigo"
                  userRole={selectedRole}
                />
                <DashboardCard
                  title="Today's Tasks"
                  value={tasks.filter(t => !t.completed).length}
                  targetRoute={ROUTES.tasks}
                  filters={{ due: 'today' }}
                  icon="📅"
                  permission={['CA/Partner', 'Admin', 'Staff/Article', 'Client']}
                  changeText="due by end of day"
                  colorClass="amber"
                  userRole={selectedRole}
                />
                <DashboardCard
                  title="Audit Exceptions"
                  value={riskTransactions.length}
                  targetRoute={ROUTES.risk}
                  filters={{ tab: 'audit', status: 'exception' }}
                  icon="⚠️"
                  permission={['CA/Partner', 'Admin']}
                  changeText="Requires review"
                  colorClass="red"
                  userRole={selectedRole}
                />
              </div>

              {/* Custom SVG/HTML Clickable Drill-down Charts */}
              <div className="grid g3" style={{ marginBottom: '24px' }}>
                {/* Revenue Chart Widget */}
                <ClickableWidget targetRoute={ROUTES.reports} filters={{ type: 'revenue' }} className="interactive-chart-card">
                  <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Monthly Revenue Trends</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Click bar to filter</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '140px', padding: '16px 8px 8px', marginTop: '12px', borderBottom: '1px solid var(--border-color)' }}>
                    {[
                      { month: 'Jan', val: 120000, h: '55%' },
                      { month: 'Feb', val: 150000, h: '68%' },
                      { month: 'March', val: 140000, h: '64%' },
                      { month: 'Apr', val: 180000, h: '82%' },
                      { month: 'May', val: 220000, h: '100%' },
                      { month: 'Jun', val: 195000, h: '89%' }
                    ].map((d, index) => (
                      <Link 
                        key={index} 
                        href={`/reports?type=revenue&month=${d.month}`}
                        onClick={(e) => e.stopPropagation()} 
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '13%', gap: '8px', textDecoration: 'none' }}
                      >
                        <div 
                          className="chart-bar-fill" 
                          style={{ width: '100%', height: d.h, background: 'linear-gradient(180deg, var(--primary) 0%, rgba(27, 58, 107, 0.6) 100%)', borderRadius: '4px 4px 0 0', position: 'relative' }}
                          title={`Click for ${d.month} Revenue: ₹${(d.val/1000).toFixed(0)}K`}
                        />
                        <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>{d.month}</span>
                      </Link>
                    ))}
                  </div>
                </ClickableWidget>

                {/* GST Chart Widget */}
                <ClickableWidget targetRoute={ROUTES.gst} filters={{ tab: 'history' }} className="interactive-chart-card">
                  <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>GST Collected (CGST + SGST)</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Click month</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '140px', padding: '16px 8px 8px', marginTop: '12px', borderBottom: '1px solid var(--border-color)' }}>
                    {[
                      { month: 'Jan', val: 21600, h: '55%' },
                      { month: 'Feb', val: 27000, h: '68%' },
                      { month: 'March', val: 25200, h: '64%' },
                      { month: 'Apr', val: 32400, h: '82%' },
                      { month: 'May', val: 39600, h: '100%' },
                      { month: 'Jun', val: 35100, h: '89%' }
                    ].map((d, index) => (
                      <Link 
                        key={index} 
                        href={`/gst/history?month=${d.month}`}
                        onClick={(e) => e.stopPropagation()} 
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '13%', gap: '8px', textDecoration: 'none' }}
                      >
                        <div 
                          className="chart-bar-fill" 
                          style={{ width: '100%', height: d.h, background: 'linear-gradient(180deg, var(--success) 0%, rgba(16, 185, 129, 0.6) 100%)', borderRadius: '4px 4px 0 0' }}
                          title={`Click for ${d.month} GST: ₹${(d.val/1000).toFixed(1)}K`}
                        />
                        <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>{d.month}</span>
                      </Link>
                    ))}
                  </div>
                </ClickableWidget>

                {/* Risk Distribution Chart Widget */}
                <ClickableWidget targetRoute={ROUTES.risk} className="interactive-chart-card">
                  <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Vendor Risk Profile</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Click seg to filter</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyItems: 'center', justifyContent: 'center', height: '140px', padding: '16px 8px 8px', marginTop: '12px', gap: '16px' }}>
                    <div style={{ display: 'flex', height: '24px', borderRadius: '12px', overflow: 'hidden', width: '100%', background: 'var(--bg-gray)' }}>
                      <Link href="/clients?risk=low" onClick={(e) => e.stopPropagation()} style={{ width: '60%', background: 'var(--success)', display: 'block' }} title="Low Risk: 60%" />
                      <Link href="/clients?risk=medium" onClick={(e) => e.stopPropagation()} style={{ width: '25%', background: 'var(--warning)', display: 'block' }} title="Medium Risk: 25%" />
                      <Link href="/clients?risk=high" onClick={(e) => e.stopPropagation()} style={{ width: '15%', background: 'var(--danger)', display: 'block' }} title="High Risk: 15%" />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '12px' }}>
                      <Link href="/clients?risk=low" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontWeight: 600, textDecoration: 'none' }}>
                        <span style={{ display: 'block', width: '10px', height: '10px', background: 'var(--success)', borderRadius: '50%' }} /> Low (60%)
                      </Link>
                      <Link href="/clients?risk=medium" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontWeight: 600, textDecoration: 'none' }}>
                        <span style={{ display: 'block', width: '10px', height: '10px', background: 'var(--warning)', borderRadius: '50%' }} /> Medium (25%)
                      </Link>
                      <Link href="/clients?risk=high" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontWeight: 600, textDecoration: 'none' }}>
                        <span style={{ display: 'block', width: '10px', height: '10px', background: 'var(--danger)', borderRadius: '50%' }} /> High (15%)
                      </Link>
                    </div>
                  </div>
                </ClickableWidget>
              </div>

              {/* Main Workspace Dashboard Grid */}
              <div className="grid g-2-1" style={{ marginBottom: '24px' }}>
                
                {/* Active Clients Panel */}
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                      <div className="card-title">Active Clients</div>
                      <div className="card-sub">{clients.length} clients managed</div>
                    </div>
                    <Link href="/clients" className="btn btn-secondary btn-sm" style={{ padding: '8px 16px' }}>
                      View Directory
                    </Link>
                  </div>
                  <div className="table-wrap">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th>Client</th>
                          <th>GSTIN</th>
                          <th>GST Status</th>
                          <th>Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clients.slice(0, 4).map(c => (
                          <tr
                            key={c.id}
                            className="clickable-row"
                            onClick={() => router.push(ROUTES.clientProfile(c.id))}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setContextMenu({ x: e.clientX, y: e.clientY, clientId: c.id });
                            }}
                            style={{ cursor: 'pointer', transition: 'background 0.2s ease' }}
                          >
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="row-arrow" style={{ opacity: 0, color: 'var(--primary)', fontWeight: 700 }}>→</span>
                                <b>{c.name}</b>
                              </div>
                            </td>
                            <td>
                              <span
                                className="clickable-badge font-mono"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(c.gstin);
                                  setGstRegClient(c);
                                  setShowGstRegModal(true);
                                  alert(`GSTIN ${c.gstin} copied to clipboard! Opening registration profile...`);
                                }}
                                style={{
                                  fontSize: '11.5px',
                                  padding: '2px 6px',
                                  background: 'var(--bg-gray)',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: '4px',
                                  cursor: 'copy'
                                }}
                                title="Click to copy and view registration details"
                              >
                                {c.gstin.substring(0, 10)}...
                              </span>
                            </td>
                            <td>
                              <span
                                className={`badge badge-${c.gstStatus === 'filed' ? 'success' : c.gstStatus === 'mismatch' ? 'danger' : 'warning'} clickable-badge`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (c.gstStatus === 'filed') {
                                    router.push(ROUTES.gstHistory);
                                  } else {
                                    router.push(ROUTES.gstReconciliation);
                                  }
                                }}
                                title={c.gstStatus === 'filed' ? 'Click to open GST History' : 'Click to open GSTR-2B Reconciliation'}
                              >
                                {c.gstStatus}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`badge badge-${c.riskLevel === 'low' ? 'success' : c.riskLevel === 'medium' ? 'warning' : 'danger'} clickable-badge`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(ROUTES.riskReport);
                                }}
                                title="Click to view Vendor Risk Report"
                              >
                                {c.riskLevel}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', paddingLeft: '4px' }}>
                    💡 <i>Tip: Right-click client rows to trigger the operations context menu.</i>
                  </div>
                </div>

                {/* Upcoming Tasks Panel */}
                <div className="card">
                  <div className="card-title">Upcoming Tasks</div>
                  <div className="card-sub">{tasks.filter(t => !t.completed).length} pending</div>
                  
                  <ul className="timeline" style={{ marginTop: '12px' }}>
                    {tasks.filter(t => !t.completed).slice(0, 4).map(t => (
                      <li
                        key={t.id}
                        className="clickable-timeline-item"
                        onClick={() => {
                          setSelectedTask(t);
                          setShowTaskModal(true);
                        }}
                        style={{ cursor: 'pointer', position: 'relative', paddingBottom: '16px' }}
                      >
                        <div className="tl-dot" style={{ background: `var(--${t.priority === 'high' ? 'danger' : t.priority === 'medium' ? 'warning' : 'success'}-light)`, color: `var(--${t.priority === 'high' ? 'danger' : t.priority === 'medium' ? 'warning' : 'success'})` }}>!</div>
                        <div className="tl-content" style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="tl-title" style={{ fontWeight: '700' }}>{t.title}</div>
                            <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: `var(--${t.priority === 'high' ? 'danger' : t.priority === 'medium' ? 'warning' : 'success'}-light)`, color: `var(--${t.priority === 'high' ? 'danger' : t.priority === 'medium' ? 'warning' : 'success'})`, fontWeight: 700 }}>
                              {t.priority}
                            </span>
                          </div>
                          <div className="tl-time" style={{ marginTop: '2px' }}>Due: {t.dueDate}</div>
                          
                          {/* Quick Actions (displayed on hover via CSS classes) */}
                          <div className="task-quick-actions" style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTask(t.id);
                                alert('Task marked as completed!');
                              }}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 8px', fontSize: '11px', background: 'var(--success-light)', color: 'var(--success)', border: 'none' }}
                            >
                              ✓ Complete
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTask(t);
                                alert('Open details to reschedule');
                              }}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 8px', fontSize: '11px' }}
                            >
                              📅 Resched
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                alert('Choose clerk assignment from details');
                              }}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 8px', fontSize: '11px' }}
                            >
                              👥 Assign
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Recent Activity Feed */}
              <div className="card" style={{ marginBottom: '20px' }}>
                <div className="card-title">Recent Activity Log</div>
                <div className="card-sub">Auditable operations feed for CA OS Command Center</div>
                
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { text: 'Invoice INV-2026-003 was paid by Gupta Pvt Ltd', val: '₹1,25,000', icon: '💰', route: '/billing?id=3', time: '10m ago' },
                    { text: 'Document Arora_Purchase_June_2026.pdf was successfully analyzed via Groq OCR', val: '98% Conf', icon: '📁', route: '/documents?id=d1', time: '42m ago' },
                    { text: 'GST Return GSTR-1 filed successfully for Mehta Enterprises', val: 'AY 2026-27', icon: '💳', route: '/gst/history', time: '2h ago' },
                    { text: 'Audit Compliance Notice notice_it_442.pdf uploaded by tax council', val: 'IT Notice', icon: '⚖️', route: '/litigation', time: 'Yesterday' }
                  ].map((act, idx) => (
                    <Link
                      key={idx}
                      href={act.route}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        color: 'inherit',
                        background: 'var(--bg-white)',
                        transition: 'transform 0.15s ease, border-color 0.15s ease'
                      }}
                      className="activity-item-hover"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '20px' }}>{act.icon}</span>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{act.text}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{act.time}</div>
                        </div>
                      </div>
                      <span className="badge badge-gray" style={{ fontWeight: '700', fontSize: '11px' }}>{act.val}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}


          {/* STAFF/ARTICLE DASHBOARD VIEW */}
          {activePage === 'dashboard' && selectedRole === 'Staff/Article' && (
            <div className="page active">
              <div className="page-header">
                <h1>My Assignments Workspace 👋</h1>
                <p>Track your compliance queues, uploaded documents, and check lists</p>
              </div>

              <div className="grid g3" style={{ marginBottom: '20px' }}>
                <div className="metric indigo">
                  <div className="metric-icon indigo">✓</div>
                  <div className="metric-label">My Assigned Tasks</div>
                  <div className="metric-value">{tasks.filter(t => !t.completed).length} Pending</div>
                  <div className="metric-change up">2 tasks due this week</div>
                </div>
                <div className="metric green">
                  <div className="metric-icon green">📁</div>
                  <div className="metric-label">Documents Uploaded</div>
                  <div className="metric-value">{documents.length || 12} files</div>
                  <div className="metric-change up">↑ 4 extracted today</div>
                </div>
                <div className="metric amber">
                  <div className="metric-icon amber">💬</div>
                  <div className="metric-label">Client Queries</div>
                  <div className="metric-value">2 Open Threads</div>
                  <div className="metric-change down">Awaiting reply</div>
                </div>
              </div>

              <div className="grid g-2-1">
                <div className="card">
                  <div className="card-title">My Assigned Checklist</div>
                  <div className="card-sub">Check off to mark completed</div>
                  <div style={{ marginTop: '16px' }}>
                    {tasks.map(t => (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                        <input
                          type="checkbox"
                          checked={t.completed}
                          onChange={() => toggleTask(t.id)}
                          style={{ marginRight: '12px', width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <div style={{ flex: 1, textDecoration: t.completed ? 'line-through' : 'none', opacity: t.completed ? 0.6 : 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{t.title}</div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Due: {t.dueDate}</div>
                        </div>
                        <span className={`badge badge-${t.priority === 'high' ? 'danger' : 'warning'}`}>{t.priority}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <div className="card-title">Recent Extraction Success</div>
                  <div className="card-sub">AI Categorization review logs</div>
                  <div style={{ marginTop: '12px' }}>
                    {[
                      { file: 'RentInvoice_Mumbai.pdf', conf: 98, status: 'Extracted' },
                      { file: 'SharmaFoods_TDS.png', conf: 92, status: 'Extracted' },
                      { file: 'Statement_June.pdf', conf: 95, status: 'Processing' },
                    ].map((doc, index) => (
                      <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: '12.5px' }}>
                        <div>
                          <div style={{ fontWeight: '600' }}>{doc.file}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Confidence: {doc.conf}%</div>
                        </div>
                        <div>
                          <span className={`badge badge-${doc.status === 'Extracted' ? 'success' : 'warning'}`}>{doc.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CLIENT PORTAL DASHBOARD VIEW */}
          {activePage === 'dashboard' && selectedRole === 'Client' && (
            <div className="page active">
              <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h1>Client Dashboard Portal 👋</h1>
                  <p>Welcome back, <b>{user?.name || 'Arora Trading Co.'}</b> — Your compliance overview</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'var(--bg-gray)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', background: 'var(--success)', borderRadius: '50%', animation: 'pulse 1.5s infinite' }} />
                  <span>Secure Client Session</span>
                </div>
              </div>

              <div className="grid g3" style={{ marginBottom: '20px' }}>
                <div className="metric green">
                  <div className="metric-icon green">✓</div>
                  <div className="metric-label">Compliance Filings</div>
                  <div className="metric-value">GST Filed</div>
                  <div className="metric-change up">ITR filing is in progress</div>
                </div>
                <div className="metric indigo">
                  <div className="metric-icon indigo">📁</div>
                  <div className="metric-label">Uploaded Papers</div>
                  <div className="metric-value">{documents.length || 14} Documents</div>
                  <div className="metric-change up">Last uploaded yesterday</div>
                </div>
                <div className="metric amber">
                  <div className="metric-icon amber">💳</div>
                  <div className="metric-label">Outstanding Fees</div>
                  <div className="metric-value">{clientDuesPaid ? '₹0' : '₹25,000'}</div>
                  <div className="metric-change down" style={{ color: clientDuesPaid ? 'var(--success)' : 'var(--danger)' }}>
                    {clientDuesPaid ? 'Paid' : 'Payment Overdue'}
                  </div>
                </div>
              </div>

              <div className="grid g-2-1">
                {/* Outstanding Dues Portal card */}
                <div className="card">
                  <div className="card-title">Professional Fees & Dues</div>
                  <div className="card-sub">Review invoice entries and clear outstanding dues</div>
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-color)', fontSize: '13px' }}>
                      <div>
                        <b>CA Audit Fee - FY 2025-26</b>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>Invoice #CA-2026-889</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: '700', color: 'var(--primary)' }}>₹25,000</div>
                        <span className={`badge badge-${clientDuesPaid ? 'success' : 'danger'}`}>{clientDuesPaid ? 'PAID' : 'UNPAID'}</span>
                      </div>
                    </div>

                    {!clientDuesPaid && (
                      <div style={{ marginTop: '24px', textAlign: 'right' }}>
                        <button
                          className="btn btn-primary"
                          onClick={() => setShowPaymentModal(true)}
                        >
                          💳 Pay Outstanding Dues (₹25,000)
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="card">
                  <div className="card-title">Filing Status Tracker</div>
                  <div className="card-sub">Current status of annual tax schedules</div>
                  <div style={{ marginTop: '16px' }}>
                    {[
                      { form: 'GSTR-3B (May 2026)', status: 'Filed', date: 'June 10, 2026', type: 'success' },
                      { form: 'GSTR-1 (May 2026)', status: 'Filed', date: 'June 08, 2026', type: 'success' },
                      { form: 'ITR-5 Return filing', status: 'Pending Uploads', date: 'Due July 31, 2026', type: 'danger' },
                    ].map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: `var(--${item.type === 'success' ? 'success' : 'danger'})` }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--text-primary)' }}>{item.form}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.date}</div>
                        </div>
                        <span className={`badge badge-${item.type}`}>{item.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Upload Document specific to Portal */}
              <div className="card" style={{ marginTop: '20px' }}>
                <div className="card-title">Portal Document Dropzone</div>
                <div className="card-sub">Send missing Form 16, bank statement sheets or invoices directly to your CA partner</div>
                <div style={{ display: 'flex', gap: '16px', marginTop: '16px', alignItems: 'center' }}>
                  <input
                    type="file"
                    id="client-portal-upload"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        alert(`Uploaded ${e.target.files[0].name} to CA workspace!`);
                      }
                    }}
                  />
                  <button
                    className="btn btn-secondary"
                    onClick={() => document.getElementById('client-portal-upload')?.click()}
                  >
                    📁 Select Documents
                  </button>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Supported files: PDF, XLSX, JPG, PNG (Max 50MB)</span>
                </div>
              </div>
            </div>
          )}

          {/* CLIENTS */}
          {!isLoadingPage && !pageError && !selectedClientId && activePage === 'clients' && (
            <div className="page active">
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-[#1e2b4d] mb-1">Client Onboarding & Management</h1>
                <p className="text-[14px] text-slate-400 font-medium">Manage, onboard, and assign {clients.length} active clients across branches</p>
              </div>

              {/* Module 2 Client Workspace Tabs */}
              <div className="flex gap-2 mb-4 w-full overflow-x-auto pb-2">
                <button
                  onClick={() => setActiveClientTab('directory')}
                  className={`px-3 py-1.5 rounded-md text-[13px] font-bold transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap border ${
                    activeClientTab === 'directory' 
                      ? 'bg-white text-slate-800 border-slate-200 shadow-sm' 
                      : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-100'
                  }`}
                >
                  <span>📋</span>
                  Client Directory & Assignments
                </button>
                <button
                  onClick={() => setActiveClientTab('wizard')}
                  className={`px-3 py-1.5 rounded-md text-[13px] font-bold transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap border ${
                    activeClientTab === 'wizard' 
                      ? 'bg-white text-slate-800 border-slate-200 shadow-sm' 
                      : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-100'
                  }`}
                >
                  <span className="text-amber-400">✨</span>
                  AI Onboarding Wizard
                </button>
                <button
                  onClick={() => setActiveClientTab('import')}
                  className={`px-3 py-1.5 rounded-md text-[13px] font-bold transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap border ${
                    activeClientTab === 'import' 
                      ? 'bg-white text-slate-800 border-slate-200 shadow-sm' 
                      : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-100'
                  }`}
                >
                  <span className="text-blue-500">📥</span>
                  Bulk CSV Import
                </button>
                <button
                  onClick={() => setActiveClientTab('staff')}
                  className={`px-3 py-1.5 rounded-md text-[13px] font-bold transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap border ${
                    activeClientTab === 'staff' 
                      ? 'bg-white text-slate-800 border-slate-200 shadow-sm' 
                      : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-100'
                  }`}
                >
                  <span className="text-slate-500">👥</span>
                  Team & Staff Workspace
                </button>
              </div>

              {/* TAB 1: CLIENT DIRECTORY & STAFF ASSIGNMENTS */}
              {activeClientTab === 'directory' && (
                globalSimulateEmpty ? (
                  <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textIndent: 0, textAlign: 'center', gap: '16px' }}>
                    <div style={{ fontSize: '64px' }}>👥</div>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary)' }}>Your client list is empty</h3>
                      <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '480px', margin: '8px auto 0', lineHeight: '1.5' }}>
                        Onboard your first client to get started. You can use our AI-powered lookup wizard or import details from existing spreadsheet records.
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                      <button
                        onClick={() => setActiveClientTab('wizard')}
                        className="btn btn-primary"
                        style={{ padding: '10px 20px', fontWeight: '700' }}
                      >
                        Add First Client
                      </button>
                      <button
                        onClick={() => setActiveClientTab('import')}
                        className="btn btn-secondary"
                        style={{ padding: '10px 20px', fontWeight: '700' }}
                      >
                        Import from Excel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <div className="card-title">All Registered Clients ({clients.length})</div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Active Branch: <b>{selectedBranch}</b></span>
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Client Name</th>
                            <th>Email</th>
                            <th>GSTIN / PAN</th>
                            <th>Entity Type</th>
                            <th>GST status</th>
                            <th>Risk Level</th>
                            <th>Assigned Staff</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clients.map(c => {
                            const staff = staffList.find(s => s.id === c.assignedStaffId);
                            return (
                              <tr key={c.id}>
                                <td>
                                  <div><b>{c.name}</b></div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>ID: #{c.id}</div>
                                </td>
                                <td>{c.email}</td>
                                <td>
                                  <div style={{ fontSize: '12.5px' }}>{c.gstin}</div>
                                  {c.gstin.length > 2 && (
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>PAN: {c.gstin.substring(2, 12)}</div>
                                  )}
                                </td>
                                <td><span className="badge badge-gray">{c.type}</span></td>
                                <td>
                                  <span className={`badge badge-${c.gstStatus === 'filed' ? 'success' : c.gstStatus === 'mismatch' ? 'danger' : 'warning'}`}>
                                    {c.gstStatus.toUpperCase()}
                                  </span>
                                </td>
                                <td>
                                  <span className={`badge badge-${c.riskLevel === 'low' ? 'success' : c.riskLevel === 'medium' ? 'warning' : 'danger'}`}>
                                    {c.riskLevel.toUpperCase()}
                                  </span>
                                </td>
                                <td>
                                  {selectedRole === 'CA/Partner' || selectedRole === 'Admin' ? (
                                    <select
                                      value={c.assignedStaffId || ''}
                                      onChange={(e) => handleAssignStaff(c.id, e.target.value)}
                                      style={{
                                        padding: '6px 10px',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '6px',
                                        fontSize: '12.5px',
                                        fontFamily: 'inherit',
                                        background: 'var(--bg-white)',
                                        color: 'var(--text-primary)',
                                        outline: 'none',
                                      }}
                                    >
                                      <option value="">Unassigned</option>
                                      {staffList.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span style={{ fontSize: '13px', fontWeight: '600' }}>
                                      {staff ? `👥 ${staff.name}` : 'Unassigned'}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              )}

              {/* TAB 2: STEP-BY-STEP ONBOARDING WIZARD */}
              {activeClientTab === 'wizard' && (
                <ClientOnboardingWizard />
              )}

              {/* TAB 3: BULK SPREADSHEET IMPORT */}
              {activeClientTab === 'import' && (
                <div className="card">
                  <div className="card-title">Bulk Client Import</div>
                  <div className="card-sub">Upload a spreadsheet to import multiple client records into the practice workspace</div>

                  <div style={{ padding: '24px', border: '2px dashed var(--border-color)', borderRadius: '8px', background: 'var(--bg-light)', textAlign: 'center', marginBottom: '20px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📊</div>
                    <input
                      type="file"
                      onChange={(e) => setBulkFile(e.target.files?.[0]?.name || '')}
                      style={{ marginBottom: '12px' }}
                    />
                    <div>
                      <button
                        onClick={parseBulkCSV}
                        disabled={isBulkImporting || !bulkFile}
                        className="btn btn-primary"
                        style={{ marginTop: '12px' }}
                      >
                        {isBulkImporting ? 'Parsing File...' : 'Parse Client CSV'}
                      </button>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px' }}>
                      CSV columns must include: name, email, gstin, type, risk
                    </div>
                  </div>

                  {bulkClients.length > 0 && (
                    <div>
                      <div className="card-title" style={{ fontSize: '14px', marginBottom: '8px' }}>Parsed Client Records ({bulkClients.length})</div>
                      <div className="table-wrap" style={{ marginBottom: '16px' }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Client Name</th>
                              <th>Email</th>
                              <th>GSTIN</th>
                              <th>Type</th>
                              <th>Initial Risk</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bulkClients.map((bc, index) => (
                              <tr key={index}>
                                <td><b>{bc.name}</b></td>
                                <td>{bc.email}</td>
                                <td>{bc.gstin}</td>
                                <td><span className="badge badge-gray">{bc.type}</span></td>
                                <td><span className={`badge badge-${bc.risk === 'low' ? 'success' : bc.risk === 'medium' ? 'warning' : 'danger'}`}>{bc.risk}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <button onClick={handleBulkImportSubmit} className="btn btn-success">
                          Import {bulkClients.length} Clients
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: TEAM WORKSPACE & STAFF TRAINING */}
              {activeClientTab === 'staff' && (
                <div className="grid g-1-2">
                  {/* Left panel: Add Staff member */}
                  <div className="card" style={{ height: 'fit-content' }}>
                    <div className="card-title">Invite Staff Member</div>
                    <div className="card-sub">Add article assistants to the practice portal</div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>Full Name</label>
                        <input type="text" placeholder="Name..." value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>Email Address</label>
                        <input type="email" placeholder="email@firm.com" value={newStaffEmail} onChange={(e) => setNewStaffEmail(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>Assigned Access Role</label>
                        <select
                          value={newStaffRole}
                          onChange={(e) => setNewStaffRole(e.target.value)}
                          style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-white)', color: 'var(--text-primary)', fontFamily: 'inherit' }}
                        >
                          <option value="Article Clerk">Article Clerk</option>
                          <option value="Manager">Manager</option>
                          <option value="Partner">Partner</option>
                        </select>
                      </div>
                      <button onClick={handleAddStaff} className="btn btn-primary" style={{ marginTop: '8px' }}>
                        Invite Staff Member
                      </button>
                    </div>
                  </div>

                  {/* Right panel: Staff utilization directory and training checkers */}
                  <div className="card">
                    <div className="card-title">Staff Utilisation & Training Progress</div>
                    <div className="card-sub">Select a team member to manage their statutory learning checklist</div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                      {staffList.map(s => (
                        <div
                          key={s.id}
                          onClick={() => setSelectedStaffId(s.id)}
                          style={{
                            padding: '14px',
                            border: selectedStaffId === s.id ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                            borderRadius: '10px',
                            background: selectedStaffId === s.id ? 'var(--gold-light)' : 'var(--bg-white)',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '13.5px' }}>{s.name}</span>
                              <span className="badge badge-gray" style={{ fontSize: '10px' }}>{s.role}</span>
                            </div>
                            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>{s.email}</div>
                          </div>

                          <div style={{ width: '120px', textAlign: 'right' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Training progress</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div className="progress" style={{ background: 'var(--bg-gray)', height: '6px', borderRadius: '4px', flex: 1, overflow: 'hidden' }}>
                                <div className="progress-fill" style={{ background: 'var(--success)', width: `${s.trainingProgress}%`, height: '100%' }} />
                              </div>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-primary)' }}>{s.trainingProgress}%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Selected Staff Training Checklist Details */}
                    {selectedStaffId && (() => {
                      const selectedStaff = staffList.find(s => s.id === selectedStaffId);
                      if (!selectedStaff) return null;
                      return (
                        <div style={{ marginTop: '24px', padding: '16px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                          <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '12px' }}>
                            🎓 {selectedStaff.name}'s Ramp-up Checklist
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {selectedStaff.trainingChecklist.map((item: any) => (
                              <label
                                key={item.id}
                                style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px', color: 'var(--text-secondary)', cursor: 'pointer' }}
                              >
                                <input
                                  type="checkbox"
                                  checked={item.completed}
                                  onChange={() => handleToggleTrainingChecklist(selectedStaff.id, item.id)}
                                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                />
                                <span style={{ textDecoration: item.completed ? 'line-through' : 'none', opacity: item.completed ? 0.6 : 1 }}>
                                  {item.label}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* INVOICES */}
          {activePage === 'invoices' && (
            <div className="page active">
              <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h1>{selectedRole === 'Client' ? 'My Invoices & Dues' : 'Invoices'}</h1>
                  <p>{selectedRole === 'Client' ? 'View your billing history and outstanding payments from your CA firm' : `Total: ₹${(totalRevenue / 100000).toFixed(2)}L | GST: ₹${(totalGst / 100000).toFixed(2)}L | Paid: ${paidCount} | Pending: ${pendingCount}`}</p>
                </div>
                {selectedRole !== 'Client' && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-primary" onClick={() => setShowCreateInvoiceModal(true)}>
                      ➕ Create Invoice
                    </button>
                    <button className="btn btn-secondary" onClick={() => setShowAIAnalysisModal(true)} style={{ background: 'var(--primary-light)', color: 'var(--primary)', border: 'none' }}>
                      🤖 AI Risk Analysis
                    </button>
                  </div>
                )}
              </div>

              {(() => {
                const clientInvoiceList = selectedRole === 'Client'
                  ? invoices.filter(inv => inv.client?.toLowerCase().includes(user?.name?.toLowerCase()?.split(' ')?.[0] || 'arora') || true).slice(0, 5)
                  : invoices;
                const showEmpty = globalSimulateEmpty || clientInvoiceList.length === 0;
                return showEmpty ? (
                <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center', gap: '16px' }}>
                  <div style={{ fontSize: '64px' }}>🧾</div>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary)' }}>No invoices found.</h3>
                    <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '400px', margin: '8px auto 0' }}>
                      {selectedRole === 'Client' ? 'No invoices have been raised for your account yet.' : 'Create a new invoice to get started.'}
                    </p>
                  </div>
                  {selectedRole !== 'Client' && (
                    <button className="btn btn-primary" onClick={() => setShowCreateInvoiceModal(true)}>Create Invoice</button>
                  )}
                </div>
              ) : (
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div className="card-title">{selectedRole === 'Client' ? 'My Billing History' : `All Invoices ${searchParams.get('status') ? `(Filtered: ${searchParams.get('status')})` : ''}`}</div>
                    {searchParams.get('status') && selectedRole !== 'Client' && (
                      <Link href="/billing" style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '700' }}>Clear Filters</Link>
                    )}
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Invoice #</th>{selectedRole !== 'Client' && <th>Client</th>}<th>Amount</th><th>GST</th><th>Date</th><th>Status</th>{selectedRole !== 'Client' && <th>Action</th>}</tr></thead>
                      <tbody>
                        {(() => {
                          const statusParam = searchParams.get('status');
                          let list = selectedRole === 'Client'
                            ? invoices.slice(0, 5)
                            : (statusParam && statusParam !== 'all' ? invoices.filter(inv => inv.status === statusParam) : invoices);
                          
                          if (list.length === 0) {
                            return <tr><td colSpan={selectedRole === 'Client' ? 5 : 7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No invoices matching filter.</td></tr>;
                          }
                          
                          return list.map(inv => (
                            <tr key={inv.id}>
                              <td><b>{inv.number}</b></td>
                              {selectedRole !== 'Client' && <td>{inv.client}</td>}
                              <td>₹{inv.amount.toLocaleString()}</td>
                              <td>₹{inv.gst.toLocaleString()}</td>
                              <td>{inv.date}</td>
                              <td><span className={`badge badge-${inv.status === 'paid' ? 'success' : 'warning'}`}>{inv.status}</span></td>
                              {selectedRole !== 'Client' && (
                                <td style={{ display: 'flex', gap: '8px' }}>
                                  {inv.status === 'pending' && <button className="btn btn-sm btn-success" onClick={() => markInvoiceAsPaid(inv.id)}>Mark Paid</button>}
                                  <button className="btn btn-sm" style={{ background: 'var(--bg-gray)', color: 'var(--text-primary)' }} onClick={() => setViewInvoice(inv)}>View Details</button>
                                  <button className="btn btn-sm btn-primary" onClick={() => setEditInvoice(inv)}>Edit Invoice</button>
                                </td>
                              )}
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )})()}
              
              {/* CREATE INVOICE MODAL */}
              {showAIAnalysisModal && (
                <AIInvoiceAnalysisModal onClose={() => setShowAIAnalysisModal(false)} />
              )}

              {showCreateInvoiceModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="card" style={{ width: '500px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>Create New Invoice</h3>
                      <button onClick={() => setShowCreateInvoiceModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Select Client</label>
                        <select style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                          <option>Select...</option>
                          {allClients.map(c => <option key={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Amount (₹)</label>
                        <input type="number" placeholder="Enter amount" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Description</label>
                        <textarea placeholder="Service description..." rows={3} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}></textarea>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                      <button onClick={() => setShowCreateInvoiceModal(false)} className="btn" style={{ background: 'var(--bg-gray)' }}>Cancel</button>
                      <button onClick={() => {
                        alert('Invoice created successfully!');
                        setShowCreateInvoiceModal(false);
                      }} className="btn btn-primary">Generate Invoice</button>
                    </div>
                  </div>
                </div>
              )}
              {/* EDIT INVOICE MODAL */}
              {editInvoice && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="card" style={{ width: '500px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>Edit Invoice {editInvoice.number}</h3>
                      <button onClick={() => setEditInvoice(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Select Client</label>
                        <select defaultValue={editInvoice.client} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                          <option>Select...</option>
                          {allClients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                          {!allClients.find(c => c.name === editInvoice.client) && <option value={editInvoice.client}>{editInvoice.client}</option>}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Amount (₹)</label>
                        <input type="number" defaultValue={editInvoice.amount} placeholder="Enter amount" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Description</label>
                        <textarea defaultValue="Professional Services & Consulting" placeholder="Service description..." rows={3} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}></textarea>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                      <button onClick={() => setEditInvoice(null)} className="btn" style={{ background: 'var(--bg-gray)' }}>Cancel</button>
                      <button onClick={() => {
                        alert('Invoice updated successfully!');
                        setEditInvoice(null);
                      }} className="btn btn-primary">Save Changes</button>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW INVOICE MODAL */}
              {viewInvoice && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="card" style={{ width: '600px', maxWidth: '95%', maxHeight: '95vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>Invoice {viewInvoice.number}</h3>
                      <button onClick={() => setViewInvoice(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
                    </div>
                    
                    {/* INVOICE BODY / MOCK IMAGE */}
                    <div style={{ background: 'var(--bg-light)', padding: '32px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px' }}>
                        <div>
                          <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--primary)', marginBottom: '4px' }}>INVOICE</h2>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Date: {viewInvoice.date}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <h4 style={{ fontWeight: '700', fontSize: '14px', marginBottom: '4px' }}>AI Compliance Firm</h4>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>123 Tech Park, Cyber City</div>
                        </div>
                      </div>
                      
                      <div style={{ marginBottom: '32px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Billed To</div>
                        <h4 style={{ fontWeight: '700', fontSize: '15px' }}>{viewInvoice.client || 'Client Name'}</h4>
                      </div>

                      <table style={{ width: '100%', marginBottom: '32px', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                            <th style={{ textAlign: 'left', padding: '8px 0', fontSize: '12px', color: 'var(--text-muted)' }}>Description</th>
                            <th style={{ textAlign: 'right', padding: '8px 0', fontSize: '12px', color: 'var(--text-muted)' }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '12px 0', fontSize: '14px' }}>Professional Services & Consulting</td>
                            <td style={{ textAlign: 'right', padding: '12px 0', fontSize: '14px', fontWeight: '500' }}>₹{viewInvoice.amount.toLocaleString()}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '12px 0', fontSize: '14px' }}>GST (18%)</td>
                            <td style={{ textAlign: 'right', padding: '12px 0', fontSize: '14px', fontWeight: '500' }}>₹{viewInvoice.gst.toLocaleString()}</td>
                          </tr>
                        </tbody>
                        <tfoot>
                          <tr>
                            <td style={{ padding: '16px 0', fontSize: '16px', fontWeight: '800' }}>Total Due</td>
                            <td style={{ textAlign: 'right', padding: '16px 0', fontSize: '18px', fontWeight: '800', color: 'var(--primary)' }}>
                              ₹{(viewInvoice.amount + viewInvoice.gst).toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="btn" style={{ background: 'var(--bg-gray)' }} onClick={() => {
                          const element = document.createElement("a");
                          const file = new Blob([`Invoice ${viewInvoice.number}\nClient: ${viewInvoice.client}\nAmount: Rs ${viewInvoice.amount}\nGST: Rs ${viewInvoice.gst}\nTotal: Rs ${viewInvoice.amount + viewInvoice.gst}`], {type: 'text/plain'});
                          element.href = URL.createObjectURL(file);
                          element.download = `${viewInvoice.number}.txt`;
                          document.body.appendChild(element);
                          element.click();
                          document.body.removeChild(element);
                        }}>📥 Download PDF</button>
                        <button className="btn" style={{ background: 'var(--bg-gray)' }} onClick={() => {
                          alert(`Share link copied for ${viewInvoice.number}`);
                        }}>🔗 Copy Link</button>
                      </div>
                      <button className="btn btn-primary" onClick={() => {
                        setEditInvoice(viewInvoice);
                        setViewInvoice(null);
                      }}>Edit Invoice</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GST */}
          {activePage === 'gst' && (
            <div className="page active">
              <Gstr2bMatchingGrid simulateEmpty={globalSimulateEmpty} simulateAiError={globalSimulateAiError} />
            </div>
          )}

          {/* ITR */}
          {activePage === 'itr' && (
            <div className="page active">
              <div className="page-header">
                <h1>Income Tax & AIS</h1>
                <p>ITR preparation and AIS reconciliation</p>
              </div>

              <div className="grid g3" style={{ marginBottom: '20px' }}>
                <div className="card">
                  <div className="card-title">ITR Filing Status</div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--primary)', marginTop: '12px' }}>148</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Clients registered</div>
                  <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-gray)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>AIS Reconciliation: 3 mismatches</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Tax Savings: ₹3,82,500 available</div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-title">AIS Mismatches</div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--danger)', marginTop: '12px' }}>3</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Require attention</div>
                  <button className="btn btn-sm btn-secondary" style={{ marginTop: '12px', width: '100%' }} onClick={() => setShowAISMismatchesModal(true)}>Review Mismatches</button>
                </div>

                <div className="card">
                  <div className="card-title">Tax Deductions</div>
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                      <span>Life Insurance</span>
                      <span style={{ color: 'var(--primary)', fontWeight: '700' }}>₹1,50,000</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                      <span>Home Loan Interest</span>
                      <span style={{ color: 'var(--primary)', fontWeight: '700' }}>₹2,00,000</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span>Education</span>
                      <span style={{ color: 'var(--primary)', fontWeight: '700' }}>₹50,000</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TASKS */}
          {activePage === 'tasks' && (
            <div className="page active">
              <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h1>Compliance Tasks</h1>
                  <p>{tasks.filter(t => !t.completed).length} pending | {tasks.filter(t => t.completed).length} completed</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreateTaskModal(true)}>
                  ➕ Create Task
                </button>
              </div>

              {globalSimulateEmpty || tasks.length === 0 ? (
                <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center', gap: '16px' }}>
                  <div style={{ fontSize: '64px' }}>✓</div>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary)' }}>No tasks available.</h3>
                    <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '400px', margin: '8px auto 0' }}>
                      There are no compliance schedules currently on your list. Create one to get started.
                    </p>
                  </div>
                  <button className="btn btn-primary" onClick={() => setShowCreateTaskModal(true)}>
                    Create Task
                  </button>
                </div>
              ) : (
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div className="card-title">
                      All Tasks 
                      {searchParams.get('due') === 'today' && ' (Due Today)'}
                      {searchParams.get('status') === 'overdue' && ' (Overdue)'}
                    </div>
                    {(searchParams.get('due') || searchParams.get('status')) && (
                      <Link href="/tasks" style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '700' }}>
                        Clear Filters
                      </Link>
                    )}
                  </div>
                  <div style={{ marginTop: '16px' }}>
                    {(() => {
                      const dueParam = searchParams.get('due');
                      const statusParam = searchParams.get('status');
                      
                      let list = tasks;
                      
                      if (dueParam === 'today') {
                        // Filter tasks due today (or soon, e.g. GSTR-3B due date: 2026-06-20, TDS Q1 due date: 2026-07-07)
                        // In our mock data, let's treat tasks due on 2026-06-20 as 'due today' for simulation
                        list = tasks.filter(t => t.dueDate === '2026-06-20');
                      } else if (statusParam === 'overdue') {
                        // In mock data, tasks due before 2026-06-27 (like June 20 tasks) that are incomplete
                        list = tasks.filter(t => t.dueDate < '2026-06-27' && !t.completed);
                      }
                      
                      if (list.length === 0) {
                        return <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No tasks matching selected filter.</div>;
                      }
                      
                      return list.map(task => (
                        <div 
                          key={task.id} 
                          onClick={() => {
                            setSelectedTask(task);
                            setShowTaskModal(true);
                          }}
                          className="clickable-row"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '14px',
                            background: task.completed ? 'var(--bg-gray)' : 'var(--bg-white)',
                            borderBottom: '1px solid var(--border-color)',
                            opacity: task.completed ? 0.6 : 1,
                            textDecoration: task.completed ? 'line-through' : 'none',
                            cursor: 'pointer',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleTask(task.id);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: '18px', height: '18px', cursor: 'pointer', marginRight: '12px' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{task.title}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Due: {task.dueDate}</div>
                          </div>
                          <span className={`badge badge-${task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'warning' : 'success'}`}>
                            {task.priority} priority
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI COPILOT */}
          {activePage === 'copilot' && (
            <div className="page active">
              <div className="page-header">
                <h1>AI Copilot</h1>
                <p>Your intelligent compliance assistant</p>
              </div>

              {globalSimulateEmpty ? (
                <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textIndent: 0, textAlign: 'center', gap: '16px' }}>
                  <div style={{ fontSize: '64px' }}>🤖</div>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary)' }}>I need some financial data to start helping you</h3>
                    <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '480px', margin: '8px auto 0', lineHeight: '1.5' }}>
                      I need some financial data to start helping you. Once you upload bank statements or complete bookkeeping, I can answer questions and generate insights.
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '12px' }}>
                    {["What's the GST liability this month?", "Which clients have overdue filings?", "Show me the P&L summary."].map((chip, idx) => (
                      <span key={idx} style={{ padding: '8px 16px', background: 'var(--bg-gray)', border: '1px solid var(--border-color)', borderRadius: '20px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        ✨ {chip}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid g-2-1">
                  <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '0' }}>
                    <div className="chat-window">
                      <div className="chat-messages">
                        {chatMessages.map((msg, i) => (
                          <div key={i} className={`chat-msg ${msg.type}`}>
                            <div className="chat-avatar" style={{ background: msg.type === 'ai' ? 'var(--primary)' : 'var(--gold)', color: '#fff' }}>
                              {msg.type === 'ai' ? '🤖' : '👤'}
                            </div>
                            <div className="msg-bubble">{msg.text}</div>
                          </div>
                        ))}
                        <div ref={chatEndRef} />
                      </div>
                      <div className="chat-input-row">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                          placeholder="Ask about compliance, GST, ITR, clients..."
                        />
                        <button className="btn btn-primary" onClick={handleSendMessage} style={{ padding: '8px 14px', fontSize: '12px' }}>Send</button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="card" style={{ marginBottom: '16px' }}>
                      <div className="card-title">Quick Stats</div>
                      <div style={{ marginTop: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Active Clients</span>
                          <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--primary)' }}>{clients.length}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Total Invoices</span>
                          <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--primary)' }}>{invoices.length}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Pending Tasks</span>
                          <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--danger)' }}>{tasks.filter(t => !t.completed).length}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Total Revenue</span>
                          <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--success)' }}>₹{(totalRevenue / 100000).toFixed(1)}L</span>
                        </div>
                      </div>
                    </div>

                    <div className="card">
                      <div className="card-title">Suggested Queries</div>
                      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setChatInput('What is the GST filing status?')} style={{ width: '100%', justifyContent: 'flex-start' }}>GST filing status</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setChatInput('Show all clients')} style={{ width: '100%', justifyContent: 'flex-start' }}>Show all clients</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setChatInput('What are upcoming deadlines?')} style={{ width: '100%', justifyContent: 'flex-start' }}>Upcoming deadlines</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setChatInput('Analyze revenue trends')} style={{ width: '100%', justifyContent: 'flex-start' }}>Revenue analysis</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DOCUMENTS - COLLECTION PORTAL */}
          {activePage === 'documents' && (
            <div className="page active">
              <div className="page-header">
                <h1>Document Collection Portal</h1>
                <p>Central hub for document exchange, automated OCR parsing, and expiry compliance</p>
              </div>

              {/* Module 3 sub-tabs switcher */}
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setActiveDocTab('repo')}
                  className={`btn ${activeDocTab === 'repo' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                >
                  📁 Document Workspace
                </button>
                <button
                  onClick={() => setActiveDocTab('whatsapp')}
                  className={`btn ${activeDocTab === 'whatsapp' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                >
                  💬 WhatsApp Ingestion Sandbox
                </button>
                <button
                  onClick={() => setActiveDocTab('expiry')}
                  className={`btn ${activeDocTab === 'expiry' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                >
                  ⏳ KYC & Expiry Tracker
                </button>
              </div>

              {/* TAB 1: DOCUMENT REPOSITORY WORKSPACE */}
              {activeDocTab === 'repo' && (() => {
                const branchDocs = documents.filter(doc => clients.some(c => c.id === doc.clientId));
                const countAll = branchDocs.length;
                const countInvoices = branchDocs.filter(d => d.type === 'invoice' || d.type === 'receipt').length;
                const countBank = branchDocs.filter(d => d.type === 'bank-statement').length;
                const countGst = branchDocs.filter(d => d.type === 'gst-file').length;
                const countLegal = branchDocs.filter(d => d.type === 'legal').length;

                // Apply Filters
                const filteredDocs = branchDocs.filter(doc => {
                  if (selectedFolder !== 'all') {
                    if (selectedFolder === 'invoice') {
                      if (doc.type !== 'invoice' && doc.type !== 'receipt') return false;
                    } else if (doc.type !== selectedFolder) {
                      return false;
                    }
                  }
                  if (selectedFy !== 'all' && doc.fy !== selectedFy) return false;

                  if (searchQuery.trim() !== '') {
                    const q = searchQuery.toLowerCase();
                    const matchesFile = doc.fileName.toLowerCase().includes(q);
                    const clientName = allClients.find(c => c.id === doc.clientId)?.name.toLowerCase() || '';
                    if (!matchesFile && !clientName.includes(q)) return false;
                  }
                  return true;
                });

                if (globalSimulateEmpty) {
                  return (
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textIndent: 0, textAlign: 'center', gap: '16px' }}>
                      <div style={{ fontSize: '64px' }}>📥</div>
                      <div>
                        <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary)' }}>No documents have been uploaded yet</h3>
                        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '480px', margin: '8px auto 0', lineHeight: '1.5' }}>
                          No documents have been uploaded yet. Clients can send documents here.
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                        <button
                          onClick={() => alert('Document request notifications dispatched to client communication channels!')}
                          className="btn btn-primary"
                          style={{ padding: '10px 20px', fontWeight: '700' }}
                        >
                          Send a Document Request
                        </button>
                        <button
                          onClick={() => {
                            setGlobalSimulateEmpty(false);
                            alert('Disabled Empty State simulation. Please select a document to upload.');
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '10px 20px', fontWeight: '700' }}
                        >
                          Upload a Document Yourself
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <>
                    {/* Folder Metrics Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4" style={{ marginBottom: '24px' }}>
                      <div
                        onClick={() => setSelectedFolder('all')}
                        className="card"
                        style={{
                          padding: '16px',
                          cursor: 'pointer',
                          border: selectedFolder === 'all' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                          background: selectedFolder === 'all' ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-white)',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ fontSize: '24px', marginBottom: '8px' }}>📂</div>
                        <div style={{ fontWeight: '700', fontSize: '13px' }}>All Documents</div>
                        <div style={{ fontSize: '18px', fontWeight: '800', marginTop: '4px', color: 'var(--primary)' }}>{countAll}</div>
                      </div>

                      <div
                        onClick={() => setSelectedFolder('invoice')}
                        className="card"
                        style={{
                          padding: '16px',
                          cursor: 'pointer',
                          border: selectedFolder === 'invoice' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                          background: selectedFolder === 'invoice' ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-white)',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ fontSize: '24px', marginBottom: '8px' }}>🧾</div>
                        <div style={{ fontWeight: '700', fontSize: '13px' }}>Invoices & Receipts</div>
                        <div style={{ fontSize: '18px', fontWeight: '800', marginTop: '4px', color: 'var(--primary)' }}>{countInvoices}</div>
                      </div>

                      <div
                        onClick={() => setSelectedFolder('bank-statement')}
                        className="card"
                        style={{
                          padding: '16px',
                          cursor: 'pointer',
                          border: selectedFolder === 'bank-statement' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                          background: selectedFolder === 'bank-statement' ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-white)',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ fontSize: '24px', marginBottom: '8px' }}>🏦</div>
                        <div style={{ fontWeight: '700', fontSize: '13px' }}>Bank Statements</div>
                        <div style={{ fontSize: '18px', fontWeight: '800', marginTop: '4px', color: 'var(--primary)' }}>{countBank}</div>
                      </div>

                      <div
                        onClick={() => setSelectedFolder('gst-file')}
                        className="card"
                        style={{
                          padding: '16px',
                          cursor: 'pointer',
                          border: selectedFolder === 'gst-file' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                          background: selectedFolder === 'gst-file' ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-white)',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ fontSize: '24px', marginBottom: '8px' }}>📊</div>
                        <div style={{ fontWeight: '700', fontSize: '13px' }}>GST & Tax Files</div>
                        <div style={{ fontSize: '18px', fontWeight: '800', marginTop: '4px', color: 'var(--primary)' }}>{countGst}</div>
                      </div>

                      <div
                        onClick={() => setSelectedFolder('legal')}
                        className="card"
                        style={{
                          padding: '16px',
                          cursor: 'pointer',
                          border: selectedFolder === 'legal' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                          background: selectedFolder === 'legal' ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-white)',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚖️</div>
                        <div style={{ fontWeight: '700', fontSize: '13px' }}>Legal & KYC</div>
                        <div style={{ fontSize: '18px', fontWeight: '800', marginTop: '4px', color: 'var(--primary)' }}>{countLegal}</div>
                      </div>
                    </div>

                    {/* Drag-and-Drop Upload Section */}
                    <div className="card" style={{ marginBottom: '24px' }}>
                      <div className="card-title">Drag & Drop Bulk Upload Zone</div>
                      <div style={{
                        marginTop: '16px',
                        padding: '32px',
                        border: '2px dashed var(--border-color)',
                        borderRadius: '8px',
                        textAlign: 'center',
                        background: 'var(--bg-gray)',
                        position: 'relative'
                      }}>
                        {isOcrProcessing ? (
                          <div style={{ padding: '10px' }}>
                            <div style={{ fontSize: '32px', animation: 'spin 1.5s linear infinite', display: 'inline-block', marginBottom: '12px' }}>🔄</div>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary)' }}>Groq OCR Engine processing file...</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Extracting key value parameters & matching ledger mappings</div>
                          </div>
                        ) : (
                          <>
                            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📤</div>
                            <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: '8px' }}>Drag and drop files here, or click to browse</div>
                            <input
                              type="file"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) triggerOcrProcess(file.name);
                              }}
                              style={{
                                position: 'absolute',
                                inset: 0,
                                opacity: 0,
                                cursor: 'pointer',
                                width: '100%',
                                height: '100%'
                              }}
                            />
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              Supports PDF, JPG, PNG, JSON, CSV | Auto-extracts metadata for invoices, receipts, and licenses
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Repository Directory Table */}
                    <div className="card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                        <div className="card-title" style={{ margin: 0 }}>
                          Document Repository ({filteredDocs.length} files)
                        </div>

                        {/* Directory Filters */}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>FY:</span>
                          <select
                            value={selectedFy}
                            onChange={(e) => setSelectedFy(e.target.value)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-white)',
                              fontSize: '12px'
                            }}
                          >
                            <option value="all">All FYs</option>
                            <option value="2026-27">FY 2026-27</option>
                            <option value="2025-26">FY 2025-26</option>
                            <option value="2024-25">FY 2024-25</option>
                            <option value="2023-24">FY 2023-24</option>
                          </select>

                          {/* Quick Local search */}
                          <input
                            type="text"
                            placeholder="Filter file or client..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-color)',
                              fontSize: '12px',
                              width: '180px'
                            }}
                          />
                        </div>
                      </div>

                      {filteredDocs.length === 0 ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No documents match the active filter criteria. Try changing folders or FY.
                        </div>
                      ) : (
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>File Name</th>
                                <th>Client</th>
                                <th>FY</th>
                                <th>Category</th>
                                <th>Upload Date</th>
                                <th>Status</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredDocs.map(doc => {
                                const clientObj = allClients.find(c => c.id === doc.clientId);
                                return (
                                  <tr key={doc.id}>
                                    <td>
                                      <div style={{ fontWeight: '700' }}>{doc.fileName}</div>
                                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                                        {(doc.size / 1024).toFixed(0)} KB
                                      </div>
                                    </td>
                                    <td>{clientObj?.name || 'Unknown Client'}</td>
                                    <td><span style={{ fontSize: '11px', fontWeight: '700' }}>{doc.fy || '—'}</span></td>
                                    <td>
                                      <span className="badge badge-info" style={{ textTransform: 'uppercase', fontSize: '10px' }}>
                                        {doc.type}
                                      </span>
                                    </td>
                                    <td>{doc.uploadDate}</td>
                                    <td>
                                      <span className={`badge badge-${doc.status === 'verified' ? 'success' :
                                        doc.status === 'extracted' || doc.status === 'categorized' ? 'info' :
                                          doc.status === 'rejected' ? 'danger' : 'warning'
                                        }`} style={{ textTransform: 'capitalize' }}>
                                        {doc.status}
                                      </span>
                                    </td>
                                    <td>
                                      <div style={{ display: 'flex', gap: '4px' }}>
                                        <button
                                          onClick={() => {
                                            setSelectedDocTrail(doc);
                                            setShowTrailModal(true);
                                          }}
                                          className="btn btn-sm btn-secondary"
                                          title="View version audit trail"
                                        >
                                          🕒 History
                                        </button>

                                        {/* Status quick toggles for CA/Partner/Staff */}
                                        {selectedRole !== 'Client' && (
                                          <>
                                            {doc.status !== 'verified' && (
                                              <button
                                                onClick={() => handleStatusChange(doc.id, 'verified')}
                                                className="btn btn-sm btn-success"
                                                style={{ padding: '2px 8px', fontSize: '11px' }}
                                              >
                                                Verify
                                              </button>
                                            )}
                                            {doc.status !== 'rejected' && (
                                              <button
                                                onClick={() => handleStatusChange(doc.id, 'rejected')}
                                                className="btn btn-sm btn-secondary"
                                                style={{ padding: '2px 8px', fontSize: '11px', color: 'var(--text-danger)' }}
                                              >
                                                Reject
                                              </button>
                                            )}
                                          </>
                                        )}

                                        {/* Nudge trigger */}
                                        {(doc.status === 'pending' || doc.status === 'rejected') && (
                                          <button
                                            onClick={() => sendNudge(doc)}
                                            className="btn btn-sm btn-primary"
                                            style={{ padding: '2px 8px', fontSize: '11px' }}
                                          >
                                            Nudge
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

              {/* TAB 2: WHATSAPP UPLOAD SANDBOX */}
              {activeDocTab === 'whatsapp' && (
                <div className="grid g2">
                  <div className="card">
                    <div className="card-title">WhatsApp Sandbox Configurator</div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                      Configure the sandbox to simulate how clients snap a picture or attach bills via WhatsApp directly into CA·OS.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>Select Client Sender</label>
                        <select
                          value={waClientId}
                          onChange={(e) => setWaClientId(e.target.value)}
                          className="input"
                          style={{ width: '100%', fontSize: '12px' }}
                        >
                          {clients.map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>Document Attachment Preset</label>
                        <select
                          value={waFilePreset}
                          onChange={(e) => setWaFilePreset(e.target.value)}
                          className="input"
                          style={{ width: '100%', fontSize: '12px' }}
                        >
                          <option value="raw_fuel_receipt_102.png">⛽ Fuel Receipt - ₹3,420 (Receipt)</option>
                          <option value="client_lunch_bill_may.png">🍽️ Meal Bill - ₹1,850 (Receipt)</option>
                          <option value="corporate_invoice_908.pdf">🏢 Consulting Invoice - ₹1,24,500 (Invoice)</option>
                          <option value="icici_current_statement.pdf">🏦 Bank Statement Q1 (Bank Statement)</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>WhatsApp Chat Text</label>
                        <textarea
                          value={waMessageText}
                          onChange={(e) => setWaMessageText(e.target.value)}
                          className="input"
                          rows={3}
                          style={{ width: '100%', fontSize: '12px', resize: 'vertical' }}
                          placeholder="Type simulated WhatsApp text message..."
                        />
                      </div>

                      <button
                        onClick={handleWaSend}
                        disabled={isWaUploading || !waMessageText.trim()}
                        className="btn btn-primary"
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        {isWaUploading ? 'Sending Attachment...' : '🚀 Send via WhatsApp'}
                      </button>
                    </div>
                  </div>

                  {/* Smartphone Emulator Box */}
                  <div className="card" style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '480px', borderRadius: '12px', overflow: 'hidden', border: '3px solid #075E54' }}>
                    {/* Phone Status Top bar */}
                    <div style={{ background: '#075E54', color: '#fff', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ fontSize: '20px' }}>💬</div>
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '13px' }}>WhatsApp Client API</div>
                          <div style={{ fontSize: '10px', color: '#b2dfdb' }}>Online | Sandbox System</div>
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', color: '#b2dfdb', fontWeight: '700' }}>Active Chat</div>
                    </div>

                    {/* Chat Bubble List */}
                    <div style={{ flex: 1, background: '#ECE5DD', padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {waChatHistory.map((chat, idx) => (
                        <div
                          key={idx}
                          style={{
                            alignSelf: chat.sender === 'client' ? 'flex-end' : 'flex-start',
                            maxWidth: '85%',
                            background: chat.sender === 'client' ? '#DCF8C6' : '#FFFFFF',
                            color: '#303030',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            boxShadow: '0 1px 0.5px rgba(0,0,0,0.13)',
                            position: 'relative'
                          }}
                        >
                          <div style={{ fontSize: '12px', lineHeight: '1.4' }}>{chat.text}</div>
                          <div style={{ fontSize: '9px', color: '#888', textAlign: 'right', marginTop: '4px' }}>{chat.time}</div>
                        </div>
                      ))}

                      {isWaUploading && (
                        <div
                          style={{
                            alignSelf: 'flex-start',
                            background: '#FFFFFF',
                            color: 'var(--primary)',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            boxShadow: '0 1px 0.5px rgba(0,0,0,0.13)',
                            fontSize: '12px',
                            fontStyle: 'italic',
                            fontWeight: '700'
                          }}
                        >
                          💬 Groq OCR parsing document...
                        </div>
                      )}
                    </div>

                    {/* Phone footer simulation input */}
                    <div style={{ background: '#F0F0F0', padding: '10px 16px', borderTop: '1px solid #ddd', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <label 
                        style={{ fontSize: '18px', color: '#666', cursor: 'pointer', margin: 0, display: 'flex', alignItems: 'center' }}
                      >
                        📎
                        <input 
                          type="file" 
                          style={{ display: 'none' }} 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setWaPhoneInputText(prev => prev ? `${prev} [Attached: ${file.name}]` : `[Attached: ${file.name}]`);
                              e.target.value = ''; // Reset input
                            }
                          }}
                        />
                      </label>
                      <input 
                        type="text"
                        value={waPhoneInputText}
                        onChange={(e) => setWaPhoneInputText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handlePhoneWaSend();
                        }}
                        placeholder="Type a message..."
                        style={{
                          flex: 1,
                          background: '#FFF',
                          padding: '10px 16px',
                          borderRadius: '20px',
                          fontSize: '13px',
                          color: '#303030',
                          border: 'none',
                          outline: 'none'
                        }}
                      />
                      {waPhoneInputText.trim() ? (
                        <div 
                          style={{ 
                            fontSize: '14px', 
                            color: '#fff', 
                            background: '#075E54', 
                            borderRadius: '50%', 
                            width: '36px', 
                            height: '36px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                          onClick={() => handlePhoneWaSend()}
                        >➤</div>
                      ) : (
                        <div 
                          style={{ 
                            fontSize: '16px', 
                            color: '#fff', 
                            background: '#075E54', 
                            borderRadius: '50%', 
                            width: '36px', 
                            height: '36px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            setWaPhoneInputText('🎤 [Voice note simulating...]');
                            setTimeout(() => {
                              handlePhoneWaSend('🎤 [Voice message 0:15]');
                            }, 1000);
                          }}
                        >🎤</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: KYC & EXPIRY TRACKER */}
              {activeDocTab === 'expiry' && (() => {
                const branchLegalDocs = documents.filter(doc => {
                  const clientExists = clients.some(c => c.id === doc.clientId);
                  return clientExists && doc.type === 'legal' && doc.expiryDate;
                });

                const getDaysRemaining = (expiryDateStr?: string) => {
                  if (!expiryDateStr) return 0;
                  const today = new Date('2026-06-13');
                  const exp = new Date(expiryDateStr);
                  const diffTime = exp.getTime() - today.getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  return diffDays;
                };

                const simulateRenewal = (docId: string) => {
                  setDocuments(prev => prev.map(doc => {
                    if (doc.id === docId) {
                      // Add 1 year to expiryDate
                      const exp = new Date(doc.expiryDate || '2026-06-13');
                      exp.setFullYear(exp.getFullYear() + 1);
                      const newExpStr = exp.toISOString().split('T')[0];

                      const newVer = {
                        version: (doc.versions?.length || 0) + 1,
                        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
                        action: `Document simulated renewal. Expiry set to ${newExpStr}`,
                        user: `${selectedRole} (${user?.name || 'Staff'})`
                      };
                      return {
                        ...doc,
                        expiryDate: newExpStr,
                        versions: doc.versions ? [...doc.versions, newVer] : [newVer]
                      };
                    }
                    return doc;
                  }));
                  alert('Document renewed successfully! Expiry date extended by 1 year.');
                };

                return (
                  <div className="card">
                    <div className="card-title">KYC Document Expiry Tracker</div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                      Statutory license compliance monitoring. Highlights licenses and lease agreements expiring soon.
                    </p>

                    {branchLegalDocs.length === 0 ? (
                      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No legal or KYC documents with expiry tracking configured for this branch.
                      </div>
                    ) : (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>License / Agreement File</th>
                              <th>Client</th>
                              <th>Expiry Date</th>
                              <th>Remaining Days</th>
                              <th>Alert Status</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {branchLegalDocs.map(doc => {
                              const clientObj = allClients.find(c => c.id === doc.clientId);
                              const days = getDaysRemaining(doc.expiryDate);

                              let statusText = 'Safe';
                              let badgeColor = 'success';
                              if (days <= 0) {
                                statusText = 'Expired';
                                badgeColor = 'danger';
                              } else if (days <= 30) {
                                statusText = 'Urgent Action';
                                badgeColor = 'warning';
                              }

                              return (
                                <tr key={doc.id}>
                                  <td>
                                    <div style={{ fontWeight: '700' }}>{doc.fileName}</div>
                                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>License / Statutory File</div>
                                  </td>
                                  <td>{clientObj?.name || 'Unknown Client'}</td>
                                  <td><b>{doc.expiryDate}</b></td>
                                  <td>
                                    {days <= 0 ? (
                                      <span style={{ color: 'var(--text-danger)', fontWeight: '700' }}>Expired {Math.abs(days)} days ago</span>
                                    ) : (
                                      <span>{days} days left</span>
                                    )}
                                  </td>
                                  <td>
                                    <span className={`badge badge-${badgeColor}`} style={{ fontWeight: '700' }}>
                                      {statusText}
                                    </span>
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                      <button
                                        onClick={() => simulateRenewal(doc.id)}
                                        className="btn btn-sm btn-success"
                                        style={{ padding: '4px 8px', fontSize: '11px' }}
                                      >
                                        🔄 Renew 1 Year
                                      </button>

                                      <button
                                        onClick={() => {
                                          const noticeText = `Dear ${clientObj?.name || 'Client'},\n\nThis is an automated notice from your CA Advisory Team. Your statutory document "${doc.fileName}" is expiring on ${doc.expiryDate}.\n\nPlease upload the renewed license/deed via our portal or WhatsApp sandbox immediately to avoid compliance lapses.\n\nBest regards,\nCA OS Advisory`;
                                          alert(`AI Generated Renewal Notice Draft:\n\n${noticeText}`);
                                        }}
                                        className="btn btn-sm btn-secondary"
                                        style={{ padding: '4px 8px', fontSize: '11px' }}
                                      >
                                        ✉️ Get Notice Draft
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* OCR EXTRACTION FORM EDIT MODAL */}
              {showOcrModal && (
                <div style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0, 0, 0, 0.5)',
                  backdropFilter: 'blur(4px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10000,
                }}>
                  <div style={{
                    background: 'var(--bg-white)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    width: '100%',
                    maxWidth: '520px',
                    padding: '24px',
                    boxShadow: 'var(--shadow-md)',
                    maxHeight: '90vh',
                    overflowY: 'auto'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--primary)' }}>🔍 AI OCR Review & Save</h3>
                      <button onClick={() => setShowOcrModal(false)} style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
                    </div>

                    {globalSimulateAiError && ocrForm.type === 'bank-statement' ? (
                      <div>
                        {/* Error Alert Box */}
                        <div style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', marginBottom: '16px' }}>
                          ⚠️ This bank statement format is not yet supported.
                        </div>

                        {/* Raw file view */}
                        <div style={{ marginBottom: '16px' }}>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>Raw File Structure Preview</label>
                          <pre style={{ background: 'var(--bg-gray)', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '6px', fontSize: '11px', overflowX: 'auto', fontFamily: 'monospace', maxHeight: '120px', color: 'var(--text-secondary)' }}>
                            {`File: ${ocrForm.fileName}\nFormat: UTF-8 Binary Stream\nCols detected: 12\n[0] TXN_DATE [1] VAL_DATE [2] REMARK [3] CHQ_NUM [4] WITHDRAWAL [5] DEPOSIT\nError: Column sequence pattern mismatch (unrecognized header row).`}
                          </pre>
                        </div>

                        {/* Fallback steps */}
                        <div style={{ background: 'var(--info-light)', padding: '12px', borderRadius: '8px', border: '1px solid var(--info)', fontSize: '12.5px', color: 'var(--info)', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                          <div><b>Manual Recovery Action Required:</b></div>
                          <div>1. Download the standard CSV statement format template.</div>
                          <div>2. Paste bank column values into the template.</div>
                          <div>3. Re-upload the filled template below.</div>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
                          <button
                            onClick={() => alert('Support ticket raised successfully! Our parsing team will map this column structure to the library within 24 hours.')}
                            className="btn btn-secondary btn-sm"
                            style={{ border: '1px dashed var(--danger)', color: 'var(--danger)', fontWeight: '700' }}
                          >
                            ☎️ Report format to Support
                          </button>

                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => {
                                alert('Downloaded Bank_Statement_Import_Template.csv to your Downloads folder!');
                              }}
                              className="btn btn-secondary btn-sm"
                              style={{ fontWeight: '700' }}
                            >
                              📥 Download CSV Template
                            </button>
                            <button
                              onClick={() => {
                                alert('Simulating re-upload... CSV template verified! Auto-ledger mapped 5 transactions.');
                                setShowOcrModal(false);
                              }}
                              className="btn btn-primary btn-sm"
                              style={{ fontWeight: '700' }}
                            >
                              📤 Upload Filled Template
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : globalSimulateAiError ? (
                      <div>
                        {/* Error Alert Box */}
                        <div style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', marginBottom: '16px' }}>
                          ⚠️ AI could not extract data from this document clearly.
                        </div>

                        {/* Side by side Preview and Form */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                          <div style={{ background: 'var(--bg-gray)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
                            <span style={{ fontSize: '32px', marginBottom: '8px' }}>📄</span>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>[Original Document Preview]</div>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '4px' }}>{ocrForm.fileName}</div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', marginBottom: '2px' }}>INVOICE / BILL NO.</label>
                              <input type="text" placeholder="Enter manually..." className="input" style={{ width: '100%', fontSize: '12px', padding: '6px', border: '1px solid var(--border-color)', borderRadius: '4px' }} value={ocrForm.invoiceNumber} onChange={(e) => setOcrForm({ ...ocrForm, invoiceNumber: e.target.value })} />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', marginBottom: '2px' }}>VENDOR NAME</label>
                              <input type="text" placeholder="Enter manually..." className="input" style={{ width: '100%', fontSize: '12px', padding: '6px', border: '1px solid var(--border-color)', borderRadius: '4px' }} value={ocrForm.vendorName} onChange={(e) => setOcrForm({ ...ocrForm, vendorName: e.target.value })} />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', marginBottom: '2px' }}>AMOUNT (₹)</label>
                              <input type="number" placeholder="Enter manually..." className="input" style={{ width: '100%', fontSize: '12px', padding: '6px', border: '1px solid var(--border-color)', borderRadius: '4px' }} value={ocrForm.amount || ''} onChange={(e) => setOcrForm({ ...ocrForm, amount: parseFloat(e.target.value) || 0 })} />
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
                          <button
                            onClick={() => {
                              alert('Pre-processing image filters applied... Retrying enhanced OCR extraction.');
                              setTimeout(() => {
                                alert('Enhanced OCR also failed to identify vendor layout patterns. Please proceed with manual input.');
                              }, 1000);
                            }}
                            className="btn btn-secondary btn-sm"
                            style={{ fontWeight: '700' }}
                          >
                            🪄 Try Again with Enhanced OCR
                          </button>
                          <button
                            onClick={saveOcrData}
                            className="btn btn-primary btn-sm"
                            style={{ fontWeight: '700' }}
                          >
                            Save Manual Entry
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>File Name</label>
                          <input type="text" className="input" style={{ width: '100%', fontSize: '12px' }} value={ocrForm.fileName} readOnly />
                        </div>

                        <div className="grid g2">
                          <div>
                            <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>Document Type</label>
                            <select
                              value={ocrForm.type}
                              onChange={(e) => setOcrForm({ ...ocrForm, type: e.target.value as any })}
                              className="input"
                              style={{ width: '100%', fontSize: '12px' }}
                            >
                              <option value="invoice">Invoice</option>
                              <option value="receipt">Receipt</option>
                              <option value="bank-statement">Bank Statement</option>
                              <option value="gst-file">GST File</option>
                              <option value="legal">Legal/KYC</option>
                            </select>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>Associate Client</label>
                            <select
                              value={ocrForm.clientId}
                              onChange={(e) => setOcrForm({ ...ocrForm, clientId: e.target.value })}
                              className="input"
                              style={{ width: '100%', fontSize: '12px' }}
                            >
                              {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Display Invoice OCR attributes if Type is Invoice/Receipt */}
                        {(ocrForm.type === 'invoice' || ocrForm.type === 'receipt') && (
                          <>
                            <div className="grid g2">
                              <div>
                                <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>Invoice/Bill No.</label>
                                <input
                                  type="text"
                                  className="input"
                                  style={{ width: '100%', fontSize: '12px' }}
                                  value={ocrForm.invoiceNumber}
                                  onChange={(e) => setOcrForm({ ...ocrForm, invoiceNumber: e.target.value })}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>Vendor Name</label>
                                <input
                                  type="text"
                                  className="input"
                                  style={{ width: '100%', fontSize: '12px' }}
                                  value={ocrForm.vendorName}
                                  onChange={(e) => setOcrForm({ ...ocrForm, vendorName: e.target.value })}
                                />
                              </div>
                            </div>

                            <div className="grid g3">
                              <div>
                                <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>Base Amount (₹)</label>
                                <input
                                  type="number"
                                  className="input"
                                  style={{ width: '100%', fontSize: '12px' }}
                                  value={ocrForm.amount}
                                  onChange={(e) => setOcrForm({ ...ocrForm, amount: parseFloat(e.target.value) || 0 })}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>GST Tax (₹)</label>
                                <input
                                  type="number"
                                  className="input"
                                  style={{ width: '100%', fontSize: '12px' }}
                                  value={ocrForm.gst}
                                  onChange={(e) => setOcrForm({ ...ocrForm, gst: parseFloat(e.target.value) || 0 })}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>Total Amount</label>
                                <input
                                  type="text"
                                  className="input"
                                  style={{ width: '100%', fontSize: '12px', background: 'var(--bg-light)', fontWeight: '700' }}
                                  value={`₹${(ocrForm.amount + ocrForm.gst).toLocaleString('en-IN')}`}
                                  readOnly
                                />
                              </div>
                            </div>
                          </>
                        )}

                        <div className="grid g3">
                          <div>
                            <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>Document Date</label>
                            <input
                              type="date"
                              className="input"
                              style={{ width: '100%', fontSize: '12px' }}
                              value={ocrForm.date}
                              onChange={(e) => setOcrForm({ ...ocrForm, date: e.target.value })}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>Financial Year</label>
                            <select
                              value={ocrForm.fy}
                              onChange={(e) => setOcrForm({ ...ocrForm, fy: e.target.value })}
                              className="input"
                              style={{ width: '100%', fontSize: '12px' }}
                            >
                              <option value="2026-27">FY 2026-27</option>
                              <option value="2025-26">FY 2025-26</option>
                              <option value="2024-25">FY 2024-25</option>
                              <option value="2023-24">FY 2023-24</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>AI Ledger Account</label>
                            <select
                              className="input"
                              style={{ width: '100%', fontSize: '12px' }}
                            >
                              {ledgers.map(l => (
                                <option key={l.id} value={l.code}>{l.code} - {l.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>Document Description</label>
                          <input
                            type="text"
                            className="input"
                            style={{ width: '100%', fontSize: '12px' }}
                            value={ocrForm.description}
                            onChange={(e) => setOcrForm({ ...ocrForm, description: e.target.value })}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                          <button onClick={() => setShowOcrModal(false)} className="btn btn-secondary">Cancel</button>
                          <button onClick={saveOcrData} className="btn btn-primary">Save & Approve</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* DOCUMENT VERSION AUDIT TIMELINE MODAL */}
              {showTrailModal && selectedDocTrail && (
                <div style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0, 0, 0, 0.5)',
                  backdropFilter: 'blur(4px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10000,
                }}>
                  <div style={{
                    background: 'var(--bg-white)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    width: '100%',
                    maxWidth: '480px',
                    padding: '24px',
                    boxShadow: 'var(--shadow-md)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--primary)' }}>🕒 Version History & Audit Trail</h3>
                      <button onClick={() => { setShowTrailModal(false); setSelectedDocTrail(null); }} style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>{selectedDocTrail.fileName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Doc ID: {selectedDocTrail.id} | Size: {(selectedDocTrail.size / 1024).toFixed(0)} KB</div>
                    </div>

                    {/* Timeline logs */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '2px solid var(--border-color)', paddingLeft: '16px', marginLeft: '8px', position: 'relative' }}>
                      {(selectedDocTrail.versions || []).map((ver, idx) => (
                        <div key={idx} style={{ position: 'relative' }}>
                          {/* Timeline node dot */}
                          <div style={{
                            position: 'absolute',
                            left: '-23px',
                            top: '2px',
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            background: 'var(--primary)',
                            border: '2px solid var(--bg-white)'
                          }} />

                          <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>
                            Version {ver.version}: {ver.action}
                          </div>
                          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Updated by: <b>{ver.user}</b> | {ver.date}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '24px' }}>
                      <button onClick={() => { setShowTrailModal(false); setSelectedDocTrail(null); }} className="btn btn-secondary" style={{ fontSize: '12px' }}>Close Trail</button>
                      <button
                        onClick={() => alert(`Simulated secure download of version ${(selectedDocTrail.versions?.length || 1)} binary file`)}
                        className="btn btn-primary"
                        style={{ fontSize: '12px' }}
                      >
                        📥 Download File
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* NUDGE WHATSAPP TOAST OVERLAY */}
              {nudgeToast && (
                <div style={{
                  position: 'fixed',
                  bottom: '24px',
                  right: '24px',
                  background: 'var(--bg-white)',
                  borderLeft: '4px solid #25D366',
                  boxShadow: 'var(--shadow-lg)',
                  padding: '16px',
                  borderRadius: '6px',
                  zIndex: 20000,
                  maxWidth: '380px',
                  animation: 'slideUp 0.3s ease'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ fontWeight: '700', fontSize: '12px', color: '#128C7E', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>💬</span> WhatsApp Nudge Dispatched (AI Auto-Reminder)
                    </div>
                    <button onClick={() => setNudgeToast(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-primary)', background: '#F0F2F5', padding: '10px', borderRadius: '6px', fontStyle: 'italic' }}>
                    {nudgeToast.message}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', textAlign: 'right' }}>
                    Sent to {nudgeToast.clientName} Signatory contact number
                  </div>
                </div>
              )}

            </div>
          )}

          {/* AUTO LEDGER MAPPING */}
          {activePage === 'ledger' && (
            <div className="page active">
              <div className="page-header">
                <h1>Auto Ledger Mapping</h1>
                <p>Automatically assign transactions to accounting ledgers</p>
              </div>

              {globalSimulateEmpty ? (
                <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textIndent: 0, textAlign: 'center', gap: '16px' }}>
                  <div style={{ fontSize: '64px' }}>🏦</div>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary)' }}>No transactions found</h3>
                    <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '480px', margin: '8px auto 0', lineHeight: '1.5' }}>
                      No transactions found. Upload a bank statement to begin bookkeeping.
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                    <button
                      onClick={() => {
                        setGlobalSimulateEmpty(false);
                        setActivePage('documents');
                        setActiveDocTab('repo');
                      }}
                      className="btn btn-primary"
                      style={{ padding: '10px 24px', fontWeight: '700' }}
                    >
                      Upload Bank Statement
                    </button>
                    <a
                      href="#integrations"
                      onClick={(e) => {
                        e.preventDefault();
                        setGlobalSimulateEmpty(false);
                        setActivePage('settings');
                        alert('Navigating to Settings -> Integrations Hub. Click connect on Tally or bank channels.');
                      }}
                      style={{ fontSize: '13.0px', color: 'var(--primary)', fontWeight: '700', textDecoration: 'underline' }}
                    >
                      Connect via Integration
                    </a>
                  </div>
                </div>
              ) : (
                <>
                  {/* AI Ledger Mapping — Low Confidence Fallback */}
                  {globalSimulateAiError && (
                    <div className="card ai-border ai-bg" style={{ marginBottom: '20px', padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div style={{ fontWeight: '700', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>✨</span> Needs Manual Coding <span className="ai-badge">AI Confidence: 42%</span>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Low confidence transaction flagged by AI</span>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', background: 'var(--bg-white)', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '13.5px', color: 'var(--text-primary)' }}>Amazon Cloud Web Services (AWS)</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Txn Date: 2026-06-12 | Ref: AWS-99281-IND</div>
                        </div>
                        <div style={{ fontWeight: '800', fontSize: '16px', color: 'var(--primary)' }}>₹82,450.00</div>
                      </div>

                      <div style={{ marginTop: '16px' }}>
                        <div style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}>Top 3 AI Suggestions:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {[
                            { ledger: 'Software & Tools', code: '5300', confidence: 42 },
                            { ledger: 'Office Expenses', code: '5000', confidence: 28 },
                            { ledger: 'Utilities', code: '5200', confidence: 15 }
                          ].map((sug, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                alert(`Ledger mapped successfully to ${sug.code} - ${sug.ledger}! CA-OS has saved this decision for future AWS transactions.`);
                              }}
                              className="btn btn-secondary btn-sm ai-tooltip-trigger"
                              style={{ background: 'var(--bg-white)', border: '1px solid #DDD6FE', borderRadius: '20px', padding: '8px 16px', fontSize: '12px', display: 'flex', gap: '6px', alignItems: 'center' }}
                            >
                              <span style={{ fontWeight: '700', color: '#7C3AED' }}>{sug.ledger}</span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>({sug.confidence}%)</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-secondary)' }}>Or search ledger accounts:</label>
                        <input
                          type="text"
                          placeholder="Type ledger name (e.g. Rent, Office Expenses...)"
                          style={{ maxWidth: '360px', padding: '8px 12px', fontSize: '13px', border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none', background: 'var(--bg-white)' }}
                          onChange={(e) => {
                            if (e.target.value.toLowerCase() === 'travel') {
                              alert('Autocomplete matched: 5100 - Travel Expenses. Click to apply ledger mapping.');
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid g3" style={{ marginBottom: '20px' }}>
                    {ledgers.slice(0, 6).map(ledger => (
                      <div key={ledger.id} className="card" style={{ padding: '16px' }}>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary)', marginBottom: '8px' }}>
                          {ledger.code} - {ledger.name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                          {ledger.type.toUpperCase()}
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--success)' }}>
                          ₹{ledger.balance.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="card">
                    <div className="card-title">Recent Mappings</div>
                    <div style={{ marginTop: '12px' }}>
                      {[
                        { desc: 'Office rent paid', ledger: 'Rent & Facilities', amount: 50000, conf: 98 },
                        { desc: 'Travel reimbursement', ledger: 'Travel Expenses', amount: 8500, conf: 92 },
                        { desc: 'Software subscription', ledger: 'Software & Tools', amount: 12000, conf: 95 },
                      ].map((item, i) => (
                        <div key={i} style={{ padding: '12px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{item.desc}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>→ {item.ledger}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: '700', color: 'var(--primary)' }}>₹{item.amount.toLocaleString()}</div>
                            <div style={{ fontSize: '11px', color: 'var(--success)' }}>Confidence: {item.conf}%</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* EXPENSE CATEGORIZATION */}
          {activePage === 'expenses' && (
            <div className="page active">
              <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h1>Expense Categorization</h1>
                  <p>Classify and analyze business expenses by category</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowSyncModal(true)}>Sync Bank Data</button>
              </div>

              {/* KPIs */}
              <div className="grid g3" style={{ marginBottom: '24px' }}>
                <div className="card" style={{ padding: '20px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Total Expenses (MTD)</div>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '8px' }}>₹1,00,000</div>
                  <div style={{ fontSize: '12px', color: 'var(--success)', marginTop: '4px', fontWeight: '600' }}>↓ 12% vs last month</div>
                </div>
                <div className="card" style={{ padding: '20px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Tax Deductible</div>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--primary)', marginTop: '8px' }}>₹80,000</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Approx. ₹24,000 in tax savings</div>
                </div>
                <div className="card" style={{ padding: '20px', borderLeft: '4px solid var(--warning)' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Uncategorized</div>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--warning)', marginTop: '8px' }}>₹5,000</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Requires manual review (3 items)</div>
                </div>
              </div>

              <div className="grid g2" style={{ gap: '24px', alignItems: 'start' }}>
                {/* CATEGORIES PROGRESS */}
                <div className="card" style={{ padding: '0' }}>
                  <div className="card-title" style={{ padding: '20px 20px 0' }}>Categorized Expenses This Month</div>
                  <div style={{ padding: '20px' }}>
                    {[
                      { category: 'Travel', amount: 35000, icon: '✈️', percentage: 35 },
                      { category: 'Office Supplies', amount: 18000, icon: '📎', percentage: 18 },
                      { category: 'Software & Tools', amount: 25000, icon: '💻', percentage: 25 },
                      { category: 'Utilities', amount: 12000, icon: '💡', percentage: 12 },
                      { category: 'Other', amount: 10000, icon: '📦', percentage: 10 },
                    ].map((exp, i) => (
                      <div key={i} onClick={() => setCategoryDetails(exp.category)} style={{ padding: '12px 0', borderBottom: i !== 4 ? '1px solid var(--border-color)' : 'none', cursor: 'pointer' }} onMouseOver={(e) => e.currentTarget.style.opacity = '0.7'} onMouseOut={(e) => e.currentTarget.style.opacity = '1'}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>{exp.icon} {exp.category}</span>
                          <span style={{ fontWeight: '700', color: 'var(--primary)' }}>₹{exp.amount.toLocaleString()}</span>
                        </div>
                        <div style={{ background: 'var(--bg-gray)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                          <div style={{ background: 'var(--success)', width: `${exp.percentage}%`, height: '100%' }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* TRANSACTIONS TABLE */}
                <div className="card" style={{ padding: '0' }}>
                  <div className="card-title" style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Recent Transactions</span>
                    <button className="btn btn-sm" onClick={() => alert('Opening full transactions ledger...')} style={{ fontSize: '12px' }}>View All</button>
                  </div>
                  <div className="table-wrap" style={{ padding: '20px' }}>
                    <table style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Description</th>
                          <th>Category</th>
                          <th style={{ textAlign: 'right' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { date: '2026-06-25', desc: 'Indigo Airlines', cat: 'Travel', icon: '✈️', amt: 12500, type: 'mapped' },
                          { date: '2026-06-23', desc: 'Amazon AWS', cat: 'Software', icon: '💻', amt: 8400, type: 'mapped' },
                          { date: '2026-06-21', desc: 'Reliance Smart', cat: 'Uncategorized', icon: '❓', amt: 1500, type: 'unmapped' },
                          { date: '2026-06-18', desc: 'Tata Power', cat: 'Utilities', icon: '💡', amt: 4200, type: 'mapped' },
                          { date: '2026-06-15', desc: 'Uber India', cat: 'Travel', icon: '✈️', amt: 1200, type: 'mapped' },
                        ].map((txn, i) => (
                          <tr key={i}>
                            <td style={{ fontSize: '13px' }}>{txn.date}</td>
                            <td style={{ fontWeight: '500' }}>{txn.desc}</td>
                            <td>
                              <span className={`badge ${txn.type === 'unmapped' ? 'badge-warning' : 'badge-success'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                {txn.icon} {txn.cat}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: '700', color: txn.type === 'unmapped' ? 'var(--warning)' : 'var(--text-primary)' }}>
                              ₹{txn.amt.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* SYNC BANK DATA MODAL */}
              {showSyncModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="card" style={{ width: '450px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🔗 Sync Bank Data
                      </h3>
                      <button onClick={() => setShowSyncModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
                    </div>
                    
                    <div style={{ background: 'rgba(37, 211, 102, 0.1)', border: '1px solid rgba(37, 211, 102, 0.2)', padding: '12px', borderRadius: '8px', display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '20px' }}>
                      <span style={{ fontSize: '24px' }}>🔒</span>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '13px', color: '#128C7E', marginBottom: '4px' }}>End-to-End Encryption Enabled</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Your bank credentials are never stored on our servers. We use military-grade 256-bit encryption to securely connect to your institution.</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Select Bank Institution</label>
                        <select style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                          <option>HDFC Bank</option>
                          <option>ICICI Bank</option>
                          <option>State Bank of India</option>
                          <option>Axis Bank</option>
                          <option>Kotak Mahindra Bank</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Account Username / Customer ID</label>
                        <input type="text" placeholder="Enter User ID" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>Secure Password / PIN</label>
                        <input type="password" placeholder="••••••••" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                      <button onClick={() => setShowSyncModal(false)} className="btn" style={{ background: 'var(--bg-gray)' }}>Cancel</button>
                      <button onClick={() => {
                        alert('Authenticating with Bank... Connection established successfully! Transactions are syncing.');
                        setShowSyncModal(false);
                      }} className="btn btn-primary" style={{ background: '#128C7E', borderColor: '#128C7E' }}>Securely Connect</button>
                    </div>
                  </div>
                </div>
              )}

              {/* CATEGORY DETAILS MODAL */}
              {categoryDetails && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="card" style={{ width: '600px', maxWidth: '95%', maxHeight: '95vh', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                      <h3 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{categoryDetails} Expenses</h3>
                      <button onClick={() => setCategoryDetails(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
                    </div>
                    
                    <div className="grid g2" style={{ gap: '16px', marginBottom: '24px' }}>
                      <div style={{ background: 'var(--bg-light)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Monthly Spend (Avg)</div>
                        <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--primary)', marginTop: '4px' }}>₹{categoryDetails === 'Travel' ? '35,000' : categoryDetails === 'Office Supplies' ? '18,000' : '22,500'}</div>
                      </div>
                      <div style={{ background: 'var(--bg-light)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Yearly Spend (YTD)</div>
                        <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '4px' }}>₹{categoryDetails === 'Travel' ? '4,20,000' : categoryDetails === 'Office Supplies' ? '2,16,000' : '2,70,000'}</div>
                      </div>
                    </div>

                    <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>Detailed Transactions ({categoryDetails})</h4>
                    <div className="table-wrap">
                      <table style={{ width: '100%' }}>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Merchant</th>
                            <th style={{ textAlign: 'right' }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={{ fontSize: '13px' }}>2026-06-25</td>
                            <td style={{ fontWeight: '500' }}>{categoryDetails === 'Travel' ? 'Indigo Airlines' : 'Merchant A'}</td>
                            <td style={{ textAlign: 'right', fontWeight: '700' }}>₹{categoryDetails === 'Travel' ? '12,500' : '4,200'}</td>
                          </tr>
                          <tr>
                            <td style={{ fontSize: '13px' }}>2026-06-15</td>
                            <td style={{ fontWeight: '500' }}>{categoryDetails === 'Travel' ? 'Uber India' : 'Merchant B'}</td>
                            <td style={{ textAlign: 'right', fontWeight: '700' }}>₹{categoryDetails === 'Travel' ? '1,200' : '1,500'}</td>
                          </tr>
                          <tr>
                            <td style={{ fontSize: '13px' }}>2026-06-02</td>
                            <td style={{ fontWeight: '500' }}>{categoryDetails === 'Travel' ? 'Taj Hotels' : 'Merchant C'}</td>
                            <td style={{ textAlign: 'right', fontWeight: '700' }}>₹{categoryDetails === 'Travel' ? '8,400' : '3,800'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                      <button onClick={() => setCategoryDetails(null)} className="btn btn-primary">Close</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* COMPLIANCE CALENDAR */}
          {activePage === 'compliance' && (
            <div className="page active">
              <ComplianceIntelCenter simulateEmpty={globalSimulateEmpty} />
            </div>
          )}

          {/* RISK SCORING & AUDIT */}
          {activePage === 'risk' && (
            <div className="page active">
              <BenfordsForensicDashboard simulateEmpty={globalSimulateEmpty} />
            </div>
          )}

          {/* FINANCIAL INSIGHTS */}
          {activePage === 'insights' && (
            <div className="page active">
              <div className="page-header">
                <h1>Financial Insights & AI Recommendations</h1>
                <p>Business intelligence and tax saving recommendations</p>
              </div>

              <div style={{ marginTop: '16px' }}>
                {financialInsights.map(insight => (
                  <div key={insight.id} className="card" style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--primary)' }}>
                          {insight.title}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          {insight.description}
                        </div>
                      </div>
                      <span className={`badge badge-${insight.type === 'savings' ? 'success' : insight.type === 'anomaly' ? 'danger' : 'info'}`}>
                        {insight.type.toUpperCase()}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', padding: '12px 0', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Metric</div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary)' }}>{insight.metric}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Current Value</div>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--primary)' }}>
                          {typeof insight.value === 'number' ? `₹${(insight.value / 100000).toFixed(1)}L` : insight.value}
                        </div>
                      </div>
                      {insight.percentageChange && (
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Change</div>
                          <div style={{ fontSize: '16px', fontWeight: '700', color: insight.percentageChange > 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {insight.percentageChange > 0 ? '+' : ''}{insight.percentageChange}%
                          </div>
                        </div>
                      )}
                    </div>

                    {insight.suggestedAction && (
                      <div style={{ padding: '12px', background: 'var(--bg-gray)', borderRadius: '6px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--primary)', marginBottom: '4px' }}>💡 Recommended Action:</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{insight.suggestedAction}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LITIGATION */}
          {activePage === 'litigation' && (
            <div className="page active">
              <NoticeDraftingPanel simulateEmpty={globalSimulateEmpty} simulateAiError={globalSimulateAiError} />
            </div>
          )}

          {/* PAYROLL */}
          {activePage === 'payroll' && (
            <div className="page active">
              <PayrollConsole simulateEmpty={globalSimulateEmpty} />
            </div>
          )}

          {/* CORPORATE SECRETARIAL */}
          {activePage === 'secretarial' && (
            <div className="page active">
              <CorporateSecretarialManager />
            </div>
          )}

          {/* CLIENT COMMUNICATION & COLLABORATION */}
          {activePage === 'collaboration' && (
            <div className="page active">
              <CollaborationHub />
            </div>
          )}

          {/* SECURITY & ADMINISTRATION */}
          {activePage === 'admin' && (
            <div className="page active">
              <SecurityAdminConsole />
            </div>
          )}

          {/* REPORTS & EXPORT HUB */}
          {activePage === 'reports' && (
            <div className="page active">
              <ReportsExportHub simulateEmpty={globalSimulateEmpty} simulateAiError={globalSimulateAiError} />
            </div>
          )}

          {/* SETTINGS & CONFIGURATION */}
          {activePage === 'settings' && (
            <div className="page active">
              <SettingsControlCenter
                globalSimulateEmpty={globalSimulateEmpty}
                setGlobalSimulateEmpty={setGlobalSimulateEmpty}
                globalSimulateAiError={globalSimulateAiError}
                setGlobalSimulateAiError={setGlobalSimulateAiError}
              />
            </div>
          )}
        </div>
      </div>

      {/* Live Sync Management Modal */}
      {showLiveSyncModal && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}>
          <div className="modal-content" style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', width: '400px', maxWidth: '90%', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--primary)', margin: 0 }}>Live Sync Connection</h2>
              <button onClick={() => setShowLiveSyncModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
            </div>
            
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Connect your accounting software or CA portal to sync data automatically.
            </p>

            {liveSyncState.status === 'connected' ? (
              <div style={{ background: 'var(--bg-gray)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ width: '40px', height: '40px', background: 'var(--primary-light)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🔗</div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--primary)' }}>{liveSyncState.platform}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Connected as {liveSyncState.email}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--success)' }}>
                  <span style={{ display: 'inline-block', width: '6px', height: '6px', background: 'var(--success)', borderRadius: '50%' }} /> Active syncing
                </div>
                
                <button 
                  onClick={() => setLiveSyncState({ status: 'disconnected', platform: '', email: '' })}
                  className="btn btn-outline"
                  style={{ width: '100%', marginTop: '16px', color: 'var(--error)', borderColor: 'var(--error)' }}
                >
                  Disconnect Account
                </button>
              </div>
            ) : (
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                setLiveSyncState({
                  status: 'connected',
                  platform: formData.get('platform') as string,
                  email: formData.get('email') as string
                });
              }}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '8px' }}>Select Platform</label>
                  <select name="platform" required className="form-control" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}>
                    <option value="">Select a platform...</option>
                    <option value="Tally Prime">Tally Prime</option>
                    <option value="QuickBooks">QuickBooks</option>
                    <option value="Zoho Books">Zoho Books</option>
                    <option value="GST Portal API">GST Portal API</option>
                    <option value="Income Tax Portal">Income Tax Portal</option>
                  </select>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '8px' }}>Account Email / User ID</label>
                  <input name="email" type="text" required placeholder="admin@company.com" className="form-control" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)' }} />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Connect Account</button>
              </form>
            )}
          </div>
        </div>
      )}
      {/* AIS Mismatches Modal */}
      {showAISMismatchesModal && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}>
          <div className="modal-content" style={{ background: 'var(--bg-white)', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '500px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>AIS Mismatches</h2>
              <button onClick={() => setShowAISMismatchesModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '24px' }}>📄</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>SFT-005_Mutual_Funds.pdf</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>High Value Transactions</div>
                  </div>
                </div>
                <div style={{ color: 'var(--danger)', fontWeight: 'bold', fontSize: '14px' }}>₹1,50,000</div>
              </div>
              <div style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '24px' }}>📄</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>TDS_194J_Professional.pdf</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Form 26AS mismatch</div>
                  </div>
                </div>
                <div style={{ color: 'var(--danger)', fontWeight: 'bold', fontSize: '14px' }}>₹45,000</div>
              </div>
              <div style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '24px' }}>📄</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>SFT-014_Credit_Card.pdf</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Unreported Expenses</div>
                  </div>
                </div>
                <div style={{ color: 'var(--danger)', fontWeight: 'bold', fontSize: '14px' }}>₹82,500</div>
              </div>
            </div>
            
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setShowAISMismatchesModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
