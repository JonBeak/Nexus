-- ============================================================================
-- Migration: Create Inventory Holds Tables
-- Created: 2026-02-04
-- Purpose: Track vinyl and general inventory holds for material requirements
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: vinyl_holds
-- Tracks holds on vinyl inventory items for specific material requirements
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `vinyl_holds` (
  `hold_id` INT NOT NULL AUTO_INCREMENT,
  `vinyl_id` INT NOT NULL COMMENT 'Reference to vinyl_inventory.id',
  `material_requirement_id` INT NOT NULL COMMENT 'Reference to material_requirements.requirement_id',
  `quantity_held` VARCHAR(50) NOT NULL COMMENT 'Description of quantity held: "Whole", "50 sq ft", etc.',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `created_by` INT DEFAULT NULL COMMENT 'User who created the hold',

  PRIMARY KEY (`hold_id`),
  INDEX `idx_vinyl_holds_vinyl_id` (`vinyl_id`),
  INDEX `idx_vinyl_holds_requirement_id` (`material_requirement_id`),
  INDEX `idx_vinyl_holds_created_at` (`created_at`),

  CONSTRAINT `fk_vinyl_holds_vinyl`
    FOREIGN KEY (`vinyl_id`) REFERENCES `vinyl_inventory` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_vinyl_holds_requirement`
    FOREIGN KEY (`material_requirement_id`) REFERENCES `material_requirements` (`requirement_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_vinyl_holds_created_by`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Tracks vinyl inventory holds for material requirements';

-- ----------------------------------------------------------------------------
-- Table: general_inventory_holds
-- Tracks holds on supplier products (general inventory) for material requirements
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `general_inventory_holds` (
  `hold_id` INT NOT NULL AUTO_INCREMENT,
  `supplier_product_id` INT NOT NULL COMMENT 'Reference to supplier_products.supplier_product_id',
  `material_requirement_id` INT NOT NULL COMMENT 'Reference to material_requirements.requirement_id',
  `quantity_held` VARCHAR(50) NOT NULL COMMENT 'Description of quantity held',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `created_by` INT DEFAULT NULL COMMENT 'User who created the hold',

  PRIMARY KEY (`hold_id`),
  INDEX `idx_general_holds_supplier_product_id` (`supplier_product_id`),
  INDEX `idx_general_holds_requirement_id` (`material_requirement_id`),
  INDEX `idx_general_holds_created_at` (`created_at`),

  CONSTRAINT `fk_general_holds_supplier_product`
    FOREIGN KEY (`supplier_product_id`) REFERENCES `supplier_products` (`supplier_product_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_general_holds_requirement`
    FOREIGN KEY (`material_requirement_id`) REFERENCES `material_requirements` (`requirement_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_general_holds_created_by`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Tracks general inventory holds for material requirements';

-- ----------------------------------------------------------------------------
-- Add held item references to material_requirements
-- These track which inventory item is currently held for this requirement
-- ----------------------------------------------------------------------------
ALTER TABLE `material_requirements`
  ADD COLUMN `held_vinyl_id` INT NULL COMMENT 'Reference to held vinyl_inventory item' AFTER `vinyl_product_id`,
  ADD COLUMN `held_supplier_product_id` INT NULL COMMENT 'Reference to held supplier_product item' AFTER `supplier_product_id`;

-- Add indexes for the new columns
CREATE INDEX `idx_held_vinyl` ON `material_requirements` (`held_vinyl_id`);
CREATE INDEX `idx_held_supplier_product` ON `material_requirements` (`held_supplier_product_id`);

-- Add foreign keys
ALTER TABLE `material_requirements`
  ADD CONSTRAINT `fk_material_req_held_vinyl`
    FOREIGN KEY (`held_vinyl_id`) REFERENCES `vinyl_inventory` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_material_req_held_supplier_product`
    FOREIGN KEY (`held_supplier_product_id`) REFERENCES `supplier_products` (`supplier_product_id`) ON DELETE SET NULL;

-- ============================================================================
-- Verification queries
-- ============================================================================
-- Run these after migration to verify success:
-- SHOW CREATE TABLE vinyl_holds\G
-- SHOW CREATE TABLE general_inventory_holds\G
-- DESCRIBE material_requirements;
