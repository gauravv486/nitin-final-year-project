import React from "react"
import { Layers } from "lucide-react"

export default function SyncHistoryPage() {
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Sync History</h1>
          <p className="text-gray-500 mt-2">Audit log of all bank synchronization jobs.</p>
        </div>
      </div>
      
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 text-center text-gray-500">
          <Layers className="mx-auto mb-3 text-gray-400" size={32} />
          <p>Sync history log will be populated here.</p>
        </div>
      </div>
    </div>
  )
}
