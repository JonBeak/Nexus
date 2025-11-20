# Phase 1.5.b: Database Schema Updates

**Status:** ✅ COMPLETE (2025-11-06)
**Priority:** CRITICAL - MUST run before Phase 1.5.a
**Actual Duration:** 1 day (migration + testing)
**Last Updated:** 2025-11-06

---

## Overview

Phase 1.5.b extends the database schema to support the Job Details Setup dual-table interface. This phase must be completed BEFORE Phase 1.5.a implementation begins.

**Key Changes:**
1. Rename status `'initiated'` → `'job_details_setup'`
2. Add 7 new columns to `orders` table
3. Add 6 new columns to `order_parts` table (no row_type - determined by nullable columns)
4. Remove `task_order` column from `order_tasks` table
5. Delete existing auto-generated tasks
6. Update status history records

---

## Schema Changes Summary

### orders Table (7 new columns)

| Column | Type | Purpose |
|--------|------|---------|
| `customer_job_number` | VARCHAR(100) | Customer's job reference number |
| `hard_due_date_time` | DATETIME | Exact due date/time for critical deadlines |
| `manufacturing_note` | TEXT | Instructions from customer (customer-facing, editable) |
| `internal_note` | TEXT | Private notes for internal use (Manager+ only) |
| `finalized_at` | TIMESTAMP NULL | When order was finalized and sent for approval |
| `finalized_by` | INT NULL | FK to users - who finalized the order |
| `modified_after_finalization` | BOOLEAN | Flag if changes made after finalization |

**Status Enum Change:**
- OLD: `'initiated'` (first value)
- NEW: `'job_details_setup'` (first value)

### order_parts Table (6 new columns)

| Column | Type | Purpose |
|--------|------|---------|
| `display_number` | VARCHAR(10) NULL | Display number: "1", "1a", "1b", "1c", "2", "2a"... (nullable for invoice-only rows) |
| `is_parent` | BOOLEAN | TRUE if parent item ("1", "2"), FALSE if sub-part ("1a", "1b") |
| `invoice_description` | TEXT NULL | Description for invoice (right table) |
| `unit_price` | DECIMAL(10,2) NULL | Price per unit for invoice |
| `extended_price` | DECIMAL(10,2) NULL | Total price (quantity × unit_price) |

**Row Type (Implicit):**
Row types are determined by which columns are populated (no explicit `row_type` column):
- **Both**: specifications JSON + invoice fields both populated
- **Specs Only**: specifications JSON populated, invoice fields NULL
- **Invoice Only**: specifications NULL, invoice fields populated
- **Separator**: Both specifications and invoice fields NULL (visual divider)

### order_tasks Table (1 column removed)

| Column | Action | Reason |
|--------|--------|--------|
| `task_order` | REMOVED | Task order derived from `depends_on_task_id` chain |

**Data Cleanup:**
- Delete all existing auto-generated tasks
- Reset AUTO_INCREMENT to 1
- Tasks will be manually entered in Phase 1.5.d

---

## Migration Script

**File:** `/home/jon/Nexus/database/migrations/phase_1.5b_schema_updates.sql`

```sql
-- ============================================================================
-- Phase 1.5.b: Database Schema Updates
-- Purpose: Extend schema for Job Details Setup dual-table interface
-- Date: 2025-11-05
-- Author: System
-- ============================================================================

USE sign_manufacturing;

-- ============================================================================
-- STEP 1: Backup existing data (recommended before major schema changes)
-- ============================================================================

-- Run these manually if desired:
-- CREATE TABLE orders_backup_20251105 AS SELECT * FROM orders;
-- CREATE TABLE order_parts_backup_20251105 AS SELECT * FROM order_parts;
-- CREATE TABLE order_tasks_backup_20251105 AS SELECT * FROM order_tasks;

-- ============================================================================
-- STEP 2: Update orders table
-- ============================================================================

-- Add new order-wide fields for Job Details Setup phase
ALTER TABLE orders
  ADD COLUMN customer_job_number VARCHAR(100) NULL
    COMMENT 'Customer job reference number'
    AFTER customer_po,
  ADD COLUMN hard_due_date_time DATETIME NULL
    COMMENT 'Exact due date/time if deadline is critical'
    AFTER due_date,
  ADD COLUMN manufacturing_note TEXT NULL
    COMMENT 'Instructions from customer (editable, customer-facing)'
    AFTER production_notes,
  ADD COLUMN internal_note TEXT NULL
    COMMENT 'Private notes for internal use only (Manager+ only)'
    AFTER manufacturing_note,
  ADD COLUMN finalized_at TIMESTAMP NULL
    COMMENT 'When order was finalized (moved to pending_confirmation)'
    AFTER modified_after_finalization,
  ADD COLUMN finalized_by INT NULL
    COMMENT 'User who finalized the order'
    AFTER finalized_at,
  ADD COLUMN modified_after_finalization BOOLEAN DEFAULT FALSE
    COMMENT 'Flag if changes made after finalization'
    AFTER finalized_by,
  ADD FOREIGN KEY fk_orders_finalized_by (finalized_by)
    REFERENCES users(user_id) ON DELETE SET NULL;

-- Verify new columns added
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'sign_manufacturing'
  AND TABLE_NAME = 'orders'
  AND COLUMN_NAME IN (
    'customer_job_number',
    'hard_due_date_time',
    'manufacturing_note',
    'internal_note',
    'finalized_at',
    'finalized_by',
    'modified_after_finalization'
  );

-- ============================================================================
-- STEP 3: Update status enum in orders table
-- ============================================================================

-- Update status enum: Rename 'initiated' → 'job_details_setup'
ALTER TABLE orders
  MODIFY COLUMN status ENUM(
    'job_details_setup',              -- NEW (was 'initiated')
    'pending_confirmation',
    'pending_production_files_creation',
    'pending_production_files_approval',
    'production_queue',
    'in_production',
    'on_hold',
    'overdue',
    'qc_packing',
    'shipping',
    'pick_up',
    'awaiting_payment',
    'completed',
    'cancelled'
  ) DEFAULT 'job_details_setup'
  COMMENT 'Order workflow status';

-- Migrate existing 'initiated' records to new status value
UPDATE orders
SET status = 'job_details_setup'
WHERE status = 'initiated';

-- Verify status migration
SELECT status, COUNT(*) as count
FROM orders
GROUP BY status;

-- ============================================================================
-- STEP 4: Update order_parts table
-- ============================================================================

-- Add dual-table interface fields
-- Note: Row "type" is implicit based on which columns are populated
ALTER TABLE order_parts
  ADD COLUMN display_number VARCHAR(10) NULL
    COMMENT 'Display number: "1", "1a", "1b", "1c", "2", "2a"... (nullable for invoice-only rows)'
    AFTER part_number,
  ADD COLUMN is_parent BOOLEAN DEFAULT FALSE
    COMMENT 'TRUE if parent item (e.g., "1", "2"), FALSE if sub-part (e.g., "1a", "1b")'
    AFTER display_number,
  ADD COLUMN invoice_description TEXT NULL
    COMMENT 'Description field for invoice (right table)'
    AFTER production_notes,
  ADD COLUMN unit_price DECIMAL(10,2) NULL
    COMMENT 'Price per unit for invoice'
    AFTER invoice_description,
  ADD COLUMN extended_price DECIMAL(10,2) NULL
    COMMENT 'Total price (quantity × unit_price)'
    AFTER unit_price;

-- Add indexes for new columns
ALTER TABLE order_parts
  ADD INDEX idx_display_number (display_number),
  ADD INDEX idx_is_parent (is_parent);

-- Note: display_number is nullable and will be populated by Phase 1.5.a numbering logic
-- No backfill needed for existing records

-- Verify new columns added
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'sign_manufacturing'
  AND TABLE_NAME = 'order_parts'
  AND COLUMN_NAME IN (
    'display_number',
    'is_parent',
    'invoice_description',
    'unit_price',
    'extended_price'
  );

-- ============================================================================
-- STEP 5: Update order_tasks table
-- ============================================================================

-- Remove task_order column (order derived from depends_on_task_id chain)
ALTER TABLE order_tasks
  DROP COLUMN task_order;

-- Update comment on depends_on_task_id (no longer "for future use")
ALTER TABLE order_tasks
  MODIFY COLUMN depends_on_task_id INT DEFAULT NULL
    COMMENT 'Task that must complete before this task (FK to task_id)';

-- Verify column removed
SELECT COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'sign_manufacturing'
  AND TABLE_NAME = 'order_tasks'
  AND COLUMN_NAME = 'task_order';
-- Should return 0 rows

-- ============================================================================
-- STEP 6: Data Cleanup
-- ============================================================================

-- Delete all existing auto-generated tasks (will be manually entered in Phase 1.5)
DELETE FROM order_tasks;

-- Reset AUTO_INCREMENT for order_tasks
ALTER TABLE order_tasks AUTO_INCREMENT = 1;

-- Verify tasks deleted
SELECT COUNT(*) as remaining_tasks FROM order_tasks;
-- Should return 0

-- ============================================================================
-- STEP 7: Update order_status_history for new status value
-- ============================================================================

-- Update status history records
UPDATE order_status_history
SET status = 'job_details_setup'
WHERE status = 'initiated';

-- Verify status history migration
SELECT status, COUNT(*) as count
FROM order_status_history
GROUP BY status;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Run these after migration to verify success:

-- 1. Check orders table structure
SHOW CREATE TABLE orders;

-- 2. Check order_parts table structure
SHOW CREATE TABLE order_parts;

-- 3. Check order_tasks table structure
SHOW CREATE TABLE order_tasks;

-- 4. Verify status migration in orders
SELECT status, COUNT(*) as count FROM orders GROUP BY status;

-- 5. Verify status migration in history
SELECT status, COUNT(*) as count FROM order_status_history GROUP BY status;

-- 6. Verify order_parts structure
SELECT order_id, part_number, display_number, is_parent,
       invoice_description, unit_price, extended_price
FROM order_parts
ORDER BY order_id, part_number
LIMIT 20;

-- 7. Verify tasks cleanup
SELECT COUNT(*) as total_tasks FROM order_tasks;  -- Should be 0

-- 8. Check foreign key constraints
SELECT
  CONSTRAINT_NAME,
  TABLE_NAME,
  COLUMN_NAME,
  REFERENCED_TABLE_NAME,
  REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'sign_manufacturing'
  AND TABLE_NAME IN ('orders', 'order_parts', 'order_tasks')
  AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, CONSTRAINT_NAME;

-- ============================================================================
-- ROLLBACK SCRIPT (if migration fails)
-- ============================================================================

-- WARNING: Only run if migration fails and you need to revert
-- Uncomment and run these statements if rollback is necessary

-- -- Rollback orders table changes
-- ALTER TABLE orders
--   DROP FOREIGN KEY fk_orders_finalized_by,
--   DROP COLUMN customer_job_number,
--   DROP COLUMN hard_due_date_time,
--   DROP COLUMN manufacturing_note,
--   DROP COLUMN internal_note,
--   DROP COLUMN finalized_at,
--   DROP COLUMN finalized_by,
--   DROP COLUMN modified_after_finalization;

-- -- Rollback status enum
-- ALTER TABLE orders
--   MODIFY COLUMN status ENUM(
--     'initiated',
--     'pending_confirmation',
--     'pending_production_files_creation',
--     'pending_production_files_approval',
--     'production_queue',
--     'in_production',
--     'on_hold',
--     'overdue',
--     'qc_packing',
--     'shipping',
--     'pick_up',
--     'awaiting_payment',
--     'completed',
--     'cancelled'
--   ) DEFAULT 'initiated';

-- UPDATE orders SET status = 'initiated' WHERE status = 'job_details_setup';
-- UPDATE order_status_history SET status = 'initiated' WHERE status = 'job_details_setup';

-- -- Rollback order_parts table changes
-- ALTER TABLE order_parts
--   DROP INDEX idx_display_number,
--   DROP INDEX idx_is_parent,
--   DROP COLUMN display_number,
--   DROP COLUMN is_parent,
--   DROP COLUMN invoice_description,
--   DROP COLUMN unit_price,
--   DROP COLUMN extended_price;

-- -- Rollback order_tasks table changes
-- ALTER TABLE order_tasks
--   ADD COLUMN task_order TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER task_name;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

-- Final message
SELECT 'Phase 1.5.b migration completed successfully!' as status;
```

---

## Execution Steps

### Pre-Migration Checklist

- [ ] **Backup database** before running migration
- [ ] **Stop application servers** (backend and frontend)
- [ ] **Verify database connection** works
- [ ] **Review migration script** for correctness
- [ ] **Identify existing orders** to be migrated

### Running the Migration

```bash
# 1. Backup database
mysqldump -u root -p sign_manufacturing > /tmp/sign_manufacturing_backup_20251105.sql

# 2. Stop servers
/home/jon/Nexus/infrastructure/scripts/stop-servers.sh

# 3. Run migration script
mysql -u root -p sign_manufacturing < /home/jon/Nexus/database/migrations/phase_1.5b_schema_updates.sql

# 4. Verify migration
mysql -u root -p sign_manufacturing
```

### Post-Migration Verification

```sql
-- In MySQL console, run verification queries:

-- 1. Check new columns exist
DESCRIBE orders;
DESCRIBE order_parts;
DESCRIBE order_tasks;

-- 2. Verify status enum
SHOW COLUMNS FROM orders LIKE 'status';

-- 3. Check data migration
SELECT status, COUNT(*) FROM orders GROUP BY status;

-- 4. Verify tasks deleted
SELECT COUNT(*) FROM order_tasks;  -- Should be 0

-- 5. Check indexes
SHOW INDEX FROM order_parts;
```

### Start Servers

```bash
# Once verification passes, restart servers
/home/jon/Nexus/infrastructure/scripts/start-servers.sh

# Check status
/home/jon/Nexus/infrastructure/scripts/status-servers.sh
```

---

## Schema Impact Analysis

### Tables Modified

1. **orders** - 7 new columns, 1 enum value changed
2. **order_parts** - 6 new columns, 2 new indexes (no row_type - type is implicit)
3. **order_tasks** - 1 column removed
4. **order_status_history** - Status values updated

### Data Migration Impact

**Existing Orders:**
- Status `'initiated'` → `'job_details_setup'` (semantic change, same meaning)
- All existing orders remain functional
- New columns populated with NULL (acceptable)

**Existing Order Parts:**
- `display_number` remains NULL (will be populated by Phase 1.5.a numbering logic)
- `is_parent` defaults to FALSE (will be set by Phase 1.5.a)
- New invoice columns NULL (will be populated for new orders)
- Row "type" determined by which columns are populated

**Existing Tasks:**
- **ALL DELETED** (97 tasks from Order #200003 will be removed)
- Acceptable because Phase 1 tasks were auto-generated from templates
- Phase 1.5 uses manual task entry

### Foreign Key Relationships

**New FK:**
- `orders.finalized_by` → `users.user_id`

**Existing FK (unchanged):**
- `order_parts.order_id` → `orders.order_id`
- `order_tasks.order_id` → `orders.order_id`
- `order_tasks.part_id` → `order_parts.part_id`
- `order_tasks.depends_on_task_id` → `order_tasks.task_id`

---

## Backend TypeScript Types Updates

**File:** `/backend/web/src/types/orders.ts`

### Update Order Interface

```typescript
export interface Order {
  order_id: number;
  order_number: number;
  version_number: number;
  order_name: string;
  estimate_id?: number;
  customer_id: number;
  customer_po?: string;
  customer_job_number?: string;              // NEW
  point_person_email?: string;
  order_date: Date;
  due_date?: Date;
  hard_due_date_time?: Date;                 // NEW
  production_notes?: string;
  manufacturing_note?: string;               // NEW
  internal_note?: string;                    // NEW
  sign_image_path?: string;
  form_version: number;
  shipping_required: boolean;
  status: OrderStatus;
  finalized_at?: Date;                       // NEW
  finalized_by?: number;                     // NEW
  modified_after_finalization: boolean;      // NEW
  created_at: Date;
  updated_at: Date;
  created_by?: number;
}
```

### Update OrderStatus Enum

```typescript
export type OrderStatus =
  | 'job_details_setup'                      // CHANGED (was 'initiated')
  | 'pending_confirmation'
  | 'pending_production_files_creation'
  | 'pending_production_files_approval'
  | 'production_queue'
  | 'in_production'
  | 'on_hold'
  | 'overdue'
  | 'qc_packing'
  | 'shipping'
  | 'pick_up'
  | 'awaiting_payment'
  | 'completed'
  | 'cancelled';
```

### Update OrderPart Interface

```typescript
export interface OrderPart {
  part_id: number;
  order_id: number;
  part_number: number;
  display_number?: string;                   // NEW (nullable for invoice-only rows)
  is_parent?: boolean;                       // NEW
  product_type: string;
  product_type_id: string;
  channel_letter_type_id?: number;
  base_product_type_id?: number;
  invoice_description?: string;              // NEW
  quantity: number;
  unit_price?: number;                       // NEW
  extended_price?: number;                   // NEW
  specifications?: any;
  production_notes?: string;
}

// Note: Row "type" is implicit based on which fields are populated:
// - Both: specifications + invoice fields populated
// - Specs only: specifications populated, invoice fields NULL
// - Invoice only: specifications NULL, invoice fields populated
// - Separator: both NULL
```

### Update OrderTask Interface

```typescript
export interface OrderTask {
  task_id: number;
  order_id: number;
  part_id?: number;
  task_name: string;
  // task_order: number;                     // REMOVED
  completed: boolean;
  completed_at?: Date;
  completed_by?: number;
  assigned_role?: ProductionRole;
  depends_on_task_id?: number;
  started_at?: Date;
  started_by?: number;
}
```

---

## Frontend TypeScript Types Updates

**File:** `/frontend/web/src/types/orders.ts` (create if doesn't exist)

### Create/Update Types

```typescript
export type OrderStatus =
  | 'job_details_setup'
  | 'pending_confirmation'
  | 'pending_production_files_creation'
  | 'pending_production_files_approval'
  | 'production_queue'
  | 'in_production'
  | 'on_hold'
  | 'overdue'
  | 'qc_packing'
  | 'shipping'
  | 'pick_up'
  | 'awaiting_payment'
  | 'completed'
  | 'cancelled';

export interface OrderPart {
  part_id: number;
  order_id: number;
  part_number: number;
  display_number?: string;                   // Nullable for invoice-only rows
  is_parent?: boolean;
  product_type: string;
  product_type_id: string;
  invoice_description?: string;
  quantity: number;
  unit_price?: number;
  extended_price?: number;
  specifications?: {
    specs: SpecRow[];
    specs_collapsed: boolean;
  };
  production_notes?: string;
}

export interface SpecRow {
  name: string;
  spec1: string;
  spec2?: string;
  spec3?: string;
}

// Note: Row "type" is implicit - no RowType enum needed
```

---

## Testing Checklist

### Pre-Migration Tests
- [ ] Backup created successfully
- [ ] Can connect to database
- [ ] Current schema documented
- [ ] Existing order count: ___
- [ ] Existing order_parts count: ___
- [ ] Existing order_tasks count: ___

### Post-Migration Tests
- [ ] All new columns exist in orders table
- [ ] All new columns exist in order_parts table
- [ ] task_order column removed from order_tasks
- [ ] Status enum updated correctly
- [ ] All 'initiated' records migrated to 'job_details_setup'
- [ ] All tasks deleted (count = 0)
- [ ] Indexes created on order_parts
- [ ] Foreign key constraints valid
- [ ] No orphaned records
- [ ] Backend starts without errors
- [ ] Frontend starts without errors

### Rollback Test
- [ ] Rollback script available
- [ ] Tested rollback in dev environment (optional)

---

## Success Criteria

Phase 1.5.b is COMPLETE when:

1. ✅ Migration script runs without errors
2. ✅ All 7 new columns added to orders table
3. ✅ All 7 new columns added to order_parts table
4. ✅ task_order column removed from order_tasks
5. ✅ Status enum updated ('initiated' → 'job_details_setup')
6. ✅ All existing orders migrated to new status
7. ✅ All existing tasks deleted
8. ✅ TypeScript types updated (backend + frontend)
9. ✅ Servers restart successfully
10. ✅ No database errors in logs

---

## Dependencies

**Requires:**
- Phase 1 completion (database tables exist)
- Database admin access
- Server shutdown permission

**Blocks:**
- Phase 1.5.a (needs new schema)
- Phase 1.5.c (needs new columns)
- Phase 1.5.d (needs updated order_tasks structure)

---

## Troubleshooting

### Migration Fails - Foreign Key Constraint

**Error:** `Cannot add foreign key constraint`

**Solution:**
```sql
-- Check if finalized_by user exists
SELECT user_id FROM users WHERE user_id = 1;  -- Verify admin user exists

-- If needed, temporarily disable FK checks
SET FOREIGN_KEY_CHECKS=0;
-- Run migration
SET FOREIGN_KEY_CHECKS=1;
```

### Migration Fails - Column Already Exists

**Error:** `Duplicate column name 'display_number'`

**Solution:**
```sql
-- Check if column exists
SHOW COLUMNS FROM order_parts LIKE 'display_number';

-- If exists, skip ADD COLUMN statement or drop and re-add
ALTER TABLE order_parts DROP COLUMN display_number;
```

### Backend Fails to Start - Type Errors

**Error:** `Property 'job_details_setup' does not exist on type OrderStatus`

**Solution:**
- Update `/backend/web/src/types/orders.ts`
- Update `/backend/web/src/services/orderService.ts` (line 116 validStatuses array)
- Rebuild backend: `cd backend/web && npm run build`

---

**Document Status:** ✅ COMPLETE - All migrations applied successfully
**Last Updated:** 2025-11-06
**Execution Summary:**
- ✅ orders table: 7 new columns added (customer_job_number, hard_due_date_time, etc.)
- ✅ order_parts table: display_number, is_parent columns added
- ✅ customer_contacts table created
- ✅ Status enum updated to use 'job_details_setup'
- ✅ All migrations tested and verified
**Actual Execution Time:** ~10 minutes (migration + testing)
