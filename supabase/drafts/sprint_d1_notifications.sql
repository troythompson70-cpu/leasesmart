-- =============================================================================
-- LeaseSmart Sprint D1 — Email + in-app notifications (DRAFT ONLY)
-- DO NOT APPLY LIVE without Troy + attorney approval.
-- Uses Supabase email when configured; otherwise notification_outbox queue only.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE,
  recipient_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  recipient_email text,
  notification_type text NOT NULL
    CHECK (notification_type IN (
      'caseworker_assigned',
      'supervisor_reassigned',
      'case_status_changed',
      'follow_up_due',
      'follow_up_overdue'
    )),
  subject text NOT NULL,
  body_text text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'queued', 'sent', 'failed', 'skipped_no_email_service')),
  is_mock boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

COMMENT ON TABLE public.notification_outbox IS
  'D1 draft — email notification queue. Draft/skipped until Supabase email live.';

CREATE TABLE IF NOT EXISTS public.in_app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  alert_type text NOT NULL DEFAULT 'info',
  is_read boolean NOT NULL DEFAULT false,
  is_mock boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.in_app_notifications IS
  'D1 draft — in-app notification panel records. Mock until live.';

CREATE INDEX IF NOT EXISTS idx_notification_outbox_status ON public.notification_outbox(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user ON public.in_app_notifications(user_id, is_read, created_at DESC);

ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;

-- Users see own in-app notifications within agency
CREATE POLICY in_app_notifications_select_own ON public.in_app_notifications
  FOR SELECT TO authenticated
  USING (
    user_id = public.current_app_user_id()
    AND (agency_id IS NULL OR public.same_agency(agency_id))
  );

CREATE POLICY in_app_notifications_update_own ON public.in_app_notifications
  FOR UPDATE TO authenticated
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

-- Outbox: agency staff see own agency; insert via service role or authorized app logic
CREATE POLICY notification_outbox_select_agency ON public.notification_outbox
  FOR SELECT TO authenticated
  USING (agency_id IS NULL OR public.same_agency(agency_id) OR public.is_platform_admin());

CREATE POLICY notification_outbox_insert_draft ON public.notification_outbox
  FOR INSERT TO authenticated
  WITH CHECK (
    is_mock = true
    OR public.same_agency(agency_id)
  );

-- NOTE: Live email send uses Supabase Auth/Edge Function or SMTP — never service role in browser.
-- Frontend calls d1QueueEmail placeholder until email service approved.
