import React from "react"
import Link from "next/link"
import { Building2, List, RefreshCw, Layers, ArrowLeft, ArrowRight, Activity, Wallet } from "lucide-react"

export default function BankingDashboardPage() {
  const stats = [
    { 
      title: "Connected Accounts", 
      value: "2", 
      icon: Building2, 
      link: "/banking/accounts",
      color: "from-blue-500 to-cyan-400",
      bgLight: "bg-blue-50/50"
    },
    { 
      title: "Recent Transactions", 
      value: "24", 
      icon: List, 
      link: "/banking/transactions",
      color: "from-purple-500 to-indigo-500",
      bgLight: "bg-purple-50/50"
    },
    { 
      title: "To Reconcile", 
      value: "5", 
      icon: RefreshCw, 
      link: "/banking/reconciliation",
      color: "from-amber-500 to-orange-400",
      bgLight: "bg-amber-50/50"
    },
    { 
      title: "Sync Jobs", 
      value: "1", 
      icon: Layers, 
      link: "/banking/sync-history",
      color: "from-emerald-500 to-teal-400",
      bgLight: "bg-emerald-50/50"
    }
  ]

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-50/50">
      {/* Background Decorative Blobs */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-50/80 to-transparent pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-100/50 rounded-full blur-3xl opacity-60 animate-pulse pointer-events-none" />
      <div className="absolute top-48 -left-24 w-72 h-72 bg-purple-100/50 rounded-full blur-3xl opacity-60 animate-pulse pointer-events-none" style={{ animationDelay: '2s' }} />

      <div className="relative p-6 md:p-10 max-w-7xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* Header Section */}
        <div className="flex flex-col gap-6">
          <Link 
            href="/" 
            className="group inline-flex items-center text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors w-fit"
          >
            <div className="p-2 rounded-full bg-white shadow-sm border border-slate-100 mr-3 group-hover:shadow-md transition-all">
              <ArrowLeft className="w-4 h-4" />
            </div>
            Back to Dashboard
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-indigo-100 text-indigo-600 text-xs font-semibold uppercase tracking-wider shadow-sm">
                <Activity className="w-3.5 h-3.5" />
                Live Sync Active
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
                Banking <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-500">Overview</span>
              </h1>
              <p className="text-slate-500 text-lg max-w-2xl leading-relaxed">
                Manage your connected bank accounts, monitor real-time transactions, and effortlessly reconcile your finances in one unified command center.
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((item, i) => (
            <Link href={item.link} key={i} className="group block">
              <div className="relative h-full bg-white/80 backdrop-blur-xl p-6 rounded-2xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-300 hover:-translate-y-1 overflow-hidden">
                
                {/* Card Hover Gradient Background */}
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-br ${item.color} transition-opacity duration-300 pointer-events-none`} style={{ opacity: 0.03 }} />
                
                <div className="relative flex flex-col h-full justify-between gap-6">
                  <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-xl ${item.bgLight} border border-white/50 shadow-sm`}>
                      <item.icon className="w-6 h-6 text-slate-700" />
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-2 group-hover:translate-x-0">
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-slate-500 font-medium mb-1">{item.title}</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-slate-900 tracking-tight">{item.value}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Quick Actions / Getting Started */}
        <div className="mt-12 bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Need to add another bank?</h2>
              <p className="text-slate-500 text-sm">Securely connect more accounts to automatically sync data.</p>
            </div>
          </div>
          <button className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium transition-colors shadow-md hover:shadow-lg flex items-center gap-2">
            Connect Account
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  )
}
