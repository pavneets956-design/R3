import ExtPay from 'extpay';

// IMPORTANT: ExtPay and onPaid must be registered at the TOP LEVEL of the service worker.
// MV3 service workers are non-persistent — they cold-start on every event.
// Registering inside onInstalled/onStartup alone would miss wakes triggered by
// alarms or messages. Top-level registration runs on every SW instantiation.
const extpay = ExtPay('r3--reddit-rules-enforcer');

extpay.startBackground();

// Mirror the ExtPay api_key (opaque credential stored in sync storage) into
// local storage as r3_pro_token. The backend validates this key against the
// ExtensionPay API — no separate secret key needed.
function mirrorApiKey(): void {
  chrome.storage.sync.get(['extensionpay_api_key'], (result) => {
    const key = result['extensionpay_api_key'] as string | undefined;
    if (key) {
      chrome.storage.local.set({ r3_pro_token: key });
    }
  });
}

// Mirror on every SW cold-start so existing paid users work after SW restarts.
mirrorApiKey();

// Keep r3_pro_token up to date if ExtPay ever rotates the api_key.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes['extensionpay_api_key']?.newValue) {
    chrome.storage.local.set({ r3_pro_token: changes['extensionpay_api_key'].newValue as string });
  }
});

extpay.onPaid.addListener((user) => {
  // Store paid state and display email in local storage.
  chrome.storage.local.set({
    r3_pro_paid: true,
    r3_pro_email: user.email ?? '',
  });

  // Mirror the api_key now that we know the user has paid.
  // ExtPay writes extensionpay_api_key to sync storage before firing onPaid,
  // so this read should always succeed.
  mirrorApiKey();

  // Notify all open panels so they re-render without a page reload.
  chrome.runtime.sendMessage({ type: 'LICENSE_UPDATED', paid: true, email: user.email ?? '' }).catch(() => {
    // No panel open — that's fine.
  });
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('[R3] Extension installed');
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[R3] Browser started');
});
