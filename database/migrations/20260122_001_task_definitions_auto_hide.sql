-- =============================================================================
-- Migration: Add auto_hide column to task_definitions and reseed with complete data
-- Date: 2026-01-22
-- Description:
--   1. Adds auto_hide column for TasksTable column visibility control
--   2. Reseeds with all 31 tasks (missing: 3D Print, Paper Pattern, Vinyl Stencil, UL, QC & Packing)
--   3. Normalizes naming: "Vinyl Face Before/After Cutting" → "Vinyl Before/After Cutting"
-- =============================================================================

-- Step 1: Add auto_hide column (MySQL doesn't support IF NOT EXISTS for ADD COLUMN)
-- Check if column exists first via stored procedure
SET @column_exists = (SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'sign_manufacturing'
    AND TABLE_NAME = 'task_definitions'
    AND COLUMN_NAME = 'auto_hide');

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE task_definitions ADD COLUMN auto_hide BOOLEAN DEFAULT FALSE AFTER is_system',
    'SELECT ''auto_hide column already exists''');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 2: Clear existing data and reseed with complete values
-- Note: This is safe because task_definitions is configuration data, not transactional data
DELETE FROM task_definitions;

-- Step 3: Insert all 31 tasks with correct order, roles, and auto_hide values
-- auto_hide=FALSE means the column is always visible (core workflow tasks)
-- auto_hide=TRUE means the column hides when no data on current page (specialized tasks)
INSERT INTO task_definitions (task_name, task_key, display_order, assigned_role, is_system, auto_hide) VALUES
('3D Print', '3d_print', 1, 'designer', TRUE, TRUE),
('Paper Pattern', 'paper_pattern', 2, 'designer', TRUE, TRUE),
('Vinyl Stencil', 'vinyl_stencil', 3, 'designer', TRUE, TRUE),
('UL', 'ul', 4, 'designer', TRUE, TRUE),
('Vinyl Plotting', 'vinyl_plotting', 5, 'designer', TRUE, TRUE),
('Sanding (320) before cutting', 'sanding_before_cutting', 6, 'painter', TRUE, TRUE),
('Scuffing before cutting', 'scuffing_before_cutting', 7, 'painter', TRUE, TRUE),
('Paint before cutting', 'paint_before_cutting', 8, 'painter', TRUE, TRUE),
('Vinyl Before Cutting', 'vinyl_before_cutting', 9, 'vinyl_applicator', TRUE, TRUE),
('Vinyl Wrap Return/Trim', 'vinyl_wrap_return_trim', 10, 'vinyl_applicator', TRUE, TRUE),
('CNC Router Cut', 'cnc_router_cut', 11, 'cnc_router_operator', TRUE, FALSE),
('Laser Cut', 'laser_cut', 12, 'manager', TRUE, TRUE),
('Cut & Bend Return', 'cut_bend_return', 13, 'cut_bender_operator', TRUE, FALSE),
('Cut & Bend Trim', 'cut_bend_trim', 14, 'cut_bender_operator', TRUE, FALSE),
('Sanding (320) after cutting', 'sanding_after_cutting', 15, 'painter', TRUE, TRUE),
('Scuffing after cutting', 'scuffing_after_cutting', 16, 'painter', TRUE, TRUE),
('Paint After Cutting', 'paint_after_cutting', 17, 'painter', TRUE, TRUE),
('Backer / Raceway Bending', 'backer_raceway_bending', 18, 'backer_raceway_fabricator', TRUE, TRUE),
('Paint After Bending', 'paint_after_bending', 19, 'painter', TRUE, TRUE),
('Vinyl After Cutting', 'vinyl_after_cutting', 20, 'vinyl_applicator', TRUE, TRUE),
('Trim Fabrication', 'trim_fabrication', 21, 'trim_fabricator', TRUE, FALSE),
('Return Fabrication', 'return_fabrication', 22, 'return_fabricator', TRUE, FALSE),
('Return Gluing', 'return_gluing', 23, 'return_gluer', TRUE, FALSE),
('Mounting Hardware', 'mounting_hardware', 24, 'mounting_assembler', TRUE, TRUE),
('Face Assembly', 'face_assembly', 25, 'face_assembler', TRUE, TRUE),
('LEDs', 'leds', 26, 'led_installer', TRUE, FALSE),
('Backer / Raceway Fabrication', 'backer_raceway_fabrication', 27, 'backer_raceway_fabricator', TRUE, TRUE),
('Vinyl after Fabrication', 'vinyl_after_fabrication', 28, 'vinyl_applicator', TRUE, TRUE),
('Paint after Fabrication', 'paint_after_fabrication', 29, 'painter', TRUE, TRUE),
('Assembly', 'assembly', 30, 'backer_raceway_assembler', TRUE, TRUE),
('QC & Packing', 'qc_packing', 31, 'qc_packer', TRUE, TRUE);

-- =============================================================================
-- Summary of auto_hide settings:
--
-- Always Visible (auto_hide=FALSE) - 7 core workflow tasks:
--   - CNC Router Cut, Cut & Bend Return, Cut & Bend Trim
--   - Trim Fabrication, Return Fabrication, Return Gluing, LEDs
--
-- Auto-hide when empty (auto_hide=TRUE) - 24 specialized tasks:
--   - All painting tasks (pre/post cutting, bending, fabrication)
--   - All vinyl tasks (plotting, before/after cutting, wrap, etc.)
--   - Specialized tasks (3D Print, Paper Pattern, Vinyl Stencil, UL)
--   - Assembly tasks (Mounting Hardware, Face Assembly, Assembly)
--   - QC & Packing
-- =============================================================================
