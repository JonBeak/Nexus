-- Add version column to order_tasks for optimistic locking (WebSocket sync)
-- This enables conflict detection when multiple users update the same task simultaneously

ALTER TABLE order_tasks
ADD COLUMN version INT NOT NULL DEFAULT 1;

-- Index for efficient version checking during updates
CREATE INDEX idx_order_tasks_version ON order_tasks(task_id, version);
