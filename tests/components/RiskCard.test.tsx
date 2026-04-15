import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiskCard } from '../../src/panel/components/RiskCard';

describe('RiskCard', () => {
  it('renders mocked risk level', () => {
    render(<RiskCard subreddit="javascript" username={null} />);
    expect(screen.getByText(/medium/i)).toBeInTheDocument();
  });

  it('renders Pro lock overlay', () => {
    render(<RiskCard subreddit="javascript" username={null} />);
    expect(screen.getByText('Pro')).toBeInTheDocument();
  });

  it('renders coming soon CTA', () => {
    render(<RiskCard subreddit="javascript" username={null} />);
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
  });
});
