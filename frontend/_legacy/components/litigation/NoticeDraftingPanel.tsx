'use client';

import { useState } from 'react';
import { Sparkles, FileText, CheckCircle, Scale, ShieldAlert, FileSignature, AlertTriangle, Search } from 'lucide-react';

interface PrecedentCitation {
  citation: string;
  caseName: string;
  court: string;
  outcome: string;
}

const mockCitations: PrecedentCitation[] = [
  { citation: '2023 (SC) 1024', caseName: 'Union of India vs. Bharti Airtel Ltd', court: 'Supreme Court', outcome: 'IN_FAVOUR_OF_ASSESSEE' },
  { citation: '2024 (HC) 441', caseName: 'M/s E-Way Logistics vs. State of Maharashtra', court: 'Bombay High Court', outcome: 'IN_FAVOUR_OF_ASSESSEE' },
  { citation: '2022 (ITAT) 891', caseName: 'Ramanathan Services vs. ACIT Mumbai Benches', court: 'ITAT Mumbai Benches', outcome: 'REMANDED' }
];

interface NoticeDraftingPanelProps {
  simulateEmpty?: boolean;
  simulateAiError?: boolean;
}

export default function NoticeDraftingPanel({ simulateEmpty = false, simulateAiError = false }: NoticeDraftingPanelProps) {
  const [tone, setTone] = useState<string>('TECHNICAL_DEFENSE');
  const [selectedCitations, setSelectedCitations] = useState<string[]>([]);
  const [isDrafting, setIsDrafting] = useState<boolean>(false);
  const [draftContent, setDraftContent] = useState<string>('');
  const [isApproved, setIsApproved] = useState<boolean>(false);

  // Fallback states
  const [manualNoticeType, setManualNoticeType] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<PrecedentCitation[]>(mockCitations);

  const toggleCitation = (citation: string) => {
    setSelectedCitations(prev => 
      prev.includes(citation) ? prev.filter(c => c !== citation) : [...prev, citation]
    );
  };

  const handleSearchCaseLaws = () => {
    if (!searchQuery.trim()) {
      setSearchResults(mockCitations);
      return;
    }
    const query = searchQuery.toLowerCase();
    const filtered = mockCitations.filter(c => 
      c.caseName.toLowerCase().includes(query) || 
      c.citation.toLowerCase().includes(query) ||
      c.court.toLowerCase().includes(query)
    );
    setSearchResults(filtered);
  };

  const generateAIDraft = () => {
    setIsDrafting(true);
    setDraftContent('');
    setTimeout(() => {
      setIsDrafting(false);
      const activeType = manualNoticeType || 'GST DRC-01';
      const cites = [...selectedCitations];
      setDraftContent(`BEFORE THE JOINT COMMISSIONER OF GST (APPEALS), MAHARASHTRA STATE
MATTER: SUBMISSIONS IN RESPONSE TO SHOW CAUSE NOTICE REF NO. DRC-01/102830/2026

1. PRELIMINARY SUBMISSIONS
The Assessee, Acme Enterprises Pvt Ltd, respectfully submits that the proposed demand under ${activeType} is bad in law, incorrect on facts, and deserves to be dropped in entirety.

2. DETAILED REPLY ON FACTS & MERITS
A. Input Tax Credit (ITC) matching GSTR-2B vs GSTR-3B:
The discrepancy alleged in the Show Cause Notice represents temporary timing differences. The suppliers have subsequently uploaded the invoices and deposited the tax. Thus, Section 16(2)(c) conditions stand fully complied with.

B. Reliance on Precedent Judicial Rulings:
We draw strength from the ruling in the case of ${cites.length > 0 ? cites.join(', ') : 'Union of India vs. Bharti Airtel Ltd'}, which held that Input Tax Credit is a vested statutory right of the taxpayer and cannot be denied on technical delays or minor mismatch grounds.

3. PRAYER
In view of the above submissions and case laws, it is prayed that:
- The proposed tax demand, interest, and penalty liabilities are dropped in entirety.
- The Assessee be granted personal hearing prior to passing final adjudication orders.

VERIFICATION
I, Rajesh Kumar, Director of the Assessee, do hereby verify that the contents of this reply are true and correct to the best of my knowledge and belief.`);
    }, 2000);
  };

  // 1. EMPTY STATE VIEW
  if (simulateEmpty) {
    return (
      <div className="bg-white dark:bg-[#0F1B2D] border border-slate-200 dark:border-slate-800 rounded-xl p-8 shadow-2xl text-slate-900 dark:text-white flex flex-col items-center justify-center text-center min-h-[400px]">
        <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mb-6">
          <Scale className="h-8 w-8 text-indigo-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Litigation Notice Inbox Clean</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
          Your litigation notice inbox is clean. Upload new show-cause notices (SCN) to track response deadlines.
        </p>
        <button
          onClick={() => alert('Opening notice upload dialog...')}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-slate-900 dark:text-white font-bold text-sm rounded-lg transition-colors shadow-lg shadow-indigo-600/25"
        >
          Upload a Notice
        </button>
      </div>
    );
  }

  // 2. AI FALLBACK / UNRECOGNIZED NOTICE TYPE VIEW
  if (simulateAiError && !draftContent) {
    return (
      <div className="bg-white dark:bg-[#0F1B2D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-2xl text-slate-900 dark:text-white">
        {/* Warning Banner */}
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-4 flex gap-3 items-start mb-6">
          <AlertTriangle className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-rose-400 uppercase">Unrecognized Notice Format</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Our AI model was unable to classify this document format automatically. Please select the correct notice type to load templates, and use the side panel to search case laws manually.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Side: Manual Classifier & Draft trigger */}
          <div className="lg:col-span-7 bg-slate-50 dark:bg-slate-950 p-5 rounded-xl border border-slate-200 dark:border-slate-900 flex flex-col gap-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Manual Notice Classification</h3>
            
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2 font-bold uppercase">Select Notice Type</label>
              <select
                value={manualNoticeType}
                onChange={(e) => setManualNoticeType(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">-- Choose Notice Type --</option>
                <option value="GST DRC-01">GST DRC-01 (Show Cause Notice)</option>
                <option value="GST DRC-02">GST DRC-02 (Summary of SCN)</option>
                <option value="GST ASMT-10">GST ASMT-10 (Scrutiny Notice)</option>
                <option value="GST GSTR-3B Notice">GST GSTR-3B Notice (Filing Delay)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2 font-bold uppercase">Select Defense Strategy Tone</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'TECHNICAL_DEFENSE', label: 'Technical Defense' },
                  { id: 'AGGRESSIVE_DEFENSE', label: 'Aggressive' },
                  { id: 'CONSERVATIVE_DEFENSE', label: 'Conservative' },
                  { id: 'HYBRID_DEFENSE', label: 'Hybrid Precedent' }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTone(t.id)}
                    className={`p-2.5 text-left rounded-lg border text-xs font-semibold transition-all ${
                      tone === t.id 
                        ? 'bg-indigo-600 border-indigo-600 text-slate-900 dark:text-white' 
                        : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Precedents Summary */}
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2 font-bold uppercase">Attached Citations ({selectedCitations.length})</label>
              {selectedCitations.length === 0 ? (
                <div className="text-xs text-slate-500 italic p-3 bg-slate-100 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                  No precedents attached yet. Click citations in the right panel to attach.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 p-2 bg-slate-100 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 max-h-24 overflow-y-auto">
                  {selectedCitations.map(cit => (
                    <span key={cit} className="inline-flex items-center gap-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded text-xs font-semibold">
                      {cit}
                      <button onClick={() => toggleCitation(cit)} className="hover:text-red-400 font-bold ml-1">✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={generateAIDraft}
              disabled={isDrafting || !manualNoticeType}
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-850 disabled:text-slate-500 text-slate-900 dark:text-white font-bold text-sm rounded-lg transition-colors shadow-lg shadow-indigo-600/25 mt-2"
            >
              <Sparkles className={`h-4.5 w-4.5 ${isDrafting ? 'animate-spin' : ''}`} />
              {isDrafting ? 'Compiling manual data & generating appeal...' : 'Load Template & Generate appeal'}
            </button>
          </div>

          {/* Right Side: Case Law Side Search Panel */}
          <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-950 p-5 rounded-xl border border-slate-200 dark:border-slate-900 flex flex-col gap-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Case Law Search Console</h3>
            
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search Section 16, ITC discrepancy, etc..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchCaseLaws()}
                className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                onClick={handleSearchCaseLaws}
                className="px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-700 text-slate-900 dark:text-white rounded-lg transition-colors text-xs font-bold flex items-center gap-1"
              >
                <Search className="h-3.5 w-3.5" />
                Find
              </button>
            </div>

            <div className="flex-1 flex flex-col gap-2 max-h-72 overflow-y-auto">
              {searchResults.map(cit => (
                <div 
                  key={cit.citation}
                  onClick={() => toggleCitation(cit.citation)}
                  className={`flex flex-col p-2.5 rounded cursor-pointer border text-xs transition-colors ${
                    selectedCitations.includes(cit.citation)
                      ? 'bg-indigo-600/10 border-indigo-600 text-indigo-400 font-semibold'
                      : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-slate-700 dark:text-slate-200">{cit.caseName}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">FAVOURABLE</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">{cit.court} | {cit.citation}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 italic">Outcome: {cit.outcome.replace(/_/g, ' ')}</div>
                </div>
              ))}
              {searchResults.length === 0 && (
                <div className="text-xs text-slate-500 text-center py-6 italic">No precedents found. Try another query.</div>
              )}
            </div>
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
            <Scale className="h-5 w-5" />
            AI Notice Draft Engine
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Generate legally defensible notice replies and appeal responses backed by case laws</p>
        </div>
        <span className="px-3 py-1 text-xs font-semibold rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider">
          Notice Type: GST DRC-01
        </span>
      </div>

      {/* Inputs Configuration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Select Defense Strategy Tone</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'TECHNICAL_DEFENSE', label: 'Technical Defense' },
              { id: 'AGGRESSIVE_DEFENSE', label: 'Aggressive Defense' },
              { id: 'CONSERVATIVE_DEFENSE', label: 'Conservative' },
              { id: 'HYBRID_DEFENSE', label: 'Hybrid Precedent' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTone(t.id)}
                className={`p-3 text-left rounded-lg border text-xs font-semibold transition-all ${
                  tone === t.id 
                    ? 'bg-indigo-600 border-indigo-600 text-slate-900 dark:text-white' 
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:border-slate-200 dark:border-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Precedent Case Citations (Add to Draft)</label>
          <div className="flex flex-col gap-2 max-h-40 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-900">
            {mockCitations.map(cit => (
              <div 
                key={cit.citation}
                onClick={() => toggleCitation(cit.citation)}
                className={`flex items-center justify-between p-2 rounded cursor-pointer border text-xs transition-colors ${
                  selectedCitations.includes(cit.citation)
                    ? 'bg-indigo-600/10 border-indigo-600 text-indigo-400 font-semibold'
                    : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                <div>
                  <div>{cit.caseName}</div>
                  <div className="text-[10px] text-slate-500">{cit.court} | {cit.citation}</div>
                </div>
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">FAVOURABLE</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trigger Button */}
      <div className="mb-6">
        <button
          onClick={generateAIDraft}
          disabled={isDrafting}
          className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:bg-slate-800 disabled:text-slate-500 text-slate-900 dark:text-white font-bold text-sm rounded-lg transition-colors shadow-lg shadow-indigo-600/25"
        >
          <Sparkles className={`h-4.5 w-4.5 ${isDrafting ? 'animate-spin' : ''}`} />
          {isDrafting ? 'Extracting Issues & Generating Legal Draft...' : 'Generate AI Response Draft'}
        </button>
      </div>

      {/* Editor & output */}
      {draftContent && (
        <div className="border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-lg p-5">
          <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-indigo-400" />
              Generated Response Draft Brief (Editable)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setIsApproved(true)}
                disabled={isApproved}
                className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 transition-all ${
                  isApproved 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-100 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {isApproved ? <CheckCircle className="h-3.5 w-3.5" /> : <FileSignature className="h-3.5 w-3.5" />}
                {isApproved ? 'Approved & Locked' : 'Sign & Approve Response'}
              </button>
            </div>
          </div>
          
          <textarea
            rows={15}
            value={draftContent}
            disabled={isApproved}
            onChange={(e) => setDraftContent(e.target.value)}
            className="w-full bg-transparent text-slate-600 dark:text-slate-300 text-sm border-0 focus:outline-none focus:ring-0 leading-relaxed font-mono resize-y"
          />
        </div>
      )}
    </div>
  );
}
