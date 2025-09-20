# Archived Backend Routes

This index tracks backend route files that were archived because they are not mounted in `server.ts` and have no active frontend references. Archiving uses `backend/web/src/routes/archived/`, which is excluded from TypeScript compilation via `backend/web/tsconfig.json`.

Date: 2025-09-16

Archived files:
- backend/web/src/routes/archived/timeManagementOptimized.ts
  - Status: Unused consolidated Time Management router. Split routers are in use via `routes/timeManagement.ts`.
- backend/web/src/routes/archived/productStandards.ts
  - Status: Not mounted; no frontend references to `/api/product-standards`.
- backend/web/src/routes/archived/categories.ts
  - Status: Not mounted; no frontend references to `/api/categories`.
- backend/web/src/routes/archived/supplyChain.ts
  - Status: Superseded by `supplyChainSimple.ts`, which is mounted.
- backend/web/src/routes/archived/wagesRefactored.ts
  - Status: Duplicate of `wages.ts`; `wages.ts` is mounted. Contents are effectively identical.
- backend/web/src/routes/archived/customers.ts.backup
  - Status: Backup copy, not used at runtime.

Notes:
- To restore a route, move it back from `routes/archived/` to `routes/` and update `server.ts` to mount it.
- Keep changes aligned with Route → Controller → Service → Repository pattern, and verify no path collisions.
