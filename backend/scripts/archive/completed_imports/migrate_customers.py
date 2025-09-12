#!/usr/bin/env python3
"""
Customer Data Migration Script
Migrates customer data from PC MySQL to server with enhanced schema
"""

import mysql.connector
import json
import logging
import sys
import os
from datetime import datetime
from typing import Dict, List, Optional, Tuple

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/customer_migration.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class CustomerMigration:
    """Handles customer data migration from PC to server"""
    
    def __init__(self, pc_config_file: str, server_config_file: str):
        self.pc_config_file = pc_config_file
        self.server_config_file = server_config_file
        self.pc_connection = None
        self.server_connection = None
        self.migration_stats = {
            'total_records': 0,
            'migrated_successfully': 0,
            'failed_migrations': 0,
            'duplicate_skips': 0,
            'errors': []
        }
    
    def load_database_config(self, config_file: str) -> Dict:
        """Load database configuration from JSON file"""
        try:
            with open(config_file, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            logger.error(f"Configuration file not found: {config_file}")
            raise
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON in configuration file: {config_file}")
            raise
    
    def connect_to_databases(self):
        """Establish connections to both PC and server databases"""
        try:
            # Connect to PC database
            pc_config = self.load_database_config(self.pc_config_file)
            self.pc_connection = mysql.connector.connect(**pc_config)
            logger.info("Connected to PC database successfully")
            
            # Connect to server database  
            server_config = self.load_database_config(self.server_config_file)
            self.server_connection = mysql.connector.connect(**server_config)
            logger.info("Connected to server database successfully")
            
            return True
        except mysql.connector.Error as e:
            logger.error(f"Database connection failed: {e}")
            return False
    
    def disconnect_databases(self):
        """Close database connections"""
        if self.pc_connection and self.pc_connection.is_connected():
            self.pc_connection.close()
            logger.info("PC database connection closed")
        
        if self.server_connection and self.server_connection.is_connected():
            self.server_connection.close()
            logger.info("Server database connection closed")
    
    def get_pc_customers(self) -> List[Dict]:
        """Retrieve all customers from PC database"""
        try:
            cursor = self.pc_connection.cursor(dictionary=True)
            cursor.execute("SELECT * FROM customers ORDER BY Customer_ID")
            customers = cursor.fetchall()
            cursor.close()
            
            self.migration_stats['total_records'] = len(customers)
            logger.info(f"Retrieved {len(customers)} customers from PC database")
            return customers
        except mysql.connector.Error as e:
            logger.error(f"Failed to retrieve customers from PC: {e}")
            return []
    
    def customer_exists_on_server(self, company_name: str) -> bool:
        """Check if customer already exists on server"""
        try:
            cursor = self.server_connection.cursor()
            cursor.execute("SELECT customer_id FROM customers WHERE company_name = %s", (company_name,))
            result = cursor.fetchone()
            cursor.close()
            return result is not None
        except mysql.connector.Error as e:
            logger.error(f"Error checking if customer exists: {e}")
            return False
    
    def map_customer_data(self, pc_customer: Dict) -> Dict:
        """Map PC customer data to server schema"""
        # Map field names from PC to server schema
        mapped_data = {
            # Direct mappings
            'company_name': pc_customer.get('Company_Name'),
            'quickbooks_name': pc_customer.get('Quickbooks_Name'),
            'quickbooks_name_search': pc_customer.get('Quickbooks_NameSearch'),
            'tax_type': pc_customer.get('Tax_Type'),
            'tax_id': pc_customer.get('Tax_ID'),
            'default_turnaround': pc_customer.get('Default_Turnaround', 10),
            
            # LED preferences
            'leds_yes_or_no': pc_customer.get('LEDs_YesOrNo', 1),
            'leds_default_type': pc_customer.get('LEDs_DefaultType'),
            'wire_length': pc_customer.get('Wire_Length', 5),
            
            # Power supply preferences
            'powersupply_yes_or_no': pc_customer.get('PowerSupply_YesOrNo', 1),
            'powersupply_default_type': pc_customer.get('PowerSupply_DefaultType', 'Speedbox (default)'),
            
            # Manufacturing options
            'ul_yes_or_no': pc_customer.get('UL_YesOrNo', 1),
            'drain_holes_yes_or_no': pc_customer.get('DrainHoles_YesOrNo', 1),
            'pattern_yes_or_no': pc_customer.get('Pattern_YesOrNo', 1),
            'pattern_type': pc_customer.get('Pattern_Type', 'Paper'),
            'wiring_diagram_yes_or_no': pc_customer.get('WiringDiagram_YesOrNo', 1),
            'wiring_diagram_type': pc_customer.get('WiringDiagram_Type', 'Paper'),
            'plug_n_play_yes_or_no': pc_customer.get('PlugNPlay_YesOrNo', 0),
            
            # Payment and pricing
            'cash_yes_or_no': pc_customer.get('Cash_YesOrNo', 0),
            'discount': pc_customer.get('Discount', 0.00000),
            
            # Shipping
            'shipping_yes_or_no': pc_customer.get('Shipping_YesOrNo', 0),
            'shipping_multiplier': pc_customer.get('Shipping_Multiplier', 1.50000),
            'shipping_flat': pc_customer.get('Shipping_Flat'),
            
            # Additional info
            'comments': pc_customer.get('Comments'),
            
            # Audit fields
            'created_by': 'migration_script',
            'updated_by': 'migration_script',
            'active': True
        }
        
        # Clean up None values
        cleaned_data = {k: v for k, v in mapped_data.items() if v is not None}
        return cleaned_data
    
    def insert_customer_to_server(self, customer_data: Dict) -> bool:
        """Insert customer data into server database"""
        try:
            cursor = self.server_connection.cursor()
            
            # Build dynamic INSERT query
            fields = list(customer_data.keys())
            placeholders = ['%s'] * len(fields)
            values = list(customer_data.values())
            
            query = f"""
                INSERT INTO customers ({', '.join(fields)})
                VALUES ({', '.join(placeholders)})
            """
            
            cursor.execute(query, values)
            customer_id = cursor.lastrowid
            cursor.close()
            
            # Create initial preference snapshot
            self.create_preference_snapshot(customer_id, customer_data, "Initial migration")
            
            logger.info(f"Successfully migrated customer: {customer_data['company_name']} (ID: {customer_id})")
            return True
            
        except mysql.connector.Error as e:
            logger.error(f"Failed to insert customer {customer_data.get('company_name', 'Unknown')}: {e}")
            self.migration_stats['errors'].append({
                'customer': customer_data.get('company_name', 'Unknown'),
                'error': str(e)
            })
            return False
    
    def create_preference_snapshot(self, customer_id: int, customer_data: Dict, notes: str):
        """Create a snapshot of customer preferences for historical tracking"""
        try:
            preferences = {
                'led_preferences': {
                    'leds_enabled': customer_data.get('leds_yes_or_no'),
                    'default_type': customer_data.get('leds_default_type'),
                    'wire_length': customer_data.get('wire_length')
                },
                'power_supply': {
                    'enabled': customer_data.get('powersupply_yes_or_no'),
                    'default_type': customer_data.get('powersupply_default_type')
                },
                'manufacturing': {
                    'ul_listing': customer_data.get('ul_yes_or_no'),
                    'drain_holes': customer_data.get('drain_holes_yes_or_no'),
                    'pattern_enabled': customer_data.get('pattern_yes_or_no'),
                    'pattern_type': customer_data.get('pattern_type'),
                    'wiring_diagram': customer_data.get('wiring_diagram_yes_or_no'),
                    'wiring_diagram_type': customer_data.get('wiring_diagram_type'),
                    'plug_n_play': customer_data.get('plug_n_play_yes_or_no')
                },
                'pricing': {
                    'discount': float(customer_data.get('discount', 0)),
                    'cash_customer': customer_data.get('cash_yes_or_no'),
                    'shipping_enabled': customer_data.get('shipping_yes_or_no'),
                    'shipping_multiplier': float(customer_data.get('shipping_multiplier', 1.5)),
                    'shipping_flat': customer_data.get('shipping_flat')
                },
                'turnaround': customer_data.get('default_turnaround', 10)
            }
            
            cursor = self.server_connection.cursor()
            cursor.execute("""
                INSERT INTO customer_preference_snapshots 
                (customer_id, snapshot_name, preferences_json, created_by, notes)
                VALUES (%s, %s, %s, %s, %s)
            """, (
                customer_id,
                "Migration Baseline",
                json.dumps(preferences),
                'migration_script',
                notes
            ))
            cursor.close()
            
        except Exception as e:
            logger.warning(f"Failed to create preference snapshot for customer {customer_id}: {e}")
    
    def migrate_customers(self):
        """Main migration function"""
        logger.info("Starting customer data migration...")
        
        if not self.connect_to_databases():
            return False
        
        try:
            # Get customers from PC
            pc_customers = self.get_pc_customers()
            if not pc_customers:
                logger.error("No customers found on PC database")
                return False
            
            # Migrate each customer
            for pc_customer in pc_customers:
                company_name = pc_customer.get('Company_Name')
                
                if not company_name:
                    logger.warning(f"Skipping customer with no company name: {pc_customer}")
                    self.migration_stats['failed_migrations'] += 1
                    continue
                
                # Check if customer already exists
                if self.customer_exists_on_server(company_name):
                    logger.info(f"Customer already exists on server, skipping: {company_name}")
                    self.migration_stats['duplicate_skips'] += 1
                    continue
                
                # Map and insert customer data
                mapped_data = self.map_customer_data(pc_customer)
                
                if self.insert_customer_to_server(mapped_data):
                    self.migration_stats['migrated_successfully'] += 1
                else:
                    self.migration_stats['failed_migrations'] += 1
            
            # Commit all changes
            self.server_connection.commit()
            logger.info("Migration completed, changes committed to database")
            
            return True
            
        except Exception as e:
            logger.error(f"Migration failed with error: {e}")
            if self.server_connection:
                self.server_connection.rollback()
                logger.info("Database changes rolled back")
            return False
        
        finally:
            self.disconnect_databases()
    
    def print_migration_summary(self):
        """Print migration statistics"""
        print("\n" + "="*50)
        print("CUSTOMER MIGRATION SUMMARY")
        print("="*50)
        print(f"Total records found:     {self.migration_stats['total_records']}")
        print(f"Successfully migrated:   {self.migration_stats['migrated_successfully']}")
        print(f"Duplicates skipped:      {self.migration_stats['duplicate_skips']}")
        print(f"Failed migrations:       {self.migration_stats['failed_migrations']}")
        print(f"Success rate:            {(self.migration_stats['migrated_successfully']/max(self.migration_stats['total_records']-self.migration_stats['duplicate_skips'],1)*100):.1f}%")
        
        if self.migration_stats['errors']:
            print(f"\nErrors encountered:")
            for error in self.migration_stats['errors']:
                print(f"  - {error['customer']}: {error['error']}")
        
        print("="*50)

def create_sample_config_files():
    """Create sample configuration files"""
    # PC database config
    pc_config = {
        "host": "192.168.1.100",  # PC IP address
        "user": "your_pc_username",
        "password": "your_pc_password", 
        "database": "your_pc_database_name"
    }
    
    # Server database config
    server_config = {
        "host": "localhost",
        "user": "sign_user",
        "password": "your_server_password",
        "database": "sign_manufacturing"
    }
    
    with open('/home/jon/Nexus/pc_database_config.json', 'w') as f:
        json.dump(pc_config, f, indent=2)
    
    with open('/home/jon/Nexus/server_database_config.json', 'w') as f:
        json.dump(server_config, f, indent=2)
    
    print("Sample configuration files created:")
    print("- /home/jon/Nexus/pc_database_config.json")
    print("- /home/jon/Nexus/server_database_config.json")
    print("\nPlease update these files with your actual database credentials.")

def main():
    """Main execution function"""
    if len(sys.argv) == 1:
        print("Customer Migration Script")
        print("Usage: python3 migrate_customers.py [create-config|migrate]")
        print("")
        print("Commands:")
        print("  create-config  - Create sample configuration files")
        print("  migrate        - Run the customer migration")
        return
    
    command = sys.argv[1]
    
    if command == "create-config":
        create_sample_config_files()
        return
    
    elif command == "migrate":
        pc_config_file = "/home/jon/Nexus/pc_database_config.json"
        server_config_file = "/home/jon/Nexus/server_database_config.json"
        
        # Check if config files exist
        if not os.path.exists(pc_config_file) or not os.path.exists(server_config_file):
            print("Configuration files not found. Run 'create-config' first.")
            return
        
        # Run migration
        migrator = CustomerMigration(pc_config_file, server_config_file)
        
        if migrator.migrate_customers():
            print("Migration completed successfully!")
        else:
            print("Migration failed. Check logs for details.")
        
        migrator.print_migration_summary()
    
    else:
        print(f"Unknown command: {command}")

if __name__ == "__main__":
    main()