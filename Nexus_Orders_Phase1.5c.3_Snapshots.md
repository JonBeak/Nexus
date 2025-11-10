# Phase 1.5.c.3: Snapshot & Versioning System

**Status:** ✅ COMPLETE (2025-11-06)
**Priority:** HIGH
**Duration:** 0.5 days (~4 hours)
**Dependencies:** Phase 1.5.c.2 (Order Templates) ✅
**Last Updated:** 2025-11-06

---

## Overview

Phase 1.5.c.3 implements a **complete snapshot and versioning system** with unlimited version history. Instead of a single JSON snapshot column, we use a dedicated `order_part_snapshots` table that stores every version, allowing full audit trail and version comparison.

**Key Features:**
- **Version History:** Track V1, V2, V3... with full metadata
- **Unlimited Snapshots:** Store every finalization/modification
- **Audit Trail:** Track who/when/why for each snapshot
- **Comparison:** Compare current state with latest or any historical version
- **Highlighting:** Visual feedback (yellow/orange) for modified fields

---

## Architecture Decision: Snapshots Table (Not JSON Column)

### ❌ Old Design (Rejected)
```sql
-- Single JSON column approach (from original spec)
order_parts.finalized_snapshot JSON  -- Gets overwritten, no history
```

**Problems:**
- Only stores ONE snapshot
- No version history
- Gets overwritten on re-finalization
- Hard to query
- Can't compare specific versions

### ✅ New Design (Implemented)
```sql
-- Dedicated snapshots table with full version history
CREATE TABLE order_part_snapshots (
  snapshot_id INT PRIMARY KEY AUTO_INCREMENT,
  part_id INT NOT NULL,
  version_number INT NOT NULL,  -- Sequential: 1, 2, 3...

  -- Snapshot data (copy of order_parts at finalization)
  specifications JSON,
  invoice_description TEXT,
  quantity DECIMAL(10,2),
  unit_price DECIMAL(10,2),
  extended_price DECIMAL(10,2),
  production_notes TEXT,

  -- Metadata
  snapshot_type ENUM('finalization', 'manual'),
  notes TEXT,
  created_at TIMESTAMP,
  created_by INT,

  UNIQUE KEY (part_id, version_number)
);
```

**Benefits:**
- ✅ Unlimited version history
- ✅ Queryable (compare V1 vs V3, etc.)
- ✅ Full audit trail
- ✅ No redundancy (removed `finalized_snapshot` column completely)
- ✅ Proper database normalization
- ✅ Future-proof for version comparison UI

---

## Database Schema

### New Table: `order_part_snapshots`

```sql
CREATE TABLE IF NOT EXISTS order_part_snapshots (
  snapshot_id INT PRIMARY KEY AUTO_INCREMENT,
  part_id INT NOT NULL COMMENT 'FK to order_parts',
  version_number INT NOT NULL COMMENT 'Sequential version (1, 2, 3...)',

  -- Snapshot data (copy of order_parts at finalization time)
  specifications JSON COMMENT 'Semantic keys snapshot',
  invoice_description TEXT,
  quantity DECIMAL(10,2),
  unit_price DECIMAL(10,2),
  extended_price DECIMAL(10,2),
  production_notes TEXT,

  -- Metadata
  snapshot_type ENUM('finalization', 'manual') DEFAULT 'finalization',
  notes TEXT COMMENT 'Reason for snapshot (e.g., "Customer requested size change")',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT COMMENT 'User who created snapshot',

  -- Foreign keys
  FOREIGN KEY (part_id) REFERENCES order_parts(part_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,

  -- Indexes
  INDEX idx_part_id (part_id),
  INDEX idx_part_version (part_id, version_number),
  INDEX idx_created_at (created_at),

  -- Ensure unique version numbers per part
  UNIQUE KEY uk_part_version (part_id, version_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Existing Tables (Phase 1.5.b)

```sql
-- orders table (already exists)
finalized_at TIMESTAMP NULL COMMENT 'When order was finalized'
finalized_by INT UNSIGNED COMMENT 'User who finalized'
modified_after_finalization BOOLEAN DEFAULT false COMMENT 'Flag if modified post-finalization'
```

**Migration Status:** ✅ Applied (2025-11-06)
**Migration File:** `database/migrations/2025-11-06_phase1.5c.3_snapshots_table.sql`

---

## Implementation Summary

### Backend Service Methods (orderService.ts)

**✅ Implemented (4 methods, +247 lines):**

1. **`createPartSnapshot()`** - Create snapshot for single part
   - Gets current part data
   - Calculates next version number
   - Inserts into `order_part_snapshots`
   - Returns snapshot_id

2. **`finalizeOrder()`** - Create snapshots for all parts
   - Transaction-wrapped
   - Creates snapshot for each part
   - Updates `orders.finalized_at` and `finalized_by`
   - Resets `modified_after_finalization` flag

3. **`getLatestSnapshot()`** - Get most recent snapshot for a part
   - Returns latest version_number
   - Used for comparison with current state

4. **`getSnapshotHistory()`** - Get all snapshots for a part
   - Returns full version history
   - Includes user details (username)
   - Used for future version viewer UI

5. **`compareWithLatestSnapshot()`** - Compare current vs latest
   - Detects modifications in specs, invoice, notes
   - Returns modification details array
   - Used for highlighting changed fields

### Backend Controller (orderController.ts)

**✅ Implemented (4 endpoints, +114 lines):**

1. **`POST /api/orders/:orderNumber/finalize`**
   - Creates snapshots for all parts
   - Updates order finalization status
   - Requires `orders.update` permission

2. **`GET /api/orders/parts/:partId/snapshot/latest`**
   - Returns latest snapshot for a part
   - Used by UI to detect changes

3. **`GET /api/orders/parts/:partId/snapshots`**
   - Returns full version history
   - For future version comparison UI

4. **`GET /api/orders/parts/:partId/compare`**
   - Compares current part state with latest snapshot
   - Returns modification details

### Backend Routes (orders.ts)

**✅ Implemented (+44 lines):**
- All 4 endpoints added to routes
- Proper authentication and RBAC middleware
- Organized in "ORDER FINALIZATION & SNAPSHOTS" section

### Frontend Utilities

**✅ Implemented (2 files, 413 lines total):**

#### 1. `snapshotComparison.ts` (223 lines)
- `isPartModified()` - Check if part changed
- `isSpecFieldModified()` - Check specific spec field
- `isInvoiceFieldModified()` - Check invoice field
- `isProductionNotesModified()` - Check notes
- `getModifiedFields()` - Get all changes
- `formatModification()` - Format for display
- `getModificationSummary()` - Summary text
- `getSnapshotVersion()` - Version info
- `formatSnapshotDate()` - Date formatting

#### 2. `highlightStyles.tsx` (190 lines)
- `getModifiedFieldClass()` - Yellow highlight CSS
- `<ModifiedBadge>` - "Modified" indicator
- `<ModifiedDot>` - Inline dot indicator
- `<ModifiedIcon>` - Warning icon
- `<ModifiedOrderBanner>` - Top-level warning
- `<ModifiedFieldWrapper>` - Wrapper with tooltip
- `<ComparisonView>` - Side-by-side comparison
- `<VersionBadge>` - Version number display

---

## Usage Examples

### Backend - Create Snapshots on Finalization

```typescript
// Finalize order (creates Version 1 for all parts)
await orderService.finalizeOrder(orderId, userId);

// Get latest snapshot for a part
const snapshot = await orderService.getLatestSnapshot(partId);
console.log(snapshot.version_number); // 1

// Later - modify part and finalize again
await orderService.finalizeOrder(orderId, userId);
// Creates Version 2 for all parts

// Get full history
const history = await orderService.getSnapshotHistory(partId);
console.log(history.length); // 2 versions
```

### Frontend - Detect and Highlight Changes

```typescript
import { isSpecFieldModified, getModifiedFieldClass } from '@/utils/snapshotComparison';
import { ModifiedBadge } from '@/utils/highlightStyles';

// Check if field is modified
const isModified = isSpecFieldModified(part, 'height');

// Get highlight class
const className = getModifiedFieldClass(
  isModified,
  'w-full px-2 py-1 border rounded'
);

// Render with highlight
<div className="relative">
  <input
    value={height}
    onChange={handleChange}
    className={className}
    title={isModified ? `Original: ${part.latest_snapshot.specifications.height}` : ''}
  />
  <ModifiedBadge show={isModified} />
</div>
```

### Frontend - Show Modified Order Banner

```typescript
import { isPartModified, getModifiedFields } from '@/utils/snapshotComparison';
import { ModifiedOrderBanner } from '@/utils/highlightStyles';

const modifiedParts = order.parts.filter(isPartModified);
const totalChanges = modifiedParts.reduce(
  (sum, part) => sum + getModifiedFields(part).length,
  0
);

<ModifiedOrderBanner
  show={totalChanges > 0}
  modificationCount={totalChanges}
  onViewChanges={() => setShowChangesModal(true)}
/>
```

---

## Workflow

### 1. Initial Finalization (Version 1)

```
Manager clicks "Finalize Order"
  ↓
Backend creates Version 1 snapshots for all parts
  ↓
orders.finalized_at = NOW()
orders.finalized_by = user_id
orders.modified_after_finalization = false
```

### 2. Customer Requests Change

```
Customer: "Can you make it 12 inches instead of 10?"
  ↓
Manager edits part.specifications.height: "10" → "12"
  ↓
Frontend detects change (compare with Version 1)
  ↓
UI shows yellow highlight on height field
  ↓
orders.modified_after_finalization = true
```

### 3. Re-Finalization (Version 2)

```
Manager clicks "Finalize Order" again
  ↓
Backend creates Version 2 snapshots for all parts
  ↓
Version 1 preserved in history
orders.modified_after_finalization = false
```

### 4. Future: Version Comparison UI

```
User clicks "View Version History"
  ↓
Modal shows: Version 1 (Nov 6, 10:00 AM) | Version 2 (Nov 6, 2:00 PM)
  ↓
User selects: "Compare V1 vs V2"
  ↓
Side-by-side diff:
  Height: 10" → 12" ⚠
  Depth: 3" (unchanged)
```

---

## Success Criteria

✅ **All criteria met (2025-11-06):**

- ✅ Backend `finalizeOrder()` method creates snapshots
- ✅ Backend creates unique version numbers per part
- ✅ Frontend comparison utilities detect modifications
- ✅ Highlight styling components ready for UI integration
- ✅ API endpoints functional and tested
- ✅ Database snapshots persist correctly
- ✅ No redundancy (removed `finalized_snapshot` column approach)
- ✅ Unlimited version history supported
- ✅ Full audit trail (who/when/why)
- ✅ TypeScript compilation clean
- ✅ Builds successful (backend + frontend)

---

## Integration with UI (Future)

### Phase 1.5.c.5 (Dual-Table UI)
The dual-table interface will integrate snapshot comparison:
- Yellow highlights on modified spec fields
- Yellow highlights on modified invoice fields
- Modified badges next to field labels
- Tooltip showing original vs current value
- Banner at top if any modifications detected

### Future Enhancement: Version History Viewer
- Modal showing all versions for an order
- Timeline view with version cards
- Side-by-side comparison of any two versions
- Revert functionality (create new version from old version)
- Export version history as PDF

---

## Files Created/Modified

### Database
- ✅ `database/migrations/2025-11-06_phase1.5c.3_snapshots_table.sql` (172 lines) **NEW**

### Backend
- ✅ `backend/web/src/services/orderService.ts` (+247 lines)
- ✅ `backend/web/src/controllers/orderController.ts` (+114 lines)
- ✅ `backend/web/src/routes/orders.ts` (+44 lines)

### Frontend
- ✅ `frontend/web/src/utils/snapshotComparison.ts` (223 lines) **NEW**
- ✅ `frontend/web/src/utils/highlightStyles.tsx` (190 lines) **NEW**

**Total Lines Added:** ~990 lines

---

## Testing

### Backend API Tests (Manual)

```bash
# 1. Finalize order (creates V1)
curl -X POST http://localhost:3001/api/orders/200000/finalize \
  -H "Authorization: Bearer $TOKEN"

# 2. Verify snapshot created
mysql -u webuser -pwebpass123 sign_manufacturing -e "
  SELECT part_id, version_number, created_at
  FROM order_part_snapshots
  WHERE part_id IN (SELECT part_id FROM order_parts WHERE order_id =
    (SELECT order_id FROM orders WHERE order_number = 200000))
"

# 3. Modify a field
mysql -u webuser -pwebpass123 sign_manufacturing -e "
  UPDATE order_parts
  SET invoice_description = 'MODIFIED DESCRIPTION'
  WHERE part_id = 89
"

# 4. Check for modifications
curl http://localhost:3001/api/orders/parts/89/compare \
  -H "Authorization: Bearer $TOKEN"

# 5. Re-finalize (creates V2)
curl -X POST http://localhost:3001/api/orders/200000/finalize \
  -H "Authorization: Bearer $TOKEN"

# 6. Verify V2 created
mysql -u webuser -pwebpass123 sign_manufacturing -e "
  SELECT version_number, created_at FROM order_part_snapshots
  WHERE part_id = 89 ORDER BY version_number
"
```

---

## Next Steps

Once Phase 1.5.c.3 is complete ✅:

1. **Proceed to Phase 1.5.c.4:** Task Management UI
2. **Then Phase 1.5.c.5:** Dual-Table UI with snapshot integration
3. **Integrate snapshots:** Use comparison utilities in dual-table interface
4. **Add highlighting:** Apply yellow highlights to modified fields

---

**Document Status:** ✅ Complete - Fully Implemented and Tested
**Architecture:** Snapshots table with unlimited version history
**Last Updated:** 2025-11-06
