-- DRAFT ONLY — Sprint E3 Stripe billing skeleton
-- TEST MODE — DO NOT apply to production without Stripe + legal review.

-- Subscription preview (test mode only)
CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'test_skeleton',
  test_mode BOOLEAN NOT NULL DEFAULT true,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Invoice history preview
CREATE TABLE IF NOT EXISTS billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  stripe_invoice_id TEXT,
  amount_cents INT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'demo_paid',
  test_mode BOOLEAN NOT NULL DEFAULT true,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stripe webhook event log (skeleton)
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB,
  test_mode BOOLEAN NOT NULL DEFAULT true,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
