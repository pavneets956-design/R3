import ExtPay from 'extpay';

// IMPORTANT: ExtPay and onPaid must be registered at the TOP LEVEL of the service worker.
// MV3 service workers are non-persistent — they cold-start on every event.
// Registering inside onInstalled/onStartup alone would miss wakes triggered by
// alarms or messages. Top-level registration runs on every SW instantiation.
const extpay = ExtPay('r3--reddit-rules-enforcer');

extpay.startBackground();

extpay.onPaid.addListener((user) => {
  // Store email as Pro bearer token in persistent storage
  chrome.storage.local.set({
    r3_pro_paid: true,
    r3_pro_email: user.email ?? '',
    r3_pro_token: user.email ?? '',   // backendClient reads this key for Bearer auth
  });

  // Notify all open panels so they re-render without a page reload
  chrome.runtime.sendMessage({ type: 'LICENSE_UPDATED', paid: true, email: user.email ?? '' }).catch(() => {
    // No panel open — that's fine
  });
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('[R3] Extension installed');
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[R3] Browser started');
});
