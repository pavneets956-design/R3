import { describe, it, expect, beforeEach } from 'vitest';
import { detectPageContext } from '../../src/content/detector';

function setUrl(url: string) {
  Object.defineProperty(window, 'location', {
    value: new URL(url),
    writable: true,
  });
}

function setMetaUsername(username: string | null) {
  document.querySelectorAll('[data-testid="header-user-links-username"]').forEach((el) => el.remove());

  if (username) {
    const link = document.createElement('a');
    link.setAttribute('data-testid', 'header-user-links-username');
    link.setAttribute('href', `/user/${username}`);
    link.textContent = username;
    document.body.appendChild(link);
  }
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.title = '';
});

describe('detectPageContext', () => {
  it('detects feed page on /r/javascript/', () => {
    setUrl('https://www.reddit.com/r/javascript/');
    const ctx = detectPageContext();
    expect(ctx.subreddit).toBe('javascript');
    expect(ctx.pageType).toBe('feed');
    expect(ctx.postId).toBeNull();
  });

  it('detects post page on /r/javascript/comments/abc123/', () => {
    setUrl('https://www.reddit.com/r/javascript/comments/abc123/some_post/');
    const ctx = detectPageContext();
    expect(ctx.subreddit).toBe('javascript');
    expect(ctx.pageType).toBe('post');
    expect(ctx.postId).toBe('abc123');
  });

  it('detects submit page on /r/javascript/submit', () => {
    setUrl('https://www.reddit.com/r/javascript/submit');
    const ctx = detectPageContext();
    expect(ctx.subreddit).toBe('javascript');
    expect(ctx.pageType).toBe('submit');
  });

  it('detects profile page on /user/alice/', () => {
    setUrl('https://www.reddit.com/user/alice/');
    const ctx = detectPageContext();
    expect(ctx.pageType).toBe('profile');
    expect(ctx.subreddit).toBeNull();
  });

  it('detects other page on /r/ root', () => {
    setUrl('https://www.reddit.com/r/');
    const ctx = detectPageContext();
    expect(ctx.pageType).toBe('other');
    expect(ctx.subreddit).toBeNull();
  });

  it('detects postComposerOpen when composer element present', () => {
    setUrl('https://www.reddit.com/r/javascript/');
    const el = document.createElement('div');
    el.setAttribute('data-testid', 'post-composer');
    document.body.appendChild(el);
    const ctx = detectPageContext();
    expect(ctx.postComposerOpen).toBe(true);
  });

  it('postComposerOpen is false when no composer element', () => {
    setUrl('https://www.reddit.com/r/javascript/');
    const ctx = detectPageContext();
    expect(ctx.postComposerOpen).toBe(false);
  });

  it('returns null username when no user link found', () => {
    setUrl('https://www.reddit.com/r/javascript/');
    const ctx = detectPageContext();
    expect(ctx.username).toBeNull();
  });

  it('detects username from header link', () => {
    setUrl('https://www.reddit.com/r/javascript/');
    setMetaUsername('alice');
    const ctx = detectPageContext();
    expect(ctx.username).toBe('alice');
  });

  it('includes current url and detectedAt', () => {
    setUrl('https://www.reddit.com/r/javascript/');
    const before = Date.now();
    const ctx = detectPageContext();
    expect(ctx.url).toBe('https://www.reddit.com/r/javascript/');
    expect(ctx.detectedAt).toBeGreaterThanOrEqual(before);
  });
});
