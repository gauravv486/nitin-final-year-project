import type { Metadata } from 'next'
import { ReconciliationWorklist } from './worklist'

export const metadata: Metadata = { title: 'GST reconciliation' }

export default function GstPage() {
  return <ReconciliationWorklist />
}
