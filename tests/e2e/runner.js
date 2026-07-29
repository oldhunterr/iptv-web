/**
 * Executable Test Runner for Next.js IPTV Web Application
 * Runs Tier 1 - Tier 4 E2E Test Suites and prints pass/fail breakdown report.
 */

const TestHarness = require('./test-harness');
const registerTier1 = require('./tier1-feature-coverage.test');
const registerTier2 = require('./tier2-boundary-corner-cases.test');
const registerTier3 = require('./tier3-cross-feature-combinations.test');
const registerTier4 = require('./tier4-real-world-scenarios.test');

async function main() {
  const harness = new TestHarness();

  // Register All 4 Test Tiers
  registerTier1(harness);
  registerTier2(harness);
  registerTier3(harness);
  registerTier4(harness);

  const results = await harness.runAll();

  // Calculate Breakdown per Tier
  const tierCounts = {
    'Tier 1': { total: 0, passed: 0, failed: 0 },
    'Tier 2': { total: 0, passed: 0, failed: 0 },
    'Tier 3': { total: 0, passed: 0, failed: 0 },
    'Tier 4': { total: 0, passed: 0, failed: 0 }
  };

  harness.tests.forEach((t) => {
    const tierKey = t.tier;
    if (tierCounts[tierKey]) {
      tierCounts[tierKey].total++;
    }
  });

  results.failures.forEach((f) => {
    const tierKey = f.test.tier;
    if (tierCounts[tierKey]) {
      tierCounts[tierKey].failed++;
    }
  });

  Object.keys(tierCounts).forEach((tierKey) => {
    tierCounts[tierKey].passed = tierCounts[tierKey].total - tierCounts[tierKey].failed;
  });

  console.log('\n' + '='.repeat(70));
  console.log('               NEXT.JS IPTV E2E TEST SUITE REPORT');
  console.log('='.repeat(70));
  console.log(` Tier 1 (Feature Coverage):        ${tierCounts['Tier 1'].passed}/${tierCounts['Tier 1'].total} PASSED`);
  console.log(` Tier 2 (Boundary & Corner Cases): ${tierCounts['Tier 2'].passed}/${tierCounts['Tier 2'].total} PASSED`);
  console.log(` Tier 3 (Cross-Feature Combos):    ${tierCounts['Tier 3'].passed}/${tierCounts['Tier 3'].total} PASSED`);
  console.log(` Tier 4 (Real-World Scenarios):    ${tierCounts['Tier 4'].passed}/${tierCounts['Tier 4'].total} PASSED`);
  console.log('-'.repeat(70));
  console.log(` TOTAL TESTS EXECUTED:  ${results.total}`);
  console.log(` TOTAL PASSED:          ${results.passed}`);
  console.log(` TOTAL FAILED:          ${results.failed}`);
  console.log(` TOTAL ASSERTIONS:      ${results.assertions}`);
  console.log(` TOTAL DURATION:        ${results.duration}ms`);
  console.log('='.repeat(70) + '\n');

  if (results.failed > 0) {
    console.error(`🚨 TEST SUITE FAILED: ${results.failed} test(s) failed.`);
    process.exit(1);
  } else {
    console.log(`✨ ALL ${results.total} E2E TESTS PASSED SUCCESSFULLY!`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal Test Runner Execution Error:', err);
  process.exit(1);
});
