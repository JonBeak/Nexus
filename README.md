# Sign Manufacturing ERP System

A comprehensive production-grade ERP system for sign manufacturing businesses with advanced job estimation, inventory management, and automated workflow integration.

## 🎯 Current System Status - PRODUCTION READY

**✅ FULLY IMPLEMENTED SYSTEMS:**
- **Complete Job Estimation System** - 15 product categories with real-time pricing and comprehensive validation
- **Customer Management** - 637+ customers with preferences and multi-address support
- **Time Tracking & Payroll** - Employee time management with automated calculations
- **Inventory Management** - Vinyl products with bulk operations and low-stock alerts
- **Supply Chain Management** - Supplier management and material sourcing
- **User Authentication & RBAC** - Role-based access control with JWT tokens
- **Comprehensive Pricing Engine** - Excel formula replication with user-isolated calculations
- **Validation System** - Field-level validation with visual feedback and error prevention
- **Performance Optimization** - Infinite render loop elimination and memoization
- **Audit System** - Complete tracking of all data changes
- **Order Folder & Image Management (Phase 1.5g)** - SMB folder tracking, image uploads, crop coordinates, and print services

**🚧 IN DEVELOPMENT:**
- **Job Workflow Integration** - Estimate → Job → Materials → Invoice automation
- **Multi-Invoice Job Management** - Versioned estimates and partial billing
- **Automated Supply Chain Integration** - Material requirements from job specifications

## 🏗️ Technology Stack

### Production Architecture
- **Backend**: TypeScript/Node.js + Express (port 3001)
- **Frontend**: React + TypeScript + Vite (port 5173)
- **Database**: MySQL 8.0 sign_manufacturing with connection pooling
- **Authentication**: JWT tokens with automatic refresh
- **Real-time Updates**: WebSocket integration for live calculations

### System Integration
- **Multi-user Concurrent Access** - Session-based user isolation
- **Real-time Pricing Calculations** - Sub-second response times
- **Comprehensive API** - RESTful endpoints for all business operations
- **Advanced Caching** - 30-minute TTL for pricing data optimization

## 🎨 Production Features

### Job Estimation & Pricing System
- **15 Product Categories**: Channel Letters, Vinyl, Substrate Cut, Backer, Push Thru, Blade Sign, LED Neon, Painting, Custom, Wiring, Material Cut, UL, Shipping + Multipliers & Discounts
- **Real-time Calculations**: Excel formula replication with live pricing updates
- **User-isolated Sessions**: Multiple estimators working concurrently
- **Conflict Detection**: Save warnings for concurrent modifications
- **Comprehensive Validation**: Field-level validation with red borders and error tooltips
- **Performance Optimized**: Infinite render loops eliminated through advanced memoization
- **Flexible Data Input**: VARCHAR(255) database fields accept any string format
- **Validation-Aware Pricing**: Calculations skip invalid fields preventing errors
- **Complete Audit Trail**: All pricing changes tracked with user attribution

### Customer & Business Management
- **Customer Preferences**: Manufacturing preferences and notes per customer
- **Multi-address Support**: Billing, shipping, and multiple jobsite addresses
- **Tax Integration**: Complete tax calculation based on billing address
- **Business Rules**: Wholesale manufacturing workflow (Quote → Order → Production → Shipped)

### Inventory & Supply Chain
- **Real-time Inventory**: Current stock levels with reservation system
- **Supplier Management**: Contact management and cost tracking
- **Low Stock Alerts**: Automated reorder point notifications
- **Material Cost Tracking**: Historical pricing and supplier comparison

### Advanced Workflow Features
- **Time Management**: Employee scheduling, time tracking, and payroll integration  
- **Wage Management**: Automated payroll calculations with overtime rules
- **Role-based Access**: Owner, Manager, Designer, Production Staff permissions
- **Validation System**: useGridValidation hook with informational feedback approach
- **Performance Excellence**: Four-phase infinite render loop elimination
- **Database Flexibility**: All numeric fields support string inputs for maximum compatibility
- **Comprehensive Reporting**: Job profitability, material usage, customer analytics

## 📊 Database Architecture

### Core Business Tables (60+ tables)
```
Sign Manufacturing Database (MySQL)
├── Customer Management (8 tables)
│   ├── customers, customer_addresses, customer_preferences
│   └── customer_history, customer_communication_preferences
├── Job & Estimation System (15 tables)
│   ├── job_estimates, job_estimate_groups, job_estimate_items
│   ├── jobs, job_workflow_status, job_material_requirements
│   └── product_types (13 categories), addon_types
├── Pricing Engine (18 tables)
│   ├── vinyl_types_pricing, substrate_cut_pricing, backer_pricing
│   ├── channel_letter_types, led_types_pricing, transformer_types_pricing
│   ├── multiplier_ranges, discount_ranges
│   └── All 15 category pricing tables
├── Inventory & Supply Chain (12 tables)  
│   ├── inventory, product_standards, product_suppliers
│   ├── suppliers, supplier_cost_alerts, vinyl_products
│   └── material_categories, low_stock_items
├── Time & Payroll Management (10 tables)
│   ├── time_entries, payroll_records, work_schedules
│   ├── users, vacation_periods, company_holidays  
│   └── payroll_settings, wage_calculations
├── System Administration (8 tables)
│   ├── audit_trail, rbac_permissions, rbac_roles
│   ├── tax_rules, pricing_system_config
│   └── login_logs, user_groups
```

### Advanced Features
- **Automated Triggers**: Audit trail generation, status updates
- **Stored Procedures**: Complex business calculations
- **Views & Indexes**: Optimized queries for reporting
- **Foreign Key Constraints**: Complete referential integrity

## 🚀 Quick Start (Production System)

### Prerequisites
- Ubuntu Server 20.04+ (or similar Linux)
- Node.js 18+ and npm
- MySQL 8.0+
- 4GB+ RAM, 20GB+ storage

### Backend Setup
```bash
cd /home/jon/Nexus/backend/web
npm install
cp .env.example .env
# Configure database credentials in .env
npm run dev  # Development server on port 3001
```

### Frontend Setup  
```bash
cd /home/jon/Nexus/frontend/web
npm install
npm run dev  # Development server on port 5173
```

### Database Setup
```bash
cd /home/jon/Nexus/database/migrations
# Run migrations in order:
mysql -u root -p sign_manufacturing < 01_create_pricing_tables.sql
mysql -u root -p sign_manufacturing < 02_create_remaining_pricing_tables.sql
mysql -u root -p sign_manufacturing < 03_extend_product_types.sql
mysql -u root -p sign_manufacturing < 04_sample_pricing_data.sql
```

### Access the System
- **Frontend**: http://localhost:5173
- **API**: http://localhost:3001/api
- **Demo Users**:
  - Manager: manager/managermanager123123
  - Designer: designer/design123
  - Production Staff: staff/staff123

## 🔄 Development & Production Builds

### Dual-Build System
The backend supports **simultaneous production and development builds** for safe testing:

```bash
# Backend build structure:
/backend/web/
├── dist-production/    # Stable production build (commit 8c2a637)
├── dist-dev/          # Development build (latest code)
└── dist -> [symlink]  # Points to active build
```

### Build Management Scripts

**Rebuild Builds:**
```bash
# Rebuild production (overwrites dist-production/)
/home/jon/Nexus/infrastructure/scripts/backend-rebuild-production.sh

# Rebuild development (overwrites dist-dev/)
/home/jon/Nexus/infrastructure/scripts/backend-rebuild-dev.sh
```

**Switch Active Build:**
```bash
# Switch to production (stable, tested)
/home/jon/Nexus/infrastructure/scripts/backend-switch-to-production.sh

# Switch to development (test new features)
/home/jon/Nexus/infrastructure/scripts/backend-switch-to-dev.sh
```

**Check Which Build is Running:**
```bash
# View symlink target
readlink /home/jon/Nexus/backend/web/dist
# Output: dist-production (running production)
# Output: dist-dev (running development)
```

### Backup & Recovery

**Safe Backups:**
```bash
# Production build backup (tarball)
/home/jon/Nexus/infrastructure/backups/backend-builds/
└── dist-production-YYYYMMDD-HHMMSS-commit-8c2a637.tar.gz

# Restore from backup:
cd /home/jon/Nexus/backend/web
tar -xzf /home/jon/Nexus/infrastructure/backups/backend-builds/dist-production-*.tar.gz
```

**Rebuild from Git:**
```bash
# Nuclear option - rebuild production from known-good commit
cd /home/jon/Nexus/backend/web
git checkout 8c2a637
npm run build
mv dist dist-production
git checkout main
```

## 🔧 API Endpoints

### Core Business APIs
```
Authentication & Users:
POST   /api/auth/login          - User authentication
GET    /api/auth/me             - Current user info
POST   /api/auth/refresh        - Token refresh

Job Estimation System (Versioning Architecture):
GET    /api/job-estimation/jobs/:jobId/estimates        - List estimate versions for job
POST   /api/job-estimation/jobs/:jobId/estimates        - Create new estimate version
POST   /api/job-estimation/estimates/:id/grid-data      - Save estimate grid data
GET    /api/job-estimation/estimates/:id/grid-data      - Load estimate grid data
POST   /api/job-estimation/estimates/:id/finalize       - Finalize estimate (draft → sent/approved)
GET    /api/job-estimation/product-types                - Get product types for templates
GET    /api/job-estimation/templates/all                - Get all field prompt templates

Customer Management:
GET    /api/customers           - List customers  
POST   /api/customers           - Create customer
GET    /api/customers/:id       - Customer details
PUT    /api/customers/:id       - Update customer

Inventory & Supply Chain:
GET    /api/vinyl               - Vinyl inventory
GET    /api/suppliers           - Supplier list
GET    /api/supply-chain        - Supply chain dashboard
```

### Pricing Data APIs
```
Rate Lookup (Active):
GET    /api/pricing/all-pricing-data     - Get all pricing rates (cached 30min)
GET    /api/pricing/push-thru-assembly   - Push Thru assembly pricing
GET    /api/pricing/rates/:category      - Get rate types
GET    /api/pricing/multipliers          - Quantity multipliers
GET    /api/pricing/discounts            - Volume discounts

Admin Endpoints:
POST   /api/pricing/admin/clear-cache    - Clear pricing cache (Manager+)
GET    /api/pricing/admin/cache-stats    - Cache statistics (Manager+)

Note: Calculations performed client-side in frontend calculation engine
```

## 💼 Business Workflow

### Complete Job Lifecycle
```
1. ESTIMATION PHASE
   ├── Customer Selection (637+ customers)
   ├── Multi-product Estimation (15 categories)
   ├── Real-time Pricing Calculations
   ├── Multipliers & Discounts Applied
   └── Professional Quote Generation

2. JOB APPROVAL & CONVERSION
   ├── Estimate Approval Process
   ├── Multiple Estimate Versions (v1, v2, v3...)
   ├── Estimate → Job Conversion
   └── Material Requirements Calculation

3. PRODUCTION WORKFLOW  
   ├── Material Sourcing (Inventory + Suppliers)
   ├── Inventory Reservations
   ├── Production Scheduling
   └── Quality Control Tracking

4. INVOICING & COMPLETION
   ├── Automated Invoice Generation
   ├── Multi-invoice Support (Partial billing, Change orders)
   ├── Payment Tracking
   └── Job Completion & Archival
```

### Integration Points
- **Customer Preferences**: Automatically applied during estimation
- **Customer Preferences API**: `GET /api/customers/:id/manufacturing-preferences` returns a pref_* snapshot used by the builder layer and cached for the session
- **Tax Calculations**: Based on customer billing address using tax_rules
- **Material Sourcing**: Real-time inventory checks and supplier integration
- **Audit Trail**: Complete tracking of all business decisions

## 📊 Reporting & Analytics

### Built-in Business Intelligence
- **Job Profitability Analysis**: Real vs estimated costs
- **Customer Analytics**: Preferences, order history, profitability
- **Inventory Optimization**: Usage patterns, reorder optimization
- **Pricing Analytics**: Rate effectiveness and margin analysis
- **Employee Performance**: Time tracking and productivity metrics

### Financial Integration
- **Tax Compliance**: Complete tax calculation and reporting
- **QuickBooks Ready**: Export formats for seamless integration
- **Cost Tracking**: Material, labor, and overhead allocation
- **Margin Analysis**: Product and customer profitability

## 🔒 Security & Compliance

### Production Security
- **JWT Authentication**: Secure token-based access control
- **Role-based Permissions**: Owner, Manager, Designer, Production Staff
- **Session Management**: User-isolated calculation sessions
- **API Security**: Rate limiting and input validation
- **Database Security**: Prepared statements and connection pooling

### Data Protection
- **Complete Audit Trail**: All changes tracked with user attribution
- **Backup Strategy**: Automated database and file backups
- **Data Validation**: Comprehensive input validation and sanitization
- **Error Handling**: Graceful error management with logging

## 🎯 Recent Major Achievements - November 2025

### ✅ Code Cleanup: Session-Based Pricing System Removal (November 14, 2025)
- **Dead Code Removal**: Removed 500+ lines of abandoned session-based pricing architecture
- **Architecture Clarification**: Single clear pricing system (frontend calculations + rate lookup)
- **Files Deleted**: estimationSessionService.ts, pricingCalculationEngine.ts (~20KB)
- **Files Cleaned**: pricingCalculationController.ts (53% reduction), types/pricing.ts (90% reduction)
- **Impact**: Zero breaking changes, improved maintainability, clearer codebase
- **Details**: See CLEANUP_REPORT_2025-11-14.md for full analysis

### ✅ Phase 1.5g: Order Folder & Image Management Complete
- **SMB Folder Tracking**: Automatic folder creation with 1,978 legacy orders successfully migrated
- **Image Management API**: Upload, retrieve, delete, and organize order images with crop coordinates
- **Image Picker Modal**: React component with image grid, selection, and cropping UI
- **Print Service**: PDF generation with integrated image support and form layouts
- **Folder Organization**: Automatic movement to "1Finished" folder on order completion
- **Database Migrations**: Four migrations for folder tracking, part scope, hard due times, and crop coordinates

### ✅ Validation System Integration Complete (September 2025)
- **useGridValidation Hook**: Comprehensive field-level validation with visual feedback
- **Database Schema Flexibility**: Numeric fields converted to VARCHAR(255) for maximum compatibility
- **Informational Validation**: Shows UI feedback without blocking functionality - purely guidance-based
- **Validation-Aware Calculations**: Pricing engine intelligently skips invalid fields preventing garbage math
- **Error Prevention**: Red borders and tooltips guide users toward correct inputs

### ✅ Performance Optimization Complete (September 2025)
- **Four-Phase Render Loop Elimination**: Comprehensive memoization strategy eliminating all circular dependencies
- **EstimateTable Optimization**: React.memo and stable dependency arrays preventing unnecessary renders
- **Validation State Isolation**: Prevented validation updates from triggering infinite re-render cycles
- **Callback Optimization**: useCallback implementation with stable references
- **Production Performance**: Significant improvement in component responsiveness under high user interaction

## 🔮 Development Roadmap

### Phase 3: Complete Workflow Integration (In Progress)
- ✅ Database foundation (22 pricing tables)
- ✅ Real-time pricing calculations  
- ✅ User-isolated session management
- ✅ **MAJOR MILESTONE**: Comprehensive validation system with performance optimization
- 🚧 Job workflow automation (Estimate → Job → Materials → Invoice)
- 🚧 Multi-invoice job management
- 🚧 Automated supply chain integration

### Phase 4: Advanced Features (Planned)
- 📋 Advanced reporting dashboard
- 📋 Mobile application for job tracking
- 📋 API for third-party integrations
- 📋 Document management system
- 📋 Customer portal access

### Phase 5: Business Intelligence (Future)
- 📋 Machine learning for demand forecasting  
- 📋 Advanced workflow automation
- 📋 IoT integration for equipment monitoring
- 📋 Real-time production tracking

## 📁 Project Structure

```
/home/jon/Nexus/
├── backend/web/                 # Node.js/TypeScript API
│   ├── src/
│   │   ├── controllers/         # API request handlers
│   │   ├── services/           # Business logic layer
│   │   ├── repositories/       # Data access layer  
│   │   ├── middleware/         # Auth, RBAC, validation
│   │   ├── types/             # TypeScript definitions
│   │   └── config/            # Database configuration
│   └── package.json
├── frontend/web/               # React/TypeScript UI
│   ├── src/
│   │   ├── components/        # UI components by feature
│   │   ├── services/         # API clients
│   │   ├── contexts/         # React contexts
│   │   └── types/           # Frontend type definitions
│   └── package.json  
├── database/migrations/        # Database schema files
├── infrastructure/            # Server management scripts
├── archive/documentation/     # Archived implementation docs
└── *.md                      # Active project documentation
```

## 🛠️ Development & Maintenance

### Daily Operations
- **Automated Backups**: Database and configuration backups
- **Performance Monitoring**: API response times and database optimization
- **Error Logging**: Comprehensive application and database logging
- **User Activity**: Session management and audit trail maintenance

### System Administration
- **User Management**: Role assignment and permission management
- **Rate Management**: Pricing updates and cost adjustments
- **Supplier Management**: Contact updates and cost tracking
- **System Configuration**: Tax rules, business preferences

### Development Tools
- **TypeScript**: Full type safety across backend and frontend
- **Hot Module Replacement**: Real-time development updates
- **Database Migrations**: Version-controlled schema changes
- **API Documentation**: Comprehensive endpoint documentation

## 📞 Support & Documentation

### Active Documentation
- `README.md` - This comprehensive system overview
- `CLAUDE.md` - Development instructions and system architecture
- `JOB_ESTIMATION_ROADMAP.md` - Job workflow integration roadmap  
- `STRUCTURE.md` - Detailed system structure and components
- `SERVER_RECOVERY.md` - Disaster recovery procedures

### Archived Documentation
- `/archive/documentation/` - Completed implementation documentation
- `/archive/documentation/pricing-calculations/` - Pricing system analysis

### System Monitoring
- **Infrastructure Scripts**: `/infrastructure/scripts/` for server management
- **Database Monitoring**: Performance and optimization tools
- **Backup Verification**: Automated integrity checking

---

## 📝 License & Usage

This system is designed specifically for sign manufacturing businesses as a complete Excel replacement solution. The system handles the complete business workflow from customer management through job completion and invoicing.

**Contact**: System documentation and support available through project maintainer.

**Last Updated**: November 14, 2025 - Production-ready system with 15-category pricing engine, comprehensive validation system, performance optimization, and frontend-based real-time calculations.
