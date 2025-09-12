-- Migration: Phase 4 Grid Data Persistence for GridJobBuilderRefactored
-- Date: 2025-09-03
-- Purpose: Add flat items structure with assembly groups for complete grid persistence
-- Note: Preserves existing data while adding Phase 4 capabilities

-- =============================================
-- STEP 1: ADD NEW FIELDS TO job_estimate_items
-- =============================================

-- Add fields for Phase 4 flat items structure
ALTER TABLE job_estimate_items 
ADD COLUMN estimate_id INT NULL AFTER group_id,
ADD COLUMN item_type ENUM('product', 'assembly', 'assembly_fee', 'sub_item', 'empty', 'custom', 'note', 'divider') DEFAULT 'product' AFTER estimate_id,
ADD COLUMN assembly_group_id INT NULL COMMENT '0-9 for colored assembly groupings, NULL for ungrouped' AFTER item_type,
ADD COLUMN parent_item_id INT NULL COMMENT 'For continuation rows and sub-items' AFTER assembly_group_id,
ADD COLUMN grid_data JSON NULL COMMENT '12-column field data from GridJobBuilder' AFTER parent_item_id;

-- Add foreign key constraints
ALTER TABLE job_estimate_items
ADD CONSTRAINT fk_estimate_items_estimate FOREIGN KEY (estimate_id) REFERENCES job_estimates(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_estimate_items_parent FOREIGN KEY (parent_item_id) REFERENCES job_estimate_items(id) ON DELETE CASCADE;

-- Add indexes for performance
ALTER TABLE job_estimate_items
ADD INDEX idx_estimate_id (estimate_id),
ADD INDEX idx_assembly_group (assembly_group_id),
ADD INDEX idx_parent_item (parent_item_id),
ADD INDEX idx_item_type (item_type);

-- Add constraint for assembly_group_id range (0-9)
ALTER TABLE job_estimate_items
ADD CONSTRAINT chk_assembly_group_range CHECK (assembly_group_id IS NULL OR (assembly_group_id >= 0 AND assembly_group_id <= 9));

-- =============================================
-- STEP 2: CREATE VIEW FOR GRID DATA QUERIES
-- =============================================

-- Create view for easy grid data retrieval with relationships
CREATE OR REPLACE VIEW grid_items_with_details AS
SELECT 
  i.id,
  i.estimate_id,
  i.group_id as legacy_group_id,
  i.item_type,
  i.assembly_group_id,
  i.parent_item_id,
  i.product_type_id,
  pt.type_name as product_type_name,
  i.item_name,
  i.item_order,
  i.grid_data,
  i.input_data as legacy_input_data,
  i.base_quantity,
  i.unit_price,
  i.extended_price,
  i.customer_description,
  i.internal_notes,
  i.created_at,
  i.updated_at,
  -- Parent item reference
  pi.item_name as parent_item_name,
  pi.product_type_id as parent_product_type_id,
  -- Assembly group color mapping (0-9)
  CASE i.assembly_group_id 
    WHEN 0 THEN 'purple'
    WHEN 1 THEN 'blue' 
    WHEN 2 THEN 'green'
    WHEN 3 THEN 'orange'
    WHEN 4 THEN 'pink'
    WHEN 5 THEN 'cyan'
    WHEN 6 THEN 'red'
    WHEN 7 THEN 'yellow'
    WHEN 8 THEN 'indigo'
    WHEN 9 THEN 'emerald'
    ELSE 'ungrouped'
  END as assembly_color
FROM job_estimate_items i
LEFT JOIN product_types pt ON i.product_type_id = pt.product_type_id
LEFT JOIN job_estimate_items pi ON i.parent_item_id = pi.id
ORDER BY i.item_order;

-- =============================================
-- STEP 3: CREATE HELPER PROCEDURES
-- =============================================

DELIMITER //

-- Procedure to migrate legacy group-based items to Phase 4 flat structure
CREATE PROCEDURE MigrateLegacyItemsToPhase4(
  IN target_estimate_id INT
)
BEGIN
  DECLARE done INT DEFAULT FALSE;
  DECLARE item_id INT;
  DECLARE group_display_order INT;
  
  -- Cursor to iterate through items that need estimate_id populated
  DECLARE item_cursor CURSOR FOR
    SELECT i.id, g.display_order
    FROM job_estimate_items i
    JOIN job_estimate_groups g ON i.group_id = g.id
    WHERE g.estimate_id = target_estimate_id
      AND i.estimate_id IS NULL;
  
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
  
  OPEN item_cursor;
  
  read_loop: LOOP
    FETCH item_cursor INTO item_id, group_display_order;
    IF done THEN
      LEAVE read_loop;
    END IF;
    
    -- Update item with estimate_id and convert group order to assembly_group_id
    UPDATE job_estimate_items 
    SET 
      estimate_id = target_estimate_id,
      item_type = 'product',
      assembly_group_id = CASE 
        WHEN group_display_order <= 9 THEN group_display_order 
        ELSE group_display_order % 10 
      END
    WHERE id = item_id;
  END LOOP;
  
  CLOSE item_cursor;
END //

-- Procedure to clear grid data for an estimate
CREATE PROCEDURE ClearGridData(
  IN target_estimate_id INT
)
BEGIN
  -- Delete Phase 4 grid items (estimate_id is populated)
  DELETE FROM job_estimate_items 
  WHERE estimate_id = target_estimate_id;
  
  -- Note: Legacy group-based items remain intact for backward compatibility
END //

DELIMITER ;

-- =============================================
-- STEP 4: VERIFICATION AND CONSTRAINTS
-- =============================================

-- Verify migration structure
SELECT 'Phase 4 grid persistence migration completed successfully' as status;

-- Show updated table structure
DESCRIBE job_estimate_items;

-- Count existing items by structure type
SELECT 
  CASE 
    WHEN estimate_id IS NOT NULL THEN 'Phase 4 (Grid Data)'
    WHEN group_id IS NOT NULL THEN 'Legacy (Groups)'
    ELSE 'Orphaned'
  END as structure_type,
  COUNT(*) as item_count
FROM job_estimate_items
GROUP BY structure_type;

-- =============================================
-- MIGRATION COMPLETE
-- =============================================

-- Record migration in system log
INSERT INTO system_logs (action, description, created_at) 
VALUES ('MIGRATION', 'Phase 4 grid persistence structure added - flat items with assembly groups (0-9)', NOW());