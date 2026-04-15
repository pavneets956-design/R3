import { render, screen, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { LicenseProvider, useLicense } from '../../src/panel/contexts/LicenseContext';

// Mock chrome APIs
const mockGet = vi.fn();
vi.stubGlobal('chrome', {
  storage: { local: { get: mockGet, set: vi.fn() } },
  runtime: { onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
});

// Mock extpay to avoid chrome storage side effects in tests
vi.mock('extpay', () => ({
  default: () => ({ openPaymentPage: vi.fn() }),
}));

function TestConsumer() {
  const { paid, email } = useLicense();
  return <div data-testid="result">{paid ? `paid:${email}` : 'free'}</div>;
}

describe('LicenseContext', () => {
  beforeEach(() => {
    mockGet.mockReset();
    vi.mocked(chrome.runtime.onMessage.addListener).mockReset();
    vi.mocked(chrome.runtime.onMessage.removeListener).mockReset();
  });

  it('reads paid=false from storage on mount', async () => {
    mockGet.mockResolvedValue({ r3_pro_paid: false, r3_pro_email: '' });
    await act(async () => {
      render(<LicenseProvider><TestConsumer /></LicenseProvider>);
    });
    expect(screen.getByTestId('result').textContent).toBe('free');
  });

  it('reads paid=true and email from storage on mount', async () => {
    mockGet.mockResolvedValue({ r3_pro_paid: true, r3_pro_email: 'user@example.com' });
    await act(async () => {
      render(<LicenseProvider><TestConsumer /></LicenseProvider>);
    });
    expect(screen.getByTestId('result').textContent).toBe('paid:user@example.com');
  });

  it('updates when LICENSE_UPDATED message received', async () => {
    mockGet.mockResolvedValue({ r3_pro_paid: false, r3_pro_email: '' });
    let messageListener: ((msg: unknown) => void) | null = null;
    (chrome.runtime.onMessage.addListener as ReturnType<typeof vi.fn>).mockImplementation(
      (fn: (msg: unknown) => void) => { messageListener = fn; }
    );

    await act(async () => {
      render(<LicenseProvider><TestConsumer /></LicenseProvider>);
    });
    expect(screen.getByTestId('result').textContent).toBe('free');

    await act(async () => {
      messageListener?.({ type: 'LICENSE_UPDATED', paid: true, email: 'new@example.com' });
    });
    expect(screen.getByTestId('result').textContent).toBe('paid:new@example.com');
  });
});
