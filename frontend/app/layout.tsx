import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { AuthProvider } from '@/lib/auth'
import './globals.css'

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'CA-OS — Practice operating system for Indian CA firms',
    template: '%s · CA-OS',
  },
  description:
    'Reconcile GSTR-2B against your books, extract fields from client documents, and track every statutory deadline in one workspace built for Indian chartered accountancy practices.',
  metadataBase: new URL('https://ca-os.local'),
}

/* Separate export, per Next 16. No maximumScale / userScalable — blocking
 * pinch-zoom fails WCAG 1.4.4 and the old layout did exactly that. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Browser-chrome colour. Next's metadata API needs a literal here, so this
  // is the one place a hex appears outside tokens.css — it mirrors --paper.
  themeColor: '#f7f9fb',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {/* Sits above both route groups: the marketing pages read `user` to
            swap "Get started" for "Open dashboard", and the app pages gate on
            it. The provider itself renders nothing. */}
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
