// Route Configuration File for CA·OS

export const ROUTES = {
  dashboard: '/',
  banking: '/banking',
  clients: '/clients',
  clientProfile: (id: string) => `/clients/${id}`,
  invoices: '/billing',
  documents: '/documents',
  ledger: '/ledger',
  expenses: '/expenses',
  gst: '/gst',
  gstGstr3b: '/gst/gstr-3b',
  gstHistory: '/gst/history',
  gstReconciliation: '/gst/gstr-2b-reconciliation',
  itr: '/itr',
  compliance: '/compliance',
  risk: '/risk',
  riskReport: '/risk/vendor-report',
  insights: '/insights',
  tasks: '/tasks',
  litigation: '/litigation',
  payroll: '/payroll',
  secretarial: '/secretarial',
  collaboration: '/collaboration',
  admin: '/admin',
  reports: '/reports',
  settings: '/settings',
  copilot: '/copilot',
};

export type AppRoute = keyof typeof ROUTES | string;

// Helper to determine if a route is allowed for a given role (RBAC)
export function isRouteAllowed(route: string, role: string): boolean {
  const path = route.split('?')[0];
  
  if (role === 'CA/Partner' || role === 'Admin') {
    return true; // Admin and Partner have full access
  }

  if (role === 'Staff/Article') {
    // Staff cannot access admin/security configurations and risk audit workbench
    if (path.startsWith('/admin') || path.startsWith('/risk')) {
      return false;
    }
    return true;
  }

  if (role === 'Client') {
    // Client can see dashboard, documents, compliance calendar, tasks, collaboration, settings, billing, and insights
    const allowedPaths = [
      '/',
      '/documents',
      '/compliance',
      '/tasks',
      '/collaboration',
      '/settings',
      '/billing',
      '/insights',
    ];
    return allowedPaths.some(p => p === path || (p !== '/' && path.startsWith(p)));
  }

  return false;
}
