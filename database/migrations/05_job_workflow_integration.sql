-- =====================================================
-- JOB WORKFLOW INTEGRATION - Complete Quote to Invoice System
-- =====================================================
-- Connects: Estimates → Jobs → Supply Requirements → Invoices
-- Integrates with existing: jobs, inventory, suppliers, job_estimates
-- =====================================================

-- =====================================================
-- 1. JOB MATERIAL REQUIREMENTS SYSTEM
-- =====================================================

-- Stores calculated material requirements for jobs
CREATE TABLE job_material_requirements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  job_id INT NOT NULL,
  estimate_id INT, -- Link back to original estimate
  
  -- Material identification
  product_standard_id INT, -- Links to existing product_standards
  material_category VARCHAR(100) NOT NULL, -- vinyl, acrylic, aluminum, etc.
  material_description TEXT NOT NULL,
  
  -- Quantity requirements
  required_quantity DECIMAL(10,3) NOT NULL,
  unit_of_measure VARCHAR(20) NOT NULL,
  
  -- Sourcing information
  available_in_inventory DECIMAL(10,3) DEFAULT 0,
  reserved_quantity DECIMAL(10,3) DEFAULT 0,
  needs_ordering DECIMAL(10,3) DEFAULT 0,
  
  -- Cost tracking
  estimated_unit_cost DECIMAL(10,4),
  total_estimated_cost DECIMAL(10,2),
  
  -- Sourcing status
  sourcing_status ENUM('pending', 'available', 'ordered', 'received') DEFAULT 'pending',
  preferred_supplier_id INT,
  
  -- Job specification context
  job_item_reference TEXT, -- Which job items need this material
  specification_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign keys
  FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON DELETE CASCADE,
  FOREIGN KEY (estimate_id) REFERENCES job_estimates(id) ON DELETE SET NULL,
  FOREIGN KEY (product_standard_id) REFERENCES product_standards(id) ON DELETE SET NULL,
  FOREIGN KEY (preferred_supplier_id) REFERENCES suppliers(supplier_id) ON DELETE SET NULL,
  
  -- Indexes for performance
  INDEX idx_job_id (job_id),
  INDEX idx_material_category (material_category),
  INDEX idx_sourcing_status (sourcing_status),
  INDEX idx_estimate_id (estimate_id)
);

-- =====================================================
-- 2. INVENTORY RESERVATIONS SYSTEM
-- =====================================================

-- Tracks inventory reserved for specific jobs
CREATE TABLE inventory_reservations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  job_id INT NOT NULL,
  inventory_id INT NOT NULL, -- Links to existing inventory table
  job_material_requirement_id INT NOT NULL,
  
  -- Reservation details
  reserved_quantity DECIMAL(10,3) NOT NULL,
  reservation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expected_use_date DATE,
  
  -- Status tracking
  status ENUM('reserved', 'allocated', 'used', 'released') DEFAULT 'reserved',
  
  -- Notes
  notes TEXT,
  
  -- Audit trail
  reserved_by INT NOT NULL,
  updated_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign keys
  FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON DELETE CASCADE,
  FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE,
  FOREIGN KEY (job_material_requirement_id) REFERENCES job_material_requirements(id) ON DELETE CASCADE,
  FOREIGN KEY (reserved_by) REFERENCES users(user_id) ON DELETE RESTRICT,
  FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL,
  
  -- Indexes
  INDEX idx_job_inventory (job_id, inventory_id),
  INDEX idx_status_date (status, reservation_date),
  INDEX idx_material_requirement (job_material_requirement_id)
);

-- =====================================================
-- 3. SUPPLIER ORDERS SYSTEM
-- =====================================================

-- Tracks materials that need to be ordered from suppliers
CREATE TABLE supplier_orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  supplier_id INT NOT NULL,
  order_number VARCHAR(50) UNIQUE,
  
  -- Order details
  order_date DATE NOT NULL,
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  
  -- Status tracking
  status ENUM('draft', 'submitted', 'acknowledged', 'shipped', 'delivered', 'cancelled') DEFAULT 'draft',
  
  -- Financial
  subtotal DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  shipping_cost DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,
  
  -- Contact information
  supplier_contact_name VARCHAR(255),
  supplier_contact_email VARCHAR(255),
  supplier_reference VARCHAR(100),
  
  -- Delivery information
  delivery_address TEXT,
  delivery_instructions TEXT,
  
  -- Notes
  internal_notes TEXT,
  supplier_notes TEXT,
  
  -- Audit trail
  created_by INT NOT NULL,
  updated_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign keys
  FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE RESTRICT,
  FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL,
  
  -- Indexes
  INDEX idx_supplier_date (supplier_id, order_date),
  INDEX idx_status_date (status, order_date),
  INDEX idx_order_number (order_number)
);

-- Supplier order line items
CREATE TABLE supplier_order_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  job_material_requirement_id INT, -- Optional link to job requirement
  
  -- Item details
  product_standard_id INT,
  item_description TEXT NOT NULL,
  supplier_part_number VARCHAR(100),
  
  -- Quantity and pricing
  quantity DECIMAL(10,3) NOT NULL,
  unit_of_measure VARCHAR(20) NOT NULL,
  unit_cost DECIMAL(10,4) NOT NULL,
  line_total DECIMAL(10,2) NOT NULL,
  
  -- Delivery tracking
  quantity_received DECIMAL(10,3) DEFAULT 0,
  quantity_accepted DECIMAL(10,3) DEFAULT 0,
  
  -- Item notes
  specifications TEXT,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign keys
  FOREIGN KEY (order_id) REFERENCES supplier_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (job_material_requirement_id) REFERENCES job_material_requirements(id) ON DELETE SET NULL,
  FOREIGN KEY (product_standard_id) REFERENCES product_standards(id) ON DELETE SET NULL,
  
  -- Indexes
  INDEX idx_order_id (order_id),
  INDEX idx_job_requirement (job_material_requirement_id)
);

-- =====================================================
-- 4. INVOICE GENERATION SYSTEM  
-- =====================================================

-- Job invoices with detailed breakdown
CREATE TABLE job_invoices (
  id INT PRIMARY KEY AUTO_INCREMENT,
  job_id INT NOT NULL,
  estimate_id INT, -- Link to original estimate
  
  -- Invoice identification
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  
  -- Customer information (denormalized for invoice record)
  customer_id INT,
  bill_to_name VARCHAR(255) NOT NULL,
  bill_to_address TEXT,
  ship_to_name VARCHAR(255),
  ship_to_address TEXT,
  
  -- Invoice totals
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,4) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Payment tracking
  amount_paid DECIMAL(10,2) DEFAULT 0,
  balance_due DECIMAL(10,2) GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
  
  -- Status
  status ENUM('draft', 'ready', 'sent', 'paid', 'overdue', 'cancelled') DEFAULT 'draft',
  
  -- Descriptions
  job_description TEXT,
  payment_terms VARCHAR(100) DEFAULT 'Net 30',
  notes TEXT,
  
  -- File attachments
  pdf_file_path VARCHAR(500),
  
  -- Audit trail
  created_by INT NOT NULL,
  updated_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign keys
  FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON DELETE RESTRICT,
  FOREIGN KEY (estimate_id) REFERENCES job_estimates(id) ON DELETE SET NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE RESTRICT,
  FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL,
  
  -- Indexes
  INDEX idx_job_id (job_id),
  INDEX idx_customer_date (customer_id, invoice_date),
  INDEX idx_status_date (status, invoice_date),
  INDEX idx_invoice_number (invoice_number)
);

-- Invoice line items with detailed breakdown
CREATE TABLE job_invoice_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  invoice_id INT NOT NULL,
  
  -- Item categorization
  item_category ENUM('material', 'labor', 'overhead', 'markup', 'tax', 'shipping', 'other') NOT NULL,
  item_type VARCHAR(100), -- vinyl, channel_letters, installation, etc.
  
  -- Item description
  item_description TEXT NOT NULL,
  item_details TEXT, -- Detailed specifications
  
  -- Quantity and pricing
  quantity DECIMAL(10,3) DEFAULT 1,
  unit_of_measure VARCHAR(20) DEFAULT 'ea',
  unit_price DECIMAL(10,4) NOT NULL,
  line_total DECIMAL(10,2) NOT NULL,
  
  -- Cost tracking (internal)
  internal_cost DECIMAL(10,4),
  margin_percent DECIMAL(5,2),
  margin_amount DECIMAL(10,2),
  
  -- References to source data
  estimate_item_id INT, -- Links back to original estimate item
  material_requirement_id INT, -- Links to material requirements
  
  -- Display order
  display_order INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign keys
  FOREIGN KEY (invoice_id) REFERENCES job_invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (estimate_item_id) REFERENCES job_estimate_items(id) ON DELETE SET NULL,
  FOREIGN KEY (material_requirement_id) REFERENCES job_material_requirements(id) ON DELETE SET NULL,
  
  -- Indexes
  INDEX idx_invoice_category (invoice_id, item_category),
  INDEX idx_display_order (invoice_id, display_order)
);

-- =====================================================
-- 5. WORKFLOW STATUS TRACKING
-- =====================================================

-- Tracks the complete workflow from estimate to invoice
CREATE TABLE job_workflow_status (
  id INT PRIMARY KEY AUTO_INCREMENT,
  job_id INT NOT NULL,
  estimate_id INT,
  
  -- Workflow stages with timestamps
  estimate_created_at TIMESTAMP NULL,
  estimate_approved_at TIMESTAMP NULL,
  job_created_at TIMESTAMP NULL,
  materials_calculated_at TIMESTAMP NULL,
  materials_sourced_at TIMESTAMP NULL,
  production_started_at TIMESTAMP NULL,
  production_completed_at TIMESTAMP NULL,
  invoice_generated_at TIMESTAMP NULL,
  invoice_sent_at TIMESTAMP NULL,
  payment_received_at TIMESTAMP NULL,
  
  -- Current status
  current_stage ENUM(
    'estimating', 
    'estimate_pending_approval', 
    'materials_planning', 
    'materials_sourcing', 
    'production_ready', 
    'in_production', 
    'quality_check', 
    'ready_for_delivery', 
    'invoicing', 
    'payment_pending', 
    'completed'
  ) DEFAULT 'estimating',
  
  -- Progress tracking
  overall_progress_percent DECIMAL(5,2) DEFAULT 0,
  
  -- Notes and blockers
  current_notes TEXT,
  blockers TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign keys
  FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON DELETE CASCADE,
  FOREIGN KEY (estimate_id) REFERENCES job_estimates(id) ON DELETE SET NULL,
  
  -- Indexes
  INDEX idx_job_stage (job_id, current_stage),
  INDEX idx_current_stage (current_stage),
  UNIQUE KEY idx_job_workflow (job_id) -- One workflow per job
);

-- =====================================================
-- 6. SAMPLE DATA FOR TESTING
-- =====================================================

-- Generate sample invoice numbers function
DELIMITER //
CREATE FUNCTION generate_invoice_number() RETURNS VARCHAR(50)
READS SQL DATA
DETERMINISTIC
BEGIN
  DECLARE next_number INT;
  DECLARE current_year INT;
  SET current_year = YEAR(CURDATE());
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number, -4) AS UNSIGNED)), 0) + 1
  INTO next_number
  FROM job_invoices 
  WHERE invoice_number LIKE CONCAT('INV-', current_year, '-%');
  
  RETURN CONCAT('INV-', current_year, '-', LPAD(next_number, 4, '0'));
END//
DELIMITER ;

-- =====================================================
-- 7. INTEGRATION TRIGGERS
-- =====================================================

DELIMITER //

-- Auto-create workflow status when job is created
CREATE TRIGGER job_workflow_status_create
AFTER INSERT ON jobs
FOR EACH ROW
BEGIN
  INSERT INTO job_workflow_status (job_id, job_created_at, current_stage)
  VALUES (NEW.job_id, CURRENT_TIMESTAMP, 'materials_planning');
END//

-- Update workflow status when invoice is generated
CREATE TRIGGER job_invoice_workflow_update
AFTER INSERT ON job_invoices
FOR EACH ROW
BEGIN
  UPDATE job_workflow_status 
  SET invoice_generated_at = CURRENT_TIMESTAMP,
      current_stage = 'invoicing',
      overall_progress_percent = 90
  WHERE job_id = NEW.job_id;
END//

DELIMITER ;

-- =====================================================
-- END OF JOB WORKFLOW INTEGRATION SCHEMA
-- =====================================================