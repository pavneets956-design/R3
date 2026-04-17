import { useState, useEffect } from 'react';
import { bridge } from '../../content/bridge';
import type { PageContext } from '../../shared/types';

/**
 * Subscribes to bridge updates.
 * Triggers a re-render when subreddit, pageType, postId, or username changes.
 * Other fields (url, detectedAt, postComposerOpen) do not cause re-renders.
 */
export function usePageContext(): PageContext | null {
  const [ctx, setCtx] = useState<PageContext | null>(null);

  useEffect(() => {
    return bridge.subscribe((next) => {
      setCtx((prev) => {
        if (
          prev !== null &&
          prev.subreddit === next.subreddit &&
          prev.pageType === next.pageType &&
          prev.postId === next.postId &&
          prev.username === next.username
        ) {
          return prev; // Same reference -> no re-render
        }
        return next;
      });
    });
  }, []);

  return ctx;
}
