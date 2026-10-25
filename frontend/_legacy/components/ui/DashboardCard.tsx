'use client';

import React from 'react';
import Link from 'next/link';

interface DashboardCardProps {
  title: string;
  value: string | number;
  targetRoute: string;
  filters?: Record<string, string>;
  icon: string;
  permission?: string[];
  changeText?: string;
  changeType?: 'up' | 'down' | string;
  colorClass?: 'indigo' | 'green' | 'amber' | 'red' | string;
  userRole: string;
}

export default function DashboardCard({
  title,
  value,
  targetRoute,
  filters = {},
  icon,
  permission,
  changeText,
  changeType = 'up',
  colorClass = 'indigo',
  userRole,
}: DashboardCardProps) {
  // Check if role has access
  const hasAccess = !permission || permission.includes(userRole);

  // Construct URL with search parameters
  const queryParams = new URLSearchParams(filters).toString();
  const href = `${targetRoute}${queryParams ? `?${queryParams}` : ''}`;

  const cardContent = (
    <div className={`metric ${colorClass} interactive ${!hasAccess ? 'locked' : ''}`}>
      <div className={`metric-icon ${colorClass}`}>
        {!hasAccess ? '🔒' : icon}
      </div>
      <div className="metric-label">{title}</div>
      <div className="metric-value">
        {!hasAccess ? 'Access Restricted' : value}
      </div>
      {changeText && (
        <div className={`metric-change ${changeType === 'down' ? 'down' : 'up'}`}>
          {changeText}
        </div>
      )}
      {!hasAccess && (
        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Requires {permission?.join('/')} role
        </div>
      )}
    </div>
  );

  if (!hasAccess) {
    return (
      <div onClick={() => alert(`Access Denied: Your role "${userRole}" does not have permissions to view this module.`)} style={{ cursor: 'not-allowed' }}>
        {cardContent}
      </div>
    );
  }

  return (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
      {cardContent}
    </Link>
  );
}
