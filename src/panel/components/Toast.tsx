import { useEffect, useState } from 'react';

/**
 * Shows a "Pro unlocked" toast for 3 seconds after payment completes.
 * Listens for LICENSE_UPDATED message from the service worker.
 */
export function ProUnlockedToast() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) {
      return;
    }

    const handler = (msg: unknown) => {
      if (
        typeof msg === 'object' &&
        msg !== null &&
        (msg as { type: string }).type === 'LICENSE_UPDATED' &&
        (msg as { paid: boolean }).paid
      ) {
        setVisible(true);
        setTimeout(() => setVisible(false), 3000);
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#22c55e',
        color: '#fff',
        padding: '8px 20px',
        borderRadius: 20,
        fontWeight: 600,
        fontSize: 14,
        zIndex: 9999,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}
      role="status"
    >
      ✅ Pro unlocked!
    </div>
  );
}
