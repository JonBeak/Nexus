-- Add calculation_display column to estimate_preparation_items
-- Stores the calculation formula/notes for each line item (e.g., "8 Letters × $45/letter")

ALTER TABLE estimate_preparation_items
ADD COLUMN calculation_display TEXT COMMENT 'Display of calculation logic (e.g., "8 Letters × $45/letter")' AFTER qb_description;

-- Rollback command (for reference, do not run):
-- ALTER TABLE estimate_preparation_items DROP COLUMN calculation_display;
