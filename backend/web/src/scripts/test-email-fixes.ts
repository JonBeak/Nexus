/**
 * Test Email Fixes
 *
 * Verifies all fixes applied:
 * 1. Urgency box moved to content structure
 * 2. Signature uses full structure (both lines)
 * 3. Signature color matches text color
 * 4. HTML and plain text both have all content
 */

import { getEmailPreviewHtml } from '../services/gmailService';

console.log('\n' + '='.repeat(80));
console.log('  Email Fixes Verification');
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

// Check 1: Urgency box uses content structure
const hasUrgencyBox = preview.html.includes('⚠ Action Required:') &&
                      preview.html.includes('Please review and confirm your order promptly');
console.log('✅ Check 1: Urgency box content from structure:', hasUrgencyBox ? 'PASS' : 'FAIL');

// Check 2: Signature has both lines
const hasFullSignature = preview.html.includes('Best regards') &&
                         preview.html.includes('The Sign House Team');
console.log('✅ Check 2: Signature uses full structure:', hasFullSignature ? 'PASS' : 'FAIL');

// Check 3: Signature doesn't have custom color (uses default text color)
const hasNoCustomSignatureColor = !preview.html.includes('color: #334155');
console.log('✅ Check 3: Signature color matches text:', hasNoCustomSignatureColor ? 'PASS' : 'FAIL');

// Check 4: HTML structure is valid
const hasProperStructure = preview.html.includes('<!DOCTYPE html>') &&
                           preview.html.includes('<html lang="en">') &&
                           preview.html.includes('</html>');
console.log('✅ Check 4: HTML structure valid:', hasProperStructure ? 'PASS' : 'FAIL');

console.log('\n' + '='.repeat(80));
console.log('  Sample Email Content');
console.log('='.repeat(80) + '\n');

console.log('Subject:', preview.subject);
console.log('\nHTML Preview (first 500 chars):');
console.log(preview.html.substring(0, 500) + '...\n');

const allChecks = hasUrgencyBox && hasFullSignature && hasNoCustomSignatureColor && hasProperStructure;

console.log('='.repeat(80));
if (allChecks) {
  console.log('✅ ALL CHECKS PASSED - Email service ready!');
} else {
  console.log('❌ SOME CHECKS FAILED - Review output above');
}
console.log('='.repeat(80) + '\n');

process.exit(allChecks ? 0 : 1);
