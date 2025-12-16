-- =============================================
-- Dashboard Panel System
-- Created: 2025-12-17
-- Purpose: Customizable Orders Dashboard panels
-- =============================================

-- =============================================
-- Global Panel Definitions (Templates)
-- Managers+ create these, all users can select from them
-- =============================================
CREATE TABLE IF NOT EXISTS dashboard_panel_definitions (
  panel_id INT PRIMARY KEY AUTO_INCREMENT,
  panel_name VARCHAR(100) NOT NULL,
  panel_key VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  icon_name VARCHAR(50) DEFAULT 'LayoutList',
  color_class VARCHAR(100) DEFAULT 'bg-blue-100 text-blue-800',
  display_order INT NOT NULL DEFAULT 0,
  max_rows INT DEFAULT 10,
  filters JSON NOT NULL COMMENT 'Filter criteria: statuses[], excludeStatuses[], invoiceStatus, shippingType, dueDateRange, hasHardDueTime',
  is_active BOOLEAN DEFAULT TRUE,
  is_system BOOLEAN DEFAULT FALSE COMMENT 'System panels cannot be deleted',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT NULL,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- User Panel Preferences
-- Each user selects which panels they want to see
-- =============================================
CREATE TABLE IF NOT EXISTS user_dashboard_panels (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  panel_id INT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_collapsed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (panel_id) REFERENCES dashboard_panel_definitions(panel_id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_panel (user_id, panel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Indexes for Performance
-- =============================================
CREATE INDEX idx_panels_active_order ON dashboard_panel_definitions(is_active, display_order);
CREATE INDEX idx_user_panels_user ON user_dashboard_panels(user_id, display_order);

-- =============================================
-- Default Panel Definitions (Seed Data)
-- =============================================

-- 1. Overdue Orders
INSERT INTO dashboard_panel_definitions (panel_name, panel_key, description, icon_name, color_class, display_order, max_rows, filters, is_system)
VALUES (
  'Overdue Orders',
  'overdue',
  'Orders past their due date',
  'AlertCircle',
  'bg-red-100 text-red-800',
  1,
  10,
  '{"dueDateRange": "overdue", "excludeStatuses": ["completed", "cancelled"]}',
  TRUE
);

-- 2. Needs Deposit
INSERT INTO dashboard_panel_definitions (panel_name, panel_key, description, icon_name, color_class, display_order, max_rows, filters, is_system)
VALUES (
  'Needs Deposit',
  'needs_deposit',
  'Orders requiring deposit that have not been paid',
  'DollarSign',
  'bg-amber-100 text-amber-800',
  2,
  10,
  '{"invoiceStatus": "deposit_required_not_paid", "excludeStatuses": ["completed", "cancelled"]}',
  TRUE
);

-- 3. Due This Week
INSERT INTO dashboard_panel_definitions (panel_name, panel_key, description, icon_name, color_class, display_order, max_rows, filters, is_system)
VALUES (
  'Due This Week',
  'due_this_week',
  'Orders due within the current week',
  'Calendar',
  'bg-blue-100 text-blue-800',
  3,
  10,
  '{"dueDateRange": "this_week", "excludeStatuses": ["completed", "cancelled"]}',
  TRUE
);

-- 4. In Production
INSERT INTO dashboard_panel_definitions (panel_name, panel_key, description, icon_name, color_class, display_order, max_rows, filters, is_system)
VALUES (
  'In Production',
  'in_production',
  'Currently being manufactured',
  'Factory',
  'bg-indigo-100 text-indigo-800',
  4,
  10,
  '{"statuses": ["in_production"]}',
  TRUE
);

-- 5. Hard Due Time Today
INSERT INTO dashboard_panel_definitions (panel_name, panel_key, description, icon_name, color_class, display_order, max_rows, filters, is_system)
VALUES (
  'Hard Due Time Today',
  'hard_due_today',
  'Orders with a hard due time set for today',
  'Clock',
  'bg-purple-100 text-purple-800',
  5,
  10,
  '{"hasHardDueTime": true, "dueDateRange": "today", "excludeStatuses": ["completed", "cancelled"]}',
  TRUE
);

-- 6. Ready for Pickup
INSERT INTO dashboard_panel_definitions (panel_name, panel_key, description, icon_name, color_class, display_order, max_rows, filters, is_system)
VALUES (
  'Ready for Pickup',
  'ready_pickup',
  'Completed orders awaiting customer pickup',
  'Package',
  'bg-teal-100 text-teal-800',
  6,
  10,
  '{"statuses": ["pick_up"], "shippingType": "pick_up"}',
  TRUE
);

-- 7. Ready to Ship
INSERT INTO dashboard_panel_definitions (panel_name, panel_key, description, icon_name, color_class, display_order, max_rows, filters, is_system)
VALUES (
  'Ready to Ship',
  'ready_ship',
  'Completed orders ready for shipping',
  'Truck',
  'bg-cyan-100 text-cyan-800',
  7,
  10,
  '{"statuses": ["shipping"], "shippingType": "shipping"}',
  TRUE
);

-- 8. Open Invoices
INSERT INTO dashboard_panel_definitions (panel_name, panel_key, description, icon_name, color_class, display_order, max_rows, filters, is_system)
VALUES (
  'Open Invoices',
  'open_invoices',
  'Orders with unpaid invoice balance',
  'FileText',
  'bg-orange-100 text-orange-800',
  8,
  10,
  '{"invoiceStatus": "open_balance", "excludeStatuses": ["cancelled"]}',
  TRUE
);

-- 9. Uninvoiced Orders
-- Logic: Orders without invoice that SHOULD have one:
--   - If deposit_required: needs invoice during deposit tracking stages
--   - If NOT deposit_required: needs invoice at shipping, pick_up, or awaiting_payment
INSERT INTO dashboard_panel_definitions (panel_name, panel_key, description, icon_name, color_class, display_order, max_rows, filters, is_system)
VALUES (
  'Uninvoiced Orders',
  'uninvoiced',
  'Orders needing invoice (deposit orders in production, non-deposit at shipping/pickup/payment)',
  'AlertTriangle',
  'bg-yellow-100 text-yellow-800',
  9,
  10,
  '{"invoiceStatus": "needs_invoice"}',
  TRUE
);

-- 10. Pending File Approval
INSERT INTO dashboard_panel_definitions (panel_name, panel_key, description, icon_name, color_class, display_order, max_rows, filters, is_system)
VALUES (
  'Pending File Approval',
  'pending_file_approval',
  'Orders waiting for production files to be approved',
  'FileCheck',
  'bg-violet-100 text-violet-800',
  10,
  10,
  '{"statuses": ["pending_production_files_approval"]}',
  TRUE
);

-- 11. Pending File Creation (Designer)
INSERT INTO dashboard_panel_definitions (panel_name, panel_key, description, icon_name, color_class, display_order, max_rows, filters, is_system)
VALUES (
  'Pending File Creation',
  'pending_file_creation',
  'Orders requiring production file creation',
  'FilePlus',
  'bg-pink-100 text-pink-800',
  11,
  10,
  '{"statuses": ["pending_production_files_creation"]}',
  TRUE
);

-- 12. QC & Packing
INSERT INTO dashboard_panel_definitions (panel_name, panel_key, description, icon_name, color_class, display_order, max_rows, filters, is_system)
VALUES (
  'QC & Packing',
  'qc_packing',
  'Orders in quality control and packing stage',
  'PackageCheck',
  'bg-emerald-100 text-emerald-800',
  12,
  10,
  '{"statuses": ["qc_packing"]}',
  TRUE
);

-- =============================================
-- Add settings_categories entry for Settings UI navigation
-- =============================================
INSERT INTO settings_categories (category_key, display_name, description, icon_name, route_path, display_order, required_role, is_active)
VALUES (
  'dashboard_panels',
  'Dashboard Panels',
  'Configure customizable dashboard panel templates',
  'LayoutDashboard',
  '/settings/panels',
  70,
  'manager',
  TRUE
);
