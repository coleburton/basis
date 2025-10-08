/**
 * Mock Data for Development
 *
 * This provides realistic dummy data so you can test the UI without Snowflake.
 * Data includes users across all of 2024 with various statuses, departments, etc.
 */

export interface MockUser {
  user_id: string;
  email: string;
  name: string;
  status: 'active' | 'inactive' | 'pending';
  department: 'Sales' | 'Engineering' | 'Marketing' | 'Support';
  user_type: 'free' | 'premium' | 'enterprise';
  created_at: string; // ISO timestamp
  country: string;
}

export interface MockRevenue {
  transaction_id: string;
  user_id: string;
  amount: number;
  transaction_date: string; // ISO date
  product: 'basic' | 'pro' | 'enterprise';
  region: 'US' | 'EU' | 'APAC';
}

/**
 * Generate mock users distributed throughout 2024
 */
function generateMockUsers(): MockUser[] {
  const users: MockUser[] = [];
  const statuses: MockUser['status'][] = ['active', 'inactive', 'pending'];
  const departments: MockUser['department'][] = ['Sales', 'Engineering', 'Marketing', 'Support'];
  const types: MockUser['user_type'][] = ['free', 'premium', 'enterprise'];
  const countries = ['US', 'UK', 'Germany', 'France', 'Canada', 'Japan', 'Australia'];

  // Q1 2024: 1,250 users
  generateUsersForPeriod(users, '2024-01-01', '2024-03-31', 1250, statuses, departments, types, countries);

  // Q2 2024: 1,380 users
  generateUsersForPeriod(users, '2024-04-01', '2024-06-30', 1380, statuses, departments, types, countries);

  // Q3 2024: 1,520 users
  generateUsersForPeriod(users, '2024-07-01', '2024-09-30', 1520, statuses, departments, types, countries);

  // Q4 2024: 1,680 users (partial - up to Oct 8)
  generateUsersForPeriod(users, '2024-10-01', '2024-10-08', 280, statuses, departments, types, countries);

  return users;
}

function generateUsersForPeriod(
  users: MockUser[],
  startDate: string,
  endDate: string,
  count: number,
  statuses: MockUser['status'][],
  departments: MockUser['department'][],
  types: MockUser['user_type'][],
  countries: string[]
) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  for (let i = 0; i < count; i++) {
    const dayOffset = Math.floor(Math.random() * daysDiff);
    const createdDate = new Date(start.getTime() + dayOffset * 24 * 60 * 60 * 1000);

    const userId = `user_${users.length + 1}`;
    users.push({
      user_id: userId,
      email: `${userId}@example.com`,
      name: `User ${users.length + 1}`,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      department: departments[Math.floor(Math.random() * departments.length)],
      user_type: types[Math.floor(Math.random() * types.length)],
      created_at: createdDate.toISOString(),
      country: countries[Math.floor(Math.random() * countries.length)],
    });
  }
}

/**
 * Generate mock revenue data
 */
function generateMockRevenue(users: MockUser[]): MockRevenue[] {
  const revenue: MockRevenue[] = [];
  const products: MockRevenue['product'][] = ['basic', 'pro', 'enterprise'];
  const regions: MockRevenue['region'][] = ['US', 'EU', 'APAC'];

  // Generate 2-5 transactions per user throughout 2024
  users.forEach((user) => {
    const numTransactions = Math.floor(Math.random() * 4) + 2;

    for (let i = 0; i < numTransactions; i++) {
      const userCreated = new Date(user.created_at);
      const endOf2024 = new Date('2024-12-31');
      const daysDiff = Math.floor((endOf2024.getTime() - userCreated.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff > 0) {
        const dayOffset = Math.floor(Math.random() * daysDiff);
        const transactionDate = new Date(userCreated.getTime() + dayOffset * 24 * 60 * 60 * 1000);

        revenue.push({
          transaction_id: `txn_${revenue.length + 1}`,
          user_id: user.user_id,
          amount: Math.floor(Math.random() * 5000) + 100,
          transaction_date: transactionDate.toISOString().split('T')[0],
          product: products[Math.floor(Math.random() * products.length)],
          region: regions[Math.floor(Math.random() * regions.length)],
        });
      }
    }
  });

  return revenue;
}

// Generate the datasets
export const MOCK_USERS = generateMockUsers();
export const MOCK_REVENUE = generateMockRevenue(MOCK_USERS);

/**
 * Mock data summary statistics
 */
export const MOCK_DATA_SUMMARY = {
  users: {
    total: MOCK_USERS.length,
    byQuarter: {
      Q1: MOCK_USERS.filter(u => u.created_at >= '2024-01-01' && u.created_at < '2024-04-01').length,
      Q2: MOCK_USERS.filter(u => u.created_at >= '2024-04-01' && u.created_at < '2024-07-01').length,
      Q3: MOCK_USERS.filter(u => u.created_at >= '2024-07-01' && u.created_at < '2024-10-01').length,
      Q4: MOCK_USERS.filter(u => u.created_at >= '2024-10-01' && u.created_at < '2025-01-01').length,
    },
    byStatus: {
      active: MOCK_USERS.filter(u => u.status === 'active').length,
      inactive: MOCK_USERS.filter(u => u.status === 'inactive').length,
      pending: MOCK_USERS.filter(u => u.status === 'pending').length,
    },
    byDepartment: {
      Sales: MOCK_USERS.filter(u => u.department === 'Sales').length,
      Engineering: MOCK_USERS.filter(u => u.department === 'Engineering').length,
      Marketing: MOCK_USERS.filter(u => u.department === 'Marketing').length,
      Support: MOCK_USERS.filter(u => u.department === 'Support').length,
    },
  },
  revenue: {
    total: MOCK_REVENUE.length,
    totalAmount: MOCK_REVENUE.reduce((sum, r) => sum + r.amount, 0),
    byQuarter: {
      Q1: MOCK_REVENUE.filter(r => r.transaction_date >= '2024-01-01' && r.transaction_date < '2024-04-01').length,
      Q2: MOCK_REVENUE.filter(r => r.transaction_date >= '2024-04-01' && r.transaction_date < '2024-07-01').length,
      Q3: MOCK_REVENUE.filter(r => r.transaction_date >= '2024-07-01' && r.transaction_date < '2024-10-01').length,
      Q4: MOCK_REVENUE.filter(r => r.transaction_date >= '2024-10-01' && r.transaction_date < '2025-01-01').length,
    },
  },
};

// Log summary when imported
console.log('📊 Mock Data Generated:');
console.log('  Users:', MOCK_DATA_SUMMARY.users.total);
console.log('  - Q1 2024:', MOCK_DATA_SUMMARY.users.byQuarter.Q1);
console.log('  - Q2 2024:', MOCK_DATA_SUMMARY.users.byQuarter.Q2);
console.log('  - Q3 2024:', MOCK_DATA_SUMMARY.users.byQuarter.Q3);
console.log('  - Q4 2024:', MOCK_DATA_SUMMARY.users.byQuarter.Q4);
console.log('  Active:', MOCK_DATA_SUMMARY.users.byStatus.active);
console.log('  Revenue Transactions:', MOCK_DATA_SUMMARY.revenue.total);
console.log('  Total Revenue: $' + MOCK_DATA_SUMMARY.revenue.totalAmount.toLocaleString());
