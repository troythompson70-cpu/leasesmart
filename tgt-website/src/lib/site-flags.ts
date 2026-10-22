/**
 * Laptop checkout gate.
 * OFF until PayPal storage and webhooks are deployed.
 * Does not remove payment code and does not change /api/paypal routes.
 */
export const laptopCheckoutEnabled = false

export function isCartPath(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return path === '/cart'
}
