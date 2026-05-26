-- =============================================================================
-- LeaseSmart Sprint D4 — rate limits, session audit, security log (DRAFT ONLY)
-- DO NOT APPLY LIVE without Troy + attorney approval.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  minute_bucket text NOT NULL,
  call_count integer NOT NULL DEFAULT 0,
  is_mock boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, minute_bucket)
);

COMMENT ON TABLE public.api_rate_limits IS
  'D4 draft — per-user per-minute API call counters.';

CREATE TABLE IF NOT EXISTS public.security_event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('failed_login', 'session_expired', 'rate_limited')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  attempt_count integer,
  is_mock boolean NOT NULL DEFAULT true
);

COMMENT ON TABLE public.security_event_log IS
  'D4 draft — security events. Timestamp and count only — no PII stored.';
