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

## Phase 3: Financial Integration ✅ COMPLETE (Core)

### 3.1 QuickBooks Integration ✅ (Core Complete)
- ✅ OAuth 2.0 authentication flow
- ✅ Customer synchronization (resolve by name)
- ✅ Estimate creation and sync
- ✅ Invoice creation/update/linking
- ✅ Tax code resolution and mapping
- ✅ Balance tracking (fetched from QB invoice data)
- ✅ Customer payment links (InvoiceLink from QB, not admin URLs)
- ✅ Online payments enabled (credit card + ACH)
- ⏸️ Two-way customer sync (deferred - low priority)

### 3.2 Payment Processing ✅
- ✅ Record payments in QuickBooks
- ✅ PaymentsPage component (multi-invoice payment view)
- ✅ paymentsApi service for payment operations
- ✅ qbPaymentController and qbPaymentService backend
- ✅ /api/payments routes mounted
- ✅ Balance fetched from QuickBooks (no local payment tracking)
- ✅ Balance line in invoice emails (shows remaining if partial payment)

### 3.3 Advanced Reporting ⏸️ DEFERRED
**Reason**: Profitability analysis requires material costs (Phase 4) and labour tracking integration. Revisit after Phase 4 completion.
- ⏸️ Sales reporting and analytics
- ⏸️ Customer profitability analysis
- ⏸️ Job performance metrics
- ⏸️ Material usage reports
- ⏸️ Financial dashboards

---

## Phase 4: Supply Chain & Materials 🔄 IN PROGRESS

### Data Model Overview
```
suppliers
  └── supplier_contacts (sales reps, AP contacts, etc.)

product_archetypes (OUR internal definitions - used in BOMs)
  - "0.5\" Black Acrylic", "3/4W White LED Module", etc.
  - category, unit_of_measure, specifications

supplier_products (THEIR specific offerings - what we actually buy)
  - links to: archetype_id + supplier_id
  - brand_name, color_name, sku, actual specs (may vary slightly)
  - lead_time, min_order_qty, is_preferred

pricing_history (price changes over time)
  - supplier_product_id, unit_price, effective_start_date
  - current price = most recent where effective_date <= today
```

### 4.a Suppliers + Contacts ✅ COMPLETE (2025-12-18)
- ✅ `suppliers` table extended (payment_terms, default_lead_days, account_number, address fields)
- ✅ `supplier_contacts` table (supplier_id, name, email, phone, role, is_primary)
- ✅ Supplier CRUD interface with expandable rows
- ✅ Contact management within supplier detail view
- ✅ Primary contact designation with star indicator
- ✅ Contact roles: sales, accounts_payable, customer_service, technical, general

### 4.b Product Types (Internal Catalog) ✅ COMPLETE (2025-12-19)
- ✅ `product_archetypes` table (our canonical product definitions)
- ✅ `material_categories` table (dynamic, editable categories)
- ✅ Categories: LED, Transformer, Substrate, Hardware, Paint, Trim Cap, Electrical, Misc
- ✅ Unit of measure (each, linear ft, sq ft, sheet, roll, gallon, etc.)
- ✅ Specifications as draggable key-value editor (stored as JSON)
- ✅ Reorder point and lead days tracking
- ✅ Product Types CRUD with category management UI
- ✅ Search/filter by category with compact card layout
- ✅ Backend routes: `/api/product-types` and `/api/product-types/categories`
- ⏸️ Vinyl system remains separate (working, production data)

### 4.c Supplier Products + Pricing ✅ COMPLETE (2025-12-19)
- ✅ `supplier_products` table with full CRUD (archetype_id, supplier_id, brand, sku, specs)
- ✅ `pricing_history` table with time-series tracking (append-only for history preservation)
- ✅ Link supplier products to archetypes (many suppliers → one archetype)
- ✅ Preferred supplier flag per archetype
- ✅ Lead time and minimum order quantity per supplier product
- ✅ Price lookup: current price = most recent effective_date <= today
- ✅ Price change tracking with effective dates
- ✅ Backend: supplierProductController, Service, Repository (3-layer architecture)
- ✅ Frontend: ArchetypeSupplierProducts, SupplierProductEditor components
- ⏸️ Price comparison view across suppliers (UI enhancement - deferred)

### 4.d Purchase Orders
- ⬜ `purchase_orders` table (supplier_id, status, order_date, expected_date)
- ⬜ `purchase_order_items` table (po_id, supplier_product_id, qty, unit_price)
- ⬜ PO status workflow: Draft → Sent → Partial → Received → Closed
- ⬜ Receiving workflow (mark items received, partial receipts)
- ⬜ PO history and audit trail
- ⬜ Email PO to supplier (using existing Gmail integration)
- ⬜ PO generation from low stock alerts

### 4.e Inventory Tracking
- ⬜ `inventory` table (archetype_id, quantity_on_hand, location)
- ⬜ `inventory_transactions` table (type: received/used/adjusted/scrapped)
- ⬜ Stock tracked at archetype level (not supplier product level)
- ⬜ Receiving PO increases inventory for archetype
- ⬜ Low stock alerts dashboard (qty < reorder_point)
- ⬜ Stock valuation: average cost method
- ⬜ Inventory count/adjustment interface
- ⬜ Transaction history with audit trail

### 4.f Order Materials / BOM
- ⬜ `bom_templates` table (product_type → list of archetypes + quantities)
- ⬜ Auto-calculate materials needed from order parts using BOM
- ⬜ Material requirements view per order
- ⬜ Aggregate materials across multiple orders (batch ordering)
- ⬜ Reserve/allocate stock to orders (optional)
- ⬜ Shortfall alerts (order needs X, only Y in stock)

### 4.g Cost Tracking + Labour Integration
- ⬜ Material cost per order (calculated from BOM × current prices)
- ⬜ Cost snapshot at order creation (lock in prices)
- ⬜ Margin analysis per order (revenue - material cost)
- ⬜ Link time entries to orders (labour cost = hours × wage rates)
- ⬜ Combined cost analysis (materials + labour)
- ⬜ Feeds into Phase 3.3 profitability reporting

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

### Phase 4.c (2025-12-19)
- Supplier Products with full CRUD operations
- Pricing History with time-series tracking (append-only)
- Link products to archetypes and suppliers
- Preferred supplier designation
- Lead time and minimum order quantity tracking
- Frontend components for product editing

### Phase 4.b (2025-12-19)
- Product Types catalog (formerly "Materials/Archetypes")
- Dynamic categories with CRUD management
- Key-value specifications editor with drag-and-drop reordering
- Compact card layout with expandable details
- Removed supplier_type field (unnecessary complexity)
- Simplified inventory: reorder_point only (removed safety_stock)

### Phase 4.a (2025-12-18)
- Suppliers table with extended fields
- Supplier Contacts with primary designation
- Contact roles system

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

**Last Updated**: 2026-01-27
