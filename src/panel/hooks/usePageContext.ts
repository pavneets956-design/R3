import { useState, useEffect } from 'react';
import { bridge } from '../../content/bridge';
import type { PageContext } from '../../shared/types';

/**
 * Subscribes to bridge updates.
 * Only triggers a re-render when subreddit or pageType changes.
 * Other fields (url, detectedAt, postComposerOpen, postId) do not cause re-renders
 * unless a component explicitly subscribes separately.
 */
export function usePageContext(): PageContext | null {
  const [ctx, setCtx] = useState<PageContext | null>(null);

  useEffect(() => {
    return bridge.subscribe((next) => {
      setCtx((prev) => {
        if (
          prev !== null &&
          prev.subreddit === next.subreddit &&
          prev.pageType === next.pageType
        ) {
          return prev; // Same reference → no re-render
        }
        return next;
      });
    });
  }, []);

  return ctx;
}
