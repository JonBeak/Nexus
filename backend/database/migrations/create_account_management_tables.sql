-- Create login_logs table for tracking user login activity
CREATE TABLE IF NOT EXISTS login_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user_login (user_id, login_time),
    INDEX idx_login_time (login_time)
);

-- Create vacation_periods table for managing user vacation/absence periods
CREATE TABLE IF NOT EXISTS vacation_periods (
    vacation_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user_vacation (user_id, start_date, end_date),
    INDEX idx_vacation_dates (start_date, end_date)
);

-- Add new columns to users table for account management features
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS hourly_wage DECIMAL(10,2) NULL,
ADD COLUMN IF NOT EXISTS auto_clock_in TIME NULL,
ADD COLUMN IF NOT EXISTS auto_clock_out TIME NULL,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP NULL;

-- Create index on users for performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);