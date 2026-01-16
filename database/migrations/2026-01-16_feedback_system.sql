-- ============================================================================
-- Feedback System Migration
-- Created: 2026-01-16
-- Purpose: Add feedback/error reporting/feature request system
-- ============================================================================

-- ============================================================================
-- STEP 1: Create feedback_requests table
-- ============================================================================
CREATE TABLE IF NOT EXISTS feedback_requests (
  feedback_id INT NOT NULL AUTO_INCREMENT,
  submitted_by INT NOT NULL COMMENT 'User who submitted the feedback',
  title VARCHAR(255) NOT NULL COMMENT 'Brief summary of the feedback',
  description TEXT NOT NULL COMMENT 'Detailed description',
  status ENUM('open', 'in_progress', 'resolved', 'closed') DEFAULT 'open',
  priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',

  -- Screenshot stored as base64 (simpler than file storage)
  screenshot_data LONGTEXT DEFAULT NULL COMMENT 'Base64 encoded image data',
  screenshot_filename VARCHAR(255) DEFAULT NULL,
  screenshot_mime_type VARCHAR(50) DEFAULT NULL,

  -- Context metadata
  page_url VARCHAR(500) DEFAULT NULL COMMENT 'URL where feedback was submitted',
  user_agent VARCHAR(500) DEFAULT NULL COMMENT 'Browser/device info',

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL COMMENT 'When status changed to resolved',
  closed_at TIMESTAMP NULL COMMENT 'When status changed to closed',

  PRIMARY KEY (feedback_id),
  KEY idx_feedback_submitted_by (submitted_by),
  KEY idx_feedback_status (status),
  KEY idx_feedback_priority (priority),
  KEY idx_feedback_created (created_at DESC),

  CONSTRAINT fk_feedback_submitted_by FOREIGN KEY (submitted_by)
    REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='User feedback, bug reports, and feature requests';

-- ============================================================================
-- STEP 2: Create feedback_responses table
-- ============================================================================
CREATE TABLE IF NOT EXISTS feedback_responses (
  response_id INT NOT NULL AUTO_INCREMENT,
  feedback_id INT NOT NULL COMMENT 'Reference to feedback_requests.feedback_id',
  responded_by INT NOT NULL COMMENT 'User who added this response',
  message TEXT NOT NULL COMMENT 'Response/comment text',
  is_internal BOOLEAN DEFAULT FALSE COMMENT 'Internal notes only visible to managers',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (response_id),
  KEY idx_response_feedback (feedback_id),
  KEY idx_response_created (feedback_id, created_at),

  CONSTRAINT fk_response_feedback FOREIGN KEY (feedback_id)
    REFERENCES feedback_requests (feedback_id) ON DELETE CASCADE,
  CONSTRAINT fk_response_user FOREIGN KEY (responded_by)
    REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Responses and comments on feedback requests';

-- ============================================================================
-- VERIFICATION QUERIES (run manually to verify migration)
-- ============================================================================
-- SELECT 'feedback_requests table' as table_name, COUNT(*) as count FROM feedback_requests;
-- SELECT 'feedback_responses table' as table_name, COUNT(*) as count FROM feedback_responses;
-- DESCRIBE feedback_requests;
-- DESCRIBE feedback_responses;

-- ============================================================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================================================
-- DROP TABLE IF EXISTS feedback_responses;
-- DROP TABLE IF EXISTS feedback_requests;
