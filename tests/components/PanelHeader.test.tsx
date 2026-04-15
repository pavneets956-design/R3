import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PanelHeader } from '../../src/panel/components/PanelHeader';

describe('PanelHeader', () => {
  it('shows detected username', () => {
    render(<PanelHeader username="alice" collapsed={false} onToggleCollapse={vi.fn()} />);
    expect(screen.getByText('alice')).toBeInTheDocument();
  });

  it('shows "Guest" when username is null', () => {
    render(<PanelHeader username={null} collapsed={false} onToggleCollapse={vi.fn()} />);
    expect(screen.getByText('Guest')).toBeInTheDocument();
  });

  it('calls onToggleCollapse when toggle button clicked', async () => {
    const onToggle = vi.fn();
    render(<PanelHeader username="alice" collapsed={false} onToggleCollapse={onToggle} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows collapse icon when expanded', () => {
    render(<PanelHeader username="alice" collapsed={false} onToggleCollapse={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveTextContent('−');
  });

  it('shows expand icon when collapsed', () => {
    render(<PanelHeader username="alice" collapsed={true} onToggleCollapse={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveTextContent('+');
  });
});
