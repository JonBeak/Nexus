-- =====================================================
-- ADD PS TYPE FIELD TO BLADE SIGN
-- =====================================================
-- Migration: Enable field6 as "PS Type" for Blade Sign (Product Type 6)
-- Date: 2026-02-10
-- Purpose: Add PS Type field next to PS # (field5), matching Channel Letters pattern
-- Issue: #30

-- Update product_types field_prompts to enable field6 as "PS Type"
UPDATE product_types
SET field_prompts = JSON_SET(
  field_prompts,
  '$.field6', 'PS Type',
  '$.field6_enabled', true
)
WHERE id = 6;

-- Add dynamic dropdown config for field6 (PS Type)
-- Matches Channel Letters field10 config: dynamic lookup from power_supplies table
UPDATE product_types
SET static_options = JSON_SET(
  static_options,
  '$.field6', CAST('{"type":"dynamic","where":"is_active = 1","source":"power_supplies","order_by":"power_supply_id","value_field":"transformer_type","display_field":"transformer_type"}' AS JSON)
)
WHERE id = 6;

-- Verification query
SELECT
  JSON_EXTRACT(field_prompts, '$.field6') AS ps_type_label,
  JSON_EXTRACT(field_prompts, '$.field6_enabled') AS ps_type_enabled,
  JSON_EXTRACT(static_options, '$.field6') AS ps_type_options
FROM product_types
WHERE id = 6;
