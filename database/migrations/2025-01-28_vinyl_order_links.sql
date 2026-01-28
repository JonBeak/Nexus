-- Migration: Replace vinyl_job_links with vinyl_order_links
-- Created: 2025-01-28
-- Purpose: Migrate vinyl associations from jobs (estimates) to orders (production orders)
-- Note: vinyl_job_links is currently empty (0 records), so this is a clean migration

-- Create new vinyl_order_links table
CREATE TABLE `vinyl_order_links` (
  `link_id` int NOT NULL AUTO_INCREMENT,
  `vinyl_id` int NOT NULL,
  `order_id` int NOT NULL,
  `sequence_order` int DEFAULT 1,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`link_id`),
  KEY `idx_vinyl_order` (`vinyl_id`),
  KEY `idx_order` (`order_id`),
  CONSTRAINT `fk_vinyl_order_vinyl` FOREIGN KEY (`vinyl_id`) REFERENCES `vinyl_inventory` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_vinyl_order_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Drop the old unused table
DROP TABLE IF EXISTS `vinyl_job_links`;
