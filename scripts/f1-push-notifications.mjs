/**
 * Sprint F1 — push notification skeleton (DEMO only — no real VAPID, no real push)
 */
export const F1_PUSH_DEMO_LABEL = 'DEMO — Real push needs VAPID keys to activate.';

export const F1_ALERT_TYPES = [
  'sprint_complete',
  'test_failed',
  'commit_ready',
  'review_needed',
];

const ALERT_COPY = {
  sprint_complete: { title: 'Sprint complete', body: 'Build finished — review handoff before commit.' },
  test_failed: { title: 'Test failed', body: 'Regression suite failed — fix before commit.' },
  commit_ready: { title: 'Commit ready', body: 'Tests passed — awaiting Troy exact commit phrase.' },
  review_needed: { title: 'Review needed', body: 'Claude or ChatGPT review pending.' },
};

export function f1IsVapidConfigured(vapidPublicKey) {
  if (!vapidPublicKey || typeof vapidPublicKey !== 'string') return false;
  if (vapidPublicKey.indexOf('YOUR_') >= 0) return false;
  return vapidPublicKey.length > 20;
}

/** Demo only — never calls push API. */
export function f1SimulatePushAlert(type, context) {
  if (F1_ALERT_TYPES.indexOf(type) < 0) throw new Error('Unknown alert type: ' + type);
  const copy = ALERT_COPY[type];
  return {
    demo: true,
    realPushSent: false,
    label: F1_PUSH_DEMO_LABEL,
    type: type,
    title: copy.title,
    body: copy.body,
    context: context || {},
    wouldFireAt: new Date().toISOString(),
    vapidRequired: true,
  };
}

export function f1ListDemoAlerts() {
  return F1_ALERT_TYPES.map(function(t) { return f1SimulatePushAlert(t, { mock: true }); });
}

export function f1ValidateNoRealPush(result) {
  return !!(result && result.demo === true && result.realPushSent === false);
}
