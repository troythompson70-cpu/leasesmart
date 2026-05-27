/**
 * Sprint E1 — HUD 2026 Fair Market Rents (NJ + NYC demo data)
 */
export const E1_HUD_FMR_URL = 'https://www.huduser.gov/portal/datasets/fmr.html';
export const E1_HUD_FMR_LABEL = 'HUD 2026 Fair Market Rate';
export const E1_HUD_FMR_YEAR = 2026;

export const E1_FMR_2026 = {
  Essex: { 0: 1200, 1: 1380, 2: 1680, 3: 2100, 4: 2450 },
  Passaic: { 0: 1150, 1: 1320, 2: 1600, 3: 1980, 4: 2320 },
  Hudson: { 0: 1250, 1: 1450, 2: 1750, 3: 2180, 4: 2550 },
  Bergen: { 0: 1280, 1: 1480, 2: 1780, 3: 2220, 4: 2600 },
  Union: { 0: 1220, 1: 1400, 2: 1700, 3: 2120, 4: 2480 },
  Manhattan: { 0: 1900, 1: 2200, 2: 2600, 3: 3300, 4: 3600 },
  Brooklyn: { 0: 1750, 1: 2050, 2: 2400, 3: 3000, 4: 3300 },
};

export function e1GetFmrForCounty(county, bedrooms) {
  const beds = Math.max(0, Math.min(4, parseInt(bedrooms, 10) || 1));
  const table = E1_FMR_2026[county] || E1_FMR_2026.Essex;
  return {
    county: county,
    bedrooms: beds,
    amount_usd: table[beds] != null ? table[beds] : table[1],
    period: 'monthly',
    year: E1_HUD_FMR_YEAR,
    label: E1_HUD_FMR_LABEL,
    source_url: E1_HUD_FMR_URL,
    demo: true,
    not_verified_claim: true,
  };
}
