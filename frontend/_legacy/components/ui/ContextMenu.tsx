'use client';

import React, { useEffect, useRef } from 'react';

interface ContextMenuAction {
  label: string;
  action: () => void;
  icon?: string;
}

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  actions: ContextMenuAction[];
}

export default function ContextMenu({ x, y, onClose, actions }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    
    // Add event listener with delay to prevent immediate closing during right click trigger
    const timeoutId = setTimeout(() => {
      window.addEventListener('click', handleOutsideClick);
      window.addEventListener('contextmenu', handleOutsideClick);
    }, 50);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('contextmenu', handleOutsideClick);
    };
  }, [onClose]);

  // Adjust menu coordinates so it doesn't render off-screen
  const adjustCoordinates = () => {
    if (typeof window === 'undefined') return { left: x, top: y };
    
    const menuWidth = 180;
    const menuHeight = actions.length * 36 + 10;
    
    let left = x;
    let top = y;
    
    if (x + menuWidth > window.innerWidth) {
      left = window.innerWidth - menuWidth - 10;
    }
    if (y + menuHeight > window.innerHeight) {
      top = window.innerHeight - menuHeight - 10;
    }
    
    return { left, top };
  };

  const { left, top } = adjustCoordinates();

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        zIndex: 1000,
        background: 'var(--bg-white)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        boxShadow: '0 10px 30px rgba(27, 58, 107, 0.15)',
        padding: '6px 0',
        minWidth: '180px',
        animation: 'fadeIn 0.12s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {actions.map((item, idx) => (
        <button
          key={idx}
          onClick={(e) => {
            e.stopPropagation();
            item.action();
            onClose();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            padding: '8px 14px',
            background: 'none',
            border: 'none',
            textAlign: 'left',
            fontFamily: 'inherit',
            fontSize: '12.5px',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-gray)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none';
          }}
        >
          {item.icon && <span style={{ fontSize: '14px' }}>{item.icon}</span>}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
