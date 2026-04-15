interface ProLockProps {
  label: string;
}

/**
 * Renders a blurred placeholder row with a lock icon.
 * Used inside free-tier cards to indicate locked Pro fields.
 */
export function ProLock({ label }: ProLockProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.6 }}>
      <span aria-hidden="true">🔒</span>
      <span
        style={{
          filter: 'blur(4px)',
          userSelect: 'none',
          flex: 1,
          backgroundColor: '#e5e7eb',
          borderRadius: 4,
          height: 16,
        }}
        aria-label={`${label} — Pro only`}
      />
    </div>
  );
}
