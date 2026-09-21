/**
 * Command Center view persistence.
 * Selected lead, tab/filter, and fixture key survive refresh.
 * Does not invent GREEN and is not a second database.
 */
const STORAGE_KEY = 'tgt_rcc_ui_v1';
const FEED_CACHE_KEY = 'tgt_rcc_feed_cache_v1';
const FILTERS = new Set(['all', 'incoming', 'new-activity', 'new-replies']);

function blank() {
  return {
    filter: 'all',
    openOppId: null,
    fixtureKey: 'green',
  };
}

export function loadUiState() {
  if (typeof localStorage === 'undefined') return blank();
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return blank();
    const filter = FILTERS.has(parsed.filter) ? parsed.filter : 'all';
    const openOppId =
      parsed.openOppId == null || parsed.openOppId === ''
        ? null
        : String(parsed.openOppId);
    const fixtureKey =
      typeof parsed.fixtureKey === 'string' && parsed.fixtureKey
        ? parsed.fixtureKey
        : 'green';
    return { filter, openOppId, fixtureKey };
  } catch {
    return blank();
  }
}

export function saveUiState(partial = {}) {
  const next = { ...loadUiState(), ...partial, savedAt: new Date().toISOString() };
  if (typeof localStorage === 'undefined') return next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
  return next;
}

export function clearUiState() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export function loadFeedCache() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(FEED_CACHE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object' || !parsed.feed || typeof parsed.feed !== 'object') {
      return null;
    }
    const feed = parsed.feed;
    if (!Array.isArray(feed.opportunities) && !Array.isArray(feed.records)) return null;
    return {
      feed,
      fixtureKey: typeof parsed.fixtureKey === 'string' ? parsed.fixtureKey : null,
    };
  } catch {
    return null;
  }
}

export function saveFeedCache(feed, fixtureKey = null) {
  if (!feed || typeof feed !== 'object') return null;
  if (typeof localStorage === 'undefined') return { feed, fixtureKey };
  try {
    localStorage.setItem(
      FEED_CACHE_KEY,
      JSON.stringify({
        feed,
        fixtureKey,
        savedAt: new Date().toISOString(),
      }),
    );
  } catch {
    /* quota */
  }
  return { feed, fixtureKey };
}

export function clearFeedCache() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(FEED_CACHE_KEY);
}

export { STORAGE_KEY, FEED_CACHE_KEY };
