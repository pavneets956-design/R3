import { startWatcher } from './watcher';
import { detectPageContext } from './detector';
import { bridge } from './bridge';
import { logEvent } from '../shared/logger';

declare global {
  interface Window {
    __R3_PANEL_MOUNTED__: boolean | undefined;
  }
}

async function mountPanel(): Promise<void> {
  if (window.__R3_PANEL_MOUNTED__) return;
  window.__R3_PANEL_MOUNTED__ = true;

  // Dynamically import the React panel to keep initial parse cost low
  const { mountR3Panel } = await import('../panel/main');
  mountR3Panel();

  logEvent({ type: 'PANEL_MOUNTED' });
}

function init(): void {
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
