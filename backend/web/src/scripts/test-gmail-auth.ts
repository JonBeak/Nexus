/**
 * Gmail Authentication Test Script
 *
 * Tests Gmail API connection and service account configuration.
 * Run this after completing setup-gmail-credentials to verify everything works.
 *
 * Usage:
 *   npm run test:gmail-auth
 */

import { testGmailConnection, getServiceAccountInfo } from '../services/gmailAuthService';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  console.log('\n=======================================================');
  console.log('  Gmail API Authentication Test');
  console.log('=======================================================\n');

  // Check environment configuration
  console.log('Environment Configuration:');
  console.log(`  GMAIL_ENABLED: ${process.env.GMAIL_ENABLED || 'false'}`);
  console.log(`  GMAIL_SENDER_EMAIL: ${process.env.GMAIL_SENDER_EMAIL || '(not set)'}`);
  console.log(`  GMAIL_SENDER_NAME: ${process.env.GMAIL_SENDER_NAME || '(not set)'}\n`);

  // Get service account info
  console.log('--- Step 1: Service Account Configuration ---\n');

  const serviceAccountInfo = await getServiceAccountInfo();

  if (!serviceAccountInfo.configured) {
    console.error('❌ Service account not configured');
    console.error(`   Error: ${serviceAccountInfo.error}`);
    console.error('\n   Run: npm run setup:gmail-credentials\n');
    process.exit(1);
  }

  console.log('✅ Service account configured');
  console.log(`   Service Account Email: ${serviceAccountInfo.serviceAccountEmail}`);
  console.log(`   Impersonating: ${serviceAccountInfo.impersonatedEmail}\n`);

  // Test Gmail API connection
  console.log('--- Step 2: Test Gmail API Connection ---\n');
  console.log('Testing connection to Gmail API...\n');

  const connectionTest = await testGmailConnection();

  if (!connectionTest.success) {
    console.error('❌ Gmail API connection failed');
    console.error(`   Error: ${connectionTest.error}\n`);

    if (connectionTest.error?.includes('domain-wide delegation')) {
      console.error('Troubleshooting:');
      console.error('1. Go to https://admin.google.com/');
      console.error('2. Navigate to: Security → API Controls → Domain-wide delegation');
      console.error('3. Verify service account is authorized with scope:');
      console.error('   https://www.googleapis.com/auth/gmail.send');
      console.error(`4. Client ID should be from service account: ${serviceAccountInfo.serviceAccountEmail}\n`);
    } else if (connectionTest.error?.includes('Authentication failed')) {
      console.error('Troubleshooting:');
      console.error('1. Verify service account JSON file is valid');
      console.error('2. Re-download key from Google Cloud Console if needed');
      console.error('3. Run: npm run setup:gmail-credentials\n');
    }

    process.exit(1);
  }

  console.log('✅ Gmail API connection successful!');
  console.log(`   Authenticated as: ${connectionTest.email}`);
  console.log(`   Ready to send emails via Gmail API\n`);

  // Summary
  console.log('=======================================================');
  console.log('  ✅ All Tests Passed!');
  console.log('=======================================================\n');

  console.log('Gmail API is ready to use.\n');

  console.log('Next Steps:');
  console.log('1. Keep GMAIL_ENABLED=false for testing');
  console.log('2. Test order finalization workflow (emails will log to console)');
  console.log('3. When ready to send real emails:');
  console.log('   - Update .env: GMAIL_ENABLED=true');
  console.log('   - Test with your own email first');
  console.log('   - Monitor backend logs for any errors\n');

  process.exit(0);
}

// Run main function
main().catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
