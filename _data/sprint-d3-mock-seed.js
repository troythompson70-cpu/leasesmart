/**
 * Sprint D3 — mobile UX config (mock / demo)
 */
window.D3_MOBILE_CONFIG = {
  touchMinPx: 44,
  mobileNavBreakPx: 768,
  c2QuickNoteFab: true,
  navAnimationMs: 320
};

function d3SeedIfNeeded() {
  if (typeof window.D3_MOBILE_CONFIG === 'undefined') {
    window.D3_MOBILE_CONFIG = { touchMinPx: 44, mobileNavBreakPx: 768 };
  }
}
