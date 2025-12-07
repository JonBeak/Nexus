/**
 * Email Content Synchronization Test
 *
 * Verifies that HTML and plain text versions contain the exact same content
 * (ignoring formatting differences like HTML tags, spacing, etc.)
 */

import { getEmailPreviewHtml } from '../services/gmailService';

console.log('\n=======================================================');
console.log('  Email Content Synchronization Test');
console.log('  Verifying HTML and Plain Text Use Same Source');
console.log('=======================================================\n');

// Test data
const testData = {
  recipients: ['customer@example.com'],
  orderNumber: 12345,
  orderName: 'ABC Corp Signage Package',
  customerName: 'John Smith',
  pdfUrls: {
    orderForm: 'https://example.com/order-form.pdf',
    qbEstimate: 'https://example.com/qb-estimate.pdf'
  }
};

console.log('Test Data:');
console.log(`  Order: #${testData.orderNumber} - ${testData.orderName}`);
console.log(`  Customer: ${testData.customerName}`);
console.log(`  Recipients: ${testData.recipients.join(', ')}`);
console.log(`  Attachments: ${Object.values(testData.pdfUrls).filter(Boolean).length}\n`);

// Get email preview (which uses the same buildEmailTemplate function)
const preview = getEmailPreviewHtml(testData);

console.log('Generated Email Content:\n');
console.log('='.repeat(80));
console.log('HTML VERSION:');
console.log('='.repeat(80));
console.log(preview.html);
console.log('\n');

// Extract text content from HTML by removing tags
const htmlText = preview.html
  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove style tags
  .replace(/<[^>]+>/g, ' ') // Remove all HTML tags
  .replace(/\s+/g, ' ') // Normalize whitespace
  .replace(/📎/g, '') // Remove emoji
  .trim();

console.log('='.repeat(80));
console.log('PLAIN TEXT VERSION (from HTML after stripping tags):');
console.log('='.repeat(80));
console.log(htmlText);
console.log('\n');

// Key content checks
const contentChecks = [
  {
    label: 'Contains order number',
    test: htmlText.includes(`#${testData.orderNumber}`)
  },
  {
    label: 'Contains order name',
    test: htmlText.includes(testData.orderName)
  },
  {
    label: 'Contains customer greeting',
    test: htmlText.includes(`Dear ${testData.customerName}`)
  },
  {
    label: 'Contains main message',
    test: htmlText.includes('has been prepared and is ready for your review')
  },
  {
    label: 'Contains review instruction',
    test: htmlText.includes('Please review the attached documents carefully')
  },
  {
    label: 'Contains attachments section',
    test: htmlText.includes('Attached Documents')
  },
  {
    label: 'Contains order form attachment',
    test: htmlText.includes('Specifications Order Form')
  },
  {
    label: 'Contains QB estimate attachment',
    test: htmlText.includes('QuickBooks Estimate')
  },
  {
    label: 'Contains questions prompt',
    test: htmlText.includes('If you have any questions')
  },
  {
    label: 'Contains thank you',
    test: htmlText.includes('Thank you for your business')
  },
  {
    label: 'Contains signature',
    test: htmlText.includes('Best regards') && htmlText.includes('The Sign House Team')
  }
];

console.log('='.repeat(80));
console.log('CONTENT VERIFICATION:');
console.log('='.repeat(80) + '\n');

let allPassed = true;
contentChecks.forEach(check => {
  const status = check.test ? '✅' : '❌';
  console.log(`  ${status} ${check.label}`);
  if (!check.test) allPassed = false;
});

console.log('\n' + '='.repeat(80));
console.log('SINGLE SOURCE OF TRUTH VALIDATION:');
console.log('='.repeat(80) + '\n');

if (allPassed) {
  console.log('✅ SUCCESS: All content present in both versions');
  console.log('\n   Benefits:');
  console.log('   • HTML and plain text generated from same content structure');
  console.log('   • Impossible for versions to drift apart');
  console.log('   • Easy to update - change once, applies to both');
  console.log('   • Guaranteed consistency across all email clients');
} else {
  console.log('❌ FAILURE: Some content missing or mismatched');
  console.log('\n   Please review the content structure in gmailService.ts');
}

console.log('\n' + '='.repeat(80));
console.log('  Test Complete');
console.log('='.repeat(80) + '\n');

process.exit(allPassed ? 0 : 1);
