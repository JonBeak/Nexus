-- Migration: Clean up redundant tax overrides
-- Date: 2025-10-07
-- Description: Remove tax_override_percent and tax_override_reason from customer_addresses
--              where the override matches the province's default tax rate.
--              This is redundant - when override matches province default, we should let it
--              default to the province tax instead of storing an explicit override.

-- =============================================================================
-- STEP 1: IDENTIFY REDUNDANT OVERRIDES
-- =============================================================================
-- Show addresses where tax_override_percent matches the province's default tax rate

SELECT
    ca.address_id,
    ca.customer_id,
    ca.province_state_short,
    pt.tax_name,
    tr.tax_percent as province_tax,
    ca.tax_override_percent,
    ca.tax_override_reason,
    CONCAT('Address ID ', ca.address_id, ' has redundant override: ', ca.tax_override_percent, '% matches province default') as description
FROM customer_addresses ca
JOIN provinces_tax pt ON ca.province_state_short = pt.province_short AND pt.is_active = 1
JOIN tax_rules tr ON pt.tax_name = tr.tax_name AND tr.is_active = 1
WHERE ca.tax_override_percent IS NOT NULL
    AND ca.tax_override_percent = tr.tax_percent
    AND ca.is_active = 1
ORDER BY ca.address_id;

-- Show count of redundant overrides
SELECT COUNT(*) as redundant_override_count
FROM customer_addresses ca
JOIN provinces_tax pt ON ca.province_state_short = pt.province_short AND pt.is_active = 1
JOIN tax_rules tr ON pt.tax_name = tr.tax_name AND tr.is_active = 1
WHERE ca.tax_override_percent IS NOT NULL
    AND ca.tax_override_percent = tr.tax_percent
    AND ca.is_active = 1;

-- =============================================================================
-- STEP 2: BACKUP CURRENT STATE
-- =============================================================================
-- Show current state before update for verification

SELECT
    'BEFORE UPDATE' as status,
    COUNT(CASE WHEN tax_override_percent IS NOT NULL THEN 1 END) as addresses_with_override,
    COUNT(CASE WHEN tax_override_percent IS NULL THEN 1 END) as addresses_without_override
FROM customer_addresses
WHERE is_active = 1;

-- =============================================================================
-- STEP 3: UPDATE REDUNDANT OVERRIDES
-- =============================================================================
-- Remove tax overrides where they match the province default

UPDATE customer_addresses ca
JOIN provinces_tax pt ON ca.province_state_short = pt.province_short AND pt.is_active = 1
JOIN tax_rules tr ON pt.tax_name = tr.tax_name AND tr.is_active = 1
SET
    ca.tax_override_percent = NULL,
    ca.tax_override_reason = NULL
WHERE ca.tax_override_percent IS NOT NULL
    AND ca.tax_override_percent = tr.tax_percent
    AND ca.is_active = 1;

-- =============================================================================
-- STEP 4: VALIDATION
-- =============================================================================
-- Show updated state

SELECT
    'AFTER UPDATE' as status,
    COUNT(CASE WHEN tax_override_percent IS NOT NULL THEN 1 END) as addresses_with_override,
    COUNT(CASE WHEN tax_override_percent IS NULL THEN 1 END) as addresses_without_override
FROM customer_addresses
WHERE is_active = 1;

-- Verify no redundant overrides remain
SELECT
    CASE
        WHEN COUNT(*) = 0 THEN 'SUCCESS: All redundant overrides cleaned up'
        ELSE CONCAT('WARNING: ', COUNT(*), ' redundant overrides still exist')
    END as validation_result
FROM customer_addresses ca
JOIN provinces_tax pt ON ca.province_state_short = pt.province_short AND pt.is_active = 1
JOIN tax_rules tr ON pt.tax_name = tr.tax_name AND tr.is_active = 1
WHERE ca.tax_override_percent IS NOT NULL
    AND ca.tax_override_percent = tr.tax_percent
    AND ca.is_active = 1;

-- Show remaining overrides (should only be legitimate overrides that differ from province defaults)
SELECT
    ca.address_id,
    ca.customer_id,
    ca.province_state_short,
    pt.tax_name,
    tr.tax_percent as province_tax,
    ca.tax_override_percent,
    ca.tax_override_reason,
    (ca.tax_override_percent - tr.tax_percent) as difference
FROM customer_addresses ca
JOIN provinces_tax pt ON ca.province_state_short = pt.province_short AND pt.is_active = 1
JOIN tax_rules tr ON pt.tax_name = tr.tax_name AND tr.is_active = 1
WHERE ca.tax_override_percent IS NOT NULL
    AND ca.is_active = 1
ORDER BY ca.address_id;
