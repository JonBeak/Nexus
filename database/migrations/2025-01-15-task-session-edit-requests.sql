-- Task Session Edit Requests Migration
-- Created: 2025-01-15
-- Purpose: Allow staff to request edits to their task sessions (like time edit requests)

-- Create the edit requests table
CREATE TABLE IF NOT EXISTS task_session_edit_requests (
  request_id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  user_id INT NOT NULL,
  requested_started_at DATETIME DEFAULT NULL,
  requested_ended_at DATETIME DEFAULT NULL,
  requested_notes TEXT DEFAULT NULL,
  reason TEXT NOT NULL,
  request_type ENUM('edit', 'delete') DEFAULT 'edit',
  status ENUM('pending', 'approved', 'rejected', 'modified', 'cancelled') DEFAULT 'pending',
  reviewed_by INT DEFAULT NULL,
  reviewed_at DATETIME DEFAULT NULL,
  reviewer_notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Foreign keys
  CONSTRAINT fk_session_edit_session FOREIGN KEY (session_id) REFERENCES task_sessions(session_id) ON DELETE CASCADE,
  CONSTRAINT fk_session_edit_user FOREIGN KEY (user_id) REFERENCES users(user_id),
  CONSTRAINT fk_session_edit_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(user_id),

  -- Indexes for common queries
  INDEX idx_session_edit_status (status),
  INDEX idx_session_edit_user (user_id),
  INDEX idx_session_edit_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
