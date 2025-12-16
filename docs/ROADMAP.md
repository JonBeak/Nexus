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

## Phase 2: Job Management & Workflow ✅ 99% COMPLETE

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
- ✅ Email history tracking (fixed: now records immediate sends)
- ✅ Invoice PDF fetching and preview
- ✅ Customer contact selection for recipients (to/cc/bcc)
- ✅ Custom message injection in emails
- ✅ Ready for Pickup/Shipping subject prefixes
- ✅ Balance line in emails (shows remaining balance if partial payment)
- ✅ Settings system for email templates
- 🔄 Invoice modal/workflow refinements (pending user testing)

### 2.f Gmail Integration ✅
- ✅ Service account with domain-wide delegation
- ✅ Send emails via Gmail API
- ✅ Attachment support (PDF invoices)
- ✅ Retry logic with exponential backoff
- ✅ BCC support for audit copies

---

## Phase 3: Financial Integration 🔄 IN PROGRESS

### 3.1 QuickBooks Integration ✅ (Core Complete)
- ✅ OAuth 2.0 authentication flow
- ✅ Customer synchronization (resolve by name)
- ✅ Estimate creation and sync
- ✅ Invoice creation/update/linking
- ✅ Tax code resolution and mapping
- ✅ Balance tracking (fetched from QB invoice data)
- ⬜ Record payments in QuickBooks (push only - not tracked locally)
- ⬜ Two-way customer sync

### 3.2 Advanced Reporting
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
- ⬜ Caching implementation
- ⬜ Specification options caching (in progress)

### 5.2 Advanced Features
- ⬜ Mobile app for field operations
- ⬜ Customer portal for order tracking
- ⬜ Advanced scheduling and capacity planning

---

## Current Uncommitted Changes (Session: 2025-12-16)

### Invoice Modal Enhancements
- Customer contacts integration for recipient selection
- Email history now records immediate sends (bug fix)
- Modal sizing adjustments (slimmer right panel)
- Email template copy update: "The invoice for your order # has been prepared."

### Backend Improvements
- `qbInvoiceRepository.ts` - createScheduledEmail() now accepts optional status/sent_at
- `invoiceEmailService.ts` - Creates history records for immediate email sends
- `qbInvoice.ts` - ScheduledEmailInput type updated with optional fields
- Balance line support in email templates

### Database Migrations (New)
- `20251216_001_add_custom_message_to_templates.sql`
- `20251216_002_update_email_header_green.sql`
- `20251216_003_add_balance_line_to_email_templates.sql`

### Frontend Changes
- `InvoiceActionModal.tsx` - Major refactor with customer contacts, recipient management
- `specificationConstants.ts` - Cleanup and refactoring
- `orderProductTemplates.ts` - Updates

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

**Last Updated**: 2025-12-16
