-- Phase 1.5.c.3: Order Part Snapshots Table
-- Date: 2025-11-06
-- Purpose: Store version history of order parts for audit trail and comparison

-- ============================================================================
-- PART 1: Create order_part_snapshots table
-- ============================================================================

CREATE TABLE IF NOT EXISTS order_part_snapshots (
  snapshot_id INT PRIMARY KEY AUTO_INCREMENT,
  part_id INT NOT NULL COMMENT 'FK to order_parts',
  version_number INT NOT NULL COMMENT 'Sequential version (1, 2, 3...)',

  -- Snapshot data (copy of order_parts at finalization time)
  specifications JSON COMMENT 'Semantic keys snapshot',
  invoice_description TEXT,
  quantity DECIMAL(10,2),
  unit_price DECIMAL(10,2),
  extended_price DECIMAL(10,2),
  production_notes TEXT,

  -- Metadata
  snapshot_type ENUM('finalization', 'manual') DEFAULT 'finalization' COMMENT 'Auto finalization or manual save',
  notes TEXT COMMENT 'Reason for snapshot (e.g., "Customer requested size change")',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT COMMENT 'User who created snapshot',

  -- Foreign keys
  FOREIGN KEY (part_id) REFERENCES order_parts(part_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,

  -- Indexes
  INDEX idx_part_id (part_id),
  INDEX idx_part_version (part_id, version_number),
  INDEX idx_created_at (created_at),

  -- Ensure unique version numbers per part
  UNIQUE KEY uk_part_version (part_id, version_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- PART 2: Remove finalized_snapshot column if it exists
-- ============================================================================

-- Check if column exists and drop it (no redundancy)
SET @dbname = DATABASE();
SET @tablename = 'order_parts';
SET @columnname = 'finalized_snapshot';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname
  ) > 0,
  'ALTER TABLE order_parts DROP COLUMN finalized_snapshot;',
  'SELECT "Column finalized_snapshot does not exist, skipping drop" AS Status;'
));

PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Verify table structure
DESCRIBE order_part_snapshots;

-- Check if finalized_snapshot column was removed
SELECT 'Checking order_parts columns:' as status;
SHOW COLUMNS FROM order_parts LIKE '%snapshot%';

-- ============================================================================
-- Sample Data (for testing)
-- ============================================================================

-- Example: Create snapshot for order #200000's first part
-- Uncomment to test after implementation

/*
INSERT INTO order_part_snapshots (
  part_id,
  version_number,
  specifications,
  invoice_description,
  quantity,
  unit_price,
  extended_price,
  production_notes,
  snapshot_type,
  notes,
  created_by
)
SELECT
  part_id,
  1 as version_number,
  specifications,
  invoice_description,
  quantity,
  unit_price,
  extended_price,
  production_notes,
  'finalization' as snapshot_type,
  'Initial finalization' as notes,
  1 as created_by
FROM order_parts
WHERE order_id = (SELECT order_id FROM orders WHERE order_number = 200000)
LIMIT 1;
*/

-- ============================================================================
-- Useful Queries
-- ============================================================================

-- Get latest snapshot for each part
/*
SELECT
  ops.part_id,
  ops.version_number,
  ops.specifications,
  ops.invoice_description,
  ops.created_at,
  u.username as created_by_username
FROM order_part_snapshots ops
INNER JOIN (
  SELECT part_id, MAX(version_number) as max_version
  FROM order_part_snapshots
  GROUP BY part_id
) latest ON ops.part_id = latest.part_id AND ops.version_number = latest.max_version
LEFT JOIN users u ON ops.created_by = u.user_id;
*/

-- Get version history for a specific part
/*
SELECT
  snapshot_id,
  version_number,
  snapshot_type,
  notes,
  created_at,
  u.username as created_by
FROM order_part_snapshots ops
LEFT JOIN users u ON ops.created_by = u.user_id
WHERE part_id = ?
ORDER BY version_number DESC;
*/

-- Compare two versions
/*
SELECT
  v1.version_number as version_1,
  v1.specifications as specs_v1,
  v2.version_number as version_2,
  v2.specifications as specs_v2
FROM order_part_snapshots v1
JOIN order_part_snapshots v2 ON v1.part_id = v2.part_id
WHERE v1.part_id = ?
  AND v1.version_number = ?
  AND v2.version_number = ?;
*/

-- ============================================================================
-- Rollback Script
-- ============================================================================

/*
-- Drop the snapshots table
DROP TABLE IF EXISTS order_part_snapshots;
*/
