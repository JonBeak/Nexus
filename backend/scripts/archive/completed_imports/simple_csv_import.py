#!/usr/bin/env python3
"""
Simple CSV Import using MySQL command line
No external dependencies required
"""

import csv
import json
import subprocess
import os
import sys
from typing import Dict, List

def clean_value_for_sql(value):
    """Clean value for SQL insertion"""
    if value is None or value == '':
        return 'NULL'
    
    # Escape single quotes
    cleaned = str(value).replace("'", "''")
    return f"'{cleaned}'"

def convert_to_int(value, default=None):
    """Convert value to int safely"""
    if value is None or value == '':
        return default
    try:
        return int(float(str(value)))
    except (ValueError, TypeError):
        return default

def convert_to_decimal(value, default=0.0):
    """Convert value to decimal safely"""
    if value is None or value == '':
        return default
    try:
        return float(str(value))
    except (ValueError, TypeError):
        return default

def convert_to_bool(value, default=0):
    """Convert value to boolean (0/1)"""
    if value is None or value == '':
        return default
    if isinstance(value, bool):
        return 1 if value else 0
    if str(value).lower() in ['true', '1', 'yes', 'y']:
        return 1
    return 0

def load_csv_data(csv_file: str) -> List[Dict]:
    """Load data from CSV file"""
    customers = []
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        # Detect delimiter
        sample = f.read(1024)
        f.seek(0)
        
        delimiter = ','
        if ';' in sample and sample.count(';') > sample.count(','):
            delimiter = ';'
        elif '\t' in sample:
            delimiter = '\t'
        
        reader = csv.DictReader(f, delimiter=delimiter)
        
        for row in reader:
            # Clean column names
            clean_row = {}
            for key, value in row.items():
                clean_key = key.strip().replace(' ', '_').replace('/', '_')
                clean_row[clean_key] = value.strip() if value else None
            customers.append(clean_row)
    
    return customers

def map_customer_data(source_data: Dict) -> Dict:
    """Map source data to our schema"""
    
    def get_field_value(data, *possible_names):
        for name in possible_names:
            if name in data and data[name]:
                return data[name]
        return None
    
    return {
        'company_name': get_field_value(source_data, 'Company_Name', 'company_name', 'CompanyName'),
        'quickbooks_name': get_field_value(source_data, 'Quickbooks_Name', 'quickbooks_name'),
        'quickbooks_name_search': get_field_value(source_data, 'Quickbooks_NameSearch', 'quickbooks_name_search'),
        'tax_type': get_field_value(source_data, 'Tax_Type', 'tax_type'),
        'tax_id': get_field_value(source_data, 'Tax_ID', 'tax_id'),
        'default_turnaround': convert_to_int(get_field_value(source_data, 'Default_Turnaround', 'default_turnaround'), 10),
        'leds_yes_or_no': convert_to_bool(get_field_value(source_data, 'LEDs_YesOrNo', 'leds_yes_or_no'), 1),
        'leds_default_type': get_field_value(source_data, 'LEDs_DefaultType', 'leds_default_type'),
        'wire_length': convert_to_int(get_field_value(source_data, 'Wire_Length', 'wire_length'), 5),
        'powersupply_yes_or_no': convert_to_bool(get_field_value(source_data, 'PowerSupply_YesOrNo', 'powersupply_yes_or_no'), 1),
        'powersupply_default_type': get_field_value(source_data, 'PowerSupply_DefaultType', 'powersupply_default_type') or 'Speedbox (default)',
        'ul_yes_or_no': convert_to_bool(get_field_value(source_data, 'UL_YesOrNo', 'ul_yes_or_no'), 1),
        'drain_holes_yes_or_no': convert_to_bool(get_field_value(source_data, 'DrainHoles_YesOrNo', 'drain_holes_yes_or_no'), 1),
        'pattern_yes_or_no': convert_to_bool(get_field_value(source_data, 'Pattern_YesOrNo', 'pattern_yes_or_no'), 1),
        'pattern_type': get_field_value(source_data, 'Pattern_Type', 'pattern_type') or 'Paper',
        'wiring_diagram_yes_or_no': convert_to_bool(get_field_value(source_data, 'WiringDiagram_YesOrNo', 'wiring_diagram_yes_or_no'), 1),
        'wiring_diagram_type': get_field_value(source_data, 'WiringDiagram_Type', 'wiring_diagram_type') or 'Paper',
        'plug_n_play_yes_or_no': convert_to_bool(get_field_value(source_data, 'PlugNPlay_YesOrNo', 'plug_n_play_yes_or_no'), 0),
        'cash_yes_or_no': convert_to_bool(get_field_value(source_data, 'Cash_YesOrNo', 'cash_yes_or_no'), 0),
        'discount': convert_to_decimal(get_field_value(source_data, 'Discount', 'discount'), 0.0),
        'shipping_yes_or_no': convert_to_bool(get_field_value(source_data, 'Shipping_YesOrNo', 'shipping_yes_or_no'), 0),
        'shipping_multiplier': convert_to_decimal(get_field_value(source_data, 'Shipping_Multiplier', 'shipping_multiplier'), 1.5),
        'shipping_flat': convert_to_int(get_field_value(source_data, 'Shipping_Flat', 'shipping_flat')),
        'comments': get_field_value(source_data, 'Comments', 'comments'),
    }

def generate_insert_sql(customer_data: Dict) -> str:
    """Generate SQL INSERT statement"""
    
    # Filter out None values and prepare for SQL
    sql_data = {}
    for key, value in customer_data.items():
        if value is not None:
            if isinstance(value, str):
                sql_data[key] = f"'{value.replace(chr(39), chr(39)+chr(39))}'"  # Escape quotes
            elif isinstance(value, (int, float)):
                sql_data[key] = str(value)
            else:
                sql_data[key] = f"'{str(value)}'"
    
    # Add audit fields
    sql_data['created_by'] = "'csv_import'"
    sql_data['updated_by'] = "'csv_import'"
    sql_data['active'] = '1'
    
    fields = list(sql_data.keys())
    values = list(sql_data.values())
    
    return f"INSERT INTO customers ({', '.join(fields)}) VALUES ({', '.join(values)});"

def import_customers(csv_file: str):
    """Import customers from CSV"""
    
    print(f"Loading customers from {csv_file}...")
    
    # Load CSV data
    customers = load_csv_data(csv_file)
    print(f"Found {len(customers)} customers in CSV")
    
    if not customers:
        print("No customers found!")
        return
    
    # Generate SQL file
    sql_file = "/tmp/import_customers.sql"
    
    with open(sql_file, 'w') as f:
        f.write("USE sign_manufacturing;\n\n")
        
        imported_count = 0
        for customer_data in customers:
            mapped_data = map_customer_data(customer_data)
            
            company_name = mapped_data.get('company_name')
            if not company_name:
                print(f"Skipping customer with no company name: {customer_data}")
                continue
            
            try:
                sql = generate_insert_sql(mapped_data)
                f.write(sql + "\n")
                imported_count += 1
                print(f"Prepared: {company_name}")
            except Exception as e:
                print(f"Error preparing {company_name}: {e}")
    
    print(f"\nPrepared {imported_count} customers for import")
    
    # Execute SQL file
    print("Importing to database...")
    try:
        result = subprocess.run(['sudo', 'mysql'], 
                              input=open(sql_file).read(),
                              text=True, 
                              capture_output=True)
        
        if result.returncode == 0:
            print("✅ Import completed successfully!")
            print(f"Imported {imported_count} customers")
        else:
            print("❌ Import failed:")
            print(result.stderr)
    except Exception as e:
        print(f"Error running import: {e}")
    
    # Cleanup
    os.remove(sql_file)

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 simple_csv_import.py <csv_file>")
        return
    
    csv_file = sys.argv[1]
    
    if not os.path.exists(csv_file):
        print(f"File not found: {csv_file}")
        return
    
    import_customers(csv_file)

if __name__ == "__main__":
    main()