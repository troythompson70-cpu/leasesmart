import { catalog } from '../content'
import { priceCart, type PricedLine } from './catalog'

const KEY = 'tgt-cart'

export type StoredLine = { sku: string; quantity: number }

export function readCart(): StoredLine[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]') as StoredLine[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((line) => typeof line.sku === 'string' && Number.isInteger(line.quantity))
  } catch {
    return []
  }
}

export function writeCart(lines: StoredLine[]): void {
  localStorage.setItem(KEY, JSON.stringify(lines))
  window.dispatchEvent(new Event('tgt-cart'))
}

export function addToCart(sku: string): void {
  const lines = readCart()
  const found = lines.find((line) => line.sku === sku)
  if (found) found.quantity = Math.min(10, found.quantity + 1)
  else lines.push({ sku, quantity: 1 })
  writeCart(lines)
}

export function setQuantity(sku: string, quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) return
  const lines = readCart().map((line) => (line.sku === sku ? { ...line, quantity } : line))
  writeCart(lines.filter((line) => line.quantity > 0))
}

export function removeFromCart(sku: string): void {
  writeCart(readCart().filter((line) => line.sku !== sku))
}

export function pricedCart(): { ok: true; lines: PricedLine[]; totalCents: number } | { ok: false; error: string } {
  return priceCart(readCart(), catalog)
}
