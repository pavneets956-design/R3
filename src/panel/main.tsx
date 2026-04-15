import { createRoot } from 'react-dom/client';
import panelStyles from './panel.css?inline';
import { FloatingPanel } from './components/FloatingPanel';
import { markInstalled, isInstalled } from './storage';
import { logEvent } from '../shared/logger';

export function mountR3Panel(): void {
  // Mount guard — idempotent
  if (document.getElementById('__r3-host__')) return;

  if (!isInstalled()) {
    markInstalled();
    logEvent({ type: 'FIRST_INSTALL' });
  }

  const host = document.createElement('div');
  host.id = '__r3-host__';
  document.body.appendChild(host);

  const shadowRoot = host.attachShadow({ mode: 'open' });

  // Inject styles into shadow root (isolates from Reddit's global CSS)
  const style = document.createElement('style');
  style.textContent = panelStyles;
  shadowRoot.appendChild(style);

  const container = document.createElement('div');
  shadowRoot.appendChild(container);

  const root = createRoot(container);
  root.render(<FloatingPanel />);
}
