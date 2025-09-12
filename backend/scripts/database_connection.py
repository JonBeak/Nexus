#!/usr/bin/env python3
"""
Simple database connection module for Python scripts
"""

import mysql.connector
import json
import os

def get_connection():
    """Get MySQL database connection"""
    try:
        # Try to read config from JSON file
        config_path = '/home/jon/Nexus/backend/config/server_database_config.json'
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                config = json.load(f)
                return mysql.connector.connect(
                    host=config.get('host', 'localhost'),
                    user=config.get('user', 'root'),
                    password=config.get('password', ''),
                    database=config.get('database', 'sign_manufacturing'),
                    charset='utf8mb4',
                    autocommit=False
                )
        else:
            # Fallback to default config
            return mysql.connector.connect(
                host='localhost',
                user='root',
                password='',
                database='sign_manufacturing',
                charset='utf8mb4',
                autocommit=False
            )
    except Exception as e:
        print(f"Database connection error: {e}")
        raise