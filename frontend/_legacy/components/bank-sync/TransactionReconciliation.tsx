"use client"
import React, { useState } from "react"
import { FileText, RefreshCw, AlertTriangle, CheckCircle, Search } from "lucide-react"

export function TransactionReconciliation() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [transactions, setTransactions] = useState<any[]>([])

  const fetchTransactions = () => {
    setIsSyncing(true)
    // Mock API call to /fetch-data and /reconciliation-queue
    setTimeout(() => {
      setTransactions([
        {
          id: "txn-1",
          date: "2026-10-15",
          amount: 450.00,
          type: "DEBIT",
          narration: "ZOMATO/FOOD",
          suggestedLedger: "Meals & Entertainment",
          confidence: 95,
          matchStatus: "UNMATCHED",
          itcRisk: false
        },
        {
          id: "txn-2",
          date: "2026-10-14",
          amount: 75000.00,
          type: "CREDIT",
          narration: "NEFT SALARY",
          suggestedLedger: "Capital Account - Salary",
          confidence: 99,
          matchStatus: "MATCHED",
          itcRisk: false
        },
        {
          id: "txn-3",
          date: "2026-10-12",
          amount: 150000.00,
          type: "DEBIT",
          narration: "RTGS VENDOR A",
          suggestedLedger: "Vendor Payable",
          confidence: 85,
          matchStatus: "UNMATCHED",
          itcRisk: true // over 50k flag
        }
      ])
      setIsSyncing(false)
    }, 1500)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Transaction Reconciliation</h2>
          <p className="text-sm text-gray-500">AI-powered ledger mapping and invoice matching.</p>
        </div>
        <button 
          onClick={fetchTransactions}
          disabled={isSyncing}
          className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
        >
          <RefreshCw size={18} className={isSyncing ? "animate-spin" : ""} />
          {isSyncing ? "Syncing..." : "Fetch Latest Transactions"}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-gray-900 font-medium border-b border-gray-200">
            <tr>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Narration</th>
              <th className="px-6 py-4 text-right">Amount</th>
              <th className="px-6 py-4">AI Suggested Ledger</th>
              <th className="px-6 py-4">Match Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  <FileText className="mx-auto mb-3 text-gray-400" size={32} />
                  No transactions synced yet. Click fetch to get started.
                </td>
              </tr>
            ) : (
              transactions.map((txn) => (
                <tr key={txn.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">{txn.date}</td>
                  <td className="px-6 py-4 font-mono text-xs">{txn.narration}</td>
                  <td className={`px-6 py-4 text-right font-medium ${txn.type === 'CREDIT' ? 'text-green-600' : 'text-gray-900'}`}>
                    {txn.type === 'CREDIT' ? '+' : '-'}₹{txn.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium">
                        {txn.suggestedLedger}
                      </span>
                      <span className="text-xs text-gray-400">{txn.confidence}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {txn.matchStatus === "MATCHED" ? (
                      <span className="flex items-center gap-1.5 text-green-700 bg-green-50 px-2.5 py-1 rounded-md text-xs font-medium w-fit">
                        <CheckCircle size={14} /> Matched
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md text-xs font-medium w-fit">
                        <Search size={14} /> Unmatched
                        {txn.itcRisk && (
                          <span title="High value transaction without invoice" className="ml-1 flex items-center">
                            <AlertTriangle size={14} className="text-red-500" />
                          </span>
                        )}

                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
