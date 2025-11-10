# Orders System - Database Schema

**Last Updated:** 2025-11-06
**Schema Version:** Phase 1 + Phase 1.5.b Complete
**Status:** ✅ IMPLEMENTED AND VERIFIED

## Purpose
Define the complete database structure for the Orders system, including tables, relationships, indexes, and constraints. This document reflects the **actual implemented schema** as of Phase 1.5.b.

---

## Schema Overview

### ✅ Implemented Tables (Phase 1 + 1.5)
1. **orders** - Master order records (25 columns)
2. **order_parts** - Parts/components of each order (15 columns)
3. **order_tasks** - Role-based tasks for production (11 columns)
4. **order_status_history** - Audit trail for status changes
5. **order_form_versions** - PDF form version tracking
6. **customer_contacts** - Customer contact management (Phase 1.5)

### ❌ NOT Implemented (Phase 2+ or Future)
- **invoices**, **invoice_line_items**, **invoice_payments** - Invoice system (Phase 2)
- **order_timeline** - Comprehensive communications log (Future - using order_status_history for now)
- **order_files** - Design file tracking (Future - files stored in SMB mount)
- **order_part_subitems** - Sub-items like vinyl, painting (Future)
- **material_breakdown**, **material_requirements** - Materials planning (Phase 4+)
- **product_templates**, **task_templates** - Database-driven templates (Phase 3 - currently hard-coded)

---

## Table Definitions

### 1. orders

Master table for order records. Sequential numbering starting at 200000.

**Purpose:** Stores all order metadata, workflow status, dates, delivery information, and references to customer and estimate data.

```sql
CREATE TABLE orders (
  -- === PRIMARY KEY ===
  order_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- === IDENTIFIERS ===
  order_number INT UNSIGNED UNIQUE NOT NULL COMMENT 'Sequential starting at 200000',
  version_number INT DEFAULT 1 COMMENT 'Order version for tracking changes',
  order_name VARCHAR(255) NOT NULL COMMENT 'Customer project name',

  -- === ESTIMATE LINK ===
  estimate_id INT UNSIGNED COMMENT 'Link to source estimate',

  -- === CUSTOMER REFERENCES ===
  customer_id INT UNSIGNED NOT NULL COMMENT 'FK to customers table',
  customer_po VARCHAR(100) COMMENT 'Customer PO number',
  customer_job_number VARCHAR(100) COMMENT 'Customer internal job reference (Phase 1.5)',
  point_person_email VARCHAR(255) COMMENT 'Primary contact email',

  -- === DATES ===
  order_date DATE NOT NULL COMMENT 'Order creation date',
  due_date DATE COMMENT 'Target completion date',
  hard_due_date_time DATETIME COMMENT 'Hard deadline with time component (Phase 1.5)',

  -- === NOTES ===
  production_notes TEXT COMMENT 'Production instructions',
  manufacturing_note TEXT COMMENT 'Manufacturing-specific notes (Phase 1.5)',
  internal_note TEXT COMMENT 'Internal notes not visible on forms (Phase 1.5)',

  -- === FINALIZATION (Phase 1.5) ===
  finalized_at TIMESTAMP NULL COMMENT 'When order was finalized',
  finalized_by INT UNSIGNED COMMENT 'User who finalized order',
  modified_after_finalization BOOLEAN DEFAULT false COMMENT 'Flag if modified post-finalization',

  -- === FILES ===
  sign_image_path VARCHAR(500) COMMENT 'Path to sign preview image',
  form_version TINYINT UNSIGNED DEFAULT 1 COMMENT 'Current PDF form version',

  -- === DELIVERY ===
  shipping_required BOOLEAN DEFAULT false COMMENT 'Whether order requires shipping',

  -- === WORKFLOW STATUS ===
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
  ) DEFAULT 'job_details_setup' COMMENT 'Current order status',

  -- === AUDIT ===
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED COMMENT 'User who created order',

  -- === FOREIGN KEYS ===
  FOREIGN KEY (estimate_id) REFERENCES estimates(estimate_id) ON DELETE SET NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
  FOREIGN KEY (finalized_by) REFERENCES users(user_id) ON DELETE SET NULL,

  -- === INDEXES ===
  INDEX idx_order_number (order_number),
  INDEX idx_customer (customer_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Set AUTO_INCREMENT to start at 200000
ALTER TABLE orders AUTO_INCREMENT = 200000;
```

**Key Design Decisions:**
- **Order numbering:** Sequential starting at 200000 for easy distinction from estimate numbers
- **Status enum:** First status is 'job_details_setup' (renamed from 'initiated' in Phase 1.5)
- **Finalization tracking:** Fields added in Phase 1.5 to support order finalization workflow
- **Dual note types:** production_notes (visible on forms), manufacturing_note, internal_note (Phase 1.5)
- **Hard deadline:** Optional hard_due_date_time with time component for rush orders (Phase 1.5)

---

### 2. order_parts

Parts/components of each order. Maps to estimate line items.

**Purpose:** Represents individual products/jobs within an order, supporting parent-child hierarchy.

```sql
CREATE TABLE order_parts (
  -- === PRIMARY KEY ===
  part_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- === ORDER REFERENCE ===
  order_id INT UNSIGNED NOT NULL,

  -- === NUMBERING ===
  part_number TINYINT UNSIGNED NOT NULL COMMENT 'Sequential part number (1, 2, 3...)',
  display_number VARCHAR(10) COMMENT 'Display number with hierarchy (1, 1a, 1b) - Phase 1.5',
  is_parent BOOLEAN DEFAULT false COMMENT 'Whether this is a parent row with children - Phase 1.5',

  -- === PRODUCT TYPE (Dual-Field Approach) ===
  product_type VARCHAR(100) NOT NULL COMMENT 'Human-readable: "Channel Letter - 3\" Front Lit"',
  product_type_id VARCHAR(100) NOT NULL COMMENT 'Machine-readable: "channel_letters_3_front_lit"',

  -- === PRODUCT TYPE REFERENCES (one should be populated) ===
  channel_letter_type_id INT UNSIGNED COMMENT 'FK to channel_letter_types if applicable',
  base_product_type_id INT UNSIGNED COMMENT 'FK to product_types if not channel letter',

  -- === SPECIFICATIONS ===
  quantity DECIMAL(10,2) NOT NULL COMMENT 'Quantity of this product',
  specifications JSON COMMENT 'Dynamic specs based on product type',

  -- === INVOICE FIELDS ===
  invoice_description TEXT COMMENT 'Description for invoice line item',
  unit_price DECIMAL(10,2) COMMENT 'Price per unit',
  extended_price DECIMAL(10,2) COMMENT 'Total price (quantity * unit_price)',

  -- === NOTES ===
  production_notes TEXT COMMENT 'Part-specific production notes',

  -- === FOREIGN KEYS ===
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (channel_letter_type_id) REFERENCES channel_letter_types(type_id) ON DELETE SET NULL,
  FOREIGN KEY (base_product_type_id) REFERENCES product_types(product_type_id) ON DELETE SET NULL,

  -- === INDEXES ===
  INDEX idx_order (order_id),
  INDEX idx_product_type (product_type_id),
  INDEX idx_display_number (display_number),
  INDEX idx_is_parent (is_parent)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Key Design Decisions:**
- **Dual-field product type:** Both human-readable and machine-readable for flexibility
- **Hierarchy support:** display_number and is_parent enable parent-child relationships (Phase 1.5)
- **One FK populated:** Either channel_letter_type_id OR base_product_type_id, not both
- **Invoice fields:** Support for pricing and invoice line item descriptions
- **Cascade delete:** When order is deleted, all parts are automatically deleted

---

### 3. order_tasks

Role-based production tasks for each order part.

**Purpose:** Tracks production tasks that must be completed, organized by role and supporting dependencies.

```sql
CREATE TABLE order_tasks (
  -- === PRIMARY KEY ===
  task_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- === REFERENCES ===
  order_id INT UNSIGNED NOT NULL COMMENT 'Order this task belongs to',
  part_id INT UNSIGNED COMMENT 'Part this task is for (NULL = order-level task)',

  -- === TASK DETAILS ===
  task_name VARCHAR(255) NOT NULL COMMENT 'Task description',

  -- === COMPLETION TRACKING ===
  completed BOOLEAN DEFAULT false COMMENT 'Whether task is complete',
  completed_at TIMESTAMP NULL COMMENT 'When task was completed',
  completed_by INT UNSIGNED COMMENT 'User who completed task',

  -- === ASSIGNMENT ===
  assigned_role ENUM(
    'designer',
    'vinyl_cnc',
    'painting',
    'cut_bend',
    'leds',
    'packing'
  ) COMMENT 'Production role assigned to this task',

  -- === DEPENDENCIES ===
  depends_on_task_id INT UNSIGNED COMMENT 'Task that must complete first',

  -- === START TRACKING ===
  started_at TIMESTAMP NULL COMMENT 'When task was started',
  started_by INT UNSIGNED COMMENT 'User who started task',

  -- === FOREIGN KEYS ===
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (part_id) REFERENCES order_parts(part_id) ON DELETE CASCADE,
  FOREIGN KEY (completed_by) REFERENCES users(user_id) ON DELETE SET NULL,
  FOREIGN KEY (depends_on_task_id) REFERENCES order_tasks(task_id) ON DELETE SET NULL,
  FOREIGN KEY (started_by) REFERENCES users(user_id) ON DELETE SET NULL,

  -- === INDEXES ===
  INDEX idx_order (order_id),
  INDEX idx_part (part_id),
  INDEX idx_completed (completed),
  INDEX idx_assigned_role (assigned_role),
  INDEX idx_depends_on (depends_on_task_id),
  INDEX idx_started_at (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Key Design Decisions:**
- **Role-based assignment:** Tasks assigned to production roles, not specific users (Phase 1)
- **Task dependencies:** supports sequential task workflows via depends_on_task_id
- **Part-level tasks:** Most tasks linked to specific parts (part_id), some order-level
- **Start/complete tracking:** Full audit trail of who started and completed tasks
- **Phase 1 implementation:** Tasks auto-generated from hard-coded templates in code

---

### 4. order_status_history

Audit trail for order status changes.

**Purpose:** Maintains complete history of all status changes for compliance and tracking.

```sql
CREATE TABLE order_status_history (
  -- === PRIMARY KEY ===
  history_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- === REFERENCE ===
  order_id INT UNSIGNED NOT NULL,

  -- === STATUS CHANGE ===
  status VARCHAR(50) NOT NULL COMMENT 'New status value',

  -- === AUDIT ===
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When status changed',
  changed_by INT UNSIGNED COMMENT 'User who changed status',
  notes TEXT COMMENT 'Optional notes about status change',

  -- === FOREIGN KEYS ===
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(user_id) ON DELETE SET NULL,

  -- === INDEXES ===
  INDEX idx_order (order_id),
  INDEX idx_changed_at (changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Key Design Decisions:**
- **Immutable history:** Records are never updated or deleted (except with order CASCADE)
- **Full audit trail:** Tracks who, when, and why for all status changes
- **Timeline display:** Used to show order history timeline in UI

---

### 5. order_form_versions

Tracks PDF form versions for each order.

**Purpose:** Maintains version history of generated PDF order forms with file paths.

```sql
CREATE TABLE order_form_versions (
  -- === PRIMARY KEY ===
  version_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- === REFERENCE ===
  order_id INT UNSIGNED NOT NULL,
  version_number TINYINT UNSIGNED NOT NULL COMMENT 'Sequential version (1, 2, 3...)',

  -- === FILE PATHS (stored on SMB mount) ===
  master_form_path VARCHAR(500) COMMENT 'Path to master order form PDF',
  shop_form_path VARCHAR(500) COMMENT 'Path to shop floor form PDF',
  customer_form_path VARCHAR(500) COMMENT 'Path to customer confirmation PDF',
  packing_list_path VARCHAR(500) COMMENT 'Path to packing list PDF',

  -- === AUDIT ===
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED COMMENT 'User who generated forms',

  -- === FOREIGN KEYS ===
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,

  -- === CONSTRAINTS ===
  UNIQUE KEY unique_version (order_id, version_number),

  -- === INDEXES ===
  INDEX idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Key Design Decisions:**
- **Version tracking:** Each regeneration creates new version, old versions archived
- **Four PDF types:** Master, Shop, Customer, Packing List forms
- **File storage:** Paths point to files on SMB mount at `/mnt/channelletter/NexusTesting/`
- **Archive structure:** Previous versions stored in `archive/v{N}/` subdirectories

---

### 6. customer_contacts (Phase 1.5)

Customer contact management for point person emails and contact information.

**Purpose:** Stores multiple contacts per customer for flexible communication management.

```sql
CREATE TABLE customer_contacts (
  -- === PRIMARY KEY ===
  contact_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- === CUSTOMER REFERENCE ===
  customer_id INT UNSIGNED NOT NULL,

  -- === CONTACT INFORMATION ===
  contact_name VARCHAR(255) NOT NULL COMMENT 'Contact full name',
  contact_email VARCHAR(255) NOT NULL COMMENT 'Contact email address',
  contact_phone VARCHAR(50) COMMENT 'Contact phone number',
  contact_role VARCHAR(100) COMMENT 'Contact role/title',

  -- === STATUS ===
  is_active BOOLEAN DEFAULT true COMMENT 'Whether contact is active',
  notes TEXT COMMENT 'Additional notes about contact',

  -- === AUDIT ===
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED COMMENT 'User who created contact',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED COMMENT 'User who last updated contact',

  -- === FOREIGN KEYS ===
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL,

  -- === INDEXES ===
  INDEX idx_customer (customer_id),
  INDEX idx_email (contact_email),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Key Design Decisions:**
- **Multiple contacts:** Support multiple contacts per customer
- **Duplicate emails allowed:** Same email can exist for different contacts
- **Active flag:** Soft delete via is_active flag
- **Used in ApproveEstimateModal:** Dropdown shows DISTINCT emails for point person selection

---

## Relationships Diagram

```
customers (1) ──────────< (M) orders
                            │
                            ├─────< (M) order_parts
                            │         │
                            │         └─────< (M) order_tasks
                            │
                            ├─────< (M) order_status_history
                            │
                            └─────< (M) order_form_versions

customers (1) ──────────< (M) customer_contacts

estimates (1) ──────────< (M) orders (optional link)

users (1) ──────────< (M) orders (created_by, finalized_by)
users (1) ──────────< (M) order_tasks (completed_by, started_by)
users (1) ──────────< (M) order_status_history (changed_by)
users (1) ──────────< (M) order_form_versions (created_by)
users (1) ──────────< (M) customer_contacts (created_by, updated_by)

order_tasks (1) ──────────< (M) order_tasks (depends_on_task_id - self-referential)
```

---

## Cascade Behavior

### ON DELETE CASCADE
When an order is deleted, the following are automatically deleted:
- All `order_parts` for that order
- All `order_tasks` for that order (via order_id AND via part_id)
- All `order_status_history` records
- All `order_form_versions` records

When a customer is deleted:
- All `customer_contacts` are deleted

### ON DELETE SET NULL
- `orders.estimate_id` → NULL if estimate is deleted
- `orders.created_by` → NULL if user is deleted
- `orders.finalized_by` → NULL if user is deleted
- `order_parts.channel_letter_type_id` → NULL if type is deleted
- `order_parts.base_product_type_id` → NULL if type is deleted
- `order_tasks.completed_by` → NULL if user is deleted
- `order_tasks.depends_on_task_id` → NULL if dependency task is deleted

### ON DELETE RESTRICT
- `orders.customer_id` → RESTRICT (cannot delete customer with orders)

---

## Index Strategy

### Primary Indexes
All tables have AUTO_INCREMENT primary keys for optimal performance.

### Foreign Key Indexes
All foreign key columns are indexed for efficient joins and cascade operations.

### Query Optimization Indexes

**orders table:**
- `idx_order_number` - Unique constraint + fast lookups
- `idx_customer` - Customer order filtering
- `idx_status` - Status-based filtering (dashboard, reports)
- `idx_created_at` - Date range queries, recent orders

**order_parts table:**
- `idx_order` - Join with orders
- `idx_product_type` - Product type filtering
- `idx_display_number` - Display order sorting (Phase 1.5)
- `idx_is_parent` - Parent row filtering (Phase 1.5)

**order_tasks table:**
- `idx_order` - Order tasks lookup
- `idx_part` - Part tasks lookup
- `idx_completed` - Filter by completion status
- `idx_assigned_role` - Role-based task filtering
- `idx_depends_on` - Dependency resolution
- `idx_started_at` - Active task filtering

**order_status_history table:**
- `idx_order` - Order history timeline
- `idx_changed_at` - Chronological queries

**customer_contacts table:**
- `idx_customer` - Customer contacts lookup
- `idx_email` - Email-based searches
- `idx_active` - Active contacts filtering

---

## Performance Considerations

### Expected Data Volumes (Year 1)
- **Orders:** ~500-1,000 per year
- **Order Parts:** ~1,000-2,000 per year (avg 2 parts/order)
- **Order Tasks:** ~10,000-20,000 per year (avg 10-20 tasks/order)
- **Status History:** ~5,000-10,000 per year (avg 5-10 status changes/order)
- **Form Versions:** ~500-1,000 per year (most orders = 1 version)
- **Customer Contacts:** ~2,000-3,000 total (avg 3-5 per customer)

### Query Performance Targets
- Order list (dashboard): < 500ms for 50 orders
- Order details: < 400ms
- Task list: < 300ms for 100 tasks
- Status history: < 200ms for 50 events
- Form generation: < 3 seconds for all 4 PDFs

### Optimization Strategies
1. **Denormalization avoided:** Keep normalized for data integrity
2. **Calculated fields:** None in Phase 1 (calculated on-demand)
3. **Pagination:** All list queries use LIMIT/OFFSET
4. **Index coverage:** All foreign keys and filter columns indexed
5. **Monitoring:** Slow query log enabled for queries > 1 second

---

## Migration History

### Phase 1.a (2025-11-03)
- Created core 5 tables: orders, order_parts, order_tasks, order_form_versions, order_status_history
- Added production_roles JSON column to users table
- Set order numbering to start at 200000

### Phase 1.5.b (2025-11-06)
- Added to orders: customer_job_number, hard_due_date_time, manufacturing_note, internal_note, finalized_at, finalized_by, modified_after_finalization
- Added to order_parts: display_number, is_parent
- Created customer_contacts table
- Updated status enum: 'initiated' → 'job_details_setup'

---

## Future Schema Changes (Phase 2+)

### Phase 2: Invoice System
```sql
CREATE TABLE invoices (
  invoice_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  quickbooks_invoice_id VARCHAR(100),
  invoice_number VARCHAR(50),
  status ENUM('draft', 'sent', 'partially_paid', 'paid') DEFAULT 'draft',
  total_amount DECIMAL(10,2),
  -- ... additional fields
);

CREATE TABLE invoice_line_items (
  line_item_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT UNSIGNED NOT NULL,
  part_id INT UNSIGNED,
  description TEXT,
  quantity DECIMAL(10,2),
  unit_price DECIMAL(10,2),
  total_price DECIMAL(10,2),
  -- ... additional fields
);

CREATE TABLE invoice_payments (
  payment_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT UNSIGNED NOT NULL,
  payment_date DATE,
  amount DECIMAL(10,2),
  payment_method VARCHAR(50),
  -- ... additional fields
);
```

### Phase 3: Database-Driven Templates
```sql
CREATE TABLE product_templates (
  template_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_type_id VARCHAR(100) NOT NULL,
  task_generation_rules JSON,
  -- ... additional fields
);

CREATE TABLE task_templates (
  task_template_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  task_name VARCHAR(255),
  assigned_role ENUM(...),
  default_dependencies JSON,
  -- ... additional fields
);
```

### Phase 4+: Materials Planning
```sql
CREATE TABLE material_breakdown (
  breakdown_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  part_id INT UNSIGNED,
  calculated_at TIMESTAMP,
  -- ... additional fields
);

CREATE TABLE material_requirements (
  requirement_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  breakdown_id INT UNSIGNED NOT NULL,
  material_type VARCHAR(100),
  quantity DECIMAL(10,2),
  unit VARCHAR(20),
  -- ... additional fields
);
```

---

## Validation & Testing

### Schema Verification Queries

**Check all order tables exist:**
```sql
SHOW TABLES LIKE 'order%';
-- Expected: order_form_versions, order_parts, order_status_history, order_tasks, orders
```

**Verify orders table structure:**
```sql
DESCRIBE orders;
-- Should show 25 columns including Phase 1.5 additions
```

**Check foreign key constraints:**
```sql
SELECT
  TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME,
  REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'sign_manufacturing'
  AND TABLE_NAME LIKE 'order%'
  AND REFERENCED_TABLE_NAME IS NOT NULL;
```

**Verify order numbering:**
```sql
SELECT AUTO_INCREMENT
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'sign_manufacturing'
  AND TABLE_NAME = 'orders';
-- Should be 200000 or higher
```

**Check customer_contacts table:**
```sql
DESCRIBE customer_contacts;
-- Should show 12 columns
```

---

## Related Documentation

- **Phase 1.a:** `Nexus_Orders_Phase1a_DatabaseFoundation.md` - Initial schema creation
- **Phase 1.5.b:** `Nexus_Orders_Phase1.5b_DatabaseSchema.md` - Schema updates
- **Phase 1 Summary:** `Nexus_Orders_Phase1_SUMMARY.md` - Implementation overview
- **Overview:** `Nexus_OrdersPage_Overview.md` - System architecture

---

**Document Status:** ✅ CURRENT - Reflects actual implemented schema
**Schema Version:** Phase 1 + Phase 1.5.b
**Last Verified:** 2025-11-06 via DESCRIBE commands
**Next Update:** Phase 2 (Invoice system schema additions)
