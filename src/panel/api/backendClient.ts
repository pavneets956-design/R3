/**
 * License key helpers — read-only accessors for the Pro license state.
 *
 * The FastAPI backend has been removed. Risk and post-status data are now
 * fetched directly from Reddit's public JSON endpoints via redditClient.ts.
 * Payment is handled entirely by ExtensionPay — the service worker writes
 * r3_pro_paid / r3_pro_email to chrome.storage.local on payment.
 */

export const PRO_TOKEN_KEY = 'r3_pro_token';
const PRO_PAID_KEY = 'r3_pro_paid';
const PRO_EMAIL_KEY = 'r3_pro_email';

export async function isPro(): Promise<boolean> {
  const result = await chrome.storage.local.get(PRO_PAID_KEY);
  return !!result[PRO_PAID_KEY];
}

export async function getProEmail(): Promise<string> {
  const result = await chrome.storage.local.get(PRO_EMAIL_KEY);
  return (result[PRO_EMAIL_KEY] as string) ?? '';
}

export async function getProToken(): Promise<string | null> {
  return new Promise(resolve => {
    chrome.storage.local.get([PRO_TOKEN_KEY], result => {
      resolve((result[PRO_TOKEN_KEY] as string | undefined) ?? null);
    });
  });
}
