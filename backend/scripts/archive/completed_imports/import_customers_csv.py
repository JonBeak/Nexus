#!/usr/bin/env python3
"""
Customer CSV/JSON Import Script
Imports customer data from exported files with enhanced schema
"""

import csv
import json
import mysql.connector
import logging
import sys
import os
from datetime import datetime
from typing import Dict, List, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/jon/Nexus/customer_import.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class CustomerImporter:
    """Handles customer data import from CSV/JSON files"""
    
    def __init__(self, server_config_file: str):
        self.server_config_file = server_config_file
        self.server_connection = None
        self.import_stats = {
            'total_records': 0,
            'imported_successfully': 0,
            'failed_imports': 0,
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
    
    def connect_to_database(self):
        """Establish connection to server database"""
        try:
            server_config = self.load_database_config(self.server_config_file)
            self.server_connection = mysql.connector.connect(**server_config)
            logger.info("Connected to server database successfully")
            return True
        except mysql.connector.Error as e:
            logger.error(f"Database connection failed: {e}")
            return False
    
    def disconnect_database(self):
        """Close database connection"""
        if self.server_connection and self.server_connection.is_connected():
            self.server_connection.close()
            logger.info("Server database connection closed")
    
    def load_csv_data(self, csv_file: str) -> List[Dict]:
        """Load customer data from CSV file"""
        try:
            customers = []
            with open(csv_file, 'r', encoding='utf-8') as f:
                # Try to detect delimiter
                sample = f.read(1024)
                f.seek(0)
                
                if ',' in sample:
                    delimiter = ','
                elif ';' in sample:
                    delimiter = ';'
                elif '\t' in sample:
                    delimiter = '\t'
                else:
                    delimiter = ','
                
                reader = csv.DictReader(f, delimiter=delimiter)
                
                for row in reader:
                    # Clean up column names (remove spaces, special chars)
                    clean_row = {}
                    for key, value in row.items():
                        clean_key = key.strip().replace(' ', '_').replace('/', '_')
                        clean_row[clean_key] = value.strip() if value else None
                    customers.append(clean_row)
            
            self.import_stats['total_records'] = len(customers)
            logger.info(f"Loaded {len(customers)} customers from CSV file")
            return customers
        except Exception as e:
            logger.error(f"Failed to load CSV file {csv_file}: {e}")
            return []
    
    def load_json_data(self, json_file: str) -> List[Dict]:
        """Load customer data from JSON file"""
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Handle different JSON structures
            if isinstance(data, list):
                customers = data
            elif isinstance(data, dict):
                # Check for common keys that might contain the customer array
                if 'customers' in data:
                    customers = data['customers']
                elif 'data' in data:
                    customers = data['data']
                elif 'records' in data:
                    customers = data['records']
                else:
                    # Assume the dict values are the customers
                    customers = list(data.values())
            else:
                logger.error("Unexpected JSON structure")
                return []
            
            self.import_stats['total_records'] = len(customers)
            logger.info(f"Loaded {len(customers)} customers from JSON file")
            return customers
        except Exception as e:
            logger.error(f"Failed to load JSON file {json_file}: {e}")
            return []
    
    def customer_exists(self, company_name: str) -> bool:
        """Check if customer already exists"""
        try:
            cursor = self.server_connection.cursor()
            cursor.execute("SELECT customer_id FROM customers WHERE company_name = %s", (company_name,))
            result = cursor.fetchone()
            cursor.close()
            return result is not None
        except mysql.connector.Error as e:
            logger.error(f"Error checking if customer exists: {e}")
            return False
    
    def map_customer_data(self, source_data: Dict) -> Dict:
        """Map source data to server schema"""
        # Handle different possible field name variations
        def get_field_value(data, *possible_names):
            for name in possible_names:
                if name in data:
                    return data[name]
            return None
        
        # Convert numeric strings to proper types
        def safe_int(value, default=None):
            if value is None or value == '':
                return default
            try:
                return int(float(str(value)))
            except (ValueError, TypeError):
                return default
        
        def safe_decimal(value, default=0.0):
            if value is None or value == '':
                return default
            try:
                return float(str(value))
            except (ValueError, TypeError):
                return default
        
        def safe_bool(value, default=0):
            if value is None or value == '':
                return default
            if isinstance(value, bool):
                return 1 if value else 0
            if str(value).lower() in ['true', '1', 'yes', 'y']:
                return 1
            return 0
        
        mapped_data = {
            # Basic info
            'company_name': get_field_value(source_data, 'Company_Name', 'company_name', 'CompanyName'),
            'quickbooks_name': get_field_value(source_data, 'Quickbooks_Name', 'quickbooks_name', 'QuickbooksName'),
            'quickbooks_name_search': get_field_value(source_data, 'Quickbooks_NameSearch', 'quickbooks_name_search'),
            
            # Tax and payment
            'tax_type': get_field_value(source_data, 'Tax_Type', 'tax_type', 'TaxType'),
            'tax_id': get_field_value(source_data, 'Tax_ID', 'tax_id', 'TaxID'),
            'discount': safe_decimal(get_field_value(source_data, 'Discount', 'discount'), 0.0),
            'cash_yes_or_no': safe_bool(get_field_value(source_data, 'Cash_YesOrNo', 'cash_yes_or_no', 'Cash')),
            
            # Manufacturing preferences
            'default_turnaround': safe_int(get_field_value(source_data, 'Default_Turnaround', 'default_turnaround'), 10),
            
            # LED preferences
            'leds_yes_or_no': safe_bool(get_field_value(source_data, 'LEDs_YesOrNo', 'leds_yes_or_no', 'LEDs'), 1),
            'leds_default_type': get_field_value(source_data, 'LEDs_DefaultType', 'leds_default_type', 'LED_Type'),
            'wire_length': safe_int(get_field_value(source_data, 'Wire_Length', 'wire_length'), 5),
            
            # Power supply
            'powersupply_yes_or_no': safe_bool(get_field_value(source_data, 'PowerSupply_YesOrNo', 'powersupply_yes_or_no'), 1),
            'powersupply_default_type': get_field_value(source_data, 'PowerSupply_DefaultType', 'powersupply_default_type') or 'Speedbox (default)',
            
            # Manufacturing options
            'ul_yes_or_no': safe_bool(get_field_value(source_data, 'UL_YesOrNo', 'ul_yes_or_no', 'UL'), 1),
            'drain_holes_yes_or_no': safe_bool(get_field_value(source_data, 'DrainHoles_YesOrNo', 'drain_holes_yes_or_no'), 1),
            'pattern_yes_or_no': safe_bool(get_field_value(source_data, 'Pattern_YesOrNo', 'pattern_yes_or_no'), 1),
            'pattern_type': get_field_value(source_data, 'Pattern_Type', 'pattern_type') or 'Paper',
            'wiring_diagram_yes_or_no': safe_bool(get_field_value(source_data, 'WiringDiagram_YesOrNo', 'wiring_diagram_yes_or_no'), 1),
            'wiring_diagram_type': get_field_value(source_data, 'WiringDiagram_Type', 'wiring_diagram_type') or 'Paper',
            'plug_n_play_yes_or_no': safe_bool(get_field_value(source_data, 'PlugNPlay_YesOrNo', 'plug_n_play_yes_or_no'), 0),
            
            # Shipping
            'shipping_yes_or_no': safe_bool(get_field_value(source_data, 'Shipping_YesOrNo', 'shipping_yes_or_no'), 0),
            'shipping_multiplier': safe_decimal(get_field_value(source_data, 'Shipping_Multiplier', 'shipping_multiplier'), 1.5),
            'shipping_flat': safe_int(get_field_value(source_data, 'Shipping_Flat', 'shipping_flat')),
            
            # Additional
            'comments': get_field_value(source_data, 'Comments', 'comments', 'Notes'),
            
            # Audit fields
            'created_by': 'csv_import',
            'updated_by': 'csv_import',
            'active': True
        }
        
        # Remove None values
        cleaned_data = {k: v for k, v in mapped_data.items() if v is not None}
        return cleaned_data
    
    def insert_customer(self, customer_data: Dict) -> bool:
        """Insert customer into database"""
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
            
            # Create preference snapshot
            self.create_preference_snapshot(customer_id, customer_data)
            
            logger.info(f"Successfully imported customer: {customer_data['company_name']} (ID: {customer_id})")
            return True
            
        except mysql.connector.Error as e:
            logger.error(f"Failed to insert customer {customer_data.get('company_name', 'Unknown')}: {e}")
            self.import_stats['errors'].append({
                'customer': customer_data.get('company_name', 'Unknown'),
                'error': str(e)
            })
            return False
    
    def create_preference_snapshot(self, customer_id: int, customer_data: Dict):
        """Create initial preference snapshot"""
        try:
            preferences = {
                'import_date': datetime.now().isoformat(),
                'led_preferences': {
                    'enabled': customer_data.get('leds_yes_or_no'),
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
                    'discount': customer_data.get('discount', 0),
                    'cash_customer': customer_data.get('cash_yes_or_no'),
                    'shipping_enabled': customer_data.get('shipping_yes_or_no'),
                    'shipping_multiplier': customer_data.get('shipping_multiplier', 1.5)
                }
            }
            
            cursor = self.server_connection.cursor()
            cursor.execute("""
                INSERT INTO customer_preference_snapshots 
                (customer_id, snapshot_name, preferences_json, created_by, notes)
                VALUES (%s, %s, %s, %s, %s)
            """, (
                customer_id,
                "CSV Import Baseline",
                json.dumps(preferences),
                'csv_import',
                f"Initial import from CSV on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
            ))
            cursor.close()
            
        except Exception as e:
            logger.warning(f"Failed to create preference snapshot for customer {customer_id}: {e}")
    
    def import_customers(self, data_file: str, file_type: str = 'auto'):
        """Main import function"""
        logger.info(f"Starting customer data import from {data_file}")
        
        if not self.connect_to_database():
            return False
        
        try:
            # Load data based on file type
            if file_type == 'auto':
                file_type = 'json' if data_file.lower().endswith('.json') else 'csv'
            
            if file_type == 'csv':
                customers = self.load_csv_data(data_file)
            else:
                customers = self.load_json_data(data_file)
            
            if not customers:
                logger.error("No customer data loaded")
                return False
            
            # Import each customer
            for customer_data in customers:
                company_name = None
                
                # Try to find company name in various formats
                for key in customer_data:
                    if 'company' in key.lower() or 'name' in key.lower():
                        if customer_data[key]:
                            company_name = customer_data[key]
                            break
                
                if not company_name:
                    logger.warning(f"Skipping record with no company name: {customer_data}")
                    self.import_stats['failed_imports'] += 1
                    continue
                
                # Check for duplicates
                if self.customer_exists(company_name):
                    logger.info(f"Customer already exists, skipping: {company_name}")
                    self.import_stats['duplicate_skips'] += 1
                    continue
                
                # Map and insert
                mapped_data = self.map_customer_data(customer_data)
                
                if self.insert_customer(mapped_data):
                    self.import_stats['imported_successfully'] += 1
                else:
                    self.import_stats['failed_imports'] += 1
            
            # Commit changes
            self.server_connection.commit()
            logger.info("Import completed, changes committed")
            return True
            
        except Exception as e:
            logger.error(f"Import failed: {e}")
            if self.server_connection:
                self.server_connection.rollback()
            return False
        
        finally:
            self.disconnect_database()
    
    def print_import_summary(self):
        """Print import statistics"""
        print("\n" + "="*50)
        print("CUSTOMER IMPORT SUMMARY")
        print("="*50)
        print(f"Total records found:     {self.import_stats['total_records']}")
        print(f"Successfully imported:   {self.import_stats['imported_successfully']}")
        print(f"Duplicates skipped:      {self.import_stats['duplicate_skips']}")
        print(f"Failed imports:          {self.import_stats['failed_imports']}")
        
        if self.import_stats['total_records'] > 0:
            success_rate = (self.import_stats['imported_successfully'] / max(self.import_stats['total_records'] - self.import_stats['duplicate_skips'], 1)) * 100
            print(f"Success rate:            {success_rate:.1f}%")
        
        if self.import_stats['errors']:
            print(f"\nErrors encountered:")
            for error in self.import_stats['errors']:
                print(f"  - {error['customer']}: {error['error']}")
        
        print("="*50)

def main():
    """Main execution function"""
    if len(sys.argv) < 2:
        print("Customer CSV/JSON Import Script")
        print("Usage: python3 import_customers_csv.py <data_file> [csv|json]")
        print("")
        print("Examples:")
        print("  python3 import_customers_csv.py customers.csv")
        print("  python3 import_customers_csv.py customers.json")
        print("  python3 import_customers_csv.py data.txt csv")
        return
    
    data_file = sys.argv[1]
    file_type = sys.argv[2] if len(sys.argv) > 2 else 'auto'
    
    if not os.path.exists(data_file):
        print(f"File not found: {data_file}")
        return
    
    server_config_file = "/home/jon/Nexus/server_database_config.json"
    if not os.path.exists(server_config_file):
        print(f"Server config not found: {server_config_file}")
        return
    
    # Run import
    importer = CustomerImporter(server_config_file)
    
    if importer.import_customers(data_file, file_type):
        print("Import completed successfully!")
    else:
        print("Import failed. Check logs for details.")
    
    importer.print_import_summary()

if __name__ == "__main__":
    main()