import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RulesBlock } from '../../src/panel/components/RulesBlock';
import * as rulesClient from '../../src/panel/api/rulesClient';
import type { RulesState } from '../../src/shared/types';

beforeEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(state: RulesState) {
  vi.spyOn(rulesClient, 'fetchRules').mockResolvedValue(state);
}

describe('RulesBlock', () => {
  it('shows loading state initially', () => {
    vi.spyOn(rulesClient, 'fetchRules').mockReturnValue(new Promise(() => {}));
    render(<RulesBlock subreddit="javascript" />);
    expect(screen.getByText(/loading rules/i)).toBeInTheDocument();
  });

  it('renders rules when loaded', async () => {
    mockFetch({
      status: 'loaded',
      rules: [{ kind: 'all', shortName: 'Be kind', description: 'Be nice to others', priority: 1 }],
      fetchedAt: Date.now(),
      stale: false,
    });
    render(<RulesBlock subreddit="javascript" />);
    await waitFor(() => expect(screen.getByText('Be kind')).toBeInTheDocument());
  });

  it('shows stale badge when data is stale', async () => {
    mockFetch({
      status: 'loaded',
      rules: [{ kind: 'all', shortName: 'Be kind', description: 'Be nice', priority: 1 }],
      fetchedAt: Date.now() - 25 * 3600 * 1000,
      stale: true,
    });
    render(<RulesBlock subreddit="javascript" />);
    await waitFor(() => expect(screen.getByText(/stale/i)).toBeInTheDocument());
  });

  it('shows network error with retry button', async () => {
    mockFetch({ status: 'error', errorType: 'network' });
    render(<RulesBlock subreddit="javascript" />);
    await waitFor(() => expect(screen.getByText(/couldn't load rules/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('shows not-found message on 404', async () => {
    mockFetch({ status: 'error', errorType: 'not-found' });
    render(<RulesBlock subreddit="javascript" />);
    await waitFor(() =>
      expect(screen.getByText(/rules unavailable for this subreddit/i)).toBeInTheDocument()
    );
  });

  it('shows private message for private subreddit', async () => {
    mockFetch({ status: 'error', errorType: 'private' });
    render(<RulesBlock subreddit="javascript" />);
    await waitFor(() =>
      expect(screen.getByText(/subreddit is private/i)).toBeInTheDocument()
    );
  });

  it('shows empty message when no rules', async () => {
    mockFetch({ status: 'empty' });
    render(<RulesBlock subreddit="javascript" />);
    await waitFor(() => expect(screen.getByText(/no rules posted/i)).toBeInTheDocument());
  });

  it('re-fetches when retry button clicked', async () => {
    const fetchSpy = vi
      .spyOn(rulesClient, 'fetchRules')
      .mockResolvedValueOnce({ status: 'error', errorType: 'network' })
      .mockResolvedValueOnce({
        status: 'loaded',
        rules: [{ kind: 'all', shortName: 'Be kind', description: 'Be nice', priority: 1 }],
        fetchedAt: Date.now(),
        stale: false,
      });

    render(<RulesBlock subreddit="javascript" />);
    await waitFor(() => expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.getByText('Be kind')).toBeInTheDocument());
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
