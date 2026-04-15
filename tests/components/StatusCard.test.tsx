import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusCard } from '../../src/panel/components/StatusCard';

describe('StatusCard', () => {
  it('renders visibility heading', () => {
    render(<StatusCard postId={null} username={null} />);
    expect(screen.getByText(/visibility/i)).toBeInTheDocument();
  });

  it('renders Pro lock overlay', () => {
    render(<StatusCard postId={null} username={null} />);
    expect(screen.getByText('Pro')).toBeInTheDocument();
  });

  it('renders coming soon CTA', () => {
    render(<StatusCard postId={null} username={null} />);
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
  });
});
