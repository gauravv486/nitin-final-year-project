import type { LucideIcon } from 'lucide-react'
import {
  BadgeIndianRupee,
  BookOpenCheck,
  CalendarClock,
  ChartColumn,
  FileStack,
  FileText,
  Gavel,
  LayoutDashboard,
  MessagesSquare,
  Receipt,
  ScanSearch,
  Scale,
  Settings,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react'

export type Role = 'partner' | 'staff' | 'client'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  roles: Role[]
  /** Module number from CA_OS_SPECIFICATION.md. */
  module: number
  description: string
}

export interface NavGroup {
  /** One of the five product layers. */
  layer: string
  items: NavItem[]
}

/**
 * All sixteen modules, grouped by the five operating-system layers from the
 * specification. A flat sixteen-item rail is unreadable; the layer grouping is
 * the project's own framing and carries the count.
 *
 * NOTE: `roles` drives sidebar visibility only. Real authorisation belongs on
 * the server — a client-side array is never a security boundary.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    layer: 'Practice',
    items: [
      {
        href: '/dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        roles: ['partner', 'staff', 'client'],
        module: 1,
        description: 'Firm-wide position across clients, filings and deadlines',
      },
      {
        href: '/clients',
        label: 'Clients',
        icon: Users,
        roles: ['partner', 'staff'],
        module: 2,
        description: 'Registrations, contacts and engagement status',
      },
      {
        href: '/onboarding',
        label: 'Onboarding',
        icon: UserPlus,
        roles: ['partner', 'staff'],
        module: 2,
        description: 'PAN and GSTIN lookup, engagement letter drafting',
      },
      {
        href: '/documents',
        label: 'Documents',
        icon: FileText,
        roles: ['partner', 'staff', 'client'],
        module: 3,
        description: 'Upload invoices and statements, review extracted fields',
      },
      {
        href: '/bookkeeping',
        label: 'Bookkeeping',
        icon: BookOpenCheck,
        roles: ['partner', 'staff'],
        module: 4,
        description: 'Ledger mapping, expense categories, trial balance',
      },
      {
        href: '/collaboration',
        label: 'Collaboration',
        icon: MessagesSquare,
        roles: ['partner', 'staff', 'client'],
        module: 13,
        description: 'Client threads, approvals and billing notes',
      },
    ],
  },
  {
    layer: 'Compliance',
    items: [
      {
        href: '/gst',
        label: 'GST & reconciliation',
        icon: Scale,
        roles: ['partner', 'staff'],
        module: 5,
        description: 'Match GSTR-2B against books and resolve mismatches',
      },
      {
        href: '/income-tax',
        label: 'Income tax & AIS',
        icon: BadgeIndianRupee,
        roles: ['partner', 'staff'],
        module: 6,
        description: 'AIS and TIS matched against book entries',
      },
      {
        href: '/notices',
        label: 'Notices & litigation',
        icon: Gavel,
        roles: ['partner', 'staff'],
        module: 7,
        description: 'Notice parsing, case law search, response drafting',
      },
      {
        href: '/payroll',
        label: 'Payroll & statutory',
        icon: Receipt,
        roles: ['partner', 'staff'],
        module: 9,
        description: 'PF, ESI and professional tax with payslips',
      },
      {
        href: '/secretarial',
        label: 'Secretarial (ROC)',
        icon: FileStack,
        roles: ['partner', 'staff'],
        module: 10,
        description: 'Board resolutions, minutes and MCA e-form tracking',
      },
      {
        href: '/compliance',
        label: 'Compliance calendar',
        icon: CalendarClock,
        roles: ['partner', 'staff', 'client'],
        module: 11,
        description: 'Statutory calendar and assigned filing tasks',
      },
    ],
  },
  {
    layer: 'Intelligence',
    items: [
      {
        href: '/copilot',
        label: 'Copilot',
        icon: Sparkles,
        roles: ['partner', 'staff'],
        module: 12,
        description: 'Ask questions about your own ledger data',
      },
      {
        href: '/risk',
        label: 'Risk & audit',
        icon: ScanSearch,
        roles: ['partner'],
        module: 8,
        description: 'Transaction risk scoring and Benford distribution checks',
      },
    ],
  },
  {
    layer: 'Administration',
    items: [
      {
        href: '/security',
        label: 'Security & access',
        icon: ShieldCheck,
        roles: ['partner'],
        module: 14,
        description: 'Roles, consent records and the audit log',
      },
      {
        href: '/reports',
        label: 'Reports & export',
        icon: ChartColumn,
        roles: ['partner', 'staff'],
        module: 16,
        description: 'Aggregated reporting, scheduled and signed exports',
      },
      {
        href: '/settings',
        label: 'Settings',
        icon: Settings,
        roles: ['partner', 'staff', 'client'],
        module: 15,
        description: 'Firm profile, branding, integrations and workflow',
      },
    ],
  },
]

/** Flat list, for lookups. */
export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items)

export function navForRole(role: Role): NavGroup[] {
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.roles.includes(role)),
  })).filter((g) => g.items.length > 0)
}

/** Marketing nav — five links, matching the reference. */
export const MARKETING_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#glance', label: 'About' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQs' },
  { href: '#contact', label: 'Contact' },
]
