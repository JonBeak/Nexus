-- GitHub Integration for Feedback System
-- Created: 2026-02-08
-- Purpose: Add GitHub issue/PR tracking to feedback tickets + rate limiting for Claude requests

-- =============================================================================
-- Add GitHub fields to feedback_requests
-- =============================================================================

ALTER TABLE feedback_requests
  ADD COLUMN github_issue_number INT NULL AFTER closed_at,
  ADD COLUMN github_pr_number INT NULL AFTER github_issue_number,
  ADD COLUMN github_pr_url VARCHAR(500) NULL AFTER github_pr_number,
  ADD COLUMN github_branch VARCHAR(255) NULL AFTER github_pr_url,
  ADD COLUMN pipeline_status ENUM('open', 'claude_working', 'pr_ready', 'merged', 'closed') DEFAULT NULL AFTER github_branch;

-- Index for looking up feedback by GitHub issue number
CREATE INDEX idx_feedback_github_issue ON feedback_requests (github_issue_number);

-- =============================================================================
-- Rate limiting table for Claude/GitHub API requests
-- =============================================================================

CREATE TABLE github_claude_requests (
  request_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  feedback_id INT NOT NULL,
  request_type ENUM('assign', 'comment') NOT NULL DEFAULT 'assign',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (feedback_id) REFERENCES feedback_requests(feedback_id),

  KEY idx_claude_requests_user_time (user_id, created_at),
  KEY idx_claude_requests_time (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
