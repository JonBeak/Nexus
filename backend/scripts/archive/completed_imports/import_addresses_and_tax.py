#!/usr/bin/env python3
"""
Import Customer Addresses and Tax Rules
Import addresses from Customer_addresses.csv and tax rules from province_to_tax.csv
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

def generate_tax_rule_sql(tax_data):
    """Generate SQL INSERT for tax rule"""
    
    # Map province/state codes and clean up the data
    province_code = tax_data.get('Province/State_Short', '').strip()
    tax_type = tax_data.get('Tax_Type', '').strip()
    tax_percent = tax_data.get('Tax_Percent', 0.0)
    
    if not province_code or not tax_type:
        return None
    
    sql_values = {
        'province_state_code': convert_value(province_code),
        'tax_type': convert_value(tax_type),
        'tax_percent': convert_value(tax_percent, 'decimal'),
        'is_active': '1'
    }
    
    fields = list(sql_values.keys())
    values = list(sql_values.values())
    
    return f"INSERT IGNORE INTO tax_rules ({', '.join(fields)}) VALUES ({', '.join(values)});"

def generate_address_sql(address_data):
    """Generate SQL INSERT for customer address"""
    
    customer_id = address_data.get('Customer_ID')
    if not customer_id:
        return None
    
    # Determine address type flags based on your current data
    # Since your original data has PrimaryAddress_YesOrNo, we'll use that
    is_primary_flag = address_data.get('PrimaryAddress_YesOrNo', 0)
    
    # For now, we'll set addresses as both billing and shipping unless specified otherwise
    # You can adjust this logic based on your business rules
    is_primary = 1 if is_primary_flag else 0
    is_billing = 1 if is_primary_flag else 0  # Primary addresses are usually billing
    is_shipping = 1  # Most addresses can be shipping
    is_mailing = 1 if is_primary_flag else 0  # Primary addresses get mail
    
    sql_values = {
        'customer_id': convert_value(customer_id, 'int'),
        'is_primary': str(is_primary),
        'is_billing': str(is_billing),
        'is_shipping': str(is_shipping),
        'is_jobsite': '0',  # Default to false, can be updated later
        'is_mailing': str(is_mailing),
        'address_line1': convert_value(address_data.get('Address1', '').strip()),
        'address_line2': convert_value(address_data.get('Address2', '').strip()) if address_data.get('Address2', '').strip() else 'NULL',
        'city': convert_value(address_data.get('City', '').strip()),
        'province_state_long': convert_value(address_data.get('Province/State_Long', '').strip()) if address_data.get('Province/State_Long', '').strip() else 'NULL',
        'province_state_short': convert_value(address_data.get('Province/State_Short', '').strip()),
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

def import_tax_rules(tax_file):
    """Import tax rules from province_to_tax.csv"""
    
    print("=== IMPORTING TAX RULES ===")
    
    tax_data = load_json_data(tax_file)
    if not tax_data:
        print("No tax data to import")
        return False
    
    sql_statements = []
    imported_count = 0
    
    for tax_record in tax_data:
        try:
            sql = generate_tax_rule_sql(tax_record)
            if sql:
                sql_statements.append(sql)
                imported_count += 1
                print(f"Prepared tax rule: {tax_record.get('Province/State_Short')} - {tax_record.get('Tax_Type')}")
        except Exception as e:
            print(f"Error preparing tax rule {tax_record}: {e}")
    
    if not sql_statements:
        print("No valid tax rules to import")
        return False
    
    return sql_statements, imported_count

def import_addresses(address_file):
    """Import addresses from Customer_addresses.csv"""
    
    print("\n=== IMPORTING CUSTOMER ADDRESSES ===")
    
    address_data = load_json_data(address_file)
    if not address_data:
        print("No address data to import")
        return False
    
    sql_statements = []
    imported_count = 0
    
    for address_record in address_data:
        try:
            sql = generate_address_sql(address_record)
            if sql:
                sql_statements.append(sql)
                imported_count += 1
                customer_id = address_record.get('Customer_ID')
                address1 = address_record.get('Address1', '')[:30]  # Truncate for display
                print(f"Prepared address: Customer {customer_id} - {address1}...")
        except Exception as e:
            print(f"Error preparing address {address_record}: {e}")
    
    if not sql_statements:
        print("No valid addresses to import")
        return False
    
    return sql_statements, imported_count

def execute_sql(sql_statements, description):
    """Execute SQL statements"""
    
    sql_file = f"/tmp/import_{description.lower().replace(' ', '_')}.sql"
    
    print(f"\nExecuting {description}...")
    
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
    
    if len(sys.argv) != 3:
        print("Usage: python3 import_addresses_and_tax.py <tax_rules_file> <addresses_file>")
        print("Example: python3 import_addresses_and_tax.py province_to_tax.csv Customer_addresses.csv")
        return
    
    tax_file = sys.argv[1]
    address_file = sys.argv[2]
    
    # Check files exist
    for filename in [tax_file, address_file]:
        if not os.path.exists(filename):
            print(f"File not found: {filename}")
            return
    
    print("Starting Import of Tax Rules and Customer Addresses")
    print("="*60)
    
    # Import tax rules first (addresses reference them)
    tax_result = import_tax_rules(tax_file)
    if tax_result:
        tax_statements, tax_count = tax_result
        if execute_sql(tax_statements, "Tax Rules Import"):
            print(f"Imported {tax_count} tax rules")
        else:
            print("Tax rules import failed - aborting address import")
            return
    else:
        print("No tax rules to import")
    
    # Import addresses
    address_result = import_addresses(address_file)
    if address_result:
        address_statements, address_count = address_result
        if execute_sql(address_statements, "Customer Addresses Import"):
            print(f"Imported {address_count} addresses")
        else:
            print("Address import failed")
            return
    else:
        print("No addresses to import")
    
    print("\n" + "="*60)
    print("IMPORT COMPLETE!")
    print(f"Tax Rules: {tax_count if tax_result else 0}")
    print(f"Addresses: {address_count if address_result else 0}")
    
    # Show summary
    print("\nVerification queries:")
    print("sudo mysql -e \"USE sign_manufacturing; SELECT COUNT(*) as tax_rules FROM tax_rules;\"")
    print("sudo mysql -e \"USE sign_manufacturing; SELECT COUNT(*) as addresses FROM customer_addresses;\"")
    print("sudo mysql -e \"USE sign_manufacturing; SELECT * FROM customer_addresses_with_tax LIMIT 5;\"")

if __name__ == "__main__":
    main()