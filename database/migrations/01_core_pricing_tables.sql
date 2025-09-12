-- =====================================================
-- MIGRATION 01: Core Pricing Management Tables
-- =====================================================
-- Simple tables without complex triggers or dependencies
-- =====================================================

-- Pricing Change Requests (Approval Workflow)
CREATE TABLE pricing_change_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  request_type VARCHAR(20) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  record_id INT,
  change_data TEXT NOT NULL,
  current_data TEXT,
  reason TEXT NOT NULL,
  business_justification TEXT,
  requested_by INT NOT NULL,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  status VARCHAR(20) DEFAULT 'PENDING',
  reviewed_by INT,
  reviewed_at TIMESTAMP NULL,
  review_notes TEXT,
  
  implemented_by INT,
  implemented_at TIMESTAMP NULL,
  
  effective_date DATE NOT NULL,
  expires_date DATE,
  
  INDEX idx_status_date (status, requested_at),
  INDEX idx_table_name (table_name),
  INDEX idx_requested_by (requested_by)
);

-- Supplier Cost Alerts
CREATE TABLE supplier_cost_alerts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  alert_type VARCHAR(30) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  record_id INT NOT NULL,
  supplier_id INT NOT NULL,
  old_cost DECIMAL(10,4),
  new_cost DECIMAL(10,4),
  percent_change DECIMAL(5,2),
  alert_threshold_exceeded BOOLEAN DEFAULT false,
  
  status VARCHAR(20) DEFAULT 'UNREAD',
  acknowledged_by INT,
  acknowledged_at TIMESTAMP NULL,
  resolution_notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_status_type (status, alert_type),
  INDEX idx_created_at (created_at),
  INDEX idx_supplier (supplier_id)
);

-- System Configuration
CREATE TABLE pricing_system_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  config_type VARCHAR(20) DEFAULT 'STRING',
  description TEXT,
  
  updated_by INT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- CSV Import Tracking
CREATE TABLE csv_import_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  import_type VARCHAR(100) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  total_records INT NOT NULL,
  successful_records INT NOT NULL,
  failed_records INT NOT NULL,
  error_summary TEXT,
  
  imported_by INT NOT NULL,
  import_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  import_completed_at TIMESTAMP NULL,
  
  file_size_bytes INT,
  file_hash VARCHAR(64),
  
  INDEX idx_import_type (import_type),
  INDEX idx_imported_by (imported_by),
  INDEX idx_started_at (import_started_at)
);