-- LeaseSmart Batch 2 Sprint A1 — Foundation schema + RLS
-- Apply in Supabase SQL Editor or via Supabase CLI.
-- Service role key must NEVER be used in frontend. RLS protects all tables.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helper: map Supabase Auth UUID -> internal users.id
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id FROM public.users u WHERE u.auth_user_id = auth.uid() LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_app_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated;

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  phone text,
  is_beta boolean NOT NULL DEFAULT true,
  user_type text NOT NULL DEFAULT 'renter',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own ON public.users
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY users_insert_own ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY users_update_own ON public.users
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. profiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  state text,
  city text,
  move_in_date date,
  budget_min numeric(10,2),
  budget_max numeric(10,2),
  beds text,
  baths text,
  commute_preferences jsonb DEFAULT '[]'::jsonb,
  pets text,
  parking text,
  laundry text,
  transit_preferences jsonb DEFAULT '[]'::jsonb,
  amenities jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = public.current_app_user_id());

CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_app_user_id());

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

-- ---------------------------------------------------------------------------
-- 3. listings (schema for Excel import — exact column names)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_name text NOT NULL,
  full_address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  zip text,
  unit text,
  rent_low numeric(10,2),
  rent_high numeric(10,2),
  beds numeric(4,1),
  baths numeric(4,1),
  square_feet integer,
  source_name text,
  direct_listing_url text,
  official_property_url text,
  management_company text,
  phone text,
  email text,
  last_verified_date date,
  import_status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listings_city_state ON public.listings(city, state);
CREATE INDEX IF NOT EXISTS idx_listings_import_status ON public.listings(import_status);

DROP TRIGGER IF EXISTS trg_listings_updated_at ON public.listings;
CREATE TRIGGER trg_listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY listings_select_authenticated ON public.listings
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- 4. saved_listings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'NOT CALLED',
  notes text,
  is_favorite boolean NOT NULL DEFAULT false,
  saved_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_listings_user_id ON public.saved_listings(user_id);

DROP TRIGGER IF EXISTS trg_saved_listings_updated_at ON public.saved_listings;
CREATE TRIGGER trg_saved_listings_updated_at
  BEFORE UPDATE ON public.saved_listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.saved_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY saved_listings_select_own ON public.saved_listings
  FOR SELECT TO authenticated
  USING (user_id = public.current_app_user_id());

CREATE POLICY saved_listings_insert_own ON public.saved_listings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_app_user_id());

CREATE POLICY saved_listings_update_own ON public.saved_listings
  FOR UPDATE TO authenticated
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

CREATE POLICY saved_listings_delete_own ON public.saved_listings
  FOR DELETE TO authenticated
  USING (user_id = public.current_app_user_id());

-- ---------------------------------------------------------------------------
-- 5. feedback
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  category text,
  type text,
  severity text,
  rating text,
  comment text,
  page text,
  tab text,
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  app_version text,
  validated boolean NOT NULL DEFAULT false,
  validated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  validation_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY feedback_select_own ON public.feedback
  FOR SELECT TO authenticated
  USING (user_id = public.current_app_user_id());

CREATE POLICY feedback_insert_own ON public.feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_app_user_id() OR user_id IS NULL);

-- ---------------------------------------------------------------------------
-- 6. saved_searches
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  search_label text,
  search_filters_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON public.saved_searches(user_id);

DROP TRIGGER IF EXISTS trg_saved_searches_updated_at ON public.saved_searches;
CREATE TRIGGER trg_saved_searches_updated_at
  BEFORE UPDATE ON public.saved_searches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY saved_searches_select_own ON public.saved_searches
  FOR SELECT TO authenticated
  USING (user_id = public.current_app_user_id());

CREATE POLICY saved_searches_insert_own ON public.saved_searches
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_app_user_id());

CREATE POLICY saved_searches_update_own ON public.saved_searches
  FOR UPDATE TO authenticated
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

CREATE POLICY saved_searches_delete_own ON public.saved_searches
  FOR DELETE TO authenticated
  USING (user_id = public.current_app_user_id());

-- ---------------------------------------------------------------------------
-- 7. sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_session_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  device_info text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY sessions_select_own ON public.sessions
  FOR SELECT TO authenticated
  USING (user_id = public.current_app_user_id());

CREATE POLICY sessions_insert_own ON public.sessions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_app_user_id());

CREATE POLICY sessions_update_own ON public.sessions
  FOR UPDATE TO authenticated
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

-- ---------------------------------------------------------------------------
-- 8. beta_agreements (insert-only for testers)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.beta_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  nda_version text NOT NULL,
  terms_version text NOT NULL,
  agreement_url text,
  app_version text NOT NULL,
  accepted boolean NOT NULL DEFAULT false,
  scroll_confirmed boolean NOT NULL DEFAULT false,
  accepted_at timestamptz,
  user_agent text,
  ip_address inet,
  referral_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beta_agreements_user_id ON public.beta_agreements(user_id);

ALTER TABLE public.beta_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY beta_agreements_insert_own ON public.beta_agreements
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = public.current_app_user_id()
    AND accepted = true
    AND scroll_confirmed = true
  );

CREATE POLICY beta_agreements_select_own ON public.beta_agreements
  FOR SELECT TO authenticated
  USING (user_id = public.current_app_user_id());

-- No UPDATE or DELETE policies for authenticated (insert-only acceptance)

-- ---------------------------------------------------------------------------
-- 9. referrals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  referred_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  referral_code text,
  qr_code_url text,
  referral_link text,
  signup_completed boolean NOT NULL DEFAULT false,
  nda_completed boolean NOT NULL DEFAULT false,
  questionnaire_completed boolean NOT NULL DEFAULT false,
  feedback_completed boolean NOT NULL DEFAULT false,
  completion_percentage numeric(5,2) NOT NULL DEFAULT 0,
  reward_eligible boolean NOT NULL DEFAULT false,
  reward_approved boolean NOT NULL DEFAULT false,
  reward_paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON public.referrals(referred_user_id);

DROP TRIGGER IF EXISTS trg_referrals_updated_at ON public.referrals;
CREATE TRIGGER trg_referrals_updated_at
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY referrals_select_own ON public.referrals
  FOR SELECT TO authenticated
  USING (
    referrer_user_id = public.current_app_user_id()
    OR referred_user_id = public.current_app_user_id()
  );

-- No INSERT/UPDATE for authenticated testers (service role only for reward fields)

-- ---------------------------------------------------------------------------
-- 10. notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  channel text NOT NULL,
  sent_at timestamptz,
  delivery_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

DROP TRIGGER IF EXISTS trg_notifications_updated_at ON public.notifications;
CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = public.current_app_user_id());

-- No INSERT/UPDATE for authenticated (service role only)

-- ---------------------------------------------------------------------------
-- 11. listing_verifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.listing_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  verified_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_verifications_listing_id ON public.listing_verifications(listing_id);

DROP TRIGGER IF EXISTS trg_listing_verifications_updated_at ON public.listing_verifications;
CREATE TRIGGER trg_listing_verifications_updated_at
  BEFORE UPDATE ON public.listing_verifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.listing_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY listing_verifications_select_authenticated ON public.listing_verifications
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

-- No INSERT/UPDATE for authenticated testers (service role only)
