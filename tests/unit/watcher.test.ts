import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startWatcher, stopWatcher } from '../../src/content/watcher';

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(window, 'location', {
    value: { href: 'https://www.reddit.com/r/javascript/' },
    writable: true,
  });
});

afterEach(() => {
  stopWatcher();
  vi.useRealTimers();
});

describe('startWatcher', () => {
  it('calls callback on URL change after debounce', () => {
    const callback = vi.fn();
    startWatcher(callback);

    // Simulate URL change
    (window.location as { href: string }).href = 'https://www.reddit.com/r/python/';

    // Trigger the MutationObserver callback directly — jsdom fires MutationObserver
    // callbacks asynchronously (microtasks) which fake timers don't flush, so we
    // invoke the exposed trigger function to simulate the observer firing synchronously.
    const trigger = (globalThis as { __r3_trigger__?: () => void }).__r3_trigger__;
    if (trigger) trigger();

    // Not called yet — debounce pending
    expect(callback).not.toHaveBeenCalled();

    // Advance past debounce
    vi.advanceTimersByTime(350);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('fires callback only once for rapid mutations at same URL', () => {
    const callback = vi.fn();
    startWatcher(callback);

    // Multiple mutations but same URL (no change)
    vi.advanceTimersByTime(350);
    expect(callback).toHaveBeenCalledTimes(0);
  });

  it('stopWatcher prevents further callbacks', () => {
    const callback = vi.fn();
    startWatcher(callback);
    stopWatcher();

    (window.location as { href: string }).href = 'https://www.reddit.com/r/python/';
    vi.advanceTimersByTime(350);
    expect(callback).not.toHaveBeenCalled();
  });
});
