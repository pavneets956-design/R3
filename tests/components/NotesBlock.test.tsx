import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

// Mock chromeStore with an in-memory Map
const store = new Map<string, string>();
vi.mock('../../src/panel/storage-adapter', () => ({
  initChromeStore: vi.fn().mockResolvedValue(undefined),
  chromeStore: {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { store.set(key, value); }),
    removeItem: vi.fn((key: string) => { store.delete(key); }),
    get length() { return store.size; },
    key: vi.fn((index: number) => [...store.keys()][index] ?? null),
    keysWithPrefix: vi.fn((prefix: string) => [...store.keys()].filter(k => k.startsWith(prefix))),
  },
}));

import { NotesBlock } from '../../src/panel/components/NotesBlock';

beforeEach(() => {
  store.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('NotesBlock', () => {
  it('loads existing notes on mount', () => {
    store.set('v1:user:alice:subreddit:javascript:notes', 'my saved note');
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
    expect(store.get('v1:user:alice:subreddit:javascript:notes')).toBeUndefined();

    act(() => { vi.advanceTimersByTime(350); });
    expect(store.get('v1:user:alice:subreddit:javascript:notes')).toBe('hello');
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
    expect(store.get('v1:user:guest:subreddit:javascript:notes')).toBe('guest note');
  });
});
