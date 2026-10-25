import type { Metadata } from 'next'
import { CopilotPanel } from './copilot-panel'

export const metadata: Metadata = { title: 'Copilot' }

export default function CopilotPage() {
  return <CopilotPanel />
}
