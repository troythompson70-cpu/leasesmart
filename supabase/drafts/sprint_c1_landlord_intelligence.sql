-- =============================================================================
-- LeaseSmart Sprint C1 — landlord_intelligence (DRAFT ONLY)
-- DO NOT APPLY LIVE without Troy + attorney approval.
-- Draft for review. Mirrors future Supabase migration shape.
-- RLS: authenticated users see own rows OR rows marked is_public = true.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enum-like check for verification_status (8 levels)
-- ---------------------------------------------------------------------------
-- Imported | Public Source Verified | Contact Verified | Recently Contacted
-- Availability Confirmed | Needs Recheck | Inactive | Bad Lead

CREATE TABLE IF NOT EXISTS public.landlord_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  is_public boolean NOT NULL DEFAULT false,

  landlord_name text NOT NULL,
  property_name text,
  address text,
  city text,
  state text,
  zip text,
  county text,

  phone text,
  email text,
  website text,

  source_type text,
  source_url text,

  verification_status text NOT NULL DEFAULT 'Imported'
    CHECK (verification_status IN (
      'Imported',
      'Public Source Verified',
      'Contact Verified',
      'Recently Contacted',
      'Availability Confirmed',
      'Needs Recheck',
      'Inactive',
      'Bad Lead'
    )),

  verified_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  last_contacted_at timestamptz,
  availability_status text,
  program_notes text,
  warning_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  case_manager_notes text,
  neighborhood_notes text,
  next_recheck_date date,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.landlord_intelligence IS
  'Sprint C1 draft — landlord/property intelligence for case managers. DRAFT ONLY.';

CREATE INDEX IF NOT EXISTS idx_landlord_intelligence_user_id
  ON public.landlord_intelligence(user_id);

CREATE INDEX IF NOT EXISTS idx_landlord_intelligence_county
  ON public.landlord_intelligence(county);

CREATE INDEX IF NOT EXISTS idx_landlord_intelligence_verification_status
  ON public.landlord_intelligence(verification_status);

CREATE INDEX IF NOT EXISTS idx_landlord_intelligence_is_public
  ON public.landlord_intelligence(is_public)
  WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_landlord_intelligence_next_recheck_date
  ON public.landlord_intelligence(next_recheck_date);

DROP TRIGGER IF EXISTS trg_landlord_intelligence_updated_at ON public.landlord_intelligence;
CREATE TRIGGER trg_landlord_intelligence_updated_at
  BEFORE UPDATE ON public.landlord_intelligence
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.landlord_intelligence ENABLE ROW LEVEL SECURITY;

-- SELECT: own records OR public catalog records
CREATE POLICY landlord_intelligence_select_own_or_public ON public.landlord_intelligence
  FOR SELECT TO authenticated
  USING (
    user_id = public.current_app_user_id()
    OR is_public = true
  );

-- INSERT: only into own tenant scope
CREATE POLICY landlord_intelligence_insert_own ON public.landlord_intelligence
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_app_user_id());

-- UPDATE: only own records (public shared rows are read-only for non-owners)
CREATE POLICY landlord_intelligence_update_own ON public.landlord_intelligence
  FOR UPDATE TO authenticated
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

-- DELETE: only own records
CREATE POLICY landlord_intelligence_delete_own ON public.landlord_intelligence
  FOR DELETE TO authenticated
  USING (user_id = public.current_app_user_id());

-- NOTE: Service-role bulk import / public catalog seeding would use service role
-- outside the browser. Never expose service role key in frontend.
