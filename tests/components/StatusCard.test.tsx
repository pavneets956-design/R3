import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { StatusCard } from '../../src/panel/components/StatusCard';
import * as backendClient from '../../src/panel/api/backendClient';

vi.mock('../../src/panel/api/backendClient', () => ({
  getProToken: vi.fn(),
  fetchPostStatus: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
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
