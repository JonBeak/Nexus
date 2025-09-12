-- Simple table creation test
CREATE TABLE pricing_change_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  request_type ENUM('CREATE', 'UPDATE', 'DELETE', 'BULK_IMPORT') NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  record_id INT,
  change_data JSON NOT NULL,
  reason TEXT NOT NULL,
  requested_by INT NOT NULL,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') DEFAULT 'PENDING',
  effective_date DATE NOT NULL,
  
  FOREIGN KEY (requested_by) REFERENCES users(user_id)
);

-- Insert test data
INSERT INTO pricing_change_requests (
  request_type, table_name, change_data, reason, requested_by, effective_date
) VALUES (
  'CREATE', 'test_table', '{"test": "data"}', 'Testing system', 1, CURDATE()
);