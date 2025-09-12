#!/usr/bin/env python3
"""
Simple JSON Customer Import
Import customers from JSON array file
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
    
    # String - escape quotes
    cleaned = str(value).replace("'", "''")
    return f"'{cleaned}'"

def generate_customer_sql(customer_data):
    """Generate SQL INSERT for one customer"""
    
    # Map the fields from your JSON structure
    sql_values = {
        'company_name': convert_value(customer_data.get('Company_Name')),
        'quickbooks_name': convert_value(customer_data.get('Quickbooks_Name')),
        'quickbooks_name_search': convert_value(customer_data.get('Quickbooks_NameSearch')),
        'tax_type': convert_value(customer_data.get('Tax_Type')),
        'tax_id': convert_value(customer_data.get('Tax_ID')),
        'default_turnaround': convert_value(customer_data.get('Default_Turnaround', 10), 'int'),
        'leds_yes_or_no': convert_value(customer_data.get('LEDs_YesOrNo', 1), 'int'),
        'leds_default_type': convert_value(customer_data.get('LEDs_DefaultType')),
        'wire_length': convert_value(customer_data.get('Wire_Length', 5), 'int'),
        'powersupply_yes_or_no': convert_value(customer_data.get('PowerSupply_YesOrNo', 1), 'int'),
        'powersupply_default_type': convert_value(customer_data.get('PowerSupply_DefaultType', 'Speedbox')),
        'ul_yes_or_no': convert_value(customer_data.get('UL_YesOrNo', 1), 'int'),
        'drain_holes_yes_or_no': convert_value(customer_data.get('DrainHoles_YesOrNo', 1), 'int'),
        'pattern_yes_or_no': convert_value(customer_data.get('Pattern_YesOrNo', 1), 'int'),
        'pattern_type': convert_value(customer_data.get('Pattern_Type', 'Paper')),
        'wiring_diagram_yes_or_no': convert_value(customer_data.get('WiringDiagram_YesOrNo', 1), 'int'),
        'wiring_diagram_type': convert_value(customer_data.get('WiringDiagram_Type', 'Paper')),
        'plug_n_play_yes_or_no': convert_value(customer_data.get('PlugNPlay_YesOrNo', 0), 'int'),
        'cash_yes_or_no': convert_value(customer_data.get('Cash_YesOrNo', 0), 'int'),
        'discount': convert_value(customer_data.get('Discount', 0.0), 'decimal'),
        'shipping_yes_or_no': convert_value(customer_data.get('Shipping_YesOrNo', 0), 'int'),
        'shipping_multiplier': convert_value(customer_data.get('Shipping_Multiplier', 1.5), 'decimal'),
        'shipping_flat': convert_value(customer_data.get('Shipping_Flat'), 'int'),
        'comments': convert_value(customer_data.get('Comments')),
        'created_by': "'json_import'",
        'updated_by': "'json_import'",
        'active': '1'
    }
    
    # Remove NULL values for cleaner SQL
    clean_values = {k: v for k, v in sql_values.items() if v != 'NULL'}
    
    fields = list(clean_values.keys())
    values = list(clean_values.values())
    
    return f"INSERT INTO customers ({', '.join(fields)}) VALUES ({', '.join(values)});"

def load_json_customers(json_file):
    """Load customers from JSON file"""
    
    print(f"Loading customers from {json_file}...")
    
    with open(json_file, 'r', encoding='utf-8') as f:
        content = f.read().strip()
    
    # Handle the array format - wrap in brackets if needed
    if content.startswith('{'):
        # Single object or objects separated by commas - convert to array
        if content.count('},') > 0:
            # Multiple objects separated by commas - wrap in array brackets
            content = '[' + content.rstrip(',') + ']'
        else:
            # Single object - wrap in array
            content = '[' + content + ']'
    
    try:
        customers = json.loads(content)
        print(f"Loaded {len(customers)} customers from JSON")
        return customers
    except json.JSONDecodeError as e:
        print(f"JSON parsing error: {e}")
        print(f"Content preview: {content[:200]}...")
        return []

def import_customers(json_file):
    """Import customers from JSON file"""
    
    # Load JSON data
    customers = load_json_customers(json_file)
    
    if not customers:
        print("No customers loaded!")
        return
    
    # Generate SQL
    sql_file = "/tmp/import_customers.sql"
    
    print("Generating SQL...")
    with open(sql_file, 'w') as f:
        f.write("USE sign_manufacturing;\n\n")
        
        imported_count = 0
        for customer_data in customers:
            company_name = customer_data.get('Company_Name')
            if not company_name:
                print(f"Skipping customer with no company name")
                continue
            
            try:
                sql = generate_customer_sql(customer_data)
                f.write(sql + "\n")
                imported_count += 1
                print(f"Prepared: {company_name}")
            except Exception as e:
                print(f"Error preparing {company_name}: {e}")
    
    print(f"\nPrepared {imported_count} customers for import")
    
    # Execute SQL
    print("Importing to database...")
    try:
        with open(sql_file, 'r') as f:
            sql_content = f.read()
        
        result = subprocess.run(['sudo', 'mysql'], 
                              input=sql_content,
                              text=True, 
                              capture_output=True)
        
        if result.returncode == 0:
            print("✅ Import completed successfully!")
            print(f"Imported {imported_count} customers")
        else:
            print("❌ Import failed:")
            print("STDOUT:", result.stdout)
            print("STDERR:", result.stderr)
            
            # Show some SQL for debugging
            print("\nFirst few SQL lines:")
            print(sql_content.split('\n')[:10])
            
    except Exception as e:
        print(f"Error running import: {e}")
    
    # Cleanup
    if os.path.exists(sql_file):
        os.remove(sql_file)

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 import_json_customers.py <json_file>")
        return
    
    json_file = sys.argv[1]
    
    if not os.path.exists(json_file):
        print(f"File not found: {json_file}")
        return
    
    import_customers(json_file)

if __name__ == "__main__":
    main()