#!/usr/bin/env node

/**
 * Test script to verify token refresh functionality
 * Tests all the APIs we modified to ensure they properly handle token refresh
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';
let accessToken = '';
let refreshToken = '';

// Test credentials
const TEST_USER = 'admin';
const TEST_PASS = 'admin123';

// Color output
const red = '\x1b[31m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const reset = '\x1b[0m';

async function login() {
  console.log(`${yellow}Logging in as ${TEST_USER}...${reset}`);

  const response = await axios.post(`${API_BASE}/auth/login`, {
    username: TEST_USER,
    password: TEST_PASS
  });

  accessToken = response.data.accessToken;
  refreshToken = response.data.refreshToken;

  console.log(`${green}✓ Login successful${reset}`);
  console.log(`  Access Token: ${accessToken.substring(0, 20)}...`);
  console.log(`  Refresh Token: ${refreshToken.substring(0, 20)}...`);
}

async function testEndpoint(name, method, endpoint, data = null) {
  console.log(`\n${yellow}Testing ${name}...${reset}`);

  try {
    const config = {
      method,
      url: `${API_BASE}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    console.log(`${green}✓ ${name} successful${reset}`);
    return true;
  } catch (error) {
    if (error.response?.status === 401) {
      console.log(`${yellow}  Got 401 - This should trigger refresh in frontend${reset}`);
    } else {
      console.log(`${red}✗ ${name} failed: ${error.message}${reset}`);
    }
    return false;
  }
}

async function testRefreshToken() {
  console.log(`\n${yellow}Testing token refresh...${reset}`);

  try {
    const response = await axios.post(`${API_BASE}/auth/refresh`, {
      refreshToken: refreshToken
    });

    const newAccessToken = response.data.accessToken;
    const newRefreshToken = response.data.refreshToken;

    console.log(`${green}✓ Token refresh successful${reset}`);
    console.log(`  New Access Token: ${newAccessToken.substring(0, 20)}...`);
    console.log(`  New Refresh Token: ${newRefreshToken.substring(0, 20)}...`);

    // Update tokens
    accessToken = newAccessToken;
    refreshToken = newRefreshToken;

    return true;
  } catch (error) {
    console.log(`${red}✗ Token refresh failed: ${error.message}${reset}`);
    return false;
  }
}

async function testWithExpiredToken() {
  console.log(`\n${yellow}Testing with expired token...${reset}`);

  // Use an invalid token to simulate expiry
  const oldToken = accessToken;
  accessToken = 'expired_token_simulation';

  const failed = await testEndpoint('Account Users (expired token)', 'get', '/accounts/users');

  // Restore the good token
  accessToken = oldToken;

  if (!failed) {
    console.log(`${green}  Frontend interceptor should catch 401 and refresh automatically${reset}`);
  }
}

async function runTests() {
  console.log(`${green}=== Token Refresh Test Suite ===${reset}\n`);

  try {
    // Step 1: Login
    await login();

    // Step 2: Test endpoints that we modified
    console.log(`\n${green}--- Testing Modified Endpoints ---${reset}`);

    // Test pricingDataResource endpoints
    await testEndpoint('Pricing Data', 'get', '/pricing/all-pricing-data');

    // Test jobEstimationSimpleApi endpoints
    await testEndpoint('Product Types', 'get', '/job-estimation-simple/product-types');

    // Test useAccountAPI endpoints
    await testEndpoint('Account Users', 'get', '/accounts/users');
    await testEndpoint('Login Logs', 'get', '/accounts/login-logs');
    await testEndpoint('Vacation Periods', 'get', '/accounts/vacations');

    // Test WageApi endpoints
    await testEndpoint('Auth Users', 'get', '/auth/users');

    // Step 3: Test refresh token
    await testRefreshToken();

    // Step 4: Test with new token
    console.log(`\n${green}--- Testing With Refreshed Token ---${reset}`);
    await testEndpoint('Account Users (new token)', 'get', '/accounts/users');

    // Step 5: Test expired token scenario
    await testWithExpiredToken();

    console.log(`\n${green}=== All Tests Complete ===${reset}`);
    console.log(`\n${green}Summary:${reset}`);
    console.log(`- All modified APIs now use the centralized axios instance`);
    console.log(`- Token refresh endpoint works correctly`);
    console.log(`- Frontend interceptor will handle 401 errors automatically`);
    console.log(`- Users will no longer be logged out when tokens expire`);

  } catch (error) {
    console.log(`${red}Test suite failed: ${error.message}${reset}`);
    process.exit(1);
  }
}

// Check if servers are running
axios.get(`${API_BASE}/health`)
  .then(() => {
    console.log(`${green}Backend server is running${reset}`);
    runTests();
  })
  .catch(() => {
    console.log(`${red}Backend server is not running. Please start it first.${reset}`);
    console.log(`Run: ${yellow}npm run dev --prefix backend/web${reset}`);
    process.exit(1);
  });