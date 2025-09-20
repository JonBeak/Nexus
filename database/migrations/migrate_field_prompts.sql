-- Migration script to convert input_template to field_prompts
-- Adds field_prompts column and migrates existing data

-- Add field_prompts column (skip if already exists)
-- ALTER TABLE product_types ADD COLUMN field_prompts JSON DEFAULT NULL AFTER input_template;

-- Migration for Channel Letters (ID: 1)
UPDATE product_types
SET field_prompts = JSON_OBJECT(
    'field1', 'Type',
    'field1_enabled', true,
    'field2', 'Inches/LED',
    'field2_enabled', true,
    'field3', 'LEDs #',
    'field3_enabled', true,
    'field4', 'UL',
    'field4_enabled', true,
    'field5', 'Pins #',
    'field5_enabled', true,
    'field6', 'Pins Len',
    'field6_enabled', true,
    'field7', 'Xtra Wire',
    'field7_enabled', true,
    'field8', 'LED Type',
    'field8_enabled', true,
    'field9', 'PS #',
    'field9_enabled', true,
    'field10', 'PS Type',
    'field10_enabled', true,
    'field11', '',
    'field11_enabled', false,
    'field12', '',
    'field12_enabled', false
)
WHERE id = 1;

-- Migration for Vinyl (ID: 2)
UPDATE product_types
SET field_prompts = JSON_OBJECT(
    'field1', 'Vinyl Type',
    'field1_enabled', true,
    'field2', 'Dimensions',
    'field2_enabled', true,
    'field3', 'Application',
    'field3_enabled', true,
    'field4', 'Quantity',
    'field4_enabled', true,
    'field5', '',
    'field5_enabled', false,
    'field6', '',
    'field6_enabled', false,
    'field7', '',
    'field7_enabled', false,
    'field8', '',
    'field8_enabled', false,
    'field9', '',
    'field9_enabled', false,
    'field10', '',
    'field10_enabled', false,
    'field11', '',
    'field11_enabled', false,
    'field12', '',
    'field12_enabled', false
)
WHERE id = 2;

-- Migration for Substrate Cut (ID: 3)
UPDATE product_types
SET field_prompts = JSON_OBJECT(
    'field1', 'Substrate Material',
    'field1_enabled', true,
    'field2', 'Dimensions',
    'field2_enabled', true,
    'field3', 'Cutting Required',
    'field3_enabled', true,
    'field4', 'Drilling Holes',
    'field4_enabled', true,
    'field5', 'Hardware',
    'field5_enabled', true,
    'field6', '',
    'field6_enabled', false,
    'field7', '',
    'field7_enabled', false,
    'field8', '',
    'field8_enabled', false,
    'field9', '',
    'field9_enabled', false,
    'field10', '',
    'field10_enabled', false,
    'field11', '',
    'field11_enabled', false,
    'field12', '',
    'field12_enabled', false
)
WHERE id = 3;

-- For any remaining product types without field_prompts, set empty template
UPDATE product_types
SET field_prompts = JSON_OBJECT(
    'field1', '',
    'field1_enabled', false,
    'field2', '',
    'field2_enabled', false,
    'field3', '',
    'field3_enabled', false,
    'field4', '',
    'field4_enabled', false,
    'field5', '',
    'field5_enabled', false,
    'field6', '',
    'field6_enabled', false,
    'field7', '',
    'field7_enabled', false,
    'field8', '',
    'field8_enabled', false,
    'field9', '',
    'field9_enabled', false,
    'field10', '',
    'field10_enabled', false,
    'field11', '',
    'field11_enabled', false,
    'field12', '',
    'field12_enabled', false
)
WHERE field_prompts IS NULL;