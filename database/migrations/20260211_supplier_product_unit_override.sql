-- Migration: Add unit_of_measure override to supplier_products
-- Purpose: Allow supplier products to override the product type's default unit
-- Example: A product type "Rivets" defaults to "each" but a specific supplier sells them in "bag"
-- When NULL, the archetype's unit_of_measure is used (existing behavior)

ALTER TABLE supplier_products
  ADD COLUMN unit_of_measure VARCHAR(50) DEFAULT NULL
  COMMENT 'Optional override for archetype unit_of_measure. NULL = use archetype default.'
  AFTER lead_time_days;
