/**
 * Tier-B hand-built SVG. The reference carries a judge-and-scales illustration;
 * this is the chartered-accountancy equivalent — a balance weighing a ledger
 * against the portal record, which is literally what the product does.
 *
 * Drawn from scratch in the studied palette. No asset is copied from the
 * reference site, and every fill references a token.
 */
export function HeroIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 440 340"
      className={className}
      role="img"
      aria-label="A balance weighing a ledger of book entries against a portal statement"
    >
      {/* --- Soft ground shapes --------------------------------------------- */}
      <circle cx="330" cy="86" r="76" fill="var(--tint-lilac)" opacity="0.55" />
      <circle cx="96" cy="250" r="58" fill="var(--tint-mint)" opacity="0.5" />
      <rect x="18" y="38" width="118" height="84" rx="26" fill="var(--tint-blue)" />

      {/* --- Column and base ----------------------------------------------- */}
      <rect x="211" y="96" width="18" height="178" rx="9" fill="var(--ink)" />
      <path d="M160 288h120a0 0 0 0 1 0 0v6a10 10 0 0 1-10 10H170a10 10 0 0 1-10-10v-6z" fill="var(--ink)" />
      <rect x="150" y="274" width="140" height="16" rx="8" fill="var(--ink)" />

      {/* Blue collar on the ink column — the one accent fill on the figure */}
      <rect x="203" y="150" width="34" height="14" rx="7" fill="var(--accent)" />

      {/* --- Beam ----------------------------------------------------------- */}
      <rect x="74" y="92" width="292" height="15" rx="7.5" fill="var(--ink)" />
      <circle cx="220" cy="99" r="17" fill="var(--paper-raised)" stroke="var(--ink)" strokeWidth="9" />

      {/* --- Left pan · the books ------------------------------------------- */}
      <path d="M84 107v26" stroke="var(--ink)" strokeWidth="7" strokeLinecap="round" />
      <path
        d="M34 133h100l-18 40a16 16 0 0 1-14 9H66a16 16 0 0 1-14-9l-18-40z"
        fill="var(--tint-blue)"
      />
      <path d="M34 133h100" stroke="var(--ink)" strokeWidth="7" strokeLinecap="round" />

      {/* Ledger sheet resting above the left pan */}
      <g transform="rotate(-7 84 66)">
        <rect
          x="46"
          y="26"
          width="78"
          height="62"
          rx="12"
          fill="var(--paper-raised)"
          stroke="var(--ink)"
          strokeWidth="5"
        />
        <path
          d="M60 46h50M60 57h50M60 68h30"
          stroke="var(--ink-faint)"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
      </g>

      {/* --- Right pan · the portal record ---------------------------------- */}
      <path d="M356 107v26" stroke="var(--ink)" strokeWidth="7" strokeLinecap="round" />
      <path
        d="M306 133h100l-18 40a16 16 0 0 1-14 9h-36a16 16 0 0 1-14-9l-18-40z"
        fill="var(--tint-lilac)"
      />
      <path d="M306 133h100" stroke="var(--ink)" strokeWidth="7" strokeLinecap="round" />

      {/* Portal statement above the right pan, with a matched tick */}
      <g transform="rotate(6 356 66)">
        <rect
          x="318"
          y="24"
          width="76"
          height="62"
          rx="12"
          fill="var(--paper-raised)"
          stroke="var(--ink)"
          strokeWidth="5"
        />
        <path
          d="M332 44h34M332 55h48"
          stroke="var(--ink-faint)"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <circle cx="342" cy="70" r="9" fill="var(--include)" />
        <path
          d="m338 70 3 3 5-6"
          stroke="var(--paper-raised)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>

      {/* --- Mismatch marker: the one row that does not balance ------------- */}
      <g transform="translate(196 196)">
        <rect width="48" height="48" rx="16" fill="var(--paper-raised)" stroke="var(--ink)" strokeWidth="5" />
        <path d="M24 15v15" stroke="var(--ink)" strokeWidth="5.5" strokeLinecap="round" />
        <circle cx="24" cy="36" r="3.2" fill="var(--ink)" />
      </g>
    </svg>
  )
}
