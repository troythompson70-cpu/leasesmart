/**
 * LeaseSmart Sprint B4-Foundation — Role permission model (skeleton)
 * Mirrors supabase/drafts/sprint_b4_foundation.sql intent for frontend + tests.
 * Triple redundancy: RLS (SQL) + UI hide + query/function guards
 */

export const B4_ROLES = [
  'client',
  'caseworker',
  'supervisor',
  'manager',
  'director',
  'agency_admin',
  'platform_admin',
];

/** Default per agency — customizable later via user_management_permissions table */
export const B4_DEFAULT_USER_MGMT_PERMISSIONS = {
  client: { can_add_users: false, can_delete_users: false, can_reassign_cases: false },
  caseworker: { can_add_users: false, can_delete_users: false, can_reassign_cases: false },
  supervisor: { can_add_users: true, can_delete_users: true, can_reassign_cases: true },
  manager: { can_add_users: true, can_delete_users: true, can_reassign_cases: true },
  director: { can_add_users: true, can_delete_users: true, can_reassign_cases: true },
  agency_admin: { can_add_users: true, can_delete_users: true, can_reassign_cases: true },
  platform_admin: { can_add_users: true, can_delete_users: true, can_reassign_cases: true },
};

export function b4GetUserMgmtPermissions(ctx, agencyOverrides) {
  const role = ctx && ctx.roleKey;
  const base = B4_DEFAULT_USER_MGMT_PERMISSIONS[role] || {
    can_add_users: false,
    can_delete_users: false,
    can_reassign_cases: false,
  };
  if (!agencyOverrides || !agencyOverrides[role]) return Object.assign({}, base);
  return Object.assign({}, base, agencyOverrides[role]);
}

/** Layer 3 — query logic: caseworker cannot call user management */
export function b4CanAddUsers(ctx, agencyOverrides) {
  if (!ctx || !ctx.roleKey) return false;
  if (ctx.roleKey === 'caseworker') return false;
  return !!b4GetUserMgmtPermissions(ctx, agencyOverrides).can_add_users;
}

export function b4CanDeleteUsers(ctx, agencyOverrides) {
  if (!ctx || !ctx.roleKey) return false;
  if (ctx.roleKey === 'caseworker') return false;
  return !!b4GetUserMgmtPermissions(ctx, agencyOverrides).can_delete_users;
}

export function b4CanReassignCases(ctx, agencyOverrides) {
  if (!ctx || !ctx.roleKey) return false;
  if (ctx.roleKey === 'caseworker') return false;
  return !!b4GetUserMgmtPermissions(ctx, agencyOverrides).can_reassign_cases;
}

export function b4AddAgencyUser(ctx, agencyOverrides) {
  if (!b4CanAddUsers(ctx, agencyOverrides)) {
    return { ok: false, error: 'Unauthorized — role cannot add users' };
  }
  return { ok: true };
}

export function b4DeleteAgencyUser(ctx, agencyOverrides) {
  if (!b4CanDeleteUsers(ctx, agencyOverrides)) {
    return { ok: false, error: 'Unauthorized — role cannot delete users' };
  }
  return { ok: true };
}

export const B4_ROLE_RULES = {
  client: {
    label: 'Client',
    scope: 'own_profile_only',
    canViewClients: (ctx, client) =>
      client.clientUserId === ctx.userId && client.agencyId === ctx.agencyId,
    canWriteNotes: false,
    canReassign: false,
    canViewAgencyDashboard: false,
  },
  caseworker: {
    label: 'Caseworker',
    scope: 'assigned_clients_only',
    canViewClients: (ctx, client) =>
      client.agencyId === ctx.agencyId &&
      client.assignedCaseworkerId === ctx.userId,
    canWriteNotes: (ctx, client) =>
      client.agencyId === ctx.agencyId &&
      client.assignedCaseworkerId === ctx.userId,
    canReassign: false,
    canViewAgencyDashboard: false,
  },
  supervisor: {
    label: 'Supervisor',
    scope: 'team_clients_only',
    canViewClients: (ctx, client, teamMemberIds) =>
      client.agencyId === ctx.agencyId &&
      teamMemberIds.includes(client.assignedCaseworkerId),
    canWriteNotes: false,
    canReassign: false,
    canViewAgencyDashboard: false,
  },
  manager: {
    label: 'Manager',
    scope: 'agency_level',
    canViewClients: (ctx, client) => client.agencyId === ctx.agencyId,
    canWriteNotes: false,
    canReassign: true,
    canViewAgencyDashboard: true,
  },
  director: {
    label: 'Director',
    scope: 'agency_level',
    canViewClients: (ctx, client) => client.agencyId === ctx.agencyId,
    canWriteNotes: false,
    canReassign: true,
    canViewAgencyDashboard: true,
  },
  agency_admin: {
    label: 'Agency Admin',
    scope: 'agency_level',
    canViewClients: (ctx, client) => client.agencyId === ctx.agencyId,
    canWriteNotes: true,
    canReassign: true,
    canViewAgencyDashboard: true,
  },
  platform_admin: {
    label: 'Platform Admin',
    scope: 'platform_read',
    canViewClients: () => true,
    canWriteNotes: false,
    canReassign: false,
    canViewAgencyDashboard: true,
  },
};

/** Layer 2 — frontend hides unauthorized records */
export function b4FilterClientsForRole(clients, ctx, teamMemberIds) {
  const role = B4_ROLE_RULES[ctx.roleKey];
  if (!role) return [];
  return (clients || []).filter(function(client) {
    if (client.agencyId !== ctx.agencyId && ctx.roleKey !== 'platform_admin') return false;
    if (ctx.roleKey === 'supervisor') {
      return role.canViewClients(ctx, client, teamMemberIds || []);
    }
    return role.canViewClients(ctx, client);
  });
}

/** Layer 3 — queries request authorized records only */
export function b4QueryAuthorizedClients(clients, ctx, teamMemberIds) {
  const filtered = b4FilterClientsForRole(clients, ctx, teamMemberIds);
  return filtered.map(function(c) { return c.id; });
}

export function b4CanWriteCaseNote(ctx, client) {
  const role = B4_ROLE_RULES[ctx.roleKey];
  if (!role || !role.canWriteNotes) return false;
  if (typeof role.canWriteNotes === 'function') return role.canWriteNotes(ctx, client);
  return !!role.canWriteNotes;
}

export function b4NoCrossAgency(ctx, recordAgencyId) {
  if (ctx.roleKey === 'platform_admin') return true;
  return recordAgencyId === ctx.agencyId;
}

export function b4AuditActionAllowed(ctx) {
  return B4_ROLES.includes(ctx.roleKey);
}
