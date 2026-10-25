import React from "react"
import { ConsentManager } from "@/components/bank-sync/ConsentManager"
import { TransactionReconciliation } from "@/components/bank-sync/TransactionReconciliation"
import { ConsentCenter } from "@/components/bank-sync/consent-center"
import { Building2, Landmark, LineChart, RefreshCw } from "lucide-react"

export const metadata = {
  title: "Bank Sync & Intelligence | CA-OS",
  description: "Live bank sync and AI transaction reconciliation",
}

export default function BankSyncPage() {
  const dummyConsents = [
    {
      provider: "MockAA",
      bankName: "HDFC Bank",
      accountNumber: "XXXX-XXXX-1234",
      purpose: "Wealth Management",
      dataRequested: "Transactions, Profile",
      consentDate: new Date().toISOString(),
      expiry: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      status: "APPROVED",
      consentHandle: "mock-handle-123"
    }
  ]

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <Landmark size={20} />
            <span className="text-sm font-semibold tracking-wider uppercase">Module 4 Extension</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Bank Sync & Intelligence
          </h1>
          <p className="text-gray-500 mt-2 max-w-2xl">
            Live Account Aggregator sync replacing manual bank statement uploads. 
            Powered by AI to automatically categorize transactions and match invoices.
          </p>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg shrink-0">
            <Building2 size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium mb-1">Active AA Consents</p>
            <p className="text-3xl font-bold text-gray-900">42</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg shrink-0">
            <RefreshCw size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium mb-1">Unreconciled Txns</p>
            <p className="text-3xl font-bold text-gray-900">156</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-lg shrink-0">
            <LineChart size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium mb-1">AI Match Confidence</p>
            <p className="text-3xl font-bold text-gray-900">94.2%</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-8">
          <ConsentManager />
          <ConsentCenter consents={dummyConsents} />
        </div>
        
        <div className="lg:col-span-2">
          <TransactionReconciliation />
        </div>
      </div>
      
    </div>
  )
}
