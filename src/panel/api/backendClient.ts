/**
 * Token helpers — chrome.storage.local accessors for the Pro license token.
 *
 * The FastAPI backend has been removed. Risk and post-status data are now
 * fetched directly from Reddit's public JSON endpoints via redditClient.ts.
 * This file is kept for the options page token management UI.
 */

export const PRO_TOKEN_KEY = 'r3_pro_token';
const PRO_EMAIL_KEY = 'r3_pro_email';

export async function getProToken(): Promise<string | null> {
  return new Promise(resolve => {
    chrome.storage.local.get([PRO_TOKEN_KEY], result => {
      resolve((result[PRO_TOKEN_KEY] as string | undefined) ?? null);
    });
  });
}

export async function setProToken(token: string): Promise<void> {
  return new Promise(resolve => {
    chrome.storage.local.set({ [PRO_TOKEN_KEY]: token }, resolve);
  });
}

export async function clearProToken(): Promise<void> {
  return new Promise(resolve => {
    chrome.storage.local.remove([PRO_TOKEN_KEY], resolve);
  });
}

export async function getProEmail(): Promise<string> {
  const result = await chrome.storage.local.get(PRO_EMAIL_KEY);
  return (result[PRO_EMAIL_KEY] as string) ?? '';
}
