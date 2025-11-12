# 📋 Orders & Estimation Refactoring Tracker

**Goal:** Refactor all files to meet architectural standards:
- Controllers: ≤300 lines
- Services: ≤500 lines
- Repositories: ≤300 lines
- Components: ≤500 lines
- Maintain Route → Controller → Service → Repository pattern

**Progress:** 0 / 24 Complete

---

## 🔴 PHASE 1 - CRITICAL PRIORITY (Frontend Monoliths)

**Target:** Break down massive frontend components that severely impact maintainability

### Frontend Components

- [ ] **1. `DualTableLayout.tsx`** - 1,702 lines → Target: ~300 lines
  - **Current Issues:** 340% over limit, handles all table interactions
  - **Refactor Plan:**
    - [ ] Extract `EditableTextarea` component to `EditableTextarea.tsx`
    - [ ] Extract `EditableDropdown` component to `EditableDropdown.tsx`
    - [ ] Extract `EditableText` component to `EditableText.tsx`
    - [ ] Extract `SpecificationCell` component to `SpecificationCell.tsx`
    - [ ] Create `useTableEditing` custom hook for edit state management
    - [ ] Create `usePartOperations` custom hook for API operations
    - [ ] Create `useQuickBooksSync` custom hook for QB operations
    - [ ] Split into `OrderPartsTable.tsx` and `OrderSpecsTable.tsx`
  - **Estimated Result:** 8 files @ 150-250 lines each

- [ ] **2. `OrderDetailsPage.tsx`** - 1,430 lines → Target: ~300 lines
  - **Current Issues:** 286% over limit, too many responsibilities
  - **Refactor Plan:**
    - [ ] Extract `OrderHeader` component for top section
    - [ ] Extract `OrderEditFields` component for inline editing
    - [ ] Extract `OrderFormsDropdown` component for forms menu
    - [ ] Extract `PrintModal` component to separate file
    - [ ] Create `useOrderData` hook for data fetching
    - [ ] Create `useOrderEditing` hook for edit operations
    - [ ] Create `useOrderForms` hook for PDF generation
    - [ ] Create `useSpecificationData` hook for specs caching
  - **Estimated Result:** 9 files @ 150-200 lines each

- [ ] **3. `ValidationContextBuilder.ts`** - 960 lines → Target: ~400 lines
  - **Current Issues:** 92% over limit, complex validation logic
  - **Refactor Plan:**
    - [ ] Split into `ValidationContextBuilder.ts` (core)
    - [ ] Extract `CustomerPreferencesResolver.ts`
    - [ ] Extract `FieldValidationRules.ts`
    - [ ] Extract `ValidationHelpers.ts`
  - **Estimated Result:** 4 files @ 200-300 lines each

- [ ] **4. `orderProductTemplates.ts`** - 851 lines → Target: ~300 lines
  - **Current Issues:** 70% over limit, all templates in one file
  - **Refactor Plan:**
    - [ ] Split into `templates/channelLetterTemplates.ts`
    - [ ] Split into `templates/substrateTemplates.ts`
    - [ ] Split into `templates/backerTemplates.ts`
    - [ ] Split into `templates/ledTemplates.ts`
    - [ ] Split into `templates/miscTemplates.ts`
    - [ ] Keep core exports in `orderProductTemplates.ts` (index)
  - **Estimated Result:** 6 files @ 150-200 lines each

---

## 🟠 PHASE 2 - HIGH PRIORITY (Backend Controllers)

**Target:** Split oversized controllers while maintaining proper layering

### Backend Controllers

- [ ] **5. `orderController.ts`** - 1,207 lines → Target: ≤300 lines each
  - **Current Issues:** 27 exported functions, 240% over limit
  - **Refactor Plan:**
    - [ ] Create `orderCrudController.ts` - CRUD operations (getAllOrders, getOrderById, updateOrder, deleteOrder)
    - [ ] Create `orderStatusController.ts` - Status management (updateOrderStatus, getStatusHistory)
    - [ ] Create `orderTaskController.ts` - Task operations (createTask, updateTask, deleteTask, getTaskTemplates)
    - [ ] Create `orderCalculationController.ts` - Date calculations (calculateDueDate, calculateBusinessDays, calculateTurnaroundDays)
    - [ ] Create `orderPartsController.ts` - Parts operations (createPart, updatePart, deletePart, updatePartOrder)
    - [ ] Create `orderValidationController.ts` - Validation endpoints (validateOrderName, getOrderByEstimate)
    - [ ] Update `routes/orders.ts` to use new controllers
  - **Estimated Result:** 6 files @ 150-250 lines each

- [ ] **6. `estimateController.ts`** - 524 lines → Target: ≤300 lines each
  - **Current Issues:** 75% over controller limit
  - **Refactor Plan:**
    - [ ] Create `estimateVersionController.ts` - Version management
    - [ ] Create `estimateCrudController.ts` - Basic CRUD
    - [ ] Keep core functionality in `estimateController.ts`
  - **Estimated Result:** 3 files @ 150-200 lines each

---

## 🟡 PHASE 3 - MEDIUM PRIORITY (Backend Repositories & Services)

**Target:** Split oversized data access and business logic layers

### Backend Repositories

- [ ] **7. `orderRepository.ts`** - 833 lines → Target: ≤300 lines each
  - **Current Issues:** 67% over limit, handles multiple entities
  - **Refactor Plan:**
    - [ ] Create `repositories/order/orderCrudRepository.ts` - Order CRUD operations
    - [ ] Create `repositories/order/orderPartsRepository.ts` - Parts operations
    - [ ] Create `repositories/order/orderTasksRepository.ts` - Tasks operations
    - [ ] Create `repositories/order/orderStatusRepository.ts` - Status history
    - [ ] Create `repositories/order/orderHelperRepository.ts` - Helper methods
    - [ ] Create `repositories/order/index.ts` - Export aggregator
  - **Estimated Result:** 6 files @ 150-200 lines each

### Backend Services

- [ ] **8. `orderService.ts`** - 592 lines → Target: ≤500 lines
  - **Current Issues:** 18% over service limit
  - **Refactor Plan:**
    - [ ] Split into `orderCrudService.ts` - Core CRUD
    - [ ] Split into `orderProgressService.ts` - Progress calculations
    - [ ] Keep as coordinating service if under 500 lines
  - **Estimated Result:** 2-3 files @ 250-350 lines each

- [ ] **9. `estimateTemplateService.ts`** - 531 lines → Target: ≤500 lines
  - **Current Issues:** 6% over service limit
  - **Refactor Plan:**
    - [ ] Extract template creation logic to `templateCreationService.ts`
    - [ ] Keep item management in `estimateTemplateService.ts`
  - **Estimated Result:** 2 files @ 250-300 lines each

---

## 🟢 PHASE 4 - MEDIUM PRIORITY (PDF Generation)

**Target:** Modularize monolithic PDF generator

### Backend PDF Generation

- [ ] **10. `orderFormGenerator.ts`** - 1,161 lines → Target: ~300 lines
  - **Current Issues:** 232% over limit, everything in one file
  - **Refactor Plan:**
    - [ ] Extract `pdf/constants/orderFormConstants.ts` - All constants
    - [ ] Extract `pdf/utils/orderFormLayout.ts` - Layout calculations
    - [ ] Extract `pdf/utils/orderFormHelpers.ts` - Helper functions
    - [ ] Extract `pdf/renderers/orderHeaderRenderer.ts` - Header rendering
    - [ ] Extract `pdf/renderers/orderPartsRenderer.ts` - Parts table rendering
    - [ ] Extract `pdf/renderers/orderImageRenderer.ts` - Image processing
    - [ ] Extract `pdf/renderers/orderNotesRenderer.ts` - Notes rendering
    - [ ] Keep `orderFormGenerator.ts` as orchestrator
  - **Estimated Result:** 8 files @ 150-200 lines each

---

## 🔵 PHASE 5 - LOWER PRIORITY (Pricing & Calculation Modules)

**Target:** Refactor frontend pricing calculations

### Frontend Pricing Modules

- [ ] **11. `channelLettersPricing.ts`** - 648 lines → Target: ~400 lines
  - **Refactor Plan:**
    - [ ] Split calculation logic into smaller focused functions
    - [ ] Extract constants to separate file

- [ ] **12. `pushThruPricing.ts`** - 618 lines → Target: ~400 lines
  - **Refactor Plan:**
    - [ ] Split calculation logic into smaller focused functions
    - [ ] Extract constants to separate file

- [ ] **13. `GridEngine.ts`** - 634 lines → Target: ~400 lines
  - **Refactor Plan:**
    - [ ] Extract grid operations to separate modules
    - [ ] Split into smaller focused engines

- [ ] **14. `pricingDataResource.ts`** - 590 lines → Target: ~400 lines
  - **Refactor Plan:**
    - [ ] Split data fetching from caching logic
    - [ ] Create separate resource managers

---

## 🟣 PHASE 6 - LOWER PRIORITY (UI Components)

**Target:** Break down medium-sized components

### Frontend Components

- [ ] **15. `ApproveEstimateModal.tsx`** - 629 lines → Target: ~400 lines
  - **Refactor Plan:**
    - [ ] Extract form sections to separate components
    - [ ] Create custom hook for approval logic

- [ ] **16. `ImagePickerModal.tsx`** - 388 lines → Target: ~300 lines
  - **Refactor Plan:**
    - [ ] Extract image grid to separate component
    - [ ] Extract crop functionality to separate component

---

## 🟤 PHASE 7 - ARCHITECTURAL IMPROVEMENTS (Routes)

**Target:** Split large route files into feature-based sub-routers

### Backend Routes

- [ ] **17. `routes/orders.ts`** - 443 lines → Target: ~100 lines
  - **Current Issues:** 30+ route definitions
  - **Refactor Plan:**
    - [ ] Create `routes/orders/conversion.ts` - Estimate conversion routes
    - [ ] Create `routes/orders/crud.ts` - Basic CRUD routes
    - [ ] Create `routes/orders/tasks.ts` - Task management routes
    - [ ] Create `routes/orders/parts.ts` - Parts management routes
    - [ ] Create `routes/orders/status.ts` - Status management routes
    - [ ] Create `routes/orders/calculations.ts` - Date calculation routes
    - [ ] Create `routes/orders/images.ts` - Image management routes
    - [ ] Keep `routes/orders.ts` as main router aggregator
  - **Estimated Result:** 8 files @ 50-80 lines each

---

## 🎯 QUICK WINS (Optional - Low Impact)

**Files close to limits that could use minor cleanup**

- [ ] **18. `orderConversionService.ts`** - 469 lines (✅ Under 500)
- [ ] **19. `ValidationEngine.ts`** - 477 lines (✅ Under 500)
- [ ] **20. `bladeSignPricing.ts`** - 450 lines (✅ Under 500)
- [ ] **21. `ledNeonPricing.ts`** - 431 lines (✅ Under 500)
- [ ] **22. `backerPricing.ts`** - 421 lines (✅ Under 500)
- [ ] **23. `useSimpleGridState.ts`** - 387 lines (✅ Under 500)
- [ ] **24. `useGridActions.ts`** - 378 lines (✅ Under 500)

---

## 📊 Progress Summary

### By Phase
- **Phase 1 (Critical):** 0 / 4 complete (Frontend Monoliths)
- **Phase 2 (High):** 0 / 2 complete (Backend Controllers)
- **Phase 3 (Medium):** 0 / 3 complete (Repositories & Services)
- **Phase 4 (Medium):** 0 / 1 complete (PDF Generation)
- **Phase 5 (Lower):** 0 / 4 complete (Pricing Modules)
- **Phase 6 (Lower):** 0 / 2 complete (UI Components)
- **Phase 7 (Architectural):** 0 / 1 complete (Routes)
- **Quick Wins:** 0 / 7 complete

### By File Type
- **Frontend Components:** 0 / 6 complete
- **Backend Controllers:** 0 / 2 complete
- **Backend Services:** 0 / 3 complete
- **Backend Repositories:** 0 / 1 complete
- **PDF Generation:** 0 / 1 complete
- **Pricing Logic:** 0 / 4 complete
- **Routes:** 0 / 1 complete
- **Hooks & Utils:** 0 / 6 complete

### Total Lines to Refactor
- **Current Total:** ~17,000+ lines across 24+ files
- **Target Total:** ~10,000 lines across 80+ focused files
- **Reduction:** ~40% code organization improvement

---

## 🎓 Refactoring Guidelines

### For Each File:
1. ✅ Create backup before starting
2. ✅ Verify all tests pass before refactoring
3. ✅ Follow existing patterns in codebase
4. ✅ Maintain TypeScript type safety
5. ✅ Keep Route → Controller → Service → Repository pattern
6. ✅ Add proper error handling
7. ✅ Update imports in dependent files
8. ✅ Test thoroughly after refactoring
9. ✅ Update this checklist when complete

### Success Criteria:
- ✅ No breaking changes to existing functionality
- ✅ All files under size limits
- ✅ Improved code maintainability
- ✅ Clear separation of concerns
- ✅ Comprehensive error handling
- ✅ All tests passing

---

## 📝 Notes

- **Started:** [Date to be filled]
- **Estimated Completion:** TBD
- **Blocked Items:** None currently

### Lessons Learned:
- [Add lessons learned as you go]

### Breaking Changes:
- [Document any breaking changes]

### Migration Notes:
- [Document any migration steps needed]
