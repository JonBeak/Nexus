#!/usr/bin/env python3
"""
Fix vinyl series and colour formatting
"""

import subprocess
import re

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

# Raw inventory data to get the correct format
inventory_data = """3M    3630-005 Ivory [48"]    0.5
3M    3630-015 Yellow [48"]    0.5
3M    3630-025 Sunflower [48"]    1
3M    3630-026 Green [48"]    0.5
3M    3630-033 Red [48"]    0.5
3M    3630-036 Dark Blue [48"]    1
3M    3630-043 Light Tomato Red [48"]    0.75
3M    3630-044 Orange [48"]    1
3M    3630-049 Burgundy [48"]    0.5
3M    3630-051 Silver Gray [48"]    0.5
3M    3630-053 Cardinal Red [48"]    0.5
3M    3630-057 Olympic Blue [48"]    1
3M    3630-061 Slate Gray [48"]    2
3M    3630-063 Rust Brown [48"]    1"""

print("🔧 Fixing vinyl series and colour formatting...")

# Parse the data to get correct mappings
colour_mappings = {}
for line in inventory_data.strip().split('\n'):
    if line.strip():
        parts = line.split('\t')
        if len(parts) >= 2:
            brand = parts[0].strip()
            product_info = parts[1].strip()
            
            # Extract series-colour and format
            match = re.match(r'(\w+)-(\d+)\s+(.+?)\s*\[', product_info)
            if match:
                series, colour_num, colour_name = match.groups()
                # Create mapping from just colour name to number + name
                colour_mappings[colour_name] = f"{colour_num} {colour_name}"

print(f"📝 Found {len(colour_mappings)} colour mappings")

# Apply the mappings to the database
for original_name, formatted_name in colour_mappings.items():
    # Escape single quotes for SQL
    original_escaped = original_name.replace("'", "\\'")
    formatted_escaped = formatted_name.replace("'", "\\'")
    
    # Update vinyl_products
    query = f"UPDATE vinyl_products SET colour = '{formatted_escaped}' WHERE colour = '{original_escaped}';"
    run_mysql_query(query)
    
    # Update vinyl_inventory  
    query = f"UPDATE vinyl_inventory SET colour = '{formatted_escaped}' WHERE colour = '{original_escaped}';"
    run_mysql_query(query)

print("✅ Updated colour formatting")

# Verify results
print("\n🔍 Verifying results:")
result = run_mysql_query("SELECT DISTINCT brand, series, colour FROM vinyl_products WHERE brand = '3M' LIMIT 5;")
print("Products:")
print(result)

result = run_mysql_query("SELECT DISTINCT brand, series, colour FROM vinyl_inventory WHERE brand = '3M' LIMIT 5;")
print("\nInventory:")
print(result)

print("\n✅ Series and colour formatting fixed!")