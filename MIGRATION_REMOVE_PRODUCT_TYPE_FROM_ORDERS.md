# Migration Plan: Remove `product_type` from Order Parts

## Overview

The `product_type` column in `order_parts` table is redundant. We should use `specs_display_name` for display and `product_type_id` for logic. This column was a legacy field from Estimate-to-Order conversion that's no longer needed.

**Scope**: Only `order_parts` table - estimates still need their product_type handling.

---

## Current State Analysis

### Database Column
```sql
-- order_parts table
product_type VARCHAR(100) NOT NULL  -- Often contains "New Part" or duplicates specs_display_name
specs_display_name VARCHAR(255)     -- The correct display name (e.g., "Vinyl", "LEDs", "Channel Letters")
product_type_id VARCHAR(100)        -- Machine-readable ID for logic
```

### Files Using `product_type` (Order-related only)

| File | Usage | Action |
|------|-------|--------|
| `types/orders.ts` | Type definitions (OrderPart, CreateOrderPartData) | Remove field |
| `repositories/orderPartRepository.ts` | INSERT, SELECT, UPDATE queries | Remove from queries |
| `services/orderPartsService.ts` | Sets "New Part" default, updates | Remove usage |
| `services/orderTaskService.ts` | Returns in getTasksByPart | Use specs_display_name |
| `repositories/orderPreparationRepository.ts` | SELECT queries | Remove field |
| `repositories/orderFormRepository.ts` | SELECT queries | Remove field |
| `services/pdf/generators/*.ts` | Already uses `specs_display_name \|\| product_type` | Remove fallback |
| `utils/orderDataHashService.ts` | Includes in hash calculation | Remove from hash |
| `types/orderPreparation.ts` | Type definitions | Remove field |
| `frontend/types/orders.ts` | Type definitions | Remove field |
| `frontend/PartRow.tsx` | Already uses `specs_display_name \|\| product_type` | Remove fallback |

---

## Migration Phases

### Phase 1: Ensure `specs_display_name` is Always Populated

**Goal**: No order_parts row should have NULL specs_display_name

#### 1.1 Database Migration
```sql
-- Check current state
SELECT COUNT(*) as total,
       SUM(CASE WHEN specs_display_name IS NULL OR specs_display_name = '' THEN 1 ELSE 0 END) as missing_display_name
FROM order_parts;

-- Backfill missing specs_display_name from product_type
UPDATE order_parts
SET specs_display_name = product_type
WHERE (specs_display_name IS NULL OR specs_display_name = '')
  AND product_type IS NOT NULL
  AND product_type != 'New Part';

-- For "New Part" entries, set a sensible default or flag for review
UPDATE order_parts
SET specs_display_name = 'Custom Item'
WHERE (specs_display_name IS NULL OR specs_display_name = '')
  AND (product_type = 'New Part' OR product_type IS NULL);
```

#### 1.2 Update Part Creation Code
**File**: `backend/web/src/services/orderPartsService.ts`

```typescript
// BEFORE (line ~322)
product_type: 'New Part',

// AFTER - Remove product_type, ensure specs_display_name is set
specs_display_name: 'New Item',  // Or derive from context
```

---

### Phase 2: Remove `product_type` from Display Code

#### 2.1 PDF Generators (already using fallback - remove fallback)

**Files**:
- `services/pdf/generators/orderFormGenerator.ts` (lines 159, 275)
- `services/pdf/generators/packingListGenerator.ts` (lines 139, 171)
- `services/pdf/generators/estimatePdfGenerator.ts` (line 155)

```typescript
// BEFORE
const displayName = part.specs_display_name || part.product_type;

// AFTER
const displayName = part.specs_display_name;
```

#### 2.2 Frontend PartRow (already using fallback - remove fallback)

**File**: `frontend/web/src/components/orders/details/dualtable/components/PartRow.tsx` (line 95)

```typescript
// BEFORE
const displayName = part.specs_display_name || part.product_type;

// AFTER
const displayName = part.specs_display_name;
```

#### 2.3 Order Task Service

**File**: `backend/web/src/services/orderTaskService.ts` (line 80)

Already returns `specs_display_name` from repository - verify no product_type usage.

---

### Phase 3: Remove from Queries and Types

#### 3.1 Backend Types

**File**: `backend/web/src/types/orders.ts`

```typescript
// REMOVE from OrderPart interface (line 111)
product_type: string;  // Human-readable  // <-- DELETE

// REMOVE from CreateOrderPartData interface (line 134)
product_type: string;  // <-- DELETE
```

**File**: `backend/web/src/types/orderPreparation.ts`
- Remove `product_type` from relevant interfaces

#### 3.2 Repository Queries

**File**: `backend/web/src/repositories/orderPartRepository.ts`

```typescript
// createOrderPart() - Remove from INSERT (lines 33, 43)
// updateOrderPart() - Remove update handling (lines 108, 128-130)
// getOrderParts() - Will automatically not include it
```

**File**: `backend/web/src/repositories/orderPreparationRepository.ts`
- Remove `product_type` from SELECT statements (lines 136, 295, 314)

**File**: `backend/web/src/repositories/orderFormRepository.ts`
- Remove `product_type` from SELECT (line 171)

#### 3.3 Services

**File**: `backend/web/src/services/orderPartsService.ts`
- Remove `product_type` from addPart() (line 322)
- Remove from updateParts() (line 389)

#### 3.4 Hash Service

**File**: `backend/web/src/utils/orderDataHashService.ts`
- Remove `product_type` from hash calculation (line 83)
- Note: This will change hashes - may trigger "stale" warnings for existing orders

#### 3.5 Frontend Types

**File**: `frontend/web/src/types/orders.ts`
- Remove `product_type` from OrderPart interface (line 132)

**File**: `frontend/web/src/services/api/orders/orderPartsApi.ts`
- Remove from API request types (line 15)

---

### Phase 4: Database Column Removal

```sql
-- Only after all code changes are deployed and verified

-- 1. Make column nullable first (safety step)
ALTER TABLE order_parts MODIFY product_type VARCHAR(100) NULL;

-- 2. Verify no code is writing to it (monitor for a few days)

-- 3. Drop the column
ALTER TABLE order_parts DROP COLUMN product_type;
```

---

## Checklist

### Phase 1: Data Preparation
- [ ] Run backfill query to populate missing `specs_display_name`
- [ ] Verify no NULL `specs_display_name` values remain
- [ ] Update part creation to not require `product_type`

### Phase 2: Display Code
- [ ] Update `orderFormGenerator.ts` - remove fallback
- [ ] Update `packingListGenerator.ts` - remove fallback
- [ ] Update `estimatePdfGenerator.ts` - remove fallback
- [ ] Update `PartRow.tsx` - remove fallback
- [ ] Build and test PDF generation

### Phase 3: Remove from Code
- [ ] Update `types/orders.ts` (backend)
- [ ] Update `types/orderPreparation.ts`
- [ ] Update `orderPartRepository.ts`
- [ ] Update `orderPreparationRepository.ts`
- [ ] Update `orderFormRepository.ts`
- [ ] Update `orderPartsService.ts`
- [ ] Update `orderDataHashService.ts`
- [ ] Update `types/orders.ts` (frontend)
- [ ] Update `orderPartsApi.ts`
- [ ] Full build (backend + frontend)
- [ ] Test order creation, editing, PDF generation

### Phase 4: Database
- [ ] Make column nullable
- [ ] Monitor for issues (1 week)
- [ ] Drop column

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Missing `specs_display_name` causes blank displays | Phase 1 backfill + NOT NULL constraint after |
| Hash changes trigger false "stale" warnings | Document this, consider regenerating hashes |
| Third-party integrations expecting `product_type` | Audit API responses, add to response if needed |
| Rollback needed | Keep column nullable for 1 week before dropping |

---

## Timeline Estimate

- Phase 1: 1 hour (database + creation code)
- Phase 2: 30 minutes (display code cleanup)
- Phase 3: 2-3 hours (types, queries, services)
- Phase 4: 1 week monitoring, then 5 minutes to drop

**Total Active Work**: ~4 hours
**Total Elapsed Time**: ~1-2 weeks (including monitoring)
