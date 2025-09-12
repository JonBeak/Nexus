-- Supply Chain RBAC Permissions Setup
-- Manager-only access for supply chain management
-- Created: 2025-01-29

USE sign_manufacturing;

-- Add new resources for supply chain management
INSERT INTO rbac_resources (resource_name, resource_description) VALUES
('supply_chain', 'Supply Chain Management System'),
('material_categories', 'Material Categories Management'),
('product_standards', 'Product Standards/Catalog Management'),
('inventory_unified', 'Unified Inventory Management'),
('shopping_carts', 'Shopping Cart and Ordering System'),
('supplier_orders', 'Supplier Order Management'),
('low_stock_alerts', 'Low Stock Monitoring and Alerts'),
('job_materials', 'Job Material Requirements Management');

-- Add actions for supply chain resources
INSERT INTO rbac_actions (action_name, action_description) VALUES
('view_supply_chain', 'View supply chain dashboard'),
('manage_categories', 'Create, edit, delete material categories'),
('manage_category_fields', 'Configure dynamic fields for categories'),
('view_product_standards', 'View product catalog/standards'),
('manage_product_standards', 'Create, edit, delete product standards'),
('view_unified_inventory', 'View unified inventory across all categories'),
('manage_unified_inventory', 'Add, edit, delete inventory items'),
('allocate_inventory', 'Reserve inventory for jobs'),
('view_shopping_carts', 'View shopping carts'),
('manage_shopping_carts', 'Create, edit, delete shopping cart items'),
('place_orders', 'Place orders with suppliers via email'),
('view_supplier_orders', 'View supplier orders and tracking'),
('manage_supplier_orders', 'Create, edit, cancel supplier orders'),
('receive_orders', 'Process order receipts and update inventory'),
('view_low_stock', 'View low stock alerts dashboard'),
('configure_reorder_points', 'Set reorder points and quantities'),
('view_job_materials', 'View job material requirements'),
('manage_job_materials', 'Add, edit, delete job material requirements'),
('check_material_availability', 'Check material availability for jobs');

-- Create permission groups for supply chain
INSERT INTO rbac_permission_groups (group_name, group_description) VALUES
('supply_chain_manager', 'Full supply chain management access'),
('supply_chain_viewer', 'Read-only supply chain access'),
('inventory_operator', 'Inventory operations (add/edit inventory, allocations)');

-- Assign permissions to manager role for full access
-- Get the manager role ID
SET @manager_role_id = (SELECT role_id FROM rbac_roles WHERE role_name = 'manager');
SET @owner_role_id = (SELECT role_id FROM rbac_roles WHERE role_name = 'owner');

-- Supply chain permissions for managers
INSERT INTO rbac_role_permissions (role_id, resource_id, action_id) 
SELECT @manager_role_id, r.resource_id, a.action_id 
FROM rbac_resources r 
CROSS JOIN rbac_actions a 
WHERE r.resource_name IN ('supply_chain', 'material_categories', 'product_standards', 'inventory_unified', 'shopping_carts', 'supplier_orders', 'low_stock_alerts', 'job_materials')
AND a.action_name IN ('view_supply_chain', 'manage_categories', 'manage_category_fields', 'view_product_standards', 'manage_product_standards', 'view_unified_inventory', 'manage_unified_inventory', 'allocate_inventory', 'view_shopping_carts', 'manage_shopping_carts', 'place_orders', 'view_supplier_orders', 'manage_supplier_orders', 'receive_orders', 'view_low_stock', 'configure_reorder_points', 'view_job_materials', 'manage_job_materials', 'check_material_availability');

-- Supply chain permissions for owners (same as managers)
INSERT INTO rbac_role_permissions (role_id, resource_id, action_id) 
SELECT @owner_role_id, r.resource_id, a.action_id 
FROM rbac_resources r 
CROSS JOIN rbac_actions a 
WHERE r.resource_name IN ('supply_chain', 'material_categories', 'product_standards', 'inventory_unified', 'shopping_carts', 'supplier_orders', 'low_stock_alerts', 'job_materials')
AND a.action_name IN ('view_supply_chain', 'manage_categories', 'manage_category_fields', 'view_product_standards', 'manage_product_standards', 'view_unified_inventory', 'manage_unified_inventory', 'allocate_inventory', 'view_shopping_carts', 'manage_shopping_carts', 'place_orders', 'view_supplier_orders', 'manage_supplier_orders', 'receive_orders', 'view_low_stock', 'configure_reorder_points', 'view_job_materials', 'manage_job_materials', 'check_material_availability');

-- Verify permissions were created
SELECT 
    r.role_name,
    res.resource_name,
    a.action_name
FROM rbac_role_permissions rp
JOIN rbac_roles r ON rp.role_id = r.role_id
JOIN rbac_resources res ON rp.resource_id = res.resource_id  
JOIN rbac_actions a ON rp.action_id = a.action_id
WHERE res.resource_name LIKE '%supply%' OR res.resource_name LIKE '%material%' OR res.resource_name LIKE '%inventory%'
ORDER BY r.role_name, res.resource_name, a.action_name;