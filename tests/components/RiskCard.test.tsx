import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { RiskCard } from '../../src/panel/components/RiskCard';
import * as redditClient from '../../src/panel/api/redditClient';

vi.mock('../../src/panel/api/redditClient', () => ({
  fetchRisk: vi.fn(),
  fetchRiskSummary: vi.fn(),
}));

vi.mock('../../src/panel/contexts/LicenseContext', () => ({
  useLicense: vi.fn(),
}));
import { useLicense } from '../../src/panel/contexts/LicenseContext';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RiskCard — no username', () => {
  it('shows sign-in prompt when username is null (free)', async () => {
    (useLicense as ReturnType<typeof vi.fn>).mockReturnValue({ paid: false, email: '' });
    await act(async () => {
      render(<RiskCard subreddit="javascript" username={null} />);
    });
    expect(screen.getByText(/log in/i)).toBeInTheDocument();
  });

  it('shows sign-in prompt when username is null (pro)', async () => {
    (useLicense as ReturnType<typeof vi.fn>).mockReturnValue({ paid: true, email: 'test@example.com' });
    await act(async () => {
      render(<RiskCard subreddit="javascript" username={null} />);
    });
    expect(screen.getByText(/log in/i)).toBeInTheDocument();
  });
});

describe('RiskCard — loading', () => {
  it('shows loading state while fetching (free)', async () => {
    (useLicense as ReturnType<typeof vi.fn>).mockReturnValue({ paid: false, email: '' });
    vi.mocked(redditClient.fetchRiskSummary).mockReturnValue(new Promise(() => {}));
    await act(async () => {
      render(<RiskCard subreddit="javascript" username="testuser" />);
    });
    expect(screen.getByText(/checking risk/i)).toBeInTheDocument();
  });

  it('shows loading state while fetching (pro)', async () => {
    (useLicense as ReturnType<typeof vi.fn>).mockReturnValue({ paid: true, email: 'test@example.com' });
    vi.mocked(redditClient.fetchRisk).mockReturnValue(new Promise(() => {}));
    await act(async () => {
      render(<RiskCard subreddit="javascript" username="testuser" />);
    });
    expect(screen.getByText(/checking risk/i)).toBeInTheDocument();
  });
});

describe('RiskCard — success (pro)', () => {
  it('shows low risk level', async () => {
    (useLicense as ReturnType<typeof vi.fn>).mockReturnValue({ paid: true, email: 'test@example.com' });
    vi.mocked(redditClient.fetchRisk).mockResolvedValue({
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
    (useLicense as ReturnType<typeof vi.fn>).mockReturnValue({ paid: true, email: 'test@example.com' });
    vi.mocked(redditClient.fetchRisk).mockResolvedValue({
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

describe('RiskCard — error (pro)', () => {
  it('shows error message on service failure', async () => {
    (useLicense as ReturnType<typeof vi.fn>).mockReturnValue({ paid: true, email: 'test@example.com' });
    vi.mocked(redditClient.fetchRisk).mockRejectedValue(new Error('RISK_ERROR:503'));
    await act(async () => {
      render(<RiskCard subreddit="javascript" username="testuser" />);
    });
    expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
  });
});

describe('RiskCard — free tier', () => {
  it('shows risk level for free users via risk-summary', async () => {
    (useLicense as ReturnType<typeof vi.fn>).mockReturnValue({ paid: false, email: '' });
    vi.spyOn(redditClient, 'fetchRiskSummary').mockResolvedValue({
      subreddit: 'python',
      username: 'testuser',
      risk_level: 'high',
      cached: false,
    });

    const { findByText } = render(
      <RiskCard subreddit="python" username="testuser" />
    );
    await findByText(/high/i);
  });

  it('shows ProLock rows for breakdown in free tier', async () => {
    (useLicense as ReturnType<typeof vi.fn>).mockReturnValue({ paid: false, email: '' });
    vi.spyOn(redditClient, 'fetchRiskSummary').mockResolvedValue({
      subreddit: 'python',
      username: 'testuser',
      risk_level: 'medium',
      cached: false,
    });

    const { findAllByLabelText } = render(
      <RiskCard subreddit="python" username="testuser" />
    );
    const locks = await findAllByLabelText(/Pro only/i);
    expect(locks.length).toBeGreaterThan(0);
  });

  it('shows full breakdown for pro users', async () => {
    (useLicense as ReturnType<typeof vi.fn>).mockReturnValue({
      paid: true,
      email: 'user@example.com',
    });
    vi.spyOn(redditClient, 'fetchRisk').mockResolvedValue({
      subreddit: 'python',
      username: 'testuser',
      risk_level: 'high',
      confidence: 'high',
      factors: [{ type: 'karma', impact: 'high', message: 'Low karma ratio' }],
      recommendation: 'Post carefully',
      cached: false,
    });

    const { findByText } = render(
      <RiskCard subreddit="python" username="testuser" />
    );
    await findByText(/Low karma ratio/i);
    await findByText(/Post carefully/i);
  });
});
