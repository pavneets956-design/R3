// Phase 1: lifecycle stub only.
// Phase 2 will add API proxy calls for rules scraping, risk scoring, visibility checks.

chrome.runtime.onInstalled.addListener(() => {
  console.log('[R3] Extension installed');
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[R3] Browser started');
});
