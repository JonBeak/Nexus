# Phase 1.a: Database Foundation - Orders System

## Overview

This sub-phase establishes the complete database infrastructure for the Orders system. All tables, indexes, constraints, and modifications to existing tables are implemented here.

**Duration Estimate:** 2-3 days
**Dependencies:** None (first step)
**Validates:** Complete database schema ready for backend implementation

---

## Tables to Create

### 1. orders
Core table for order records. Sequential numbering starting at 200000.

**Key Fields:**
- `order_id` (PK, AUTO_INCREMENT)
- `order_number` (UNIQUE, starting at 200000)
- `version_number` (for tracking form changes)
- `order_name` (customer project name)
- `estimate_id` (FK to job_estimates)
- `customer_id` (FK to customers)
- `customer_po` (customer PO number)
- `point_person_email` (contact email)
- `order_date`, `due_date`
- `status` (ENUM with 14 values - see Phase1_Implementation.md line 72-86)
- `production_notes` (TEXT)
- `sign_image_path` (VARCHAR 500)
- `form_version` (INT, default 1)
- `shipping_required` (BOOLEAN)

**Phase 1.5.b Additions:**
- `customer_job_number` (VARCHAR 100) - Customer's internal job reference
- `hard_due_date_time` (DATETIME) - Hard deadline with time component
- `manufacturing_note` (TEXT) - Manufacturing-specific notes
- `internal_note` (TEXT) - Internal notes not visible on forms
- `finalized_at` (TIMESTAMP NULL) - When order was finalized
- `finalized_by` (FK to users) - Who finalized the order
- `modified_after_finalization` (BOOLEAN) - Flag if modified post-finalization

**Foreign Keys:**
- `estimate_id` → `job_estimates(id)` ON DELETE SET NULL
- `customer_id` → `customers(customer_id)` ON DELETE RESTRICT
- `created_by` → `users(user_id)` ON DELETE SET NULL

**Indexes:**
- `idx_order_number` on `order_number`
- `idx_customer` on `customer_id`
- `idx_status` on `status`
- `idx_created_at` on `created_at`

---

### 2. order_parts
Parts/components of each order. Maps to estimate items.

**Key Fields:**
- `part_id` (PK, AUTO_INCREMENT)
- `order_id` (FK to orders)
- `part_number` (sequencing: 1, 2, 3...)
- `display_number` (VARCHAR 10) - Display number like "1", "1a", "1b" for hierarchy
- `is_parent` (BOOLEAN, default FALSE) - Whether this is a parent row with children
- `product_type` (VARCHAR 100) - Human-readable: "Channel Letter - 3\" Front Lit"
- `product_type_id` (VARCHAR 100) - Machine-readable: "channel_letters_3_front_lit"
- `channel_letter_type_id` (FK to channel_letter_types, nullable)
- `base_product_type_id` (FK to product_types, nullable)
- `quantity` (DECIMAL 10,2)
- `specifications` (JSON) - Dynamic specs based on product type
- `production_notes` (TEXT)

**Dual-Field Approach:** Both `product_type` and `product_type_id` are populated for each part. One of `channel_letter_type_id` OR `base_product_type_id` should be populated depending on whether it's a channel letter or other product.

**Foreign Keys:**
- `order_id` → `orders(order_id)` ON DELETE CASCADE
- `channel_letter_type_id` → `channel_letter_types(id)` ON DELETE SET NULL
- `base_product_type_id` → `product_types(id)` ON DELETE SET NULL

**Indexes:**
- `idx_order` on `order_id`
- `idx_product_type` on `product_type_id`

---

### 3. order_tasks
Role-based tasks for production tracking.

**Key Fields:**
- `task_id` (PK, AUTO_INCREMENT)
- `order_id` (FK to orders)
- `part_id` (FK to order_parts, nullable for order-level tasks)
- `task_name` (VARCHAR 255)
- `task_order` (TINYINT UNSIGNED) - sequencing
- `completed` (BOOLEAN, default FALSE)
- `completed_at` (TIMESTAMP NULL)
- `completed_by` (FK to users)

**Foreign Keys:**
- `order_id` → `orders(order_id)` ON DELETE CASCADE
- `part_id` → `order_parts(part_id)` ON DELETE CASCADE
- `completed_by` → `users(user_id)` ON DELETE SET NULL

**Indexes:**
- `idx_order` on `order_id`
- `idx_part` on `part_id`
- `idx_completed` on `completed`

---

### 4. order_form_versions
Tracks PDF form versions for each order.

**Key Fields:**
- `version_id` (PK, AUTO_INCREMENT)
- `order_id` (FK to orders)
- `version_number` (TINYINT UNSIGNED)
- `master_form_path` (VARCHAR 500)
- `shop_form_path` (VARCHAR 500)
- `customer_form_path` (VARCHAR 500)
- `packing_list_path` (VARCHAR 500)
- `created_at` (TIMESTAMP)
- `created_by` (FK to users)

**Unique Constraint:** `(order_id, version_number)` must be unique

**Foreign Keys:**
- `order_id` → `orders(order_id)` ON DELETE CASCADE
- `created_by` → `users(user_id)` ON DELETE SET NULL

---

### 5. order_status_history
Audit trail for status changes.

**Key Fields:**
- `history_id` (PK, AUTO_INCREMENT)
- `order_id` (FK to orders)
- `status` (VARCHAR 50)
- `changed_at` (TIMESTAMP, default CURRENT_TIMESTAMP)
- `changed_by` (FK to users)
- `notes` (TEXT, nullable)

**Foreign Keys:**
- `order_id` → `orders(order_id)` ON DELETE CASCADE
- `changed_by` → `users(user_id)` ON DELETE SET NULL

**Indexes:**
- `idx_order` on `order_id`
- `idx_changed_at` on `changed_at`

---

### 6. customer_contacts (Phase 1.5)
Customer contact management for point person emails.

**Key Fields:**
- `contact_id` (PK, AUTO_INCREMENT)
- `customer_id` (FK to customers)
- `contact_name` (VARCHAR 255)
- `contact_email` (VARCHAR 255)
- `contact_phone` (VARCHAR 50, nullable)
- `contact_role` (VARCHAR 100, nullable)
- `is_active` (BOOLEAN, default TRUE)
- `notes` (TEXT, nullable)
- `created_at`, `updated_at` (TIMESTAMP)
- `created_by`, `updated_by` (FK to users)

**Foreign Keys:**
- `customer_id` → `customers(customer_id)` ON DELETE CASCADE
- `created_by` → `users(user_id)` ON DELETE SET NULL
- `updated_by` → `users(user_id)` ON DELETE SET NULL

**Indexes:**
- `idx_customer` on `customer_id`
- `idx_email` on `contact_email`
- `idx_active` on `is_active`

---

## Existing Table Modifications

### users Table
Add production_roles JSON column to track which production roles each user can perform.

```sql
ALTER TABLE users
ADD COLUMN production_roles JSON
COMMENT 'Array of production roles: ["designer", "vinyl_cnc", "painting", "cut_bend", "leds", "packing"]';
```

**Example Data:**
```json
{"roles": ["designer"]}
{"roles": ["vinyl_cnc", "cut_bend", "painting"]}
{"roles": ["designer", "vinyl_cnc", "leds", "packing"]}
```

**Phase 1 Note:** Field is populated but NOT enforced for task filtering. All designers can see all orders. Phase 4+ may add designer assignment and role-based filtering.

---

## Migration File Structure

Create migration file: `/home/jon/Nexus/database/migrations/2025-11-03-orders-system-phase1.sql`

```sql
-- Migration: Orders System - Phase 1 Database Foundation
-- Version: 1.0.0
-- Date: 2025-11-03
-- Description: Creates all tables for Orders system Phase 1

START TRANSACTION;

-- =============================================
-- 1. CREATE ORDERS TABLE
-- =============================================

CREATE TABLE orders (
  order_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_number INT UNSIGNED NOT NULL UNIQUE COMMENT 'Sequential starting at 200000',
  version_number INT DEFAULT 1 COMMENT 'Order version for tracking major changes',
  order_name VARCHAR(255) NOT NULL,
  estimate_id INT UNSIGNED,
  customer_id INT UNSIGNED NOT NULL,
  customer_po VARCHAR(100),
  point_person_email VARCHAR(255),
  order_date DATE NOT NULL,
  due_date DATE,
  customer_job_number VARCHAR(100) COMMENT 'Customer''s internal job reference',
  hard_due_date_time DATETIME COMMENT 'Hard deadline with time component',
  production_notes TEXT,
  manufacturing_note TEXT COMMENT 'Manufacturing-specific notes',
  internal_note TEXT COMMENT 'Internal notes not visible on forms',
  finalized_at TIMESTAMP NULL COMMENT 'When order was finalized',
  finalized_by INT UNSIGNED COMMENT 'Who finalized the order',
  modified_after_finalization BOOLEAN DEFAULT false COMMENT 'Flag if modified post-finalization',
  sign_image_path VARCHAR(500),
  form_version TINYINT UNSIGNED DEFAULT 1,
  shipping_required BOOLEAN DEFAULT false,
  status ENUM(
    'job_details_setup',
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
  ) DEFAULT 'job_details_setup',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED,
  FOREIGN KEY (estimate_id) REFERENCES job_estimates(id) ON DELETE SET NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_order_number (order_number),
  INDEX idx_customer (customer_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 2. CREATE ORDER_PARTS TABLE
-- =============================================

CREATE TABLE order_parts (
  part_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  part_number TINYINT UNSIGNED NOT NULL,
  display_number VARCHAR(10) COMMENT 'Display number like "1", "1a", "1b"',
  is_parent BOOLEAN DEFAULT false COMMENT 'Parent row indicator',

  -- Dual-field approach for product types
  product_type VARCHAR(100) NOT NULL COMMENT 'Human-readable: "Channel Letter - 3\" Front Lit"',
  product_type_id VARCHAR(100) NOT NULL COMMENT 'Machine-readable: "channel_letters_3_front_lit"',

  -- Source references (one should be populated)
  channel_letter_type_id INT UNSIGNED COMMENT 'FK to channel_letter_types if applicable',
  base_product_type_id INT UNSIGNED COMMENT 'FK to product_types if not channel letter',

  quantity DECIMAL(10,2) NOT NULL,
  specifications JSON,
  production_notes TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (channel_letter_type_id) REFERENCES channel_letter_types(id) ON DELETE SET NULL,
  FOREIGN KEY (base_product_type_id) REFERENCES product_types(id) ON DELETE SET NULL,
  INDEX idx_order (order_id),
  INDEX idx_product_type (product_type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 3. CREATE ORDER_TASKS TABLE
-- =============================================

CREATE TABLE order_tasks (
  task_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  part_id INT UNSIGNED,
  task_name VARCHAR(255) NOT NULL,
  task_order TINYINT UNSIGNED NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP NULL,
  completed_by INT UNSIGNED,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (part_id) REFERENCES order_parts(part_id) ON DELETE CASCADE,
  FOREIGN KEY (completed_by) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_order (order_id),
  INDEX idx_part (part_id),
  INDEX idx_completed (completed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 4. CREATE ORDER_FORM_VERSIONS TABLE
-- =============================================

CREATE TABLE order_form_versions (
  version_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  version_number TINYINT UNSIGNED NOT NULL,
  master_form_path VARCHAR(500),
  shop_form_path VARCHAR(500),
  customer_form_path VARCHAR(500),
  packing_list_path VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
  UNIQUE KEY unique_version (order_id, version_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 5. CREATE ORDER_STATUS_HISTORY TABLE
-- =============================================

CREATE TABLE order_status_history (
  history_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  status VARCHAR(50) NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  changed_by INT UNSIGNED,
  notes TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_order (order_id),
  INDEX idx_changed_at (changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 6. CREATE CUSTOMER_CONTACTS TABLE (Phase 1.5)
-- =============================================

CREATE TABLE customer_contacts (
  contact_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id INT UNSIGNED NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(50),
  contact_role VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_customer (customer_id),
  INDEX idx_email (contact_email),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 7. MODIFY USERS TABLE
-- =============================================

ALTER TABLE users
ADD COLUMN production_roles JSON
COMMENT 'Array of production roles: ["designer", "vinyl_cnc", "painting", "cut_bend", "leds", "packing"]';

COMMIT;
```

---

## Testing Checklist

After running the migration:

- [ ] Verify all tables created successfully
  ```sql
  SHOW TABLES LIKE 'order%';
  ```

- [ ] Verify foreign key constraints
  ```sql
  SELECT
    TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = 'sign_manufacturing'
    AND TABLE_NAME LIKE 'order%'
    AND REFERENCED_TABLE_NAME IS NOT NULL;
  ```

- [ ] Verify indexes created
  ```sql
  SHOW INDEX FROM orders;
  SHOW INDEX FROM order_parts;
  SHOW INDEX FROM order_tasks;
  ```

- [ ] Verify ENUM constraint on orders.status
  ```sql
  SHOW CREATE TABLE orders;
  ```

- [ ] Verify production_roles column added to users
  ```sql
  DESCRIBE users;
  ```

- [ ] Test insert permissions (should work)
  ```sql
  -- This should fail gracefully (no customer_id = 9999)
  INSERT INTO orders (order_number, order_name, customer_id, order_date, created_by)
  VALUES (200000, 'Test Order', 9999, CURDATE(), 1);
  ```

- [ ] Test cascade delete (create test order, delete it, verify parts/tasks deleted)

---

## Rollback Plan

If migration fails or needs to be reversed:

```sql
START TRANSACTION;

-- Drop tables in reverse order (due to foreign keys)
DROP TABLE IF EXISTS customer_contacts;
DROP TABLE IF EXISTS order_status_history;
DROP TABLE IF EXISTS order_form_versions;
DROP TABLE IF EXISTS order_tasks;
DROP TABLE IF EXISTS order_parts;
DROP TABLE IF EXISTS orders;

-- Remove column from users
ALTER TABLE users DROP COLUMN IF EXISTS production_roles;

COMMIT;
```

---

## Initial Order Number Setup

The order numbering system starts at 200000. The first order will be 200000, second will be 200001, etc.

**Implementation Options:**

### Option 1: AUTO_INCREMENT with offset (RECOMMENDED)
```sql
ALTER TABLE orders AUTO_INCREMENT = 200000;
```

### Option 2: Application-level logic
- Query `SELECT MAX(order_number) FROM orders`
- If NULL, use 200000
- Otherwise, use MAX + 1

**Recommendation:** Use Option 1 for simplicity and MySQL native support.

---

## Performance Considerations

### Expected Data Volume (Year 1)
- **Orders:** ~500-1000 per year
- **Order Parts:** ~1000-2000 per year (avg 2 parts/order)
- **Order Tasks:** ~10,000-20,000 per year (avg 10-20 tasks/order)
- **Status History:** ~5,000-10,000 per year (avg 5-10 status changes/order)

### Index Strategy
All critical indexes are included in migration. Additional indexes can be added later if query performance requires.

### Monitoring
After deployment, monitor slow query log for:
- Dashboard queries (ORDER BY, GROUP BY on orders)
- Task list queries (filtered by order_id, part_id, completed status)
- Status history queries (audit trail lookups)

---

## Next Steps

After completing Phase 1.a:

1. ✅ Database schema is ready
2. → Proceed to **Phase 1.b: Backend - Order Conversion & Management**
3. Backend can now implement order CRUD operations
4. Estimate-to-order conversion logic can be built

---

**Sub-Phase Status:** ✅ COMPLETE (2025-11-03, enhanced in Phase 1.5.b 2025-11-06)
**Actual Time:** 2-3 days
**Phase 1.5.b Additions:** customer_contacts table, additional fields in orders and order_parts
**Last Updated:** 2025-11-06
