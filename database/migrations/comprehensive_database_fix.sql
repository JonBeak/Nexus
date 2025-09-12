-- Comprehensive Database Fix Script
-- Fixes all schema modularization issues and restores authentication system
-- 
-- Created: 2025-09-10
-- Author: Claude Code
-- Purpose: Move users back, recreate missing tables, fix cross-schema references

-- =============================================================================
-- STEP 1: MOVE USERS AND AUDIT_TRAIL BACK TO SIGN_MANUFACTURING
-- =============================================================================

USE sign_manufacturing;

-- Move users table back to main schema
RENAME TABLE core.users TO sign_manufacturing.users;

-- Move audit_trail back to main schema  
RENAME TABLE core.audit_trail TO sign_manufacturing.audit_trail;

-- =============================================================================
-- STEP 2: RECREATE MISSING LOGIN_LOGS TABLE
-- =============================================================================

CREATE TABLE `login_logs` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `username_attempted` varchar(50) DEFAULT NULL,
  `login_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(500) DEFAULT NULL,
  `login_successful` tinyint(1) DEFAULT '1',
  `failure_reason` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`log_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_login_time` (`login_time`),
  KEY `idx_login_successful` (`login_successful`),
  CONSTRAINT `fk_login_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
);

-- =============================================================================
-- STEP 3: RECREATE RBAC SYSTEM TABLES
-- =============================================================================

-- RBAC Resources (what can be accessed)
CREATE TABLE `rbac_resources` (
  `resource_id` int NOT NULL AUTO_INCREMENT,
  `resource_name` varchar(100) NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`resource_id`),
  UNIQUE KEY `uk_resource_name` (`resource_name`)
);

-- RBAC Actions (what can be done)
CREATE TABLE `rbac_actions` (
  `action_id` int NOT NULL AUTO_INCREMENT,
  `action_name` varchar(100) NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`action_id`),
  UNIQUE KEY `uk_action_name` (`action_name`)
);

-- RBAC Permissions (resource + action combinations)
CREATE TABLE `rbac_permissions` (
  `permission_id` int NOT NULL AUTO_INCREMENT,
  `resource_id` int NOT NULL,
  `action_id` int NOT NULL,
  `permission_name` varchar(200) NOT NULL,
  `permission_description` text,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`permission_id`),
  UNIQUE KEY `uk_resource_action` (`resource_id`,`action_id`),
  UNIQUE KEY `uk_permission_name` (`permission_name`),
  KEY `idx_resource_id` (`resource_id`),
  KEY `idx_action_id` (`action_id`),
  CONSTRAINT `fk_permissions_resource` FOREIGN KEY (`resource_id`) REFERENCES `rbac_resources` (`resource_id`),
  CONSTRAINT `fk_permissions_action` FOREIGN KEY (`action_id`) REFERENCES `rbac_actions` (`action_id`)
);

-- RBAC Roles (groups of permissions)
CREATE TABLE `rbac_roles` (
  `role_id` int NOT NULL AUTO_INCREMENT,
  `role_name` varchar(100) NOT NULL,
  `description` text,
  `is_active` tinyint(1) DEFAULT '1',
  `is_system_role` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `uk_role_name` (`role_name`),
  KEY `idx_is_active` (`is_active`)
);

-- RBAC Role Permissions (which permissions each role has)
CREATE TABLE `rbac_role_permissions` (
  `role_permission_id` int NOT NULL AUTO_INCREMENT,
  `role_id` int NOT NULL,
  `permission_id` int NOT NULL,
  `granted_by` int DEFAULT NULL,
  `granted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_permission_id`),
  UNIQUE KEY `uk_role_permission` (`role_id`,`permission_id`),
  KEY `idx_role_id` (`role_id`),
  KEY `idx_permission_id` (`permission_id`),
  KEY `idx_granted_by` (`granted_by`),
  CONSTRAINT `fk_role_permissions_role` FOREIGN KEY (`role_id`) REFERENCES `rbac_roles` (`role_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_role_permissions_permission` FOREIGN KEY (`permission_id`) REFERENCES `rbac_permissions` (`permission_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_role_permissions_granted_by` FOREIGN KEY (`granted_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
);

-- RBAC User Permissions (individual user overrides)
CREATE TABLE `rbac_user_permissions` (
  `user_permission_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `permission_id` int NOT NULL,
  `access_type` enum('grant','deny') NOT NULL DEFAULT 'grant',
  `granted_by` int DEFAULT NULL,
  `granted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NULL DEFAULT NULL,
  `reason` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`user_permission_id`),
  UNIQUE KEY `uk_user_permission` (`user_id`,`permission_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_permission_id` (`permission_id`),
  KEY `idx_granted_by` (`granted_by`),
  KEY `idx_expires_at` (`expires_at`),
  CONSTRAINT `fk_user_permissions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_permissions_permission` FOREIGN KEY (`permission_id`) REFERENCES `rbac_permissions` (`permission_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_permissions_granted_by` FOREIGN KEY (`granted_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
);

-- RBAC Permission Groups (for organizing permissions)
CREATE TABLE `rbac_permission_groups` (
  `group_id` int NOT NULL AUTO_INCREMENT,
  `group_name` varchar(100) NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`group_id`),
  UNIQUE KEY `uk_group_name` (`group_name`)
);

-- RBAC Permission Group Members
CREATE TABLE `rbac_permission_group_members` (
  `group_member_id` int NOT NULL AUTO_INCREMENT,
  `group_id` int NOT NULL,
  `permission_id` int NOT NULL,
  `added_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`group_member_id`),
  UNIQUE KEY `uk_group_permission` (`group_id`,`permission_id`),
  KEY `idx_group_id` (`group_id`),
  KEY `idx_permission_id` (`permission_id`),
  CONSTRAINT `fk_group_members_group` FOREIGN KEY (`group_id`) REFERENCES `rbac_permission_groups` (`group_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_group_members_permission` FOREIGN KEY (`permission_id`) REFERENCES `rbac_permissions` (`permission_id`) ON DELETE CASCADE
);

-- RBAC Permission Log (audit trail)
CREATE TABLE `rbac_permission_log` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `permission_name` varchar(200) DEFAULT NULL,
  `resource_context` varchar(200) DEFAULT NULL,
  `access_granted` tinyint(1) DEFAULT NULL,
  `access_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`log_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_access_time` (`access_time`),
  KEY `idx_access_granted` (`access_granted`),
  CONSTRAINT `fk_permission_log_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
);

-- RBAC Settings (configuration)
CREATE TABLE `rbac_settings` (
  `setting_id` int NOT NULL AUTO_INCREMENT,
  `setting_name` varchar(100) NOT NULL,
  `setting_value` text,
  `description` text,
  `updated_by` int DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_id`),
  UNIQUE KEY `uk_setting_name` (`setting_name`),
  KEY `idx_updated_by` (`updated_by`),
  CONSTRAINT `fk_rbac_settings_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
);

-- RBAC Role Migration Map (for role transitions)
CREATE TABLE `rbac_role_migration_map` (
  `migration_id` int NOT NULL AUTO_INCREMENT,
  `old_role` varchar(100) NOT NULL,
  `new_role_id` int NOT NULL,
  `migration_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`migration_id`),
  KEY `idx_old_role` (`old_role`),
  KEY `idx_new_role_id` (`new_role_id`),
  CONSTRAINT `fk_role_migration_new_role` FOREIGN KEY (`new_role_id`) REFERENCES `rbac_roles` (`role_id`)
);

-- =============================================================================
-- STEP 4: POPULATE RBAC SYSTEM WITH BASIC DATA
-- =============================================================================

-- Insert basic resources
INSERT INTO `rbac_resources` (`resource_name`, `description`) VALUES
('users', 'User management and authentication'),
('customers', 'Customer and address management'),
('jobs', 'Job and estimate management'),
('estimates', 'Estimate creation and pricing'),
('vinyl', 'Vinyl inventory management'),
('time', 'Time tracking and scheduling'),
('wages', 'Wage and payroll management'),
('supply_chain', 'Supply chain and supplier management'),
('reports', 'System reports and analytics'),
('settings', 'System configuration and settings');

-- Insert basic actions
INSERT INTO `rbac_actions` (`action_name`, `description`) VALUES
('create', 'Create new records'),
('read', 'View and read records'),
('update', 'Edit and update records'),
('delete', 'Delete records'),
('manage', 'Full management access'),
('approve', 'Approve requests and changes'),
('export', 'Export data and reports'),
('import', 'Import data and files');

-- Insert basic roles matching user.role enum
INSERT INTO `rbac_roles` (`role_name`, `description`, `is_system_role`) VALUES
('owner', 'System Owner - Full Access', 1),
('manager', 'Manager - Most Operations', 1),
('designer', 'Designer - Limited Access', 1),
('production_staff', 'Production Staff - Basic Access', 1);

-- Insert basic permissions (resource.action format)
INSERT INTO `rbac_permissions` (`resource_id`, `action_id`, `permission_name`, `permission_description`)
SELECT r.resource_id, a.action_id, CONCAT(r.resource_name, '.', a.action_name), 
       CONCAT(a.description, ' for ', r.description)
FROM rbac_resources r, rbac_actions a
WHERE (r.resource_name, a.action_name) IN (
  ('users', 'read'), ('users', 'manage'),
  ('customers', 'read'), ('customers', 'create'), ('customers', 'update'), ('customers', 'delete'),
  ('jobs', 'read'), ('jobs', 'create'), ('jobs', 'update'), ('jobs', 'delete'),
  ('estimates', 'read'), ('estimates', 'create'), ('estimates', 'update'), ('estimates', 'delete'),
  ('vinyl', 'read'), ('vinyl', 'create'), ('vinyl', 'update'), ('vinyl', 'delete'),
  ('time', 'read'), ('time', 'create'), ('time', 'update'), ('time', 'approve'),
  ('wages', 'read'), ('wages', 'manage'),
  ('supply_chain', 'read'), ('supply_chain', 'create'), ('supply_chain', 'update'), ('supply_chain', 'delete'),
  ('reports', 'read'), ('reports', 'export'),
  ('settings', 'read'), ('settings', 'update')
);

-- Insert basic role permissions
-- Owner gets all permissions
INSERT INTO `rbac_role_permissions` (`role_id`, `permission_id`)
SELECT r.role_id, p.permission_id
FROM rbac_roles r, rbac_permissions p
WHERE r.role_name = 'owner';

-- Manager gets most permissions (exclude users.manage, wages.manage)
INSERT INTO `rbac_role_permissions` (`role_id`, `permission_id`)
SELECT r.role_id, p.permission_id
FROM rbac_roles r, rbac_permissions p
WHERE r.role_name = 'manager' 
  AND p.permission_name NOT IN ('users.manage', 'wages.manage', 'wages.read');

-- Designer gets limited permissions
INSERT INTO `rbac_role_permissions` (`role_id`, `permission_id`)
SELECT r.role_id, p.permission_id
FROM rbac_roles r, rbac_permissions p
WHERE r.role_name = 'designer'
  AND p.permission_name IN (
    'customers.read', 'customers.create', 'customers.update',
    'jobs.read', 'jobs.create', 'jobs.update',
    'estimates.read', 'estimates.create', 'estimates.update',
    'vinyl.read', 
    'time.read', 'time.create', 'time.update',
    'reports.read'
  );

-- Production Staff gets basic permissions
INSERT INTO `rbac_role_permissions` (`role_id`, `permission_id`)
SELECT r.role_id, p.permission_id
FROM rbac_roles r, rbac_permissions p
WHERE r.role_name = 'production_staff'
  AND p.permission_name IN (
    'customers.read',
    'jobs.read',
    'vinyl.read', 'vinyl.update',
    'time.read', 'time.create', 'time.update'
  );

-- Insert basic RBAC settings
INSERT INTO `rbac_settings` (`setting_name`, `setting_value`, `description`) VALUES
('rbac_enabled', 'true', 'Enable RBAC permission system'),
('log_permission_checks', 'false', 'Log all permission checks for audit'),
('cache_permissions', 'true', 'Cache user permissions for performance'),
('permission_cache_ttl', '3600', 'Permission cache TTL in seconds');

-- =============================================================================
-- STEP 5: DROP THE EMPTY CORE SCHEMA
-- =============================================================================

DROP SCHEMA IF EXISTS core;

-- =============================================================================
-- COMPLETION MESSAGE
-- =============================================================================

SELECT 'Database fix completed successfully!' as status;
SELECT 'Users moved back to sign_manufacturing' as users_status;
SELECT 'login_logs table created' as login_logs_status;
SELECT 'RBAC system fully recreated' as rbac_status;
SELECT COUNT(*) as 'Total users' FROM users;
SELECT COUNT(*) as 'Total permissions created' FROM rbac_permissions;
SELECT COUNT(*) as 'Total role permissions assigned' FROM rbac_role_permissions;