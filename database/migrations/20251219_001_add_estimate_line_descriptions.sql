-- Phase 4.c - QB Description Column
-- Create table to store QB descriptions for estimate line items
-- Allows custom QB descriptions that persist across sessions and survive estimate conversion

CREATE TABLE estimate_line_descriptions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  estimate_id INT NOT NULL,
  line_index INT NOT NULL COMMENT '0-based index in EstimateLineItem array',
  qb_description TEXT NULL,
  is_auto_filled TINYINT(1) DEFAULT 1 COMMENT 'True if auto-filled, false if user-edited',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (estimate_id) REFERENCES job_estimates(id) ON DELETE CASCADE,
  UNIQUE KEY unique_estimate_line (estimate_id, line_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rollback
-- DROP TABLE IF EXISTS estimate_line_descriptions;
