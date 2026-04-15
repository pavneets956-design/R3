import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { NotesBlock } from '../../src/panel/components/NotesBlock';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('NotesBlock', () => {
  it('loads existing notes on mount', () => {
    localStorage.setItem('v1:user:alice:subreddit:javascript:notes', 'my saved note');
    render(<NotesBlock username="alice" subreddit="javascript" />);
    expect(screen.getByRole('textbox')).toHaveValue('my saved note');
  });

  it('shows empty textarea when no saved notes', () => {
    render(<NotesBlock username="alice" subreddit="javascript" />);
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('persists notes to storage after debounce', async () => {
    vi.useFakeTimers();
    render(<NotesBlock username="alice" subreddit="javascript" />);
    const textarea = screen.getByRole('textbox');

    act(() => { fireEvent.change(textarea, { target: { value: 'hello' } }); });
    expect(localStorage.getItem('v1:user:alice:subreddit:javascript:notes')).toBeNull();

    act(() => { vi.advanceTimersByTime(350); });
    expect(localStorage.getItem('v1:user:alice:subreddit:javascript:notes')).toBe('hello');
  });

  it('enforces 4096 character cap', () => {
    render(<NotesBlock username="alice" subreddit="javascript" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '4096');
  });

  it('shows character count', async () => {
    render(<NotesBlock username="alice" subreddit="javascript" />);
    await userEvent.type(screen.getByRole('textbox'), 'hi');
    expect(screen.getByText(/2 \/ 4096/)).toBeInTheDocument();
  });

  it('uses guest key when username is null', async () => {
    vi.useFakeTimers();
    render(<NotesBlock username={null} subreddit="javascript" />);
    const textarea = screen.getByRole('textbox');

    act(() => { fireEvent.change(textarea, { target: { value: 'guest note' } }); });
    act(() => { vi.advanceTimersByTime(350); });
    expect(localStorage.getItem('v1:user:guest:subreddit:javascript:notes')).toBe('guest note');
  });
});
