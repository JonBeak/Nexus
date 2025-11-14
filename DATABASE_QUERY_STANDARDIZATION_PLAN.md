# Database Query Standardization Plan

## Created: November 13, 2025

## Executive Summary

The codebase currently has **inconsistent database access patterns** with two competing approaches:
- **Pattern A**: Direct `pool.execute()` usage (265+ occurrences across 20+ files)
- **Pattern B**: `query()` helper function (104 occurrences across 14 files)

**Goal**: Standardize on the `query()` helper across the entire codebase for consistency, maintainability, and future extensibility.

---

## Current State Analysis

### Database Configuration File
**File**: `/backend/web/src/config/database.ts`

Exports three items:
1. `pool` - MySQL connection pool (mysql2/promise)
2. `query()` - Helper function that wraps pool.execute() with error logging
3. `testConnection()` - Startup health check (used only in server.ts)

### Query Helper Function Benefits

```typescript
export const query = async (sql: string, params: any[] = []): Promise<any> => {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};
```

**Advantages**:
1. ✅ **Automatic destructuring** - Returns just `rows`, not `[rows, fields]` tuple
2. ✅ **Centralized error logging** - All database errors logged consistently
3. ✅ **Simpler syntax** - Less boilerplate in calling code
4. ✅ **No TypeScript generics needed** - Cleaner code at call sites
5. ✅ **Single enhancement point** - Easy to add query timing, metrics, retry logic
6. ✅ **Future-proof** - Can add connection pooling stats, slow query logging, etc.

**Direct pool.execute() Pattern** (Current Problem):
```typescript
// Repetitive, verbose, inconsistent
const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
```

**Query Helper Pattern** (Target):
```typescript
// Clean, simple, consistent
const rows = await query(sql, params) as RowDataPacket[];
```

---

## Files Requiring Migration

### Phase 1: Repositories (Priority - Architectural Layer)
**Impact**: 7 repositories, ~150 pool.execute() calls

| File | Usage Count (Est.) | Notes |
|------|-------------------|-------|
| `/repositories/jobEstimationRepository.ts` | ~25 | Main estimation data access |
| `/repositories/orderRepository.ts` | ~30 | Order management queries |
| `/repositories/payrollRepository.ts` | ~20 | Payroll calculations |
| `/repositories/quickbooksRepository.ts` | ~35 | QuickBooks integration |
| `/repositories/customerContactRepository.ts` | ~15 | Contact management |
| `/repositories/timeTracking/TimeEntryRepository.ts` | ~15 | Time entry data |
| `/repositories/timeManagement/SchedulingRepository.ts` | ~10 | Schedule management |

**Total**: ~150 pool.execute() calls to migrate

### Phase 2: Controllers (Architectural Violation - Should Be Removed)
**Impact**: 10+ controllers with direct DB access

These controllers violate the 3-layer architecture and should be refactored:

| File | Issue | Correct Approach |
|------|-------|-----------------|
| `/controllers/authController.ts` | Direct DB queries | Move to auth service/repository |
| `/controllers/lockController.ts` | Direct DB queries | Move to lock service/repository |
| `/controllers/jobController.ts` | Direct DB queries | Move to job service/repository |
| `/controllers/estimateController.ts` | Direct DB queries | Move to estimate service/repository |
| `/controllers/materialsController.ts` | Direct DB queries | Move to materials service/repository |
| `/controllers/ledsController.ts` | Direct DB queries | Move to leds service/repository |
| `/controllers/powerSuppliesController.ts` | Direct DB queries | Move to power supplies service/repository |
| `/controllers/printController.ts` | Direct DB queries | Move to print service/repository |
| `/controllers/orderImageController.ts` | Direct DB queries | Move to order service/repository |

**Note**: Controllers should ONLY handle HTTP concerns (request/response). All DB access must go through Services → Repositories.

### Phase 3: Routes (Architectural Violation - Should Be Removed)
**Impact**: 5 route files with direct DB access

| File | Issue | Correct Approach |
|------|-------|-----------------|
| `/routes/auth.ts` | Direct queries for sessions/tokens | Create auth repository |
| `/routes/accounts.ts` | Direct RBAC queries | Use existing rbac middleware |
| `/routes/jobs.ts` | Direct job lookup | Use job service |
| `/routes/suppliers.ts` | Direct supplier queries | Create supplier repository |

**Note**: Routes should ONLY define middleware chains and route handlers. Zero DB access.

### Phase 4: Services (Low Priority - Some May Be Acceptable)
**Impact**: 2 service files using query helper already

| File | Status | Notes |
|------|--------|-------|
| `/services/estimationSessionService.ts` | ✅ Already uses query() | Keep as-is |
| `/services/rateLookupService.ts` | ✅ Already uses query() | Keep as-is |

### Phase 5: Middleware (Currently Using Query Helper)
**Impact**: Already standardized ✅

| File | Status |
|------|--------|
| `/middleware/rbac.ts` | ✅ Uses query() helper |

---

## Migration Strategy

### Phase 1: Repositories (SAFE - Low Risk)
**Timeline**: 1-2 hours
**Risk**: Low (same layer, just syntax change)
**Testing**: Unit tests for each repository

**Steps**:
1. Update import: `import { pool }` → `import { query }`
2. Replace pattern: `const [rows] = await pool.execute(...)` → `const rows = await query(...)`
3. Remove TypeScript generics (optional, query returns any)
4. Test each repository method
5. Run integration tests

**Example Migration**:
```typescript
// BEFORE
import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2';

async getEstimateById(id: number): Promise<RowDataPacket | null> {
  const [estimateRows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM job_estimates WHERE id = ?',
    [id]
  );
  return estimateRows.length > 0 ? estimateRows[0] : null;
}

// AFTER
import { query } from '../config/database';
import { RowDataPacket } from 'mysql2';

async getEstimateById(id: number): Promise<RowDataPacket | null> {
  const estimateRows = await query(
    'SELECT * FROM job_estimates WHERE id = ?',
    [id]
  ) as RowDataPacket[];
  return estimateRows.length > 0 ? estimateRows[0] : null;
}
```

### Phase 2: Fix Architectural Violations (COMPLEX - High Risk)
**Timeline**: 4-8 hours per controller
**Risk**: High (architectural refactoring)
**Testing**: Full integration testing required

**NOT part of this cleanup** - requires separate refactoring plan for each controller.

**Approach**:
1. Identify all DB queries in controller
2. Create/update corresponding repository methods
3. Create/update service layer to orchestrate business logic
4. Update controller to call service methods only
5. Remove all `import { pool }` from controllers
6. Comprehensive testing

**Example** (authController.ts):
```typescript
// CURRENT (BAD) - Controller doing DB queries
export const login = async (req: Request, res: Response) => {
  const [users] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
  // ... business logic ...
  await pool.execute('INSERT INTO login_logs ...', [...]);
};

// TARGET (GOOD) - Controller delegates to service
export const login = async (req: Request, res: Response) => {
  const result = await authService.authenticateUser(username, password);
  res.json(result);
};

// Service layer
async authenticateUser(username: string, password: string) {
  const user = await userRepository.findByUsername(username);
  // ... business logic ...
  await loginLogRepository.create(...);
}
```

### Phase 3: Routes (COMPLEX - High Risk)
**Timeline**: 2-4 hours per route file
**Risk**: Medium-High
**Testing**: Integration testing required

**Same approach as Phase 2** - move all DB logic to services/repositories.

---

## Implementation Plan

### Week 1: Low-Hanging Fruit (Repositories)
- [ ] Migrate jobEstimationRepository.ts
- [ ] Migrate orderRepository.ts
- [ ] Migrate payrollRepository.ts
- [ ] Migrate quickbooksRepository.ts
- [ ] Migrate customerContactRepository.ts
- [ ] Migrate timeTracking/TimeEntryRepository.ts
- [ ] Migrate timeManagement/SchedulingRepository.ts
- [ ] Test all repository changes
- [ ] Deploy to production

### Week 2-4: Architectural Fixes (Controllers)
Each controller requires individual refactoring plan:
- [ ] Plan authController refactoring
- [ ] Plan lockController refactoring
- [ ] Plan jobController refactoring
- [ ] Plan estimateController refactoring
- [ ] Plan materialsController refactoring
- [ ] Plan ledsController refactoring
- [ ] Plan powerSuppliesController refactoring
- [ ] Plan printController refactoring
- [ ] Plan orderImageController refactoring

### Week 5: Route Cleanup
- [ ] Plan auth routes refactoring
- [ ] Plan accounts routes refactoring
- [ ] Plan jobs routes refactoring
- [ ] Plan suppliers routes refactoring

---

## Success Criteria

### Immediate (Phase 1):
- ✅ All repositories use `query()` helper
- ✅ Zero `pool.execute()` calls in repository layer
- ✅ All repository tests passing
- ✅ Consistent error logging across all DB operations

### Long-term (Phases 2-3):
- ✅ Zero DB access in controllers (only service calls)
- ✅ Zero DB access in routes (only middleware chains)
- ✅ Clean 3-layer architecture: Routes → Controllers → Services → Repositories
- ✅ All integration tests passing

---

## Rollback Plan

If issues arise during migration:

1. **Repository changes**: Simple - revert import and syntax changes
2. **Controller refactoring**: Use git to revert specific controller files
3. **Route refactoring**: Use git to revert specific route files

**Safety**: Commit after each file migration for easy rollback.

---

## Future Enhancements (Once Standardized)

After standardization on `query()` helper, we can easily add:

### 1. Query Performance Monitoring
```typescript
export const query = async (sql: string, params: any[] = []): Promise<any> => {
  const startTime = Date.now();
  try {
    const [rows] = await pool.execute(sql, params);
    const duration = Date.now() - startTime;

    if (duration > 1000) {
      logger.warn('Slow query detected', { sql, duration, params });
    }

    return rows;
  } catch (error) {
    logger.error('Database query error:', { error, sql, params });
    throw error;
  }
};
```

### 2. Query Metrics Collection
```typescript
// Track query counts, avg response time, errors
metrics.increment('db.query.count');
metrics.timing('db.query.duration', duration);
```

### 3. Connection Pool Monitoring
```typescript
// Log pool stats periodically
logger.info('Connection pool stats', {
  active: pool.pool.activeConnections(),
  idle: pool.pool.idleConnections(),
  total: pool.pool.totalConnections()
});
```

### 4. Automatic Query Retry Logic
```typescript
// Retry on connection errors
for (let attempt = 0; attempt < 3; attempt++) {
  try {
    return await pool.execute(sql, params);
  } catch (error) {
    if (isRetryableError(error) && attempt < 2) {
      await sleep(100 * Math.pow(2, attempt));
      continue;
    }
    throw error;
  }
}
```

### 5. Development Query Logging
```typescript
if (process.env.NODE_ENV === 'development') {
  logger.debug('Query executed', { sql, params, duration });
}
```

---

## References

- **Current Implementation**: `/backend/web/src/config/database.ts`
- **Best Practice Example**: `/middleware/rbac.ts` (already uses query helper)
- **Architecture Standard**: See `/CLAUDE.md` - Enhanced Three Layer Architecture

---

## Notes

- This is a **living document** - update as migration progresses
- Each phase can be done independently
- Phase 1 (repositories) is safe and should be done first
- Phases 2-3 (controllers/routes) require careful planning and testing
- Always test thoroughly before production deployment
- **Commit after each file** for easy rollback

---

## Status Tracking

| Phase | Status | Start Date | Completion Date | Notes |
|-------|--------|------------|-----------------|-------|
| Phase 1: Repositories | Not Started | - | - | 7 files, ~150 calls |
| Phase 2: Controllers | Not Started | - | - | 9 files, requires architecture refactoring |
| Phase 3: Routes | Not Started | - | - | 4 files, requires architecture refactoring |
| Phase 4: Documentation | Not Started | - | - | Update CLAUDE.md |

---

**Last Updated**: November 13, 2025
**Owner**: Development Team
**Priority**: Medium (Phase 1), Low (Phases 2-3 - part of broader architecture cleanup)
