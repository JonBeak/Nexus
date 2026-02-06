-- Add high_standards flag to customers table
-- Allows flagging customers that require extra attention to quality
ALTER TABLE customers ADD COLUMN high_standards TINYINT(1) NOT NULL DEFAULT 0 AFTER active;
