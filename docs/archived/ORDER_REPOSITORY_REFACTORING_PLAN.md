# Order Repository Refactoring Plan

## Overview

**File**: `/backend/web/src/repositories/orderRepository.ts`
**Original Size**: 1,354 lines (170% over 500-line limit)
**Target**: 4 focused repositories, each under 400 lines
**Estimated Time**: 3-4 hours

---

## Current State Analysis

### File Structure (1,354 lines total)

| Section | Lines | Methods | Description |
|---------|-------|---------|-------------|
| Helper Methods | 44-158 (~115) | 4 | ID lookups, tax queries |
| Order CRUD | 160-422 (~263) | 8 | Core order operations |
| Order Parts | 424-623 (~200) | 5 | Part management |
| Order Tasks | 625-740 (~116) | 6 | Task management |
| Status History | 742-777 (~36) | 2 | Status tracking |
| Estimate Operations | 779-865 (~87) | 5 | Conversion support |
| Phase 1.5 Methods | 867-908 (~42) | 2 | Validation helpers |
| Point Persons | 910-966 (~57) | 3 | Contact management |
| PDF Generation | 968-1283 (~316) | 7 | Form paths, staleness |
| Folder Tracking | 1285-1350 (~66) | 4 | SMB folder management |

### Consumer Files (12 total)

| Consumer File | Methods Used | Primary Domain |
|---------------|--------------|----------------|
| `orderService.ts` | 12 methods | Core CRUD, tasks |
| `orderController.ts` | 9 methods | Parts, tasks, validation |
| `orderConversionService.ts` | 6 methods | Estimate conversion |
| `pdfGenerationService.ts` | 6 methods | PDF/forms |
| `orderFolderService.ts` | 4 methods | Folder tracking |
| `orderImageController.ts` | 2 methods | Image management |
| `orderPreparationController.ts` | 2 methods | Staleness checks |
| `orderTaskService.ts` | 1 method | Task creation |
| `orderValidationService.ts` | 1 method | Part retrieval |
| `orderPartCreationService.ts` | 3 methods | Part creation |
| `orderSpecificationStandardizationService.ts` | 1 method | PDF data |
| `utils/orderDataHashService.ts` | 0 (uses orderPrepRepo) | Hash calculation |

---

## Target Architecture

### New Repository Structure

```
backend/web/src/repositories/
├── orderRepository.ts           (~320 lines) - Core order operations
├── orderPartRepository.ts       (~280 lines) - Parts & tasks
├── orderFormRepository.ts       (~380 lines) - PDF & folder operations
└── orderConversionRepository.ts (~200 lines) - Estimate conversion
```

### Method Distribution

#### 1. orderRepository.ts (~320 lines) - Core Order Operations

**Purpose**: Core order CRUD, status management, helper methods

```typescript
// HELPER METHODS
- getOrderIdFromOrderNumber()
- getCustomerTaxFromBillingAddress()
- getTaxRateByName()

// ORDER CRUD
- createOrder()
- getOrders()
- getOrderById()
- updateOrder()
- updateOrderStatus()
- updateJobImage()
- deleteOrder()
- getNextOrderNumber()

// STATUS HISTORY
- createStatusHistory()
- getStatusHistory()

// VALIDATION HELPERS
- getOrderByEstimateId()
- isOrderNameUniqueForCustomer()
```

**Consumers after refactor**:
- orderService.ts
- orderController.ts (partial)
- orderConversionService.ts (partial)

---

#### 2. orderPartRepository.ts (~280 lines) - Parts & Tasks

**Purpose**: Order parts and production tasks management

```typescript
// ORDER PARTS
- createOrderPart()
- getOrderParts()
- getOrderPartById()
- updateOrderPart()
- deleteOrderPart()

// ORDER TASKS
- createOrderTask()
- getOrderTasks()
- updateTaskCompletion()
- deleteTask()
- getTasksByRole()
- updateTaskStarted()
- getAvailableTasks()
- checkTaskStaleness()
```

**Consumers after refactor**:
- orderService.ts
- orderController.ts
- orderTaskService.ts
- orderValidationService.ts
- orderPartCreationService.ts
- orderPreparationController.ts (checkTaskStaleness)

---

#### 3. orderFormRepository.ts (~380 lines) - PDF & Folder Operations

**Purpose**: PDF generation support, form versioning, folder management

```typescript
// FOLDER OPERATIONS
- getOrderFolderDetails()
- checkFolderNameConflict()
- getOrderFolderLocation()
- updateFolderTracking()

// PDF DATA
- getOrderWithCustomerForPDF()

// FORM VERSIONING
- updateOrderFormVersion()
- upsertOrderFormPaths()
- getOrderFormPaths()
- orderFormsExist()
- checkOrderFormStaleness()
```

**Consumers after refactor**:
- pdfGenerationService.ts
- orderFolderService.ts
- orderImageController.ts
- orderPreparationController.ts (checkOrderFormStaleness)
- orderSpecificationStandardizationService.ts

---

#### 4. orderConversionRepository.ts (~200 lines) - Estimate Conversion

**Purpose**: Estimate-to-order conversion, point persons

```typescript
// ESTIMATE OPERATIONS
- getEstimateForConversion()
- getEstimateItems()
- updateEstimateStatus()
- updateEstimateStatusAndApproval()
- getProductTypeInfo()

// POINT PERSONS
- createOrderPointPerson()
- getOrderPointPersons()
- deleteOrderPointPersons()
```

**Consumers after refactor**:
- orderConversionService.ts
- orderPartCreationService.ts (getProductTypeInfo)

---

## Implementation Phases

### Phase 1: Create New Repository Files
- [ ] Create `orderPartRepository.ts` with extracted methods
- [ ] Create `orderFormRepository.ts` with extracted methods
- [ ] Create `orderConversionRepository.ts` with extracted methods
- [ ] Refactor `orderRepository.ts` to keep only core methods

### Phase 2: Add Backward Compatibility Re-exports
- [ ] Add re-exports in `orderRepository.ts` for all extracted methods
- [ ] Verify TypeScript compilation passes
- [ ] Test that existing consumers still work

### Phase 3: Update Consumer Imports (12 files)
- [ ] `orderService.ts` - Add orderPartRepository import
- [ ] `orderController.ts` - Add orderPartRepository import
- [ ] `orderConversionService.ts` - Add orderConversionRepository import
- [ ] `pdfGenerationService.ts` - Add orderFormRepository import
- [ ] `orderFolderService.ts` - Add orderFormRepository import
- [ ] `orderImageController.ts` - Add orderFormRepository import
- [ ] `orderPreparationController.ts` - Add orderPartRepository, orderFormRepository imports
- [ ] `orderTaskService.ts` - Add orderPartRepository import
- [ ] `orderValidationService.ts` - Add orderPartRepository import
- [ ] `orderPartCreationService.ts` - Add orderPartRepository, orderConversionRepository imports
- [ ] `orderSpecificationStandardizationService.ts` - Add orderFormRepository import

### Phase 4: Cleanup
- [ ] Remove re-exports from `orderRepository.ts`
- [ ] Verify all imports are direct (no re-exports)
- [ ] Run build to verify no TypeScript errors
- [ ] Test production functionality

---

## Detailed Method Mapping

### Methods Moving to orderPartRepository.ts

| Method | Current Lines | Consumers |
|--------|---------------|-----------|
| `createOrderPart()` | 431-466 | orderConversionService, orderController |
| `getOrderParts()` | 471-483 | orderService, orderController, orderValidationService |
| `getOrderPartById()` | 488-505 | orderController |
| `updateOrderPart()` | 511-603 | orderController, orderPartCreationService |
| `deleteOrderPart()` | 1344-1350 | orderController |
| `createOrderTask()` | 632-643 | orderController, orderTaskService |
| `getOrderTasks()` | 648-655 | orderService |
| `updateTaskCompletion()` | 660-673 | orderService |
| `deleteTask()` | 679-684 | orderController |
| `getTasksByRole()` | 689-723 | orderService |
| `updateTaskStarted()` | 728-740 | orderService |
| `getAvailableTasks()` | 609-623 | orderController |
| `checkTaskStaleness()` | 1150-1215 | orderPreparationController |

### Methods Moving to orderFormRepository.ts

| Method | Current Lines | Consumers |
|--------|---------------|-----------|
| `getOrderFolderDetails()` | 68-97 | orderFolderService, orderImageController |
| `checkFolderNameConflict()` | 1293-1300 | orderFolderService |
| `getOrderFolderLocation()` | 1306-1317 | orderFolderService |
| `updateFolderTracking()` | 1323-1339 | orderFolderService, orderConversionService |
| `getOrderWithCustomerForPDF()` | 975-1050 | pdfGenerationService, orderSpecStandardization |
| `updateOrderFormVersion()` | 1055-1060 | pdfGenerationService |
| `upsertOrderFormPaths()` | 1065-1095 | pdfGenerationService |
| `getOrderFormPaths()` | 1100-1131 | pdfGenerationService |
| `orderFormsExist()` | 1136-1143 | pdfGenerationService |
| `checkOrderFormStaleness()` | 1221-1283 | orderPreparationController |

### Methods Moving to orderConversionRepository.ts

| Method | Current Lines | Consumers |
|--------|---------------|-----------|
| `getEstimateForConversion()` | 786-795 | orderConversionService |
| `getEstimateItems()` | 800-816 | orderConversionService |
| `updateEstimateStatus()` | 821-828 | (unused - can remove) |
| `updateEstimateStatusAndApproval()` | 834-841 | orderConversionService |
| `getProductTypeInfo()` | 846-865 | orderPartCreationService |
| `createOrderPointPerson()` | 917-940 | orderConversionService |
| `getOrderPointPersons()` | 945-954 | orderConversionService |
| `deleteOrderPointPersons()` | 959-966 | (unused - can remove) |

### Methods Staying in orderRepository.ts

| Method | Current Lines | Consumers |
|--------|---------------|-----------|
| `getOrderIdFromOrderNumber()` | 51-62 | orderService, orderController |
| `getCustomerTaxFromBillingAddress()` | 103-140 | orderService |
| `getTaxRateByName()` | 146-158 | pdfGenerationService |
| `createOrder()` | 167-209 | orderConversionService |
| `getOrders()` | 215-269 | orderService |
| `getOrderById()` | 274-287 | orderService, orderController |
| `updateOrder()` | 292-368 | orderService |
| `updateOrderStatus()` | 373-380 | orderService |
| `updateJobImage()` | 386-401 | orderImageController |
| `deleteOrder()` | 406-408 | orderService |
| `getNextOrderNumber()` | 413-422 | orderConversionService |
| `createStatusHistory()` | 749-759 | orderService, orderConversionService |
| `getStatusHistory()` | 764-777 | orderService |
| `getOrderByEstimateId()` | 875-889 | orderController, orderConversionService |
| `isOrderNameUniqueForCustomer()` | 895-908 | orderController |

---

## Key Preservation Requirements

### Transaction Support
All methods with `connection?: PoolConnection` parameter must preserve this pattern:
- `createOrder()`
- `createOrderPart()`
- `createOrderTask()`
- `updateOrderPart()`
- `updateOrderStatus()`
- `createStatusHistory()`
- `getEstimateForConversion()`
- `getEstimateItems()`
- `updateEstimateStatus()`
- `updateEstimateStatusAndApproval()`
- `getProductTypeInfo()`
- `getNextOrderNumber()`
- `createOrderPointPerson()`
- `deleteOrderPointPersons()`
- `updateFolderTracking()`
- `deleteOrderPart()`

### Import Pattern
Each new repository follows the singleton pattern:
```typescript
export class OrderPartRepository {
  // methods...
}

export const orderPartRepository = new OrderPartRepository();
```

### Database Access Pattern
- Use `query()` helper for non-transactional operations
- Use `conn.execute()` for transactional operations (when connection provided)

---

## Risk Mitigation

### Before Starting
- [x] Complete analysis of all consumers
- [x] Map all method dependencies
- [x] Document transaction requirements
- [ ] Create git commit with current state

### During Refactoring
- [ ] Test after each phase
- [ ] Verify TypeScript compilation at each step
- [ ] Keep backward compatibility until all consumers updated

### Critical Testing Points
1. Order creation (full workflow)
2. PDF generation
3. Estimate-to-order conversion
4. Task management
5. Folder operations

---

## Progress Tracking

### Phase 1: Create New Repository Files

| Task | Status | Notes |
|------|--------|-------|
| Create `orderPartRepository.ts` | [x] Complete | 283 lines, 13 methods |
| Create `orderFormRepository.ts` | [x] Complete | 270 lines, 10 methods |
| Create `orderConversionRepository.ts` | [x] Complete | 207 lines, 8 methods |
| Refactor `orderRepository.ts` | [x] Complete | 579 lines (with re-exports) |
| TypeScript compilation passes | [x] Complete | No errors |

### Phase 2: Backward Compatibility

| Task | Status | Notes |
|------|--------|-------|
| Add re-exports to orderRepository.ts | [x] Complete | All methods delegated |
| Verify existing imports work | [x] Complete | No consumer changes needed |
| Build succeeds | [x] Complete | 2025-11-21 |

### Phase 3: Update Consumer Imports

| Consumer File | Status | Notes |
|---------------|--------|-------|
| orderService.ts | [x] Complete | Direct imports: orderPartRepository, orderConversionRepository |
| orderController.ts | [x] Complete | Direct imports: orderPartRepository |
| orderConversionService.ts | [x] Complete | Direct imports: orderConversionRepository |
| pdfGenerationService.ts | [x] Complete | Direct imports: orderFormRepository |
| orderFolderService.ts | [x] Complete | Direct imports: orderFormRepository (orderRepository removed) |
| orderImageController.ts | [x] Complete | Direct imports: orderFormRepository |
| orderPreparationController.ts | [x] Complete | Direct imports: orderFormRepository, orderPartRepository (orderRepository removed) |
| orderTaskService.ts | [x] Complete | Direct imports: orderPartRepository (orderRepository removed) |
| orderValidationService.ts | [x] Complete | Direct imports: orderPartRepository (orderRepository removed) |
| orderPartCreationService.ts | [x] Complete | Direct imports: orderPartRepository, orderConversionRepository (orderRepository removed) |
| orderSpecificationStandardizationService.ts | [x] Complete | Direct imports: orderFormRepository (orderRepository removed) |

**Note**: All consumer files updated to use direct imports from new specialized repositories.

---

## Consumer Migration Guide

Detailed instructions for updating each consumer file to use direct imports.

### 1. orderService.ts
**Current**: `import { orderRepository } from '../repositories/orderRepository'`

**Add imports**:
```typescript
import { orderPartRepository } from '../repositories/orderPartRepository';
```

**Method remapping**:
| Current Call | New Call |
|--------------|----------|
| `orderRepository.getOrderParts()` | `orderPartRepository.getOrderParts()` |
| `orderRepository.getOrderTasks()` | `orderPartRepository.getOrderTasks()` |
| `orderRepository.updateTaskCompletion()` | `orderPartRepository.updateTaskCompletion()` |
| `orderRepository.getTasksByRole()` | `orderPartRepository.getTasksByRole()` |
| `orderRepository.updateTaskStarted()` | `orderPartRepository.updateTaskStarted()` |
| `orderRepository.getOrderPointPersons()` | `orderConversionRepository.getOrderPointPersons()` |

**Keep in orderRepository**: `getOrders`, `getOrderById`, `updateOrder`, `deleteOrder`, `updateOrderStatus`, `createStatusHistory`, `getStatusHistory`, `getOrderIdFromOrderNumber`, `getCustomerTaxFromBillingAddress`

---

### 2. orderController.ts
**Current**: `import { orderRepository } from '../repositories/orderRepository'`

**Add imports**:
```typescript
import { orderPartRepository } from '../repositories/orderPartRepository';
```

**Method remapping**:
| Current Call | New Call |
|--------------|----------|
| `orderRepository.getOrderParts()` | `orderPartRepository.getOrderParts()` |
| `orderRepository.getOrderPartById()` | `orderPartRepository.getOrderPartById()` |
| `orderRepository.updateOrderPart()` | `orderPartRepository.updateOrderPart()` |
| `orderRepository.createOrderTask()` | `orderPartRepository.createOrderTask()` |
| `orderRepository.deleteTask()` | `orderPartRepository.deleteTask()` |
| `orderRepository.getAvailableTasks()` | `orderPartRepository.getAvailableTasks()` |

**Keep in orderRepository**: `getOrderIdFromOrderNumber`, `getOrderById`, `getOrderByEstimateId`, `isOrderNameUniqueForCustomer`

---

### 3. orderConversionService.ts
**Current**: `import { orderRepository } from '../repositories/orderRepository'`

**Add imports**:
```typescript
import { orderConversionRepository } from '../repositories/orderConversionRepository';
```

**Method remapping**:
| Current Call | New Call |
|--------------|----------|
| `orderRepository.getEstimateForConversion()` | `orderConversionRepository.getEstimateForConversion()` |
| `orderRepository.updateEstimateStatusAndApproval()` | `orderConversionRepository.updateEstimateStatusAndApproval()` |
| `orderRepository.createOrderPointPerson()` | `orderConversionRepository.createOrderPointPerson()` |

**Keep in orderRepository**: `getOrderByEstimateId`, `getNextOrderNumber`, `createOrder`, `createStatusHistory`

---

### 4. pdfGenerationService.ts
**Current**: `import { orderRepository } from '../../repositories/orderRepository'`

**Change to**:
```typescript
import { orderRepository } from '../../repositories/orderRepository';
import { orderFormRepository } from '../../repositories/orderFormRepository';
```

**Method remapping**:
| Current Call | New Call |
|--------------|----------|
| `orderRepository.getOrderWithCustomerForPDF()` | `orderFormRepository.getOrderWithCustomerForPDF()` |
| `orderRepository.updateOrderFormVersion()` | `orderFormRepository.updateOrderFormVersion()` |
| `orderRepository.upsertOrderFormPaths()` | `orderFormRepository.upsertOrderFormPaths()` |
| `orderRepository.getOrderFormPaths()` | `orderFormRepository.getOrderFormPaths()` |
| `orderRepository.orderFormsExist()` | `orderFormRepository.orderFormsExist()` |

**Keep in orderRepository**: `getTaxRateByName`

---

### 5. orderFolderService.ts
**Current**: `import { orderRepository } from '../repositories/orderRepository'`

**Change to**:
```typescript
import { orderFormRepository } from '../repositories/orderFormRepository';
```

**Method remapping** (all methods move):
| Current Call | New Call |
|--------------|----------|
| `orderRepository.getOrderFolderDetails()` | `orderFormRepository.getOrderFolderDetails()` |
| `orderRepository.checkFolderNameConflict()` | `orderFormRepository.checkFolderNameConflict()` |
| `orderRepository.getOrderFolderLocation()` | `orderFormRepository.getOrderFolderLocation()` |
| `orderRepository.updateFolderTracking()` | `orderFormRepository.updateFolderTracking()` |

**Remove orderRepository import entirely** - no methods used from core

---

### 6. orderImageController.ts
**Current**: `import { orderRepository } from '../repositories/orderRepository'`

**Change to**:
```typescript
import { orderRepository } from '../repositories/orderRepository';
import { orderFormRepository } from '../repositories/orderFormRepository';
```

**Method remapping**:
| Current Call | New Call |
|--------------|----------|
| `orderRepository.getOrderFolderDetails()` | `orderFormRepository.getOrderFolderDetails()` |

**Keep in orderRepository**: `updateJobImage`

---

### 7. orderPreparationController.ts
**Current**: `import { orderRepository } from '../repositories/orderRepository'`

**Change to**:
```typescript
import { orderFormRepository } from '../repositories/orderFormRepository';
import { orderPartRepository } from '../repositories/orderPartRepository';
```

**Method remapping**:
| Current Call | New Call |
|--------------|----------|
| `orderRepository.checkOrderFormStaleness()` | `orderFormRepository.checkOrderFormStaleness()` |
| `orderRepository.checkTaskStaleness()` | `orderPartRepository.checkTaskStaleness()` |

**Remove orderRepository import entirely** - no methods used from core

---

### 8. orderTaskService.ts
**Current**: `import { orderRepository } from '../repositories/orderRepository'`

**Change to**:
```typescript
import { orderPartRepository } from '../repositories/orderPartRepository';
```

**Method remapping**:
| Current Call | New Call |
|--------------|----------|
| `orderRepository.createOrderTask()` | `orderPartRepository.createOrderTask()` |

**Remove orderRepository import entirely** - no methods used from core

---

### 9. orderValidationService.ts
**Current**: `import { orderRepository } from '../repositories/orderRepository'`

**Change to**:
```typescript
import { orderPartRepository } from '../repositories/orderPartRepository';
```

**Method remapping**:
| Current Call | New Call |
|--------------|----------|
| `orderRepository.getOrderParts()` | `orderPartRepository.getOrderParts()` |

**Remove orderRepository import entirely** - no methods used from core

---

### 10. orderPartCreationService.ts
**Current**: `import { orderRepository } from '../repositories/orderRepository'`

**Change to**:
```typescript
import { orderPartRepository } from '../repositories/orderPartRepository';
import { orderConversionRepository } from '../repositories/orderConversionRepository';
```

**Method remapping**:
| Current Call | New Call |
|--------------|----------|
| `orderRepository.getProductTypeInfo()` | `orderConversionRepository.getProductTypeInfo()` |
| `orderRepository.createOrderPart()` | `orderPartRepository.createOrderPart()` |
| `orderRepository.updateOrderPart()` | `orderPartRepository.updateOrderPart()` |

**Remove orderRepository import entirely** - no methods used from core

---

### 11. orderSpecificationStandardizationService.ts
**Current**: `import { orderRepository } from '../repositories/orderRepository'`

**Change to**:
```typescript
import { orderFormRepository } from '../repositories/orderFormRepository';
```

**Method remapping**:
| Current Call | New Call |
|--------------|----------|
| `orderRepository.getOrderWithCustomerForPDF()` | `orderFormRepository.getOrderWithCustomerForPDF()` |

**Remove orderRepository import entirely** - no methods used from core

---

## Post-Migration Cleanup

After all consumers are migrated, remove from `orderRepository.ts`:
1. All `import { ... } from './orderPartRepository'` statements
2. All `import { ... } from './orderFormRepository'` statements
3. All `import { ... } from './orderConversionRepository'` statements
4. All re-export statements (`export { orderPartRepository }`, etc.)
5. All backward compatibility delegation methods (lines ~478-575)

**Expected final orderRepository.ts size**: ~320 lines

---

### Phase 4: Cleanup

| Task | Status | Notes |
|------|--------|-------|
| Remove re-exports | [x] Complete | All re-exports and delegation methods removed |
| Final build verification | [x] Complete | TypeScript build passed |
| Production testing | [ ] Pending | User to verify |

---

## Success Metrics

### Quantitative
- [x] Original file: 1,354 → 456 lines (66% reduction in core file)
- [x] All new files under 500 lines (456, 422, 355, 210)
- [x] Zero TypeScript errors
- [ ] Zero runtime errors (pending production testing)

### Qualitative
- [x] Clear separation of concerns (parts/tasks, forms/folders, conversion)
- [x] Each repository has single responsibility
- [x] Easier to find and modify specific functionality
- [x] Improved maintainability
- [x] No backward compatibility layer needed (direct imports complete)

---

## Time Tracking

| Phase | Estimated | Actual | Status |
|-------|-----------|--------|--------|
| Phase 1: Create files | 60 mins | ~25 mins | Complete |
| Phase 2: Re-exports | 15 mins | ~10 mins | Complete |
| Phase 3: Update consumers | 60 mins | ~15 mins | Complete |
| Phase 4: Cleanup | 15 mins | ~5 mins | Complete |
| Testing & verification | 30 mins | ~5 mins | TypeScript passed |
| **Total** | **180 mins** | **~60 mins** | **Complete** |

---

## Final File Sizes

| File | Lines | Methods | Status |
|------|-------|---------|--------|
| orderRepository.ts (original) | 1,354 | 44 | Before refactoring |
| orderRepository.ts (final) | 456 | 15 | Under 500 limit |
| orderPartRepository.ts | 422 | 13 | Under 500 limit |
| orderFormRepository.ts | 355 | 10 | Under 500 limit |
| orderConversionRepository.ts | 210 | 8 | Under 500 limit |

**Total new architecture**: 1,443 lines across 4 files (vs 1,354 in 1 monolithic file)
**Benefits achieved**:
- Each file is focused and under 500 lines
- Clear separation of concerns (core CRUD, parts/tasks, forms/folders, conversion)
- No more backward compatibility delegations
- Direct imports from specialized repositories

---

*Created: 2025-11-21*
*Phase 3 & 4 Completed: 2025-11-21*
*Author: Claude Code Assistant*
*File Version: 3.0 - Full migration complete (no re-exports)*
