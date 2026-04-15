import type { PageContext } from '../shared/types';

export function detectPageContext(): PageContext {
  const url = window.location.href;
  const pathname = window.location.pathname;

  return {
    username: detectUsername(),
    subreddit: detectSubreddit(pathname),
    pageType: detectPageType(pathname),
    postComposerOpen: detectPostComposerOpen(),
    postId: detectPostId(pathname),
    url,
    detectedAt: Date.now(),
  };
}

function detectUsername(): string | null {
  const link = document.querySelector<HTMLAnchorElement>(
    '[data-testid="header-user-links-username"]'
  );
  if (link) {
    const href = link.getAttribute('href') ?? '';
    const match = href.match(/^\/user\/([^/]+)/);
    if (match) return match[1];
    const text = link.textContent?.trim();
    if (text) return text;
  }
  return null;
}

function detectSubreddit(pathname: string): string | null {
  const match = pathname.match(/^\/r\/([^/]+)/);
  if (!match) return null;
  const name = match[1];
  if (!name) return null;
  return name;
}

function detectPageType(pathname: string): PageContext['pageType'] {
  if (/^\/user\//.test(pathname)) return 'profile';

  const subredditMatch = pathname.match(/^\/r\/([^/]+)(\/(.*))?$/);
  if (!subredditMatch) return 'other';

  const sub = subredditMatch[1];
  if (!sub) return 'other';

  const rest = subredditMatch[3] ?? '';

  if (rest === '' || rest === '/') return 'feed';
  if (rest.startsWith('comments/')) return 'post';
  if (rest === 'submit' || rest.startsWith('submit')) return 'submit';

  return 'feed';
}

function detectPostComposerOpen(): boolean {
  return !!document.querySelector('[data-testid="post-composer"]');
}

function detectPostId(pathname: string): string | null {
  const match = pathname.match(/\/comments\/([a-z0-9]+)\//i);
  return match ? match[1] : null;
}
