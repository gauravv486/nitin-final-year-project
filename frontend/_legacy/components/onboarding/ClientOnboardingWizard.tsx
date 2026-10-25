'use client';

import { useState } from 'react';
import { Sparkles, Building2, UserCheck, ShieldCheck, Zap, PieChart } from 'lucide-react';

export default function ClientOnboardingWizard() {
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [gstin, setGstin] = useState<string>('');
  
  // Form values state
  const [formData, setFormData] = useState({
    legalName: '',
    pan: '',
    entityType: 'Private Limited',
    address: '',
    email: '',
    phone: '',
    accountNumber: '',
    ifsc: ''
  });

  const triggerMockLookup = () => {
    if (!gstin || gstin.length < 15) {
      alert('Please enter a valid 15-character GSTIN');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setFormData(prev => ({
        ...prev,
        legalName: 'Apex Software Solutions Private Limited',
        pan: gstin.substring(2, 12),
        address: 'Suite 405, Dynasty Business Park, Andheri Kurla Road, Mumbai, Maharashtra 400059',
        email: 'accounts@apexsolutions.in',
        phone: '+91 98765 43210'
      }));
    }, 1500);
  };

  const handleInputChange = (field: string, val: string) => {
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-slate-200 rounded-[24px] p-6 text-slate-900 w-full relative overflow-hidden">
        {/* Header and Step indicators */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-[#5b5fff] rounded-lg flex items-center justify-center">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-[18px] font-bold text-[#1e2b4d]">
                AI Client Onboarding Wizard
              </h2>
              <p className="text-[13px] text-slate-500 font-medium">Accelerate KYC checks and generate statutory compliance schedules</p>
            </div>
          </div>
          
          {/* Minimal Stepper */}
          <div className="flex items-center gap-0">
            {/* Step 1 */}
            <div className="flex flex-col items-center gap-1 z-10 w-16">
              <span className="h-8 w-8 rounded-full bg-[#5b5fff] text-white flex items-center justify-center text-[13px] font-semibold">1</span>
              <span className="text-[12px] font-semibold text-[#5b5fff]">Identity</span>
            </div>
            
            <div className="h-[1px] w-12 sm:w-20 bg-slate-200 -translate-y-3" />
            
            {/* Step 2 */}
            <div className="flex flex-col items-center gap-1 z-10 w-16">
              <span className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center text-[13px] font-semibold">2</span>
              <span className="text-[12px] font-semibold text-slate-400">Banking</span>
            </div>
            
            <div className="h-[1px] w-12 sm:w-20 bg-slate-200 -translate-y-3" />
            
            {/* Step 3 */}
            <div className="flex flex-col items-center gap-1 z-10 w-16">
              <span className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center text-[13px] font-semibold">3</span>
              <span className="text-[12px] font-semibold text-slate-400">Confirm</span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-[1px] w-full bg-slate-100 mb-6 absolute left-0" />
        <div className="mb-8" />

        {/* Form Content Area */}
        <div className="w-full">
          {/* STEP 1: IDENTITY */}
          {step === 1 && (
            <div className="space-y-4 max-w-4xl">
              {/* GSTIN Row */}
              <div className="flex gap-3 items-end">
                <div className="flex-1 max-w-xl">
                  <label className="block text-[13px] font-bold text-slate-700 mb-1.5">GSTIN Auto-Lookup</label>
                  <input
                    type="text"
                    placeholder="e.g., 27AAAAA1111A1Z1"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    className="w-full h-[42px] px-3 border border-slate-200 rounded-lg focus:outline-none focus:border-[#5b5fff] text-[14px] text-slate-900 placeholder-slate-300"
                  />
                </div>
                <button
                  onClick={triggerMockLookup}
                  disabled={loading}
                  className="h-[42px] px-4 bg-white border border-[#5b5fff]/30 hover:bg-[#5b5fff]/5 text-[#5b5fff] text-[13px] font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Sparkles className="h-4 w-4" />
                  {loading ? 'Fetching...' : 'Fetch Gov Data'}
                </button>
              </div>

              {/* Legal Name & PAN Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                <div>
                  <label className="block text-[13px] font-bold text-slate-700 mb-1.5">Legal Business Name</label>
                  <input
                    type="text"
                    placeholder="Enter legal business name"
                    value={formData.legalName}
                    onChange={(e) => handleInputChange('legalName', e.target.value)}
                    className="w-full h-[42px] px-3 border border-slate-200 rounded-lg focus:outline-none focus:border-[#5b5fff] text-[14px] text-slate-900 placeholder-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-slate-700 mb-1.5">PAN Code</label>
                  <input
                    type="text"
                    placeholder="Enter PAN code"
                    value={formData.pan}
                    onChange={(e) => handleInputChange('pan', e.target.value)}
                    className="w-full h-[42px] px-3 border border-slate-200 rounded-lg focus:outline-none focus:border-[#5b5fff] text-[14px] text-slate-900 placeholder-slate-300"
                  />
                </div>
              </div>

              {/* Address Field */}
              <div className="max-w-2xl">
                <label className="block text-[13px] font-bold text-slate-700 mb-1.5">Registered Office Address</label>
                <textarea
                  rows={2}
                  placeholder="Enter complete registered office address"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-lg focus:outline-none focus:border-[#5b5fff] text-[14px] text-slate-900 placeholder-slate-300 resize-none"
                />
              </div>

              <div className="flex justify-end max-w-2xl pt-2">
                <button
                  onClick={() => setStep(2)}
                  className="h-[42px] px-6 bg-[#6366f1] hover:bg-[#4f46e5] text-white font-semibold text-[14px] rounded-lg transition-colors flex items-center justify-center"
                >
                  Save & Continue
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: BANKING */}
          {step === 2 && (
            <div className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-bold text-slate-700 mb-1.5">Current Account Number</label>
                  <input
                    type="text"
                    placeholder="e.g., 001205001948"
                    value={formData.accountNumber}
                    onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                    className="w-full h-[42px] px-3 border border-slate-200 rounded-lg focus:outline-none focus:border-[#5b5fff] text-[14px]"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-slate-700 mb-1.5">IFSC Code</label>
                  <input
                    type="text"
                    placeholder="e.g., HDFC0000012"
                    value={formData.ifsc}
                    onChange={(e) => handleInputChange('ifsc', e.target.value)}
                    className="w-full h-[42px] px-3 border border-slate-200 rounded-lg focus:outline-none focus:border-[#5b5fff] text-[14px]"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-slate-700 mb-1.5">Contact Email Address</label>
                  <input
                    type="email"
                    placeholder="contact@company.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full h-[42px] px-3 border border-slate-200 rounded-lg focus:outline-none focus:border-[#5b5fff] text-[14px]"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-slate-700 mb-1.5">Primary Phone Number</label>
                  <input
                    type="text"
                    placeholder="+91"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="w-full h-[42px] px-3 border border-slate-200 rounded-lg focus:outline-none focus:border-[#5b5fff] text-[14px]"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="h-[42px] px-4 text-slate-500 hover:bg-slate-50 font-semibold text-[14px] rounded-lg transition-colors border border-transparent"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="h-[42px] px-6 bg-[#6366f1] hover:bg-[#4f46e5] text-white font-semibold text-[14px] rounded-lg transition-colors"
                >
                  Save & Review
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: CONFIRM */}
          {step === 3 && (
            <div className="space-y-4 max-w-2xl">
              <div className="border border-slate-200 p-5 rounded-[12px] space-y-4">
                <h3 className="text-[15px] font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-[#5b5fff]" />
                  Verify & Complete Onboarding File
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-4 gap-x-4 text-[14px]">
                  <div className="text-slate-500 font-medium">Legal Name</div>
                  <div className="sm:col-span-2 text-slate-900 font-semibold">{formData.legalName || '-'}</div>

                  <div className="text-slate-500 font-medium">PAN ID</div>
                  <div className="sm:col-span-2 text-slate-900 font-semibold uppercase">{formData.pan || '-'}</div>

                  <div className="text-slate-500 font-medium">Registered Address</div>
                  <div className="sm:col-span-2 text-slate-900">{formData.address || '-'}</div>

                  <div className="text-slate-500 font-medium">Bank Details</div>
                  <div className="sm:col-span-2 text-slate-900">
                    {formData.accountNumber ? `A/c: ${formData.accountNumber} (IFSC: ${formData.ifsc})` : '-'}
                  </div>

                  <div className="text-slate-500 font-medium">Contact Info</div>
                  <div className="sm:col-span-2 text-slate-900">
                    {formData.email ? `${formData.email} | ${formData.phone}` : '-'}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={() => setStep(2)}
                  className="h-[42px] px-4 text-slate-500 hover:bg-slate-50 font-semibold text-[14px] rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    alert(`Onboarding completed successfully for ${formData.legalName}! compliance calendar generated.`);
                    setStep(1);
                    setFormData({
                      legalName: '',
                      pan: '',
                      entityType: 'Private Limited',
                      address: '',
                      email: '',
                      phone: '',
                      accountNumber: '',
                      ifsc: ''
                    });
                    setGstin('');
                  }}
                  className="h-[42px] px-6 bg-[#6366f1] hover:bg-[#4f46e5] text-white font-semibold text-[14px] rounded-lg transition-colors flex items-center gap-2"
                >
                  Complete Onboarding
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Feature Cards Grid (Bottom) - Flat Style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-[16px] p-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0 text-[#6366f1]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-[13px] font-bold text-slate-900 mb-0.5">AI-Powered</h4>
            <p className="text-[12px] text-slate-500">Automated KYC & data extraction</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-[16px] p-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 text-emerald-500">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-[13px] font-bold text-slate-900 mb-0.5">Secure & Compliant</h4>
            <p className="text-[12px] text-slate-500">Data encrypted & aligned with regulations</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-[16px] p-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 text-blue-500">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-[13px] font-bold text-slate-900 mb-0.5">Time Saving</h4>
            <p className="text-[12px] text-slate-500">Reduce onboarding time by up to 70%</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-[16px] p-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0 text-rose-500">
            <PieChart className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-[13px] font-bold text-slate-900 mb-0.5">Actionable Insights</h4>
            <p className="text-[12px] text-slate-500">Get compliance schedule & risk insights instantly</p>
          </div>
        </div>
      </div>
    </div>
  );
}
