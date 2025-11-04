-- Migration: Add Progress Tracking Fields to order_tasks
-- Date: 2025-11-04
-- Purpose: Support production role assignment, task dependencies, and start/complete tracking

-- Add new columns to order_tasks table
ALTER TABLE order_tasks
ADD COLUMN assigned_role ENUM('designer', 'vinyl_cnc', 'painting', 'cut_bend', 'leds', 'packing') NULL
  COMMENT 'Production role assigned to this task',
ADD COLUMN depends_on_task_id INT NULL
  COMMENT 'Task must complete before this task unlocks (for future use)',
ADD COLUMN started_at TIMESTAMP NULL
  COMMENT 'When task timer started',
ADD COLUMN started_by INT NULL
  COMMENT 'User who started the task';

-- Add foreign key constraints
ALTER TABLE order_tasks
ADD CONSTRAINT fk_order_tasks_depends_on
  FOREIGN KEY (depends_on_task_id) REFERENCES order_tasks(task_id) ON DELETE SET NULL,
ADD CONSTRAINT fk_order_tasks_started_by
  FOREIGN KEY (started_by) REFERENCES users(user_id) ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX idx_order_tasks_assigned_role ON order_tasks(assigned_role);
CREATE INDEX idx_order_tasks_depends_on ON order_tasks(depends_on_task_id);
CREATE INDEX idx_order_tasks_started_at ON order_tasks(started_at);

-- Verify changes
SHOW CREATE TABLE order_tasks;
