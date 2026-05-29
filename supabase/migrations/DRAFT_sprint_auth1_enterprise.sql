-- DRAFT — Sprint AUTH-1 Enterprise org + staff schema
-- DO NOT APPLY without Troy approval + Claude review + backup checkpoint.
-- Service role key must NEVER be used in frontend.

-- Organizations / tenants
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  sandbox_mode boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);

-- Staff mapped to auth.users — NO password columns
CREATE TABLE IF NOT EXISTS public.organization_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  auth_uid uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  full_name text,
  role text NOT NULL CHECK (role IN ('platform_admin', 'admin', 'supervisor', 'case_manager', 'viewer', 'auditor')),
  is_active boolean NOT NULL DEFAULT true,
  archived_at timestamptz,
  deactivated_at timestamptz,
  deactivated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_staff_auth_uid
  ON public.organization_staff(auth_uid) WHERE auth_uid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organization_staff_org ON public.organization_staff(organization_id);

-- Pending invites — NOT active until auth callback confirms auth.uid()
CREATE TABLE IF NOT EXISTS public.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'supervisor', 'case_manager', 'viewer', 'auditor')),
  invite_token text UNIQUE,
  token_expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_auth_uid uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organization_invites_org ON public.organization_invites(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_invites_email ON public.organization_invites(email);

-- Audit logs
CREATE TABLE IF NOT EXISTS public.organization_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_uid uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_record_type text,
  target_record_id uuid,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organization_audit_org ON public.organization_audit_logs(organization_id);

-- Case manager clients — demo/sandbox fields only until legal clearance
CREATE TABLE IF NOT EXISTS public.case_manager_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_staff_id uuid REFERENCES public.organization_staff(id) ON DELETE SET NULL,
  display_name text,
  household_size int,
  adults int,
  children int,
  bedroom_need int,
  rent_range_min int,
  rent_range_max int,
  voucher_type text,
  preferred_city text,
  preferred_state text,
  urgency text,
  is_demo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_manager_clients_org ON public.case_manager_clients(organization_id);

-- Helper: current staff org
CREATE OR REPLACE FUNCTION public.auth1_current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.organization_staff
  WHERE auth_uid = auth.uid() AND is_active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.auth1_current_organization_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth1_current_organization_id() TO authenticated;

-- RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_manager_clients ENABLE ROW LEVEL SECURITY;

-- Staff see own org only
CREATE POLICY auth1_staff_org_isolation ON public.organization_staff
  FOR SELECT TO authenticated
  USING (organization_id = public.auth1_current_organization_id());

CREATE POLICY auth1_clients_org_isolation ON public.case_manager_clients
  FOR ALL TO authenticated
  USING (organization_id = public.auth1_current_organization_id())
  WITH CHECK (organization_id = public.auth1_current_organization_id());

CREATE POLICY auth1_audit_org_isolation ON public.organization_audit_logs
  FOR SELECT TO authenticated
  USING (organization_id = public.auth1_current_organization_id());

-- Invites: admins in org only (simplified — expand with role check in app layer)
CREATE POLICY auth1_invites_org_isolation ON public.organization_invites
  FOR SELECT TO authenticated
  USING (organization_id = public.auth1_current_organization_id());

-- NOTE: Platform admin cross-org policies require separate service-role admin tools.
-- Frontend must NOT bypass RLS with service role key.
