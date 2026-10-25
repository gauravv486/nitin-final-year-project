'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface ClickableWidgetProps {
  children: React.ReactNode;
  targetRoute: string;
  filters?: Record<string, string>;
  className?: string;
  style?: React.CSSProperties;
}

export default function ClickableWidget({
  children,
  targetRoute,
  filters = {},
  className = '',
  style = {},
}: ClickableWidgetProps) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    // Avoid double navigation if interactive elements inside the widget are clicked
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'BUTTON' || 
      target.tagName === 'A' || 
      target.tagName === 'INPUT' || 
      target.tagName === 'SELECT' || 
      target.tagName === 'OPTION' || 
      target.closest('.interactive-ignore')
    ) {
      return;
    }

    const queryParams = new URLSearchParams(filters).toString();
    const href = `${targetRoute}${queryParams ? `?${queryParams}` : ''}`;
    router.push(href);
  };

  return (
    <div
      onClick={handleClick}
      className={`card clickable-widget-hover ${className}`}
      style={{
        cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
