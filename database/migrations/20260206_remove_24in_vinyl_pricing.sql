-- Remove unused 24in vinyl pricing rows from vinyl_pricing table
-- These component codes (PC_24IN variants) are not used by any business logic.
-- The vinyl pricing calculator only uses VINYL_TRANS, VINYL_PERF, DIGITAL_PRINT, and fee codes.

DELETE FROM vinyl_pricing WHERE component_code IN ('VINYL_TRANS_24IN', 'VINYL_TRANS_24IN_CUT', 'VINYL_PERF_24IN');

-- Clean up unused 24_inch_rate / 24_perf_rate JSON keys from vinyl_materials_pricing.calculation_rules
-- (only applies if vinyl_materials_pricing table exists from seed migration)
SET @has_table = (SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'vinyl_materials_pricing');

SET @sql1 = IF(@has_table > 0,
  'UPDATE vinyl_materials_pricing SET calculation_rules = JSON_REMOVE(calculation_rules, \'$."24_inch_rate"\') WHERE JSON_CONTAINS_PATH(calculation_rules, \'one\', \'$."24_inch_rate"\')',
  'SELECT 1');
PREPARE stmt1 FROM @sql1;
EXECUTE stmt1;
DEALLOCATE PREPARE stmt1;

SET @sql2 = IF(@has_table > 0,
  'UPDATE vinyl_materials_pricing SET calculation_rules = JSON_REMOVE(calculation_rules, \'$."24_perf_rate"\') WHERE JSON_CONTAINS_PATH(calculation_rules, \'one\', \'$."24_perf_rate"\')',
  'SELECT 1');
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;
