-- Phase 4.c: Remove default_lead_days from product_archetypes
-- Purpose: Archetypes are templates, not purchasable items. Lead times belong on supplier_products or suppliers.
-- Created: 2025-12-19

-- Step 1: Check what will be lost (for documentation purposes)
-- This should be run separately to review before execution
SELECT archetype_id, name, default_lead_days
FROM product_archetypes
WHERE default_lead_days IS NOT NULL;

-- Step 2: Drop the column
ALTER TABLE product_archetypes
DROP COLUMN default_lead_days;

-- Step 3: Verification - confirm column is removed
DESCRIBE product_archetypes;
