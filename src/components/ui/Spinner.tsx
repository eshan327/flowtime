export function Spinner() {
  return (
    <span
      aria-label="Loading"
      className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-surface-border border-t-ink-primary"
      role="status"
    />
  )
}
