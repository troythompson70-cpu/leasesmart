/**
 * Sprint D4 — client-side API rate limiting (demo)
 */
export const D4_DEFAULT_LIMIT = 30;

export function d4MinuteKey(date) {
  const d = date || new Date();
  return d.toISOString().slice(0, 16);
}

export function d4TrackCall(store, userKey, limit) {
  store = store || {};
  limit = limit || D4_DEFAULT_LIMIT;
  userKey = userKey || 'anonymous';
  if (!store.d4RateLimits) store.d4RateLimits = {};
  const minute = d4MinuteKey();
  let bucket = store.d4RateLimits[userKey];
  if (!bucket || bucket.minute !== minute) bucket = { minute, count: 0 };
  bucket.count += 1;
  store.d4RateLimits[userKey] = bucket;
  if (bucket.count > limit) {
    return {
      allowed: false,
      message: 'Easy there — demo rate limit reached. Please wait a minute and try again.',
      count: bucket.count,
    };
  }
  return { allowed: true, count: bucket.count };
}
