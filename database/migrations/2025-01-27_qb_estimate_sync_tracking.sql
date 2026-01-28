-- Cash Job Estimate Conflict Resolution
-- Created: 2025-01-27
-- Purpose: Add sync tracking fields to order_qb_estimates for bi-directional sync detection

-- Add sync tracking fields (matching invoice sync pattern)
ALTER TABLE order_qb_estimates
ADD COLUMN qb_estimate_sync_token VARCHAR(50) DEFAULT NULL COMMENT 'QB SyncToken for optimistic locking',
ADD COLUMN qb_estimate_last_updated_time DATETIME DEFAULT NULL COMMENT 'LastUpdatedTime from QB MetaData',
ADD COLUMN qb_estimate_content_hash VARCHAR(64) DEFAULT NULL COMMENT 'Hash of QB estimate line items',
ADD COLUMN qb_estimate_synced_at DATETIME DEFAULT NULL COMMENT 'When we last synced with QB';

-- Index for sync status lookups
CREATE INDEX idx_qb_estimate_sync ON order_qb_estimates (qb_estimate_sync_token);
