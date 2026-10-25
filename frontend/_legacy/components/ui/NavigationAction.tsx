'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface NavigationActionProps {
  href?: string;
  actionType?: 'navigate' | 'back';
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export default function NavigationAction({
  href,
  actionType = 'navigate',
  children,
  className = '',
  style = {},
  onClick,
}: NavigationActionProps) {
  const router = useRouter();

  if (actionType === 'back') {
    return (
      <button
        onClick={() => {
          if (onClick) onClick();
          router.back();
        }}
        className={`btn btn-secondary btn-sm ${className}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', ...style }}
      >
        <span>←</span>
        {children}
      </button>
    );
  }

  if (href) {
    return (
      <Link href={href} className={className} style={{ textDecoration: 'none', ...style }}>
        {children}
      </Link>
    );
  }

  return (
    <button
      onClick={() => {
        if (onClick) onClick();
      }}
      className={className}
      style={style}
    >
      {children}
    </button>
  );
}
