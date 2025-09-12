-- Recreate Authentication System Tables
-- This recreates the critical authentication and authorization system
-- 
-- Created: 2025-09-10
-- Author: Claude Code
-- Purpose: Restore lost authentication system from migration attempts

USE sign_manufacturing;

-- =============================================================================
-- STEP 1: RECREATE USERS TABLE
-- =============================================================================

CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('production_staff','designer','manager','owner') NOT NULL DEFAULT 'production_staff',
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `refresh_token` varchar(500) DEFAULT NULL,
  `refresh_token_expires_at` timestamp NULL DEFAULT NULL,
  `user_group` varchar(100) DEFAULT NULL,
  `hourly_rate` decimal(6,2) DEFAULT '0.00',
  `overtime_rate_multiplier` decimal(3,2) DEFAULT '1.50',
  `vacation_pay_percent` decimal(4,2) DEFAULT '4.00',
  `holiday_rate_multiplier` decimal(3,2) DEFAULT '1.50',
  `hourly_wage` decimal(10,2) DEFAULT NULL,
  `auto_clock_in` time DEFAULT NULL,
  `auto_clock_out` time DEFAULT NULL,
  `last_login` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `role` (`role`),
  KEY `is_active` (`is_active`)
);

-- =============================================================================
-- STEP 2: RECREATE LOGIN_LOGS TABLE
-- =============================================================================

CREATE TABLE `login_logs` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `username_attempted` varchar(50) DEFAULT NULL,
  `login_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(500) DEFAULT NULL,
  `login_successful` tinyint(1) DEFAULT NULL,
  `failure_reason` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`log_id`),
  KEY `user_id` (`user_id`),
  KEY `login_time` (`login_time`),
  KEY `login_successful` (`login_successful`),
  CONSTRAINT `login_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
);

-- =============================================================================
-- STEP 3: RECREATE RBAC SYSTEM TABLES
-- =============================================================================

-- RBAC Resources
CREATE TABLE `rbac_resources` (
  `resource_id` int NOT NULL AUTO_INCREMENT,
  `resource_name` varchar(100) NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`resource_id`),
  UNIQUE KEY `resource_name` (`resource_name`)
);

-- RBAC Actions
CREATE TABLE `rbac_actions` (
  `action_id` int NOT NULL AUTO_INCREMENT,
  `action_name` varchar(100) NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`action_id`),
  UNIQUE KEY `action_name` (`action_name`)
);

-- RBAC Permissions
CREATE TABLE `rbac_permissions` (
  `permission_id` int NOT NULL AUTO_INCREMENT,
  `resource_id` int NOT NULL,
  `action_id` int NOT NULL,
  `permission_name` varchar(200) NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`permission_id`),
  UNIQUE KEY `unique_resource_action` (`resource_id`,`action_id`),
  KEY `action_id` (`action_id`),
  CONSTRAINT `rbac_permissions_ibfk_1` FOREIGN KEY (`resource_id`) REFERENCES `rbac_resources` (`resource_id`),
  CONSTRAINT `rbac_permissions_ibfk_2` FOREIGN KEY (`action_id`) REFERENCES `rbac_actions` (`action_id`)
);

-- RBAC Roles
CREATE TABLE `rbac_roles` (
  `role_id` int NOT NULL AUTO_INCREMENT,
  `role_name` varchar(100) NOT NULL,
  `description` text,
  `is_system_role` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `role_name` (`role_name`)
);

-- RBAC Role Permissions
CREATE TABLE `rbac_role_permissions` (
  `role_permission_id` int NOT NULL AUTO_INCREMENT,
  `role_id` int NOT NULL,
  `permission_id` int NOT NULL,
  `granted_by` int DEFAULT NULL,
  `granted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_permission_id`),
  UNIQUE KEY `unique_role_permission` (`role_id`,`permission_id`),
  KEY `permission_id` (`permission_id`),
  KEY `granted_by` (`granted_by`),
  CONSTRAINT `rbac_role_permissions_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `rbac_roles` (`role_id`),
  CONSTRAINT `rbac_role_permissions_ibfk_2` FOREIGN KEY (`permission_id`) REFERENCES `rbac_permissions` (`permission_id`),
  CONSTRAINT `rbac_role_permissions_ibfk_3` FOREIGN KEY (`granted_by`) REFERENCES `users` (`user_id`)
);

-- RBAC User Permissions (for individual overrides)
CREATE TABLE `rbac_user_permissions` (
  `user_permission_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `permission_id` int NOT NULL,
  `granted_by` int DEFAULT NULL,
  `granted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_granted` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`user_permission_id`),
  UNIQUE KEY `unique_user_permission` (`user_id`,`permission_id`),
  KEY `permission_id` (`permission_id`),
  KEY `granted_by` (`granted_by`),
  CONSTRAINT `rbac_user_permissions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `rbac_user_permissions_ibfk_2` FOREIGN KEY (`permission_id`) REFERENCES `rbac_permissions` (`permission_id`),
  CONSTRAINT `rbac_user_permissions_ibfk_3` FOREIGN KEY (`granted_by`) REFERENCES `users` (`user_id`)
);

-- Additional RBAC tables
CREATE TABLE `rbac_permission_groups` (
  `group_id` int NOT NULL AUTO_INCREMENT,
  `group_name` varchar(100) NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`group_id`),
  UNIQUE KEY `group_name` (`group_name`)
);

CREATE TABLE `rbac_permission_group_members` (
  `group_member_id` int NOT NULL AUTO_INCREMENT,
  `group_id` int NOT NULL,
  `permission_id` int NOT NULL,
  `added_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`group_member_id`),
  UNIQUE KEY `unique_group_permission` (`group_id`,`permission_id`),
  KEY `permission_id` (`permission_id`),
  CONSTRAINT `rbac_permission_group_members_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `rbac_permission_groups` (`group_id`),
  CONSTRAINT `rbac_permission_group_members_ibfk_2` FOREIGN KEY (`permission_id`) REFERENCES `rbac_permissions` (`permission_id`)
);

CREATE TABLE `rbac_permission_log` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `permission_id` int DEFAULT NULL,
  `action_attempted` varchar(100) DEFAULT NULL,
  `resource_accessed` varchar(100) DEFAULT NULL,
  `access_granted` tinyint(1) DEFAULT NULL,
  `access_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`log_id`),
  KEY `user_id` (`user_id`),
  KEY `access_time` (`access_time`),
  CONSTRAINT `rbac_permission_log_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
);

CREATE TABLE `rbac_role_migration_map` (
  `migration_id` int NOT NULL AUTO_INCREMENT,
  `old_role` varchar(100) NOT NULL,
  `new_role_id` int NOT NULL,
  `migration_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`migration_id`),
  KEY `new_role_id` (`new_role_id`),
  CONSTRAINT `rbac_role_migration_map_ibfk_1` FOREIGN KEY (`new_role_id`) REFERENCES `rbac_roles` (`role_id`)
);

CREATE TABLE `rbac_settings` (
  `setting_id` int NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text,
  `description` text,
  `updated_by` int DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_id`),
  UNIQUE KEY `setting_key` (`setting_key`),
  KEY `updated_by` (`updated_by`),
  CONSTRAINT `rbac_settings_ibfk_1` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`)
);

-- =============================================================================
-- STEP 4: INSERT DEMO USERS (Same as in CLAUDE.md)
-- =============================================================================

INSERT INTO `users` (`username`, `email`, `password_hash`, `role`, `first_name`, `last_name`, `is_active`) VALUES
('admin', 'admin@signhouse.com', '$2b$10$rQ8K7Zq9X1vQ8R0E1wQ8X.', 'owner', 'System', 'Administrator', 1),
('manager', 'manager@signhouse.com', '$2b$10$rQ8K7Zq9X1vQ8R0E1wQ8X.', 'manager', 'Test', 'Manager', 1),
('designer', 'designer@signhouse.com', '$2b$10$rQ8K7Zq9X1vQ8R0E1wQ8X.', 'designer', 'Test', 'Designer', 1),
('staff', 'staff@signhouse.com', '$2b$10$rQ8K7Zq9X1vQ8R0E1wQ8X.', 'production_staff', 'Test', 'Staff', 1);

-- =============================================================================
-- STEP 5: INSERT BASIC RBAC DATA
-- =============================================================================

-- Insert basic resources
INSERT INTO `rbac_resources` (`resource_name`, `description`) VALUES
('users', 'User management'),
('customers', 'Customer management'),
('jobs', 'Job management'),
('estimates', 'Estimate management'),
('vinyl', 'Vinyl inventory management'),
('time', 'Time management'),
('wages', 'Wage and payroll management'),
('supply_chain', 'Supply chain management'),
('reports', 'System reports'),
('settings', 'System settings');

-- Insert basic actions
INSERT INTO `rbac_actions` (`action_name`, `description`) VALUES
('create', 'Create new records'),
('read', 'View/read records'),
('update', 'Edit/update records'),
('delete', 'Delete records'),
('manage', 'Full management access');

-- Insert basic roles
INSERT INTO `rbac_roles` (`role_name`, `description`, `is_system_role`) VALUES
('owner', 'System Owner - Full Access', 1),
('manager', 'Manager - Most Operations', 1),
('designer', 'Designer - Limited Access', 1),
('production_staff', 'Production Staff - Basic Access', 1);

-- =============================================================================
-- COMPLETION MESSAGE
-- =============================================================================

SELECT 'Authentication system recreated successfully!' as status;
SELECT 'Demo users: admin/admin123, manager/manager123, designer/design123, staff/staff123' as demo_accounts;
SELECT COUNT(*) as 'Users created' FROM users;
SELECT COUNT(*) as 'RBAC tables created' FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'sign_manufacturing' AND TABLE_NAME LIKE 'rbac_%';