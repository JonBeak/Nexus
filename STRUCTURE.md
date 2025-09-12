# SignHouse Manufacturing System - Codebase Structure & I/O Documentation

## Overview
A comprehensive sign manufacturing business management system with web interface, database backend, and automated infrastructure.

## Project Structure

```
/home/jon/Nexus/
├── backend/          # Backend services and database
├── frontend/         # Web interface
├── infrastructure/   # Deployment and management scripts
├── data/            # Import and archive data
└── CLAUDE.md        # Development context and guidelines
```

## Backend Components

### 🔷 API Server (`backend/web/src/`)

#### `server.ts` - Main Express Server
- **Input**: Environment variables (PORT, CORS_ORIGIN)
- **Output**: Express server on port 3001
- **Functions**:
  - Initializes Express app with CORS, JSON parsing
  - Mounts route handlers for /api/auth, /api/customers, /api/time
  - Health check endpoint at /api/health
  - Tests database connection on startup
- **Dependencies**: express, cors, dotenv, database config, route modules

#### `routes/auth.ts` - Authentication Routes
- **Endpoints**:
  - `POST /api/auth/login` - User login
  - `POST /api/auth/refresh` - Refresh access token
  - `GET /api/auth/me` - Get current user (requires auth)
- **Middleware**: authenticateToken for protected routes
- **Output**: JWT tokens, user data

#### `routes/customers.ts` - Customer Management Routes
- **Endpoints**:
  - `GET /api/customers` - List customers with pagination/search
    - Input: page, limit, search, include_inactive params
    - Output: Customer array with pagination info
  - `GET /api/customers/:id` - Get single customer details
    - Output: Customer data with addresses
  - `POST /api/customers` - Create new customer
    - Input: Customer data (company_name required)
    - Output: Created customer object
  - `PUT /api/customers/:id` - Update customer
    - Input: Updated customer fields
    - Output: Success message
  - `POST /api/customers/:id/deactivate` - Soft delete customer
  - `POST /api/customers/:id/reactivate` - Restore customer
  
- **Address Management**:
  - `GET /api/customers/:id/addresses` - Get customer addresses
  - `POST /api/customers/:id/addresses` - Add new address
  - `PUT /api/customers/:id/addresses/:addressId` - Update address
  - `DELETE /api/customers/:id/addresses/:addressId` - Delete address
  - `POST /api/customers/:id/addresses/:addressId/make-primary` - Set primary address
  
- **Lookup Data**:
  - `GET /api/customers/led-types` - Get LED product list
  - `GET /api/customers/power-supply-types` - Get power supply list
  - `GET /api/customers/provinces-states` - Get provinces/states for dropdowns
  - `GET /api/customers/provinces-tax` - Get tax rates by province

- **Authorization**: Role-based (manager, designer, production_staff)

#### `controllers/authController.ts` - Authentication Logic
- **Functions**:
  - `login()` - Validates credentials, generates tokens
    - Input: username, password
    - Output: accessToken, refreshToken, user data
    - Process: bcrypt password check, JWT generation, refresh token storage
  - `getCurrentUser()` - Returns authenticated user
    - Input: User from request (via middleware)
    - Output: User data without sensitive fields
  - `refreshToken()` - Generates new access token
    - Input: refreshToken
    - Output: New accessToken, rotated refreshToken
    - Process: Validates refresh token, generates new tokens

#### `middleware/auth.ts` - Authentication Middleware
- **Function**: `authenticateToken()`
  - Input: JWT from Authorization header
  - Output: Attaches user to request or returns 401/403
  - Process: JWT verification, user lookup from database

#### `config/database.ts` - Database Configuration
- **Functions**:
  - `pool` - MySQL connection pool
  - `query()` - Execute SQL queries
    - Input: SQL string, parameters array
    - Output: Query results
  - `testConnection()` - Verify database connectivity
    - Output: Boolean success status
- **Config**: Uses environment variables for connection params

### 🔷 Database Scripts (`backend/scripts/`)

#### Import Scripts
- `import_customers_csv.py` - Import customers from CSV
- `import_addresses_with_mapping.py` - Import addresses with tax mapping
- `import_json_customers.py` - Import from JSON format
- `migrate_customers.py` - Migrate between database schemas
- **Common Pattern**:
  - Input: CSV/JSON file path
  - Output: Database records, import log
  - Process: Data validation, duplicate checking, transaction handling

#### `email_system.py` - Email Management
- Input: Customer email data
- Output: Formatted email records in database
- Process: Email validation, preference handling

### 🔷 Database Schema (`backend/database/`)

#### SQL Schema Files
- `sign_manufacturing_schema.sql` - Main database schema
- `enhanced_customers_schema.sql` - Customer table structure
- `customer_addresses_schema.sql` - Address management
- `create_database_first.sql` - Initial database setup
- **Tables**: customers, customer_addresses, provinces_tax, leds, power_supplies, users

## Frontend Components

### 🔷 React Application (`frontend/web/src/`)

#### `App.tsx` - Main Application Router (135 lines)
- **Purpose**: Central routing and authentication wrapper
- **State**: user, isLoading
- **Functions**:
  - `checkAuth()` - Validates tokens, handles refresh
  - `handleLogin()` - Sets user and navigates to dashboard
  - `handleLogout()` - Clears tokens and redirects
- **Routes**: /login, /dashboard, /customers
- **Auth Flow**: Token validation with automatic refresh

#### Component Organization

##### Authentication Components (`components/auth/`)
- **`SimpleLogin.tsx`** - Login Form Component
  - State: credentials, isLoading, error
  - API: POST to /api/auth/login
  - Output: Stores tokens, calls onLogin callback
  - Features: Demo account display, error handling

##### Customer Components (`components/customers/`)
- **`SimpleCustomerList.tsx`** (541 lines) - Customer Management Interface
  - State: customers, search, filters, pagination, selectedCustomer
  - API: customerApi.getCustomers(), create, update, delete
  - Features: Search, pagination, add/edit/view customers
  - Dependencies: Imports CustomerDetailsModal
  
- **`CustomerDetailsModal.tsx`** (265 lines) - Main Customer Modal Container
  - Props: customer, onClose
  - State: modal orchestration, data fetching
  - Features: Modal shell, component coordination
  - Dependencies: Imports CustomerForm, AddressManager, ConfirmationModals
  
- **`CustomerForm.tsx`** (282 lines) - Customer Information Form
  - Props: formData, onUpdate, ledTypes, powerSupplyTypes, isEditing, etc.
  - State: form validation, LED/power supply selections
  - API: Customer update operations
  - Features: Basic info, preferences, comments, product defaults
  
- **`AddressManager.tsx`** (519 lines) - Address CRUD Operations
  - Props: addresses, customerId, provincesStates, showDeactivated, etc.
  - State: address editing, province selection, confirmations
  - API: Address create, update, delete, reactivate
  - Features: Address list, add/edit forms, primary address management
  
- **`ConfirmationModals.tsx`** (117 lines) - Confirmation Dialogs
  - Props: deleteConfirmation, deactivateConfirmation, callbacks
  - Features: Address deletion and customer deactivation confirmations
  
- **`types.ts`** (90 lines) - Shared TypeScript Interfaces
  - Exports: LedType, PowerSupplyType, Customer interfaces
  - Purpose: Prevents duplication, ensures type consistency

##### Time Management Components (`components/time/`)
- **`TimeTracking.tsx`** (359 lines) - Main Time Tracking Container
  - Props: user
  - State: data fetching, component coordination
  - API: GET/POST to /api/time endpoints
  - Features: Component orchestration, data management
  - Dependencies: Imports TimeClockDisplay, WeeklySummary, EditRequestForm, NotificationsModal
  
- **`TimeClockDisplay.tsx`** (89 lines) - Clock In/Out Interface
  - Props: clockedIn, currentEntry, onClockIn, onClockOut
  - State: current time display, clock actions
  - Features: Current status, clock buttons, time display
  
- **`WeeklySummary.tsx`** (162 lines) - Weekly Hours Display
  - Props: currentWeek, weekData, onWeekChange, user, onEditRequest
  - State: week navigation, summary calculations
  - Features: Week navigation, hours summary, edit request buttons
  
- **`EditRequestForm.tsx`** (189 lines) - Time Edit Request Form
  - Props: showEditForm, selectedEntry, user, onClose, onSubmit
  - State: form data, validation, edit type selection
  - Features: Edit/delete requests, reason entry, date/time modification
  
- **`NotificationsModal.tsx`** (118 lines) - Notifications Display
  - Props: showNotifications, notifications, onClose, onMarkAsRead
  - State: notification filtering, read status
  - Features: Notification list, mark as read, filtering
  
- **`TimeApprovals.tsx`** (388 lines) - Manager Time Approval Interface
  - Props: user
  - State: editRequests, selectedRequest, reviewerNote
  - API: GET/PUT to /api/time/edit-requests
  - Features: Approve/reject requests, add notes

##### Dashboard Components (`components/dashboard/`)
- **`SimpleDashboard.tsx`** - Main Dashboard Hub
  - Props: user, onLogout
  - State: activeModule
  - Features: Role-based module display, quick actions
  - Dependencies: Imports TimeTracking and TimeApprovals

#### `services/api.ts` - API Client Service
- **Functions**:
  - `customerApi.getCustomers()` - Fetch customer list
  - `customerApi.getCustomer()` - Get single customer
  - `customerApi.updateCustomer()` - Update customer data
  - `customerApi.createCustomer()` - Create new customer
- **Auth**: Automatic token attachment to requests
- **Error Handling**: Token refresh on 401 responses

#### `contexts/AuthContext.tsx` - Authentication Context
- **State**: user, tokens, isAuthenticated
- **Functions**: login, logout, refreshToken
- **Provider**: Wraps app for global auth state

## Infrastructure

### 🔷 Server Management Scripts (`infrastructure/scripts/`)

#### `start-servers.sh` - Start Application Servers
- **Process**:
  1. Kill existing server processes
  2. Start backend on port 3001
  3. Start frontend on port 5173
  4. Save PIDs for management
- **Output**: Server URLs, PID files, log locations

#### `stop-servers.sh` - Stop Application Servers
- **Process**: Read PIDs from temp files, kill processes
- **Output**: Confirmation of stopped services

#### `status-servers.sh` - Check Server Status
- **Process**: Check if PIDs are running
- **Output**: Server status (running/stopped)

### 🔷 Backup System (`infrastructure/backups/`)

#### `backup_system.sh` - Automated Database Backup
- **Schedule**: Daily via cron
- **Process**:
  1. MySQL dump to timestamped file
  2. Compress with gzip
  3. Copy to multiple retention tiers
  4. Clean old backups per retention policy
- **Output**: Backup files in /backup directories
- **Retention**: 4-tier system (daily, weekly, monthly, yearly)

#### `backup_monitor.sh` - Backup Health Check
- **Process**: Verify backup files, check disk space
- **Output**: Status report, alerts if issues

## Data Flow Summary

### Customer Creation Flow
1. **Frontend**: User fills form → `App.tsx` → `customerApi.createCustomer()`
2. **API**: `POST /api/customers` → `routes/customers.ts` → Validate data
3. **Database**: Insert into `customers` table → Return new ID
4. **Response**: New customer data → Frontend updates list

### Authentication Flow
1. **Login**: Credentials → `authController.login()` → Validate → Generate tokens
2. **Storage**: Access token (1hr) + Refresh token (30 days) → localStorage
3. **Requests**: Token in Authorization header → `authenticateToken()` middleware
4. **Refresh**: Access token expired → Use refresh token → Get new tokens

### Address Management Flow
1. **Fetch**: Customer ID → Get addresses with tax info
2. **Update**: Address changes → Update with province tax lookup
3. **Primary**: Set primary → Unset others → Update flag

## Key Design Patterns

### Security
- JWT-based authentication with refresh tokens
- Role-based access control (manager, designer, production_staff)
- Prepared statements for SQL injection prevention
- Soft deletes preserve data integrity

### Performance
- Connection pooling for database
- Pagination for large datasets
- Indexed foreign keys and search fields
- Lazy loading of related data

### Error Handling
- Try-catch blocks in all async operations
- Graceful degradation on network errors
- User-friendly error messages
- Detailed server-side logging

### Data Integrity
- Foreign key constraints
- Transaction support for multi-table operations
- Audit trail with created/updated timestamps
- Validation at API and database levels

## Environment Configuration

### Required Environment Variables
```env
# Backend
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=signmanufacturing
JWT_SECRET=<secret>
JWT_EXPIRES_IN=1h
PORT=3001
CORS_ORIGIN=http://localhost:5173

# Frontend
VITE_API_URL=http://192.168.2.14:3001
```

## Quick Reference for Common Tasks

### Add New API Endpoint
1. Create route handler in `backend/web/src/routes/`
2. Add controller logic if complex
3. Register route in `server.ts`
4. Add API client method in `frontend/web/src/services/api.ts`

### Add Database Table
1. Create schema in `backend/database/`
2. Run migration script
3. Add TypeScript interfaces
4. Create API endpoints for CRUD

### Deploy Changes
1. Push to repository
2. Run `infrastructure/scripts/stop-servers.sh`
3. Pull latest changes
4. Run `infrastructure/scripts/start-servers.sh`

## Refactoring Summary (August 22, 2025)

### Phase 1: App.tsx Refactoring
- **Before**: 2,889 lines monolithic file
- **After**: 135 lines focused on routing and auth
- **Components Extracted**: 6 major components into organized directories

### Phase 2: Component Splitting
**CustomerDetailsModal.tsx**: 1,041 lines → 265 lines (74% reduction)
- Extracted: CustomerForm.tsx (282 lines)
- Extracted: AddressManager.tsx (519 lines)
- Extracted: ConfirmationModals.tsx (117 lines)
- Extracted: types.ts (90 lines) - shared interfaces

**TimeTracking.tsx**: 661 lines → 359 lines (46% reduction)
- Extracted: TimeClockDisplay.tsx (89 lines)
- Extracted: WeeklySummary.tsx (162 lines)
- Extracted: EditRequestForm.tsx (189 lines)
- Extracted: NotificationsModal.tsx (118 lines)

### Phase 3: Database Schema Cleanup
**Removed redundant columns from customers table**:
- `leds_default_type` (text field) - replaced by proper JOIN with leds table via led_id
- `powersupply_default_type` (text field) - replaced by proper JOIN with power_supplies table via power_supply_id

**Benefits**:
- Eliminates data duplication
- Ensures referential integrity
- Single source of truth for LED and power supply data
- Backend API updated to use JOINs instead of redundant text fields
- Search functionality now searches actual product data instead of potentially stale text

### Final Component Organization
```
components/
├── auth/
│   └── SimpleLogin.tsx (97 lines)
├── customers/
│   ├── types.ts (90 lines)
│   ├── ConfirmationModals.tsx (117 lines)
│   ├── CustomerDetailsModal.tsx (265 lines)
│   ├── CustomerForm.tsx (282 lines)
│   ├── AddressManager.tsx (519 lines)
│   └── SimpleCustomerList.tsx (541 lines)
├── time/
│   ├── TimeClockDisplay.tsx (89 lines)
│   ├── NotificationsModal.tsx (118 lines)
│   ├── WeeklySummary.tsx (162 lines)
│   ├── EditRequestForm.tsx (189 lines)
│   ├── TimeTracking.tsx (359 lines)
│   └── TimeApprovals.tsx (388 lines)
└── dashboard/
    └── SimpleDashboard.tsx (143 lines)
```

### Benefits Achieved
- **Maintainability**: Each component has single responsibility
- **Reusability**: Components can be used independently
- **Testability**: Smaller components easier to unit test
- **Performance**: Potential for better memoization and optimization
- **Code Organization**: Clear feature-based grouping
- **Claude AI Compatibility**: All files under 600 lines for optimal readability
- **Type Safety**: Shared types prevent duplication and ensure consistency

## Notes for Future Development
- Consider implementing connection retry logic
- Add comprehensive logging system
- Implement caching layer for frequently accessed data
- Add unit and integration tests
- Consider containerization with Docker
- Implement real-time updates with WebSockets
- Continue extracting large components when they exceed 500 lines