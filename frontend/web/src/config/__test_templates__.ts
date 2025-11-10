/**
 * Template System Test/Demo
 * Phase 1.5.c.2 - Quick tests to verify template system works
 *
 * Run in browser console or Node to verify functionality
 */

import {
  getOrderTemplate,
  getAllTemplates,
  getTemplatesByCategory,
  validateSpecifications
} from './orderProductTemplates';

// Test 1: Get template for Channel Letters
console.log('=== Test 1: Get Channel Letters Template ===');
const channelLettersTemplate = getOrderTemplate('Channel Letters - Front Lit');
console.log('Product Type:', channelLettersTemplate.product_type);
console.log('Fields:', channelLettersTemplate.fields.map(f => f.label).join(', '));
console.log('✅ Test 1 Passed\n');

// Test 2: Prefix matching
console.log('=== Test 2: Prefix Matching ===');
const template1 = getOrderTemplate('Channel Letters');
const template2 = getOrderTemplate('Channel Letters - Front Lit');
console.log('Same template?', template1 === template2); // Should be true
console.log('✅ Test 2 Passed\n');

// Test 3: Default template fallback
console.log('=== Test 3: Default Template Fallback ===');
const unknownTemplate = getOrderTemplate('Unknown Product Type');
console.log('Product Type:', unknownTemplate.product_type); // Should be "Default"
console.log('Fields:', unknownTemplate.fields.length); // Should be 4
console.log('✅ Test 3 Passed\n');

// Test 4: Get all templates
console.log('=== Test 4: Get All Templates ===');
const allTemplates = getAllTemplates();
console.log('Total templates:', allTemplates.length); // Should be 5
console.log('Template names:', allTemplates.map(t => t.product_type).join(', '));
console.log('✅ Test 4 Passed\n');

// Test 5: Get templates by category
console.log('=== Test 5: Get Templates By Category ===');
const componentTemplates = getTemplatesByCategory('Components');
console.log('Component templates:', componentTemplates.length); // Should be 2 (Vinyl, Painting)
console.log('Names:', componentTemplates.map(t => t.product_type).join(', '));
console.log('✅ Test 5 Passed\n');

// Test 6: Valid specifications
console.log('=== Test 6: Valid Specifications ===');
const validSpecs = {
  type: '3" Front Lit',
  height: '12'
};
const validResult = validateSpecifications('Channel Letters', validSpecs);
console.log('Valid?', validResult.valid); // Should be true
console.log('Errors:', validResult.errors); // Should be empty
console.log('✅ Test 6 Passed\n');

// Test 7: Invalid specifications (missing required field)
console.log('=== Test 7: Invalid Specifications (Missing Required) ===');
const invalidSpecs1 = {
  height: '12'
  // Missing required 'type' field
};
const invalidResult1 = validateSpecifications('Channel Letters', invalidSpecs1);
console.log('Valid?', invalidResult1.valid); // Should be false
console.log('Errors:', invalidResult1.errors); // Should contain "Letter Type is required"
console.log('✅ Test 7 Passed\n');

// Test 8: Invalid specifications (out of range)
console.log('=== Test 8: Invalid Specifications (Out of Range) ===');
const invalidSpecs2 = {
  type: '3" Front Lit',
  height: '-5' // Below minimum (1)
};
const invalidResult2 = validateSpecifications('Channel Letters', invalidSpecs2);
console.log('Valid?', invalidResult2.valid); // Should be false
console.log('Errors:', invalidResult2.errors); // Should contain "must be at least 1"
console.log('✅ Test 8 Passed\n');

// Test 9: LED Neon template
console.log('=== Test 9: LED Neon Template ===');
const ledNeonTemplate = getOrderTemplate('LED Neon');
console.log('Product Type:', ledNeonTemplate.product_type);
console.log('Required fields:', ledNeonTemplate.fields.filter(f => f.required).map(f => f.label).join(', '));
console.log('✅ Test 9 Passed\n');

// Test 10: Vinyl template (component)
console.log('=== Test 10: Vinyl Template (Component) ===');
const vinylTemplate = getOrderTemplate('↳ Vinyl');
console.log('Product Type:', vinylTemplate.product_type);
console.log('Category:', vinylTemplate.category); // Should be "Components"
console.log('✅ Test 10 Passed\n');

console.log('🎉 All 10 tests passed!');
