#!/usr/bin/env python3
"""
Rebuild vinyl series and colour formatting from original data
"""

import subprocess
import re
from collections import defaultdict

def run_mysql_query(query):
    """Execute MySQL query"""
    try:
        result = subprocess.run([
            'sudo', 'mysql', 'sign_manufacturing', '-e', query
        ], capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"MySQL Error: {e.stderr}")
        return None

def get_original_data():
    """Get the original inventory data from the import script"""
    with open('/home/jon/Nexus/backend/scripts/import_vinyl_individual.py', 'r') as f:
        content = f.read()
    
    # Extract the inventory_data string
    start = content.find('inventory_data = """') + len('inventory_data = """')
    end = content.find('"""', start)
    return content[start:end].strip()

print("🔧 Rebuilding vinyl series and colour formatting...")

# Get original data
original_data = get_original_data()
lines = [line for line in original_data.split('\n') if line.strip()]

print(f"📝 Processing {len(lines)} original entries...")

# Build mappings from original data
colour_mappings = {}
series_mappings = {}

for line in lines:
    parts = line.split('\t')
    if len(parts) >= 2:
        brand = parts[0].strip()
        product_info = parts[1].strip()
        
        # Parse different formats
        if brand == '3M':
            # Format: 3630-005 Ivory [48"]
            match = re.match(r'(\w+)-(\w+)\s+(.+?)\s*\[', product_info)
            if match:
                series, colour_num, colour_name = match.groups()
                series_mappings[f"{brand}|{series}-{colour_num} {colour_name}"] = series
                colour_mappings[f"{brand}|{colour_name}"] = f"{colour_num} {colour_name}"
        
        elif brand == 'Metamark':
            # Format: MT-600 White [48"]
            match = re.match(r'(MT)-(\w+)\s+(.+?)\s*\[', product_info)
            if match:
                series_prefix, series_num, colour_name = match.groups()
                series = f"{series_prefix}-{series_num}"
                series_mappings[f"{brand}|{series} {colour_name}"] = series
                colour_mappings[f"{brand}|{colour_name}"] = f"{series_num} {colour_name}"
        
        elif brand == 'Avery':
            # Formats: PC500-774, PR800-190, SC950-103, UC900-440, etc.
            match = re.match(r'([A-Z]+\d+)-(\w+)\s+(.+?)\s*\[', product_info)
            if match:
                series, colour_num, colour_name = match.groups()
                series_mappings[f"{brand}|{series}-{colour_num} {colour_name}"] = series
                colour_mappings[f"{brand}|{colour_name}"] = f"{colour_num} {colour_name}"

print(f"📊 Built {len(colour_mappings)} colour mappings and {len(series_mappings)} series mappings")

# Apply colour mappings
print("🎨 Updating colour formatting...")
updated_colours = 0
for key, formatted_colour in colour_mappings.items():
    brand, original_colour = key.split('|', 1)
    
    # Escape quotes for SQL
    brand_escaped = brand.replace("'", "\\'")
    original_escaped = original_colour.replace("'", "\\'")
    formatted_escaped = formatted_colour.replace("'", "\\'")
    
    # Update vinyl_products
    query = f"UPDATE vinyl_products SET colour = '{formatted_escaped}' WHERE brand = '{brand_escaped}' AND colour = '{original_escaped}';"
    result = run_mysql_query(query)
    
    # Update vinyl_inventory
    query = f"UPDATE vinyl_inventory SET colour = '{formatted_escaped}' WHERE brand = '{brand_escaped}' AND colour = '{original_escaped}';"
    result = run_mysql_query(query)
    
    updated_colours += 1

print(f"✅ Updated {updated_colours} colour formats")

# Verify results
print("\n🔍 Verifying results:")
print("\n3M Products:")
result = run_mysql_query("SELECT DISTINCT series, colour FROM vinyl_products WHERE brand = '3M' ORDER BY colour LIMIT 5;")
print(result)

print("\nAvery Products:")
result = run_mysql_query("SELECT DISTINCT series, colour FROM vinyl_products WHERE brand = 'Avery' ORDER BY colour LIMIT 5;")
print(result)

print("\nMetamark Products:")
result = run_mysql_query("SELECT DISTINCT series, colour FROM vinyl_products WHERE brand = 'Metamark' ORDER BY colour LIMIT 3;")
print(result)

print("\n✅ Series and colour formatting completed!")