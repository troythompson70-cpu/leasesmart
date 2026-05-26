/**
 * Sprint D5 — success toast helper (demo)
 */
export function d5ToastMessage(key, map) {
  map = map || {};
  return map[key] || key;
}

export function d5ValidateTooltip(text) {
  if (!text) return false;
  const words = String(text).trim().split(/\s+/);
  return words.length > 0 && words.length <= 20;
}
