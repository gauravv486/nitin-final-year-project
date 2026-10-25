'use client';

import { useState } from 'react';
import { 
  DollarSign, Users, ShieldAlert, Sparkles, Building, Landmark, Check, 
  AlertCircle, Play, ChevronRight, ChevronLeft, Download, FileText, 
  TrendingUp, RefreshCw, Send, CheckCircle, ShieldCheck, HelpCircle, 
  BookOpen, Eye, Award, Ban, UserCheck, AlertTriangle
} from 'lucide-react';

// Interfaces for our state elements
interface PayrollEmployee {
  id: string;
  name: string;
  code: string;
  pan: string;
  aadhaar: string;
  uan: string;
  esiNumber: string;
  basic: number;
  hra: number;
  allowance: number;
  totalDays: number;
  lopDays: number;
  otHours: number;
  regime: 'OLD' | 'NEW';
  state: 'Maharashtra' | 'Karnataka' | 'West Bengal' | 'Tamil Nadu';
  voluntaryPf?: number;
  flagged?: boolean;
  flagReason?: string;
}

interface PayrollConsoleProps {
  simulateEmpty?: boolean;
}

export default function PayrollConsole({ simulateEmpty = false }: PayrollConsoleProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'run' | 'engines' | 'copilot'>('overview');
  
  // Simulated Roster Data
  const [employees, setEmployees] = useState<PayrollEmployee[]>([
    { id: 'emp_1', name: 'Rajesh Kumar', code: 'EMP-001', pan: 'ABCPK1234F', aadhaar: '321045678901', uan: '100293847561', esiNumber: '2210987654', basic: 14000, hra: 5600, allowance: 3400, totalDays: 30, lopDays: 0, otHours: 4, regime: 'NEW', state: 'Maharashtra', flagged: false },
    { id: 'emp_2', name: 'Sunita Sharma', code: 'EMP-002', pan: 'ABCPK5678G', aadhaar: '987654321012', uan: '100293847562', esiNumber: '2210987655', basic: 25000, hra: 10000, allowance: 8000, totalDays: 30, lopDays: 1, otHours: 0, regime: 'OLD', state: 'Karnataka', flagged: false },
    { id: 'emp_3', name: 'Amit Roy', code: 'EMP-003', pan: 'ABCPK9012H', aadhaar: '123456789012', uan: '100293847563', esiNumber: '', basic: 12000, hra: 4800, allowance: 2200, totalDays: 30, lopDays: 0, otHours: 12, regime: 'NEW', state: 'West Bengal', flagged: false },
    { id: 'emp_4', name: 'Vikram Singh', code: 'EMP-004', pan: 'ABCPK3456J', aadhaar: '456789012345', uan: '100293847564', esiNumber: '2210987657', basic: 18000, hra: 7200, allowance: 4800, totalDays: 30, lopDays: 5, otHours: 0, regime: 'NEW', state: 'Tamil Nadu', flagged: true, flagReason: 'Spike in special allowance (+85% vs last month)' },
    { id: 'emp_5', name: 'Preeti Patel', code: 'EMP-005', pan: 'ABCPK1234F', aadhaar: '321045678901', uan: '100293847561', esiNumber: '2210987654', basic: 45000, hra: 18000, allowance: 12000, totalDays: 30, lopDays: 0, otHours: 0, regime: 'OLD', state: 'Maharashtra', flagged: true, flagReason: 'Duplicate PAN & UAN mapped to Rajesh Kumar (Potential Ghost Employee)' },
  ]);

  // Active state-level settings for statutory rules
  const [pfWageCeiling, setPfWageCeiling] = useState<number>(15000);
  const [esiEligibleCeiling, setEsiEligibleCeiling] = useState<number>(21000);
  const [higherPensionOption, setHigherPensionOption] = useState<boolean>(false);
  const [lwfEmployerShare, setLwfEmployerShare] = useState<number>(45);
  const [lwfEmployeeShare, setLwfEmployeeShare] = useState<number>(15);

  // Workflow run state
  const [runStep, setRunStep] = useState<number>(1);
  const [isCalculated, setIsCalculated] = useState<boolean>(false);
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [periodCode, setPeriodCode] = useState<string>('June 2026');
  const [selectedBank, setSelectedBank] = useState<string>('HDFC');
  
  // AI Copilot States
  const [copilotInput, setCopilotInput] = useState<string>('');
  const [copilotMessages, setCopilotMessages] = useState<any[]>([
    { role: 'assistant', content: 'Hello! I am your AI Payroll Copilot. I can analyze tax liabilities, simulate Old vs New regimes, flag ghost employees, and answer EPF/ESIC questions. What would you like to verify today?' }
  ]);

  // General State calculator logic
  const calculateEmployeeStatutories = (emp: PayrollEmployee) => {
    // Basic computation adjusted for LOP
    const attendanceFactor = (emp.totalDays - emp.lopDays) / emp.totalDays;
    const actualBasic = Math.round(emp.basic * attendanceFactor);
    const actualHra = Math.round(emp.hra * attendanceFactor);
    const actualAllow = Math.round(emp.allowance * attendanceFactor);
    const grossSalary = actualBasic + actualHra + actualAllow;

    // 1. Provident Fund calculations
    const pfWage = actualBasic; // In Indian rules, PF basic is the salary for calculation
    let employeePf = 0;
    let employerEps = 0;
    let employerEpf = 0;
    let edli = 0;
    let adminCharges = 0;

    if (pfWage > 0) {
      // Employee Share: 12% of Basic (+ DA if any)
      employeePf = Math.round(pfWage * 0.12);

      // Employer Share split (Pension EPS 8.33% up to ceiling, EPF is remaining of 12%)
      const pensionBase = higherPensionOption ? pfWage : Math.min(pfWage, pfWageCeiling);
      employerEps = Math.round(pensionBase * 0.0833);
      
      const totalEmployerPf = Math.round(pfWage * 0.12);
      employerEpf = Math.max(0, totalEmployerPf - employerEps);
      
      // EDLI 0.5% (limited to ceiling)
      edli = Math.round(Math.min(pfWage, pfWageCeiling) * 0.005);
      
      // Admin charges 0.5% of wages
      adminCharges = Math.round(pfWage * 0.005);
    }

    if (emp.voluntaryPf) {
      employeePf += Math.round(pfWage * (emp.voluntaryPf / 100));
    }

    // 2. ESIC Calculations (eligible if Gross Salary <= 21,000)
    let employeeEsi = 0;
    let employerEsi = 0;
    if (grossSalary <= esiEligibleCeiling && emp.esiNumber) {
      employeeEsi = Math.round(grossSalary * 0.0075);
      employerEsi = Math.round(grossSalary * 0.0325);
    }

    // 3. Professional Tax (PT) state-specific slabs
    let pt = 0;
    if (emp.state === 'Maharashtra') {
      if (grossSalary > 10000) pt = 200;
      else if (grossSalary > 7500) pt = 175;
    } else if (emp.state === 'Karnataka') {
      if (grossSalary > 25000) pt = 200;
    } else if (emp.state === 'West Bengal') {
      if (grossSalary > 40000) pt = 200;
      else if (grossSalary > 25000) pt = 150;
      else if (grossSalary > 15000) pt = 130;
      else if (grossSalary > 10000) pt = 110;
    } else if (emp.state === 'Tamil Nadu') {
      if (grossSalary > 15000) pt = 200;
      else if (grossSalary > 12000) pt = 150;
      else if (grossSalary > 9000) pt = 100;
    }

    // 4. LWF Calculation (Standard State rules)
    const lwfEmployee = grossSalary > 3000 ? lwfEmployeeShare : 0;
    const lwfEmployer = grossSalary > 3000 ? lwfEmployerShare : 0;

    // 5. Section 192 TDS Estimation (Old vs New Regime)
    let monthlyTds = 0;
    const annualGross = grossSalary * 12;
    if (emp.regime === 'NEW') {
      // New Tax Slab FY 2025-26/2026-27:
      // Up to 3,000,000 Nil. Slab 3-7L: 5%, 7-10L: 10%, 10-12L: 15%, 12-15L: 20%, >15L: 30%
      // Standard deduction: 75,000
      const taxableIncome = Math.max(0, annualGross - 75000);
      let annualTax = 0;
      if (taxableIncome > 1500000) {
        annualTax += (taxableIncome - 1500000) * 0.3 + 300000 * 0.2 + 200000 * 0.15 + 300000 * 0.1 + 400000 * 0.05;
      } else if (taxableIncome > 1200000) {
        annualTax += (taxableIncome - 1200000) * 0.2 + 200000 * 0.15 + 300000 * 0.1 + 400000 * 0.05;
      } else if (taxableIncome > 1000000) {
        annualTax += (taxableIncome - 1000000) * 0.15 + 300000 * 0.1 + 400000 * 0.05;
      } else if (taxableIncome > 700000) {
        annualTax += (taxableIncome - 700000) * 0.1 + 400000 * 0.05;
      } else if (taxableIncome > 300000) {
        annualTax += (taxableIncome - 300000) * 0.05;
      }
      
      // Rebate under 87A: Nil tax if income <= 7,00,000 (New regime)
      if (taxableIncome <= 700000) {
        annualTax = 0;
      }
      monthlyTds = Math.round((annualTax * 1.04) / 12); // Cess @ 4%
    } else {
      // Old Regime with standard deduction of 50k and 1.5L 80C mock
      const taxableIncome = Math.max(0, annualGross - 50000 - 150000);
      let annualTax = 0;
      if (taxableIncome > 1000000) {
        annualTax += (taxableIncome - 1000000) * 0.3 + 112500;
      } else if (taxableIncome > 500000) {
        annualTax += (taxableIncome - 500000) * 0.2 + 12500;
      } else if (taxableIncome > 250000) {
        annualTax += (taxableIncome - 250000) * 0.05;
      }
      // Rebate under 87A: Nil tax if income <= 5,00,000
      if (taxableIncome <= 500000) {
        annualTax = 0;
      }
      monthlyTds = Math.round((annualTax * 1.04) / 12);
    }

    const totalDeductions = employeePf + employeeEsi + pt + lwfEmployee + monthlyTds;
    const netPay = grossSalary - totalDeductions;

    return {
      actualBasic,
      actualHra,
      actualAllow,
      grossSalary,
      employeePf,
      employerEpf,
      employerEps,
      edli,
      adminCharges,
      employeeEsi,
      employerEsi,
      pt,
      lwfEmployee,
      lwfEmployer,
      monthlyTds,
      totalDeductions,
      netPay
    };
  };

  // Aggregated totals for the dashboard
  const payrollTotals = employees.reduce((acc, emp) => {
    const calc = calculateEmployeeStatutories(emp);
    acc.gross += calc.grossSalary;
    acc.net += calc.netPay;
    acc.pfLiability += (calc.employeePf + calc.employerEpf + calc.employerEps + calc.edli + calc.adminCharges);
    acc.esiLiability += (calc.employeeEsi + calc.employerEsi);
    acc.ptLiability += calc.pt;
    acc.lwfLiability += (calc.lwfEmployee + calc.lwfEmployer);
    acc.tdsLiability += calc.monthlyTds;
    return acc;
  }, { gross: 0, net: 0, pfLiability: 0, esiLiability: 0, ptLiability: 0, lwfLiability: 0, tdsLiability: 0 });

  // Mock handlers
  const handleLopChange = (id: string, lop: number) => {
    setEmployees(employees.map(e => e.id === id ? { ...e, lopDays: Math.min(30, Math.max(0, lop)) } : e));
  };

  const handleOtChange = (id: string, ot: number) => {
    setEmployees(employees.map(e => e.id === id ? { ...e, otHours: Math.max(0, ot) } : e));
  };

  const handleRegimeToggle = (id: string) => {
    setEmployees(employees.map(e => e.id === id ? { ...e, regime: e.regime === 'NEW' ? 'OLD' : 'NEW' } : e));
  };

  const handleVoluntaryPfChange = (id: string, pct: number) => {
    setEmployees(employees.map(e => e.id === id ? { ...e, voluntaryPf: pct } : e));
  };

  const executeSalaryCalculation = () => {
    setIsCalculated(true);
    setRunStep(3);
  };

  const handleSendMessage = () => {
    if (!copilotInput.trim()) return;
    const userMsg = { role: 'user', content: copilotInput };
    setCopilotMessages(prev => [...prev, userMsg]);
    
    const query = copilotInput.toLowerCase();
    let reply = "";
    
    if (query.includes('pf') || query.includes('provident')) {
      reply = `EPF is calculated at 12% of Basic wages. The current wage ceiling is ₹${pfWageCeiling}. Under standard rules, Employer contribution splits into 8.33% EPS (capped at ₹${Math.min(15000, pfWageCeiling) * 0.0833} max) and the remaining 3.67% goes to EPF. Additionally, Employer pays 0.5% EDLI ( capped at ₹75) and 0.5% Admin charges.`;
    } else if (query.includes('esi') || query.includes('state insurance')) {
      reply = `ESIC eligibility applies to employees earning gross salary <= ₹${esiEligibleCeiling}. Contributions: Employee pays 0.75%, Employer pays 3.25% of gross.`;
    } else if (query.includes('regime') || query.includes('tax') || query.includes('saving')) {
      reply = `The standard comparison uses Old Regime (taxable salary after 50,000 standard deduction + Section 80C deductions) vs New Regime (taxable salary after 75,000 standard deduction, nil tax up to 7 Lakhs). For high earning structures, the New Regime is generally preferred, whereas Old works if deductions exceed ₹3.75 Lakhs annually.`;
    } else if (query.includes('ghost') || query.includes('anomaly') || query.includes('preeti')) {
      reply = `WARNING: Preeti Patel has been flagged as a potential ghost employee. She shares the exact same PAN (ABCPK1234F) and Aadhaar (321045678901) as Rajesh Kumar. I recommend blocking this payment until physical validation is completed.`;
    } else {
      reply = `Understood. Analyzing compliance databases. I can confirm your statutory filings (PF, ESI, PT) are scheduled. For the month of ${periodCode}, the gross payroll liability is ₹${payrollTotals.gross.toLocaleString('en-IN')}, and statutory payables stand at ₹${(payrollTotals.pfLiability + payrollTotals.esiLiability + payrollTotals.tdsLiability).toLocaleString('en-IN')}.`;
    }

    setTimeout(() => {
      setCopilotMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    }, 600);
    setCopilotInput('');
  };

  // Generate Bank File layout mock
  const generateBankFileText = () => {
    let fileHeader = `HEADER|TYPE:SALARY|BANK:${selectedBank}|DATE:2026-06-15\n`;
    let fileRows = employees.map(emp => {
      const calc = calculateEmployeeStatutories(emp);
      return `TXN|${emp.code}|${emp.name}|A/c:98765432101${emp.code.slice(-1)}|IFSC:${selectedBank}0000001|NET:₹${calc.netPay}`;
    }).join('\n');
    return fileHeader + fileRows;
  };

  // Generate ECR Challan mock
  const generateEcrChallanText = () => {
    return employees.map(emp => {
      const calc = calculateEmployeeStatutories(emp);
      const pfBasic = Math.min(emp.basic, pfWageCeiling);
      return `${emp.uan}#~#${emp.name}#~#${pfBasic}#~#${pfBasic}#~#${pfBasic}#~#${calc.employeePf}#~#${calc.employerEps}#~#${calc.employerEpf}#~#0#~#0`;
    }).join('\n');
  };

  if (simulateEmpty) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-2xl text-slate-900 flex flex-col items-center justify-center text-center min-h-[400px]">
        <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mb-6">
          <Users className="h-8 w-8 text-indigo-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">Employee Database Empty</h3>
        <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
          Your employee database is empty. Add employees or import list to start running payroll.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => alert('Add employee form triggered...')}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-slate-900 font-bold text-sm rounded-lg transition-colors shadow-lg shadow-indigo-600/25"
          >
            Add Employee
          </button>
          <button
            onClick={() => alert('Select excel roster file to import employees...')}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-100 text-slate-600 border border-slate-200 font-bold text-sm rounded-lg transition-colors"
          >
            Import Employee List from Excel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-2xl text-slate-900 w-full">
      {/* Module Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-slate-200 pb-4">
        <div className="flex-1 pr-4">
          <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-400">
            <span className="p-1.5 bg-indigo-500/10 rounded-lg">💸</span>
            Payroll & Statutory Compliance Engine
          </h2>
          <p className="text-sm text-slate-500 mt-1">Automated payroll cycles, EPF/ESIC compliance, Professional Tax, and AI salary auditing.</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {['overview', 'run', 'engines', 'copilot'].map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t as any)}
              className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all uppercase tracking-wider min-w-[100px] text-center whitespace-nowrap ${
                activeTab === t 
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/10' 
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: EXECUTIVE OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Summary Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 relative overflow-hidden">
              <div className="text-sm font-bold text-slate-500 uppercase">Total Payroll Cost</div>
              <div className="text-3xl font-black text-slate-900 mt-2">₹{payrollTotals.gross.toLocaleString('en-IN')}</div>
              <div className="text-xs text-slate-500 mt-1">For active employees roster</div>
              <div className="absolute top-3 right-3 text-indigo-500 opacity-20"><DollarSign className="h-8 w-8" /></div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 relative overflow-hidden">
              <div className="text-sm font-bold text-slate-500 uppercase">Statutory Liabilities</div>
              <div className="text-3xl font-black text-indigo-400 mt-2">₹{(payrollTotals.pfLiability + payrollTotals.esiLiability + payrollTotals.ptLiability + payrollTotals.tdsLiability).toLocaleString('en-IN')}</div>
              <div className="text-xs text-slate-500 mt-1">PF + ESI + PT + Section 192 TDS</div>
              <div className="absolute top-3 right-3 text-indigo-500 opacity-20"><Landmark className="h-8 w-8" /></div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 relative overflow-hidden">
              <div className="text-sm font-bold text-slate-500 uppercase">Headcount</div>
              <div className="text-3xl font-black text-slate-900 mt-2">{employees.length}</div>
              <div className="text-xs text-slate-500 mt-1">2 Flagged by AI Auditors</div>
              <div className="absolute top-3 right-3 text-indigo-500 opacity-20"><Users className="h-8 w-8" /></div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 relative overflow-hidden">
              <div className="text-sm font-bold text-slate-500 uppercase">Compliance Score</div>
              <div className="text-3xl font-black text-emerald-400 mt-2">94%</div>
              <div className="text-xs text-slate-500 mt-1">Slight lag due to pending ECR upload</div>
              <div className="absolute top-3 right-3 text-indigo-500 opacity-20"><ShieldCheck className="h-8 w-8" /></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Details Card */}
            <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col">
              <h3 className="text-base font-bold text-indigo-400 mb-4 flex items-center gap-1.5 uppercase">
                <FileText className="h-4 w-4" /> Breakdown of Statutory Payables
              </h3>
              
              <div className="space-y-4 mt-2">
                <div className="flex justify-between items-center p-5 rounded-xl bg-slate-100 border border-slate-200 shadow-sm">
                  <div>
                    <div className="text-base font-bold text-slate-700">Employees Provident Fund (EPF)</div>
                    <div className="text-xs text-slate-500">Employee 12% + Employer (3.67% EPF + 8.33% EPS) + admin fees</div>
                  </div>
                  <span className="text-xl font-black text-slate-900">₹{payrollTotals.pfLiability.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between items-center p-5 rounded-xl bg-slate-100 border border-slate-200 shadow-sm">
                  <div>
                    <div className="text-base font-bold text-slate-700">Employees State Insurance (ESIC)</div>
                    <div className="text-xs text-slate-500">Gross $\le$ 21,000 | Employee 0.75% + Employer 3.25%</div>
                  </div>
                  <span className="text-xl font-black text-slate-900">₹{payrollTotals.esiLiability.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between items-center p-5 rounded-xl bg-slate-100 border border-slate-200 shadow-sm">
                  <div>
                    <div className="text-base font-bold text-slate-700">Section 192 TDS on Salary</div>
                    <div className="text-xs text-slate-500">Annual projections according to designated regimes</div>
                  </div>
                  <span className="text-xl font-black text-slate-900">₹{payrollTotals.tdsLiability.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between items-center p-5 rounded-xl bg-slate-100 border border-slate-200 shadow-sm">
                  <div>
                    <div className="text-base font-bold text-slate-700">Professional Tax (PT) & LWF</div>
                    <div className="text-xs text-slate-500">State-wise slab rates & Labour Welfare Fund metrics</div>
                  </div>
                  <span className="text-xl font-black text-slate-900">₹{(payrollTotals.ptLiability + payrollTotals.lwfLiability).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Calendar Tracker */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col">
              <h3 className="text-base font-bold text-indigo-400 mb-4 flex items-center gap-1.5 uppercase">
                📅 Statutory Calendar Deadlines
              </h3>
              <div className="space-y-6 mt-2">
                <div className="border-l-2 border-indigo-600 pl-3">
                  <div className="text-sm font-bold text-slate-700">ITR TDS Deposit</div>
                  <div className="text-xs text-slate-500">Monthly Section 192 deduction deposit</div>
                  <div className="text-xs text-indigo-400 font-semibold mt-1">Due: 07 July 2026</div>
                </div>

                <div className="border-l-2 border-indigo-600 pl-3">
                  <div className="text-sm font-bold text-slate-700">EPF ECR Challan Submission</div>
                  <div className="text-xs text-slate-500">Electronic Challan-cum-Receipt filing</div>
                  <div className="text-xs text-indigo-400 font-semibold mt-1">Due: 15 July 2026</div>
                </div>

                <div className="border-l-2 border-indigo-600 pl-3">
                  <div className="text-sm font-bold text-slate-700">ESIC Return Deposit</div>
                  <div className="text-xs text-slate-500">Monthly ESI contributions post</div>
                  <div className="text-xs text-indigo-400 font-semibold mt-1">Due: 15 July 2026</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PAYROLL RUN WIZARD */}
      {activeTab === 'run' && (
        <div className="space-y-6">
          {/* Step dots */}
          <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl flex items-center justify-between overflow-x-auto gap-4">
            {[
              { s: 1, label: 'Attendance' },
              { s: 2, label: 'Computation' },
              { s: 3, label: 'Review Pay' },
              { s: 4, label: 'Sign-off' },
              { s: 5, label: 'Bank Advice' },
              { s: 6, label: 'Payslips & JE' }
            ].map(item => (
              <div key={item.s} className="flex items-center gap-2 flex-shrink-0">
                <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  runStep === item.s ? 'bg-indigo-600 text-slate-900' : 
                  runStep > item.s ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/20' : 
                  'bg-slate-100 border border-slate-200 text-slate-500'
                }`}>
                  {runStep > item.s ? <Check className="h-3.5 w-3.5" /> : item.s}
                </span>
                <span className={`text-xs font-bold uppercase tracking-wider ${runStep === item.s ? 'text-indigo-400' : 'text-slate-500'}`}>
                  {item.label}
                </span>
                {item.s < 6 && <ChevronRight className="h-3.5 w-3.5 text-slate-800" />}
              </div>
            ))}
          </div>

          {/* STEP 1: ATTENDANCE & LOSS OF PAY */}
          {runStep === 1 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-indigo-400 uppercase">Step 1: Attendance Verification</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Import attendance logs, update Loss of Pay (LOP) days, and input Overtime hours.</p>
                </div>
                <button className="px-3.5 py-1.5 bg-slate-100 border border-slate-200 text-xs font-semibold rounded-lg hover:border-slate-700 flex items-center gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Import CSV/Biometric Logs
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="p-3">Employee Code</th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Roster Days</th>
                      <th className="p-3">Loss of Pay (LOP) Days</th>
                      <th className="p-3">Overtime (Hours)</th>
                      <th className="p-3">Calculated Work Ratio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => (
                      <tr key={emp.id} className="border-b border-slate-200 hover:bg-slate-100">
                        <td className="p-3 font-mono text-slate-500">{emp.code}</td>
                        <td className="p-3 font-semibold text-slate-900">{emp.name}</td>
                        <td className="p-3 text-slate-600">{emp.totalDays} days</td>
                        <td className="p-3">
                          <input 
                            type="number" 
                            min="0" 
                            max="30"
                            value={emp.lopDays}
                            onChange={(e) => handleLopChange(emp.id, parseFloat(e.target.value) || 0)}
                            className="w-16 px-2 py-1 bg-slate-100 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 font-bold"
                          />
                        </td>
                        <td className="p-3">
                          <input 
                            type="number" 
                            min="0"
                            value={emp.otHours}
                            onChange={(e) => handleOtChange(emp.id, parseFloat(e.target.value) || 0)}
                            className="w-16 px-2 py-1 bg-slate-100 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900"
                          />
                        </td>
                        <td className="p-3 font-semibold text-indigo-400">
                          {(((emp.totalDays - emp.lopDays) / emp.totalDays) * 100).toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-3">
                <button
                  onClick={() => setRunStep(2)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-slate-900 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                >
                  Confirm & Calculate Salary <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: FORMULA RUN */}
          {runStep === 2 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-6">
              <div>
                <h3 className="text-sm font-bold text-indigo-400 uppercase">Step 2: Salary Computation Engine</h3>
                <p className="text-xs text-slate-500 mt-0.5">Executes EPFO/ESIC calculations, Section 192 TDS regime simulations, and PT state slabs.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-100 p-4 rounded-lg border border-slate-200 space-y-4">
                  <h4 className="text-xs font-bold text-slate-600 uppercase border-b border-slate-200 pb-2">Active Formula Map</h4>
                  <ul className="text-xs text-slate-500 space-y-2.5">
                    <li className="flex justify-between"><span className="font-semibold text-slate-600">Basic & DA:</span> <span>Roster-adjusted actual Basic</span></li>
                    <li className="flex justify-between"><span className="font-semibold text-slate-600">HRA Portion:</span> <span>40% of Basic wages</span></li>
                    <li className="flex justify-between"><span className="font-semibold text-slate-600">Provident Fund (EPF):</span> <span>Employee 12% | Employer splits (8.33% EPS / 3.67% EPF)</span></li>
                    <li className="flex justify-between"><span className="font-semibold text-slate-600">State PT:</span> <span>Calculated based on actual earned gross</span></li>
                    <li className="flex justify-between"><span className="font-semibold text-slate-600">Section 192 TDS:</span> <span>Old vs New simulation based on individual selections</span></li>
                  </ul>
                </div>

                <div className="bg-slate-100 p-4 rounded-lg border border-slate-200 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-600 uppercase border-b border-slate-200 pb-2">Run Configurations</h4>
                    <div className="space-y-3 mt-3 text-xs text-slate-500">
                      <div className="flex justify-between">
                        <span>Filing Period:</span>
                        <strong className="text-slate-900">{periodCode}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>PF Wage Ceiling limit:</span>
                        <strong className="text-slate-900">₹{pfWageCeiling.toLocaleString()}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>ESI Coverage limit:</span>
                        <strong className="text-slate-900">₹{esiEligibleCeiling.toLocaleString()}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Voluntary PF Support:</span>
                        <strong className="text-emerald-400">Enabled</strong>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={executeSalaryCalculation}
                    className="w-full mt-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-slate-900 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/10"
                  >
                    <Play className="h-4 w-4" /> Run Payroll Computations
                  </button>
                </div>
              </div>

              <div className="flex justify-between pt-3 border-t border-slate-200">
                <button onClick={() => setRunStep(1)} className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900">Back</button>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW PAYROLL */}
          {runStep === 3 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-indigo-400 uppercase">Step 3: Roster Salary Breakdowns</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Review gross payout, deductions, net pay, tax regime selection, and audit indicators.</p>
                </div>
                <div className="text-xs text-slate-500">
                  Calculated Status: <span className="font-bold text-emerald-400">SUCCESSFUL</span>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="p-3">Employee</th>
                      <th className="p-3">Regime</th>
                      <th className="p-3">Earned Gross</th>
                      <th className="p-3">PF Deduction</th>
                      <th className="p-3">ESI Deduction</th>
                      <th className="p-3">PT</th>
                      <th className="p-3">TDS (Sec 192)</th>
                      <th className="p-3">Net Salary</th>
                      <th className="p-3">AI Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => {
                      const calc = calculateEmployeeStatutories(emp);
                      return (
                        <tr key={emp.id} className="border-b border-slate-200 hover:bg-slate-100">
                          <td className="p-3">
                            <div>
                              <div className="font-bold text-slate-900">{emp.name}</div>
                              <div className="text-[10px] text-slate-500">{emp.code} | {emp.state}</div>
                            </div>
                          </td>
                          <td className="p-3">
                            <button 
                              onClick={() => handleRegimeToggle(emp.id)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                emp.regime === 'NEW' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}
                            >
                              {emp.regime}
                            </button>
                          </td>
                          <td className="p-3 font-semibold text-slate-700">₹{calc.grossSalary.toLocaleString('en-IN')}</td>
                          <td className="p-3 text-slate-600">₹{calc.employeePf.toLocaleString('en-IN')}</td>
                          <td className="p-3 text-slate-600">₹{calc.employeeEsi.toLocaleString('en-IN')}</td>
                          <td className="p-3 text-slate-600">₹{calc.pt.toLocaleString('en-IN')}</td>
                          <td className="p-3 text-slate-600">₹{calc.monthlyTds.toLocaleString('en-IN')}</td>
                          <td className="p-3 font-bold text-slate-900">₹{calc.netPay.toLocaleString('en-IN')}</td>
                          <td className="p-3">
                            {emp.flagged ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded uppercase tracking-wider" title={emp.flagReason}>
                                <AlertTriangle className="h-3 w-3" /> Flagged
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded uppercase tracking-wider">Clean</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Duplicate/Flagged Warning Banner */}
              {employees.some(e => e.flagged) && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-4 flex gap-3 items-start">
                  <AlertCircle className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-rose-400 uppercase">Compliance Alerts & High Risk Items Detected</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Our AI engine has flagged duplicate PAN profiles (Rajesh Kumar & Preeti Patel) and sudden allowances anomalies. We highly recommend utilizing the AI Copilot tab to investigate before signing off.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-3 border-t border-slate-200">
                <button onClick={() => setRunStep(2)} className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900">Back</button>
                <button
                  onClick={() => setRunStep(4)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-slate-900 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                >
                  Proceed to Approval <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: SIGN-OFF GATE */}
          {runStep === 4 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-6 text-center max-w-xl mx-auto">
              <div className="mx-auto h-12 w-12 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <ShieldCheck className="h-6 w-6" />
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 uppercase">CA Firm Sign-Off Gate</h3>
                <p className="text-xs text-slate-500">
                  Please review the audit log. Digital signatures will be stamped on payslips and Form 16 documents upon approval.
                </p>
              </div>

              <div className="bg-slate-100 p-4 rounded-lg border border-slate-200 text-left text-xs space-y-2">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">Authorizer:</span>
                  <span className="text-slate-900 font-bold">Neha Roy (Partner)</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">Calculated Gross Pay:</span>
                  <span className="text-slate-900 font-semibold">₹{payrollTotals.gross.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">PF Contribution Total:</span>
                  <span className="text-slate-900 font-semibold">₹{payrollTotals.pfLiability.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">TDS Section 192:</span>
                  <span className="text-slate-900 font-semibold">₹{payrollTotals.tdsLiability.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {isApproved ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg text-emerald-400 text-xs font-bold flex items-center justify-center gap-1.5">
                  <CheckCircle className="h-4 w-4" /> PAYROLL RUN APPROVED & LOCKED
                </div>
              ) : (
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => {
                      setIsApproved(true);
                      console.log(`Payroll run for period ${periodCode} has been authorized by Neha Roy.`);
                    }}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-slate-900 font-bold text-xs rounded-lg transition-colors shadow-lg shadow-indigo-600/10"
                  >
                    Authorize & Sign-off
                  </button>
                  <button onClick={() => setRunStep(3)} className="px-4 py-2.5 bg-slate-100 border border-slate-200 text-xs font-semibold rounded-lg text-slate-600">Reject / Recalculate</button>
                </div>
              )}

              <div className="flex justify-between pt-4 border-t border-slate-200 text-left">
                <button onClick={() => setRunStep(3)} className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900">Back</button>
                <button
                  disabled={!isApproved}
                  onClick={() => setRunStep(5)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-500 text-slate-900 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                >
                  Generate Bank File <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: BANK FILE DOWNLOAD */}
          {runStep === 5 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-6 max-w-xl mx-auto">
              <div>
                <h3 className="text-sm font-bold text-indigo-400 uppercase">Step 5: Bank Advice Generation</h3>
                <p className="text-xs text-slate-500 mt-0.5">Download bulk transfer payment schedules formatted for immediate portal upload.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Select Target Bank Portal</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['HDFC', 'ICICI', 'SBI', 'AXIS', 'KOTAK', 'NEFT'].map(bank => (
                      <button
                        key={bank}
                        onClick={() => setSelectedBank(bank)}
                        className={`py-2 px-3 border text-xs font-bold rounded-lg transition-all ${
                          selectedBank === bank
                            ? 'bg-indigo-600 border-indigo-600 text-slate-900 shadow-lg'
                            : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {bank} Format
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-100 p-4 rounded-lg border border-slate-200 space-y-3">
                  <div className="flex justify-between items-center text-xs border-b border-slate-200 pb-2">
                    <span className="font-semibold text-slate-600">File Output Preview ({selectedBank}_Bulk_Salary.txt)</span>
                    <button 
                      onClick={() => {
                        const element = document.createElement("a");
                        const file = new Blob([generateBankFileText()], {type: 'text/plain'});
                        element.href = URL.createObjectURL(file);
                        element.download = `${selectedBank}_Bulk_Salary.txt`;
                        document.body.appendChild(element);
                        element.click();
                      }}
                      className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1"
                    >
                      <Download className="h-3.5 w-3.5" /> Download text
                    </button>
                  </div>
                  <pre className="text-[10px] font-mono text-slate-500 leading-relaxed overflow-x-auto bg-slate-50 p-3 rounded border border-slate-200 max-h-36">
                    {generateBankFileText()}
                  </pre>
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-200">
                <button onClick={() => setRunStep(4)} className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900">Back</button>
                <button
                  onClick={() => setRunStep(6)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-slate-900 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                >
                  Generate Documents & Postings <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: PAYSLIPS & JOURNAL ENTRIES */}
          {runStep === 6 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-6 max-w-2xl mx-auto">
              <div>
                <h3 className="text-sm font-bold text-indigo-400 uppercase">Step 6: payslip & Journal Entry posting</h3>
                <p className="text-xs text-slate-500 mt-0.5">Post the month-end salary bookkeeping records and issue password-protected payslips.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Journal Postings */}
                <div className="bg-slate-100 p-4 rounded-lg border border-slate-200 space-y-4">
                  <h4 className="text-xs font-bold text-slate-600 uppercase border-b border-slate-200 pb-2">Auto-Post Journal Ledger</h4>
                  
                  <div className="space-y-2 text-[11px] font-mono text-slate-500 max-h-40 overflow-y-auto">
                    <div className="p-2 bg-slate-50 rounded border border-slate-200">
                      <div>Dr Salary Expenses: ₹{payrollTotals.gross.toLocaleString()}</div>
                      <div className="pl-4">Cr Net Salary Payable: ₹{payrollTotals.net.toLocaleString()}</div>
                      <div className="pl-4">Cr PF Payable A/c: ₹{payrollTotals.pfLiability.toLocaleString()}</div>
                      <div className="pl-4">Cr ESI Payable A/c: ₹{payrollTotals.esiLiability.toLocaleString()}</div>
                      <div className="pl-4">Cr TDS Payable A/c: ₹{payrollTotals.tdsLiability.toLocaleString()}</div>
                    </div>
                  </div>

                  <button 
                    onClick={() => alert('Journal Entry posted to Tally/Prisma bookkeeping systems successfully.')}
                    className="w-full py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-600/25 text-xs font-bold rounded-lg transition-colors"
                  >
                    Post Journal to Books
                  </button>
                </div>

                {/* Payslip distribution */}
                <div className="bg-slate-100 p-4 rounded-lg border border-slate-200 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-600 uppercase border-b border-slate-200 pb-2">Payslip & ECR Challans</h4>
                    <p className="text-xs text-slate-500 mt-3">
                      Generates PDF payslips encrypted with (PAN + DOB). Submits ECR Challans text to EPFO gateway.
                    </p>
                  </div>

                  <div className="space-y-2 mt-4">
                    <button 
                      onClick={() => {
                        const element = document.createElement("a");
                        const file = new Blob([generateEcrChallanText()], {type: 'text/plain'});
                        element.href = URL.createObjectURL(file);
                        element.download = `EPF_ECR_${periodCode.replace(' ', '_')}.txt`;
                        document.body.appendChild(element);
                        element.click();
                      }}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-slate-900 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 shadow-lg"
                    >
                      <Download className="h-3.5 w-3.5" /> Download EPF ECR Challan
                    </button>
                    <button 
                      onClick={() => alert('Dispatched password-protected PDFs to all verified employee emails.')}
                      className="w-full py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
                    >
                      <Send className="h-3.5 w-3.5" /> Dispatch Employee Payslips
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-200">
                <button onClick={() => setRunStep(5)} className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900">Back</button>
                <button
                  onClick={() => {
                    setIsCalculated(false);
                    setIsApproved(false);
                    setRunStep(1);
                    setActiveTab('overview');
                    alert('Payroll run cycle for the month completed successfully.');
                  }}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-slate-900 font-bold text-xs rounded-lg transition-colors"
                >
                  Finish Run & Reset
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: STATUTORY RULES & ENGINES */}
      {activeTab === 'engines' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* PF config */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-indigo-400 uppercase flex items-center gap-1.5">
                🏢 Employees Provident Fund (EPF) Rules
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-500 mb-1 font-semibold">Statutory Wage Ceiling</label>
                  <input 
                    type="number"
                    value={pfWageCeiling}
                    onChange={(e) => setPfWageCeiling(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 font-bold"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Default ceiling is ₹15,000 as per EPFO rules.</span>
                </div>

                <div className="flex justify-between items-center p-5 rounded-xl bg-slate-100 border border-slate-200 shadow-sm">
                  <div>
                    <div className="font-semibold text-slate-600">Higher Pension (No Ceiling)</div>
                    <div className="text-[10px] text-slate-500">Recalculates EPS on actual basic wages</div>
                  </div>
                  <input 
                    type="checkbox"
                    checked={higherPensionOption}
                    onChange={(e) => setHigherPensionOption(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-200 bg-slate-100 rounded"
                  />
                </div>

                <div className="bg-slate-100 p-3 rounded text-[11px] text-slate-500 space-y-1">
                  <div className="flex justify-between"><span>Employee share:</span> <strong className="text-slate-900">12.00%</strong></div>
                  <div className="flex justify-between"><span>Employer EPF share:</span> <strong className="text-slate-900">3.67%</strong></div>
                  <div className="flex justify-between"><span>Employer EPS (Pension):</span> <strong className="text-slate-900">8.33%</strong></div>
                  <div className="flex justify-between"><span>EDLI (Insurance):</span> <strong className="text-slate-900">0.50%</strong></div>
                  <div className="flex justify-between"><span>PF Admin Charges:</span> <strong className="text-slate-900">0.50%</strong></div>
                </div>
              </div>
            </div>

            {/* ESIC config */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-indigo-400 uppercase flex items-center gap-1.5">
                🏥 Employees State Insurance (ESI) Rules
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-500 mb-1 font-semibold">Eligibility Wage Ceiling</label>
                  <input 
                    type="number"
                    value={esiEligibleCeiling}
                    onChange={(e) => setEsiEligibleCeiling(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 font-bold"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Statutory eligibility limit is Gross Salary $\le$ ₹21,000.</span>
                </div>

                <div className="bg-slate-100 p-3 rounded text-[11px] text-slate-500 space-y-1">
                  <div className="flex justify-between"><span>Employee contribution:</span> <strong className="text-slate-900">0.75%</strong></div>
                  <div className="flex justify-between"><span>Employer contribution:</span> <strong className="text-slate-900">3.25%</strong></div>
                  <div className="flex justify-between"><span>Payment Cycle:</span> <strong className="text-slate-900">Monthly</strong></div>
                  <div className="flex justify-between"><span>Coverage Base:</span> <strong className="text-slate-900">Gross Salary</strong></div>
                </div>

                <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded text-[10.5px] text-slate-500 leading-relaxed">
                  💡 <strong>Contribution Periods:</strong> April to September and October to March. Sickness & medical benefits are mapped to these periods.
                </div>
              </div>
            </div>

            {/* Professional Tax slabs */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-indigo-400 uppercase flex items-center gap-1.5">
                ⚖️ State Professional Tax Slabs
              </h3>

              <div className="space-y-3 text-xs overflow-y-auto max-h-72 pr-1">
                <div className="p-2.5 rounded bg-slate-100 border border-slate-200">
                  <div className="font-bold text-slate-700">Maharashtra (MH)</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">$\le$ ₹7,500: Nil | ₹7,501-10,000: ₹175 | &gt;10,000: ₹200 (₹300 in Feb)</div>
                </div>

                <div className="p-2.5 rounded bg-slate-100 border border-slate-200">
                  <div className="font-bold text-slate-700">Karnataka (KA)</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">$\le$ ₹25,000: Nil | &gt;₹25,000: ₹200/month</div>
                </div>

                <div className="p-2.5 rounded bg-slate-100 border border-slate-200">
                  <div className="font-bold text-slate-700">West Bengal (WB)</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Slabs up to 10k: Nil | 10k-15k: ₹110 | 15k-25k: ₹130 | 25k-40k: ₹150 | &gt;40k: ₹200</div>
                </div>

                <div className="p-2.5 rounded bg-slate-100 border border-slate-200">
                  <div className="font-bold text-slate-700">Tamil Nadu (TN)</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Slabs up to 9k: Nil | 9k-12k: ₹100 | 12k-15k: ₹150 | &gt;15k: ₹200</div>
                </div>
              </div>
            </div>

            {/* Bonus & Gratuity Calculator */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 md:col-span-3">
              <h3 className="text-sm font-bold text-indigo-400 uppercase flex items-center gap-1.5">
                💰 Payment of Bonus & Gratuity Act Engines
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-100 p-4 rounded-lg border border-slate-200 text-xs space-y-3">
                  <h4 className="font-bold text-slate-700 uppercase border-b border-slate-200 pb-2">Bonus Act (Payment of Bonus Act 1965)</h4>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Applies to establishments with 20 or more employees. Eligible for employees earning up to ₹21,000/month. Calculations are capped at ₹7,000 or minimum wage whichever is higher.
                  </p>
                  <div className="flex gap-4 text-[11px]">
                    <div>Min Bonus: <strong className="text-slate-900">8.33%</strong></div>
                    <div>Max Bonus: <strong className="text-slate-900">20.00%</strong></div>
                  </div>
                  <button onClick={() => alert('Bonus register compiled for FY25-26.')} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-750 text-slate-900 font-bold rounded">
                    Generate Bonus Register
                  </button>
                </div>

                <div className="bg-slate-100 p-4 rounded-lg border border-slate-200 text-xs space-y-3">
                  <h4 className="font-bold text-slate-700 uppercase border-b border-slate-200 pb-2">Payment of Gratuity Act 1972</h4>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Formula: (15/26) * Last drawn basic salary * Completed years of service. Applies to employees completing 5+ consecutive years (waived for death/disabled cases).
                  </p>
                  <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                    <div className="font-semibold text-slate-600">Simulate Gratuity:</div>
                    <div className="mt-1 flex gap-2 items-center">
                      <span className="text-[10px] text-slate-500">Basic 20k, 6 years:</span>
                      <strong className="text-slate-900">₹41,538</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB 4: AI COPILOT & ANOMALY DETECTOR */}
      {activeTab === 'copilot' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Anomaly Dashboard */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-rose-400 uppercase flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4" /> AI Anomaly & Fraud Flags
              </h3>
              
              <div className="space-y-3">
                {employees.filter(e => e.flagged).map(emp => (
                  <div key={emp.id} className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-lg space-y-2">
                    <div className="flex justify-between items-center">
                      <strong className="text-xs text-rose-400 font-bold">{emp.name} ({emp.code})</strong>
                      <span className="text-[9px] font-bold uppercase bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded">High Risk</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      {emp.flagReason}
                    </p>
                    <div className="flex gap-2 justify-end pt-1">
                      <button onClick={() => alert('Withheld payment processing for ' + emp.name)} className="px-2 py-1 bg-rose-600 text-[10px] font-bold text-slate-900 rounded hover:bg-rose-700">Withhold Pay</button>
                      <button onClick={() => alert('Dismissed alarm for ' + emp.name)} className="px-2 py-1 bg-slate-100 border border-slate-200 text-[10px] text-slate-500 rounded hover:text-slate-900">Ignore</button>
                    </div>
                  </div>
                ))}
                
                <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-center text-xs text-slate-500">
                  <CheckCircle className="h-5 w-5 text-emerald-400 mx-auto mb-2" />
                  Remaining 3 employees audited and verified with zero matching errors.
                </div>
              </div>
            </div>

            {/* Chat Copilot */}
            <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col h-[480px]">
              <h3 className="text-sm font-bold text-indigo-400 uppercase flex items-center gap-1.5 border-b border-slate-200 pb-3 mb-3">
                <Sparkles className="h-4 w-4" /> Payroll AI Copilot
              </h3>

              {/* Message History */}
              <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
                {copilotMessages.map((msg, idx) => (
                  <div 
                    key={idx} 
                    className={`p-3 rounded-lg max-w-[85%] text-xs leading-relaxed ${
                      msg.role === 'assistant' 
                        ? 'bg-slate-100 border border-slate-200 text-slate-700 mr-auto' 
                        : 'bg-indigo-600 text-slate-900 ml-auto'
                    }`}
                  >
                    {msg.content}
                  </div>
                ))}
              </div>

              {/* Chat Input */}
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="Ask copilot to compare Old vs New tax regime, calculate EPF ceiling, or find ghost employees..."
                  value={copilotInput}
                  onChange={(e) => setCopilotInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendMessage();
                  }}
                  className="flex-1 px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs text-slate-700 placeholder-slate-500"
                />
                <button 
                  onClick={handleSendMessage}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-750 text-slate-900 rounded-lg text-xs font-bold transition-all shadow-lg flex items-center gap-1"
                >
                  Ask Copilot <Send className="h-3 w-3" />
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
      
    </div>
  );
}
