export function FlowtimeMark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 32 32">
      <path
        d="M25.4 8.5A12 12 0 1 0 28 16M16 4v12h12M16 16l7.8-7.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.8"
      />
    </svg>
  )
}
