-- =====================================================
-- RBAC Seed Data for SignHouse
-- Populates the permission system with current business logic
-- =====================================================

-- 1. INSERT RESOURCES
INSERT INTO rbac_resources (resource_name, resource_description) VALUES
('customers', 'Customer records and information'),
('customer_addresses', 'Customer address information'),
('accounts', 'User account management'),
('time_tracking', 'Time tracking and timesheet management'),
('time_management', 'Time management and scheduling'),
('suppliers', 'Supplier and vendor management'),
('vinyl', 'Vinyl inventory and products'),
('vinyl_products', 'Vinyl product catalog'),
('jobs', 'Job and project management'),
('wages', 'Wage and payroll information'),
('auth', 'Authentication and session management'),
('system', 'System administration and settings');

-- 2. INSERT ACTIONS
INSERT INTO rbac_actions (action_name, action_description) VALUES
('create', 'Create new records'),
('read', 'View and read records'),
('update', 'Modify existing records'),
('delete', 'Remove records'),
('list', 'List multiple records'),
('export', 'Export data'),
('import', 'Import data'),
('approve', 'Approve requests or changes'),
('reject', 'Reject requests or changes'),
('activate', 'Activate records'),
('deactivate', 'Deactivate records'),
('manage_users', 'Manage user accounts'),
('view_reports', 'Access reporting features'),
('admin', 'Full administrative access');

-- 3. INSERT PERMISSIONS (Resource + Action combinations)
INSERT INTO rbac_permissions (resource_id, action_id, permission_name, permission_description)
SELECT r.resource_id, a.action_id, 
       CONCAT(r.resource_name, '.', a.action_name),
       CONCAT(a.action_description, ' for ', r.resource_description)
FROM rbac_resources r 
CROSS JOIN rbac_actions a
WHERE 
    -- Customer permissions
    (r.resource_name = 'customers' AND a.action_name IN ('create', 'read', 'update', 'delete', 'list', 'activate', 'deactivate')) OR
    (r.resource_name = 'customer_addresses' AND a.action_name IN ('create', 'read', 'update', 'delete', 'list')) OR
    
    -- Account management permissions  
    (r.resource_name = 'accounts' AND a.action_name IN ('create', 'read', 'update', 'delete', 'list', 'manage_users')) OR
    
    -- Time tracking permissions
    (r.resource_name = 'time_tracking' AND a.action_name IN ('create', 'read', 'update', 'delete', 'list', 'export', 'approve', 'reject')) OR
    (r.resource_name = 'time_management' AND a.action_name IN ('read', 'update', 'list', 'view_reports')) OR
    
    -- Supplier permissions
    (r.resource_name = 'suppliers' AND a.action_name IN ('create', 'read', 'update', 'delete', 'list')) OR
    
    -- Vinyl/Inventory permissions
    (r.resource_name = 'vinyl' AND a.action_name IN ('create', 'read', 'update', 'delete', 'list', 'import', 'export')) OR
    (r.resource_name = 'vinyl_products' AND a.action_name IN ('create', 'read', 'update', 'delete', 'list')) OR
    
    -- Job management permissions
    (r.resource_name = 'jobs' AND a.action_name IN ('create', 'read', 'update', 'delete', 'list')) OR
    
    -- Wage/Payroll permissions
    (r.resource_name = 'wages' AND a.action_name IN ('read', 'update', 'list', 'view_reports')) OR
    
    -- System permissions
    (r.resource_name = 'auth' AND a.action_name IN ('manage_users')) OR
    (r.resource_name = 'system' AND a.action_name IN ('admin', 'view_reports'));

-- 4. INSERT ROLES (Based on current enum roles)
INSERT INTO rbac_roles (role_name, role_description, color) VALUES
('production_staff', 'Production floor workers - basic time tracking and job access', '#10B981'),
('designer', 'Design team members - customer design preferences and project details', '#3B82F6'), 
('manager', 'Department managers - full operational access except system admin', '#F59E0B'),
('owner', 'Business owners - full system access including admin functions', '#DC2626');

-- 5. PERMISSION GROUPS (for easier management)
INSERT INTO rbac_permission_groups (group_name, group_description) VALUES
('basic_time_tracking', 'Basic time clock in/out functionality'),
('customer_management', 'Full customer and address management'),
('financial_access', 'Access to wages and financial information'),
('inventory_management', 'Vinyl and product inventory management'),
('user_administration', 'User account and system administration'),
('reporting_access', 'Access to reports and analytics'),
('job_management', 'Job and project management capabilities');

-- 6. ASSIGN PERMISSIONS TO GROUPS
-- Basic time tracking group
INSERT INTO rbac_permission_group_members (group_id, permission_id)
SELECT g.group_id, p.permission_id 
FROM rbac_permission_groups g, rbac_permissions p 
WHERE g.group_name = 'basic_time_tracking' 
AND p.permission_name IN ('time_tracking.create', 'time_tracking.read', 'time_tracking.update');

-- Customer management group  
INSERT INTO rbac_permission_group_members (group_id, permission_id)
SELECT g.group_id, p.permission_id 
FROM rbac_permission_groups g, rbac_permissions p 
WHERE g.group_name = 'customer_management' 
AND p.permission_name LIKE 'customer%';

-- Financial access group
INSERT INTO rbac_permission_group_members (group_id, permission_id)
SELECT g.group_id, p.permission_id 
FROM rbac_permission_groups g, rbac_permissions p 
WHERE g.group_name = 'financial_access' 
AND p.permission_name LIKE 'wages%';

-- 7. ASSIGN PERMISSIONS TO ROLES (Based on current authorization logic)

-- PRODUCTION STAFF: Basic permissions
INSERT INTO rbac_role_permissions (role_id, permission_id, notes)
SELECT r.role_id, p.permission_id, 'Basic production staff permissions'
FROM rbac_roles r, rbac_permissions p 
WHERE r.role_name = 'production_staff'
AND p.permission_name IN (
    'time_tracking.create',
    'time_tracking.read', 
    'time_tracking.update',
    'jobs.read',
    'jobs.list'
);

-- DESIGNER: Customer design access + basic permissions
INSERT INTO rbac_role_permissions (role_id, permission_id, notes)
SELECT r.role_id, p.permission_id, 'Designer permissions - customer access and design functions'
FROM rbac_roles r, rbac_permissions p 
WHERE r.role_name = 'designer'
AND p.permission_name IN (
    -- Time tracking
    'time_tracking.create', 'time_tracking.read', 'time_tracking.update',
    -- Customer access (not create/delete)
    'customers.read', 'customers.list', 'customers.update',
    'customer_addresses.read', 'customer_addresses.list', 'customer_addresses.create', 'customer_addresses.update',
    -- Job access
    'jobs.create', 'jobs.read', 'jobs.update', 'jobs.list',
    -- Vinyl/product access
    'vinyl.read', 'vinyl.list', 'vinyl_products.read', 'vinyl_products.list'
);

-- MANAGER: Full operational access (current manager permissions)
INSERT INTO rbac_role_permissions (role_id, permission_id, notes)  
SELECT r.role_id, p.permission_id, 'Manager permissions - full operational access'
FROM rbac_roles r, rbac_permissions p 
WHERE r.role_name = 'manager'
AND p.permission_name IN (
    -- Full customer management
    'customers.create', 'customers.read', 'customers.update', 'customers.delete', 'customers.list', 'customers.activate', 'customers.deactivate',
    'customer_addresses.create', 'customer_addresses.read', 'customer_addresses.update', 'customer_addresses.delete', 'customer_addresses.list',
    -- Full time management
    'time_tracking.create', 'time_tracking.read', 'time_tracking.update', 'time_tracking.delete', 'time_tracking.list', 'time_tracking.export', 'time_tracking.approve', 'time_tracking.reject',
    'time_management.read', 'time_management.update', 'time_management.list', 'time_management.view_reports',
    -- Supplier management
    'suppliers.create', 'suppliers.read', 'suppliers.update', 'suppliers.delete', 'suppliers.list',
    -- Inventory management
    'vinyl.create', 'vinyl.read', 'vinyl.update', 'vinyl.delete', 'vinyl.list', 'vinyl.import', 'vinyl.export',
    'vinyl_products.create', 'vinyl_products.read', 'vinyl_products.update', 'vinyl_products.delete', 'vinyl_products.list',
    -- Job management
    'jobs.create', 'jobs.read', 'jobs.update', 'jobs.delete', 'jobs.list',
    -- Financial access
    'wages.read', 'wages.update', 'wages.list', 'wages.view_reports'
);

-- OWNER: All permissions (inherits everything + admin functions)
INSERT INTO rbac_role_permissions (role_id, permission_id, notes)
SELECT r.role_id, p.permission_id, 'Owner permissions - full system access'
FROM rbac_roles r, rbac_permissions p 
WHERE r.role_name = 'owner';

-- 8. MIGRATION MAPPING (for backward compatibility)
INSERT INTO rbac_role_migration_map (old_role_enum, new_role_id)
SELECT old_enum.role_name, new_role.role_id
FROM (
    SELECT 'production_staff' as role_name UNION ALL
    SELECT 'designer' UNION ALL  
    SELECT 'manager' UNION ALL
    SELECT 'owner'
) old_enum
JOIN rbac_roles new_role ON old_enum.role_name = new_role.role_name;

-- 9. INITIAL RBAC SETTINGS
INSERT INTO rbac_settings (setting_name, setting_value, setting_description) VALUES
('rbac_enabled', 'false', 'Enable RBAC system (set to true after migration)'),
('cache_permissions', 'true', 'Cache user permissions for performance'),
('log_permission_checks', 'true', 'Log all permission checks for audit'),
('permission_cache_ttl', '3600', 'Permission cache TTL in seconds (1 hour)'),
('require_permission_reason', 'false', 'Require reason when granting user-specific permissions');