import { ChevronDown } from 'lucide-react'
import { Section, SectionHead } from '@/components/ui/surface'

/* Eight questions, matching the reference's count. Answered like a person. Where
 * the honest answer is "not yet", it says so — a FAQ that claims everything
 * works is not a FAQ. */
const QA = [
  {
    q: 'Does CA-OS file returns on the GST portal for me?',
    a: 'No. It prepares, reconciles and tracks; the filing itself still happens on the government portal. Automated filing requires GSP authorisation, which is out of scope for this build.',
  },
  {
    q: 'Where does the GSTR-2B data come from?',
    a: 'You import the JSON or Excel you already download from the portal for the period. There is no live portal connection — that needs a GSP licence too.',
  },
  {
    q: 'How accurate is the invoice reading?',
    a: 'It depends on the document. Clean PDF invoices extract reliably; a phone photograph of a creased paper bill does not. Every field carries a confidence score, and anything under the threshold goes to review rather than being saved silently.',
  },
  {
    q: 'Can my clients log in and see their own data?',
    a: 'Yes. The client role sees their documents, their deadlines and their own filings — and nothing belonging to any other client. Access is enforced on the server, per firm and per client.',
  },
  {
    q: 'Is data isolated between firms?',
    a: 'Every record carries a firm identifier and every query is scoped to the signed-in user’s firm at the database layer, not in the browser. Actions touching client data are written to an append-only audit log.',
  },
  {
    q: 'What does the AI actually do?',
    a: 'Three things: it reads fields off uploaded documents, it suggests ledger classifications with a confidence score, and it answers questions about your own data. It does not give tax advice, and it will say when it cannot answer rather than guessing.',
  },
  {
    q: 'Can we use our own branding?',
    a: 'On the Enterprise tier, yes — firm name, logo and the client-facing portal colours. The settings module carries a live preview.',
  },
  {
    q: 'Which modules are built today?',
    a: 'All sixteen have a working interface. They run on placeholder data: the backend, the database and authentication are the next phase, and nothing in the product pretends otherwise.',
  },
]

export function Faq() {
  return (
    <Section id="faq" className="scroll-mt-16">
      <div className="shell">
        <SectionHead title="FAQs" />

        <div className="mt-10 overflow-hidden rounded-card-lg border border-hairline bg-paper-raised">
          {QA.map((item, i) => (
            <details key={item.q} className={i > 0 ? 'border-t border-hairline' : undefined}>
              <summary
                className={[
                  'press flex cursor-pointer list-none items-center justify-between gap-4',
                  'px-5 py-4 text-left text-base font-medium text-ink sm:px-7',
                  'hover:bg-accent-wash [&::-webkit-details-marker]:hidden',
                ].join(' ')}
              >
                <span className="min-w-0">{item.q}</span>
                <ChevronDown aria-hidden className="chevron size-4 shrink-0 text-ink-muted" />
              </summary>
              <p className="measure px-5 pb-5 text-sm text-ink-secondary sm:px-7">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  )
}
