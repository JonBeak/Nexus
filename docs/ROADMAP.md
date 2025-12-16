# SignHouse Manufacturing System - Development Roadmap

## Phase 1: Core Web Interface ✅ COMPLETE

### 1.1 Customer Management System ✅
- ✅ Customer search and filtering (by company, contact, location)
- ✅ Customer profile view with all addresses and preferences
- ✅ Add/edit customer information with validation
- ✅ Multi-address management (billing, shipping, jobsite)
- ✅ Customer notes and communication history
- ✅ Sign manufacturing preferences (LED, wiring, patterns)
- ✅ Tax calculation integration based on address

### 1.2 Advanced Estimating System ✅
- ✅ Grid-based job builder with dynamic product forms
- ✅ Product types: Channel Letters, Vinyl, Substrate Cut, Backer, Push Thru, Blade Signs, LED Neon
- ✅ Complex input forms with XY dimensions, LED counts, UL requirements
- ✅ Advanced calculations with multipliers, discounts, shipping
- ✅ Quote versioning and revision tracking
- ✅ PDF generation for customer delivery
- ✅ Quote status tracking (Draft, Sent, Approved, etc.)

### 1.3 Time Management System ✅
- ✅ Employee time tracking with clock in/out
- ✅ Manager approval workflow
- ✅ Edit request system with notifications
- ✅ Vacation tracking
- ✅ Schedule management
- ✅ Payroll integration

### 1.4 Vinyl Inventory System ✅
- ✅ Vinyl product management (512 inventory items)
- ✅ Stock tracking with low stock alerts
- ✅ Supplier cost tracking
- ✅ Bulk operations

### 1.5 Account Management ✅
- ✅ User account CRUD operations
- ✅ Role-based access control (59 permissions)
- ✅ Password management
- ✅ Login tracking and session management

### 1.6 QuickBooks Estimate Integration ✅
- ✅ Push estimates to QuickBooks as estimates
- ✅ Customer sync with QuickBooks
- ✅ Line item mapping with DescriptionOnly support

---

## Phase 2: Job Management & Workflow ✅ COMPLETE

### 2.a Tasks Table View ✅
- ✅ Production task tracking grid with 11 core task columns
- ✅ Sticky headers for easy navigation
- ✅ Role-based task columns (different tasks shown per role)
- ✅ Hide completed/empty order filters
- ✅ Drag-to-scroll functionality
- ✅ Inline task toggling
- ✅ Multi-select status filter

### 2.b Calendar View ✅
- ✅ Calendar view for task scheduling
- ✅ TaskRow shared component
- ✅ Tasks Table improvements

### 2.c Orders Table Enhancements ✅
- ✅ Days Left column with color coding
- ✅ URL routing for direct order access
- ✅ Multi-select filters
- ✅ Order status workflow

### 2.d Order Preparation Workflow ✅
- ✅ Order preparation steps and validation
- ✅ Part specifications management
- ✅ Task generation from order parts
- ✅ Point person assignment

### 2.e QuickBooks Invoice Automation ✅
- ✅ Create/Update/Link invoices in QuickBooks
- ✅ Invoice staleness detection (order changed since invoice created)
- ✅ Email templates with variable substitution
- ✅ Send invoice emails immediately or schedule for later
- ✅ Email history tracking (records all sends)
- ✅ Invoice PDF fetching and preview in modal
- ✅ Customer contact selection for recipients (to/cc/bcc)
- ✅ Custom message injection in emails
- ✅ Ready for Pickup/Shipping subject prefixes
- ✅ Balance line in emails (shows remaining balance if partial payment)
- ✅ Settings system for email templates

### 2.f Customer Accounting Emails ✅
- ✅ Dedicated accounting emails table per customer (separate from contacts)
- ✅ Email types: to/cc/bcc with labels
- ✅ AccountingEmailsEditor component in customer form
- ✅ Order snapshot of accounting emails at conversion time
- ✅ Auto-populate invoice recipients from accounting emails

### 2.g Gmail Integration ✅
- ✅ Service account with domain-wide delegation
- ✅ Send emails via Gmail API
- ✅ Attachment support (PDF invoices)
- ✅ Retry logic with exponential backoff
- ✅ BCC support for audit copies (user-specified + auto-BCC)

---

## Phase 3: Financial Integration 🔄 IN PROGRESS

### 3.1 QuickBooks Integration ✅ (Core Complete)
- ✅ OAuth 2.0 authentication flow
- ✅ Customer synchronization (resolve by name)
- ✅ Estimate creation and sync
- ✅ Invoice creation/update/linking
- ✅ Tax code resolution and mapping
- ✅ Balance tracking (fetched from QB invoice data)
- ✅ Customer payment links (InvoiceLink from QB, not admin URLs)
- ✅ Online payments enabled (credit card + ACH)
- ⬜ Two-way customer sync

### 3.2 Payment Processing ✅
- ✅ Record payments in QuickBooks
- ✅ PaymentsPage component (multi-invoice payment view)
- ✅ paymentsApi service for payment operations
- ✅ qbPaymentController and qbPaymentService backend
- ✅ /api/payments routes mounted
- ✅ Balance fetched from QuickBooks (no local payment tracking)
- ✅ Balance line in invoice emails (shows remaining if partial payment)

### 3.3 Advanced Reporting
- ⬜ Sales reporting and analytics
- ⬜ Customer profitability analysis
- ⬜ Job performance metrics
- ⬜ Material usage reports
- ⬜ Financial dashboards

---

## Phase 4: Supply Chain & Materials

### 4.1 Supply Chain Management
- ⬜ Supplier management
- ⬜ Purchase order generation
- ⬜ Material cost tracking
- ⬜ Low stock alerts
- ⬜ Material requirements calculation from orders

### 4.2 Materials Integration
- ⬜ Real-time material costs in pricing
- ⬜ Job material tracking
- ⬜ Waste tracking

---

## Phase 5: System Enhancement

### 5.1 Performance & Scalability
- ⬜ Database optimization
- ✅ Specification options caching (specificationOptionsCache.ts)
- ✅ Settings page with audit log pagination
- ⬜ Additional caching layers

### 5.2 Advanced Features
- ⬜ Mobile app for field operations
- ⬜ Customer portal for order tracking
- ⬜ Advanced scheduling and capacity planning

---

## Recent Releases

### Phase 2.f (2025-12-17)
- Customer Accounting Emails system (to/cc/bcc per customer)
- Invoice PDF viewing/download in modal
- Email history tracking for all sends
- Custom message support in invoice emails
- Payment links from QuickBooks (InvoiceLink)
- Multi-invoice payment system foundation

### Phase 2.e (2025-12-16)
- QuickBooks Invoice Automation complete
- Settings system for email templates
- Bulk entries UX improvements

### Phase 2.b (2025-12-15)
- Calendar View for task scheduling
- TaskRow shared component
- Tasks Table improvements

---

## Infrastructure

### Build System ✅
- ✅ Dual-build system (production/development)
- ✅ PM2 process management
- ✅ Automated backup system
- ✅ Build management scripts

### Security ✅
- ✅ JWT authentication with refresh tokens
- ✅ Role-based access control (RBAC)
- ✅ Encrypted credential storage (QuickBooks, Gmail)
- ✅ Audit trail logging

---

**Last Updated**: 2025-12-17
