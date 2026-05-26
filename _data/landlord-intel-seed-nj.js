/**
 * Sprint C1 — 50 dummy NJ landlord intelligence records (no real PII)
 * Counties: Essex, Passaic, Hudson, Bergen, Union
 */
window.LANDLORD_INTEL_DUMMY_NJ = (function() {
  var COUNTIES = [
    { county: 'Essex', cities: ['Newark', 'East Orange', 'Irvington', 'Bloomfield', 'Montclair'] },
    { county: 'Passaic', cities: ['Paterson', 'Passaic', 'Clifton', 'Wayne', 'Hawthorne'] },
    { county: 'Hudson', cities: ['Jersey City', 'Hoboken', 'Union City', 'Bayonne', 'West New York'] },
    { county: 'Bergen', cities: ['Hackensack', 'Fort Lee', 'Paramus', 'Teaneck', 'Englewood'] },
    { county: 'Union', cities: ['Elizabeth', 'Union', 'Plainfield', 'Linden', 'Rahway'] }
  ];
  var VERIFICATION = [
    'Imported', 'Public Source Verified', 'Contact Verified', 'Recently Contacted',
    'Availability Confirmed', 'Needs Recheck', 'Inactive', 'Bad Lead'
  ];
  var SOURCE_TYPES = ['public_record', 'housing_program', 'referral', 'web_scrape_demo', 'case_manager_entry'];
  var AVAIL = ['Units Available', 'Waitlist', 'Unknown', 'No Availability', 'Call for Availability'];
  var records = [];
  var n = 0;
  COUNTIES.forEach(function(c) {
    c.cities.forEach(function(city, ci) {
      for (var i = 0; i < 2 && n < 50; i++) {
        n++;
        var zipBase = 7000 + (n * 17) % 900;
        records.push({
          id: 'li-nj-' + n,
          is_public: n % 3 === 0,
          owner_key: 'seed-demo',
          landlord_name: 'Demo Property Group ' + n,
          property_name: city + ' Sample Apartments ' + (ci + 1),
          address: (100 + n) + ' Sample Street',
          city: city,
          state: 'NJ',
          zip: '0' + String(zipBase).slice(0, 4),
          county: c.county,
          phone: '(555) 010-' + String(1000 + n).slice(-4),
          email: 'demo.landlord' + n + '@leasesmart-demo.invalid',
          website: 'https://demo.leasesmart.invalid/property/' + n,
          source_type: SOURCE_TYPES[n % SOURCE_TYPES.length],
          source_url: 'https://demo.leasesmart.invalid/source/' + n,
          verification_status: VERIFICATION[n % VERIFICATION.length],
          verified_by: n % 5 === 0 ? 'Demo Verifier' : '',
          verified_at: n % 5 === 0 ? '2026-05-01T12:00:00.000Z' : null,
          last_contacted_at: n % 4 === 0 ? '2026-05-20T15:30:00.000Z' : null,
          availability_status: AVAIL[n % AVAIL.length],
          program_notes: 'Dummy program note for ' + c.county + ' demo record ' + n + '.',
          warning_flags: n % 7 === 0 ? ['demo_flag_review'] : [],
          case_manager_notes: 'Sample case manager note — not real.',
          neighborhood_notes: 'Near transit demo area in ' + city + '.',
          next_recheck_date: '2026-0' + ((n % 6) + 6) + '-' + String(10 + (n % 18)).padStart(2, '0'),
          created_at: '2026-05-01T10:00:00.000Z',
          updated_at: '2026-05-24T10:00:00.000Z'
        });
      }
    });
  });
  return records.slice(0, 50);
})();
