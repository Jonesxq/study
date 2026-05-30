export function TagPill({ name }: { name: string }) {
  return (
    <span className="inline-flex rounded-full border border-[var(--line)] px-2.5 py-1 text-xs text-[var(--muted)]">
      {name}
    </span>
  );
}
