import { Suspense } from 'react';
import AppContent from '../app-content';

// Next.js App Router catch-all component
export default function CatchAllPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-light)', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '32px', animation: 'spin 1.5s linear infinite' }}>🔄</div>
          <div style={{ fontSize: '14px', fontWeight: '600' }}>Loading CA·OS Command Center...</div>
        </div>
      </div>
    }>
      <AppContent />
    </Suspense>
  );
}
