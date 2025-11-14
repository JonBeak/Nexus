-- Drop unused pricing feature tables
-- These tables were prepared for quantity-based multipliers and volume-based discounts
-- but the features were never implemented in the frontend pricing engine
--
-- Migration: 2025-11-14_drop_unused_pricing_tables.sql
-- Date: Nov 14, 2025
-- Reason: Code cleanup - removing dead/unused features

-- Drop multiplier_ranges table (quantity-based pricing)
DROP TABLE IF EXISTS multiplier_ranges;

-- Drop discount_ranges table (volume-based pricing)
DROP TABLE IF EXISTS discount_ranges;
