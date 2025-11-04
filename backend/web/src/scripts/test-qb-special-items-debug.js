#!/usr/bin/env node

/**
 * Debug test for QuickBooks special items that aren't appearing
 * Focus on: Empty Row, Empty Row with Comment, Subtotal, Subtotal with Comment
 */

const testData = {
  customerName: 'Test Customer',
  customerId: 1,
  taxRate: 0.13,
  items: [
    // 1. Regular item
    {
      rowId: 'row1',
      productTypeId: 1,
      itemName: 'Channel Letters',
      quantity: 1,
      unitPrice: 100,
      extendedPrice: 100,
      calculationDisplay: '12" high letters',
      inputGridDisplayNumber: '1'
    },

    // 2. Empty Row WITHOUT comment (should show as blank line)
    {
      rowId: 'row2',
      productTypeId: 27,
      itemName: '',
      quantity: 0,
      unitPrice: 0,
      extendedPrice: 0,
      calculationDisplay: '',
      inputGridDisplayNumber: '2'
    },

    // 3. Empty Row WITH comment (should show the comment text)
    {
      rowId: 'row3',
      productTypeId: 27,
      itemName: '',
      quantity: 0,
      unitPrice: 0,
      extendedPrice: 0,
      calculationDisplay: 'Note: Customer prefers blue color',
      inputGridDisplayNumber: '3'
    },

    // 4. Another regular item
    {
      rowId: 'row4',
      productTypeId: 2,
      itemName: 'Installation',
      quantity: 2,
      unitPrice: 50,
      extendedPrice: 100,
      calculationDisplay: 'Professional installation',
      inputGridDisplayNumber: '4'
    },

    // 5. Subtotal WITHOUT comment
    {
      rowId: 'row5',
      productTypeId: 21,
      itemName: '',
      quantity: 0,
      unitPrice: 0,
      extendedPrice: 200,
      calculationDisplay: '',
      inputGridDisplayNumber: '5'
    },

    // 6. Empty Row WITH another comment
    {
      rowId: 'row6',
      productTypeId: 27,
      itemName: 'Empty Row Note',
      quantity: 0,
      unitPrice: 0,
      extendedPrice: 0,
      calculationDisplay: 'Additional notes about the project',
      inputGridDisplayNumber: '6'
    },

    // 7. Regular item
    {
      rowId: 'row7',
      productTypeId: 3,
      itemName: 'Vinyl',
      quantity: 10,
      unitPrice: 15,
      extendedPrice: 150,
      calculationDisplay: 'Premium vinyl material',
      inputGridDisplayNumber: '7'
    },

    // 8. Subtotal WITH comment
    {
      rowId: 'row8',
      productTypeId: 21,
      itemName: 'Materials Subtotal',
      quantity: 0,
      unitPrice: 0,
      extendedPrice: 150,
      calculationDisplay: 'Total for all materials',
      inputGridDisplayNumber: '8'
    },

    // 9. Final item
    {
      rowId: 'row9',
      productTypeId: 4,
      itemName: 'Shipping',
      quantity: 1,
      unitPrice: 25,
      extendedPrice: 25,
      calculationDisplay: 'Standard shipping',
      inputGridDisplayNumber: '9'
    }
  ],
  subtotal: 375,
  taxAmount: 48.75,
  total: 423.75
};

console.log('🧪 QuickBooks Special Items Debug Test');
console.log('======================================\n');

console.log('EXPECTED QUICKBOOKS LINE ITEMS:');
console.log('--------------------------------');
console.log('1. Channel Letters → SalesItemLineDetail');
console.log('2. [Blank Line] → DescriptionOnly (space)');
console.log('3. "Note: Customer prefers blue color" → DescriptionOnly');
console.log('4. Installation → SalesItemLineDetail');
console.log('5. [Subtotal: $200] → SubTotalLineDetail');
console.log('6. "Additional notes about the project" → DescriptionOnly');
console.log('7. Vinyl → SalesItemLineDetail');
console.log('8. [Subtotal: $150] "Total for all materials" → SubTotalLineDetail with Description');
console.log('9. Shipping → SalesItemLineDetail\n');

console.log('KEY POINTS TO VERIFY IN CONSOLE LOG:');
console.log('-------------------------------------');
console.log('✓ Empty Row (27) without comment → Should send Description: " " (single space)');
console.log('✓ Empty Row (27) with comment → Should send Description: "Note: Customer prefers..."');
console.log('✓ Subtotal (21) without comment → Should send SubTotalLineDetail with Amount');
console.log('✓ Subtotal (21) with comment → Should send SubTotalLineDetail with Amount AND Description\n');

console.log('WHAT TO LOOK FOR IN THE LOGS:');
console.log('-----------------------------');
console.log('1. Check "🔍 DETAILED QB API PAYLOAD" section');
console.log('2. Verify all 9 line items are present');
console.log('3. Check "FULL JSON PAYLOAD" to see exact JSON sent');
console.log('4. Check "🌐 QUICKBOOKS API CALL" for the actual API request');
console.log('5. Check "📥 QUICKBOOKS RESPONSE" to see what QB returned\n');

console.log('POSSIBLE ISSUES:');
console.log('----------------');
console.log('• QB might be stripping DescriptionOnly lines');
console.log('• SubTotalLineDetail might not support Description field');
console.log('• Line ordering (LineNum) might affect display');
console.log('• QB might auto-calculate subtotals differently\n');

module.exports = { testData };