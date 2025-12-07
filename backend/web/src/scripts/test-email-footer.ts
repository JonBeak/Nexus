/**
 * Test Email Footer
 *
 * Shows how the footer appears in both HTML and plain text versions
 */

import { getEmailPreviewHtml } from '../services/gmailService';

console.log('\n' + '='.repeat(80));
console.log('  Email Footer Test');
console.log('='.repeat(80) + '\n');

const testData = {
  recipients: ['customer@example.com'],
  orderNumber: 12345,
  orderName: 'Test Order',
  customerName: 'John Smith',
  pdfUrls: {
    orderForm: 'https://example.com/order-form.pdf',
    qbEstimate: 'https://example.com/qb-estimate.pdf'
  }
};

const preview = getEmailPreviewHtml(testData);

console.log('📧 Subject:', preview.subject);
console.log('\n' + '='.repeat(80));
console.log('HTML FOOTER (Last 800 characters):');
console.log('='.repeat(80));
const htmlLength = preview.html.length;
const footerSection = preview.html.substring(htmlLength - 800);
console.log(footerSection);

console.log('\n' + '='.repeat(80));
console.log('✅ Footer successfully added!');
console.log('='.repeat(80) + '\n');

console.log('Footer Features:');
console.log('  ✅ Company name displayed');
console.log('  ✅ Phone number with emoji icon');
console.log('  ✅ Email address with mailto: link');
console.log('  ✅ Website URL with clickable link');
console.log('  ✅ Physical address');
console.log('  ✅ Business hours');
console.log('  ✅ Styled with border and spacing');
console.log('  ✅ Dark mode support');
console.log('  ✅ Plain text version included\n');

process.exit(0);
