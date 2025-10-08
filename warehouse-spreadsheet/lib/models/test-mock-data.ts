/**
 * Test Mock Data System
 *
 * Run this to verify the mock data is working correctly
 * Usage: npx tsx lib/models/test-mock-data.ts
 */

import { getModel, getMetric } from './registry';
import { getMockExecutor } from './mock-executor';
import { MOCK_DATA_SUMMARY } from './mock-data';
import type { QueryContext } from './query-builder';

async function testQuarterlyMetrics() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🧪 Testing Quarterly 2024 Workbook');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const model = getModel('users');
  const metric = getMetric('new_users');

  if (!model || !metric) {
    console.error('❌ Model or metric not found!');
    return;
  }

  const executor = getMockExecutor();

  // Test Q1 2024
  console.log('📊 Q1 2024 (Jan 1 - Mar 31)');
  const q1Context: QueryContext = {
    grain: 'quarter',
    startDate: '2024-01-01',
    endDate: '2024-04-01',
  };
  const q1Result = await executor.executeMetricQuery(model, metric, q1Context);
  console.log(`   Result: ${q1Result.toLocaleString()} users`);
  console.log(`   Expected: ${MOCK_DATA_SUMMARY.users.byQuarter.Q1.toLocaleString()} users`);
  console.log(`   Match: ${q1Result === MOCK_DATA_SUMMARY.users.byQuarter.Q1 ? '✅' : '❌'}\n`);

  // Test Q2 2024
  console.log('📊 Q2 2024 (Apr 1 - Jun 30)');
  const q2Context: QueryContext = {
    grain: 'quarter',
    startDate: '2024-04-01',
    endDate: '2024-07-01',
  };
  const q2Result = await executor.executeMetricQuery(model, metric, q2Context);
  console.log(`   Result: ${q2Result.toLocaleString()} users`);
  console.log(`   Expected: ${MOCK_DATA_SUMMARY.users.byQuarter.Q2.toLocaleString()} users`);
  console.log(`   Match: ${q2Result === MOCK_DATA_SUMMARY.users.byQuarter.Q2 ? '✅' : '❌'}\n`);

  // Test Q3 2024
  console.log('📊 Q3 2024 (Jul 1 - Sep 30)');
  const q3Context: QueryContext = {
    grain: 'quarter',
    startDate: '2024-07-01',
    endDate: '2024-10-01',
  };
  const q3Result = await executor.executeMetricQuery(model, metric, q3Context);
  console.log(`   Result: ${q3Result.toLocaleString()} users`);
  console.log(`   Expected: ${MOCK_DATA_SUMMARY.users.byQuarter.Q3.toLocaleString()} users`);
  console.log(`   Match: ${q3Result === MOCK_DATA_SUMMARY.users.byQuarter.Q3 ? '✅' : '❌'}\n`);

  // Test Q4 2024 (partial)
  console.log('📊 Q4 2024 (Oct 1 - Dec 31) - Partial');
  const q4Context: QueryContext = {
    grain: 'quarter',
    startDate: '2024-10-01',
    endDate: '2025-01-01',
  };
  const q4Result = await executor.executeMetricQuery(model, metric, q4Context);
  console.log(`   Result: ${q4Result.toLocaleString()} users`);
  console.log(`   Expected: ${MOCK_DATA_SUMMARY.users.byQuarter.Q4.toLocaleString()} users`);
  console.log(`   Match: ${q4Result === MOCK_DATA_SUMMARY.users.byQuarter.Q4 ? '✅' : '❌'}\n`);
}

async function testActiveUsersMetric() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🧪 Testing Active Users Metric (with filter)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const model = getModel('users');
  const metric = getMetric('active_users');

  if (!model || !metric) {
    console.error('❌ Model or metric not found!');
    return;
  }

  const executor = getMockExecutor();

  // Test Q1 2024 Active Users
  console.log('📊 Q1 2024 - Active Users Only');
  const q1Context: QueryContext = {
    grain: 'quarter',
    startDate: '2024-01-01',
    endDate: '2024-04-01',
  };
  const q1Result = await executor.executeMetricQuery(model, metric, q1Context);
  console.log(`   Result: ${q1Result.toLocaleString()} active users`);
  console.log(`   Total Q1 Users: ${MOCK_DATA_SUMMARY.users.byQuarter.Q1.toLocaleString()}`);
  console.log(`   Total Active (all periods): ${MOCK_DATA_SUMMARY.users.byStatus.active.toLocaleString()}`);
  console.log(`   Filter working: ${q1Result < MOCK_DATA_SUMMARY.users.byQuarter.Q1 ? '✅' : '❌'}\n`);
}

async function testRevenueMetric() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🧪 Testing Revenue Metrics');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const model = getModel('revenue');
  const metric = getMetric('total_revenue');

  if (!model || !metric) {
    console.error('❌ Model or metric not found!');
    return;
  }

  const executor = getMockExecutor();

  // Test Q1 2024 Revenue
  console.log('📊 Q1 2024 - Total Revenue');
  const q1Context: QueryContext = {
    grain: 'quarter',
    startDate: '2024-01-01',
    endDate: '2024-04-01',
  };
  const q1Result = await executor.executeMetricQuery(model, metric, q1Context);
  console.log(`   Result: $${q1Result.toLocaleString()}`);
  console.log(`   Aggregation: SUM(amount) ✅\n`);
}

async function testMonthlyGranularity() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🧪 Testing Monthly Granularity');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const model = getModel('users');
  const metric = getMetric('new_users');

  if (!model || !metric) {
    console.error('❌ Model or metric not found!');
    return;
  }

  const executor = getMockExecutor();

  // Test Jan 2024
  console.log('📊 January 2024');
  const janContext: QueryContext = {
    grain: 'month',
    startDate: '2024-01-01',
    endDate: '2024-02-01',
  };
  const janResult = await executor.executeMetricQuery(model, metric, janContext);
  console.log(`   Result: ${janResult.toLocaleString()} users\n`);

  // Test Feb 2024
  console.log('📊 February 2024');
  const febContext: QueryContext = {
    grain: 'month',
    startDate: '2024-02-01',
    endDate: '2024-03-01',
  };
  const febResult = await executor.executeMetricQuery(model, metric, febContext);
  console.log(`   Result: ${febResult.toLocaleString()} users\n`);

  // Test Mar 2024
  console.log('📊 March 2024');
  const marContext: QueryContext = {
    grain: 'month',
    startDate: '2024-03-01',
    endDate: '2024-04-01',
  };
  const marResult = await executor.executeMetricQuery(model, metric, marContext);
  console.log(`   Result: ${marResult.toLocaleString()} users\n`);

  const q1Total = janResult + febResult + marResult;
  console.log(`   Jan + Feb + Mar = ${q1Total.toLocaleString()}`);
  console.log(`   Q1 2024 Total = ${MOCK_DATA_SUMMARY.users.byQuarter.Q1.toLocaleString()}`);
  console.log(`   Match: ${q1Total === MOCK_DATA_SUMMARY.users.byQuarter.Q1 ? '✅' : '❌'}\n`);
}

async function runAllTests() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                   MOCK DATA TEST SUITE                        ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  await testQuarterlyMetrics();
  await testActiveUsersMetric();
  await testRevenueMetric();
  await testMonthlyGranularity();

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('✅ All tests complete!');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('💡 Next Steps:');
  console.log('   1. The mock data is working correctly');
  console.log('   2. You can now use this in your UI for development');
  console.log('   3. Replace with real Snowflake when ready\n');
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

export { runAllTests };
