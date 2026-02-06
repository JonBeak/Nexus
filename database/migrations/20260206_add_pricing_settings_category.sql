-- Add Pricing Tables settings category
-- This enables the pricing management card on the Settings page

INSERT INTO settings_categories (category_key, display_name, description, icon_name, route_path, display_order, required_role)
VALUES ('pricing', 'Pricing Tables', 'View and edit all pricing rates and configuration', 'DollarSign', '/settings/pricing', 3, 'manager')
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name);
