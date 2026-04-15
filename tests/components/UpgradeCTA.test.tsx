import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { UpgradeCTA } from '../../src/panel/components/UpgradeCTA';

vi.mock('../../src/panel/contexts/LicenseContext', () => ({
  useLicense: vi.fn(),
}));
import { useLicense } from '../../src/panel/contexts/LicenseContext';

describe('UpgradeCTA', () => {
  it('renders for free users', () => {
    (useLicense as ReturnType<typeof vi.fn>).mockReturnValue({
      paid: false,
      openPaymentPage: vi.fn(),
    });
    render(<UpgradeCTA />);
    expect(screen.getByText(/Unlock Pro/i)).toBeTruthy();
    expect(screen.getByText(/No account/i)).toBeTruthy();
  });

  it('renders nothing for pro users', () => {
    (useLicense as ReturnType<typeof vi.fn>).mockReturnValue({
      paid: true,
      openPaymentPage: vi.fn(),
    });
    const { container } = render(<UpgradeCTA />);
    expect(container.firstChild).toBeNull();
  });

  it('calls openPaymentPage on click', () => {
    const mockOpen = vi.fn();
    (useLicense as ReturnType<typeof vi.fn>).mockReturnValue({
      paid: false,
      openPaymentPage: mockOpen,
    });
    render(<UpgradeCTA />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockOpen).toHaveBeenCalledOnce();
  });
});
