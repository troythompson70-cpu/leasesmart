// Cart UI for the existing TGT Sites project only.
// This file does not create or capture a PayPal order.
// server/paypal.js sets the charge at 280.00 and captures it after PayPal approval.
// Do not create the PayPal order in the browser. The server owns the amount and the capture.

import { useEffect, useState } from 'react';

const emptyShip = { name: '', email: '', line1: '', line2: '', city: '', state: '', postalCode: '' };

export default function PayPalCheckout({ testMode = false } = {}) {
  const [status, setStatus] = useState('ready');
  const [message, setMessage] = useState('');
  const [brand, setBrand] = useState('');
  const [productId, setProductId] = useState('');
  const [products, setProducts] = useState([]);
  const [shipTo, setShipTo] = useState(emptyShip);
  const selected = products.find((product) => product.id === productId);
  const priceLabel = testMode ? '$1.00' : (selected?.amount ? `$${selected.amount}` : '$280.00');

  function updateShip(field, value) {
    setShipTo((current) => ({ ...current, [field]: value }));
  }

  useEffect(() => {
    fetch('/api/paypal/products')
      .then((response) => response.json())
      .then((body) => {
        if (Array.isArray(body?.products)) setProducts(body.products.filter((product) => product.id !== 'ebook-ai-made-simple'));
      })
      .catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    const params = new URLSearchParams(window.location.search);
    if (params.get('paypal') === 'cancelled') {
      setStatus('ready');
      setMessage('Checkout was cancelled. The laptop is still in the cart.');
      window.history.replaceState({}, '', '/cart');
      return;
    }
    const orderId = params.get('token');
    if (params.get('paypal') !== 'approved' || !orderId) return;
    setStatus('working');
    fetch('/api/paypal/capture-order', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId }),
    })
      .then(async (response) => ({ response, body: await response.json().catch(() => null) }))
      .then(({ response, body }) => {
        if (!response.ok || body?.status !== 'COMPLETED') throw new Error('capture_failed');
        setStatus('complete');
        setMessage('Payment complete. A confirmation email is on the way. Check the brand and ship-to address. Reply to that email if anything is wrong.');
        window.history.replaceState({}, '', '/cart');
      })
      .catch(() => {
        setStatus('error');
        setMessage('PayPal could not confirm the payment. Please contact TGT before trying again.');
      });
  }, []);

  async function startCheckout() {
    const postal = shipTo.postalCode.trim();
    const state = shipTo.state.trim().toUpperCase();
    if (!productId && !['Lenovo', 'HP', 'Other'].includes(brand)) {
      setStatus('error');
      setMessage('Choose a product.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shipTo.email.trim())) {
      setStatus('error');
      setMessage('Enter the email that should receive the confirmation.');
      return;
    }
    if (shipTo.name.trim().length < 2 || shipTo.line1.trim().length < 4 || shipTo.city.trim().length < 2 || !/^[A-Z]{2}$/.test(state) || !/^\d{5}(-\d{4})?$/.test(postal)) {
      setStatus('error');
      setMessage('Enter the full ship-to name, street, city, state, and ZIP code.');
      return;
    }
    setStatus('working');
    setMessage('Opening secure PayPal checkout…');
    try {
      const response = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          brand: selected?.brand || brand,
          productId: productId || undefined,
          testOrder: testMode,
          email: shipTo.email.trim(),
          shipTo: { name: shipTo.name, line1: shipTo.line1, line2: shipTo.line2, city: shipTo.city, state, postalCode: postal, country: 'US' },
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.approveUrl) throw new Error(body?.error || 'create_failed');
      window.location.assign(body.approveUrl);
    } catch {
      setStatus('error');
      setMessage('PayPal checkout is temporarily unavailable.');
    }
  }

  return (
    <section className="section-pad bg-slate-soft pt-28">
      <div className="wrap">
        <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-slate-line bg-white shadow-panel">
          <div className="border-b border-slate-line px-6 py-6 sm:px-8">
            <p className="eyebrow">Cart</p>
            <h1 className="mt-2 font-display text-3xl font-semibold text-navy-900">{testMode ? 'Test checkout' : 'Your cart'}</h1>
          </div>
          <div className="flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div>
              <p className="font-display text-xl font-semibold text-navy-900">{testMode ? 'TGT TEST ORDER - DO NOT SHIP' : `Refurbished laptop${brand ? ` · ${brand}` : ''}`}</p>
              <p className="mt-1 text-sm text-slate-muted">{testMode ? 'Production-safe PayPal checkout verification · no shipment' : 'Refurbished · 90-day hardware warranty · quantity 1'}</p>
            </div>
            <p className="font-display text-2xl font-semibold text-navy-900">{priceLabel}</p>
          </div>
          <form className="grid gap-4 border-t border-slate-line px-6 py-6 sm:grid-cols-2 sm:px-8" onSubmit={(event) => { event.preventDefault(); startCheckout(); }}>
            <fieldset className="sm:col-span-2">
              <legend className="font-display text-lg font-semibold text-navy-900">Laptop</legend>
              <p className="mt-1 text-sm text-slate-muted">{testMode ? 'Choose one test brand. Same $1 test price. No shipment.' : 'Choose one. Same $280 price. 90-day hardware warranty.'}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(products.length ? products : ['Lenovo', 'HP', 'Other'].map((choice) => ({ id: '', brand: choice, name: choice, amount: '280.00' }))).map((choice) => {
                  const active = choice.id ? productId === choice.id : brand === choice.brand;
                  return (
                    <label key={choice.id || choice.brand} className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-semibold ${active ? 'border-navy-900 bg-navy-900 text-white' : 'border-slate-line text-navy-900'}`}>
                      <input className="sr-only" type="radio" name="laptop-brand" value={choice.id || choice.brand} checked={active} onChange={() => { setProductId(choice.id); setBrand(choice.brand || ''); }} />
                      {choice.name}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div className="sm:col-span-2">
              <p className="font-display text-lg font-semibold text-navy-900">Where to ship it</p>
              <p className="mt-1 text-sm text-slate-muted">TGT uses this address only to ship the laptop.</p>
            </div>
            <label className="field-label sm:col-span-2">
              Recipient name
              <input className="field-input mt-1" value={shipTo.name} autoComplete="name" onChange={(event) => updateShip('name', event.target.value)} />
            </label>
            <label className="field-label sm:col-span-2">
              Confirmation email
              <input className="field-input mt-1" type="email" value={shipTo.email} autoComplete="email" onChange={(event) => updateShip('email', event.target.value)} />
            </label>
            <label className="field-label sm:col-span-2">
              Street
              <input className="field-input mt-1" value={shipTo.line1} autoComplete="address-line1" onChange={(event) => updateShip('line1', event.target.value)} />
            </label>
            <label className="field-label sm:col-span-2">
              Apartment, suite (optional)
              <input className="field-input mt-1" value={shipTo.line2} autoComplete="address-line2" onChange={(event) => updateShip('line2', event.target.value)} />
            </label>
            <label className="field-label">
              City
              <input className="field-input mt-1" value={shipTo.city} autoComplete="address-level2" onChange={(event) => updateShip('city', event.target.value)} />
            </label>
            <label className="field-label">
              State
              <input className="field-input mt-1" value={shipTo.state} autoComplete="address-level1" maxLength={2} onChange={(event) => updateShip('state', event.target.value)} />
            </label>
            <label className="field-label">
              ZIP code
              <input className="field-input mt-1" value={shipTo.postalCode} autoComplete="postal-code" inputMode="numeric" onChange={(event) => updateShip('postalCode', event.target.value)} />
            </label>
          </form>
          <div className="flex flex-col gap-4 border-t border-slate-line bg-slate-soft/50 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p className="text-base font-semibold text-navy-900">Total {priceLabel}</p>
            <button type="button" className="btn-primary" disabled={status === 'working' || status === 'complete'} onClick={startCheckout}>
              {status === 'working' ? 'Please wait…' : status === 'complete' ? 'Payment complete' : `Pay ${priceLabel} with PayPal`}
            </button>
          </div>
          {message ? <p className="px-6 pb-6 text-sm text-slate-muted sm:px-8" role="status">{message}</p> : null}
          <div className="border-t border-slate-line px-6 py-4 sm:px-8">
            <a href="/#current-offer" className="text-sm font-semibold text-brand-blue hover:text-navy-900">
              Back to the laptop
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
