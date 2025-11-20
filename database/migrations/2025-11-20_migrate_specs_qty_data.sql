-- Data Migration: Extract specs_qty from specifications JSON and populate new column
-- Date: 2025-11-20
-- Purpose: Move existing specs_qty data from JSON to the new column

-- Extract specs_qty from specifications JSON and populate new column
UPDATE order_parts
SET specs_qty = COALESCE(
  CAST(JSON_UNQUOTE(JSON_EXTRACT(specifications, '$.specs_qty')) AS DECIMAL(10,2)),
  0
)
WHERE JSON_EXTRACT(specifications, '$.specs_qty') IS NOT NULL;

-- Set default 0 for parts without specs_qty in JSON
UPDATE order_parts
SET specs_qty = 0
WHERE specs_qty IS NULL;

-- Verification queries
SELECT
  'Total parts' as metric,
  COUNT(*) as count
FROM order_parts
UNION ALL
SELECT
  'Parts with specs_qty > 0' as metric,
  COUNT(*) as count
FROM order_parts
WHERE specs_qty > 0
UNION ALL
SELECT
  'Parts with specs_qty in JSON' as metric,
  COUNT(*) as count
FROM order_parts
WHERE JSON_EXTRACT(specifications, '$.specs_qty') IS NOT NULL;

-- Sample comparison (first 5 parts with specs_qty)
SELECT
  part_id,
  specs_qty as new_column_value,
  JSON_EXTRACT(specifications, '$.specs_qty') as old_json_value,
  CASE
    WHEN specs_qty = CAST(JSON_UNQUOTE(JSON_EXTRACT(specifications, '$.specs_qty')) AS DECIMAL(10,2))
    THEN 'MATCH'
    ELSE 'MISMATCH'
  END as status
FROM order_parts
WHERE JSON_EXTRACT(specifications, '$.specs_qty') IS NOT NULL
LIMIT 10;
