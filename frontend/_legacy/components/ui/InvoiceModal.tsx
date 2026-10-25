'use client';

import React, { useState, useEffect } from 'react';

export interface Invoice {
  id: string;
  number: string;
  client: string;
  amount: number;
  gst: number;
  date: string;
  status: 'paid' | 'pending';
}

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit' | 'view';
  invoice: Invoice | null;
  onSave: (invoiceData: Omit<Invoice, 'id'> & { id?: string }) => void;
  onDelete?: (invoiceId: string) => void;
  clientsList: Array<{ id: string; name: string }>;
}

export default function InvoiceModal({
  isOpen,
  onClose,
  mode: initialMode,
  invoice,
  onSave,
  onDelete,
  clientsList,
}: InvoiceModalProps) {
  const [mode, setMode] = useState<'create' | 'edit' | 'view'>(initialMode);
  const [formData, setFormData] = useState({
    number: '',
    client: '',
    amount: 0,
    gst: 0,
    date: '',
    status: 'pending' as 'paid' | 'pending',
  });
  
  const [showShareToast, setShowShareToast] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Sync state with props when open
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      if (invoice && (initialMode === 'edit' || initialMode === 'view')) {
        setFormData({
          number: invoice.number,
          client: invoice.client,
          amount: invoice.amount,
          gst: invoice.gst,
          date: invoice.date,
          status: invoice.status,
        });
      } else {
        // Generate random invoice number
        const randNum = Math.floor(100 + Math.random() * 900);
        setFormData({
          number: `INV-2026-${randNum}`,
          client: clientsList[0]?.name || '',
          amount: 0,
          gst: 0,
          date: new Date().toISOString().split('T')[0],
          status: 'pending',
        });
      }
    }
  }, [isOpen, initialMode, invoice, clientsList]);

  // Auto-calculate GST (18%) when amount changes
  const handleAmountChange = (val: number) => {
    const calculatedGst = Math.round(val * 0.18);
    setFormData(prev => ({
      ...prev,
      amount: val,
      gst: calculatedGst
    }));
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client || !formData.number || formData.amount <= 0) {
      alert('Please fill in all details with valid values.');
      return;
    }
    
    onSave({
      ...formData,
      id: invoice?.id,
    });
    onClose();
  };

  const handleDownload = () => {
    if (!invoice) return;
    setIsDownloading(true);
    
    // Generate text content for the invoice download
    const invoiceText = `
=========================================
          CA·OS BILLING INVOICE
=========================================
Invoice Number: ${invoice.number}
Client Name:    ${invoice.client}
Date:           ${invoice.date}
Status:         ${invoice.status.toUpperCase()}
-----------------------------------------
Subtotal:       ₹${invoice.amount.toLocaleString()}
GST (18%):      ₹${invoice.gst.toLocaleString()}
-----------------------------------------
Grand Total:    ₹${(invoice.amount + invoice.gst).toLocaleString()}
=========================================
    Generated securely by CA·OS System
=========================================
    `;
    
    const element = document.createElement("a");
    const file = new Blob([invoiceText], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${invoice.number}_Invoice.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    setTimeout(() => {
      setIsDownloading(false);
    }, 1000);
  };

  const handleShare = () => {
    if (!invoice) return;
    const shareUrl = `${window.location.origin}/billing?invoice=${invoice.number}`;
    navigator.clipboard.writeText(shareUrl);
    setShowShareToast(true);
    setTimeout(() => {
      setShowShareToast(false);
    }, 3000);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(27, 58, 107, 0.45)',
      backdropFilter: 'blur(4px)',
    }}>
      <div className="card" style={{
        width: '520px',
        maxHeight: '90vh',
        overflowY: 'auto',
        position: 'relative',
        padding: '24px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-lg)',
        background: 'var(--bg-white)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary)', margin: 0 }}>
            {mode === 'view' ? `📄 Invoice ${formData.number}` : mode === 'edit' ? '✏️ Edit Invoice' : '➕ Create New Invoice'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-light)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
          >
            ✕
          </button>
        </div>

        {/* View Mode */}
        {mode === 'view' && invoice && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Status Panel */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--bg-light)',
              padding: '12px 16px',
              borderRadius: '8px',
              borderLeft: `4px solid ${invoice.status === 'paid' ? 'var(--success)' : 'var(--warning)'}`
            }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>STATUS</div>
                <div style={{ fontWeight: '700', textTransform: 'uppercase', color: invoice.status === 'paid' ? 'var(--success)' : 'var(--warning)', fontSize: '14px', marginTop: '2px' }}>
                  {invoice.status}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>DATE</div>
                <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '13px', marginTop: '2px' }}>{invoice.date}</div>
              </div>
            </div>

            {/* Info Table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', paddingBottom: '8px', borderBottom: '1px dashed var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Client Name</span>
                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{invoice.client}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', paddingBottom: '8px', borderBottom: '1px dashed var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Invoice ID</span>
                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{invoice.number}</span>
              </div>
            </div>

            {/* Financial Summary */}
            <div style={{
              background: 'var(--bg-light)',
              borderRadius: '8px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Taxable Amount</span>
                <span style={{ color: 'var(--text-primary)' }}>₹{invoice.amount.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>GST (18%)</span>
                <span style={{ color: 'var(--text-primary)' }}>₹{invoice.gst.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: '700', paddingTop: '4px' }}>
                <span style={{ color: 'var(--primary)' }}>Total Amount</span>
                <span style={{ color: 'var(--primary)' }}>₹{(invoice.amount + invoice.gst).toLocaleString()}</span>
              </div>
            </div>

            {/* Actions Bar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
              <button onClick={handleDownload} disabled={isDownloading} className="btn btn-secondary" style={{ flex: 1, minWidth: '130px', justifyContent: 'center' }}>
                ⬇️ {isDownloading ? 'Downloading...' : 'Download File'}
              </button>
              <button onClick={handleShare} className="btn btn-secondary" style={{ flex: 1, minWidth: '130px', justifyContent: 'center' }}>
                🔗 Share Link
              </button>
              <button onClick={() => setMode('edit')} className="btn btn-secondary" style={{ flex: 1, minWidth: '100px', justifyContent: 'center' }}>
                ✏️ Edit
              </button>
              {onDelete && (
                <button
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete Invoice ${invoice.number}?`)) {
                      onDelete(invoice.id);
                      onClose();
                    }
                  }}
                  className="btn btn-danger"
                  style={{ flex: 1, minWidth: '100px', justifyContent: 'center' }}
                >
                  🗑️ Delete
                </button>
              )}
            </div>
            
            {showShareToast && (
              <div style={{
                background: 'var(--gold-light)',
                border: '1px solid var(--gold-dark)',
                color: 'var(--primary)',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                textAlign: 'center',
                fontWeight: '700',
                marginTop: '10px',
                animation: 'pulse 1s infinite'
              }}>
                ✅ Link copied to clipboard successfully!
              </div>
            )}
          </div>
        )}

        {/* Create / Edit Mode Form */}
        {(mode === 'create' || mode === 'edit') && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>Invoice Number</label>
              <input
                type="text"
                required
                value={formData.number}
                onChange={(e) => setFormData(prev => ({ ...prev, number: e.target.value }))}
                style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-light)', color: 'var(--text-primary)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>Client Name</label>
              <select
                value={formData.client}
                onChange={(e) => setFormData(prev => ({ ...prev, client: e.target.value }))}
                style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-light)', color: 'var(--text-primary)' }}
              >
                {clientsList.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
                <option value="Other Client">Other Client</option>
              </select>
              {formData.client === 'Other Client' && (
                <input
                  type="text"
                  placeholder="Enter Custom Client Name"
                  required
                  value={formData.client === 'Other Client' ? '' : formData.client}
                  onChange={(e) => setFormData(prev => ({ ...prev, client: e.target.value }))}
                  style={{ width: '100%', marginTop: '8px', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-light)', color: 'var(--text-primary)' }}
                />
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>Taxable Amount (₹)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.amount || ''}
                  onChange={(e) => handleAmountChange(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-light)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>GST (18% Computed)</label>
                <input
                  type="number"
                  required
                  value={formData.gst || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, gst: parseFloat(e.target.value) || 0 }))}
                  style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-light)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>Date</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-light)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>Payment Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as 'paid' | 'pending' }))}
                  style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-light)', color: 'var(--text-primary)' }}
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button
                type="button"
                onClick={() => {
                  if (mode === 'edit') setMode('view');
                  else onClose();
                }}
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 2, justifyContent: 'center' }}
              >
                💾 Save Invoice
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
