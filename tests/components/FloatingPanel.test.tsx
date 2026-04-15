import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FloatingPanel } from '../../src/panel/components/FloatingPanel';
import { bridge } from '../../src/content/bridge';
import type { PageContext } from '../../src/shared/types';

// Mock extpay to avoid browser-polyfill error in jsdom
vi.mock('extpay', () => ({
  default: () => ({
    startBackground: vi.fn(),
    openPaymentPage: vi.fn(),
    getUser: vi.fn().mockResolvedValue({ paid: false, email: null }),
    onPaid: { addListener: vi.fn() },
  }),
}));

// Mock LicenseContext to avoid chrome.storage calls
vi.mock('../../src/panel/contexts/LicenseContext', () => ({
  LicenseProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useLicense: () => ({ paid: false, email: '', openPaymentPage: vi.fn() }),
}));

// chrome.runtime.getURL not available in jsdom
// chrome.storage.local needed by StatusCard's getProToken (returns null → Pro overlay)
vi.stubGlobal('chrome', {
  runtime: { getURL: (p: string) => `chrome-extension://fake/${p}` },
  storage: {
    local: {
      get: (_keys: string[], cb: (result: Record<string, unknown>) => void) => cb({}),
    },
  },
});

function makeCtx(overrides: Partial<PageContext> = {}): PageContext {
  return {
    username: 'alice',
    subreddit: 'javascript',
    pageType: 'feed',
    postComposerOpen: false,
    postId: null,
    url: 'https://www.reddit.com/r/javascript/',
    detectedAt: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('v1:meta:installed', '1'); // not first install
  bridge._reset();
  vi.restoreAllMocks();
});

describe('FloatingPanel', () => {
  it('shows first-install welcome when not yet installed', () => {
    localStorage.clear(); // no v1:meta:installed
    render(<FloatingPanel />);
    expect(screen.getByText(/welcome to r3/i)).toBeInTheDocument();
  });

  it('collapses and expands panel body on toggle', async () => {
    render(<FloatingPanel />);
    act(() => { bridge.emit(makeCtx()); });

    const toggle = screen.getByRole('button', { name: /collapse/i });
    await userEvent.click(toggle);
    expect(screen.queryByText(/subreddit rules/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /expand/i }));
    expect(screen.getByText(/subreddit rules/i)).toBeInTheDocument();
  });

  it('shows full panel on feed pageType', () => {
    render(<FloatingPanel />);
    act(() => { bridge.emit(makeCtx({ pageType: 'feed' })); });
    expect(screen.getByText(/subreddit rules/i)).toBeInTheDocument();
    expect(screen.getByText(/account risk/i)).toBeInTheDocument();
    expect(screen.getByText(/post removal detection/i)).toBeInTheDocument();
    expect(screen.getByText(/my notes/i)).toBeInTheDocument();
  });

  it('shows minimal panel on other pageType', () => {
    render(<FloatingPanel />);
    act(() => { bridge.emit(makeCtx({ pageType: 'other', subreddit: null })); });
    expect(screen.getByText(/no subreddit detected/i)).toBeInTheDocument();
    expect(screen.queryByText(/subreddit rules/i)).not.toBeInTheDocument();
  });

  it('shows minimal panel on profile pageType', () => {
    render(<FloatingPanel />);
    act(() => { bridge.emit(makeCtx({ pageType: 'profile', subreddit: null })); });
    expect(screen.queryByText(/subreddit rules/i)).not.toBeInTheDocument();
  });

  it('promotes RiskCard on submit pageType', () => {
    render(<FloatingPanel />);
    act(() => { bridge.emit(makeCtx({ pageType: 'submit' })); });
    // RiskCard should appear before RulesBlock in submit mode
    const headings = screen.getAllByText(/account risk|subreddit rules/i);
    expect(headings[0]).toHaveTextContent(/account risk/i);
  });
});
