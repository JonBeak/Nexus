-- Migration: QuickBooks Online Integration
-- Date: 2025-10-27
-- Purpose: Add tables for QuickBooks OAuth tokens and entity ID mappings
-- Dependencies: customers table

-- =============================================
-- STEP 1: CREATE QB OAUTH TOKENS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS qb_oauth_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    realm_id VARCHAR(255) UNIQUE NOT NULL COMMENT 'QuickBooks Company Realm ID',
    access_token TEXT NOT NULL COMMENT 'OAuth2 access token for QB API calls',
    refresh_token TEXT NOT NULL COMMENT 'OAuth2 refresh token for renewing access',
    access_token_expires_at DATETIME NOT NULL COMMENT 'When the access token expires',
    refresh_token_expires_at DATETIME NOT NULL COMMENT 'When the refresh token expires (typically 101 days)',
    id_token TEXT NULL COMMENT 'OpenID Connect identity token (optional)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_realm_id (realm_id),
    INDEX idx_access_token_expires (access_token_expires_at),
    INDEX idx_refresh_token_expires (refresh_token_expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Stores QuickBooks OAuth2 tokens for API authentication';

-- =============================================
-- STEP 2: CREATE QB CUSTOMER ID MAPPING TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS qb_customer_id_mappings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL COMMENT 'Local Nexus customer ID',
    qb_customer_id VARCHAR(255) NOT NULL COMMENT 'QuickBooks customer ID',
    qb_customer_name VARCHAR(255) NOT NULL COMMENT 'Display name in QuickBooks',
    sync_token VARCHAR(50) NULL COMMENT 'QB sync token for updates',
    last_synced_at TIMESTAMP NULL COMMENT 'Last time this mapping was verified',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_customer (customer_id),
    UNIQUE KEY unique_qb_customer (qb_customer_id),
    INDEX idx_qb_customer_name (qb_customer_name),
    CONSTRAINT fk_qb_customer_mapping
        FOREIGN KEY (customer_id)
        REFERENCES customers(customer_id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Maps local customers to QuickBooks customer IDs';

-- =============================================
-- STEP 3: CREATE QB TAX CODE MAPPING TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS qb_tax_code_mappings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tax_name VARCHAR(255) NOT NULL COMMENT 'Tax code name (e.g., "GST", "HST 13%")',
    qb_tax_code_id VARCHAR(255) NOT NULL COMMENT 'QuickBooks tax code ID',
    tax_rate DECIMAL(5,4) NULL COMMENT 'Tax rate for reference (e.g., 0.13 for 13%)',
    last_synced_at TIMESTAMP NULL COMMENT 'Last time this mapping was verified',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_tax_name (tax_name),
    UNIQUE KEY unique_qb_tax_code (qb_tax_code_id),
    INDEX idx_tax_rate (tax_rate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Maps local tax codes to QuickBooks tax code IDs';

-- =============================================
-- STEP 4: CREATE QB ITEM MAPPING TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS qb_item_mappings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_name VARCHAR(255) NOT NULL COMMENT 'Product/service name in Nexus',
    qb_item_id VARCHAR(255) NOT NULL COMMENT 'QuickBooks item/service ID',
    qb_item_type VARCHAR(50) NULL COMMENT 'QB item type: Service, Inventory, NonInventory',
    sync_token VARCHAR(50) NULL COMMENT 'QB sync token for updates',
    last_synced_at TIMESTAMP NULL COMMENT 'Last time this mapping was verified',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_item_name (item_name),
    UNIQUE KEY unique_qb_item (qb_item_id),
    INDEX idx_qb_item_type (qb_item_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Maps local product/service names to QuickBooks item IDs';

-- =============================================
-- STEP 5: CREATE QB SETTINGS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS qb_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL COMMENT 'Setting identifier',
    setting_value TEXT NULL COMMENT 'Setting value',
    description VARCHAR(255) NULL COMMENT 'What this setting controls',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_setting_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='QuickBooks integration settings and configuration';

-- Insert default settings
INSERT INTO qb_settings (setting_key, setting_value, description) VALUES
('default_realm_id', NULL, 'The primary QuickBooks company realm ID'),
('auto_sync_enabled', 'false', 'Enable automatic syncing of customer/item data'),
('estimate_item_prefix', 'SIGN-', 'Prefix for QB item names created from estimates')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Verify tables were created
SELECT
    'qb_oauth_tokens' as table_name,
    COUNT(*) as row_count
FROM qb_oauth_tokens
UNION ALL
SELECT 'qb_customer_id_mappings', COUNT(*) FROM qb_customer_id_mappings
UNION ALL
SELECT 'qb_tax_code_mappings', COUNT(*) FROM qb_tax_code_mappings
UNION ALL
SELECT 'qb_item_mappings', COUNT(*) FROM qb_item_mappings
UNION ALL
SELECT 'qb_settings', COUNT(*) FROM qb_settings;
