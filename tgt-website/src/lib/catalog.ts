export type CatalogProduct = {
  sku: string
  name: string
  priceCents: number
}

export type CartRequestLine = {
  sku?: unknown
  quantity?: unknown
  priceCents?: unknown
}

export type PricedLine = {
  sku: string
  name: string
  quantity: number
  priceCents: number
  lineCents: number
}

export function formatUsd(cents: number): string {
  return (cents / 100).toFixed(2)
}

export function priceCart(
  requested: CartRequestLine[],
  products: readonly CatalogProduct[],
): { ok: true; lines: PricedLine[]; totalCents: number } | { ok: false; error: string } {
  if (!Array.isArray(requested) || requested.length === 0) {
    return { ok: false, error: 'Cart is empty.' }
  }
  const lines: PricedLine[] = []
  for (const line of requested) {
    const sku = String(line.sku || '').trim()
    const product = products.find((item) => item.sku === sku)
    if (!product) return { ok: false, error: 'Unknown product.' }
    const quantity = line.quantity
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      return { ok: false, error: 'Quantity must be a whole number from 1 to 10.' }
    }
    if (line.priceCents != null && line.priceCents !== product.priceCents) {
      return { ok: false, error: 'Price does not match the catalog.' }
    }
    lines.push({
      sku: product.sku,
      name: product.name,
      quantity,
      priceCents: product.priceCents,
      lineCents: product.priceCents * quantity,
    })
  }
  return {
    ok: true,
    lines,
    totalCents: lines.reduce((sum, line) => sum + line.lineCents, 0),
  }
}

export function orderOpportunityId(paypalOrderId: string): string {
  const id = paypalOrderId.trim()
  if (!id) throw new Error('PayPal order id is required.')
  return `ORD-${id}`
}

export function alreadyFiled(existingOpportunityIds: Iterable<string>, paypalOrderId: string): boolean {
  return new Set(existingOpportunityIds).has(orderOpportunityId(paypalOrderId))
}

export function webhookVerified(verificationStatus: string): boolean {
  return verificationStatus === 'SUCCESS'
}
