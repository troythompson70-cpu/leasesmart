-- =============================================================================
-- LeaseSmart Sprint D2 — saved search alerts + landlord contact history (DRAFT ONLY)
-- DO NOT APPLY LIVE without Troy + attorney approval.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.saved_search_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  seen_landlord_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_checked_at timestamptz,
  is_mock boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.saved_search_profiles IS
  'D2 draft — saved landlord intel search profiles with alert matching.';

CREATE TABLE IF NOT EXISTS public.landlord_contact_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_intel_id uuid NOT NULL REFERENCES public.landlord_intelligence(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  contact_date date NOT NULL,
  method text NOT NULL
    CHECK (method IN ('Phone', 'Email', 'Text', 'In person')),
  outcome text NOT NULL DEFAULT 'No answer',
  notes text NOT NULL DEFAULT '',
  is_mock boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.landlord_contact_history IS
  'D2 draft — contact attempt log tied to landlord_intelligence records only.';

-- Extend landlord_intelligence with program_compatibility (draft column)
-- ALTER TABLE public.landlord_intelligence ADD COLUMN IF NOT EXISTS program_compatibility text;
