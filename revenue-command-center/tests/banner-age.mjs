import assert from 'node:assert/strict';
import { bannerFromFeedAge } from '../js/banner-age.js';

const now = Date.parse('2026-09-26T12:00:00.000Z');

const green = bannerFromFeedAge(
  { updated_at: new Date(now - 10 * 60 * 1000).toISOString(), ui_sync_health: { status: 'RED' } },
  now,
);
assert.equal(green.state, 'GREEN');

const yellow = bannerFromFeedAge(
  { updated_at: new Date(now - 31 * 60 * 1000).toISOString(), ui_sync_health: { status: 'GREEN' } },
  now,
);
assert.equal(yellow.state, 'YELLOW');

const red = bannerFromFeedAge(
  { updated_at: new Date(now - (2 * 60 + 1) * 60 * 1000).toISOString(), ui_sync_health: { status: 'GREEN' } },
  now,
);
assert.equal(red.state, 'RED');

const safe = bannerFromFeedAge(
  {
    updated_at: new Date(now - 5 * 60 * 1000).toISOString(),
    system_mode: 'SAFE',
    ui_sync_health: { status: 'GREEN' },
  },
  now,
);
assert.equal(safe.state, 'SAFE');
assert.equal(safe.title, 'SAFE');

console.log('banner-age: GREEN YELLOW RED SAFE');
