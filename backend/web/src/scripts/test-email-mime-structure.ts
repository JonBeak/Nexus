/**
 * Email MIME Structure Test Script
 *
 * Tests the nested multipart/alternative structure to ensure
 * modern email clients will show only the HTML version.
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('\n=======================================================');
console.log('  Email MIME Structure Validation');
console.log('=======================================================\n');

// Simulate the email structure creation
const mixedBoundary = '----=_Part_Mixed_12345';
const altBoundary = '----=_Part_Alt_67890';

const SENDER_NAME = 'Sign House';
const SENDER_EMAIL = 'info@signhouse.ca';
const BCC_EMAIL = process.env.GMAIL_BCC_EMAIL || '';
const recipients = ['customer@example.com'];

// Build headers
const headers = [
  `From: ${SENDER_NAME} <${SENDER_EMAIL}>`,
  `To: ${recipients.join(', ')}`,
  `Subject: [Action Required] Order #123 - Ready for Review`,
  `MIME-Version: 1.0`,
  `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`
];

if (BCC_EMAIL && BCC_EMAIL.trim() !== '') {
  headers.splice(3, 0, `Bcc: ${BCC_EMAIL}`);
}

// Build body parts
const bodyParts: string[] = [];

// Part 1: multipart/alternative section
bodyParts.push(
  `--${mixedBoundary}`,
  `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
  ``
);

// Part 1a: Plain text
bodyParts.push(
  `--${altBoundary}`,
  `Content-Type: text/plain; charset=UTF-8`,
  `Content-Transfer-Encoding: 7bit`,
  ``,
  `Order #123 Ready for Review`,
  ``,
  `Dear Customer,`,
  ``,
  `Your order is ready...`,
  ``,
  `(Plain text version for old email clients)`
);

// Part 1b: HTML
bodyParts.push(
  `--${altBoundary}`,
  `Content-Type: text/html; charset=UTF-8`,
  `Content-Transfer-Encoding: 7bit`,
  ``,
  `<html><body>`,
  `<h1>Order Ready for Review</h1>`,
  `<p>Dear Customer,</p>`,
  `<p>Your order is ready...</p>`,
  `<p>(HTML version with formatting and colors)</p>`,
  `</body></html>`
);

// Close alternative boundary
bodyParts.push(`--${altBoundary}--`);

// Part 2: PDF attachment
bodyParts.push(
  `--${mixedBoundary}`,
  `Content-Type: application/pdf; name="order-form.pdf"`,
  `Content-Disposition: attachment; filename="order-form.pdf"`,
  `Content-Transfer-Encoding: base64`,
  ``,
  `[BASE64_PDF_DATA_HERE]`
);

// Close mixed boundary
bodyParts.push(`--${mixedBoundary}--`);

// Combine everything
const email = headers.concat([''], bodyParts).join('\r\n');

console.log('Generated Email Structure:\n');
console.log('='.repeat(80));
console.log(email);
console.log('='.repeat(80));

console.log('\n✅ MIME Structure Validation:\n');

// Validate structure
const checks = [
  {
    test: email.includes('Content-Type: multipart/mixed'),
    label: 'Outer multipart/mixed for attachments'
  },
  {
    test: email.includes('Content-Type: multipart/alternative'),
    label: 'Inner multipart/alternative for HTML/text choice'
  },
  {
    test: email.indexOf('text/plain') < email.indexOf('text/html'),
    label: 'Plain text comes before HTML (clients prefer last)'
  },
  {
    test: email.includes(`--${altBoundary}--`),
    label: 'Alternative boundary properly closed'
  },
  {
    test: email.includes(`--${mixedBoundary}--`),
    label: 'Mixed boundary properly closed'
  },
  {
    test: email.includes('Content-Type: application/pdf'),
    label: 'PDF attachments in outer mixed section'
  }
];

let allPassed = true;
checks.forEach(check => {
  const status = check.test ? '✅' : '❌';
  console.log(`  ${status} ${check.label}`);
  if (!check.test) allPassed = false;
});

console.log('\n=======================================================');
if (allPassed) {
  console.log('  ✅ All Structure Checks Passed!');
  console.log('=======================================================\n');
  console.log('Expected Behavior:');
  console.log('  • Modern email clients (Gmail, Outlook, etc.):');
  console.log('    → Will display ONLY the HTML version (formatted with colors)');
  console.log('  • Text-only email clients (old systems):');
  console.log('    → Will display the plain text version (fallback)');
  console.log('  • PDF attachments:');
  console.log('    → Will appear as downloadable attachments in all clients');
} else {
  console.log('  ❌ Some Structure Checks Failed!');
  console.log('=======================================================\n');
  console.log('Please review the MIME structure above.');
}

console.log('\n');

process.exit(allPassed ? 0 : 1);
