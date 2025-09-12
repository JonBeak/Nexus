#!/usr/bin/env python3
"""
Import Customer Addresses with ID Mapping
Maps original Customer_IDs from PC to new auto-generated customer_ids
"""

import json
import subprocess
import os
import sys

def convert_value(value, field_type='string'):
    """Convert and clean values for SQL"""
    if value is None or value == '':
        return 'NULL'
    
    if field_type == 'int':
        try:
            return str(int(float(value)))
        except (ValueError, TypeError):
            return 'NULL'
    
    if field_type == 'decimal':
        try:
            return str(float(value))
        except (ValueError, TypeError):
            return '0.0'
    
    if field_type == 'bool':
        if isinstance(value, bool):
            return '1' if value else '0'
        if str(value).lower() in ['true', '1', 'yes', 'y']:
            return '1'
        return '0'
    
    # String - escape quotes
    cleaned = str(value).replace("'", "''")
    return f"'{cleaned}'"

def load_json_data(filename):
    """Load data from JSON format file"""
    print(f"Loading data from {filename}...")
    
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read().strip()
    
    # Handle the array format - wrap in brackets if needed
    if content.startswith('{'):
        if content.count('},') > 0:
            content = '[' + content.rstrip(',') + ']'
        else:
            content = '[' + content + ']'
    
    try:
        data = json.loads(content)
        print(f"Loaded {len(data)} records from {filename}")
        return data
    except json.JSONDecodeError as e:
        print(f"JSON parsing error in {filename}: {e}")
        return []

def create_customer_id_mapping():
    """Create mapping between original Customer_IDs and new customer_ids"""
    print("Creating customer ID mapping...")
    
    # Load original customers data to get the mapping
    customers = load_json_data('Customers.csv')
    if not customers:
        print("Could not load customers data for mapping")
        return {}
    
    # Create mapping: original_id -> company_name
    original_to_company = {}
    for customer in customers:
        original_id = customer.get('Customer_ID')
        company_name = customer.get('Company_Name')
        if original_id and company_name:
            original_to_company[original_id] = company_name
    
    print(f"Found {len(original_to_company)} customers in original data")
    
    # Get mapping: company_name -> new_customer_id from database
    try:
        result = subprocess.run(['sudo', 'mysql', '-e', 
                               'USE sign_manufacturing; SELECT customer_id, company_name FROM customers;'], 
                              capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"Failed to query customers: {result.stderr}")
            return {}
        
        lines = result.stdout.strip().split('\n')[1:]  # Skip header
        company_to_new_id = {}
        
        for line in lines:
            parts = line.split('\t', 1)  # Split on first tab only
            if len(parts) == 2:
                new_id, company_name = parts
                company_to_new_id[company_name] = int(new_id)
        
        print(f"Found {len(company_to_new_id)} customers in database")
        
        # Create final mapping: original_id -> new_id
        id_mapping = {}
        for original_id, company_name in original_to_company.items():
            if company_name in company_to_new_id:
                id_mapping[original_id] = company_to_new_id[company_name]
            else:
                print(f"Warning: Company '{company_name}' not found in database")
        
        print(f"Created mapping for {len(id_mapping)} customers")
        return id_mapping
        
    except Exception as e:
        print(f"Error creating customer mapping: {e}")
        return {}

def generate_address_sql(address_data, customer_id_mapping, customer_sequence_counters):
    """Generate SQL INSERT for customer address with ID mapping and sequence calculation"""
    
    original_customer_id = address_data.get('Customer_ID')
    if not original_customer_id:
        return None
    
    # Map to new customer_id
    new_customer_id = customer_id_mapping.get(original_customer_id)
    if not new_customer_id:
        print(f"Warning: No mapping found for original customer_id {original_customer_id}")
        return None
    
    # Calculate sequence number for this customer
    if new_customer_id not in customer_sequence_counters:
        customer_sequence_counters[new_customer_id] = 1
    else:
        customer_sequence_counters[new_customer_id] += 1
    
    sequence_number = customer_sequence_counters[new_customer_id]
    
    # Determine address type flags based on your current data
    is_primary_flag = address_data.get('PrimaryAddress_YesOrNo', 0)
    
    # For now, we'll set addresses as both billing and shipping unless specified otherwise
    is_primary = 1 if is_primary_flag else 0
    is_billing = 1 if is_primary_flag else 0  # Primary addresses are usually billing
    is_shipping = 1  # Most addresses can be shipping
    is_mailing = 1 if is_primary_flag else 0  # Primary addresses get mail
    
    # Handle empty address fields with defaults
    address_line1 = address_data.get('Address1', '').strip()
    city = address_data.get('City', '').strip()
    province_state_short = address_data.get('Province/State_Short', '').strip()
    
    # Provide default values for required fields if empty
    if not address_line1:
        address_line1 = 'Address not provided'
    if not city:
        city = 'City not provided'
    if not province_state_short:
        province_state_short = 'ON'  # Default to Ontario
    
    sql_values = {
        'customer_id': str(new_customer_id),  # Use mapped ID
        'customer_address_sequence': str(sequence_number),  # Add sequence number
        'is_primary': str(is_primary),
        'is_billing': str(is_billing),
        'is_shipping': str(is_shipping),
        'is_jobsite': '0',  # Default to false, can be updated later
        'is_mailing': str(is_mailing),
        'address_line1': convert_value(address_line1),
        'address_line2': convert_value(address_data.get('Address2', '').strip()) if address_data.get('Address2', '').strip() else 'NULL',
        'city': convert_value(city),
        'province_state_long': convert_value(address_data.get('Province/State_Long', '').strip()) if address_data.get('Province/State_Long', '').strip() else 'NULL',
        'province_state_short': convert_value(province_state_short),
        'postal_zip': convert_value(address_data.get('Postal/Zip', '').strip()),
        'tax_override_percent': convert_value(address_data.get('Tax'), 'decimal') if address_data.get('Tax', 0) != 0 else 'NULL',
        'tax_override_reason': convert_value('Address-specific tax rate') if address_data.get('Tax', 0) != 0 else 'NULL',
        'use_province_tax': '0' if address_data.get('Tax', 0) != 0 else '1',
        'is_active': '1',
        'comments': convert_value(address_data.get('Comments', '').strip()) if address_data.get('Comments', '').strip() else 'NULL',
        'created_by': "'address_import'",
        'updated_by': "'address_import'"
    }
    
    # Remove NULL values for cleaner SQL
    clean_values = {k: v for k, v in sql_values.items() if v != 'NULL'}
    
    fields = list(clean_values.keys())
    values = list(clean_values.values())
    
    return f"INSERT INTO customer_addresses ({', '.join(fields)}) VALUES ({', '.join(values)});"

def import_addresses(address_file):
    """Import addresses from Customer_addresses.csv with ID mapping"""
    
    print("=== IMPORTING CUSTOMER ADDRESSES WITH ID MAPPING ===")
    
    # Create customer ID mapping
    customer_id_mapping = create_customer_id_mapping()
    if not customer_id_mapping:
        print("Failed to create customer ID mapping - aborting import")
        return False
    
    address_data = load_json_data(address_file)
    if not address_data:
        print("No address data to import")
        return False
    
    sql_statements = []
    imported_count = 0
    skipped_count = 0
    customer_sequence_counters = {}  # Track sequence numbers per customer
    
    for address_record in address_data:
        try:
            sql = generate_address_sql(address_record, customer_id_mapping, customer_sequence_counters)
            if sql:
                sql_statements.append(sql)
                imported_count += 1
                original_customer_id = address_record.get('Customer_ID')
                new_customer_id = customer_id_mapping.get(original_customer_id)
                sequence_num = customer_sequence_counters.get(new_customer_id, 0)
                address1 = address_record.get('Address1', '')[:30]
                print(f"Mapped address: Original Customer {original_customer_id} -> New Customer {new_customer_id} (seq {sequence_num}) - {address1}...")
            else:
                skipped_count += 1
        except Exception as e:
            print(f"Error preparing address {address_record}: {e}")
            skipped_count += 1
    
    print(f"Prepared {imported_count} addresses, skipped {skipped_count}")
    
    if not sql_statements:
        print("No valid addresses to import")
        return False
    
    return sql_statements, imported_count

def execute_sql(sql_statements, description):
    """Execute SQL statements"""
    
    sql_file = f"/tmp/import_{description.lower().replace(' ', '_')}.sql"
    
    print(f"Executing {description}...")
    
    try:
        with open(sql_file, 'w') as f:
            f.write("USE sign_manufacturing;\n\n")
            f.write("SET foreign_key_checks = 0;\n")  # Temporarily disable FK checks
            for sql in sql_statements:
                f.write(sql + "\n")
            f.write("SET foreign_key_checks = 1;\n")  # Re-enable FK checks
        
        # Execute SQL
        with open(sql_file, 'r') as f:
            sql_content = f.read()
        
        result = subprocess.run(['sudo', 'mysql'], 
                              input=sql_content,
                              text=True, 
                              capture_output=True)
        
        if result.returncode == 0:
            print(f"✅ {description} completed successfully!")
            return True
        else:
            print(f"❌ {description} failed:")
            print("STDERR:", result.stderr)
            if result.stdout:
                print("STDOUT:", result.stdout)
            return False
            
    except Exception as e:
        print(f"Error executing {description}: {e}")
        return False
    
    finally:
        # Cleanup
        if os.path.exists(sql_file):
            os.remove(sql_file)

def main():
    """Main import function"""
    
    if len(sys.argv) != 2:
        print("Usage: python3 import_addresses_with_mapping.py <addresses_file>")
        print("Example: python3 import_addresses_with_mapping.py Customer_addresses.csv")
        return
    
    address_file = sys.argv[1]
    
    # Check files exist
    if not os.path.exists(address_file):
        print(f"File not found: {address_file}")
        return
    
    print("Starting Import of Customer Addresses with ID Mapping")
    print("="*60)
    
    # Import addresses with mapping
    address_result = import_addresses(address_file)
    if address_result:
        address_statements, address_count = address_result
        if execute_sql(address_statements, "Customer Addresses Import"):
            print(f"Successfully imported {address_count} addresses")
        else:
            print("Address import failed")
            return
    else:
        print("No addresses to import")
    
    print("\n" + "="*60)
    print("IMPORT COMPLETE!")
    print(f"Addresses: {address_count if address_result else 0}")
    
    # Show summary
    print("\nVerification queries:")
    print("sudo mysql -e \"USE sign_manufacturing; SELECT COUNT(*) as addresses FROM customer_addresses;\"")
    print("sudo mysql -e \"USE sign_manufacturing; SELECT c.company_name, ca.address_line1, ca.city FROM customer_addresses ca JOIN customers c ON ca.customer_id = c.customer_id LIMIT 5;\"")

if __name__ == "__main__":
    main()