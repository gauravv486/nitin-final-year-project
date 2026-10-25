'use client';

import { useState } from 'react';
import { BarChart3, AlertOctagon, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

interface OutlierTransaction {
  id: string;
  vendor: string;
  amount: number;
  date: string;
  firstDigit: number;
  expectedRatio: number;
  actualRatio: number;
}

// Chi-Square analysis for first digit distribution
// Expected (Benford): [30.1%, 17.6%, 12.5%, 9.7%, 7.9%, 6.7%, 5.8%, 5.1%, 4.6%]
const benfordExpected = [30.1, 17.6, 12.5, 9.7, 7.9, 6.7, 5.8, 5.1, 4.6];
const observedMock = [22.4, 16.2, 11.5, 8.9, 24.1, 5.8, 4.9, 3.6, 2.6]; // Digit 5 has huge spike (24.1% instead of 7.9%)

const mockOutliers: OutlierTransaction[] = [
  { id: 't-1', vendor: 'Acme General Services', amount: 55000, date: '2026-06-11', firstDigit: 5, expectedRatio: 7.9, actualRatio: 24.1 },
  { id: 't-2', vendor: 'Acme General Services', amount: 55000, date: '2026-06-12', firstDigit: 5, expectedRatio: 7.9, actualRatio: 24.1 },
  { id: 't-3', vendor: 'Acme General Services', amount: 55000, date: '2026-06-13', firstDigit: 5, expectedRatio: 7.9, actualRatio: 24.1 },
  { id: 't-4', vendor: 'Vertex Logistics', amount: 50500, date: '2026-06-14', firstDigit: 5, expectedRatio: 7.9, actualRatio: 24.1 }
];

interface BenfordsForensicDashboardProps {
  simulateEmpty?: boolean;
}

export default function BenfordsForensicDashboard({ simulateEmpty = false }: BenfordsForensicDashboardProps) {
  const [outliers, setOutliers] = useState<OutlierTransaction[]>(mockOutliers);
  const chiSquare = 28.45; // High deviation score (Critical > 15.5)

  const dismissOutlier = (id: string) => {
    setOutliers(prev => prev.filter(t => t.id !== id));
  };

  if (simulateEmpty) {
    return (
      <div className="bg-white dark:bg-[#0F1B2D] border border-slate-200 dark:border-slate-800 rounded-xl p-8 shadow-2xl text-slate-900 dark:text-white flex flex-col lg:flex-row gap-8 min-h-[400px]">
        {/* Left Side: Empty State Text & CTA */}
        <div className="flex-1 flex flex-col justify-center items-start text-left gap-4">
          <div className="w-12 h-12 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <BarChart3 className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">No Active Forensic Audit</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
              No active audit engagement found. Initiate a forensic review to check transaction digit distributions.
            </p>
          </div>
          <button
            onClick={() => alert('Starting new forensic audit engagement...')}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-slate-900 dark:text-white font-bold text-sm rounded-lg transition-colors shadow-lg shadow-indigo-600/25"
          >
            Start New Audit Engagement
          </button>
        </div>

        {/* Right Side: Visual Checklist of Workflow Steps */}
        <div className="flex-1 bg-slate-100 dark:bg-slate-50 dark:bg-slate-950/65 p-6 rounded-xl border border-slate-200 dark:border-slate-200 dark:border-slate-900/50 flex flex-col gap-4 justify-center">
          <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Benford's Law Audit Pipeline</h4>
          <div className="flex flex-col gap-4 text-xs">
            {[
              { num: '01', title: 'Data Ingestion & Sync', desc: 'Connect ERP/Tally journal registers and bank statements.' },
              { num: '02', title: 'Digit Ratios Check', desc: 'Verify occurrence frequency of first/second digits.' },
              { num: '03', title: 'Chi-Square Deviation Run', desc: 'Compute overall score deviation from logarithmic expectation.' },
              { num: '04', title: 'Outliers Isolation', desc: 'Flag transaction details matching anomalous digit spikes.' }
            ].map(step => (
              <div key={step.num} className="flex gap-3 items-start">
                <span className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-[10px] font-bold text-indigo-400 flex-shrink-0">
                  {step.num}
                </span>
                <div>
                  <h5 className="font-semibold text-slate-700 dark:text-slate-200">{step.title}</h5>
                  <p className="text-slate-500 text-[11px] mt-0.5">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#0F1B2D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-2xl text-slate-900 dark:text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-400">
            <BarChart3 className="h-5 w-5" />
            Forensic Audit: Benford's Law Inspector
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">First-digit distribution checks over transaction populations to identify fraud patterns</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/5">
          <AlertOctagon className="h-4.5 w-4.5 text-red-500" />
          <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Chi-Square Deviation: Critical ({chiSquare})</span>
        </div>
      </div>

      {/* Stats Summary row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-900 flex flex-col justify-between">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Transaction Population Checked</div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2">12,840</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">100% database entries verification</div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-900 flex flex-col justify-between">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Primary Deviation Spike</div>
          <div className="text-2xl font-black text-red-500 mt-2">Digit 5 (+16.2%)</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">Highly anomalous digit occurrence rates</div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-900 flex flex-col justify-between">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Potential Fraud Risk Rating</div>
          <div className="text-2xl font-black text-red-500 mt-2">CRITICAL</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">Immediate audit intervention required</div>
        </div>
      </div>

      {/* Distribution Chart (Dynamic bar rendering) */}
      <div className="bg-slate-100 dark:bg-slate-50 dark:bg-slate-950/60 p-6 rounded-xl border border-slate-200 dark:border-slate-200 dark:border-slate-900/50 mb-8">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-6">First Digit Frequency Distribution (%)</h3>
        
        <div className="flex flex-col gap-4">
          {benfordExpected.map((exp, idx) => {
            const digit = idx + 1;
            const obs = observedMock[idx];
            const isAnomaly = digit === 5;

            return (
              <div key={digit} className="flex items-center text-sm">
                <span className="w-6 font-bold text-slate-500 dark:text-slate-400">{digit}</span>
                <div className="flex-1 flex flex-col gap-1">
                  {/* Expected bar */}
                  <div className="flex items-center gap-2">
                    <div 
                      className="h-2 rounded bg-indigo-500/20"
                      style={{ width: `${exp * 3}px`, minWidth: '4px' }}
                    />
                    <span className="text-[10px] text-indigo-400 font-medium">{exp}% (Expected)</span>
                  </div>
                  {/* Observed bar */}
                  <div className="flex items-center gap-2">
                    <div 
                      className={`h-2 rounded ${isAnomaly ? 'bg-red-500' : 'bg-slate-700'}`}
                      style={{ width: `${obs * 3}px`, minWidth: '4px' }}
                    />
                    <span className={`text-[10px] font-medium ${isAnomaly ? 'text-red-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                      {obs}% (Observed) {isAnomaly && '⚠️ ANOMALY DETECTED'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Outlier Transaction Listing */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">Digit 5 Anomalous Outliers Ledger</h3>
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-900/50">
                <th className="p-4">Transaction Date</th>
                <th className="p-4">Vendor</th>
                <th className="p-4 text-right">Amount</th>
                <th className="p-4 text-center">First Digit</th>
                <th className="p-4 text-center">Observed Freq vs Expected</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {outliers.map(item => (
                <tr key={item.id} className="hover:bg-slate-100 dark:bg-slate-900/40 transition-colors">
                  <td className="p-4 text-slate-600 dark:text-slate-300 font-medium">{item.date}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-300 font-semibold">{item.vendor}</td>
                  <td className="p-4 text-right text-red-400 font-bold">₹{item.amount.toLocaleString()}</td>
                  <td className="p-4 text-center text-slate-600 dark:text-slate-300 font-bold">{item.firstDigit}</td>
                  <td className="p-4 text-center">
                    <span className="text-xs text-red-400 font-bold bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/10">
                      {item.actualRatio}% vs {item.expectedRatio}%
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => alert(`Creating clarification request for ${item.vendor} regarding duplicate ₹${item.amount} transaction...`)}
                        className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-slate-900 dark:text-white font-semibold text-xs rounded transition-colors"
                      >
                        Raise Query
                      </button>
                      <button
                        onClick={() => dismissOutlier(item.id)}
                        className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 font-semibold text-xs rounded transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {outliers.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center p-8 text-slate-500 text-sm">
                    No outlier transactions remaining.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
