# TimeTrackingPermissions Cleanup - Implementation Plan

**Created:** 2025-11-20
**Status:** 🔴 CRITICAL SECURITY FIX + Code Cleanup
**Related:** VinylPermissions cleanup (completed Nov 19, 2025)

---

## Executive Summary

**CRITICAL SECURITY GAP DISCOVERED:** All 30 time-tracking routes lack RBAC authorization middleware. Routes only check authentication (logged in) but not authorization (has permission). Services are the ONLY security layer.

**Solution:** Two-phase cleanup
- **Phase 1:** Add `requirePermission()` middleware to all routes (SECURITY FIX)
- **Phase 2:** Remove redundant service-level checks (CODE CLEANUP)

---

## Problem Statement

### Current Architecture Violation

```
❌ CURRENT (BROKEN):
Route (authenticateToken only) → Service (business logic + security) → Repository

✅ EXPECTED:
Route (authenticateToken + requirePermission) → Service (business logic only) → Repository
```

### Security Impact

| Issue | Severity | Description |
|-------|----------|-------------|
| **No Route Authorization** | 🔴 CRITICAL | Any authenticated user can call any time route |
| **Single Security Layer** | 🔴 HIGH | Only service checks prevent unauthorized access |
| **Bypass Risk** | 🟡 MEDIUM | If service called incorrectly, security fails |
| **Audit Gap** | 🟢 LOW | No route-level permission logging |

### Statistics

- **Routes without RBAC:** 30/30 (100%)
- **Service permission checks:** 18 checks across 4 files
- **Code to clean:** ~150 lines (permissions file + service blocks)
- **Files to modify:** 10 files total

---

## Phase 1: Add Route-Level RBAC Middleware

**Goal:** Fix critical security gap by adding `requirePermission()` to all routes

**Risk:** 🟢 LOW (additive only - doesn't remove existing protection)
**Timeline:** 2-3 hours (1 route for testing, then batch remaining)
**Can Deploy Independently:** ✅ YES

### Implementation Strategy

1. **Start with ONE route** - Test thoroughly before proceeding
2. **Write automated tests** - Verify route protection works
3. **Apply to remaining routes** - Batch apply same pattern
4. **Full regression testing** - Ensure no breakage

---

## Phase 2: Remove Service-Level Checks

**Goal:** Clean up redundant permission checks (like VinylPermissions cleanup)

**Risk:** 🟡 MEDIUM (requires Phase 1 complete first)
**Timeline:** 1-2 hours
**Prerequisites:** ✅ Phase 1 complete + tested

### Implementation Strategy

1. Remove `TimeTrackingPermissions` imports from services
2. Remove permission check blocks from 18 service methods
3. Remove `validatePermissions` option from `ServiceOptions`
4. Delete `/utils/timeTracking/permissions.ts` file
5. Add cleanup markers to modified files

---

## Route Permission Mapping

### Time Entries Routes (timeEntries.ts)

| Route | Method | Permission | Line | Notes |
|-------|--------|------------|------|-------|
| `/entries` | GET | `time_tracking.list` | 17 | View all time entries |
| `/entries` | POST | `time_tracking.create` | 59 | Create new entry |
| `/entries/:entryId` | PUT | `time_tracking.update` | 103 | Update single entry |
| `/entries/:entryId` | DELETE | `time_tracking.update` | 143 | Delete single entry |
| `/bulk-edit` | PUT | `time_tracking.update` | 177 | Bulk update entries |
| `/bulk-delete` | DELETE | `time_tracking.update` | 212 | Bulk delete entries |
| `/users` | GET | `time_tracking.list` | 246 | Get users list |

### Time Exporting Routes (timeExporting.ts)

| Route | Method | Permission | Line | Notes |
|-------|--------|------------|------|-------|
| `/export` | GET | `time_tracking.export` | 20 | Export to CSV/PDF |

**⚠️ Special Note:** Currently has inline permission check (lines 25-28) - convert to middleware

### Time Scheduling Routes (timeScheduling.ts)

| Route | Method | Permission | Line | Notes |
|-------|--------|------------|------|-------|
| `/schedules/:userId` | GET | `time_management.update` | 28 | View user work schedule |
| `/schedules/:userId` | PUT | `time_management.update` | 50 | Update work schedule |
| `/holidays` | GET | `time_management.update` | 73 | View company holidays |
| `/holidays` | POST | `time_management.update` | 94 | Add holiday |
| `/holidays/:holidayId` | DELETE | `time_management.update` | 125 | Remove holiday |
| `/holidays/export` | GET | `time_management.update` | 147 | Export holidays CSV |
| `/holidays/import` | POST | `time_management.update` | 171 | Import holidays CSV |

### Time Analytics Routes (timeAnalytics.ts)

| Route | Method | Permission | Line | Notes |
|-------|--------|------------|------|-------|
| `/weekly-summary` | GET | `time_management.view_reports` | 17 | Weekly hours summary |
| `/analytics-overview` | GET | `time_management.view_reports` | 57 | Dashboard analytics |
| `/analytics` | GET | `time_management.view_reports` | 97 | Individual user analytics |
| `/missing-entries` | GET | `time_management.view_reports` | 139 | Missing time entries |

### Time Tracking Routes (timeTracking.ts)

| Route | Method | Permission | Line | Notes |
|-------|--------|------------|------|-------|
| `/status` | GET | `time.create` | 43 | Clock status (own data - staff can see their own) |
| `/clock-in` | POST | `time.create` | 45 | Clock in (staff has this permission) |
| `/clock-out` | POST | `time.create` | 47 | Clock out (staff has this permission) |
| `/weekly-summary` | GET | `time.read` | 49 | User weekly summary (own data) |
| `/edit-request` | POST | `time.update` | 51 | Request time entry edit |
| `/delete-request` | POST | `time.update` | 53 | Request entry deletion |
| `/pending-requests` | GET | `time.approve` | 55 | View pending edit requests (managers) |
| `/process-request` | POST | `time.approve` | 57 | Approve/reject request (managers) |
| `/scheduled-breaks` | GET | `time_management.update` | 59 | View break schedule settings |
| `/scheduled-breaks/:id` | PUT | `time_management.update` | 61 | Update break schedule |
| `/notifications` | GET | *(auth only)* | 65 | User's own notifications - no permission needed |

**⚠️ IMPORTANT Permission Distinction:**
- `time.*` permissions (time.create, time.read, time.update) - For staff **own** clock operations
- `time_tracking.*` permissions (time_tracking.list, time_tracking.create) - For managers viewing **all** entries
- Staff role has: `time.create`, `time.read`, `time.update`
- Manager role has: All `time_tracking.*` and `time.*` permissions

**Note:** `/notifications` routes only need authentication since users can only see their own notifications

---

## Service-Level Checks to Remove (Phase 2)

### TimeEntriesService.ts (7 checks)

| Method | Permission Check | Line |
|--------|------------------|------|
| `getTimeEntries()` | `canViewTimeEntriesHybrid()` | 56 |
| `createTimeEntry()` | `canCreateTimeEntriesHybrid()` | 96 |
| `updateTimeEntry()` | `canUpdateTimeEntriesHybrid()` | 175 |
| `deleteTimeEntry()` | `canDeleteTimeEntriesHybrid()` | 243 |
| `bulkUpdateEntries()` | `canUpdateTimeEntriesHybrid()` | 303 |
| `bulkDeleteEntries()` | `canDeleteTimeEntriesHybrid()` | 370 |
| `getActiveUsers()` | `canViewTimeEntriesHybrid()` | 427 |

### SchedulingService.ts (7 checks)

| Method | Permission Check | Line |
|--------|------------------|------|
| `getWorkSchedules()` | `canManageTimeSchedulesHybrid()` | 58 |
| `updateWorkSchedules()` | `canManageTimeSchedulesHybrid()` | 95 |
| `getHolidays()` | `canManageTimeSchedulesHybrid()` | 158 |
| `createHoliday()` | `canManageTimeSchedulesHybrid()` | 219 |
| `deleteHoliday()` | `canManageTimeSchedulesHybrid()` | 304 |
| `exportHolidaysCSV()` | `canManageTimeSchedulesHybrid()` | 358 |
| `importHolidaysCSV()` | `canManageTimeSchedulesHybrid()` | 403 |

### TimeAnalyticsService.ts (3 checks)

| Method | Permission Check | Line |
|--------|------------------|------|
| `getWeeklySummary()` | `canViewTimeAnalyticsHybrid()` | 43 |
| `getAnalyticsOverview()` | `canViewTimeAnalyticsHybrid()` | 97 |
| `getUserAnalytics()` | `canViewTimeAnalyticsHybrid()` | 175 |

### MissingEntriesService.ts (1 check)

| Method | Permission Check | Line |
|--------|------------------|------|
| `getMissingEntries()` | `canViewTimeAnalyticsHybrid()` | 45 |

**Total:** 18 permission checks to remove

---

## Code Examples

### Phase 1: Adding Middleware

**BEFORE (timeEntries.ts:17):**
```typescript
router.get('/entries', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { startDate, endDate, status, users, group, search, quickFilter } = req.query;

    // Call service
    const result = await TimeEntriesService.getTimeEntries(user, { ... }, {});
    // ... rest of handler
  }
});
```

**AFTER:**
```typescript
import { requirePermission } from '../middleware/rbac';

router.get('/entries',
  authenticateToken,
  requirePermission('time_tracking.list'),  // ✅ ADD THIS
  async (req, res) => {
    try {
      const user = (req as any).user;
      const { startDate, endDate, status, users, group, search, quickFilter } = req.query;

      // Call service (permissions already enforced at route level)
      const result = await TimeEntriesService.getTimeEntries(user, { ... }, {});
      // ... rest of handler
    }
  }
);
```

### Phase 2: Removing Service Checks

**BEFORE (TimeEntriesService.ts:48-79):**
```typescript
static async getTimeEntries(
  user: User,
  filters: TimeEntryFilters,
  options: ServiceOptions = {}
): Promise<ServiceResponse<TimeEntry[]>> {
  try {
    // Check permissions
    if (options.validatePermissions !== false) {
      const canView = await TimeTrackingPermissions.canViewTimeEntriesHybrid(user);
      if (!canView) {
        return {
          success: false,
          error: 'You do not have permission to view time entries',
          code: 'PERMISSION_DENIED'
        };
      }
    }

    // Fetch entries
    const entries = await TimeEntryRepository.findEntries(filters);
    return { success: true, data: entries };
  } catch (error: any) {
    // ... error handling
  }
}
```

**AFTER:**
```typescript
static async getTimeEntries(
  user: User,
  filters: TimeEntryFilters,
  options: ServiceOptions = {}
): Promise<ServiceResponse<TimeEntry[]>> {
  try {
    // Permissions enforced at route level via requirePermission('time_tracking.list') middleware

    // Fetch entries
    const entries = await TimeEntryRepository.findEntries(filters);
    return { success: true, data: entries };
  } catch (error: any) {
    // ... error handling
  }
}
```

---

## Testing Strategy

### After Phase 1: Automated Tests

Create test file: `/backend/web/tests/routes/timeEntries.rbac.test.ts`

```typescript
import request from 'supertest';
import { app } from '../../src/app';
import { generateTestToken } from '../helpers/auth';

describe('Time Entries RBAC', () => {
  describe('GET /time-management/entries', () => {
    it('should return 401 without authentication', async () => {
      const res = await request(app).get('/api/time-management/entries');
      expect(res.status).toBe(401);
    });

    it('should return 403 without time_tracking.list permission', async () => {
      const token = generateTestToken({ role: 'production_staff', permissions: [] });
      const res = await request(app)
        .get('/api/time-management/entries')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('should return 200 with time_tracking.list permission', async () => {
      const token = generateTestToken({
        role: 'manager',
        permissions: ['time_tracking.list']
      });
      const res = await request(app)
        .get('/api/time-management/entries')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });

  // Repeat for POST, PUT, DELETE with appropriate permissions
});
```

### Manual Testing Checklist (Phase 1)

Test with different user roles:

**Manager (should have all permissions):**
- [ ] GET /entries - ✅ 200 OK
- [ ] POST /entries - ✅ 200 OK
- [ ] PUT /entries/:id - ✅ 200 OK
- [ ] DELETE /entries/:id - ✅ 200 OK

**Production Staff (limited permissions):**
- [ ] GET /entries - ❌ 403 Forbidden
- [ ] POST /entries - ❌ 403 Forbidden (or ✅ if allowed)
- [ ] PUT /schedules/:userId - ❌ 403 Forbidden

**Unauthenticated:**
- [ ] All routes - ❌ 401 Unauthorized

### Regression Testing (Both Phases)

- [ ] Time tracking clock in/out still works
- [ ] Time entry CRUD operations functional
- [ ] Work schedule management functional
- [ ] Analytics and reports accessible
- [ ] Export functionality works
- [ ] Holiday management works
- [ ] No errors in server logs
- [ ] Permission checks logged in `rbac_permission_logs`

---

## Rollback Plan

### Phase 1 Rollback (if needed)

```bash
# Remove middleware additions
git checkout HEAD -- backend/web/src/routes/timeEntries.ts
git checkout HEAD -- backend/web/src/routes/timeExporting.ts
git checkout HEAD -- backend/web/src/routes/timeScheduling.ts
git checkout HEAD -- backend/web/src/routes/timeAnalytics.ts
git checkout HEAD -- backend/web/src/routes/timeTracking.ts

# Rebuild and restart
cd backend/web && npm run build && cd ../..
infrastructure/scripts/stop-servers.sh
infrastructure/scripts/start-production.sh
```

**Impact:** Service checks remain - no security gap

### Phase 2 Rollback (if needed)

```bash
# Restore services and permissions file
git checkout HEAD -- backend/web/src/services/timeManagement/
git checkout HEAD -- backend/web/src/utils/timeTracking/permissions.ts
git checkout HEAD -- backend/web/src/types/TimeTypes.ts

# Rebuild and restart
cd backend/web && npm run build && cd ../..
infrastructure/scripts/stop-servers.sh
infrastructure/scripts/start-production.sh
```

**Impact:** Routes still have middleware - still secure

---

## Validation Checklist

### Phase 1 Complete When:

- [ ] `requirePermission()` imported in all 5 route files
- [ ] All 30 routes have middleware added
- [ ] Automated tests written and passing
- [ ] Manual testing with 3 user roles complete
- [ ] Permission logs appearing in database
- [ ] No regression in functionality
- [ ] Code compiles successfully
- [ ] Changes committed to git

### Phase 2 Complete When:

- [ ] `TimeTrackingPermissions` import removed from 4 services
- [ ] All 18 permission check blocks removed
- [ ] `validatePermissions` option removed from `ServiceOptions`
- [ ] `/utils/timeTracking/permissions.ts` deleted
- [ ] Cleanup markers added to service files
- [ ] Code compiles successfully
- [ ] All tests still passing
- [ ] Grep confirms no remaining references:
  ```bash
  grep -r "TimeTrackingPermissions" backend/web/src/  # Should be empty
  grep -r "validatePermissions" backend/web/src/      # Should be empty
  ```
- [ ] Changes committed to git

---

## Files to Modify

### Phase 1 (Route Middleware)

| File | Changes | Routes |
|------|---------|--------|
| `backend/web/src/routes/timeEntries.ts` | Add `requirePermission()` to 7 routes | 7 |
| `backend/web/src/routes/timeExporting.ts` | Convert inline check to middleware | 1 |
| `backend/web/src/routes/timeScheduling.ts` | Add `requirePermission()` to 7 routes | 7 |
| `backend/web/src/routes/timeAnalytics.ts` | Add `requirePermission()` to 4 routes | 4 |
| `backend/web/src/routes/timeTracking.ts` | Add `requirePermission()` to 9 routes (skip notifications) | 9 |

**Total:** 5 files, 30 routes modified

### Phase 2 (Service Cleanup)

| File | Changes | Lines Removed |
|------|---------|---------------|
| `backend/web/src/services/timeManagement/TimeEntriesService.ts` | Remove 7 permission checks | ~50 |
| `backend/web/src/services/timeManagement/SchedulingService.ts` | Remove 7 permission checks | ~50 |
| `backend/web/src/services/timeManagement/TimeAnalyticsService.ts` | Remove 3 permission checks | ~20 |
| `backend/web/src/services/timeManagement/MissingEntriesService.ts` | Remove 1 permission check | ~10 |
| `backend/web/src/types/TimeTypes.ts` | Remove `validatePermissions` option | ~3 |
| `backend/web/src/utils/timeTracking/permissions.ts` | **DELETE FILE** | ~100 |

**Total:** 6 files, ~233 lines removed

---

## Expected Metrics

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| **Routes with RBAC** | 0/30 (0%) | 30/30 (100%) | ✅ +30 protected |
| **Security layers** | 1 (service only) | 2 (route + audit) | ✅ Defense in depth |
| **Code lines** | Baseline | -233 lines | ✅ 233 lines removed |
| **Permission checks/request** | 1-7 (service) | 1 (route only) | ✅ 85-100% reduction |
| **Architecture violations** | 3 types | 0 | ✅ Fully compliant |
| **Test coverage** | Manual only | Automated + Manual | ✅ Better testing |

---

## Notes and Gotchas

### Special Cases

1. **Notification Routes** - May not need permissions (users see only their own)
   - Need to verify: Do we check ownership in service layer?
   - If yes, no permission needed
   - If no, add permission check

2. **Export Route (timeExporting.ts)** - Currently has inline check
   - Remove lines 25-28 (inline permission check)
   - Add middleware to route definition
   - Remove TimeTrackingPermissions import

3. **Scheduled Breaks** - Confirmed as company settings
   - Use `time_management.update` not `time_tracking.list`
   - Affects both GET and PUT routes

### Dead Code Identified

- `getRoleDisplayName()` method - never called (can delete)
- `validatePermissions` option - never used with `false` value
- `canApproveTimeRequestsHybrid()` - defined but never called
- `canRejectTimeRequestsHybrid()` - defined but never called

---

## Timeline Estimate

| Phase | Task | Estimated Time |
|-------|------|----------------|
| **Phase 1** | Test route setup (1 route) | 30 minutes |
| | Write automated tests | 45 minutes |
| | Apply middleware to remaining routes | 45 minutes |
| | Manual testing (3 roles × 10 routes) | 30 minutes |
| | **Phase 1 Total** | **2.5 hours** |
| **Phase 2** | Remove service checks (4 files) | 30 minutes |
| | Remove validatePermissions option | 15 minutes |
| | Delete permissions file | 5 minutes |
| | Regression testing | 30 minutes |
| | **Phase 2 Total** | **1.5 hours** |
| **GRAND TOTAL** | | **4 hours** |

---

## Success Criteria

### Security Goals

- ✅ All routes protected by RBAC middleware
- ✅ Defense in depth (route + service initially, route only after Phase 2)
- ✅ Permission checks logged for audit trail
- ✅ Unauthorized access returns 403 Forbidden
- ✅ No routes bypass authorization

### Architecture Goals

- ✅ Routes handle security (middleware)
- ✅ Services handle business logic only
- ✅ No architecture violations
- ✅ Single point of enforcement (DRY principle)

### Code Quality Goals

- ✅ ~233 lines removed
- ✅ No dead code remaining
- ✅ Automated tests in place
- ✅ Clean separation of concerns

---

## References

- **Similar Cleanup:** VinylPermissions (completed Nov 19, 2025)
- **RBAC Middleware:** `/backend/web/src/middleware/rbac.ts`
- **Architecture Guide:** `/CLAUDE.md` (3-layer architecture section)
- **Research Report:** In conversation history (2025-11-20)

---

## Approval Status

- **Phase 1:** ⏳ Awaiting user approval to start
- **Phase 2:** ⏳ Blocked (requires Phase 1 complete)

---

**Next Steps:**
1. User approval to proceed
2. Create progress tracker
3. Start with test route implementation
4. Write automated tests
5. Apply to remaining routes
6. Complete Phase 2 cleanup
