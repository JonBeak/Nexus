-- Migration: Create Supplier Orders Tables
-- Created: 2026-02-02
-- Purpose: Track supplier orders and link them to material requirements

-- Supplier Orders - Header table for purchase orders to suppliers
CREATE TABLE IF NOT EXISTS supplier_orders (
    order_id INT NOT NULL AUTO_INCREMENT,
    order_number VARCHAR(50) NOT NULL COMMENT 'Auto-generated PO number (e.g., PO-2026-0001)',
    supplier_id INT NOT NULL,

    -- Status tracking
    status ENUM('draft', 'submitted', 'acknowledged', 'partial_received', 'delivered', 'cancelled') NOT NULL DEFAULT 'draft',

    -- Dates
    order_date DATE NULL COMMENT 'Date order was submitted to supplier',
    expected_delivery_date DATE NULL,
    actual_delivery_date DATE NULL,

    -- Totals (calculated from line items)
    subtotal DECIMAL(12, 2) DEFAULT 0.00,
    tax_amount DECIMAL(12, 2) DEFAULT 0.00,
    shipping_cost DECIMAL(12, 2) DEFAULT 0.00,
    total_amount DECIMAL(12, 2) DEFAULT 0.00,

    -- Delivery method
    delivery_method ENUM('shipping', 'pickup') DEFAULT 'shipping',
    shipping_address TEXT NULL COMMENT 'Our receiving address if shipping',

    -- Reference and notes
    supplier_reference VARCHAR(100) NULL COMMENT 'Supplier confirmation/reference number',
    notes TEXT NULL,
    internal_notes TEXT NULL COMMENT 'Notes visible only to staff',

    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by INT NULL,
    submitted_by INT NULL,
    submitted_at TIMESTAMP NULL,

    PRIMARY KEY (order_id),
    UNIQUE KEY uk_order_number (order_number),
    KEY idx_supplier_id (supplier_id),
    KEY idx_status (status),
    KEY idx_order_date (order_date),
    KEY idx_expected_delivery (expected_delivery_date),

    CONSTRAINT fk_supplier_orders_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id),
    CONSTRAINT fk_supplier_orders_created_by FOREIGN KEY (created_by) REFERENCES users(user_id),
    CONSTRAINT fk_supplier_orders_updated_by FOREIGN KEY (updated_by) REFERENCES users(user_id),
    CONSTRAINT fk_supplier_orders_submitted_by FOREIGN KEY (submitted_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Supplier Order Items - Line items for each order
CREATE TABLE IF NOT EXISTS supplier_order_items (
    item_id INT NOT NULL AUTO_INCREMENT,
    order_id INT NOT NULL,

    -- Product identification
    supplier_product_id INT NULL COMMENT 'If ordering a tracked supplier product',
    product_description VARCHAR(500) NOT NULL COMMENT 'Product name/description',
    sku VARCHAR(100) NULL,

    -- Quantities
    quantity_ordered DECIMAL(10, 2) NOT NULL,
    quantity_received DECIMAL(10, 2) DEFAULT 0.00,
    unit_of_measure VARCHAR(50) DEFAULT 'each',

    -- Pricing
    unit_price DECIMAL(12, 4) DEFAULT 0.0000,
    line_total DECIMAL(12, 2) GENERATED ALWAYS AS (quantity_ordered * unit_price) STORED,

    -- Link to material requirement
    material_requirement_id INT NULL COMMENT 'Links this order item to a material requirement',

    -- Notes
    notes TEXT NULL,

    -- Receiving tracking
    received_date DATE NULL,
    received_by INT NULL,

    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (item_id),
    KEY idx_order_id (order_id),
    KEY idx_supplier_product_id (supplier_product_id),
    KEY idx_material_requirement_id (material_requirement_id),

    CONSTRAINT fk_supplier_order_items_order FOREIGN KEY (order_id) REFERENCES supplier_orders(order_id) ON DELETE CASCADE,
    CONSTRAINT fk_supplier_order_items_product FOREIGN KEY (supplier_product_id) REFERENCES supplier_products(supplier_product_id),
    CONSTRAINT fk_supplier_order_items_requirement FOREIGN KEY (material_requirement_id) REFERENCES material_requirements(requirement_id),
    CONSTRAINT fk_supplier_order_items_received_by FOREIGN KEY (received_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add supplier_order_id to material_requirements for tracking which order an item was placed on
ALTER TABLE material_requirements
ADD COLUMN supplier_order_id INT NULL AFTER purchase_order_id,
ADD KEY idx_supplier_order_id (supplier_order_id),
ADD CONSTRAINT fk_material_requirements_supplier_order
    FOREIGN KEY (supplier_order_id) REFERENCES supplier_orders(order_id) ON DELETE SET NULL;

-- Supplier Order Status History - Track status changes
CREATE TABLE IF NOT EXISTS supplier_order_status_history (
    history_id INT NOT NULL AUTO_INCREMENT,
    order_id INT NOT NULL,
    old_status ENUM('draft', 'submitted', 'acknowledged', 'partial_received', 'delivered', 'cancelled') NULL,
    new_status ENUM('draft', 'submitted', 'acknowledged', 'partial_received', 'delivered', 'cancelled') NOT NULL,
    changed_by INT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT NULL,

    PRIMARY KEY (history_id),
    KEY idx_order_id (order_id),
    KEY idx_changed_at (changed_at),

    CONSTRAINT fk_supplier_order_status_history_order FOREIGN KEY (order_id) REFERENCES supplier_orders(order_id) ON DELETE CASCADE,
    CONSTRAINT fk_supplier_order_status_history_user FOREIGN KEY (changed_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
