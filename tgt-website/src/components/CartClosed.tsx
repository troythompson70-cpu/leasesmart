/**
 * Shown for a direct /cart visit while laptop checkout is off.
 * No payment button and no payment form.
 */
export function CartClosed() {
  return (
    <main className="min-h-screen bg-navy-950 text-white">
      <div className="wrap py-16">
        <p className="eyebrow !text-blue-200 before:!bg-brand-blue-light">TGT Technologies</p>
        <h1 className="mt-3 font-display text-4xl font-semibold">Laptop checkout is closed</h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-blue-50/80">
          The $280 laptop cart is not taking orders. No payment button is shown on this page.
        </p>
        <a href="/" className="btn-primary mt-8 inline-flex">
          Back to the homepage
        </a>
      </div>
    </main>
  )
}
