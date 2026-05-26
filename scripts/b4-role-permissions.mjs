/**
 * LeaseSmart Sprint B4-Foundation — Role permission model (skeleton)
 * Mirrors supabase/drafts/sprint_b4_foundation.sql intent for frontend + tests.
 * Triple redundancy: RLS (SQL) + b4FilterClientsForRole + b4QueryAuthorizedClients
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
