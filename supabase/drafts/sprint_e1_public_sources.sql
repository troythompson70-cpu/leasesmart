-- DRAFT ONLY — Sprint E1 public source integrations

CREATE TABLE IF NOT EXISTS public.e1_public_source_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system TEXT NOT NULL,
  source_label TEXT NOT NULL,
  source_url TEXT,
  landlord_intel_id UUID,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_demo BOOLEAN NOT NULL DEFAULT true,
  no_pii BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.e1_benefits_screenings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_size INT NOT NULL,
  income_band TEXT NOT NULL,
  eligible_programs JSONB NOT NULL DEFAULT '[]'::jsonb,
  draft_only BOOLEAN NOT NULL DEFAULT true,
  no_pii BOOLEAN NOT NULL DEFAULT true,
  screened_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.e1_hud_fmr_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  county TEXT NOT NULL,
  bedrooms INT NOT NULL,
  fmr_amount_usd NUMERIC(10,2) NOT NULL,
  fmr_year INT NOT NULL DEFAULT 2026,
  demo_only BOOLEAN NOT NULL DEFAULT true
);

COMMENT ON TABLE public.e1_public_source_imports IS 'E1 draft — HPD/NJ HRC public sources';
