"use client"
import React, { useState } from "react"
import { Building2, Key, CheckCircle2, AlertCircle } from "lucide-react"

export function ConsentManager() {
  const [status, setStatus] = useState<"IDLE" | "PENDING" | "ACTIVE">("IDLE")
  const [handle, setHandle] = useState<string>("")

  const initiateConsent = async () => {
    setStatus("PENDING")
    // Mock API call to initiate AA consent
    setTimeout(() => {
      setHandle("aa-handle-1234")
    }, 1000)
  }

  const checkStatus = async () => {
    // Mock API call to check status
    setStatus("ACTIVE")
  }

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
          <Building2 size={24} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Account Aggregator Consent</h2>
          <p className="text-sm text-gray-500">Securely link your bank accounts for live transaction sync.</p>
        </div>
      </div>

      <div className="space-y-4 mt-6">
        {status === "IDLE" && (
          <button 
            onClick={initiateConsent}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Key size={18} />
            Link Bank Account via AA
          </button>
        )}

        {status === "PENDING" && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-sm font-medium text-amber-800">Consent Pending Approval</p>
              <p className="text-sm text-amber-700 mt-1">
                Please check your mobile app to approve the Account Aggregator request.
                <br/>Handle: <strong>{handle}</strong>
              </p>
              <button 
                onClick={checkStatus}
                className="mt-3 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-md"
              >
                Refresh Status
              </button>
            </div>
          </div>
        )}

        {status === "ACTIVE" && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <CheckCircle2 className="text-green-600 shrink-0" size={24} />
            <div>
              <p className="text-sm font-medium text-green-800">Bank Accounts Linked</p>
              <p className="text-sm text-green-700">Live sync is active via Account Aggregator.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
