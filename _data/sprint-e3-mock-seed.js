/**
 * Sprint E3 — billing skeleton mock config (TEST MODE only)
 */
window.SPRINT_E3_MOCK = {
  testMode: true,
  testModeLabel: 'TEST MODE — No real charges.',
  currentPlanId: 'free',
  nextBillingDate: '2026-07-01',
  paymentMethodLast4: '4242',
  paymentMethodBrand: 'Visa (test)',
  stripePlans: [
    { id: 'free', name: 'Free', priceLabel: '$0', period: '', stripePlanId: null, cta: 'Coming Soon', features: ['Basic search', 'Limited saves'] },
    { id: 'individual_standard', name: 'Standard', priceLabel: '$9.99', period: '/mo', stripePlanId: 'individual_standard', cta: 'Coming Soon', features: ['Unlimited saves', 'Email alerts skeleton'] },
    { id: 'individual_premium', name: 'Premium', priceLabel: '$19.99', period: '/mo', stripePlanId: 'individual_premium', cta: 'Coming Soon', features: ['Priority scoring', 'Advanced filters skeleton'] },
    { id: 'social_worker', name: 'Social Worker', priceLabel: '$49', period: '/mo', stripePlanId: 'social_worker', cta: 'Coming Soon', features: ['C2 case tools preview', 'Client tracking skeleton'] },
    { id: 'agency', name: 'Agency', priceLabel: '$199', period: '/mo', stripePlanId: 'agency', cta: 'Coming Soon', features: ['Multi-user skeleton', 'Agency dashboard preview'] },
    { id: 'enterprise', name: 'Enterprise', priceLabel: '$999', period: '/mo', stripePlanId: 'enterprise', cta: 'Coming Soon', features: ['Custom integrations skeleton', 'Dedicated support placeholder'] },
    { id: 'government', name: 'Government', priceLabel: 'Contact us', period: '', stripePlanId: null, cta: 'Coming Soon', features: ['Public sector pricing TBD', 'Procurement workflow skeleton'] }
  ],
  demoInvoices: [
    { id: 'inv_demo_001', date: '2026-05-01', amount: '$0.00', status: 'demo_paid', testMode: true, description: 'Free tier — demo' },
    { id: 'inv_demo_002', date: '2026-04-01', amount: '$0.00', status: 'demo_paid', testMode: true, description: 'Beta preview — no charge' }
  ]
};

function e3SeedIfNeeded() {
  /* marker for init — config only */
}
