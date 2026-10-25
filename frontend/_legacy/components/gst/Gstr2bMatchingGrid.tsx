'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, RefreshCw, Filter, Search, ShieldAlert, Upload, Link2 } from 'lucide-react';

interface ReconItem {
  id: string;
  invoiceNum: string;
  invoiceDate: string;
  vendorName: string;
  booksAmt: number;
  gst2bAmt: number;
  status: 'EXACT_MATCH' | 'AMOUNT_MISMATCH' | 'MISSING_IN_BOOKS' | 'MISSING_IN_2B';
}

const mockReconData: ReconItem[] = [
  { id: 'rec-1', invoiceNum: 'INV-2026-901', invoiceDate: '2026-06-02', vendorName: 'Apex Tech Products', booksAmt: 125000, gst2bAmt: 125000, status: 'EXACT_MATCH' },
  { id: 'rec-2', invoiceNum: 'INV-2026-902', invoiceDate: '2026-06-04', vendorName: 'Delhi Power Supply', booksAmt: 45000, gst2bAmt: 43200, status: 'AMOUNT_MISMATCH' },
  { id: 'rec-3', invoiceNum: 'INV-2026-903', invoiceDate: '2026-06-06', vendorName: 'Vardhaman Trading', booksAmt: 88400, gst2bAmt: 0, status: 'MISSING_IN_2B' },
  { id: 'rec-4', invoiceNum: 'INV-2026-904', invoiceDate: '2026-06-08', vendorName: 'Super Steel India', booksAmt: 0, gst2bAmt: 67200, status: 'MISSING_IN_BOOKS' },
  { id: 'rec-5', invoiceNum: 'INV-2026-905', invoiceDate: '2026-06-10', vendorName: 'Reliable Movers', booksAmt: 34500, gst2bAmt: 34500, status: 'EXACT_MATCH' }
];

interface Gstr2bMatchingGridProps {
  simulateEmpty?: boolean;
  simulateAiError?: boolean;
}

export default function Gstr2bMatchingGrid({ simulateEmpty = false, simulateAiError = false }: Gstr2bMatchingGridProps) {
  const [items, setItems] = useState<ReconItem[]>(mockReconData);
  const [filter, setFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(30);
  const [bypassError, setBypassError] = useState<boolean>(false);

  // Countdown timer for portal downtime retry
  useEffect(() => {
    if (simulateAiError && !bypassError) {
      setCountdown(30);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) return 30;
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [simulateAiError, bypassError]);

  const filteredItems = items.filter(item => {
    const matchesSearch = item.vendorName.toLowerCase().includes(search.toLowerCase()) || 
                          item.invoiceNum.toLowerCase().includes(search.toLowerCase());
    
    if (filter === 'ALL') return matchesSearch;
    return item.status === filter && matchesSearch;
  });

  const resolveItem = (id: string, acceptBooks: boolean) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          status: 'EXACT_MATCH',
          booksAmt: acceptBooks ? item.booksAmt : item.gst2bAmt
        };
      }
      return item;
    }));
    setResolvingId(null);
    setNotes('');
  };

  // 1. EMPTY STATE VIEW
  if (simulateEmpty) {
    return (
      <div className="bg-white dark:bg-[#0F1B2D] border border-slate-200 dark:border-slate-800 rounded-xl p-8 shadow-2xl text-slate-900 dark:text-white flex flex-col items-center justify-center text-center min-h-[400px]">
        {/* List comparison graphic empty state */}
        <div className="relative mb-6 flex items-center justify-center">
          <div className="w-16 h-20 border-2 border-dashed border-indigo-500/40 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-50 dark:bg-slate-950/40 transform -rotate-6">
            <span className="text-2xl opacity-40">📄</span>
          </div>
          <div className="w-16 h-20 border-2 border-dashed border-violet-500/40 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-50 dark:bg-slate-950/40 transform rotate-6 -ml-6">
            <span className="text-2xl opacity-40">💻</span>
          </div>
          <div className="absolute -bottom-2 right-4 bg-violet-600 rounded-full p-1.5 shadow-lg border border-slate-200 dark:border-slate-800">
            <RefreshCw className="h-4 w-4 animate-spin-slow text-slate-900 dark:text-white" />
          </div>
        </div>

        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">GST Reconciliation Queue Empty</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
          Your GST reconciliation queue is empty. Sync or upload returns to identify ITC mismatches.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => alert('Triggering connection to GST portal...')}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-slate-900 dark:text-white font-bold text-sm rounded-lg transition-all shadow-lg shadow-indigo-600/20"
          >
            <Link2 className="h-4 w-4" />
            Connect GST Portal
          </button>
          <button
            onClick={() => alert('Opening file uploader for GSTR-2B JSON file...')}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 font-bold text-sm rounded-lg transition-all"
          >
            <Upload className="h-4 w-4" />
            Upload GSTR-2B File
          </button>
        </div>
      </div>
    );
  }

  // 2. AI FALLBACK / PORTAL DOWN VIEW
  if (simulateAiError && !bypassError) {
    return (
      <div className="bg-white dark:bg-[#0F1B2D] border border-slate-200 dark:border-slate-800 rounded-xl p-8 shadow-2xl text-slate-900 dark:text-white flex flex-col items-center justify-center text-center min-h-[400px]">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-6">
          <AlertTriangle className="h-8 w-8 text-rose-400 animate-pulse" />
        </div>

        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">GST Portal Down or API Limit Exceeded</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-2 leading-relaxed">
          The government GSTN portal API is currently experiencing downtime or rates limit constraints. Live synchronization is temporarily offline.
        </p>
        
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-6">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Retrying connection automatically in {countdown}s...
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => alert('Select GSTR-2B JSON file for manual processing...')}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-slate-900 dark:text-white font-bold text-sm rounded-lg transition-all shadow-lg shadow-indigo-600/20"
          >
            <Upload className="h-4 w-4" />
            Upload GSTR-2B JSON Manually
          </button>
          <button
            onClick={() => setBypassError(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 font-bold text-sm rounded-lg transition-all"
          >
            Access Cached GSTR-2B Data
          </button>
        </div>
      </div>
    );
  }

  // 3. REGULAR FULL DATA VIEW
  return (
    <div className="w-full bg-white dark:bg-[#0F1B2D] p-6 md:p-8">
      {/* Title & Summary Boxes */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-start mb-8 gap-6">
        <div className="flex flex-col">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-blue-50">
              <div className="w-4 h-4 border-2 border-blue-500 rounded-sm"></div>
            </div>
            <h2 className="text-[22px] text-[#111827] dark:text-white font-semibold tracking-tight">GSTR-2B reconciliation console</h2>
          </div>
          <p className="text-[15px] text-gray-400 mt-2 ml-[60px]">Cross-match purchase register with GSTR-2B portal data · June 2026</p>
          
          {/* Search Bar - moved here for better layout matching screenshot */}
          <div className="w-full max-w-[450px] mt-6 ml-[60px]">
            <div className="relative">
              <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search vendor or invoice..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-[#333333] dark:bg-slate-900/50 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 shadow-sm text-[15px] border border-transparent dark:border-slate-800"
              />
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4 mt-2 lg:mt-0">
          <div className="bg-green-50/70 dark:bg-emerald-950/30 rounded-xl px-7 py-3 text-center flex flex-col justify-center min-w-[100px] border border-transparent dark:border-emerald-900/50">
            <div className="text-[26px] font-medium text-emerald-500 leading-tight">{items.filter(i => i.status === 'EXACT_MATCH').length}</div>
            <div className="text-[14px] text-gray-400 mt-0.5">Matched</div>
          </div>
          <div className="bg-yellow-50/70 dark:bg-orange-950/30 rounded-xl px-7 py-3 text-center flex flex-col justify-center min-w-[100px] border border-transparent dark:border-orange-900/50">
            <div className="text-[26px] font-medium text-orange-400 leading-tight">{items.filter(i => i.status === 'AMOUNT_MISMATCH').length}</div>
            <div className="text-[14px] text-gray-400 mt-0.5">Mismatch</div>
          </div>
          <div className="bg-red-50/70 dark:bg-red-950/30 rounded-xl px-7 py-3 text-center flex flex-col justify-center min-w-[100px] border border-transparent dark:border-red-900/50">
            <div className="text-[26px] font-medium text-red-500 leading-tight">{items.filter(i => i.status.startsWith('MISSING')).length}</div>
            <div className="text-[14px] text-gray-400 mt-0.5">Missing</div>
          </div>
        </div>
      </div>

      {/* Grid Container */}
      <div className="overflow-hidden rounded-xl border border-[#E5E7EB] dark:border-slate-800 bg-white dark:bg-[#0F1B2D]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-slate-900/50 text-gray-400 text-xs font-semibold uppercase tracking-wider border-b border-[#E5E7EB] dark:border-slate-800">
              <th className="p-4 py-5 pl-6 font-medium">Invoice Details</th>
              <th className="p-4 py-5 font-medium">Vendor</th>
              <th className="p-4 py-5 font-medium">In Books</th>
              <th className="p-4 py-5 font-medium text-center">In GSTR-2B</th>
              <th className="p-4 py-5 font-medium">Status</th>
              <th className="p-4 py-5 font-medium text-right pr-6">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB] dark:divide-slate-800">
            {filteredItems.map(item => (
              <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-900/30 transition-colors">
                <td className="p-4 pl-6">
                  <div className="font-medium text-[#111827] dark:text-slate-200 text-[15px]">{item.invoiceNum}</div>
                  <div className="text-[13px] text-gray-400 mt-0.5">{item.invoiceDate.replace('2026-06-02', '2 Jun 2026').replace('2026-06-04', '4 Jun 2026').replace('2026-06-06', '6 Jun 2026').replace('2026-06-08', '8 Jun 2026').replace('2026-06-10', '10 Jun 2026')}</div>
                </td>
                <td className="p-4 text-gray-500 text-[15px]">{item.vendorName}</td>
                <td className="p-4 text-[#111827] dark:text-slate-200 text-[15px] font-medium">
                  {item.booksAmt > 0 ? `₹${item.booksAmt.toLocaleString()}` : <span className="text-gray-300">—</span>}
                </td>
                <td className={`p-4 text-center text-[15px] font-medium ${item.status === 'AMOUNT_MISMATCH' ? 'text-orange-500' : 'text-[#111827] dark:text-slate-200'}`}>
                  {item.gst2bAmt > 0 ? `₹${item.gst2bAmt.toLocaleString()}` : <span className="text-gray-300">—</span>}
                </td>
                <td className="p-4">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-medium border ${
                    item.status === 'EXACT_MATCH' ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                    item.status === 'AMOUNT_MISMATCH' ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20 text-orange-600 dark:text-orange-400' :
                    item.status === 'MISSING_IN_2B' ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400' :
                    'bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20 text-purple-600 dark:text-purple-400'
                  }`}>
                    {item.status === 'EXACT_MATCH' && <div className="w-3 h-3 border border-emerald-500 rounded-sm"></div>}
                    {item.status === 'AMOUNT_MISMATCH' && <div className="w-3 h-3 border border-orange-500 rounded-sm"></div>}
                    {item.status === 'MISSING_IN_2B' && <div className="w-3 h-3 border border-red-500 rounded-sm"></div>}
                    {item.status === 'MISSING_IN_BOOKS' && <div className="w-3 h-3 border border-purple-500 rounded-sm"></div>}
                    <span className="leading-none pt-0.5">
                      {item.status === 'EXACT_MATCH' && 'Exact match'}
                      {item.status === 'AMOUNT_MISMATCH' && 'Amount mismatch'}
                      {item.status === 'MISSING_IN_2B' && 'Missing in 2B'}
                      {item.status === 'MISSING_IN_BOOKS' && 'Missing in books'}
                    </span>
                  </span>
                </td>
                <td className="p-4 text-right pr-6">
                  {item.status === 'EXACT_MATCH' ? (
                    <span className="inline-flex items-center gap-1.5 text-gray-400 text-[13px] font-medium">
                      <div className="w-3 h-3 border border-emerald-400 rounded-sm"></div>
                      Reconciled
                    </span>
                  ) : (
                    <button
                      onClick={() => setResolvingId(item.id)}
                      className="px-4 py-1.5 border border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-300 font-medium text-[13px] rounded-lg transition-all"
                    >
                      Resolve
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend Footer */}
      <div className="flex justify-between items-center mt-6 px-2">
        <div className="flex items-center gap-6 text-[13px]">
          <div className="flex items-center gap-2 text-gray-400"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Exact match</div>
          <div className="flex items-center gap-2 text-gray-400"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Amount mismatch</div>
          <div className="flex items-center gap-2 text-gray-400"><span className="w-2 h-2 rounded-full bg-red-500"></span> Missing in 2B</div>
          <div className="flex items-center gap-2 text-gray-400"><span className="w-2 h-2 rounded-full bg-purple-500"></span> Missing in books</div>
        </div>
        <div className="text-gray-400 text-[13px]">
          Showing {filteredItems.length} of {items.length} invoices
        </div>
      </div>

      {/* Resolution Dialog Modal */}
      {resolvingId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#0F1B2D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-2xl text-slate-900 dark:text-white w-[500px]">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Resolve Discrepancy
            </h3>
            <div className="flex flex-col gap-3">
              <button onClick={() => resolveItem(resolvingId, true)} className="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                <div className="font-semibold">Accept client books values</div>
              </button>
              <button onClick={() => resolveItem(resolvingId, false)} className="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                <div className="font-semibold">Accept supplier GSTR-2B returns</div>
              </button>
            </div>
            <div className="mt-4 text-right">
              <button onClick={() => setResolvingId(null)} className="px-4 py-2 text-slate-500 font-semibold text-sm uppercase">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
