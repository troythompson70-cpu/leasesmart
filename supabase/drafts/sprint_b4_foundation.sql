-- =============================================================================
-- LeaseSmart Sprint B4-Foundation — Agency Case Management (DRAFT ONLY)
-- DO NOT APPLY LIVE without Troy + attorney approval.
-- Architecture skeleton. Mock/demo data only in frontend until approved.
--
-- TRIPLE REDUNDANCY (planned):
--   1. RLS rules below — database enforces agency + role scope
--   2. Frontend hides unauthorized records (see index.html B4 workspace)
--   3. Frontend queries request authorized records only (b4QueryAuthorizedClients)
--
-- ROLES: client, caseworker, supervisor, manager, director, agency_admin, platform_admin
-- RULE: No cross-agency access ever (except platform_admin read-only oversight).
-- ALL mutating actions → case_access_audit_log.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: current user's agency membership
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_app_user_agency_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT au.agency_id
  FROM public.agency_users au
  WHERE au.user_id = public.current_app_user_id()
    AND au.status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_app_user_role_key()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ar.role_key
  FROM public.agency_users au
  JOIN public.agency_roles ar ON ar.id = au.agency_role_id
  WHERE au.user_id = public.current_app_user_id()
    AND au.status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_app_user_role_key() = 'platform_admin', false);
$$;

CREATE OR REPLACE FUNCTION public.same_agency(check_agency_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT check_agency_id IS NOT NULL
    AND check_agency_id = public.current_app_user_agency_id();
$$;

-- Caseworker assigned to client?
CREATE OR REPLACE FUNCTION public.is_assigned_caseworker(p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_assignments ca
    WHERE ca.case_client_id = p_client_id
      AND ca.assigned_user_id = public.current_app_user_id()
      AND ca.active = true
      AND ca.agency_id = public.current_app_user_agency_id()
  );
$$;

-- Supervisor over caseworker who owns assignment?
CREATE OR REPLACE FUNCTION public.is_supervisor_of_client(p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_assignments ca
    JOIN public.supervisor_teams st
      ON st.member_user_id = ca.assigned_user_id
     AND st.agency_id = ca.agency_id
    WHERE ca.case_client_id = p_client_id
      AND ca.active = true
      AND st.supervisor_user_id = public.current_app_user_id()
      AND ca.agency_id = public.current_app_user_agency_id()
  );
$$;

-- Client owns case record?
CREATE OR REPLACE FUNCTION public.is_own_client_record(p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.case_clients cc
    WHERE cc.id = p_client_id
      AND cc.client_user_id = public.current_app_user_id()
      AND cc.agency_id = public.current_app_user_agency_id()
  );
$$;

-- Agency-level roles (director, manager, agency_admin)
CREATE OR REPLACE FUNCTION public.has_agency_level_access(p_agency_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.same_agency(p_agency_id)
    AND public.current_app_user_role_key() IN ('director', 'manager', 'agency_admin');
$$;

-- ---------------------------------------------------------------------------
-- agencies
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'pending')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.agencies IS 'B4 draft — housing agencies. DRAFT ONLY.';

-- ---------------------------------------------------------------------------
-- agency_roles — role definitions per agency (or template roles)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agency_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  role_key text NOT NULL
    CHECK (role_key IN (
      'client', 'caseworker', 'supervisor', 'manager',
      'director', 'agency_admin', 'platform_admin'
    )),
  display_name text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, role_key)
);

COMMENT ON TABLE public.agency_roles IS 'B4 draft — role permission templates per agency.';

-- ---------------------------------------------------------------------------
-- agency_users — links users to agency + role
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agency_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agency_role_id uuid NOT NULL REFERENCES public.agency_roles(id) ON DELETE RESTRICT,
  supervisor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, user_id)
);

COMMENT ON TABLE public.agency_users IS 'B4 draft — agency membership. No cross-agency membership in v1.';

-- ---------------------------------------------------------------------------
-- supervisor_teams — supervisor → caseworker mapping within agency
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supervisor_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  supervisor_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  member_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, supervisor_user_id, member_user_id),
  CHECK (supervisor_user_id <> member_user_id)
);

COMMENT ON TABLE public.supervisor_teams IS 'B4 draft — supervisor caseload team roster.';

-- ---------------------------------------------------------------------------
-- case_clients — client case records (mock flag for demo data)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  case_number text NOT NULL,
  status text NOT NULL DEFAULT 'intake'
    CHECK (status IN ('intake', 'active', 'follow_up', 'placed', 'closed', 'on_hold')),
  placement_type text,
  is_mock boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, case_number)
);

COMMENT ON TABLE public.case_clients IS 'B4 draft — client cases. is_mock=true for demo skeleton.';

-- ---------------------------------------------------------------------------
-- client_assignments — caseworker ↔ client
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  case_client_id uuid NOT NULL REFERENCES public.case_clients(id) ON DELETE CASCADE,
  assigned_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

COMMENT ON TABLE public.client_assignments IS 'B4 draft — active caseworker assignments.';

-- ---------------------------------------------------------------------------
-- case_notes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  case_client_id uuid NOT NULL REFERENCES public.case_clients(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  note_body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.case_notes IS 'B4 draft — case notes tied to assigned client scope.';

-- ---------------------------------------------------------------------------
-- case_status_history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  case_client_id uuid NOT NULL REFERENCES public.case_clients(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- case_reassignment_log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_reassignment_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  case_client_id uuid NOT NULL REFERENCES public.case_clients(id) ON DELETE CASCADE,
  from_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  to_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reassigned_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason text,
  reassigned_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- case_access_audit_log — ALL actions audit logged
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_access_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.case_access_audit_log IS 'B4 draft — immutable audit trail for case access and mutations.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_agency_users_agency ON public.agency_users(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_users_user ON public.agency_users(user_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_teams_supervisor ON public.supervisor_teams(supervisor_user_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_teams_member ON public.supervisor_teams(member_user_id);
CREATE INDEX IF NOT EXISTS idx_case_clients_agency ON public.case_clients(agency_id);
CREATE INDEX IF NOT EXISTS idx_case_clients_client_user ON public.case_clients(client_user_id);
CREATE INDEX IF NOT EXISTS idx_client_assignments_client ON public.client_assignments(case_client_id);
CREATE INDEX IF NOT EXISTS idx_client_assignments_caseworker ON public.client_assignments(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_case_notes_client ON public.case_notes(case_client_id);
CREATE INDEX IF NOT EXISTS idx_case_access_audit_agency ON public.case_access_audit_log(agency_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_agencies_updated_at ON public.agencies;
CREATE TRIGGER trg_agencies_updated_at BEFORE UPDATE ON public.agencies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_agency_roles_updated_at ON public.agency_roles;
CREATE TRIGGER trg_agency_roles_updated_at BEFORE UPDATE ON public.agency_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_agency_users_updated_at ON public.agency_users;
CREATE TRIGGER trg_agency_users_updated_at BEFORE UPDATE ON public.agency_users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_case_clients_updated_at ON public.case_clients;
CREATE TRIGGER trg_case_clients_updated_at BEFORE UPDATE ON public.case_clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_case_notes_updated_at ON public.case_notes;
CREATE TRIGGER trg_case_notes_updated_at BEFORE UPDATE ON public.case_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY — no cross-agency access ever
-- ---------------------------------------------------------------------------

ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervisor_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_reassignment_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_access_audit_log ENABLE ROW LEVEL SECURITY;

-- agencies: own agency only; platform_admin sees all (read)
CREATE POLICY agencies_select ON public.agencies FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR id = public.current_app_user_agency_id());

-- agency_roles: same agency
CREATE POLICY agency_roles_select ON public.agency_roles FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.same_agency(agency_id));

-- agency_users: same agency
CREATE POLICY agency_users_select ON public.agency_users FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.same_agency(agency_id));

-- supervisor_teams: same agency; supervisor sees own team; directors see agency
CREATE POLICY supervisor_teams_select ON public.supervisor_teams FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR (public.same_agency(agency_id) AND (
      supervisor_user_id = public.current_app_user_id()
      OR public.has_agency_level_access(agency_id)
    ))
  );

-- case_clients SELECT — role-scoped, same agency only
CREATE POLICY case_clients_select ON public.case_clients FOR SELECT TO authenticated
  USING (
    public.is_platform_admin()
    OR (
      public.same_agency(agency_id)
      AND (
        public.is_own_client_record(id)
        OR public.is_assigned_caseworker(id)
        OR public.is_supervisor_of_client(id)
        OR public.has_agency_level_access(agency_id)
      )
    )
  );

-- case_clients INSERT/UPDATE — agency_admin, director, manager only
CREATE POLICY case_clients_write ON public.case_clients FOR ALL TO authenticated
  USING (public.same_agency(agency_id) AND public.has_agency_level_access(agency_id))
  WITH CHECK (public.same_agency(agency_id) AND public.has_agency_level_access(agency_id));

-- client_assignments — read if can see client; write agency-level
CREATE POLICY client_assignments_select ON public.client_assignments FOR SELECT TO authenticated
  USING (
    public.same_agency(agency_id)
    AND (
      assigned_user_id = public.current_app_user_id()
      OR public.is_supervisor_of_client(case_client_id)
      OR public.has_agency_level_access(agency_id)
      OR public.is_own_client_record(case_client_id)
    )
  );

CREATE POLICY client_assignments_write ON public.client_assignments FOR ALL TO authenticated
  USING (public.same_agency(agency_id) AND public.has_agency_level_access(agency_id))
  WITH CHECK (public.same_agency(agency_id) AND public.has_agency_level_access(agency_id));

-- case_notes — author must be assigned caseworker OR agency-level; client read own
CREATE POLICY case_notes_select ON public.case_notes FOR SELECT TO authenticated
  USING (
    public.same_agency(agency_id)
    AND (
      public.is_own_client_record(case_client_id)
      OR public.is_assigned_caseworker(case_client_id)
      OR public.is_supervisor_of_client(case_client_id)
      OR public.has_agency_level_access(agency_id)
    )
  );

CREATE POLICY case_notes_insert ON public.case_notes FOR INSERT TO authenticated
  WITH CHECK (
    public.same_agency(agency_id)
    AND author_user_id = public.current_app_user_id()
    AND (
      public.is_assigned_caseworker(case_client_id)
      OR public.has_agency_level_access(agency_id)
    )
  );

CREATE POLICY case_notes_update ON public.case_notes FOR UPDATE TO authenticated
  USING (
    public.same_agency(agency_id)
    AND author_user_id = public.current_app_user_id()
    AND public.is_assigned_caseworker(case_client_id)
  );

-- case_status_history — read with client access; insert agency or assigned caseworker
CREATE POLICY case_status_history_select ON public.case_status_history FOR SELECT TO authenticated
  USING (
    public.same_agency(agency_id)
    AND (
      public.is_assigned_caseworker(case_client_id)
      OR public.is_supervisor_of_client(case_client_id)
      OR public.has_agency_level_access(agency_id)
      OR public.is_own_client_record(case_client_id)
    )
  );

CREATE POLICY case_status_history_insert ON public.case_status_history FOR INSERT TO authenticated
  WITH CHECK (
    public.same_agency(agency_id)
    AND changed_by_user_id = public.current_app_user_id()
    AND (
      public.is_assigned_caseworker(case_client_id)
      OR public.has_agency_level_access(agency_id)
    )
  );

-- case_reassignment_log — agency-level read/write
CREATE POLICY case_reassignment_log_select ON public.case_reassignment_log FOR SELECT TO authenticated
  USING (public.same_agency(agency_id) AND public.has_agency_level_access(agency_id));

CREATE POLICY case_reassignment_log_insert ON public.case_reassignment_log FOR INSERT TO authenticated
  WITH CHECK (
    public.same_agency(agency_id)
    AND reassigned_by_user_id = public.current_app_user_id()
    AND public.has_agency_level_access(agency_id)
  );

-- audit log — insert any authenticated actor in agency; read agency-level + own actor rows
CREATE POLICY case_access_audit_insert ON public.case_access_audit_log FOR INSERT TO authenticated
  WITH CHECK (
    public.same_agency(agency_id)
    AND actor_user_id = public.current_app_user_id()
  );

CREATE POLICY case_access_audit_select ON public.case_access_audit_log FOR SELECT TO authenticated
  USING (
    public.same_agency(agency_id)
    AND (
      actor_user_id = public.current_app_user_id()
      OR public.has_agency_level_access(agency_id)
      OR public.current_app_user_role_key() = 'supervisor'
    )
  );

-- NOTE: Service-role bulk seeding uses service role outside browser.
-- Never expose service role key in frontend.
