const DEBOUNCE_MS = 300;

type UrlChangeCallback = (url: string) => void;

let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastUrl: string = '';

function handleMutation(): void {
  const currentUrl = window.location.href;
  if (currentUrl === lastUrl) return;

  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    lastUrl = currentUrl;
    onUrlChangeRef(currentUrl);
    debounceTimer = null;
  }, DEBOUNCE_MS);
}

// Holds the active callback so handleMutation can reference it.
let onUrlChangeRef: UrlChangeCallback = () => undefined;

export function startWatcher(onUrlChange: UrlChangeCallback): void {
  stopWatcher();
  lastUrl = window.location.href;
  onUrlChangeRef = onUrlChange;

  observer = new MutationObserver(handleMutation);
  observer.observe(document.body, { childList: true, subtree: true });

  // Expose for testing
  (globalThis as Record<string, unknown>).__r3_observer__ = observer;
  (globalThis as Record<string, unknown>).__r3_trigger__ = handleMutation;
}

export function stopWatcher(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (observer !== null) {
    observer.disconnect();
    observer = null;
  }
  onUrlChangeRef = () => undefined;
  (globalThis as Record<string, unknown>).__r3_observer__ = undefined;
  (globalThis as Record<string, unknown>).__r3_trigger__ = undefined;
}
