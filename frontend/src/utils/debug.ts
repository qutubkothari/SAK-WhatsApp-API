export function isDebugEnabled(): boolean {
  try {
    return localStorage.getItem('sak.debug') === '1';
  } catch {
    return false;
  }
}

export function debugLog(...args: any[]) {
  if (!isDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.log('[SAK]', ...args);
}
