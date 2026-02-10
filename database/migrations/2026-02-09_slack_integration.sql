-- Slack Integration for Feedback System
-- Adds columns to track Slack thread mapping and GitHub comment polling state
-- Date: 2026-02-09

ALTER TABLE feedback_requests
  ADD COLUMN slack_thread_ts VARCHAR(50) NULL AFTER pipeline_status,
  ADD COLUMN slack_last_polled_at TIMESTAMP NULL AFTER slack_thread_ts,
  ADD COLUMN last_github_comment_id INT NULL AFTER slack_last_polled_at;

CREATE INDEX idx_feedback_slack_thread ON feedback_requests (slack_thread_ts);
CREATE INDEX idx_feedback_active_polling ON feedback_requests (pipeline_status, github_issue_number);
