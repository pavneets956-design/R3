import { startWatcher } from './watcher';
import { detectPageContext } from './detector';
import { bridge } from './bridge';
import { initChromeStore } from '../panel/storage-adapter';
import { logEvent } from '../shared/logger';

// Module-scoped mount guard — cannot be spoofed by page scripts
let panelMounted = false;

async function mountPanel(): Promise<void> {
  if (panelMounted) return;
  panelMounted = true;

  // Dynamically import the React panel to keep initial parse cost low
  const { mountR3Panel } = await import('../panel/main');
  mountR3Panel();

  logEvent({ type: 'PANEL_MOUNTED' });
}

async function init(): Promise<void> {
  // Initialize chrome.storage.local -> in-memory cache BEFORE any storage reads
  await initChromeStore();

  // Emit initial context on load
  const initialCtx = detectPageContext();
  bridge.emit(initialCtx);

  // Mount the panel
  mountPanel().catch((err: unknown) => {
    logEvent({
      type: 'PANEL_MOUNT_ERROR',
      message: err instanceof Error ? err.message : String(err),
    });
  });

  // Watch for SPA navigation
  startWatcher(() => {
    const ctx = detectPageContext();
    bridge.emit(ctx);
    logEvent({ type: 'NAV_DETECTED', subreddit: ctx.subreddit ?? undefined });
  });
}

init();
