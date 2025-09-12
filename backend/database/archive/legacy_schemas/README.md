# Legacy Database Schemas Archive

This directory contains database schema files that were used during initial development but have been superseded by the current production database structure.

## Archive Date: 2025-08-28

## Current Production Status ✅
- **Active Tables**: 36 tables in production database
- **Schema Evolution**: Production database evolved beyond any single schema file
- **Migration System**: Clean migration tracking in `/migrations/` directory

## Archived Files

### Original Development Schemas (3 files)
- `sign_manufacturing_schema.sql` (5.6KB) - Original comprehensive database design
  - **Status**: Superseded by production evolution
  - **Tables Designed**: ~15 tables vs 36 in production
  - **Preservation Reason**: Historical reference of original design

- `enhanced_customers_schema.sql` (10.4KB) - Enhanced customer schema design  
  - **Status**: Superseded by iterative production improvements
  - **Features**: Enhanced customer structure with QuickBooks integration
  - **Preservation Reason**: Shows customer schema evolution thinking

- `database_setup.sh` (13KB) - Initial database setup script
  - **Status**: Non-functional (references missing files)
  - **Issue**: References `/home/jon/Nexus/sign_manufacturing_schema.sql` (wrong path)
  - **Preservation Reason**: Historical setup documentation

## Current Active Schema Files
The parent directory contains the active schema infrastructure:
- `create_database_first.sql` - Simple database creation utility
- `customer_addresses_schema.sql` - Current address system schema
- `simple_addresses_schema.sql` - Simplified address schema variant
- `/migrations/` - Active migration system with incremental changes

## Notes
- These archived schemas show the evolution of database design
- Production database structure is more complex than any single design file
- Current schema is managed through incremental migrations
- Do not delete - preserve for historical analysis and design understanding

## Schema Evolution Timeline
1. **Original Design**: `sign_manufacturing_schema.sql` - Basic structure
2. **Enhanced Design**: `enhanced_customers_schema.sql` - Customer improvements  
3. **Production Evolution**: Iterative changes via migrations (current: 36 tables)
4. **Address System**: Multiple iterations via address schema files