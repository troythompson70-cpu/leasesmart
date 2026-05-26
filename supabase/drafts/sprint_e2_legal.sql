-- DRAFT ONLY — Sprint E2 legal framework
-- DO NOT apply to production. Attorney review required.

-- Client consent audit trail (mock schema preview)
CREATE TABLE IF NOT EXISTS client_consent_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  agency_id UUID NOT NULL,
  consent_type TEXT NOT NULL,
  consent_text_version TEXT NOT NULL,
  recorded_by UUID NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_mock BOOLEAN NOT NULL DEFAULT true
);

-- Cookie preference (server-side sync preview)
CREATE TABLE IF NOT EXISTS cookie_preferences (
  user_id UUID PRIMARY KEY,
  choice TEXT NOT NULL CHECK (choice IN ('accepted', 'declined')),
  policy_version TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Data retention policy preview
CREATE TABLE IF NOT EXISTS data_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID,
  retention_days INT NOT NULL,
  draft_only BOOLEAN NOT NULL DEFAULT true,
  attorney_approved BOOLEAN NOT NULL DEFAULT false
);
