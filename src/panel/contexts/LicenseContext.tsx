import ExtPay from 'extpay';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

const extpay = ExtPay('r3--reddit-rules-enforcer');

interface LicenseContextValue {
  paid: boolean;
  email: string;
  openPaymentPage: () => void;
}

const LicenseContext = createContext<LicenseContextValue>({
  paid: false,
  email: '',
  openPaymentPage: () => {},
});

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [paid, setPaid] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    // Read cached state from storage on mount (instant, no flicker)
    chrome.storage.local
      .get(['r3_pro_paid', 'r3_pro_email'])
      .then((result) => {
        if (result['r3_pro_paid']) {
          setPaid(true);
          setEmail((result['r3_pro_email'] as string) ?? '');
        }
      })
      .catch((err) => console.error('[R3] LicenseContext storage read error:', err));

    // Listen for SW messages when payment completes mid-session
    const msgHandler = (msg: unknown) => {
      if (
        typeof msg === 'object' &&
        msg !== null &&
        (msg as { type: string }).type === 'LICENSE_UPDATED'
      ) {
        const { paid: newPaid, email: newEmail } = msg as { paid: boolean; email?: string };
        setPaid(newPaid);
        setEmail(newEmail ?? '');
      }
    };
    chrome.runtime.onMessage.addListener(msgHandler);

    // Also watch storage directly — catches revocations from the alarm-based
    // re-validation and any other writes to license keys.
    const storageHandler = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area !== 'local') return;
      if (changes['r3_pro_paid']) setPaid(!!changes['r3_pro_paid'].newValue);
      if (changes['r3_pro_email']) setEmail((changes['r3_pro_email'].newValue as string) ?? '');
    };
    chrome.storage.onChanged.addListener(storageHandler);

    return () => {
      chrome.runtime.onMessage.removeListener(msgHandler);
      chrome.storage.onChanged.removeListener(storageHandler);
    };
  }, []);

  return (
    <LicenseContext.Provider
      value={{ paid, email, openPaymentPage: () => extpay.openPaymentPage() }}
    >
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicense() {
  return useContext(LicenseContext);
}
