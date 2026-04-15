import { useLicense } from '../contexts/LicenseContext';

/**
 * Single persistent upgrade bar. Only renders for free users.
 * Pinned to panel footer — one CTA for the whole panel.
 */
export function UpgradeCTA() {
  const { paid, openPaymentPage } = useLicense();
  if (paid) return null;

  return (
    <div
      style={{
        padding: '10px 16px',
        borderTop: '1px solid #e5e7eb',
        background: '#f9fafb',
        textAlign: 'center',
      }}
    >
      <button
        onClick={openPaymentPage}
        style={{
          background: '#ff4500',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          padding: '8px 20px',
          fontWeight: 700,
          fontSize: 14,
          cursor: 'pointer',
          width: '100%',
        }}
      >
        🔓 Unlock Pro — $5 one-time
      </button>
      <p style={{ margin: '6px 0 0', fontSize: 11, color: '#6b7280' }}>
        No account. No subscription. Pay once.
      </p>
    </div>
  );
}
