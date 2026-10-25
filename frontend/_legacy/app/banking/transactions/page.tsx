import React from "react"
import { List } from "lucide-react"

export default function TransactionsPage() {
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Bank Transactions</h1>
          <p className="text-gray-500 mt-2">View and filter synced bank transactions.</p>
        </div>
      </div>
      
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 text-center text-gray-500">
          <List className="mx-auto mb-3 text-gray-400" size={32} />
          <p>Transactions table will be populated here.</p>
        </div>
      </div>
    </div>
  )
}
