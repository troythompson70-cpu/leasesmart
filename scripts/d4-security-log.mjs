/**
 * Sprint D4 — failed login logging (count + timestamp only, no PII)
 */
export function d4LogFailedLogin(store) {
  store = store || {};
  if (!store.securityLog) store.securityLog = { failedLoginAttempts: [], totalFailedCount: 0 };
  store.securityLog.failedLoginAttempts.unshift({ ts: new Date().toISOString() });
  if (store.securityLog.failedLoginAttempts.length > 200) {
    store.securityLog.failedLoginAttempts = store.securityLog.failedLoginAttempts.slice(0, 200);
  }
  store.securityLog.totalFailedCount = (store.securityLog.totalFailedCount || 0) + 1;
  return store.securityLog;
}
