/** Phase 1: all calls return mocked data. Phase 2 replaces these with real backend calls. */

export interface RiskScore {
  level: 'low' | 'medium' | 'high';
  factors: string[];
}

export interface VisibilityStatus {
  visible: boolean | null;
  checkedAt: number | null;
  message: string;
}

export async function getRiskScore(
  _subreddit: string,
  _username: string | null
): Promise<RiskScore> {
  return {
    level: 'medium',
    factors: ['Account age below threshold', 'Karma may be insufficient'],
  };
}

export async function getVisibilityStatus(
  _postId: string,
  _username: string | null
): Promise<VisibilityStatus> {
  return {
    visible: null,
    checkedAt: null,
    message: 'Unlock Pro to check post visibility',
  };
}
