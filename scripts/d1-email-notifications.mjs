/**
 * Sprint D1 — email notification placeholders (draft until Supabase email live)
 */
export const D1_EMAIL_TYPES = [
  'caseworker_assigned',
  'case_status_changed',
  'follow_up_overdue',
];

export function d1IsEmailServiceLive(config) {
  if (!config || !config.supabaseUrl) return false;
  if (config.emailNotificationsEnabled === true) return true;
  return false;
}

export function d1BuildEmailPayload(type, data) {
  data = data || {};
  if (type === 'caseworker_assigned') {
    return {
      subject: '[LeaseSmart Demo] New client assigned',
      body: 'You have been assigned mock client ' + (data.clientName || 'Demo Client') + '.',
      notification_type: type,
    };
  }
  if (type === 'case_status_changed') {
    return {
      subject: '[LeaseSmart Demo] Case status updated',
      body: 'Status changed from ' + (data.oldStatus || '?') + ' to ' + (data.newStatus || '?') + ' (mock).',
      notification_type: type,
    };
  }
  if (type === 'follow_up_overdue') {
    return {
      subject: '[LeaseSmart Demo] Follow-up overdue',
      body: 'Follow-up overdue for ' + (data.caseNumber || data.clientName || 'mock client') + ' (demo).',
      notification_type: type,
    };
  }
  return {
    subject: '[LeaseSmart Demo] Notification',
    body: 'Demo notification.',
    notification_type: type,
  };
}

export function d1QueueEmail(config, type, data) {
  const payload = d1BuildEmailPayload(type, data);
  const live = d1IsEmailServiceLive(config);
  return {
    ok: true,
    live: live,
    status: live ? 'queued' : 'skipped_no_email_service',
    draft: !live,
    ...payload,
    payload: data,
    is_mock: true,
    ts: new Date().toISOString(),
  };
}
