export interface PageContext {
  username: string | null;
  subreddit: string | null;
  pageType: 'feed' | 'post' | 'submit' | 'profile' | 'other';
  postComposerOpen: boolean;
  postId: string | null;
  url: string;
  detectedAt: number;
}

export interface LogEvent {
  type: string;
  subreddit?: string;
  username?: string;
  errorType?: string;
  message?: string;
  timestamp: number;
}

export interface SubredditRule {
  kind: string;
  shortName: string;
  description: string;
  priority: number;
}

export type RulesState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; rules: SubredditRule[]; fetchedAt: number; stale: boolean }
  | { status: 'error'; errorType: 'network' | 'not-found' | 'private' | 'malformed' }
  | { status: 'empty' };

export interface UserPrefs {
  enabled: boolean;
  collapsedByDefault: boolean;
  guestMode: boolean;
}

export interface RiskSummaryResponse {
  subreddit: string;
  username: string;
  risk_level: 'low' | 'medium' | 'high';
  cached: boolean;
}

export interface LicenseState {
  paid: boolean;
  email: string;
}
