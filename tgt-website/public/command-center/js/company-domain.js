/**
 * Company ↔ domain association.
 * Prevents duplicate company records when Contact A hands off to Contact B
 * on the same canonical domain (e.g. cisco.com → Cisco).
 */

const BUILTIN_DOMAIN_COMPANIES = Object.freeze({
  'cisco.com': {
    company: 'Cisco',
    canonical_name: 'Cisco',
    website: 'https://www.cisco.com',
    domain: 'cisco.com',
  },
  'pcmatic.com': {
    company: 'PC Matic',
    canonical_name: 'PC Matic',
    website: 'https://www.pcmatic.com',
    domain: 'pcmatic.com',
  },
  'huntress.com': {
    company: 'Huntress',
    canonical_name: 'Huntress',
    website: 'https://www.huntress.com',
    domain: 'huntress.com',
  },
  'malwarebytes.com': {
    company: 'Malwarebytes',
    canonical_name: 'Malwarebytes',
    website: 'https://www.malwarebytes.com',
    domain: 'malwarebytes.com',
  },
});

function companyKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function extractEmailDomain(emailOrUrl) {
  const raw = String(emailOrUrl || '').trim().toLowerCase();
  if (!raw) return '';
  const at = raw.lastIndexOf('@');
  if (at >= 0) return raw.slice(at + 1).replace(/[>\s].*$/, '');
  try {
    const u = new URL(raw.includes('://') ? raw : `https://${raw}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return raw.replace(/^www\./, '').split('/')[0];
  }
}

export function resolveCompanyFromDomain(domain, feed = null) {
  const d = String(domain || '')
    .toLowerCase()
    .replace(/^www\./, '')
    .trim();
  if (!d) return null;
  const fromFeed = (feed?.company_domains || []).find(
    (row) => String(row.domain || '').toLowerCase() === d,
  );
  if (fromFeed) {
    return {
      company: fromFeed.company || fromFeed.canonical_name,
      canonical_name: fromFeed.canonical_name || fromFeed.company,
      website: fromFeed.website || `https://${d}`,
      domain: d,
    };
  }
  if (BUILTIN_DOMAIN_COMPANIES[d]) return { ...BUILTIN_DOMAIN_COMPANIES[d] };
  return null;
}

export function upsertCompanyRecord(feed, payload) {
  const domain = extractEmailDomain(payload.domain || payload.email || payload.website);
  const companyName =
    payload.company ||
    payload.canonical_name ||
    resolveCompanyFromDomain(domain, feed)?.company ||
    '';
  if (!companyName && !domain) {
    return { ok: false, error: 'company or domain required', feed };
  }
  const companies = Array.isArray(feed.companies) ? [...feed.companies] : [];
  const domainMap = Array.isArray(feed.company_domains) ? [...feed.company_domains] : [];
  const ck = companyKey(companyName);
  let company =
    companies.find((c) => companyKey(c.canonical_name || c.company) === ck) ||
    (domain
      ? companies.find((c) =>
          (c.domains || []).map((x) => String(x).toLowerCase()).includes(domain),
        )
      : null);

  if (!company) {
    company = {
      company_id: `co-${ck || domain || Date.now().toString(36)}`,
      canonical_name: companyName || domain,
      company: companyName || domain,
      domain: domain || null,
      website: payload.website || (domain ? `https://${domain}` : null),
      domains: domain ? [domain] : [],
      contacts: [],
      related_opportunities: [],
      conversation_history: [],
      last_inbound: null,
      last_outbound: null,
      next_action: payload.next_action || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    companies.push(company);
  }

  if (domain && !(company.domains || []).includes(domain)) {
    company.domains = [...(company.domains || []), domain];
  }
  if (domain) {
    company.domain = company.domain || domain;
    company.website = company.website || payload.website || `https://${domain}`;
  }

  const email = String(payload.email || payload.contact_email || '').trim().toLowerCase();
  const contactName = payload.contact_name || payload.name || '';
  if (email) {
    const contacts = Array.isArray(company.contacts) ? [...company.contacts] : [];
    const existing = contacts.find((c) => String(c.email || '').toLowerCase() === email);
    if (existing) {
      if (contactName) existing.name = contactName;
      existing.updated_at = new Date().toISOString();
    } else {
      contacts.push({
        email,
        name: contactName || email.split('@')[0],
        domain,
        added_at: new Date().toISOString(),
      });
    }
    company.contacts = contacts;
  }

  if (payload.opportunity_id) {
    const rel = new Set(company.related_opportunities || []);
    rel.add(String(payload.opportunity_id));
    company.related_opportunities = [...rel];
  }

  if (payload.direction === 'INCOMING' || payload.direction === 'INBOUND') {
    company.last_inbound = payload.at || new Date().toISOString();
  } else if (payload.direction === 'OUTBOUND') {
    company.last_outbound = payload.at || new Date().toISOString();
  }

  if (payload.conversation_entry) {
    company.conversation_history = [
      ...(company.conversation_history || []),
      payload.conversation_entry,
    ].slice(-50);
  }

  company.updated_at = new Date().toISOString();

  if (domain) {
    const di = domainMap.findIndex((d) => String(d.domain).toLowerCase() === domain);
    const domainRow = {
      domain,
      company: company.canonical_name || company.company,
      canonical_name: company.canonical_name || company.company,
      website: company.website,
      company_id: company.company_id,
    };
    if (di >= 0) domainMap[di] = domainRow;
    else domainMap.push(domainRow);
  }

  const nextCompanies = companies.map((c) =>
    c.company_id === company.company_id ? company : c,
  );

  return {
    ok: true,
    company,
    feed: {
      ...feed,
      companies: nextCompanies,
      company_domains: domainMap,
    },
  };
}

export function findCompanyForEmail(feed, email) {
  const domain = extractEmailDomain(email);
  if (!domain) return null;
  const resolved = resolveCompanyFromDomain(domain, feed);
  if (!resolved) return null;
  const companies = feed?.companies || [];
  return (
    companies.find(
      (c) =>
        companyKey(c.canonical_name || c.company) === companyKey(resolved.company) ||
        (c.domains || []).map((d) => String(d).toLowerCase()).includes(domain),
    ) || resolved
  );
}

export function preventDuplicateCompanyByDomain(feed, candidateCompany, emailOrDomain) {
  const domain = extractEmailDomain(emailOrDomain);
  if (!domain) return { duplicate: false };
  const existing = (feed?.companies || []).find((c) =>
    (c.domains || []).map((d) => String(d).toLowerCase()).includes(domain),
  );
  if (!existing) return { duplicate: false };
  const same =
    companyKey(existing.canonical_name || existing.company) ===
    companyKey(candidateCompany);
  return {
    duplicate: !same,
    existing,
    message: same
      ? null
      : `Domain ${domain} already bound to ${existing.canonical_name || existing.company}`,
  };
}

export { BUILTIN_DOMAIN_COMPANIES, companyKey };
