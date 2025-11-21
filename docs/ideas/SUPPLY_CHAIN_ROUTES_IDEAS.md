# Supply Chain Routes - Future Implementation Ideas

> **Status**: Ideas preserved from deleted `supplyChainSimple.ts` (Nov 21, 2025)
> **Reason for deletion**: Dead code - endpoints were not being used by frontend
> **Original file**: `/backend/web/src/routes/supplyChainSimple.ts`

## Overview

These are ideas for Supply Chain API endpoints that can be implemented when the Supply Chain feature is fully developed. The frontend already has API client stubs in `supplyChainApi.ts` and `categoriesApi.ts` ready to consume these endpoints.

---

## Database Schema (Already Exists)

### material_categories
```sql
CREATE TABLE material_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(50),
  sort_order INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT REFERENCES users(user_id),
  updated_by INT REFERENCES users(user_id)
);
-- Indexes: idx_active_sort, idx_name
```

### product_standards
```sql
CREATE TABLE product_standards (
  id INT PRIMARY KEY AUTO_INCREMENT,
  category_id INT NOT NULL REFERENCES material_categories(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  supplier_id INT REFERENCES suppliers(supplier_id),
  supplier_part_number VARCHAR(100),
  current_price DECIMAL(10,4),
  price_date DATE,
  minimum_order_qty DECIMAL(10,2) DEFAULT 1.00,
  unit_of_measure VARCHAR(20) DEFAULT 'each',
  reorder_point DECIMAL(10,2),
  reorder_quantity DECIMAL(10,2),
  lead_time_days INT DEFAULT 7,
  specifications JSON,
  notes TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT,
  updated_by INT
);
```

### inventory
```sql
CREATE TABLE inventory (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_standard_id INT NOT NULL REFERENCES product_standards(id),
  quantity DECIMAL(10,3) NOT NULL DEFAULT 0.000,
  reserved_quantity DECIMAL(10,3) DEFAULT 0.000,
  available_quantity DECIMAL(10,3) GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
  location VARCHAR(100),
  lot_number VARCHAR(100),
  serial_number VARCHAR(100),
  received_date DATE,
  expiry_date DATE,
  cost_per_unit DECIMAL(10,4),
  condition_status ENUM('new','good','fair','damaged') DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT,
  updated_by INT
);
```

---

## Proposed Endpoints

### 1. Dashboard Stats
**Endpoint**: `GET /api/supply-chain/dashboard-stats`
**Purpose**: Quick overview stats for the supply chain dashboard

```sql
-- Original query from deleted file
SELECT
  (SELECT COUNT(*) FROM material_categories WHERE is_active = TRUE) as total_categories,
  (SELECT COUNT(*) FROM product_standards WHERE is_active = TRUE) as total_products,
  (SELECT COUNT(*) FROM inventory) as total_inventory_items,
  (SELECT COALESCE(SUM(available_quantity), 0) FROM inventory) as total_available_quantity,
  0 as critical_items,  -- TODO: Calculate based on reorder_point
  0 as low_items        -- TODO: Calculate based on reorder_point * 1.5
```

**Response Type**:
```typescript
interface DashboardStats {
  total_categories: number;
  total_products: number;
  total_inventory_items: number;
  total_available_quantity: number;
  critical_items: number;
  low_items: number;
}
```

### 2. Categories List
**Endpoint**: `GET /api/supply-chain/categories`
**Purpose**: Get active material categories

```sql
SELECT
  id, name, description, icon, sort_order, is_active,
  created_at, updated_at
FROM material_categories
WHERE is_active = TRUE
ORDER BY sort_order, name
```

**Note**: Frontend `categoriesApi.ts` expects `/api/categories` (without supply-chain prefix). Consider which path structure to use.

### 3. Low Stock Items
**Endpoint**: `GET /api/supply-chain/low-stock`
**Purpose**: Get products with stock below reorder thresholds

```sql
SELECT
  ps.id,
  ps.name,
  ps.category_id,
  mc.name as category_name,
  mc.icon as category_icon,
  ps.supplier_id,
  s.name as supplier_name,
  COALESCE(SUM(i.available_quantity), 0) as current_stock,
  ps.reorder_point,
  ps.reorder_quantity,
  ps.current_price,
  ps.unit_of_measure,
  CASE
    WHEN COALESCE(SUM(i.available_quantity), 0) = 0 THEN 'out_of_stock'
    WHEN COALESCE(SUM(i.available_quantity), 0) <= COALESCE(ps.reorder_point, 0) THEN 'critical'
    WHEN COALESCE(SUM(i.available_quantity), 0) <= COALESCE(ps.reorder_point, 0) * 1.5 THEN 'low'
    ELSE 'ok'
  END as stock_status
FROM product_standards ps
JOIN material_categories mc ON ps.category_id = mc.id
LEFT JOIN suppliers s ON ps.supplier_id = s.supplier_id
LEFT JOIN inventory i ON ps.id = i.product_standard_id
WHERE ps.is_active = TRUE
GROUP BY ps.id
HAVING stock_status IN ('out_of_stock', 'critical', 'low')
ORDER BY
  CASE stock_status
    WHEN 'out_of_stock' THEN 1
    WHEN 'critical' THEN 2
    WHEN 'low' THEN 3
  END,
  ps.name
```

**Response Type**:
```typescript
interface LowStockItem {
  id: number;
  name: string;
  category_id: number;
  category_name: string;
  category_icon?: string;
  supplier_id?: number;
  supplier_name?: string;
  current_stock: number;
  reorder_point?: number;
  reorder_quantity?: number;
  current_price?: number;
  unit_of_measure: string;
  stock_status: 'out_of_stock' | 'critical' | 'low';
}
```

---

## Frontend API Clients (Already Exist)

### supplyChainApi.ts
Location: `/frontend/web/src/services/supplyChainApi.ts`

Already has stubs for:
- `getCategoriesApi()` - `/supply-chain/categories`
- `createCategoryApi()` - `/supply-chain/categories`
- `updateCategoryApi()` - `/supply-chain/categories/:id`
- `deleteCategoryApi()` - `/supply-chain/categories/:id`
- `getCategoryFieldsApi()` - `/supply-chain/categories/:id/fields`
- `getProductStandardsApi()` - `/supply-chain/product-standards`
- `getInventoryApi()` - `/supply-chain/inventory`
- `getLowStockItemsApi()` - `/supply-chain/low-stock`
- `getDashboardStatsApi()` - `/supply-chain/dashboard-stats`

### categoriesApi.ts
Location: `/frontend/web/src/services/categoriesApi.ts`

Expects different paths (no `/supply-chain` prefix):
- `getCategoriesApi()` - `/categories`
- `getProductStandardsApi()` - `/product-standards`
- `getLowStockItemsApi()` - `/product-standards/low-stock/items`

**Decision needed**: Which path structure to use? Consolidate into one API client.

---

## Implementation Recommendations

### Architecture Pattern
Follow the established pattern from `supplierService.ts`:

```
routes/supplyChain.ts (or categories.ts)
    ↓
controllers/supplyChain/categoryController.ts
controllers/supplyChain/productStandardController.ts
controllers/supplyChain/inventoryController.ts
    ↓
services/supplyChain/categoryService.ts
services/supplyChain/productStandardService.ts
services/supplyChain/inventoryService.ts
    ↓
repositories/supplyChain/categoryRepository.ts
repositories/supplyChain/productStandardRepository.ts
repositories/supplyChain/inventoryRepository.ts
```

### Key Implementation Notes
1. Use `query()` helper from `config/database.ts` (NOT `pool.execute()`)
2. Return `ServiceResult<T>` from service methods
3. Use controller helpers: `parseIntParam()`, `handleServiceResult()`, `sendErrorResponse()`
4. Add audit logging via `auditRepository.createAuditEntry()`

### Related Existing Code
- `supplierController.ts` - Reference for controller pattern
- `supplierService.ts` - Reference for service pattern with validation
- `supplierRepository.ts` - Reference for repository pattern with `query()` helper

---

## Current State (Nov 21, 2025)

- **Suppliers route**: Fully implemented with proper 3-layer architecture
- **Categories/Products/Inventory routes**: Not yet implemented
- **Frontend**: Has placeholder components and API client stubs ready
- **Database tables**: Already created and indexed

---

*Document created during code cleanup - preserved ideas from deleted supplyChainSimple.ts*
