#!/bin/bash
# Database setup and initialization script for Sign Manufacturing System

set -e

DB_NAME="sign_manufacturing"
DB_USER="sign_user"
DB_READONLY_USER="sign_readonly"
SCHEMA_FILE="/home/jon/Nexus/sign_manufacturing_schema.sql"
CONFIG_FILE="/home/jon/Nexus/database_config.json"

echo "Sign Manufacturing Database Setup"
echo "================================"

# Function to generate secure password
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-20
}

# Function to test MySQL connection
test_mysql_connection() {
    mysql -u root -p -e "SELECT VERSION();" 2>/dev/null && return 0 || return 1
}

# Function to create database and users
setup_database() {
    echo "Setting up database and users..."
    
    # Generate passwords
    local user_password=$(generate_password)
    local readonly_password=$(generate_password)
    
    echo "Generated secure passwords for database users"
    
    # Create SQL commands
    cat > /tmp/setup_db.sql << EOF
-- Create database
DROP DATABASE IF EXISTS $DB_NAME;
CREATE DATABASE $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create users
DROP USER IF EXISTS '$DB_USER'@'localhost';
DROP USER IF EXISTS '$DB_READONLY_USER'@'localhost';

CREATE USER '$DB_USER'@'localhost' IDENTIFIED BY '$user_password';
CREATE USER '$DB_READONLY_USER'@'localhost' IDENTIFIED BY '$readonly_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';
GRANT SELECT ON $DB_NAME.* TO '$DB_READONLY_USER'@'localhost';

FLUSH PRIVILEGES;
EOF
    
    # Execute setup
    echo "Creating database and users (you'll need to enter MySQL root password)..."
    mysql -u root -p < /tmp/setup_db.sql
    
    # Clean up temp file
    rm /tmp/setup_db.sql
    
    # Create configuration file
    cat > "$CONFIG_FILE" << EOF
{
    "host": "localhost",
    "user": "$DB_USER",
    "password": "$user_password",
    "database": "$DB_NAME",
    "readonly_user": "$DB_READONLY_USER",
    "readonly_password": "$readonly_password"
}
EOF
    
    chmod 600 "$CONFIG_FILE"
    echo "Database configuration saved to: $CONFIG_FILE"
    echo "Main user: $DB_USER"
    echo "Readonly user: $DB_READONLY_USER"
}

# Function to load schema
load_schema() {
    if [ ! -f "$SCHEMA_FILE" ]; then
        echo "ERROR: Schema file not found: $SCHEMA_FILE"
        echo "Please create the schema file first"
        return 1
    fi
    
    echo "Loading database schema..."
    mysql -u root -p "$DB_NAME" < "$SCHEMA_FILE"
    echo "Schema loaded successfully"
}

# Function to insert sample data
insert_sample_data() {
    echo "Inserting sample data..."
    
    cat > /tmp/sample_data.sql << 'EOF'
USE sign_manufacturing;

-- Sample customers
INSERT INTO customers (company_name, contact_first_name, contact_last_name, email, phone, address_line1, city, state, zip_code, preferred_materials, preferred_colors) VALUES
('ABC Restaurant', 'John', 'Smith', 'john@abcrestaurant.com', '555-0101', '123 Main St', 'Anytown', 'CA', '90210', 'ACM panels, vinyl graphics', 'Red, white, black'),
('City Auto Shop', 'Sarah', 'Johnson', 'sarah@cityauto.com', '555-0102', '456 Oak Ave', 'Somewhere', 'CA', '90211', 'Aluminum, reflective vinyl', 'Blue, yellow, white'),
('Green Valley School', 'Mike', 'Davis', 'mdavis@greenvalley.edu', '555-0103', '789 School Rd', 'Education City', 'CA', '90212', 'Outdoor banners, safety signs', 'Green, white, yellow');

-- Sample suppliers
INSERT INTO suppliers (company_name, contact_name, email, phone, address_line1, city, state, zip_code, payment_terms, lead_time_days) VALUES
('SignSupply Pro', 'Lisa Martinez', 'orders@signsupplypro.com', '800-555-0201', '100 Industrial Blvd', 'Supply City', 'TX', '75001', 'Net 30', 5),
('Vinyl World', 'Tom Wilson', 'sales@vinylworld.com', '800-555-0202', '200 Material St', 'Vinyl Town', 'FL', '33101', 'Net 15', 3),
('Hardware Plus', 'Janet Brown', 'info@hardwareplus.com', '800-555-0203', '300 Hardware Way', 'Tool City', 'OH', '44101', 'COD', 7);

-- Sample materials
INSERT INTO materials (material_type, material_name, brand, color, size_width, size_height, thickness, finish, unit_of_measure, cost_per_unit, current_stock, minimum_stock, reorder_point, preferred_supplier_id) VALUES
('vinyl', '3M Scotchcal', '3M', 'White', 54.00, 150.00, 0.004, 'Gloss', 'sqft', 2.50, 500.00, 50.00, 100.00, 1),
('vinyl', '3M Scotchcal', '3M', 'Black', 54.00, 150.00, 0.004, 'Gloss', 'sqft', 2.50, 300.00, 50.00, 100.00, 1),
('substrate', 'Aluminum Composite', 'Dibond', 'White', 48.00, 96.00, 0.118, 'Smooth', 'sheet', 45.00, 25.00, 5.00, 10.00, 2),
('substrate', 'Corrugated Plastic', 'Coroplast', 'White', 48.00, 96.00, 0.157, 'Smooth', 'sheet', 15.00, 40.00, 10.00, 20.00, 2),
('hardware', 'Post Mounting Brackets', 'SignBracket Co', 'Galvanized', NULL, NULL, NULL, 'Galvanized Steel', 'each', 12.50, 20.00, 5.00, 10.00, 3);

-- Sample pricing rules
INSERT INTO pricing_rules (rule_name, job_type, base_price, price_per_sqft, minimum_charge, setup_fee, material_markup_percent, labor_rate_per_hour, effective_date) VALUES
('Standard Signs', 'signs', 25.00, 8.50, 50.00, 15.00, 60.00, 45.00, CURDATE()),
('Vinyl Graphics', 'vinyl_graphics', 15.00, 6.00, 30.00, 10.00, 55.00, 40.00, CURDATE()),
('Banners', 'banners', 20.00, 4.50, 25.00, 5.00, 50.00, 35.00, CURDATE());

-- Sample jobs
INSERT INTO jobs (job_number, customer_id, job_title, job_description, job_type, width, height, square_footage, quantity, job_status, estimated_price, estimated_hours, estimated_completion, special_instructions, created_by) VALUES
('2024-001', 1, 'Restaurant Front Sign', 'Illuminated front entrance sign with logo', 'signs', 60.00, 24.00, 10.00, 1, 'in_production', 850.00, 8.0, DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'LED illumination required', 'system'),
('2024-002', 2, 'Vehicle Graphics Package', 'Full vehicle wrap for service truck', 'vehicle_graphics', 240.00, 72.00, 120.00, 1, 'estimate', 1200.00, 12.0, DATE_ADD(CURDATE(), INTERVAL 14 DAY), 'Customer to provide vehicle', 'system'),
('2024-003', 3, 'Safety Banner Set', 'School zone safety banners - set of 4', 'banners', 36.00, 18.00, 4.50, 4, 'approved', 320.00, 3.0, DATE_ADD(CURDATE(), INTERVAL 5 DAY), 'Wind-resistant grommets', 'system');

-- Sample users
INSERT INTO users (username, password_hash, full_name, email, role, active) VALUES
('admin', SHA2('admin123', 256), 'System Administrator', 'admin@company.com', 'admin', TRUE),
('manager', SHA2('manager123', 256), 'Production Manager', 'manager@company.com', 'manager', TRUE),
('employee', SHA2('employee123', 256), 'Shop Employee', 'employee@company.com', 'employee', TRUE);

-- Update system configuration with company details
UPDATE system_config SET config_value = 'Your Sign Company' WHERE config_key = 'company_name';
UPDATE system_config SET config_value = '123 Business St, Your City, ST 12345' WHERE config_key = 'company_address';
UPDATE system_config SET config_value = '(555) 123-4567' WHERE config_key = 'company_phone';
UPDATE system_config SET config_value = 'info@yoursigncompany.com' WHERE config_key = 'company_email';
UPDATE system_config SET config_value = 'smtp.gmail.com' WHERE config_key = 'smtp_server';
UPDATE system_config SET config_value = 'your-email@gmail.com' WHERE config_key = 'smtp_username';
UPDATE system_config SET config_value = 'your-app-password' WHERE config_key = 'smtp_password';
EOF
    
    mysql -u root -p "$DB_NAME" < /tmp/sample_data.sql
    rm /tmp/sample_data.sql
    
    echo "Sample data inserted successfully"
}

# Function to create database maintenance script
create_maintenance_script() {
    cat > "/home/jon/Nexus/database_maintenance.sh" << 'EOF'
#!/bin/bash
# Database maintenance and optimization script

DB_NAME="sign_manufacturing"
CONFIG_FILE="/home/jon/Nexus/database_config.json"

# Load database config
if [ -f "$CONFIG_FILE" ]; then
    DB_USER=$(grep -o '"user": "[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
    DB_PASSWORD=$(grep -o '"password": "[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
else
    echo "Database config file not found"
    exit 1
fi

echo "Running database maintenance..."

# Optimize tables
echo "Optimizing database tables..."
mysql -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "
    OPTIMIZE TABLE customers, materials, suppliers, jobs, job_materials, 
    purchase_orders, po_line_items, job_status_history, email_communications, 
    pricing_rules, stock_alerts, users, system_config;
"

# Update table statistics
echo "Updating table statistics..."
mysql -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "
    ANALYZE TABLE customers, materials, suppliers, jobs, job_materials, 
    purchase_orders, po_line_items, job_status_history, email_communications, 
    pricing_rules, stock_alerts, users, system_config;
"

# Clean old logs and temporary data
echo "Cleaning old data..."
mysql -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "
    DELETE FROM email_communications WHERE sent_date < DATE_SUB(NOW(), INTERVAL 1 YEAR);
    DELETE FROM stock_alerts WHERE acknowledged = TRUE AND alert_date < DATE_SUB(NOW(), INTERVAL 30 DAY);
    DELETE FROM job_status_history WHERE change_date < DATE_SUB(NOW(), INTERVAL 2 YEAR);
"

# Display database size information
echo "Database size information:"
mysql -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "
    SELECT 
        table_name as 'Table',
        ROUND(((data_length + index_length) / 1024 / 1024), 2) as 'Size (MB)',
        table_rows as 'Rows'
    FROM information_schema.TABLES 
    WHERE table_schema = '$DB_NAME'
    ORDER BY (data_length + index_length) DESC;
"

echo "Database maintenance completed"
EOF
    
    chmod +x "/home/jon/Nexus/database_maintenance.sh"
    echo "Created database maintenance script: /home/jon/Nexus/database_maintenance.sh"
}

# Function to verify installation
verify_installation() {
    echo "Verifying database installation..."
    
    # Test connection with new user
    if [ -f "$CONFIG_FILE" ]; then
        local db_user=$(grep -o '"user": "[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
        local db_password=$(grep -o '"password": "[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
        
        echo "Testing database connection..."
        mysql -u "$db_user" -p"$db_password" "$DB_NAME" -e "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = '$DB_NAME';" && {
            echo "✓ Database connection successful"
        } || {
            echo "✗ Database connection failed"
            return 1
        }
        
        # Test sample data
        echo "Verifying sample data..."
        local customer_count=$(mysql -u "$db_user" -p"$db_password" "$DB_NAME" -se "SELECT COUNT(*) FROM customers;")
        local material_count=$(mysql -u "$db_user" -p"$db_password" "$DB_NAME" -se "SELECT COUNT(*) FROM materials;")
        
        echo "Found $customer_count customers, $material_count materials"
        
        if [ "$customer_count" -gt 0 ] && [ "$material_count" -gt 0 ]; then
            echo "✓ Sample data verified"
        else
            echo "⚠ Sample data may not have loaded correctly"
        fi
    else
        echo "✗ Configuration file not found"
        return 1
    fi
}

# Main execution
main() {
    echo "Starting database setup..."
    
    # Check if MySQL is running
    if ! systemctl is-active --quiet mysql; then
        echo "ERROR: MySQL service is not running"
        echo "Please install and start MySQL first:"
        echo "  sudo apt install mysql-server"
        echo "  sudo systemctl start mysql"
        exit 1
    fi
    
    # Test MySQL root connection
    echo "Testing MySQL root connection..."
    if ! test_mysql_connection; then
        echo "ERROR: Cannot connect to MySQL as root"
        echo "Please ensure MySQL is properly configured and you know the root password"
        exit 1
    fi
    
    # Setup database and users
    setup_database
    
    # Load schema
    if [ -f "$SCHEMA_FILE" ]; then
        load_schema
    else
        echo "WARNING: Schema file not found, skipping schema load"
        echo "Please create $SCHEMA_FILE and run this script again"
    fi
    
    # Insert sample data
    read -p "Insert sample data for testing? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        insert_sample_data
    fi
    
    # Create maintenance script
    create_maintenance_script
    
    # Verify installation
    verify_installation
    
    echo ""
    echo "Database setup completed successfully!"
    echo ""
    echo "Configuration file: $CONFIG_FILE"
    echo "Database name: $DB_NAME"
    echo "Main user: $DB_USER"
    echo "Readonly user: $DB_READONLY_USER"
    echo ""
    echo "Next steps:"
    echo "1. Update system_config table with your company details"
    echo "2. Configure SMTP settings in system_config"
    echo "3. Test email system"
    echo "4. Set up automated backups"
    echo ""
    echo "Maintenance script: /home/jon/Nexus/database_maintenance.sh"
}

# Execute if run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi