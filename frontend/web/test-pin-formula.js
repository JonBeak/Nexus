// Quick test for pin formula parser
// Run with: node test-pin-formula.js

// Import the parser (note: this is a simple test, not a full unit test)
const testCases = [
  // Simple numbers
  { input: '50', expected: 50, description: 'Simple number' },
  { input: '  50  ', expected: 50, description: 'Number with whitespace' },
  { input: '50.5', expected: 50.5, description: 'Decimal number' },

  // Addition
  { input: '50 + 25', expected: 75, description: 'Addition' },
  { input: '50+25', expected: 75, description: 'Addition no spaces' },

  // Subtraction
  { input: '100 - 20', expected: 80, description: 'Subtraction' },
  { input: '100-20', expected: 80, description: 'Subtraction no spaces' },

  // Multiplication (x)
  { input: '25x9', expected: 225, description: 'Multiplication with x' },
  { input: '25 x 9', expected: 225, description: 'Multiplication with x and spaces' },

  // Multiplication (*)
  { input: '25*9', expected: 225, description: 'Multiplication with *' },
  { input: '25 * 9', expected: 225, description: 'Multiplication with * and spaces' },

  // Division
  { input: '100/4', expected: 25, description: 'Division' },
  { input: '100 / 4', expected: 25, description: 'Division with spaces' },

  // Combined (order of operations)
  { input: '50 + 25x9', expected: 275, description: 'Addition and multiplication (50 + 225)' },
  { input: '50 + 25*9', expected: 275, description: 'Addition and multiplication with *' },
  { input: '100 - 20 + 5x3', expected: 95, description: 'Subtraction, addition, multiplication (100 - 20 + 15)' },
  { input: '10 + 20 / 4', expected: 15, description: 'Addition and division (10 + 5)' },
  { input: '100 - 20 / 4', expected: 95, description: 'Subtraction and division (100 - 5)' },

  // Complex
  { input: '10 + 5 * 2 - 3', expected: 17, description: 'Multiple operations (10 + 10 - 3)' },
  { input: '100 / 5 + 10 * 2', expected: 40, description: 'Division, addition, multiplication (20 + 20)' },

  // Error cases (should fail)
  { input: '', expected: 'ERROR', description: 'Empty string' },
  { input: '50 + + 25', expected: 'ERROR', description: 'Double operator' },
  { input: '50 + abc', expected: 'ERROR', description: 'Non-numeric' },
  { input: '100 / 0', expected: 'ERROR', description: 'Division by zero' },
];

console.log('Pin Formula Parser Test Cases\n');
console.log('Expected Results:');
console.log('================\n');

testCases.forEach((test, index) => {
  const result = test.expected === 'ERROR' ? 'Should error' : `= ${test.expected}`;
  console.log(`${index + 1}. ${test.description}`);
  console.log(`   Input: "${test.input}"`);
  console.log(`   Expected: ${result}\n`);
});

console.log('\nTo run actual tests:');
console.log('1. Start the development server');
console.log('2. Open Job Estimation modal');
console.log('3. Select Channel Letters or Substrate Cut');
console.log('4. Try entering formulas in the pins field (field5 or field3)');
console.log('5. Verify validation passes and calculated value is correct\n');
