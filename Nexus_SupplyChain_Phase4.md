# Phase 4: Supply Chain & Materials

## Overview

Phase 4 implements a comprehensive supply chain management system with a sophisticated product hierarchy that separates internal product definitions (archetypes) from supplier-specific offerings.

### Core Data Model

```
suppliers
  └── supplier_contacts (sales reps, AP contacts, etc.)

product_archetypes (OUR internal definitions - used in BOMs)
  - "0.5" Black Acrylic", "3/4W White LED Module", etc.
  - category, unit_of_measure, specifications

supplier_products (THEIR specific offerings - what we actually buy)
  - links to: archetype_id + supplier_id
  - brand_name, color_name, sku, actual specs (may vary slightly)
  - lead_time, min_order_qty, is_preferred

pricing_history (price changes over time)
  - supplier_product_id, unit_price, effective_start_date
  - current price = most recent where effective_date <= today
```

### Key Lookup Patterns

1. **Find suppliers for a material**: Look up archetype → get all supplier_products → see prices/availability
2. **Find all products from a supplier**: Look up supplier → get all supplier_products → see what they offer
3. **Get current price**: Find supplier_product → get most recent pricing_history where effective_date <= today

---

## Phase 4.a: Suppliers + Contacts ✅ COMPLETE (2025-12-18)

### Database Schema

#### `suppliers` table (extended)
```sql
supplier_id INT AUTO_INCREMENT PRIMARY KEY
name VARCHAR(255) NOT NULL UNIQUE
website VARCHAR(255)
notes TEXT
payment_terms VARCHAR(50)           -- Net 30, Net 60, COD, etc.
default_lead_days INT               -- Typical fulfillment time
account_number VARCHAR(100)         -- Our account # with them
address_line1 VARCHAR(255)
address_line2 VARCHAR(255)
city VARCHAR(100)
province VARCHAR(100)
postal_code VARCHAR(20)
country VARCHAR(100) DEFAULT 'Canada'
is_active BOOLEAN DEFAULT TRUE
supplier_type ENUM('general', 'vinyl', 'both')
created_at, updated_at, created_by, updated_by
```

#### `supplier_contacts` table (NEW)
```sql
contact_id INT AUTO_INCREMENT PRIMARY KEY
supplier_id INT NOT NULL (FK → suppliers)
name VARCHAR(255) NOT NULL
email VARCHAR(255)
phone VARCHAR(50)
role ENUM('sales', 'accounts_payable', 'customer_service', 'technical', 'general')
is_primary BOOLEAN DEFAULT FALSE
notes TEXT
is_active BOOLEAN DEFAULT TRUE
created_at, updated_at
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/suppliers` | List all suppliers |
| GET | `/suppliers/:id` | Get supplier details |
| POST | `/suppliers` | Create supplier |
| PUT | `/suppliers/:id` | Update supplier |
| DELETE | `/suppliers/:id` | Delete supplier |
| GET | `/suppliers/stats/summary` | Get supplier statistics |
| GET | `/suppliers/:id/contacts` | List contacts for supplier |
| POST | `/suppliers/:id/contacts` | Create contact |
| GET | `/suppliers/:id/contacts/:contactId` | Get contact |
| PUT | `/suppliers/:id/contacts/:contactId` | Update contact |
| DELETE | `/suppliers/:id/contacts/:contactId` | Delete contact |
| POST | `/suppliers/:id/contacts/:contactId/set-primary` | Set as primary contact |

### Files Created/Modified

**Backend:**
- `repositories/supplyChain/supplierRepository.ts` - Updated
- `repositories/supplyChain/supplierContactRepository.ts` - NEW
- `services/supplyChain/supplierService.ts` - Updated
- `services/supplyChain/supplierContactService.ts` - NEW
- `controllers/supplyChain/supplierController.ts` - Updated (added contact endpoints)
- `routes/suppliers.ts` - Updated (added contact routes)

**Frontend:**
- `components/supplyChain/SuppliersManager.tsx` - Updated (expandable rows, new fields)
- `components/supplyChain/SupplierContactsSection.tsx` - NEW

**Database:**
- `database/migrations/phase4a_suppliers_contacts.sql`

### UI Features
- Expandable supplier rows showing details + contacts
- Supplier form with all new fields (payment terms, lead days, address, etc.)
- Contact management inline within supplier expanded view
- Primary contact indicator (star icon)
- Contact role badges with color coding

---

## Phase 4.b: Product Archetypes (Internal Catalog) ⬜ PENDING

### Planned Schema

#### `product_archetypes` table
```sql
archetype_id INT AUTO_INCREMENT PRIMARY KEY
name VARCHAR(255) NOT NULL              -- "0.5\" Black Acrylic"
category ENUM('led', 'transformer', 'substrate', 'hardware', 'paint', 'vinyl', 'trim_cap', 'misc')
unit_of_measure VARCHAR(50)             -- each, linear ft, sq ft, sheet, roll, gallon
specifications JSON                      -- { thickness: "0.5\"", color: "black", material: "acrylic" }
reorder_point INT DEFAULT 0
safety_stock INT DEFAULT 0
notes TEXT
is_active BOOLEAN DEFAULT TRUE
created_at, updated_at
```

### Planned Features
- Archetype CRUD with category filtering
- Specifications JSON editor
- Search by name, category, specs
- Link to existing vinyl_inventory (migration path)

---

## Phase 4.c: Supplier Products + Pricing ⬜ PENDING

### Planned Schema

#### `supplier_products` table
```sql
supplier_product_id INT AUTO_INCREMENT PRIMARY KEY
archetype_id INT NOT NULL (FK → product_archetypes)
supplier_id INT NOT NULL (FK → suppliers)
brand_name VARCHAR(255)                 -- "Optix"
product_name VARCHAR(255)               -- "Black-2025 Acrylic"
sku VARCHAR(100)                        -- Supplier's SKU
specifications JSON                      -- { actual_thickness: "12mm", color_code: "BLK-2025" }
lead_time_days INT
min_order_qty DECIMAL(10,2)
is_preferred BOOLEAN DEFAULT FALSE
notes TEXT
is_active BOOLEAN DEFAULT TRUE
created_at, updated_at
UNIQUE(archetype_id, supplier_id, sku)
```

#### `pricing_history` table
```sql
price_id INT AUTO_INCREMENT PRIMARY KEY
supplier_product_id INT NOT NULL (FK → supplier_products)
unit_price DECIMAL(10,4) NOT NULL
effective_start_date DATE NOT NULL
notes VARCHAR(255)                       -- "Price increase Jan 2025"
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
INDEX(supplier_product_id, effective_start_date)
```

### Planned Features
- Link supplier products to archetypes
- Price comparison view across suppliers
- Price history tracking with effective dates
- Current price = most recent where effective_date <= today
- Preferred supplier flag per archetype

---

## Phase 4.d: Purchase Orders ⬜ PENDING

### Planned Schema

#### `purchase_orders` table
```sql
po_id INT AUTO_INCREMENT PRIMARY KEY
po_number VARCHAR(50) NOT NULL UNIQUE
supplier_id INT NOT NULL (FK → suppliers)
status ENUM('draft', 'sent', 'partial', 'received', 'closed', 'cancelled')
order_date DATE
expected_date DATE
received_date DATE
notes TEXT
created_by, updated_by
created_at, updated_at
```

#### `purchase_order_items` table
```sql
po_item_id INT AUTO_INCREMENT PRIMARY KEY
po_id INT NOT NULL (FK → purchase_orders)
supplier_product_id INT NOT NULL (FK → supplier_products)
quantity_ordered DECIMAL(10,2) NOT NULL
quantity_received DECIMAL(10,2) DEFAULT 0
unit_price DECIMAL(10,4) NOT NULL
notes TEXT
```

### Planned Features
- PO creation from low stock alerts or manual entry
- PO status workflow: Draft → Sent → Partial → Received → Closed
- Receiving workflow (partial receipts supported)
- Email PO to supplier (using Gmail integration)
- PO audit trail

---

## Phase 4.e: Inventory Tracking ⬜ PENDING

### Planned Schema

#### `inventory` table
```sql
inventory_id INT AUTO_INCREMENT PRIMARY KEY
archetype_id INT NOT NULL UNIQUE (FK → product_archetypes)
quantity_on_hand DECIMAL(10,2) DEFAULT 0
location VARCHAR(100)
last_count_date DATE
average_cost DECIMAL(10,4)              -- Running average for valuation
notes TEXT
updated_at TIMESTAMP
```

#### `inventory_transactions` table
```sql
transaction_id INT AUTO_INCREMENT PRIMARY KEY
archetype_id INT NOT NULL (FK → product_archetypes)
transaction_type ENUM('received', 'used', 'adjusted', 'scrapped', 'returned')
quantity DECIMAL(10,2) NOT NULL         -- Positive for in, negative for out
reference_type VARCHAR(50)              -- 'po', 'order', 'adjustment'
reference_id INT                        -- po_id, order_id, etc.
unit_cost DECIMAL(10,4)                 -- Cost at time of transaction
notes TEXT
created_by INT
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

### Planned Features
- Stock tracked at archetype level (not supplier product level)
- Receiving PO increases inventory
- Using materials on orders decreases inventory
- Low stock alerts (qty < reorder_point)
- Average cost calculation
- Transaction audit trail

---

## Phase 4.f: Order Materials / BOM ⬜ PENDING

### Planned Schema

#### `bom_templates` table
```sql
bom_id INT AUTO_INCREMENT PRIMARY KEY
product_type VARCHAR(100) NOT NULL      -- 'channel_letters', 'blade_sign', etc.
archetype_id INT NOT NULL (FK → product_archetypes)
quantity_formula VARCHAR(255)           -- 'letter_count * 2' or fixed quantity
is_optional BOOLEAN DEFAULT FALSE
notes TEXT
```

### Planned Features
- BOM templates per product type
- Auto-calculate materials from order parts
- Material requirements view per order
- Aggregate across multiple orders
- Shortfall alerts

---

## Phase 4.g: Cost Tracking + Labour ⬜ PENDING

### Planned Features
- Material cost per order (from BOM × current prices)
- Cost snapshot at order creation
- Margin analysis (revenue - material cost)
- Link time entries to orders
- Labour cost = hours × wage rates
- Combined cost analysis
- **Feeds into Phase 3.3 profitability reporting**

---

## Progress Summary

| Phase | Status | Date |
|-------|--------|------|
| 4.a Suppliers + Contacts | ✅ Complete | 2025-12-18 |
| 4.b Product Archetypes | ⬜ Pending | - |
| 4.c Supplier Products + Pricing | ⬜ Pending | - |
| 4.d Purchase Orders | ⬜ Pending | - |
| 4.e Inventory Tracking | ⬜ Pending | - |
| 4.f Order Materials / BOM | ⬜ Pending | - |
| 4.g Cost Tracking + Labour | ⬜ Pending | - |

---

## Dependencies

- **Phase 4.a** → Foundation for all other phases
- **Phase 4.b** → Required for 4.c, 4.e, 4.f
- **Phase 4.c** → Required for 4.d (need products to order)
- **Phase 4.d + 4.e** → Can be done in parallel after 4.c
- **Phase 4.f** → Requires 4.b + 4.e
- **Phase 4.g** → Requires 4.f + existing time management system
- **Phase 3.3** (Advanced Reporting) → Requires 4.g completion

---

**Last Updated**: 2025-12-18
**Owner**: Jon (with Claude Code assistance)
