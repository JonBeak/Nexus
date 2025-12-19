-- Fix check constraint to allow is_prepared flag
-- The constraint was preventing estimates from being marked as prepared

ALTER TABLE job_estimates 
DROP CONSTRAINT chk_active_has_status;

ALTER TABLE job_estimates 
ADD CONSTRAINT chk_active_has_status CHECK (
  (is_active = false) 
  OR (is_draft = true) 
  OR (is_prepared = true)
  OR (is_sent = true) 
  OR (is_approved = true) 
  OR (is_retracted = true)
);
