-- Add special supplier records for "In Stock" and "In House"
-- These are used by the frontend SupplierDropdown component with IDs -1 and -2
-- Created: 2026-02-03

-- Insert "In Stock" supplier (ID: -1)
INSERT INTO suppliers (supplier_id, name, notes, is_active, payment_terms, created_at)
VALUES (
  -1,
  'In Stock',
  'Material sourced from existing inventory',
  1,
  NULL,
  NOW()
) ON DUPLICATE KEY UPDATE
  name = 'In Stock',
  notes = 'Material sourced from existing inventory',
  is_active = 1;

-- Insert "In House" supplier (ID: -2)
INSERT INTO suppliers (supplier_id, name, notes, is_active, payment_terms, created_at)
VALUES (
  -2,
  'In House',
  'Product produced in-house (e.g., digital prints)',
  1,
  NULL,
  NOW()
) ON DUPLICATE KEY UPDATE
  name = 'In House',
  notes = 'Product produced in-house (e.g., digital prints)',
  is_active = 1;
