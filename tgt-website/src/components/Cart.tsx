import { useEffect, useState } from 'react'
import { formatUsd } from '../lib/catalog'
import { pricedCart, readCart, removeFromCart, setQuantity } from '../lib/cart-store'

function useCartVersion(): number {
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const refresh = () => setVersion((value) => value + 1)
    window.addEventListener('tgt-cart', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('tgt-cart', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])
  return version
}

export function CartCount() {
  useCartVersion()
  const count = readCart().reduce((sum, line) => sum + line.quantity, 0)
  return (
    <a href="/cart" className="text-sm font-bold underline" data-cta="nav-cart">
      Cart{count > 0 ? ` (${count})` : ''}
    </a>
  )
}

export function CartPage() {
  useCartVersion()
  const priced = pricedCart()
  const lines = priced.ok ? priced.lines : []
  return (
    <main className="wrap section-pad">
      <h1 className="font-display text-3xl font-semibold text-navy-900">Cart</h1>
      {lines.length === 0 ? <p className="mt-4 text-slate-muted">Your cart is empty.</p> : null}
      <ul className="mt-6 space-y-4">
        {lines.map((line) => (
          <li key={line.sku} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-line p-4">
            <div>
              <p className="font-semibold text-navy-900">{line.name}</p>
              <p className="text-sm text-slate-muted">${formatUsd(line.priceCents)} each</p>
            </div>
            <label className="text-sm font-semibold">
              Qty
              <input
                className="ml-2 w-16 rounded border border-slate-line px-2 py-1"
                type="number"
                min={1}
                max={10}
                value={line.quantity}
                onChange={(event) => setQuantity(line.sku, Number(event.target.value))}
              />
            </label>
            <p className="font-semibold">${formatUsd(line.lineCents)}</p>
            <button type="button" className="text-sm font-bold text-brand-blue" onClick={() => removeFromCart(line.sku)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      {priced.ok ? (
        <div className="mt-8">
          <p className="text-xl font-semibold text-navy-900">Total ${formatUsd(priced.totalCents)}</p>
          <a href="/checkout" className="btn-primary mt-4 inline-block">
            Checkout
          </a>
        </div>
      ) : null}
      <a href="/" className="mt-6 inline-block text-sm font-semibold text-brand-blue">
        Back to the site
      </a>
    </main>
  )
}

type PaypalButtons = {
  Buttons: (options: {
    createOrder: () => Promise<string>
    onApprove: (data: { orderID?: string }) => Promise<void>
    onCancel: () => void
    onError: () => void
  }) => { render: (selector: string) => Promise<void> }
}

declare global {
  interface Window {
    paypal?: PaypalButtons
  }
}

export function CheckoutPage() {
  const [error, setError] = useState('')
  const priced = pricedCart()

  useEffect(() => {
    if (!priced.ok) return
    let cancelled = false
    const mount = async () => {
      const configRes = await fetch('/api/paypal/config')
      const config = (await configRes.json()) as { clientId?: string; error?: string }
      if (!configRes.ok || !config.clientId) {
        if (!cancelled) setError(config.error || 'PayPal is not configured.')
        return
      }
      if (JSON.stringify(config).toLowerCase().includes('secret')) {
        if (!cancelled) setError('PayPal config refused.')
        return
      }
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(config.clientId || '')}&currency=USD&intent=capture`
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('PayPal script failed to load.'))
        document.body.appendChild(script)
      })
      if (cancelled || !window.paypal) return
      await window.paypal.Buttons({
        createOrder: async () => {
          const res = await fetch('/api/paypal/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: readCart() }),
          })
          const body = (await res.json()) as { orderId?: string; error?: string }
          if (!res.ok || !body.orderId) throw new Error(body.error || 'Could not start PayPal.')
          return body.orderId
        },
        onApprove: async (data?: { orderID?: string }) => {
          const orderId = data?.orderID
          const res = await fetch('/api/paypal/capture', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, items: readCart() }),
          })
          const body = (await res.json()) as { error?: string }
          if (!res.ok) throw new Error(body.error || 'Capture failed.')
          window.location.assign(`/order/confirmed?order=${encodeURIComponent(orderId || '')}`)
        },
        onCancel: () => window.location.assign('/order/cancelled'),
        onError: () => window.location.assign('/order/failed'),
      }).render('#paypal-buttons')
    }
    void mount().catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Checkout failed.')
    })
    return () => {
      cancelled = true
    }
  }, [priced.ok])

  return (
    <main className="wrap section-pad">
      <h1 className="font-display text-3xl font-semibold text-navy-900">Checkout</h1>
      <p className="mt-2 text-sm text-slate-muted">Sandbox only. Card and PayPal are on the buttons below.</p>
      {priced.ok ? <p className="mt-4 text-xl font-semibold">Total ${formatUsd(priced.totalCents)}</p> : <p className="mt-4">{priced.error}</p>}
      {error ? <p className="mt-4 text-red-700">{error}</p> : null}
      <div id="paypal-buttons" className="mt-6 max-w-md" />
    </main>
  )
}

export function OrderResult({ kind }: { kind: 'confirmed' | 'cancelled' | 'failed' }) {
  const order = new URLSearchParams(window.location.search).get('order')
  const title = kind === 'confirmed' ? 'Order received' : kind === 'cancelled' ? 'Checkout cancelled' : 'Checkout failed'
  const detail =
    kind === 'confirmed'
      ? `PayPal order ${order || ''} is captured. A pipeline row uses ORD- plus that order id.`
      : kind === 'cancelled'
        ? 'No charge was made. You can return to the cart.'
        : 'The payment did not complete. You can try checkout again.'
  return (
    <main className="wrap section-pad">
      <h1 className="font-display text-3xl font-semibold text-navy-900">{title}</h1>
      <p className="mt-4 max-w-xl text-slate-muted">{detail}</p>
      <a href="/cart" className="btn-primary mt-6 inline-block">
        Back to cart
      </a>
    </main>
  )
}
