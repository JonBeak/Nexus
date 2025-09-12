-- =====================================================
-- RBAC (Role-Based Access Control) Schema for SignHouse
-- Non-hierarchical, flexible permission system
-- =====================================================

-- 1. RESOURCES TABLE
-- Defines what can be protected (customers, addresses, time_tracking, etc.)
CREATE TABLE rbac_resources (
    resource_id INT AUTO_INCREMENT PRIMARY KEY,
    resource_name VARCHAR(50) NOT NULL UNIQUE,
    resource_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_resource_name (resource_name)
);

-- 2. ACTIONS TABLE  
-- Defines what can be done (create, read, update, delete, export, approve, etc.)
CREATE TABLE rbac_actions (
    action_id INT AUTO_INCREMENT PRIMARY KEY,
    action_name VARCHAR(50) NOT NULL UNIQUE,
    action_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_action_name (action_name)
);

-- 3. PERMISSIONS TABLE
-- Combines resources + actions into specific permissions
CREATE TABLE rbac_permissions (
    permission_id INT AUTO_INCREMENT PRIMARY KEY,
    resource_id INT NOT NULL,
    action_id INT NOT NULL,
    permission_name VARCHAR(100) NOT NULL UNIQUE, -- 'customers.delete', 'time_tracking.export'
    permission_description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (resource_id) REFERENCES rbac_resources(resource_id) ON DELETE CASCADE,
    FOREIGN KEY (action_id) REFERENCES rbac_actions(action_id) ON DELETE CASCADE,
    UNIQUE KEY unique_resource_action (resource_id, action_id),
    INDEX idx_permission_name (permission_name),
    INDEX idx_is_active (is_active)
);

-- 4. PERMISSION GROUPS (Optional - for easier management)
-- Bundle related permissions together for easier assignment
CREATE TABLE rbac_permission_groups (
    group_id INT AUTO_INCREMENT PRIMARY KEY,
    group_name VARCHAR(100) NOT NULL UNIQUE,
    group_description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_group_name (group_name)
);

CREATE TABLE rbac_permission_group_members (
    group_id INT NOT NULL,
    permission_id INT NOT NULL,
    PRIMARY KEY (group_id, permission_id),
    FOREIGN KEY (group_id) REFERENCES rbac_permission_groups(group_id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES rbac_permissions(permission_id) ON DELETE CASCADE
);

-- 5. ROLES TABLE (No hierarchy - pure role-based)
CREATE TABLE rbac_roles (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE,
    role_description TEXT,
    color VARCHAR(7) DEFAULT '#6B7280', -- For UI display (hex color)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_role_name (role_name),
    INDEX idx_is_active (is_active)
);

-- 6. ROLE-PERMISSION MAPPING
CREATE TABLE rbac_role_permissions (
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by INT, -- user_id who granted this permission
    notes TEXT, -- Why this permission was granted to this role
    
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES rbac_roles(role_id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES rbac_permissions(permission_id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_role_id (role_id),
    INDEX idx_permission_id (permission_id)
);

-- 7. USER-SPECIFIC PERMISSION OVERRIDES
-- Allows granting/denying specific permissions to individual users
CREATE TABLE rbac_user_permissions (
    user_id INT NOT NULL,
    permission_id INT NOT NULL,
    access_type ENUM('grant', 'deny') NOT NULL DEFAULT 'grant',
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL, -- For temporary permissions
    granted_by INT, -- user_id who granted this permission
    reason TEXT, -- Why was this override needed?
    
    PRIMARY KEY (user_id, permission_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES rbac_permissions(permission_id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_permission_id (permission_id),
    INDEX idx_expires_at (expires_at)
);

-- 8. PERMISSION AUDIT LOG
CREATE TABLE rbac_permission_log (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    permission_name VARCHAR(100) NOT NULL,
    resource_context VARCHAR(255), -- e.g., "customer_id:642", "job_id:123"
    access_granted BOOLEAN NOT NULL,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    endpoint VARCHAR(255), -- Which API endpoint was accessed
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_permission_name (permission_name),
    INDEX idx_attempted_at (attempted_at),
    INDEX idx_access_granted (access_granted),
    INDEX idx_endpoint (endpoint)
);

-- 9. SYSTEM SETTINGS FOR RBAC
CREATE TABLE rbac_settings (
    setting_name VARCHAR(100) PRIMARY KEY,
    setting_value TEXT,
    setting_description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by INT,
    
    FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- 10. MIGRATION HELPER - Maps old enum roles to new role system
CREATE TABLE rbac_role_migration_map (
    old_role_enum VARCHAR(50) NOT NULL,
    new_role_id INT NOT NULL,
    migrated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (old_role_enum),
    FOREIGN KEY (new_role_id) REFERENCES rbac_roles(role_id) ON DELETE CASCADE
);