# Orders Page - Database Schema

## Purpose
Define the complete database structure for the Orders Page system, including tables, relationships, indexes, and migration strategy.

---

## Schema Overview

### Phase 1 Tables
1. **orders** - Master order records
2. **order_parts** - Parts/components of each order
3. **order_tasks** - Role-based tasks for production
4. **order_timeline** - Audit trail and communications
8. **order_files** - Design files, order forms, proofs

### Phase 2+ Tables (NOT in Phase 1)
5. **invoices** - Invoice records
6. **invoice_line_items** - Invoice line items
7. **invoice_payments** - Payment records

### Future Tables
9. **material_breakdown** - Materials requirements
10. **material_requirements** - Individual materials

### Supporting Tables
- **product_templates** - Task generation templates
- **task_templates** - Reusable task definitions
- **quickbooks_mappings** - QB item mappings

---

## Table Definitions

### 1. orders

Main table for order records.

```sql
CREATE TABLE orders (
  -- === IDENTIFIERS ===
  order_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_number INT UNSIGNED UNIQUE NOT NULL COMMENT 'Sequential starting at 200000',
  version_number INT DEFAULT 1 COMMENT 'Order version for tracking major changes',
  order_name VARCHAR(255) NOT NULL COMMENT 'Customer project name',
  estimate_id VARCHAR(50),                         -- FK to estimates table
  linked_estimate_id VARCHAR(50),                  -- Link from Order to Estimate
  job_number VARCHAR(100),                         -- Customer's job reference
  po_number VARCHAR(100),                          -- Customer's PO reference
  customer_po VARCHAR(100) COMMENT 'Customer PO number for forms',

  -- === CUSTOMER ===
  customer_id VARCHAR(50) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,             -- Denormalized for performance
  billing_address_id VARCHAR(50),
  shipping_address_id VARCHAR(50),
  point_person JSON,                               -- Array of point person names
  point_person_email JSON,                         -- Array of point person emails

  -- === WORKFLOW STATUS ===
  kanban_stage VARCHAR(50) NOT NULL DEFAULT 'initiated' COMMENT 'Phase 1: Simple dropdown, Phase 3: Visual board',
  overall_status VARCHAR(20) NOT NULL DEFAULT 'active',
  priority VARCHAR(20) NOT NULL DEFAULT 'normal',  -- 'low', 'normal', 'high', 'urgent'

  -- === DATES ===
  created_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  due_date DATE NOT NULL,
  estimated_start_date DATE,
  actual_start_date DATE,
  completed_date TIMESTAMP,
  last_modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- === USERS ===
  created_by VARCHAR(50) NOT NULL,                -- User ID
  last_modified_by VARCHAR(50),

  -- === PROGRESS ===
  overall_percent INT DEFAULT 0,                  -- Cached calculation
  completed_tasks INT DEFAULT 0,
  total_tasks INT DEFAULT 0,

  -- === INVOICE ===
  invoice_id VARCHAR(50),                         -- FK to invoices table
  invoice_status VARCHAR(20) DEFAULT 'draft',     -- 'draft', 'sent', 'partially_paid', 'paid'
  total_amount DECIMAL(10, 2) DEFAULT 0.00,       -- Taken from invoiceID via QuickBooks API

  -- === DELIVERY ===
  delivery_method VARCHAR(20) DEFAULT 'shipping', -- 'shipping', 'pickup'
  tracking_number VARCHAR(100),
  estimated_shipping_cost DECIMAL(10, 2),         -- From estimate data
  estimated_transit_days INT,                     -- From estimate data
  actual_shipping_cost DECIMAL(10, 2),            -- Set by QC & Packing role or Manager
  actual_transit_days INT,                        -- Set by QC & Packing role or Manager

  -- === FLAGS ===
  is_overdue BOOLEAN GENERATED ALWAYS AS (
    due_date < CURDATE() AND overall_status != 'completed'
  ) STORED,
  has_unresolved_issues BOOLEAN DEFAULT FALSE,

  -- === NOTES & FILES ===
  production_notes TEXT COMMENT 'Custom production notes for whole job',
  sign_image_path VARCHAR(500) COMMENT 'SMB path to uploaded preview image',

  -- === FORM MANAGEMENT ===
  form_version INT DEFAULT 1 COMMENT 'Current form version number',

  -- === SHIPPING ===
  shipping_required BOOLEAN DEFAULT FALSE,

  -- === METADATA ===
  version INT DEFAULT 1,
  tags JSON,                                      -- Array of tags

  -- === INDEXES ===
  INDEX idx_order_number (order_number),
  INDEX idx_customer (customer_id),
  INDEX idx_kanban_stage (kanban_stage, due_date),
  INDEX idx_due_date (due_date),
  INDEX idx_status (overall_status),
  INDEX idx_created_date (created_date),
  INDEX idx_overdue (is_overdue, overall_status),

  -- === FOREIGN KEYS ===
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE RESTRICT,
  FOREIGN KEY (estimate_id) REFERENCES estimates(estimate_id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2. order_parts

Parts/components that make up each order.

```sql
CREATE TABLE order_parts (
  -- === IDENTIFIERS ===
  part_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  part_number INT NOT NULL,                       -- 1, 2, 3... for ordering

  -- === BASIC INFO ===
  title VARCHAR(255) NOT NULL,
  description TEXT,
  quantity INT NOT NULL DEFAULT 1,

  -- === PRODUCT INFORMATION (Dual-field approach) ===
  product_type VARCHAR(100) NOT NULL COMMENT 'Human-readable: "Channel Letter - 3\" Front Lit"',
  product_type_id VARCHAR(100) NOT NULL COMMENT 'Machine-readable: "channel_letters_3_front_lit"',

  -- === SOURCE REFERENCES (One should be populated) ===
  channel_letter_type_id INT UNSIGNED COMMENT 'FK to channel_letter_types if applicable',
  base_product_type_id INT UNSIGNED COMMENT 'FK to product_types if not channel letter',

  -- === SPECIFICATIONS (JSON for flexibility) ===
  specifications JSON NOT NULL COMMENT 'Dynamic specs based on product_type',
  /*
    {
      "productType": "channel_letters",
      "dimensions": { "height": 24, "depth": 4, "unit": "inches" },
      "faceMaterial": "White Acrylic 1/8\"",
      "returnMaterial": "Aluminum",
      "returnColor": "Black",
      "hasLighting": true,
      "lightingType": "LED_modules",
      "requiresVinyl": true,
      "vinylColor": "Red 3M (100-13)",
      // ... etc
    }
  */

  -- === PROGRESS ===
  status VARCHAR(20) DEFAULT 'pending',           -- 'pending', 'in_progress', 'completed', 'on_hold'
  percent_complete INT DEFAULT 0,

  -- === FINANCIAL ===
  subtotal DECIMAL(10, 2) NOT NULL,

  -- === METADATA ===
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,

  -- === INDEXES ===
  INDEX idx_order (order_id, part_number),
  INDEX idx_status (status),
  INDEX idx_product_type (product_type_id),

  -- === FOREIGN KEYS ===
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (channel_letter_type_id) REFERENCES channel_letter_types(type_id) ON DELETE SET NULL,
  FOREIGN KEY (base_product_type_id) REFERENCES product_types(product_type_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 3. order_part_subitems

Sub-items for each part (vinyl, painting, etc.)

```sql
CREATE TABLE order_part_subitems (
  subitem_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  part_id INT UNSIGNED NOT NULL,

  -- === TYPE ===
  type VARCHAR(50) NOT NULL,                      -- 'vinyl', 'painting', 'hardware', etc.
  description TEXT NOT NULL,

  -- === DETAILS ===
  vinyl_product_id VARCHAR(50),                   -- Link to vinyl_inventory
  color_code VARCHAR(50),
  quantity DECIMAL(10, 2),
  unit VARCHAR(20),

  -- === COST ===
  additional_cost DECIMAL(10, 2) DEFAULT 0.00,

  -- === STATUS ===
  is_completed BOOLEAN DEFAULT FALSE,
  completed_date TIMESTAMP,

  -- === INDEXES ===
  INDEX idx_part (part_id),
  INDEX idx_vinyl (vinyl_product_id),

  -- === FOREIGN KEYS ===
  FOREIGN KEY (part_id) REFERENCES order_parts(part_id) ON DELETE CASCADE,
  FOREIGN KEY (vinyl_product_id) REFERENCES vinyl_inventory(vinyl_inventory_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 4. estimate_line_item_links

Maintains connection between estimate and order for traceability.

```sql
CREATE TABLE estimate_line_item_links (
  link_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  estimate_line_item_id INT UNSIGNED NOT NULL,
  order_part_id INT UNSIGNED NOT NULL,

  -- === ORIGINAL DATA (Snapshot) ===
  original_description TEXT,
  original_quantity INT,
  original_price DECIMAL(10, 2),
  original_calculation_data JSON,

  -- === CHANGES ===
  was_modified BOOLEAN DEFAULT FALSE,
  modification_notes TEXT,

  -- === INDEXES ===
  INDEX idx_estimate_line (estimate_line_item_id),
  INDEX idx_part (order_part_id),

  -- === FOREIGN KEYS ===
  FOREIGN KEY (estimate_line_item_id) REFERENCES estimate_line_items(line_item_id) ON DELETE CASCADE,
  FOREIGN KEY (order_part_id) REFERENCES order_parts(part_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 5. order_tasks

Role-based tasks for each part.

```sql
CREATE TABLE order_tasks (
  task_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  part_id INT UNSIGNED NOT NULL,
  order_id INT UNSIGNED NOT NULL,                 -- Denormalized for easy querying

  -- === TASK DEFINITION ===
  role VARCHAR(50) NOT NULL,                     -- 'designer', 'vinyl_cnc', etc.
  task_name VARCHAR(255) NOT NULL,
  description TEXT,

  -- === SEQUENCING ===
  sequence_order INT NOT NULL,
  dependencies JSON,                             -- Array of task IDs

  -- === STATUS ===
  status VARCHAR(20) DEFAULT 'pending',          -- 'pending', 'available', 'in_progress', 'completed', 'blocked'
  is_available BOOLEAN DEFAULT FALSE,            -- Dependencies met?

  -- === TIMING ===
  due_date DATE,                                 -- Calculated suggested due date (from templates)
  estimated_duration INT,                        -- Minutes (for future Gantt predictions)

  -- === COMPLETION TRACKING ===
  started_at TIMESTAMP,                          -- Optional: when user started the task
  completed_at TIMESTAMP,                        -- Required when status='completed' - this is the END time
  actual_duration INT,                           -- Optional: minutes (can be calculated or manually entered)
  completed_by VARCHAR(50),                      -- User ID
  notes TEXT,

  -- === METADATA ===
  is_autogenerated BOOLEAN DEFAULT TRUE,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- === INDEXES ===
  INDEX idx_order (order_id),
  INDEX idx_part (part_id),
  INDEX idx_role_status (role, status, order_id),
  INDEX idx_status_due (status, due_date),
  INDEX idx_available (is_available, role),

  -- === FOREIGN KEYS ===
  FOREIGN KEY (part_id) REFERENCES order_parts(part_id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 6. order_timeline

Audit trail and communication history.

```sql
CREATE TABLE order_timeline (
  timeline_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,

  -- === EVENT ===
  event_type VARCHAR(50) NOT NULL,               -- 'created', 'stage_moved', 'task_completed', etc.
  event_description TEXT NOT NULL,
  event_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- === USER ===
  user_id VARCHAR(50),                           -- NULL if system-generated
  user_name VARCHAR(255),                        -- Denormalized

  -- === METADATA ===
  metadata JSON,                                 -- Additional event data

  -- === INDEXES ===
  INDEX idx_order_date (order_id, event_date),
  INDEX idx_event_type (event_type),

  -- === FOREIGN KEYS ===
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 7. invoices (Phase 2+)

**NOTE: Invoice tables are NOT created in Phase 1. All invoicing is done directly in QuickBooks. These tables are for Phase 2+ when invoice functionality is added to the system.**

Invoice records linked to orders.

```sql
CREATE TABLE invoices (
  invoice_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(20) UNIQUE NOT NULL,    -- "INV-2025-0431"
  order_id INT UNSIGNED NOT NULL UNIQUE,          -- 1:1 with orders

  -- === STATUS ===
  status VARCHAR(20) DEFAULT 'draft',            -- 'draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_date TIMESTAMP,
  due_date DATE,
  paid_date TIMESTAMP,

  -- === CUSTOMER ===
  customer_id VARCHAR(50) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  billing_address JSON,                          -- Snapshot of address
  point_person_email JSON,                       -- Array of point person emails
  accounting_email JSON,                         -- Customer accounting emails
  job_number VARCHAR(100),                       -- Customer's job reference
  po_number VARCHAR(100),                        -- Customer's PO reference

  -- === FINANCIAL ===
  subtotal DECIMAL(10, 2) NOT NULL,
  tax_rate DECIMAL(5, 4) NOT NULL,               -- 0.1300 for 13%
  tax_amount DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  amount_paid DECIMAL(10, 2) DEFAULT 0.00,
  amount_due DECIMAL(10, 2) GENERATED ALWAYS AS (total - amount_paid) STORED,

  -- === TERMS ===
  payment_terms VARCHAR(100) DEFAULT 'On Receipt',  -- Default fallback
  notes TEXT,

  -- === METADATA ===
  version INT DEFAULT 1,
  last_modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_modified_by VARCHAR(50),

  -- === QUICKBOOKS ===
  quickbooks_id VARCHAR(50),
  last_synced_to_qb TIMESTAMP,

  -- === INDEXES ===
  INDEX idx_order (order_id),
  INDEX idx_customer (customer_id),
  INDEX idx_status (status),
  INDEX idx_due_date (due_date),
  INDEX idx_invoice_number (invoice_number),

  -- === FOREIGN KEYS ===
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE RESTRICT,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 8. invoice_line_items (Phase 2+)

**NOTE: Invoice tables are NOT created in Phase 1. All invoicing is done directly in QuickBooks.**

Line items on invoices.

```sql
CREATE TABLE invoice_line_items (
  line_item_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT UNSIGNED NOT NULL,

  -- === ITEM DETAILS ===
  item_name VARCHAR(255) NOT NULL,
  description TEXT,
  quantity DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,

  -- === SOURCE ===
  is_manually_added BOOLEAN DEFAULT FALSE,       -- true if custom line item

  -- === ESTIMATE DATA (for reference) ===
  calculation_display TEXT,                      -- Grayed out column if auto-generated from Estimate

  -- === QUICKBOOKS ===
  qb_item_id VARCHAR(50),
  qb_item_name VARCHAR(255),

  -- === ORDERING ===
  line_order INT NOT NULL,

  -- === INDEXES ===
  INDEX idx_invoice (invoice_id, line_order),
  INDEX idx_source (source_type, source_id),

  -- === FOREIGN KEYS ===
  FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 9. invoice_payments (Phase 2+)

**NOTE: Invoice tables are NOT created in Phase 1. All invoicing and payment tracking is done directly in QuickBooks.**

Payment recording is commented out for Phase 2+ implementation. In Phase 1, payments are tracked externally in QuickBooks only.

```sql
-- COMMENTED OUT FOR FUTURE IMPLEMENTATION
-- CREATE TABLE invoice_payments (
--   id VARCHAR(50) PRIMARY KEY,
--   invoice_id VARCHAR(50) NOT NULL,
--
--   -- === PAYMENT ===
--   amount DECIMAL(10, 2) NOT NULL,
--   payment_date DATE NOT NULL,
--   payment_method VARCHAR(50) NOT NULL,           -- 'cash', 'check', 'credit_card', etc.
--   reference VARCHAR(100),                        -- Check #, transaction ID
--
--   -- === METADATA ===
--   notes TEXT,
--   recorded_by VARCHAR(50) NOT NULL,              -- User ID
--   recorded_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--
--   -- === INDEXES ===
--   INDEX idx_invoice (invoice_id, payment_date),
--
--   -- === FOREIGN KEYS ===
--   FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT,
--   FOREIGN KEY (recorded_by) REFERENCES users(id)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 10. order_files

Design files, order forms, proofs, etc.

```sql
CREATE TABLE order_files (
  file_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,

  -- === FILE INFO ===
  file_type VARCHAR(50) NOT NULL,                -- 'design_file', 'proof', 'order_form', 'packing_list'
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT,                                 -- Bytes
  mime_type VARCHAR(100),

  -- === VERSIONING ===
  version INT DEFAULT 1,
  is_current BOOLEAN DEFAULT TRUE,

  -- === METADATA ===
  uploaded_by VARCHAR(50),
  uploaded_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  description TEXT,

  -- === INDEXES ===
  INDEX idx_order_type (order_id, file_type),
  INDEX idx_current (order_id, file_type, is_current),

  -- === FOREIGN KEYS ===
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 11. product_templates

Templates for auto-generating tasks and materials.

```sql
CREATE TABLE product_templates (
  template_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_type VARCHAR(50) UNIQUE NOT NULL,      -- 'channel_letters', 'acm_panel', etc.
  template_name VARCHAR(255) NOT NULL,
  description TEXT,

  -- === TEMPLATE DATA ===
  task_rules JSON NOT NULL,                      -- Array of task generation rules
  material_rules JSON,                           -- Array of material calculation rules (future)

  -- === METADATA ===
  created_by VARCHAR(50),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_modified_by VARCHAR(50),
  last_modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,

  -- === INDEXES ===
  INDEX idx_product_type (product_type),
  INDEX idx_active (is_active),

  -- === FOREIGN KEYS ===
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (last_modified_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 12. quickbooks_mappings

Mapping between product types and QuickBooks items.

```sql
CREATE TABLE quickbooks_mappings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_type VARCHAR(50),
  custom_identifier VARCHAR(100),                -- For more specific matching
  quickbooks_item_id VARCHAR(50) NOT NULL,
  quickbooks_item_name VARCHAR(255) NOT NULL,
  description TEXT,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_modified_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- === INDEXES ===
  INDEX idx_product_type (product_type),
  UNIQUE KEY unique_mapping (product_type, custom_identifier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## Enums & Constraints

### Kanban Stages (CHECK constraint)

```sql
ALTER TABLE orders
ADD CONSTRAINT chk_kanban_stage CHECK (
  kanban_stage IN (
    'initiated',
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
  )
);
```

### Order Status

```sql
ALTER TABLE orders
ADD CONSTRAINT chk_overall_status CHECK (
  overall_status IN ('active', 'overdue', 'on_hold', 'completed', 'cancelled')
);
```

### Priority

```sql
ALTER TABLE orders
ADD CONSTRAINT chk_priority CHECK (
  priority IN ('low', 'normal', 'high', 'urgent')
);
```

### Production Roles

```sql
ALTER TABLE order_tasks
ADD CONSTRAINT chk_role CHECK (
  role IN (
    'designer',
    'vinyl_cnc',
    'cut_bend',
    'trim_fabrication',
    'return_fabrication',
    'return_gluing',
    'painting',
    'leds',
    'pins_dtape_gluing',
    'backers',
    'packing'
  )
);
```

### Task Status

```sql
ALTER TABLE order_tasks
ADD CONSTRAINT chk_task_status CHECK (
  status IN ('pending', 'available', 'in_progress', 'completed', 'blocked')
);
```

---

## Indexes Strategy

### High-Priority Indexes

```sql
-- Dashboard queries: Find orders by status and due date
CREATE INDEX idx_orders_dashboard ON orders(overall_status, due_date, priority);

-- Kanban queries: Find orders in specific stages
CREATE INDEX idx_orders_kanban ON orders(kanban_stage, due_date);

-- Progress tracking: Find tasks by role and availability
CREATE INDEX idx_tasks_progress ON order_tasks(role, status, is_available, due_date);

-- Customer view: All orders for a customer
CREATE INDEX idx_orders_customer ON orders(customer_id, created_date DESC);

-- Overdue check: Fast lookup of overdue jobs
CREATE INDEX idx_orders_overdue ON orders(is_overdue, overall_status) WHERE is_overdue = TRUE;

-- Invoice queries: Find unpaid invoices
CREATE INDEX idx_invoices_unpaid ON invoices(status, due_date) WHERE status != 'paid';
```

### Composite Indexes for Common Queries

```sql
-- Find available tasks for a specific role
CREATE INDEX idx_tasks_role_available ON order_tasks(role, is_available, due_date)
WHERE is_available = TRUE;

-- Phase 4+ Future: Find orders by designer and stage
-- CREATE INDEX idx_orders_designer_stage ON orders(assigned_designer, kanban_stage, due_date);
-- Note: assigned_designer field not included in Phase 1

-- Timeline events by order, chronological
CREATE INDEX idx_timeline_order_chrono ON order_timeline(order_id, event_date DESC);
```

---

## Triggers

### 1. Auto-Update Order Progress

```sql
DELIMITER $$

CREATE TRIGGER update_order_progress_after_task_complete
AFTER UPDATE ON order_tasks
FOR EACH ROW
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Recalculate order progress
    UPDATE orders o
    SET
      completed_tasks = (
        SELECT COUNT(*) FROM order_tasks
        WHERE order_id = NEW.order_id AND status = 'completed'
      ),
      total_tasks = (
        SELECT COUNT(*) FROM order_tasks
        WHERE order_id = NEW.order_id
      ),
      overall_percent = ROUND((
        SELECT COUNT(*) FROM order_tasks
        WHERE order_id = NEW.order_id AND status = 'completed'
      ) * 100.0 / (
        SELECT COUNT(*) FROM order_tasks
        WHERE order_id = NEW.order_id
      )),
      last_task_completed_at = NOW()
    WHERE o.id = NEW.order_id;

    -- Update dependent tasks' availability
    CALL update_task_dependencies(NEW.order_id);
  END IF;
END$$

DELIMITER ;
```

### 2. Auto-Update Invoice Totals

```sql
DELIMITER $$

CREATE TRIGGER update_invoice_totals_after_line_change
AFTER INSERT ON invoice_line_items
FOR EACH ROW
BEGIN
  UPDATE invoices
  SET
    subtotal = (
      SELECT SUM(total) FROM invoice_line_items
      WHERE invoice_id = NEW.invoice_id
    ),
    tax_amount = subtotal * tax_rate,
    total = subtotal + tax_amount
  WHERE id = NEW.invoice_id;
END$$

DELIMITER ;
```

### 3. Log Timeline Events on Stage Change

```sql
DELIMITER $$

CREATE TRIGGER log_stage_change
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
  IF NEW.kanban_stage != OLD.kanban_stage THEN
    INSERT INTO order_timeline (id, order_id, event_type, event_description, user_id)
    VALUES (
      UUID(),
      NEW.id,
      'stage_moved',
      CONCAT('Moved from ', OLD.kanban_stage, ' to ', NEW.kanban_stage),
      NEW.last_modified_by
    );
  END IF;
END$$

DELIMITER ;
```

---

## Stored Procedures

### 1. Update Task Dependencies

```sql
DELIMITER $$

CREATE PROCEDURE update_task_dependencies(IN p_order_id VARCHAR(50))
BEGIN
  -- Mark tasks as available if all dependencies are completed
  UPDATE order_tasks t
  SET
    is_available = (
      -- Check if all dependencies are completed
      SELECT COUNT(*) = 0
      FROM JSON_TABLE(
        t.dependencies,
        '$[*]' COLUMNS (dep_id VARCHAR(50) PATH '$')
      ) AS deps
      LEFT JOIN order_tasks dep ON dep.id = deps.dep_id
      WHERE dep.status != 'completed' OR dep.id IS NULL
    ),
    status = CASE
      WHEN status = 'pending' AND is_available THEN 'available'
      ELSE status
    END
  WHERE t.order_id = p_order_id
    AND t.status IN ('pending', 'available');
END$$

DELIMITER ;
```

### 2. Generate Order Number

```sql
-- Order numbers are sequential integers starting at 200000
-- No stored procedure needed - use AUTO_INCREMENT or application logic
-- Example: 200001, 200002, 200003, etc.
```

---

## Existing Table Modifications

These tables already exist in the system and need to be modified to support the Orders system.

### employees Table

Add production roles to track which employees can complete which types of tasks.

```sql
ALTER TABLE employees
ADD COLUMN production_roles JSON
COMMENT 'Array of production roles: ["designer", "vinyl_cnc", "painting", "cut_bend", "leds", "packing"]';

-- Example data:
-- {"roles": ["designer"]}
-- {"roles": ["vinyl_cnc", "cut_bend", "painting"]}
-- {"roles": ["designer", "vinyl_cnc", "leds", "packing"]}
```

**Phase 1 Note**: In Phase 1, there is NO assigned_designer field. All designers can see and work on all orders. The `production_roles` field is populated but not enforced for filtering. Phase 4+ may add designer assignment functionality with an assigned_designer field and role-based task filtering.

---

## Migration Strategy

### Phase 1: Core Tables
1. Create `orders` table
2. Create `order_parts` table
3. Create `order_part_subitems` table
4. Create `estimate_line_item_links` table
5. Create `order_tasks` table
6. Create `order_timeline` table

### Phase 2: Financial Tables
7. Create `invoices` table
8. Create `invoice_line_items` table
9. Create `invoice_payments` table

### Phase 3: Supporting Tables
10. Create `order_files` table
11. Create `product_templates` table
12. Create `quickbooks_mappings` table

### Phase 4: Triggers & Procedures
13. Create triggers for auto-updates
14. Create stored procedures
15. Create indexes

### Phase 5: Future (Materials)
16. Create `materials_breakdown` table
17. Create `material_requirements` table
18. Create `material_reservations` table

---

## Sample Migration File

```sql
-- Migration: Create Orders System Tables
-- Version: 1.0.0
-- Date: 2025-10-31

START TRANSACTION;

-- Drop tables if they exist (for development only)
-- DROP TABLE IF EXISTS order_timeline;
-- DROP TABLE IF EXISTS order_tasks;
-- ... (in reverse order of dependencies)

-- 1. Create orders table
CREATE TABLE orders (
  -- [Full definition from above]
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Create order_parts table
CREATE TABLE order_parts (
  -- [Full definition from above]
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- [Continue with all tables...]

-- Create indexes
CREATE INDEX idx_orders_dashboard ON orders(overall_status, due_date, priority);
-- [All other indexes...]

-- Create triggers
DELIMITER $$
-- [All triggers...]
DELIMITER ;

-- Create stored procedures
DELIMITER $$
-- [All procedures...]
DELIMITER ;

-- Insert initial data
INSERT INTO product_templates (id, product_type, template_name, task_rules)
VALUES
  ('tpl_channel', 'channel_letters', 'Channel Letters Template', '[...]'),
  ('tpl_acm', 'acm_panel', 'ACM Panel Template', '[...]');

COMMIT;
```

---

## Data Integrity Rules

### Cascading Deletes
- Deleting an **order** cascades to parts, tasks, timeline
- Deleting a **part** cascades to sub-items, tasks
- Deleting an **invoice** cascades to line items, payments

### Restrict Deletes
- Cannot delete **order** if invoice exists (RESTRICT)
- Cannot delete **customer** if orders exist (RESTRICT)
- Cannot delete **user** if they created orders (SET NULL)

### Soft Deletes (Future Enhancement)
- Add `deleted_at` column to orders
- Filter out soft-deleted records in queries
- Preserve data for auditing

---

## Performance Considerations

### Query Optimization
- Use covering indexes for frequently accessed columns
- Denormalize customer_name, user_name for display queries
- Cache calculated fields (overall_percent, amount_due)
- Partition orders table by year for very large datasets

### Expected Data Volume
- **Orders**: 1,000 - 2,000 per year
- **Order Parts**: 2,000 - 4,000 per year (avg 2 parts/order)
- **Order Tasks**: 20,000 - 40,000 per year (avg 10-20 tasks/order)
- **Timeline Events**: 50,000 - 100,000 per year (avg 50 events/order)

### Archiving Strategy (Future)
- Move completed orders older than 2 years to archive table
- Maintain foreign key relationships
- Keep archive searchable but separate

---

## Backup & Recovery

### Backup Schedule
- **Full backup**: Nightly at 2:00 AM
- **Incremental backup**: Every 4 hours
- **Retention**: 30 days rolling

### Critical Tables for Immediate Backup
1. `orders`
2. `invoices`
3. `invoice_payments`
4. `order_timeline`

---

## Next Steps

1. ✅ Define database schema (this document)
2. Create migration files
3. Set up database in development environment
4. Test migrations on sample data
5. Create seed data for testing
6. Implement database access layer in backend
7. Write database unit tests

---

**Document Status**: Initial Planning - Complete
**Last Updated**: 2025-10-31
**Dependencies**: All other Orders Page documents
**Ready for Implementation**: Yes, pending review
