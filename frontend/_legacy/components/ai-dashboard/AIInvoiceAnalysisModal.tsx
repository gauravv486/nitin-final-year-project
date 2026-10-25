'use client';

import React, { useState } from 'react';
import { Bot, FileText, AlertTriangle, CheckCircle, ShieldAlert, X } from 'lucide-react';

interface AIInvoiceAnalysisModalProps {
  onClose: () => void;
}

interface PredictionResult {
  risk: string;
  confidence: number;
  recommendation: string;
}

export default function AIInvoiceAnalysisModal({ onClose }: AIInvoiceAnalysisModalProps) {
  const [invoiceText, setInvoiceText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!invoiceText.trim()) {
      setError('Please enter invoice text to analyze.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_AI_API_KEY || 'ca_ai_super_secret_key_2026'
        },
        body: JSON.stringify({
          invoice_text: invoiceText,
          metadata: {},
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to reach AI Backend. Is FastAPI running?');
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred during analysis.');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'high': return 'var(--danger)';
      case 'medium': return 'var(--warning)';
      case 'low': return 'var(--success)';
      default: return 'var(--text-primary)';
    }
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(4px)',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -1000px 0; } 100% { background-position: 1000px 0; } }
        .skeleton {
          animation: shimmer 2s infinite linear;
          background: linear-gradient(to right, var(--bg-light) 4%, var(--border-color) 25%, var(--bg-light) 36%);
          background-size: 1000px 100%;
          border-radius: 4px;
        }
      `}</style>
      <div className="modal-content" style={{
        background: 'var(--bg-white)',
        borderRadius: '16px',
        width: '90%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.3s ease-out'
      }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'var(--primary-light)', padding: '8px', borderRadius: '8px', color: 'var(--primary)' }}>
              <Bot size={24} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>AI Invoice Analysis</h2>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Powered by Fine-Tuned LoRA Model</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', fontWeight: 500, marginBottom: '8px' }}>
              <FileText size={16} /> Invoice Content / OCR Text
            </label>
            <textarea 
              value={invoiceText}
              onChange={(e) => setInvoiceText(e.target.value)}
              placeholder="Paste the extracted invoice text here (e.g. 'Invoice contains GST mismatch with PAN missing...')"
              style={{
                width: '100%',
                minHeight: '120px',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-light)',
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>

          {error && (
            <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '8px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} /> {error}
            </div>
          )}

          <button 
            onClick={handleAnalyze} 
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bot size={18} className="animate-pulse" /> Analyzing...
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bot size={18} /> Run AI Analysis
              </span>
            )}
          </button>

          {loading && !result && (
            <div style={{ marginTop: '12px', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div className="skeleton" style={{ height: '24px', width: '120px' }}></div>
                <div className="skeleton" style={{ height: '24px', width: '60px' }}></div>
              </div>
              <div className="skeleton" style={{ height: '60px', width: '100%', borderRadius: '8px' }}></div>
            </div>
          )}

          {result && !loading && (
            <div style={{ 
              marginTop: '12px', 
              padding: '24px', 
              borderRadius: '12px', 
              border: `1px solid ${getRiskColor(result.risk)}`,
              background: `color-mix(in srgb, ${getRiskColor(result.risk)} 5%, transparent)`,
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              animation: 'fadeIn 0.4s ease-out'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Risk Assessment</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: getRiskColor(result.risk), fontWeight: 700, fontSize: '1.5rem' }}>
                    {result.risk.toLowerCase() === 'high' ? <ShieldAlert size={24} /> : <CheckCircle size={24} />}
                    {result.risk} Risk
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>AI Confidence</h3>
                  <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{result.confidence.toFixed(1)}%</div>
                </div>
              </div>

              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Recommendation</h3>
                <div style={{ padding: '12px', background: 'var(--bg-light)', borderRadius: '8px', fontSize: '0.95rem', lineHeight: '1.5', borderLeft: `4px solid ${getRiskColor(result.risk)}` }}>
                  {result.recommendation}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
