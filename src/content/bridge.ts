import type { PageContext } from '../shared/types';

type Listener = (ctx: PageContext) => void;

const listeners = new Set<Listener>();

export const bridge = {
  emit(ctx: PageContext): void {
    listeners.forEach((fn) => fn(ctx));
  },

  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /** For testing: reset all subscribers */
  _reset(): void {
    listeners.clear();
  },
};
