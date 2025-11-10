# Phase 1.5.g: Order Folder & Image Management

**Status:** In Progress
**Started:** 2025-11-10
**Objective:** Integrate SMB folder management with Orders system for image tracking and conflict prevention

---

## Overview

Enable the Orders system to:
1. Track and manage order folders on SMB share (`//192.168.2.85/Channel Letter`)
2. Display job images from folder in Order Details UI
3. Automatically create folders when orders are created
4. Prevent duplicate folder names
5. Automatically move folders to 1Finished when orders complete
6. Migrate existing 2,066 folders into database for conflict tracking

---

## Current State Analysis

### Database
- ✅ `orders.sign_image_path` field exists (VARCHAR 500) - currently unused
- Orders link to customers via `customer_id`
- Order naming: user provides `order_name`, system generates `order_number` (200000+)

### SMB Share
- **Location:** `//192.168.2.85/Channel Letter` → mounted at `/mnt/channelletter`
- **58 active folders** in root directory
- **2,008 finished folders** in `/1Finished` subdirectory
- **Naming pattern:** `{order_name} ----- {customer_company_name}`
- **File types:** JPG, JPEG, PNG (and PDFs, but images only for now)

### Integration Points
- Order creation: `orderConversionService.convertEstimateToOrder()` - line 33-147
- Order status changes: `orderService.updateOrderStatus()` - line 100-153
- Order details UI: `OrderDetailsPage.tsx`
- No current image serving infrastructure

---

## Architecture Decisions

### 1. Order Number Ranges
- **100000-199999:** Migrated orders from existing SMB folders (legacy tracking)
- **200000+:** App-created orders (production use)

### 2. Migration Strategy
- Create database orders for existing folders (for conflict prevention)
- Parse folder names: `"145 King Sample ----- Spectra Signs"` → extract job name + customer
- Match customer by `company_name` (case-insensitive)
- Unmatched customers logged for manual review
- Status: `in_production` (active folders) or `completed` (1Finished folders)
- Flag: `is_migrated=true` to distinguish from app orders

### 3. Folder Lifecycle
```
Order Created → Create Folder (active)
    ↓
Order Completed → Move to 1Finished
    ↓
Conflict Check → If conflict, keep in active (log error)
```

### 4. Conflict Detection
- Case-insensitive exact match on full folder name
- Check both active and finished locations before creating
- Prevent order creation if folder name conflict exists

### 5. Image Selection
- List all JPG/JPEG/PNG files in order's folder
- User selects one image as "job image"
- Store filename in `orders.sign_image_path`
- Serve via static route: `/order-images/{folder_name}/{filename}`

---

## Database Schema Changes

```sql
-- Add folder tracking fields to orders
ALTER TABLE orders
  ADD COLUMN folder_name VARCHAR(500),
  ADD COLUMN folder_exists BOOLEAN DEFAULT FALSE,
  ADD COLUMN folder_location ENUM('active', 'finished', 'none') DEFAULT 'none',
  ADD COLUMN is_migrated BOOLEAN DEFAULT FALSE COMMENT 'True for orders created from existing SMB folders';

-- Index for folder name lookups (case-insensitive conflict detection)
CREATE INDEX idx_folder_name ON orders(folder_name);

-- sign_image_path already exists, will store just the filename
```

---

## Implementation Phases

### Phase 1: Database & Migration Service ✅ / ⏳ / ❌

**Files to Create:**
- `/database/migrations/2025-11-10_order_folder_tracking.sql`
- `/backend/web/src/services/orderFolderService.ts`
- `/backend/web/src/scripts/migrateExistingFolders.ts`

**Migration Script Logic:**
1. Scan `/mnt/channelletter` (58 folders) + `/mnt/channelletter/1Finished` (2,008 folders)
2. Parse folder names: `"JobName ----- CustomerName"`
3. Match customer by `company_name` (case-insensitive)
4. Create orders with:
   - `order_number`: 100000 + sequential
   - `is_migrated`: true
   - `status`: 'in_production' OR 'completed'
   - `folder_location`: 'active' OR 'finished'
   - `folder_name`: exact folder name
   - `order_date`: current date
   - `created_by`: system user (1)
5. Log unmatched customers to file for manual review

**Order Folder Service Functions:**
- `checkFolderConflict(folderName)` - Check if name exists (case-insensitive)
- `createOrderFolder(orderName, customerName)` - Create folder on SMB
- `moveToFinished(folderName)` - Move to 1Finished directory
- `listImagesInFolder(folderName)` - List JPG/JPEG/PNG files
- `buildFolderName(orderName, customerName)` - Construct standard name

---

### Phase 2: Order Creation Integration ⏳

**Modified Files:**
- `/backend/web/src/services/orderConversionService.ts:147` - Add folder creation

**Folder Creation Logic:**
1. Build `folder_name`: `"{order_name} ----- {customer.company_name}"`
2. Check for conflicts (case-insensitive) in both active & finished
3. If conflict exists → throw error, prevent order creation
4. Create folder on SMB share: `mkdir "/mnt/channelletter/{folder_name}"`
5. Update order: `folder_name`, `folder_exists=true`, `folder_location='active'`

---

### Phase 3: Automatic Folder Movement ⏳

**Modified Files:**
- `/backend/web/src/services/orderService.ts:143` - Update status change logic

**Movement Logic:**
1. When order status changes to 'completed':
2. Check if folder exists in active location
3. Check for conflicts in 1Finished (case-insensitive)
4. If no conflict:
   - Move folder: `/mnt/channelletter/{name}` → `/mnt/channelletter/1Finished/{name}`
   - Update order: `folder_location='finished'`
5. If conflict exists:
   - Log error, don't move
   - Keep `folder_location='active'`
   - Return warning in API response

---

### Phase 4: Image API Endpoints ⏳

**New Files:**
- `/backend/web/src/controllers/orderImageController.ts`
- `/backend/web/src/routes/orderImages.ts`

**Endpoints:**
```typescript
GET  /api/orders/:orderNumber/available-images
// Returns: [{ filename, path, size, modified_date }]
// Scans order's folder for JPG/JPEG/PNG files

PATCH /api/orders/:orderNumber/job-image
// Body: { filename: "design.jpg" }
// Updates: sign_image_path field
// Validates: file exists in folder

GET  /order-images/{folder_name}/{filename}
// Static file serving via Express
// Example: /order-images/JobA ----- CompanyX/design.jpg
```

**In server.ts:**
```typescript
// Serve order images from SMB mount
app.use('/order-images', express.static('/mnt/channelletter', {
  maxAge: '7d',      // Browser caching
  immutable: true,
  fallthrough: false // 404 if file not found
}));
```

---

### Phase 5: Frontend Integration ⏳

**New Components:**
- `/frontend/web/src/components/orders/modals/ImagePickerModal.tsx`
  - Lists available images from folder
  - Shows image previews
  - Allows selection of job image

- `/frontend/web/src/components/orders/common/OrderImage.tsx`
  - Displays selected job image
  - Fallback if no image selected
  - Click to open image picker

**Modified Files:**
- `/frontend/web/src/components/orders/details/OrderDetailsPage.tsx`
  - Add OrderImage component at top of order details
  - Add "Select Image" button

- `/frontend/web/src/services/api.ts`
  - Add `ordersApi.getAvailableImages(orderNumber)`
  - Add `ordersApi.setJobImage(orderNumber, filename)`

---

## File Structure Summary

```
Nexus/
├── database/migrations/
│   └── 2025-11-10_order_folder_tracking.sql (NEW)
│
├── backend/web/src/
│   ├── controllers/
│   │   └── orderImageController.ts (NEW)
│   ├── services/
│   │   ├── orderFolderService.ts (NEW)
│   │   └── orderConversionService.ts (MODIFIED)
│   ├── routes/
│   │   └── orderImages.ts (NEW)
│   ├── scripts/
│   │   └── migrateExistingFolders.ts (NEW)
│   └── server.ts (MODIFIED - add static serving)
│
└── frontend/web/src/
    ├── components/orders/
    │   ├── modals/
    │   │   └── ImagePickerModal.tsx (NEW)
    │   ├── common/
    │   │   └── OrderImage.tsx (NEW)
    │   └── details/
    │       └── OrderDetailsPage.tsx (MODIFIED)
    └── services/
        └── api.ts (MODIFIED)
```

---

## Testing Strategy

### Migration Testing
1. ✅ Count folders: 58 active + 2,008 finished = 2,066 total
2. ⏳ Run migration on test database copy
3. ⏳ Verify customer matching accuracy
4. ⏳ Review unmatched customers log
5. ⏳ Confirm order_number range (100000-102065)

### Folder Creation Testing
1. ⏳ Create order with unique name → folder created
2. ⏳ Create order with duplicate name → error thrown
3. ⏳ Verify folder exists on SMB share
4. ⏳ Check special characters handling

### Folder Movement Testing
1. ⏳ Complete order → folder moves to 1Finished
2. ⏳ Complete order with conflict → stays in active
3. ⏳ Verify database tracking updated

### Image Serving Testing
1. ⏳ List images API returns correct files
2. ⏳ Static serving loads images in browser
3. ⏳ Set job image updates database
4. ⏳ Image displays in Order Details UI

---

## Edge Cases & Error Handling

### Folder Name Conflicts
- **Scenario:** Order name "JobA" + Customer "CompanyX" already exists
- **Handling:** Prevent order creation, show error to user
- **Resolution:** User must choose different order name

### Customer Not Found During Migration
- **Scenario:** Folder "JobA ----- UnknownCo" doesn't match any customer
- **Handling:** Skip folder, log to `/tmp/order-migration-unmatched.log`
- **Resolution:** Manual review and customer creation if needed

### Folder Move Conflict
- **Scenario:** Order completes, but folder name exists in 1Finished
- **Handling:** Keep folder in active, log error, update `folder_location='active'`
- **Resolution:** Manual file management by user

### SMB Mount Unavailable
- **Scenario:** `/mnt/channelletter` not accessible
- **Handling:**
  - Folder operations fail gracefully
  - Order creation still succeeds (folder_exists=false)
  - Image serving returns 404
- **Resolution:** Remount SMB share, retry operations

### Special Characters in Names
- **Scenario:** Order name contains `/`, `\`, or other special chars
- **Handling:** Sanitize folder names, replace invalid chars with `_`
- **Resolution:** Automatic sanitization in `buildFolderName()`

---

## Security Considerations

1. **Path Traversal Prevention**
   - Validate folder names don't contain `..` or `/`
   - Use path.join() to construct safe paths

2. **File Type Validation**
   - Only serve JPG/JPEG/PNG files
   - Reject executable files

3. **Access Control**
   - Image endpoints require authentication
   - Only show images for orders user has access to

---

## Performance Optimization

1. **Browser Caching**
   - 7-day cache headers for images
   - Immutable flag for unchanged files

2. **Database Indexing**
   - Index on `folder_name` for fast conflict checks
   - Index on `folder_location` for filtered queries

3. **Image Thumbnails** (Future Enhancement)
   - Generate thumbnails for faster list view
   - Store in `/mnt/channelletter/.thumbnails/`

---

## Future Enhancements (Not in Scope)

1. **Part-Specific Images**
   - Add `order_parts.image_filename` field
   - Multiple images per order

2. **Image Upload**
   - Upload images directly through UI
   - Auto-create folder if doesn't exist

3. **Image Gallery View**
   - Carousel of all images in folder
   - Full-screen preview modal

4. **Automatic Folder Creation from QB**
   - When QuickBooks estimate syncs
   - Create folder early in workflow

---

## Migration Log Format

```
/tmp/order-migration-log.txt

=== Order Folder Migration Started ===
Date: 2025-11-10 15:30:00

Scanning /mnt/channelletter...
Found 58 active folders

Scanning /mnt/channelletter/1Finished...
Found 2,008 finished folders

Processing 2,066 total folders...

[SUCCESS] 145 King Sample ----- Spectra Signs
  → Order #100000, Customer ID: 423 (Spectra Signs)

[SUCCESS] Allison 3ft box ----- RM Signs
  → Order #100001, Customer ID: 567 (RM Signs)

[SKIP] Unknown Job ----- NonExistent Customer
  → Customer not found in database

...

=== Migration Summary ===
Total Folders: 2,066
Successfully Created: 2,051 orders
Skipped (No Customer Match): 15 folders

Unmatched customers written to: /tmp/order-migration-unmatched.log

=== Migration Completed ===
Date: 2025-11-10 15:35:42
```

---

## Rollback Plan

If issues occur:

1. **Database Rollback**
   - Restore from backup: `/database/backups/pre-phase1.5g-backup.sql`
   - Remove migrated orders: `DELETE FROM orders WHERE is_migrated = true`

2. **Code Rollback**
   - Git revert to commit before Phase 1.5.g
   - Rebuild backend: `npm run build`
   - Restart servers

3. **No Filesystem Changes**
   - SMB folders remain unchanged during migration
   - Folder creation only affects new orders

---

## Success Criteria

- ✅ Database migration completes without errors
- ✅ All 2,066 folders tracked in database (or logged if skipped)
- ✅ New orders create folders automatically
- ✅ Folder name conflicts prevented
- ✅ Completed orders move folders to 1Finished
- ✅ Images display in Order Details page
- ✅ Image selection updates database
- ✅ No breaking changes to existing order functionality

---

## Progress Tracking

- [⏳] Phase 1: Database & Migration Service
  - [ ] Create migration SQL
  - [ ] Create orderFolderService.ts
  - [ ] Create migrateExistingFolders.ts
  - [ ] Run migration script
  - [ ] Review unmatched customers

- [⏳] Phase 2: Order Creation Integration
  - [ ] Modify orderConversionService.ts
  - [ ] Test folder creation
  - [ ] Test conflict prevention

- [⏳] Phase 3: Automatic Folder Movement
  - [ ] Modify orderService.ts
  - [ ] Test folder movement on completion
  - [ ] Test conflict handling

- [⏳] Phase 4: Image API Endpoints
  - [ ] Create orderImageController.ts
  - [ ] Create orderImages.ts routes
  - [ ] Add static serving to server.ts
  - [ ] Test image listing API
  - [ ] Test image selection API

- [⏳] Phase 5: Frontend Integration
  - [ ] Create ImagePickerModal.tsx
  - [ ] Create OrderImage.tsx
  - [ ] Modify OrderDetailsPage.tsx
  - [ ] Modify api.ts
  - [ ] Test end-to-end image workflow

---

## Notes & Observations

- SMB share is already mounted and accessible
- Existing `sign_image_path` field saves us schema work
- Migration creates "virtual orders" for legacy jobs (conflict tracking only)
- Case-insensitive matching important for customer names
- File operations need proper error handling (SMB can be flaky)

---

## Related Documentation

- `Nexus_Orders_Phase1.5_OVERVIEW.md` - Overall Phase 1.5 architecture
- `Nexus_Orders_Phase1.5b_DatabaseSchema.md` - Database schema reference
- `Nexus_Orders_Phase1.5c_DualTableUI.md` - Order UI structure
- `CLAUDE.md` - Production safety rules and coding standards
