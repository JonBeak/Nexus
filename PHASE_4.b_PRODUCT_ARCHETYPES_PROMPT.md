# Phase 4.b: Product Archetypes - Implementation Prompt

## Context

We are building a supply chain management system for a sign manufacturing business. Phase 4.a (Suppliers + Contacts) is complete. Now implementing Phase 4.b: Product Archetypes.

### Key Documentation
- **Phase 4 Overview**: `/home/jon/Nexus/Nexus_SupplyChain_Phase4.md`
- **Roadmap**: `/home/jon/Nexus/docs/ROADMAP.md`
- **Project Instructions**: `/home/jon/Nexus/CLAUDE.md`

### Data Model Reminder
```
product_archetypes (OUR internal definitions - what we use in BOMs)
  ↓
supplier_products (THEIR offerings that map to our archetypes)
  ↓
pricing_history (price changes over time per supplier product)
```

**Archetype = our canonical definition** (e.g., "0.5" Black Acrylic")
**Supplier Product = their specific offering** (e.g., "Optix Black-2025 1/2" from Supplier A")

---

## Phase 4.b Requirements

### 1. Database Schema

Create `product_archetypes` table:

```sql
CREATE TABLE product_archetypes (
  archetype_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,                    -- "0.5\" Black Acrylic", "3/4W White LED Module"
  category ENUM(
    'led',
    'transformer',
    'substrate',      -- Acrylic, aluminum, PVC, etc.
    'hardware',       -- Standoffs, J-channel, mounting hardware
    'paint',
    'vinyl',
    'trim_cap',
    'electrical',     -- Wire, connectors, etc.
    'misc'
  ) NOT NULL,
  subcategory VARCHAR(100) DEFAULT NULL,         -- Optional: "acrylic", "aluminum", "pvc" for substrates
  unit_of_measure VARCHAR(50) NOT NULL,          -- each, linear_ft, sq_ft, sheet, roll, gallon, lb
  specifications JSON DEFAULT NULL,              -- Flexible specs: { thickness: "0.5\"", color: "black", wattage: "0.75W" }
  description TEXT DEFAULT NULL,                 -- Longer description if needed
  reorder_point INT DEFAULT 0,                   -- Alert when stock falls below this
  safety_stock INT DEFAULT 0,                    -- Minimum stock to maintain
  default_lead_days INT DEFAULT NULL,            -- Expected lead time if not specified by supplier
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT,
  updated_by INT,

  UNIQUE KEY uk_name (name),
  INDEX idx_category (category),
  INDEX idx_subcategory (subcategory),
  INDEX idx_active (is_active),
  FOREIGN KEY (created_by) REFERENCES users(user_id),
  FOREIGN KEY (updated_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2. Existing Vinyl System Integration

**Current State:**
- `vinyl_products` table: 227 products (brand, series, colour_number, colour_name, default_width)
- `vinyl_inventory` table: 956 inventory items (rolls with dimensions, location, disposition)
- `product_suppliers` table: links vinyl_products → suppliers

**Decision Needed:** How to integrate?

**Option A: Keep Separate (Recommended for now)**
- Vinyl system remains as-is (working, production data)
- Product archetypes for NEW material categories (LED, substrate, hardware, etc.)
- Future: Consider migration or unification

**Option B: Migrate Vinyl to Archetypes**
- Create archetypes from vinyl_products
- Link vinyl_inventory to archetypes
- More complex, risk to working system

**Recommendation:** Option A - keep vinyl separate for Phase 4.b, plan unification for later.

### 3. Category-Specific Specifications

Each category has typical specification fields:

| Category | Common Specs |
|----------|--------------|
| LED | wattage, color_temp, voltage, lens_type, ip_rating |
| Transformer | wattage, input_voltage, output_voltage, channels |
| Substrate | material, thickness, color, finish, sheet_size |
| Hardware | material, finish, size, thread_type |
| Paint | type, color, finish, coverage_sqft_per_gallon |
| Vinyl | (handled by existing system) |
| Trim Cap | material, width, color |
| Electrical | gauge, color, length, connector_type |
| Misc | (freeform) |

### 4. API Endpoints

```
GET    /api/archetypes                    -- List all (with filters)
GET    /api/archetypes/:id                -- Get single archetype
POST   /api/archetypes                    -- Create archetype
PUT    /api/archetypes/:id                -- Update archetype
DELETE /api/archetypes/:id                -- Soft delete (deactivate)
GET    /api/archetypes/categories         -- Get category list with counts
GET    /api/archetypes/stats              -- Statistics
```

**Query Parameters for GET /api/archetypes:**
- `category` - Filter by category
- `subcategory` - Filter by subcategory
- `search` - Search name/description
- `active_only` - Boolean (default true)

### 5. Backend Architecture

Follow existing patterns from Phase 4.a:

```
/backend/web/src/
├── repositories/supplyChain/
│   └── archetypeRepository.ts           -- NEW
├── services/supplyChain/
│   └── archetypeService.ts              -- NEW
├── controllers/supplyChain/
│   └── archetypeController.ts           -- NEW
├── routes/
│   └── archetypes.ts                    -- NEW (mount at /api/archetypes)
└── types/
    └── supplyChain.ts                   -- Add archetype types (or inline)
```

### 6. Frontend Components

Add to Supply Chain page:

```
/frontend/web/src/components/supplyChain/
├── SuppliersManager.tsx                 -- Existing (4.a)
├── SupplierContactsSection.tsx          -- Existing (4.a)
├── ProductArchetypesManager.tsx         -- NEW: Main list/grid view
├── ArchetypeModal.tsx                   -- NEW: Add/Edit modal
└── SpecificationsEditor.tsx             -- NEW: JSON specs editor (optional)
```

**UI Features:**
- Tab or section in Supply Chain page for "Product Catalog" or "Materials"
- Grid/table view with category filter tabs
- Search by name
- Expandable rows showing specifications
- Add/Edit modal with:
  - Basic fields (name, category, subcategory, UOM)
  - Specifications section (dynamic based on category)
  - Inventory settings (reorder point, safety stock)
- Category badge colors (similar to supplier type badges)

### 7. Specifications Editor UX

Two approaches:

**Simple (Recommended for MVP):**
- Predefined fields per category displayed as form inputs
- Store as JSON behind the scenes

**Advanced (Future):**
- Key-value editor for custom specs
- Template specs per category

### 8. Sample Data for Testing

```sql
-- LEDs
INSERT INTO product_archetypes (name, category, unit_of_measure, specifications) VALUES
('0.72W White LED Module', 'led', 'each', '{"wattage": 0.72, "color_temp": "6500K", "voltage": "12V", "lens": "160°"}'),
('0.72W RGB LED Module', 'led', 'each', '{"wattage": 0.72, "type": "RGB", "voltage": "12V"}'),
('1.5W White LED Module', 'led', 'each', '{"wattage": 1.5, "color_temp": "6500K", "voltage": "12V"}');

-- Substrates
INSERT INTO product_archetypes (name, category, subcategory, unit_of_measure, specifications) VALUES
('3mm White Acrylic', 'substrate', 'acrylic', 'sheet', '{"thickness": "3mm", "color": "white", "sheet_size": "4x8 ft"}'),
('6mm Black Acrylic', 'substrate', 'acrylic', 'sheet', '{"thickness": "6mm", "color": "black", "sheet_size": "4x8 ft"}'),
('0.040\" White Aluminum', 'substrate', 'aluminum', 'sheet', '{"thickness": "0.040\"", "color": "white", "sheet_size": "4x8 ft"}');

-- Transformers
INSERT INTO product_archetypes (name, category, unit_of_measure, specifications) VALUES
('100W 12V LED Driver', 'transformer', 'each', '{"wattage": 100, "input": "120V AC", "output": "12V DC"}'),
('200W 12V LED Driver', 'transformer', 'each', '{"wattage": 200, "input": "120V AC", "output": "12V DC"}');

-- Hardware
INSERT INTO product_archetypes (name, category, unit_of_measure, specifications) VALUES
('1\" Aluminum Standoff', 'hardware', 'each', '{"material": "aluminum", "length": "1\"", "finish": "brushed"}'),
('Flat J-Channel 1\"', 'hardware', 'linear_ft', '{"material": "aluminum", "width": "1\"", "type": "flat"}');
```

---

## Implementation Steps

### Step 1: Database Migration
Create `/database/migrations/phase4b_product_archetypes.sql`

### Step 2: Backend - Repository
Create `archetypeRepository.ts` with:
- `findAll(params)` - with category/search filters
- `findById(id)`
- `create(data)`
- `update(id, data)`
- `softDelete(id)`
- `getCategories()` - returns categories with counts
- `getStatistics()`

### Step 3: Backend - Service
Create `archetypeService.ts` with:
- Validation (name required, valid category, valid UOM)
- Business logic
- ServiceResult<T> pattern

### Step 4: Backend - Controller
Create `archetypeController.ts` following supplierController pattern

### Step 5: Backend - Routes
Create `routes/archetypes.ts` and mount in main app

### Step 6: Frontend - Manager Component
Create `ProductArchetypesManager.tsx`:
- Category tabs/filter
- Search input
- Table with columns: Name, Category, Subcategory, UOM, Specs preview, Actions
- Add/Edit modal integration

### Step 7: Frontend - Modal
Create `ArchetypeModal.tsx`:
- Form fields for all archetype properties
- Category-aware specs fields
- Validation

### Step 8: Integration
- Add to Supply Chain page (new tab or section)
- Update navigation if needed

### Step 9: Testing
- Create sample archetypes
- Test CRUD operations
- Verify category filtering

---

## File Patterns to Follow

**Repository pattern**: See `/backend/web/src/repositories/supplyChain/supplierRepository.ts`
**Service pattern**: See `/backend/web/src/services/supplyChain/supplierService.ts`
**Controller pattern**: See `/backend/web/src/controllers/supplyChain/supplierController.ts`
**Routes pattern**: See `/backend/web/src/routes/suppliers.ts`
**Frontend pattern**: See `/frontend/web/src/components/supplyChain/SuppliersManager.tsx`

---

## Success Criteria

1. ✅ Database table created with proper indexes
2. ✅ Full CRUD API working
3. ✅ Category filtering works
4. ✅ Search by name works
5. ✅ Frontend displays archetypes in organized view
6. ✅ Can add/edit archetypes with specs
7. ✅ Specifications stored as JSON, displayed nicely
8. ✅ Backend and frontend compile without errors
9. ✅ Sample data inserted for testing

---

## Questions to Clarify Before Starting

1. **Category list**: Is the proposed category list complete? Any to add/remove?
2. **Vinyl integration**: Confirm keeping vinyl system separate for now?
3. **Specifications**: Simple predefined fields per category, or advanced key-value editor?
4. **UI location**: New tab in Supply Chain, or section within existing page?

---

## Notes

- Keep files under 500 lines (refactor if needed)
- Use existing patterns exactly
- Include comprehensive error handling
- Update Phase 4 documentation when complete
- This is a production system - test thoroughly

---

**Ready to implement Phase 4.b: Product Archetypes**
