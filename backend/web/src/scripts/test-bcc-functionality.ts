/**
 * BCC Functionality Test Script
 *
 * Tests that BCC email configuration is properly loaded and applied
 * to email headers without actually sending emails.
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('\n=======================================================');
console.log('  BCC Email Configuration Test');
console.log('=======================================================\n');

console.log('Environment Variables:');
console.log(`  GMAIL_ENABLED: ${process.env.GMAIL_ENABLED}`);
console.log(`  GMAIL_SENDER_EMAIL: ${process.env.GMAIL_SENDER_EMAIL}`);
console.log(`  GMAIL_SENDER_NAME: ${process.env.GMAIL_SENDER_NAME}`);
console.log(`  GMAIL_BCC_EMAIL: ${process.env.GMAIL_BCC_EMAIL || '(not set)'}\n`);

// Simulate the BCC logic from gmailService.ts
const BCC_EMAIL = process.env.GMAIL_BCC_EMAIL || '';

console.log('BCC Configuration:');
if (BCC_EMAIL && BCC_EMAIL.trim() !== '') {
  console.log(`  ✅ BCC is ENABLED`);
  console.log(`  📧 BCC Address: ${BCC_EMAIL}`);
  console.log(`  📝 All sent emails will automatically BCC: ${BCC_EMAIL}`);
} else {
  console.log(`  ⚠️  BCC is DISABLED`);
  console.log(`  📝 No BCC will be added to sent emails`);
  console.log(`  💡 To enable: Set GMAIL_BCC_EMAIL in .env`);
}

console.log('\n--- Simulated Email Headers ---\n');

// Simulate email header construction
const SENDER_NAME = process.env.GMAIL_SENDER_NAME || 'Sign House';
const SENDER_EMAIL = process.env.GMAIL_SENDER_EMAIL || 'info@signhouse.ca';
const TEST_RECIPIENTS = ['customer1@example.com', 'customer2@example.com'];

const headers = [
  `From: ${SENDER_NAME} <${SENDER_EMAIL}>`,
  `To: ${TEST_RECIPIENTS.join(', ')}`,
  `Subject: Test Email`,
  `MIME-Version: 1.0`,
  `Content-Type: multipart/mixed`
];

// Add BCC header if configured (same logic as gmailService.ts)
if (BCC_EMAIL && BCC_EMAIL.trim() !== '') {
  headers.splice(3, 0, `Bcc: ${BCC_EMAIL}`);
}

console.log('Email Headers:');
headers.forEach((header, index) => {
  console.log(`  ${index + 1}. ${header}`);
});

console.log('\n=======================================================');
console.log('  ✅ BCC Configuration Test Complete');
console.log('=======================================================\n');

console.log('Summary:');
console.log(`  - BCC is ${BCC_EMAIL && BCC_EMAIL.trim() !== '' ? 'ENABLED' : 'DISABLED'}`);
if (BCC_EMAIL && BCC_EMAIL.trim() !== '') {
  console.log(`  - All emails will BCC: ${BCC_EMAIL}`);
  console.log(`  - To disable: Delete GMAIL_BCC_EMAIL from .env or set to empty string`);
} else {
  console.log(`  - To enable: Add GMAIL_BCC_EMAIL=info@signhouse.ca to .env`);
}
console.log('\n');

process.exit(0);
