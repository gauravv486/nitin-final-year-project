'use client';

import { ReactNode } from 'react';
import { ThemeProvider } from './theme-context';
import { AuthProvider } from './auth-context';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}
