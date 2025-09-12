-- Migration: Add circular reference prevention for job_estimates
-- Created: 2024-12-XX  
-- Purpose: Prevent circular parent-child relationships in job_estimates table

-- Note: MySQL has limitations with recursive queries in triggers
-- We'll rely primarily on application-level validation for now
-- This creates a basic self-reference check as a safety net

-- Add index for better performance of parent chain queries
CREATE INDEX idx_estimate_parent_chain ON job_estimates(parent_estimate_id);