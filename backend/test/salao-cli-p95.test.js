const { test } = require('node:test');
const assert = require('node:assert/strict');
const { interpretStory6Ac3 } = require('../lib/salao-cli-p95');

test('interpretStory6Ac3 PASS when heavy p95 under cap', () => {
  const out = interpretStory6Ac3({
    salon_day: '2026-09-06',
    min_samples: 5,
    profiles: [
      { profile: 'BOOKING', n: 8, p95_ms: 15000, avg_ms: 12000, max_ms: 18000, timed_out: 0 },
      { profile: 'FULL', n: 6, p95_ms: 19000, avg_ms: 14000, max_ms: 21000, timed_out: 1 },
    ],
  });
  assert.equal(out.ac3_overall, 'PASS');
  assert.equal(out.profiles.find((p) => p.profile === 'BOOKING').ac3, 'PASS');
});

test('interpretStory6Ac3 WAIT_TRAFFIC when no heavy samples', () => {
  const out = interpretStory6Ac3({
    salon_day: '2026-09-06',
    profiles: [{ profile: 'FAQ', n: 2, p95_ms: 3000, avg_ms: 2500, max_ms: 4000, timed_out: 0 }],
  });
  assert.equal(out.ac3_overall, 'WAIT_TRAFFIC');
});

test('interpretStory6Ac3 ADJUST_CAP when p95 above cap but under wall', () => {
  const out = interpretStory6Ac3({
    salon_day: '2026-09-06',
    min_samples: 3,
    profiles: [
      { profile: 'BOOKING', n: 5, p95_ms: 23000, avg_ms: 20000, max_ms: 23500, timed_out: 0 },
    ],
  });
  assert.equal(out.ac3_overall, 'ACTION_NEEDED');
  assert.equal(out.profiles[0].ac3, 'ADJUST_CAP');
});
