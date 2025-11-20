# API Service Refactoring Prompt

Read `/home/jon/Nexus/REFACTORING_PROGRESS.md` for context on completed refactorings.

## Objective

Refactor `/home/jon/Nexus/frontend/web/src/services/api.ts` (1,377 lines) into a modular, maintainable architecture with domain-specific API modules.

**Target**: Split into 16+ focused API modules, each under 150 lines

## Current State Analysis

The `api.ts` file currently contains:
- **1 shared axios instance** with interceptors (auth, token refresh)
- **16 API modules** exported as objects (authApi, customerApi, ordersApi, etc.)
- **Mixed concerns**: authentication, customers, orders, inventory, time tracking, etc.

### Identified API Modules (from grep analysis):
1. `authApi` - Authentication and user management
2. `customerApi` - Customer CRUD operations
3. `customerContactsApi` - Customer contact management
4. `vinylApi` - Vinyl inventory operations
5. `vinylProductsApi` - Vinyl product catalog
6. `suppliersApi` - Supplier management
7. `jobsApi` - Job estimation operations
8. `timeApi` - Time tracking and management (LARGE - likely 270+ lines)
9. `accountsApi` - Account management
10. `provincesApi` - Tax rules and provinces
11. `ordersApi` - Order operations (LARGE - likely 350+ lines)
12. `printApi` - Print job operations
13. `quickbooksApi` - QuickBooks integration
14. `ledsApi` - LED product operations
15. `powerSuppliesApi` - Power supply operations
16. `materialsApi` - Materials/substrates operations

## Refactoring Strategy

### Phase 1: Research & Deep Dive (30-45 mins)

**DO NOT CODE YET - RESEARCH FIRST**

1. **Analyze Current Structure**
   - Read the entire `api.ts` file (1,377 lines)
   - Document each API module's methods and line count
   - Identify shared dependencies (axios instance, interceptors)
   - Map out all exports and their consumers

2. **Identify Patterns**
   - Common request patterns (GET, POST, PUT, DELETE)
   - Error handling patterns
   - Response transformation patterns
   - TypeScript type usage

3. **Map Dependencies**
   - Which components import which API modules?
   - Are there circular dependencies?
   - What TypeScript types are used?

4. **Document Findings**
   - Create a detailed breakdown of each API module
   - Note any complex logic that needs special attention
   - Identify potential risks (breaking changes, type issues)

### Phase 2: Plan Architecture (20-30 mins)

**After Research, Create Detailed Plan**

1. **Directory Structure**
   ```
   frontend/web/src/services/
   ├── api/
   │   ├── index.ts              (main export, shared axios instance)
   │   ├── client.ts             (axios instance with interceptors)
   │   ├── auth.api.ts           (authApi)
   │   ├── customers.api.ts      (customerApi + customerContactsApi)
   │   ├── orders.api.ts         (ordersApi)
   │   ├── time.api.ts           (timeApi)
   │   ├── jobs.api.ts           (jobsApi)
   │   ├── inventory/
   │   │   ├── vinyl.api.ts      (vinylApi)
   │   │   ├── vinylProducts.api.ts
   │   │   ├── leds.api.ts
   │   │   ├── powerSupplies.api.ts
   │   │   └── materials.api.ts
   │   ├── print.api.ts          (printApi)
   │   ├── quickbooks.api.ts     (quickbooksApi)
   │   ├── suppliers.api.ts      (suppliersApi)
   │   ├── accounts.api.ts       (accountsApi)
   │   └── provinces.api.ts      (provincesApi)
   └── api.ts                    (legacy - re-export from api/index.ts for backward compatibility)
   ```

2. **Shared Infrastructure**
   - `client.ts` - Axios instance + interceptors
   - `index.ts` - Re-export all API modules
   - Consider shared types file if needed

3. **Migration Strategy**
   - Extract modules one by one
   - Test after each extraction
   - Keep original api.ts as re-export wrapper initially
   - Update imports gradually (or all at once if confident)

### Phase 3: Implementation Plan (Detailed Steps)

#### Step 1: Create Shared Client (15 mins)
- Extract axios instance creation to `api/client.ts`
- Move interceptors (request + response) to client.ts
- Export configured axios instance
- Keep session handling logic

#### Step 2: Extract Small API Modules First (60 mins)
**Start with smallest modules for quick wins:**
1. `provincesApi` (smallest - tax rules)
2. `ledsApi` (simple CRUD)
3. `powerSuppliesApi` (simple CRUD)
4. `materialsApi` (simple CRUD)
5. `quickbooksApi` (self-contained)
6. `suppliersApi` (medium complexity)
7. `accountsApi` (medium complexity)
8. `printApi` (medium complexity)

**For each module:**
- Create new file in `api/` directory
- Import shared client
- Copy module methods
- Add TypeScript types if missing
- Export module
- Test build

#### Step 3: Extract Medium API Modules (45 mins)
9. `authApi` (auth + user management)
10. `jobsApi` (job estimation)
11. Combine `vinylApi` + `vinylProductsApi` into `inventory/vinyl.api.ts` and `inventory/vinylProducts.api.ts`

#### Step 4: Extract Large API Modules (60 mins)
**These require extra care:**
12. `customerApi` + `customerContactsApi`
    - Consider splitting into `customers.api.ts` and `customerContacts.api.ts`
    - OR combine into single `customers.api.ts` with sub-modules

13. `timeApi` (270+ lines estimated)
    - May need to split into:
      - `time.api.ts` (time entries)
      - `timeScheduling.api.ts` (scheduling)
      - `timeAnalytics.api.ts` (analytics)
    - OR keep as one if cohesive

14. `ordersApi` (350+ lines estimated - LARGEST)
    - Consider splitting into:
      - `orders.api.ts` (basic CRUD)
      - `orderParts.api.ts` (order parts management)
      - `orderForms.api.ts` (form generation)
    - OR keep as one file if under 400 lines

#### Step 5: Create Index File (15 mins)
- Create `api/index.ts`
- Re-export all API modules
- Export shared client
- Maintain backward compatibility

#### Step 6: Update Main api.ts (10 mins)
- Replace contents with re-exports from `api/index.ts`
- Add deprecation notice in comments
- Keep for backward compatibility initially

#### Step 7: Update Imports (Optional - 30-60 mins)
**Two approaches:**

**Approach A: Keep Backward Compatibility (Recommended)**
- Leave all existing imports as-is
- New code uses `import { ordersApi } from '@/services/api'`
- Gradual migration over time

**Approach B: Update All Imports**
- Find all imports of `api.ts`
- Update to new paths
- Higher risk but cleaner

### Phase 4: Testing & Validation (30 mins)

1. **Build Testing**
   - Run `npm run build`
   - Ensure zero TypeScript errors
   - Check bundle size (should be similar or smaller)

2. **Import Testing**
   - Verify all API modules export correctly
   - Test one component from each domain
   - Ensure no circular dependencies

3. **Runtime Testing** (Manual)
   - Test authentication flow
   - Test a few CRUD operations from each domain
   - Verify interceptors still work (auth token, refresh)

### Phase 5: Documentation (15 mins)

1. **Update REFACTORING_PROGRESS.md**
   - Add API refactoring to completed section
   - Document before/after structure
   - Note any breaking changes

2. **Create API_REFACTORING_COMPLETE.md**
   - Summary of changes
   - New file structure
   - Migration guide for developers

## Critical Requirements

### Must Preserve
1. ✅ **Axios Instance Configuration**
   - Base URL from environment variable
   - Content-Type header
   - All interceptors (request + response)

2. ✅ **Authentication Logic**
   - Token injection in requests
   - Automatic token refresh on 401
   - Session expiry handling

3. ✅ **All API Methods**
   - Every exported method must work identically
   - Same signatures, same behavior
   - Same error handling

4. ✅ **Backward Compatibility**
   - Existing imports should continue to work
   - No breaking changes for consuming components

### Code Quality Standards
- Each file under 200 lines (target: 100-150 lines)
- Proper TypeScript types for all methods
- Consistent error handling
- JSDoc comments for complex methods
- Clean, readable code

### Testing Checkpoints
- ✅ Build passes after each extraction
- ✅ TypeScript has zero errors
- ✅ No console errors in browser
- ✅ Authentication still works
- ✅ API calls succeed
- ✅ Token refresh still works

## Risk Mitigation

### Before Starting
1. **Create backup**: `cp api.ts api.ts.backup`
2. **Commit current state**: Ensure clean git state
3. **Document current imports**: `grep -r "from.*services/api" src/ > api-imports.txt`

### During Refactoring
1. Test build after each file extraction
2. Keep original api.ts until all modules extracted
3. Don't modify consuming components unless necessary
4. Maintain git commit history (commit after each major step)

### Rollback Plan
- Keep backup file
- Can revert individual extractions
- Maintain backward compatibility layer

## Success Metrics

### Quantitative
- ✅ Main api.ts reduced from 1,377 lines to <50 lines (re-export only)
- ✅ All extracted files under 200 lines
- ✅ Number of files: 16-20 (one per domain)
- ✅ Build succeeds with zero errors
- ✅ No functionality lost

### Qualitative
- ✅ Easier to find specific API methods
- ✅ Clearer domain boundaries
- ✅ Better code organization
- ✅ Easier to test individual API modules
- ✅ Reduced cognitive load

## Expected Timeline

| Phase | Estimated Time |
|-------|----------------|
| Research & Analysis | 30-45 mins |
| Planning | 20-30 mins |
| Extract Shared Client | 15 mins |
| Extract Small Modules (8) | 60 mins |
| Extract Medium Modules (3) | 45 mins |
| Extract Large Modules (3) | 60 mins |
| Create Index | 15 mins |
| Update Main api.ts | 10 mins |
| Testing | 30 mins |
| Documentation | 15 mins |
| **Total** | **~4-6 hours** |

## Implementation Checklist

### Pre-Refactoring
- [ ] Read entire api.ts file
- [ ] Document all API modules and line counts
- [ ] Create backup of api.ts
- [ ] Commit current git state
- [ ] Document current imports

### Phase 1: Setup
- [ ] Create `services/api/` directory
- [ ] Create `client.ts` with axios instance + interceptors
- [ ] Test that client exports correctly

### Phase 2: Extract Modules (in order)
- [ ] provincesApi → `api/provinces.api.ts`
- [ ] ledsApi → `api/inventory/leds.api.ts`
- [ ] powerSuppliesApi → `api/inventory/powerSupplies.api.ts`
- [ ] materialsApi → `api/inventory/materials.api.ts`
- [ ] quickbooksApi → `api/quickbooks.api.ts`
- [ ] suppliersApi → `api/suppliers.api.ts`
- [ ] accountsApi → `api/accounts.api.ts`
- [ ] printApi → `api/print.api.ts`
- [ ] authApi → `api/auth.api.ts`
- [ ] jobsApi → `api/jobs.api.ts`
- [ ] vinylApi → `api/inventory/vinyl.api.ts`
- [ ] vinylProductsApi → `api/inventory/vinylProducts.api.ts`
- [ ] customerApi + customerContactsApi → `api/customers.api.ts`
- [ ] timeApi → `api/time.api.ts` (consider splitting if >200 lines)
- [ ] ordersApi → `api/orders.api.ts` (consider splitting if >300 lines)

### Phase 3: Integration
- [ ] Create `api/index.ts` with all re-exports
- [ ] Update main `api.ts` to re-export from `api/index.ts`
- [ ] Add backward compatibility layer
- [ ] Test build

### Phase 4: Validation
- [ ] TypeScript compilation succeeds
- [ ] No circular dependencies
- [ ] All imports resolve
- [ ] Manual testing of auth flow
- [ ] Manual testing of CRUD operations
- [ ] Verify token refresh works

### Phase 5: Documentation
- [ ] Update REFACTORING_PROGRESS.md
- [ ] Create API_REFACTORING_COMPLETE.md
- [ ] Document new file structure
- [ ] Add migration guide

## Special Considerations

### jobVersioningApi
- Already extracted to separate file (`jobVersioningApi.ts`)
- Keep as-is, just update re-export if needed

### TypeScript Types
- Consider creating `api/types/` directory if many shared types
- OR keep types co-located with each API module
- Ensure no circular type dependencies

### Large Modules Strategy

#### If ordersApi is >300 lines:
Consider splitting into:
```typescript
// api/orders/index.ts
export * from './orders.api';
export * from './orderParts.api';
export * from './orderForms.api';

// Usage stays the same:
import { ordersApi } from '@/services/api/orders';
```

#### If timeApi is >200 lines:
Consider splitting by feature:
```typescript
// api/time/index.ts
export * from './timeEntries.api';
export * from './timeScheduling.api';
export * from './timeAnalytics.api';
```

### Error Handling
- Ensure all API methods have consistent error handling
- Keep existing try-catch patterns
- Maintain error message formats
- Preserve error logging

## Example Extraction

### Before (in api.ts):
```typescript
export const provincesApi = {
  getTaxRules: async () => {
    const response = await api.get('/provinces/tax-rules');
    return response.data;
  },

  getProvinces: async () => {
    const response = await api.get('/provinces');
    return response.data;
  }
};
```

### After (in api/provinces.api.ts):
```typescript
import { apiClient } from './client';

/**
 * API methods for provinces and tax rules
 */
export const provincesApi = {
  /**
   * Get all tax rules
   */
  getTaxRules: async () => {
    const response = await apiClient.get('/provinces/tax-rules');
    return response.data;
  },

  /**
   * Get all provinces
   */
  getProvinces: async () => {
    const response = await apiClient.get('/provinces');
    return response.data;
  }
};
```

### In api/index.ts:
```typescript
export { provincesApi } from './provinces.api';
export { ordersApi } from './orders.api';
// ... all other exports
export { apiClient } from './client';
```

### In main api.ts (backward compatibility):
```typescript
/**
 * @deprecated This file is maintained for backward compatibility.
 * New code should import directly from '@/services/api/[module]'
 * This file will be removed in a future version.
 */

// Re-export everything from the new modular structure
export * from './api';
export { jobVersioningApi } from './jobVersioningApi';
```

## Final Notes

### Key Principles
1. **Research First** - Don't code until you understand the full structure
2. **Test Often** - Build after each extraction
3. **Keep It Simple** - Don't over-engineer
4. **Backward Compatible** - Don't break existing code
5. **Document Well** - Future developers will thank you

### When to Ask for Clarification
- If API module structure is unclear
- If splitting a large module, confirm the split strategy
- If TypeScript types are complex
- If circular dependencies appear
- If uncertain about backward compatibility approach

### Success Criteria
✅ Build passes with zero errors
✅ All 16 API modules extracted
✅ Each file under 200 lines
✅ Backward compatibility maintained
✅ Documentation complete
✅ Ready for production

---

**Ready to Begin?**

Start with Phase 1: Research & Deep Dive. Read the full api.ts file, analyze the structure, and come back with a detailed breakdown before writing any code.

**Remember**: Research until you have complete confidence in both the problem and solution. Then create a detailed plan. Only then begin implementation.
