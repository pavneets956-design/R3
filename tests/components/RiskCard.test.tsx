import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { RiskCard } from '../../src/panel/components/RiskCard';
import * as backendClient from '../../src/panel/api/backendClient';

vi.mock('../../src/panel/api/backendClient', () => ({
  getProToken: vi.fn(),
  fetchRisk: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RiskCard — no token', () => {
  it('shows Pro overlay when token is missing', async () => {
    vi.mocked(backendClient.getProToken).mockResolvedValue(null);
    await act(async () => {
      render(<RiskCard subreddit="javascript" username="testuser" />);
    });
    expect(screen.getByText('Pro')).toBeInTheDocument();
  });

  it('shows sign-in prompt when username is null', async () => {
    vi.mocked(backendClient.getProToken).mockResolvedValue('dev-token-phase2');
    await act(async () => {
      render(<RiskCard subreddit="javascript" username={null} />);
    });
    expect(screen.getByText(/sign in/i)).toBeInTheDocument();
  });
});

describe('RiskCard — loading', () => {
  it('shows loading state while fetching', async () => {
    vi.mocked(backendClient.getProToken).mockResolvedValue('dev-token-phase2');
    vi.mocked(backendClient.fetchRisk).mockReturnValue(new Promise(() => {}));
    await act(async () => {
      render(<RiskCard subreddit="javascript" username="testuser" />);
    });
    expect(screen.getByText(/analyzing/i)).toBeInTheDocument();
  });
});

describe('RiskCard — success', () => {
  it('shows low risk level', async () => {
    vi.mocked(backendClient.getProToken).mockResolvedValue('dev-token-phase2');
    vi.mocked(backendClient.fetchRisk).mockResolvedValue({
      subreddit: 'javascript',
      username: 'testuser',
      risk_level: 'low',
      confidence: 'high',
      factors: [],
      recommendation: 'Low removal risk.',
      cached: false,
    });
    await act(async () => {
      render(<RiskCard subreddit="javascript" username="testuser" />);
    });
    expect(screen.getAllByText(/low/i)[0]).toBeInTheDocument();
  });

  it('shows high risk with factors', async () => {
    vi.mocked(backendClient.getProToken).mockResolvedValue('dev-token-phase2');
    vi.mocked(backendClient.fetchRisk).mockResolvedValue({
      subreddit: 'javascript',
      username: 'newuser',
      risk_level: 'high',
      confidence: 'medium',
      factors: [
        { type: 'karma', impact: 'high', message: 'Karma too low.' },
      ],
      recommendation: 'High removal risk.',
      cached: false,
    });
    await act(async () => {
      render(<RiskCard subreddit="javascript" username="newuser" />);
    });
    expect(screen.getAllByText(/high/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/karma too low/i)).toBeInTheDocument();
  });
});

describe('RiskCard — error', () => {
  it('shows error message on service failure', async () => {
    vi.mocked(backendClient.getProToken).mockResolvedValue('dev-token-phase2');
    vi.mocked(backendClient.fetchRisk).mockRejectedValue(new Error('RISK_ERROR:503'));
    await act(async () => {
      render(<RiskCard subreddit="javascript" username="testuser" />);
    });
    expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
  });
});
