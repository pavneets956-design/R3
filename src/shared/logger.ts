import type { LogEvent } from './types';

const LOG_KEY = 'v1:logs';
const MAX_ENTRIES = 500;

export function logEvent(event: Omit<LogEvent, 'timestamp'>): void {
  const entry: LogEvent = { ...event, timestamp: Date.now() };

  try {
    const raw = localStorage.getItem(LOG_KEY);
    const logs: LogEvent[] = raw ? (JSON.parse(raw) as LogEvent[]) : [];
    logs.push(entry);
    if (logs.length > MAX_ENTRIES) logs.shift();
    localStorage.setItem(LOG_KEY, JSON.stringify(logs));
  } catch {
    // Never let logging break the extension
  }
}

export function getLogs(): LogEvent[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? (JSON.parse(raw) as LogEvent[]) : [];
  } catch {
    return [];
  }
}

export function clearLogs(): void {
  localStorage.removeItem(LOG_KEY);
}
