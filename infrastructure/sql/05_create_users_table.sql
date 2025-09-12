-- Create users table for web interface authentication
CREATE TABLE IF NOT EXISTS users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('production_staff', 'designer', 'manager') NOT NULL DEFAULT 'production_staff',
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_active (is_active)
);

-- Insert a default manager user (password: admin123)
INSERT IGNORE INTO users (username, email, password_hash, role, first_name, last_name) 
VALUES ('admin', 'admin@company.com', '$2b$10$BTAPHIh1yFgf1u1pWiSu9OIE.fZpBKfhki5gmwUXcJOFz4PaPPGRS', 'manager', 'Admin', 'User');

-- Add a production staff user for testing (password: staff123)
INSERT IGNORE INTO users (username, email, password_hash, role, first_name, last_name) 
VALUES ('staff', 'staff@company.com', '$2b$10$GwM4CsCSofzoGSx6phVIAu6GsYNnlBmFowm6.173xI0gTGLPbpXYO', 'production_staff', 'Staff', 'User');

-- Add a designer user for testing (password: design123)
INSERT IGNORE INTO users (username, email, password_hash, role, first_name, last_name) 
VALUES ('designer', 'designer@company.com', '$2b$10$ZLucJxJxg8QvE8veJWTJ1eAG7jDzUmw4.J4Vx0FCrVoTexjZriiDi', 'designer', 'Designer', 'User');