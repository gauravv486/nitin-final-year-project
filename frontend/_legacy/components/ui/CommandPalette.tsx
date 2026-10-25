'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface CommandItem {
  id: string;
  category: 'Modules' | 'Clients' | 'Invoices' | 'Tasks' | 'Recent';
  label: string;
  shortcut?: string;
  route: string;
  icon?: string;
}

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([
    'Arora Trading Co.',
    'GSTR-3B Filing',
    'INV-2026-002',
  ]);

  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Command database
  const commands: CommandItem[] = [
    // Modules
    { id: 'm-dash', category: 'Modules', label: 'Go to Dashboard', route: '/', icon: '📊' },
    { id: 'm-cli', category: 'Modules', label: 'Go to Client Management', route: '/clients', icon: '👥' },
    { id: 'm-inv', category: 'Modules', label: 'Go to Billing & Invoices', route: '/billing', icon: '📄' },
    { id: 'm-doc', category: 'Modules', label: 'Go to Document Portal', route: '/documents', icon: '📁' },
    { id: 'm-led', category: 'Modules', label: 'Go to Auto Ledger Mapping', route: '/ledger', icon: '📋' },
    { id: 'm-exp', category: 'Modules', label: 'Go to Expense Categorization', route: '/expenses', icon: '💰' },
    { id: 'm-gst', category: 'Modules', label: 'Go to GST Reconciliation', route: '/gst', icon: '💳' },
    { id: 'm-itr', category: 'Modules', label: 'Go to Income Tax Return (ITR)', route: '/itr', icon: '📈' },
    { id: 'm-comp', category: 'Modules', label: 'Go to Compliance Calendar', route: '/compliance', icon: '📅' },
    { id: 'm-risk', category: 'Modules', label: 'Go to Risk Scoring & Audit', route: '/risk', icon: '⚠️' },
    { id: 'm-task', category: 'Modules', label: 'Go to Compliance Tasks', route: '/tasks', icon: '✓' },
    { id: 'm-lit', category: 'Modules', label: 'Go to Notice & Litigation', route: '/litigation', icon: '⚖️' },
    { id: 'm-pay', category: 'Modules', label: 'Go to Payroll Console', route: '/payroll', icon: '💸' },
    { id: 'm-sec', category: 'Modules', label: 'Go to Corporate Secretarial', route: '/secretarial', icon: '💼' },
    { id: 'm-col', category: 'Modules', label: 'Go to Collaboration Hub', route: '/collaboration', icon: '💬' },
    { id: 'm-rep', category: 'Modules', label: 'Go to Reports & Exports', route: '/reports', icon: '📊' },
    { id: 'm-set', category: 'Modules', label: 'Go to Settings Control', route: '/settings', icon: '⚙️' },
    
    // Clients
    { id: 'c-arora', category: 'Clients', label: 'Arora Trading Co. (GSTIN: 27AAACA1234F1Z5)', route: '/clients/1', icon: '👤' },
    { id: 'c-mehta', category: 'Clients', label: 'Mehta Enterprises (GSTIN: 27AABCM5678G1Z2)', route: '/clients/2', icon: '👤' },
    { id: 'c-gupta', category: 'Clients', label: 'Gupta Pvt Ltd (GSTIN: 27AADCG9012H1Z3)', route: '/clients/3', icon: '👤' },
    { id: 'c-sharma', category: 'Clients', label: 'Sharma Foods (GSTIN: 27AACCS3456J1Z4)', route: '/clients/4', icon: '👤' },
    
    // Invoices
    { id: 'i-inv001', category: 'Invoices', label: 'INV-2026-001 (Arora Trading) - ₹45,000', route: '/billing?id=1', icon: '📄' },
    { id: 'i-inv002', category: 'Invoices', label: 'INV-2026-002 (Mehta Enterprises) - ₹78,500', route: '/billing?id=2', icon: '📄' },
    { id: 'i-inv003', category: 'Invoices', label: 'INV-2026-003 (Gupta Pvt Ltd) - ₹125,000', route: '/billing?id=3', icon: '📄' },
    
    // Tasks
    { id: 't-t1', category: 'Tasks', label: 'GSTR-3B Filing - May 2026', route: '/tasks?id=1', icon: '✓' },
    { id: 't-t2', category: 'Tasks', label: 'TDS Deposit Q1', route: '/tasks?id=2', icon: '✓' },
    { id: 't-t3', category: 'Tasks', label: 'PF Payment - June', route: '/tasks?id=3', icon: '✓' },
  ];

  // Listen to keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Autofocus input
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      setSelectedIndex(0);
      setSearchQuery('');
    }
  }, [isOpen]);

  // Handle keyboard list navigation
  const filtered = searchQuery.trim() === ''
    ? commands.filter(c => c.category === 'Modules' || c.category === 'Recent')
    : commands.filter(c => 
        c.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.category.toLowerCase().includes(searchQuery.toLowerCase())
      );

  useEffect(() => {
    // Scroll selected item into view inside palette container
    if (resultsRef.current) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleSelect = (item: CommandItem) => {
    // Add to recent searches
    if (!recentSearches.includes(item.label) && item.category !== 'Modules') {
      setRecentSearches([item.label, ...recentSearches.slice(0, 4)]);
    }
    
    router.push(item.route);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        handleSelect(filtered[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={() => setIsOpen(false)}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        background: 'rgba(27, 58, 107, 0.35)',
        backdropFilter: 'blur(10px)',
        paddingTop: '10vh',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '580px',
          background: 'var(--bg-white)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '440px',
          animation: 'slideUp 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border-color)', padding: '14px 18px', gap: '12px' }}>
          <span style={{ fontSize: '18px' }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a module name or search client..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              background: 'none',
              fontSize: '15px',
              fontFamily: 'inherit',
              color: 'var(--text-primary)',
            }}
          />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 6px', background: 'var(--bg-gray)' }}>ESC</span>
        </div>

        {/* Results */}
        <div
          ref={resultsRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 0',
          }}
        >
          {filtered.length > 0 ? (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 18px',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--bg-gray)' : 'none',
                    borderLeft: isSelected ? '3px solid var(--primary)' : '3px solid transparent',
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '16px' }}>{item.icon}</span>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{item.label}</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{item.category}</div>
                    </div>
                  </div>
                  {item.shortcut && (
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{item.shortcut}</span>
                  )}
                </div>
              );
            })
          ) : (
            <div style={{ padding: '24px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13.5px' }}>
              No matches found for &quot;{searchQuery}&quot;
            </div>
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
          <div>
            <span>Press </span>
            <kbd style={{ padding: '1px 4px', border: '1px solid var(--border-color)', borderRadius: '3px', background: 'var(--bg-white)', marginRight: '4px' }}>↑↓</kbd>
            <span> to navigate</span>
            <span style={{ margin: '0 8px' }}>•</span>
            <kbd style={{ padding: '1px 4px', border: '1px solid var(--border-color)', borderRadius: '3px', background: 'var(--bg-white)', marginRight: '4px' }}>Enter</kbd>
            <span> to select</span>
          </div>
          <div>
            <span>Ctrl + K to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
