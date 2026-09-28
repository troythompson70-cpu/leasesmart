/**
 * Banner color from the feed file age. Ignores stored ui_sync_health.status.
 * ≤30 min green, >30 min yellow, >2 hr red. system_mode SAFE wins.
 */

const THIRTY_MIN_MS = 30 * 60 * 1000;
const TWO_HR_MS = 2 * 60 * 60 * 1000;

function modeText(feed) {
  const raw = feed && feed.system_mode;
  if (raw && typeof raw === 'object') {
    return String(raw.Value || raw.value || '').trim().toUpperCase();
  }
  return String(raw || '').trim().toUpperCase();
}

/**
 * @param {object|null|undefined} feed
 * @param {number} [now]
 * @returns {{ state: 'GREEN'|'YELLOW'|'RED'|'SAFE', title: string }}
 */
export function bannerFromFeedAge(feed, now = Date.now()) {
  if (modeText(feed) === 'SAFE') {
    return { state: 'SAFE', title: 'SAFE' };
  }
  const stamp = Date.parse(String(feed && feed.updated_at ? feed.updated_at : ''));
  if (!Number.isFinite(stamp)) {
    return { state: 'RED', title: 'RED — feed updated_at is missing' };
  }
  const age = now - stamp;
  if (age <= THIRTY_MIN_MS) {
    return { state: 'GREEN', title: 'GREEN — feed updated within 30 min' };
  }
  if (age <= TWO_HR_MS) {
    return { state: 'YELLOW', title: 'YELLOW — feed older than 30 min' };
  }
  return { state: 'RED', title: 'RED — feed older than 2 hr' };
}
