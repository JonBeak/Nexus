-- Migration: Clean Fresh Start - Estimate Versioning System
-- Date: 2025-09-02
-- Purpose: Implement immutable estimate versioning with Customer → Jobs → Estimate Versions hierarchy
-- Note: Starting fresh - existing data will be cleared

-- =============================================
-- STEP 1: CLEAN START - CLEAR EXISTING DATA
-- =============================================

-- Clear existing estimate data
DELETE FROM job_item_addons;
DELETE FROM job_estimate_items;
DELETE FROM job_estimate_groups;
DELETE FROM job_estimates;
DELETE FROM jobs;

-- Reset auto increment counters
ALTER TABLE job_estimates AUTO_INCREMENT = 1;
ALTER TABLE job_estimate_groups AUTO_INCREMENT = 1;
ALTER TABLE job_estimate_items AUTO_INCREMENT = 1;
ALTER TABLE job_item_addons AUTO_INCREMENT = 1;
ALTER TABLE jobs AUTO_INCREMENT = 1;

-- =============================================
-- STEP 2: UPDATE JOBS TABLE
-- =============================================

-- Ensure jobs table is properly linked to customers
ALTER TABLE jobs 
  MODIFY COLUMN customer_id INT NOT NULL,
  ADD CONSTRAINT fk_jobs_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE RESTRICT;

-- =============================================
-- STEP 3: UPDATE JOB_ESTIMATES TABLE - ADD VERSIONING
-- =============================================

-- Remove old estimate_name column and add versioning columns
ALTER TABLE job_estimates 
  DROP COLUMN estimate_name,
  ADD COLUMN job_id INT NOT NULL AFTER customer_id,
  ADD COLUMN version_number INT NOT NULL DEFAULT 1 AFTER job_id,
  ADD COLUMN parent_estimate_id INT NULL AFTER version_number,
  ADD COLUMN is_draft BOOLEAN DEFAULT TRUE AFTER parent_estimate_id,
  ADD COLUMN finalized_at TIMESTAMP NULL AFTER is_draft,
  ADD COLUMN finalized_by_user_id INT NULL AFTER finalized_at;

-- Add foreign key constraints
ALTER TABLE job_estimates 
  ADD CONSTRAINT fk_estimates_job FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_estimates_parent FOREIGN KEY (parent_estimate_id) REFERENCES job_estimates(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_estimates_finalized_by FOREIGN KEY (finalized_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add unique constraint for job_id + version_number
ALTER TABLE job_estimates 
  ADD CONSTRAINT unique_job_version UNIQUE (job_id, version_number);

-- Add indexes for performance
ALTER TABLE job_estimates 
  ADD INDEX idx_job_version (job_id, version_number),
  ADD INDEX idx_is_draft (is_draft),
  ADD INDEX idx_parent_estimate (parent_estimate_id);

-- =============================================
-- STEP 4: CREATE HELPER VIEWS
-- =============================================

-- Create view for estimate summary with job information
CREATE OR REPLACE VIEW job_estimate_summary AS
SELECT 
  e.id,
  e.job_code,
  j.job_id,
  j.job_name,
  j.job_number,
  e.version_number,
  CONCAT('v', e.version_number) as version_label,
  e.customer_id,
  c.company_name as customer_name,
  e.status,
  e.is_draft,
  e.subtotal,
  e.tax_rate,
  e.tax_amount,
  e.total_amount,
  e.parent_estimate_id,
  pe.version_number as parent_version,
  e.finalized_at,
  fu.username as finalized_by,
  e.created_at,
  e.updated_at,
  cu.username as created_by_name,
  uu.username as updated_by_name
FROM job_estimates e
JOIN jobs j ON e.job_id = j.job_id
LEFT JOIN customers c ON e.customer_id = c.customer_id
LEFT JOIN job_estimates pe ON e.parent_estimate_id = pe.id
LEFT JOIN users fu ON e.finalized_by_user_id = fu.id
LEFT JOIN users cu ON e.created_by = cu.id
LEFT JOIN users uu ON e.updated_by = uu.id;

-- Create view for jobs with estimate count
CREATE OR REPLACE VIEW job_summary AS
SELECT 
  j.job_id,
  j.job_number,
  j.job_name,
  j.customer_id,
  c.company_name as customer_name,
  j.status as job_status,
  COUNT(e.id) as estimate_count,
  COUNT(CASE WHEN e.is_draft = TRUE THEN 1 END) as draft_count,
  COUNT(CASE WHEN e.is_draft = FALSE THEN 1 END) as finalized_count,
  MAX(e.version_number) as latest_version,
  MAX(e.updated_at) as last_activity,
  j.created_at,
  j.updated_at
FROM jobs j
LEFT JOIN customers c ON j.customer_id = c.customer_id
LEFT JOIN job_estimates e ON j.job_id = e.job_id
GROUP BY j.job_id, j.job_number, j.job_name, j.customer_id, c.company_name, j.status, j.created_at, j.updated_at;

-- =============================================
-- STEP 5: CREATE STORED PROCEDURES FOR VERSIONING
-- =============================================

DELIMITER //

-- Procedure to create a new estimate version by duplicating existing one
CREATE PROCEDURE CreateNewEstimateVersion(
  IN source_estimate_id INT,
  IN user_id INT,
  OUT new_estimate_id INT
)
BEGIN
  DECLARE source_job_id INT;
  DECLARE next_version INT;
  DECLARE new_job_code VARCHAR(20);
  
  -- Get source estimate info
  SELECT job_id INTO source_job_id 
  FROM job_estimates 
  WHERE id = source_estimate_id;
  
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version
  FROM job_estimates 
  WHERE job_id = source_job_id;
  
  -- Generate new job code
  SET new_job_code = CONCAT('CH', DATE_FORMAT(NOW(), '%Y%m%d'), 
    LPAD((SELECT COUNT(*) + 1 FROM job_estimates 
          WHERE DATE(created_at) = CURDATE()), 3, '0'), 
    'v', next_version);
  
  -- Create new estimate
  INSERT INTO job_estimates (
    job_code, job_id, customer_id, version_number, parent_estimate_id,
    subtotal, tax_rate, tax_amount, total_amount, notes,
    created_by, updated_by, is_draft
  )
  SELECT 
    new_job_code, job_id, customer_id, next_version, source_estimate_id,
    subtotal, tax_rate, tax_amount, total_amount, notes,
    user_id, user_id, TRUE
  FROM job_estimates 
  WHERE id = source_estimate_id;
  
  SET new_estimate_id = LAST_INSERT_ID();
  
  -- Copy groups
  INSERT INTO job_estimate_groups (estimate_id, group_name, assembly_cost, assembly_description, display_order)
  SELECT new_estimate_id, group_name, assembly_cost, assembly_description, display_order
  FROM job_estimate_groups 
  WHERE estimate_id = source_estimate_id;
  
  -- Copy items with new group IDs
  INSERT INTO job_estimate_items (
    group_id, product_type_id, item_name, input_data, customer_description,
    internal_notes, base_quantity, unit_price, extended_price, display_order
  )
  SELECT 
    ng.id, i.product_type_id, i.item_name, i.input_data, i.customer_description,
    i.internal_notes, i.base_quantity, i.unit_price, i.extended_price, i.display_order
  FROM job_estimate_items i
  JOIN job_estimate_groups og ON i.group_id = og.id
  JOIN job_estimate_groups ng ON ng.estimate_id = new_estimate_id 
    AND ng.display_order = og.display_order
  WHERE og.estimate_id = source_estimate_id;
  
  -- Copy addons with new item IDs
  INSERT INTO job_item_addons (
    item_id, addon_type_id, input_data, customer_description, 
    unit_price, extended_price, display_order
  )
  SELECT 
    ni.id, a.addon_type_id, a.input_data, a.customer_description,
    a.unit_price, a.extended_price, a.display_order
  FROM job_item_addons a
  JOIN job_estimate_items oi ON a.item_id = oi.id
  JOIN job_estimate_groups og ON oi.group_id = og.id
  JOIN job_estimate_groups ng ON ng.estimate_id = new_estimate_id 
    AND ng.display_order = og.display_order
  JOIN job_estimate_items ni ON ni.group_id = ng.id 
    AND ni.display_order = oi.display_order
  WHERE og.estimate_id = source_estimate_id;
  
END //

-- Procedure to finalize an estimate (make it immutable)
CREATE PROCEDURE FinalizeEstimate(
  IN estimate_id INT,
  IN user_id INT,
  IN new_status ENUM('sent','approved','ordered','archived')
)
BEGIN
  UPDATE job_estimates 
  SET 
    status = new_status,
    is_draft = FALSE,
    finalized_at = NOW(),
    finalized_by_user_id = user_id,
    updated_by = user_id
  WHERE id = estimate_id AND is_draft = TRUE;
  
  -- Update related job status if needed
  UPDATE jobs j
  JOIN job_estimates e ON j.job_id = e.job_id
  SET j.status = CASE 
    WHEN new_status = 'approved' THEN 'active'
    WHEN new_status = 'ordered' THEN 'production'
    ELSE j.status
  END
  WHERE e.id = estimate_id;
END //

DELIMITER ;

-- =============================================
-- STEP 6: VERIFICATION QUERIES
-- =============================================

-- Verify migration results
SELECT 'Migration completed successfully - Ready for Customer → Jobs → Estimate Versions workflow' as status;

-- Show table structure
DESCRIBE job_estimates;
DESCRIBE jobs;

-- =============================================
-- MIGRATION COMPLETE
-- =============================================

-- Record migration in system log
INSERT INTO system_logs (action, description, created_at) 
VALUES ('MIGRATION', 'Estimate versioning system implemented - Customer → Jobs → Estimate Versions hierarchy created', NOW());