-- Add task generation tracking to orders table
-- Used to detect when production tasks are stale (order data changed since tasks were generated)

ALTER TABLE orders
ADD COLUMN tasks_generated_at TIMESTAMP NULL COMMENT 'When production tasks were last generated',
ADD COLUMN tasks_data_hash VARCHAR(64) NULL COMMENT 'SHA256 hash of order data when tasks were generated (for staleness detection)',
ADD INDEX idx_tasks_generated (tasks_generated_at);

-- No data migration needed - NULL means tasks not yet generated
