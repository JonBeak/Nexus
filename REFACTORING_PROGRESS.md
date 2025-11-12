# OrderDetailsPage.tsx Refactoring Progress

## Overview
**File**: `/frontend/web/src/components/orders/details/OrderDetailsPage.tsx`
**Current Size**: 1398 lines
**Target Size**: ~300 lines
**Status**: Phase 3 Ready to Start
**Start Date**: November 12, 2024

## Completed Phases

### ✅ Phase 1: Initial Cleanup (COMPLETED)
- Removed unused imports and variables
- Consolidated duplicate code patterns
- Fixed TypeScript type issues
- **Result**: 1431 → 1398 lines

### ✅ Phase 2: Component Extraction (COMPLETED)
- Created reusable `EditableField` component (lines 29-147)
- Replaced 9 inline editing patterns with EditableField
- Standardized field editing behavior
- **Result**: Improved code reusability, but 8+ patterns remain unconverted

## Current Analysis

### File Structure Issues
- **20+ individual useState hooks** scattered throughout component
- **8+ remaining inline editing patterns** not using EditableField
- **3 textarea fields** (Special Instructions, Internal Notes, Invoice Notes) using inline patterns
- **Business logic mixed with UI** throughout the component
- **Print modal embedded** at bottom of file (lines 1283-1393)
- **Heavy JSX nesting** with inline conditionals

### Data Dependencies
```
OrderDetailsPage
├── API Services
│   ├── ordersApi (getOrderWithParts, updateOrder, generateOrderForms, calculateBusinessDays)
│   ├── provincesApi (getTaxRules)
│   ├── customerApi (getCustomer for discount)
│   ├── ledsApi (getActiveLEDs)
│   ├── powerSuppliesApi (getActivePowerSupplies)
│   ├── materialsApi (getActiveSubstrates)
│   └── printApi (printOrderFormsBatch, printOrderForm)
├── Child Components
│   ├── OrderImage
│   ├── StatusBadge
│   ├── DualTableLayout
│   └── ProgressView
└── External Dependencies
    ├── orderProductTemplates (caching functions)
    └── specificationConstants (type definitions)
```

## Phase 3: Internal Refactoring (Within File)

### 3.1 Group Related State ⬜ (20 mins)

#### Current State (20+ useState calls):
```typescript
const [order, setOrder] = useState<Order | null>(null);
const [parts, setParts] = useState<OrderPart[]>([]);
const [loading, setLoading] = useState(true);
const [initialLoad, setInitialLoad] = useState(true);
const [error, setError] = useState<string | null>(null);
const [taxRules, setTaxRules] = useState<TaxRule[]>([]);
const [customerDiscount, setCustomerDiscount] = useState<number>(0);
// ... 14+ more individual states
```

#### Target State (5 grouped objects):
- ⬜ **orderData**: order, parts, taxRules, customerDiscount
- ⬜ **uiState**: loading, initialLoad, error, activeTab, saving, generatingForms, printingForm, showFormsDropdown, showPrintModal
- ⬜ **editState**: editingField, editValue
- ⬜ **calculatedValues**: turnaroundDays, daysUntilDue, specsDataLoaded
- ⬜ **printConfig**: master, estimate, shop, packing

### 3.2 Extract Field Configurations ⬜ (15 mins)

Create `FIELD_CONFIGS` object with:
- ⬜ All 15+ field definitions
- ⬜ Type specifications (text, date, time, email, select, checkbox, textarea)
- ⬜ Formatters and transformers
- ⬜ Options for select fields
- ⬜ Section grouping (order vs invoice)

### 3.3 Convert Remaining Fields ⬜ (15 mins)

- ⬜ Create `EditableTextarea` component variant
- ⬜ Convert Special Instructions (manufacturing_note)
- ⬜ Convert Internal Notes (internal_note)
- ⬜ Convert Invoice Notes (invoice_notes)
- ⬜ Ensure consistent save/cancel behavior

## Phase 4: External Refactoring (Extract to Files)

### 4.1 Directory Structure ⬜ (10 mins)

```
frontend/web/src/components/orders/details/
├── OrderDetailsPage.tsx (main, ~300 lines) ⬜
├── components/
│   ├── EditableField.tsx ⬜
│   ├── EditableTextarea.tsx ⬜
│   ├── OrderHeader.tsx ⬜
│   ├── OrderInfoPanel.tsx ⬜
│   ├── InvoiceDetailsPanel.tsx ⬜
│   ├── PrintFormsModal.tsx ⬜
│   └── FormsDropdown.tsx ⬜
├── hooks/
│   ├── useOrderDetails.ts ⬜
│   ├── useEditableFields.ts ⬜
│   ├── useOrderPrinting.ts ⬜
│   └── useOrderCalculations.ts ⬜
├── services/
│   ├── orderCalculations.ts ⬜
│   └── orderFormatters.ts ⬜
└── constants/
    └── orderFieldConfigs.ts ⬜
```

### 4.2 Extract Custom Hooks ⬜ (45 mins)

#### useOrderDetails.ts ⬜ (15 mins)
- ⬜ Order fetching logic
- ⬜ Tax rules fetching
- ⬜ Customer discount fetching
- ⬜ Specification data fetching
- ⬜ Error handling
- ⬜ Loading states

#### useEditableFields.ts ⬜ (10 mins)
- ⬜ Editing state management
- ⬜ Start/cancel/save functions
- ⬜ Field value transformation
- ⬜ Scroll position preservation

#### useOrderPrinting.ts ⬜ (10 mins)
- ⬜ Print modal state
- ⬜ Print quantities calculation
- ⬜ Shop count calculation
- ⬜ Form URL building
- ⬜ Print handlers

#### useOrderCalculations.ts ⬜ (10 mins)
- ⬜ Turnaround days calculation
- ⬜ Days until due calculation
- ⬜ Business days API calls
- ⬜ Auto-recalculation on changes

### 4.3 Extract Components ⬜ (45 mins)

#### OrderHeader.tsx ⬜ (10 mins)
- ⬜ Back navigation button
- ⬜ Order title and customer name
- ⬜ Status badge
- ⬜ Tab navigation (Specs & Invoice / Job Progress)
- ⬜ Action buttons (Generate, Print, View Forms)
- ⬜ Forms dropdown integration

#### OrderInfoPanel.tsx ⬜ (15 mins)
- ⬜ OrderImage component integration
- ⬜ Order Date display
- ⬜ Customer PO (editable)
- ⬜ Customer Job # (editable)
- ⬜ Shipping Method (editable dropdown)
- ⬜ Due Date (editable)
- ⬜ Hard Due Time (editable)
- ⬜ Turnaround Time display
- ⬜ Due In display
- ⬜ Special Instructions (editable textarea)
- ⬜ Internal Notes (editable textarea)

#### InvoiceDetailsPanel.tsx ⬜ (10 mins)
- ⬜ Point Persons display
- ⬜ Accounting Email (editable)
- ⬜ Terms (editable)
- ⬜ Deposit Required (checkbox)
- ⬜ Cash Customer (checkbox)
- ⬜ Discount display
- ⬜ Tax (editable dropdown)
- ⬜ Invoice Notes (editable textarea)

#### PrintFormsModal.tsx ⬜ (5 mins)
- ⬜ Modal wrapper and styling
- ⬜ Quantity selectors (Master, Estimate, Shop, Packing)
- ⬜ Plus/minus buttons for each form type
- ⬜ Auto-calculation note for Shop forms
- ⬜ Print and Cancel buttons

#### FormsDropdown.tsx ⬜ (5 mins)
- ⬜ Dropdown menu component
- ⬜ Individual form links (Master, Shop, Specs, Packing)
- ⬜ Click outside handler
- ⬜ Icon integration

### 4.4 Extract Services ⬜ (20 mins)

#### orderCalculations.ts ⬜ (15 mins)
- ⬜ calculateShopCount function
- ⬜ calculateTurnaroundDays async function
- ⬜ calculateDaysUntilDue async function
- ⬜ buildFormUrls function
- ⬜ Specification check helpers

#### orderFormatters.ts ⬜ (5 mins)
- ⬜ formatDateString function
- ⬜ formatTimeTo12Hour function
- ⬜ transformFieldValue function
- ⬜ Field value type conversions

### 4.5 Refactor Main Component ⬜ (20 mins)
- ⬜ Import all extracted components and hooks
- ⬜ Replace state with custom hooks
- ⬜ Replace inline JSX with components
- ⬜ Remove extracted logic
- ⬜ Simplify component structure
- ⬜ Verify all props are passed correctly

## Testing Checklist ⬜

### Functionality Tests
- ⬜ All editable fields save correctly
- ⬜ Scroll position preserved during saves
- ⬜ Tab navigation works (Specs ↔ Progress)
- ⬜ Print modal opens with correct quantities
- ⬜ Print functionality executes successfully
- ⬜ Form generation works
- ⬜ View Forms dropdown functions
- ⬜ Individual form viewing works
- ⬜ Tax dropdown updates correctly
- ⬜ Turnaround days calculate on due date change
- ⬜ Days until due updates correctly
- ⬜ Image picker modal works
- ⬜ Point persons display correctly
- ⬜ Customer discount loads
- ⬜ Specification data caches properly

### Technical Tests
- ⬜ TypeScript compilation succeeds
- ⬜ No console errors or warnings
- ⬜ All imports resolve correctly
- ⬜ Hot module reload works
- ⬜ Build completes successfully
- ⬜ No memory leaks (blob URLs cleaned)
- ⬜ API error handling works
- ⬜ Loading states display correctly
- ⬜ Error states display correctly

## Risk Mitigation

### Before Starting
- ⬜ Create full backup of OrderDetailsPage.tsx
- ⬜ Commit current working state to git
- ⬜ Document any custom business logic found

### During Refactoring
- ⬜ Test after each phase completion
- ⬜ Keep original file as reference
- ⬜ Maintain all TypeScript types
- ⬜ Preserve all existing functionality
- ⬜ Document any deviations from plan

### Critical Areas to Preserve
1. **Scroll Position Logic** (lines 199-200, 263-276, 543-544, 603-610)
2. **Field Transformations** (lines 554-567)
3. **Shop Count Calculation** (lines 354-398)
4. **Form URL Building** (lines 464-483)
5. **Business Days Calculations** (lines 308-337)

## Success Metrics

### Quantitative
- ✅ Main component: 1398 → ~300 lines (78% reduction)
- ⬜ Number of new files: 15
- ⬜ Largest new file: <200 lines
- ⬜ Test coverage: 100% functionality preserved

### Qualitative
- ⬜ Code is more maintainable
- ⬜ Components are reusable
- ⬜ Business logic is separated from UI
- ⬜ File organization is logical
- ⬜ Testing is easier

## Time Tracking

| Phase | Estimated | Actual | Status |
|-------|-----------|--------|--------|
| Phase 3.1: Group State | 20 mins | - | ⬜ Not Started |
| Phase 3.2: Field Configs | 15 mins | - | ⬜ Not Started |
| Phase 3.3: Textarea Component | 15 mins | - | ⬜ Not Started |
| Phase 4.1: Directory Structure | 10 mins | - | ⬜ Not Started |
| Phase 4.2: Extract Hooks | 45 mins | - | ⬜ Not Started |
| Phase 4.3: Extract Components | 45 mins | - | ⬜ Not Started |
| Phase 4.4: Extract Services | 20 mins | - | ⬜ Not Started |
| Phase 4.5: Main Component | 20 mins | - | ⬜ Not Started |
| Testing & Validation | 20 mins | - | ⬜ Not Started |
| **Total** | **210 mins** | **-** | **0% Complete** |

## Notes & Observations

### Key Findings
- EditableField component already exists but is underutilized
- Significant state management complexity that needs grouping
- Business logic heavily intertwined with UI rendering
- Print functionality could be completely isolated
- Form URL building logic is a good candidate for extraction

### Potential Challenges
- Scroll preservation logic is complex and must be carefully maintained
- Field transformations have special cases that need preservation
- Tax rules dropdown has custom rendering logic
- Print quantities auto-calculation based on specifications

### Improvement Opportunities
- Consider using React Context for order data to avoid prop drilling
- Could implement optimistic updates for better UX
- Field configurations could be extended for validation rules
- Print functionality could be made more generic for reuse

## Next Steps

1. **Immediate**: Start with Phase 3.1 - Group related state
2. **Then**: Continue through Phase 3 sequentially
3. **Finally**: Execute Phase 4 in the prescribed order
4. **Validate**: Run through complete testing checklist

---

*Last Updated: November 12, 2024*
*Author: Claude Code Assistant*
*File Version: 1.0*