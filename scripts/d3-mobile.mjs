/**
 * Sprint D3 — mobile UX constants (regression module)
 */
export const D3_TOUCH_MIN = 44;
export const D3_MOBILE_BREAK = 768;

export function d3ValidateTouchTarget(px) {
  return typeof px === 'number' && px >= D3_TOUCH_MIN;
}
