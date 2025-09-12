# SignHouse Manufacturing System - Project Structure

## Directory Organization

```
/home/jon/Nexus/
├── CLAUDE.md                    # Claude development context and standards
├── README.md                    # Project overview and setup instructions
├── SERVER_RECOVERY.md           # System recovery procedures
│
├── backend/                     # Server-side application
│   ├── api/                     # REST API endpoints (Flask/FastAPI)
│   ├── config/                  # Configuration files
│   │   ├── email_config.json
│   │   ├── pc_database_config.json
│   │   └── server_database_config.json
│   ├── database/                # Database schema and migrations
│   │   ├── create_database_first.sql
│   │   ├── customer_addresses_schema.sql
│   │   ├── database_setup.sh
│   │   ├── enhanced_customers_schema.sql
│   │   ├── fix_address_sequence.sql
│   │   ├── sign_manufacturing_schema.sql
│   │   └── simple_addresses_schema.sql
│   └── scripts/                 # Utility and maintenance scripts
│       ├── email_system.py
│       ├── import_addresses_and_tax.py
│       ├── import_addresses_with_mapping.py
│       ├── import_customers_csv.py
│       ├── import_json_customers.py
│       ├── migrate_customers.py
│       └── simple_csv_import.py
│
├── frontend/                    # Client-side web interface
│   ├── web/                     # HTML/CSS/JS files
│   ├── components/              # Reusable UI components
│   └── assets/                  # Static assets (images, fonts, etc.)
│
├── infrastructure/              # System infrastructure
│   ├── deployment/              # Installation and setup scripts
│   │   ├── install_sign_system.sh
│   │   ├── setup_cron_jobs.sh
│   │   └── setup_external_drive.sh
│   ├── backups/                 # Backup management (DO NOT MODIFY)
│   │   └── backup_system.sh
│   └── monitoring/              # System monitoring scripts
│
├── data/                        # Data files and imports
│   ├── import/                  # Source data files
│   │   ├── Customer_addresses.csv
│   │   ├── Customers.csv
│   │   └── province_to_tax.csv
│   ├── exports/                 # Generated exports
│   └── archive/                 # Historical data and logs
│       └── customer_import.log
│
└── docs/                        # Documentation
    ├── PROJECT_STRUCTURE.md    # This file
    └── ROADMAP.md              # Development roadmap
```

## File Purposes

### Core Documentation
- **CLAUDE.md**: Development context, standards, and workflow for Claude
- **README.md**: Project overview and setup instructions for users
- **SERVER_RECOVERY.md**: System recovery and disaster recovery procedures

### Backend Components
- **api/**: REST API endpoints for web interface
- **config/**: Database connections and application configuration
- **database/**: SQL schema files and database management scripts
- **scripts/**: Utility scripts for data import, maintenance, and system operations

### Frontend Components
- **web/**: Main web interface files (HTML, CSS, JavaScript)
- **components/**: Reusable UI components for modular development
- **assets/**: Static files like images, fonts, stylesheets

### Infrastructure
- **deployment/**: System installation and configuration scripts
- **backups/**: Automated backup system (production critical - don't modify)
- **monitoring/**: System health monitoring and alerting

### Data Management
- **import/**: Source data files for initial system setup and future imports
- **exports/**: Generated reports and data exports
- **archive/**: Historical data and import logs

## Development Workflow

### Current Phase: Web Interface Development
**Next Steps:**
1. Create database connection module in `backend/config/`
2. Build REST API endpoints in `backend/api/`
3. Develop customer management interface in `frontend/web/`

### File Naming Conventions
- **Configuration**: `*_config.json`
- **Database Schema**: `*_schema.sql`
- **Import Scripts**: `import_*.py`
- **Setup Scripts**: `setup_*.sh`
- **Web Pages**: `*.html` (descriptive names)
- **API Endpoints**: `*_api.py` (resource-based)

### Development Guidelines
1. **Always use absolute paths**: `/home/jon/Nexus/...`
2. **Follow CLAUDE.md standards**: Error handling, logging, testing
3. **Test with production data**: Use actual customer database
4. **Document changes**: Update relevant files in `docs/`
5. **Backup before major changes**: Use existing backup system

### Security Considerations
- **Database configs**: Contain credentials - keep secure
- **Backup files**: Contain customer data - maintain security
- **Web interface**: Implement proper authentication
- **API endpoints**: Validate all inputs and use prepared statements

## System Integration Points

### Database: `sign_manufacturing`
- Customer management with multi-address support
- Tax calculation based on address location
- Audit trails for all business data changes
- Foreign key relationships ensuring data integrity

### External Systems
- **QuickBooks**: Future integration for accounting
- **Email System**: SMTP for customer communications
- **File Storage**: External USB drive for job files and drawings

### Network Access
- **Local**: localhost (development and local access)
- **Network**: 192.168.2.222:3306 (Windows PC access)
- **Web Interface**: Future deployment on local network

---

**Note**: This structure supports modular development, easy maintenance, and future scaling. Each component has a clear purpose and defined interfaces with other system parts.