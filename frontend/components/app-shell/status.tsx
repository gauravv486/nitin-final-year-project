import { CircleAlert, CircleCheck, CircleDashed, Clock } from 'lucide-react'
import {
  docStatus,
  filing,
  journal,
  match,
  noticeStatus,
  payrollStatus,
  riskStatus,
  severity,
  threadStatus,
  type DocumentStatus,
  type FilingStatus,
  type JournalStatus,
  type MatchStatus,
  type NoticeStatus,
  type PayrollStatus,
  type RiskSeverity,
  type RiskStatus,
  type ThreadStatus,
} from '@/lib/enums'
import { Badge } from '@/components/ui/surface'

const filingIcon: Record<FilingStatus, typeof Clock> = {
  NOT_STARTED: CircleDashed,
  PENDING: CircleDashed,
  IN_PROGRESS: Clock,
  FILED: CircleCheck,
  OVERDUE: CircleAlert,
}

export function FilingBadge({ status }: { status: FilingStatus | null }) {
  const Icon = status ? (filingIcon[status] ?? CircleDashed) : CircleDashed
  return (
    <Badge tone={filing.tone(status)}>
      <Icon aria-hidden className="size-3.5" />
      {filing.label(status)}
    </Badge>
  )
}

export function MatchBadge({ status }: { status: MatchStatus }) {
  return (
    <Badge tone={match.tone(status)}>
      {status === 'MATCHED' ? (
        <CircleCheck aria-hidden className="size-3.5" />
      ) : (
        <CircleAlert aria-hidden className="size-3.5" />
      )}
      {match.label(status)}
    </Badge>
  )
}

export function DocBadge({ status }: { status: DocumentStatus }) {
  return <Badge tone={docStatus.tone(status)}>{docStatus.label(status)}</Badge>
}

export function JournalBadge({ status }: { status: JournalStatus }) {
  return <Badge tone={journal.tone(status)}>{journal.label(status)}</Badge>
}

export function SeverityBadge({ level }: { level: RiskSeverity }) {
  return <Badge tone={severity.tone(level)}>{severity.label(level)}</Badge>
}

export function RiskBadge({ status }: { status: RiskStatus }) {
  return <Badge tone={riskStatus.tone(status)}>{riskStatus.label(status)}</Badge>
}

export function NoticeBadge({ status }: { status: NoticeStatus }) {
  return <Badge tone={noticeStatus.tone(status)}>{noticeStatus.label(status)}</Badge>
}

export function PayrollBadge({ status }: { status: PayrollStatus }) {
  return <Badge tone={payrollStatus.tone(status)}>{payrollStatus.label(status)}</Badge>
}

export function ThreadBadge({ status }: { status: ThreadStatus }) {
  return <Badge tone={threadStatus.tone(status)}>{threadStatus.label(status)}</Badge>
}

/** Days-to-due, coloured by urgency. `days` is `days_left` from the API. */
export function DueIn({ days }: { days: number | null }) {
  if (days === null) return <span className="text-xs text-ink-muted">—</span>
  const tone = days < 0 ? 'text-risk' : days <= 7 ? 'text-warn' : 'text-ink-muted'
  return (
    <span className={`block text-xs ${tone}`}>
      {days < 0
        ? `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`
        : days === 0
          ? 'Due today'
          : `in ${days} day${days === 1 ? '' : 's'}`}
    </span>
  )
}
