import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { StatusCard } from '../../src/panel/components/StatusCard';
import * as backendClient from '../../src/panel/api/backendClient';

vi.mock('../../src/panel/api/backendClient', () => ({
  getProToken: vi.fn(),
  fetchPostStatus: vi.fn(),
}));

vi.mock('../../src/panel/contexts/LicenseContext', () => ({
  useLicense: vi.fn(),
}));
import { useLicense } from '../../src/panel/contexts/LicenseContext';

beforeEach(() => {
  vi.clearAllMocks();
  // Default to paid=true so existing Pro-tier tests work without per-test setup
  (useLicense as ReturnType<typeof vi.fn>).mockReturnValue({ paid: true, email: 'user@example.com' });
});

describe('StatusCard — no token', () => {
  it('shows Pro overlay when token is missing', async () => {
    vi.mocked(backendClient.getProToken).mockResolvedValue(null);
    await act(async () => {
      render(<StatusCard postId="abc123" username="user1" subreddit="learnprogramming" />);
    });
    expect(screen.getByText('Pro')).toBeInTheDocument();
  });
});

describe('StatusCard — no post ID', () => {
  it('shows submission prompt when postId is null', async () => {
    vi.mocked(backendClient.getProToken).mockResolvedValue('dev-token-phase2');
    await act(async () => {
      render(<StatusCard postId={null} username="user1" subreddit="learnprogramming" />);
    });
    expect(screen.getByText(/submit a post/i)).toBeInTheDocument();
  });
});

describe('StatusCard — loading', () => {
  it('shows loading state while fetching', async () => {
    vi.mocked(backendClient.getProToken).mockResolvedValue('dev-token-phase2');
    vi.mocked(backendClient.fetchPostStatus).mockReturnValue(new Promise(() => {}));
    await act(async () => {
      render(<StatusCard postId="abc123" username="user1" subreddit="learnprogramming" />);
    });
    expect(screen.getByText(/checking/i)).toBeInTheDocument();
  });
});

describe('StatusCard — success', () => {
  it('shows visible status', async () => {
    vi.mocked(backendClient.getProToken).mockResolvedValue('dev-token-phase2');
    vi.mocked(backendClient.fetchPostStatus).mockResolvedValue({
      post_id: 'abc123',
      subreddit: 'learnprogramming',
      status: 'visible',
      visible_to_public: true,
      reason_hint: null,
      checked_at: '2026-04-14T12:00:00Z',
      cached: false,
    });
    await act(async () => {
      render(<StatusCard postId="abc123" username="user1" subreddit="learnprogramming" />);
    });
    expect(screen.getByText(/visible/i)).toBeInTheDocument();
  });

  it('shows removed status with reason hint', async () => {
    vi.mocked(backendClient.getProToken).mockResolvedValue('dev-token-phase2');
    vi.mocked(backendClient.fetchPostStatus).mockResolvedValue({
      post_id: 'abc123',
      subreddit: 'learnprogramming',
      status: 'removed',
      visible_to_public: false,
      reason_hint: 'missing_from_listing',
      checked_at: '2026-04-14T12:00:00Z',
      cached: false,
    });
    await act(async () => {
      render(<StatusCard postId="abc123" username="user1" subreddit="learnprogramming" />);
    });
    expect(screen.getByText(/removed/i)).toBeInTheDocument();
  });
});

describe('StatusCard — error', () => {
  it('shows service unavailable on error', async () => {
    vi.mocked(backendClient.getProToken).mockResolvedValue('dev-token-phase2');
    vi.mocked(backendClient.fetchPostStatus).mockRejectedValue(new Error('POST_STATUS_ERROR:503'));
    await act(async () => {
      render(<StatusCard postId="abc123" username="user1" subreddit="learnprogramming" />);
    });
    expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
  });
});

describe('StatusCard — free tier', () => {
  it('shows teaser with feature description for free users', () => {
    (useLicense as ReturnType<typeof vi.fn>).mockReturnValue({ paid: false });
    const { getByText } = render(
      <StatusCard postId="abc123" username="testuser" subreddit="python" />
    );
    expect(getByText(/post removal detection/i)).toBeTruthy();
  });

  it('does not call fetchPostStatus for free users', () => {
    (useLicense as ReturnType<typeof vi.fn>).mockReturnValue({ paid: false });
    const spy = vi.spyOn(backendClient, 'fetchPostStatus');
    render(<StatusCard postId="abc123" username="testuser" subreddit="python" />);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('StatusCard — pro tier', () => {
  it('fetches post status for pro users', async () => {
    (useLicense as ReturnType<typeof vi.fn>).mockReturnValue({
      paid: true,
      email: 'user@example.com',
    });
    vi.spyOn(backendClient, 'getProToken').mockResolvedValue('user@example.com');
    vi.spyOn(backendClient, 'fetchPostStatus').mockResolvedValue({
      post_id: 'abc123',
      subreddit: 'python',
      status: 'removed',
      visible_to_public: false,
      reason_hint: 'missing_from_listing',
      checked_at: new Date().toISOString(),
      cached: false,
    });

    const { findByText } = render(
      <StatusCard postId="abc123" username="testuser" subreddit="python" />
    );
    await findByText(/removed/i);
  });
});
