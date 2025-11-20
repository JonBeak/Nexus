# DualTableLayout.tsx Refactoring Plan

## Overview
**File**: `/frontend/web/src/components/orders/details/DualTableLayout.tsx`
**Current Size**: 1703 lines
**Target Size**: ~300 lines (main component) + sub-components (~200-300 each)
**Status**: Analysis Complete - Ready for Planning Review
**Analysis Date**: November 12, 2024

## Executive Summary

The DualTableLayout component is a massive 1703-line file that handles the entire order parts table, including specifications editing, invoice details, and pricing calculations. It contains 6 memoized sub-components inline and complex state management for editing multiple part fields with real-time API updates.

**Complexity Score**: 9/10
- 20+ API integration points
- Complex nested data structures (multi-row specifications per part)
- Real-time field editing with optimistic updates
- Memoized performance optimization requirements
- Dynamic row management (add/remove specification rows)

---

## Current File Analysis

### File Structure Breakdown

```
DualTableLayout.tsx (1703 lines)
├── Imports & Constants (1-71)
│   ├── React hooks (1)
│   ├── API services: ordersApi, quickbooksApi, provincesApi (2)
│   ├── Types: OrderPart (3)
│   ├── Templates: getSpecificationTemplate, getAllTemplateNames (4)
│   ├── Icons: Pencil, Check, X, RefreshCw (5)
│   ├── Utilities: highlight style helpers (6)
│   ├── SPECS_DISPLAY_NAMES constant (9-50)
│   └── Interfaces: QBItem, TaxRule, Props (52-71)
│
├── Memoized Editable Components (73-590)
│   ├── EditableTextarea (86-160) - Multi-line text editing
│   ├── EditableInput (172-223) - Single-line text/number editing
│   ├── SpecTemplateDropdown (238-287) - Template selection
│   ├── SpecFieldInput (299-409) - Individual spec field editing
│   ├── ItemNameDropdown (423-489) - Item display name selection
│   └── EditableSpecsQty (503-590) - Manufacturing quantity editing
│
└── Main Component: DualTableLayout (596-1701)
    ├── State Management (601-609)
    ├── Data Fetching Effects (611-655)
    ├── Save Handlers (661-818)
    ├── Row Manipulation (820-934)
    ├── Toggle Parent/Sub (936-964)
    ├── Cell Editing Handlers (966-1070)
    ├── Helper Functions (1072-1084)
    ├── Rendering Functions (1086-1577)
    └── Main Render JSX (1611-1701)
```

### Dependencies Map

```
External Dependencies
├── React
│   ├── useState - Local state management (8 state variables)
│   ├── useEffect - API data fetching, synchronization
│   ├── useCallback - Memoized save handlers
│   ├── useMemo - Template names, invoice calculations
│   └── useRef - Parts reference for concurrent updates
│
├── API Services (@/services/api)
│   ├── ordersApi
│   │   ├── updateOrderParts() - Bulk part updates
│   │   ├── updateSpecsDisplayName() - Item name changes
│   │   ├── updatePartSpecsQty() - Manufacturing quantity
│   │   ├── toggleIsParent() - Base/Sub item toggle
│   │   └── getOrderWithParts() - Refresh parts data
│   │
│   ├── quickbooksApi
│   │   └── getItems() - QB item list for dropdown
│   │
│   └── provincesApi
│       └── getTaxRules() - Tax calculation rules
│
├── Configuration (@/config/orderProductTemplates)
│   ├── getSpecificationTemplate() - Get template by name
│   ├── getAllTemplateNames() - Available templates list
│   └── SpecificationField type - Field definitions
│
├── Types (@/types/orders)
│   └── OrderPart interface - Part data structure
│
├── Utilities (@/utils/highlightStyles)
│   ├── getValidInputClass() - Invoice field highlighting
│   ├── getValidSpecTemplateClass() - Template highlighting
│   └── getValidSpecFieldClass() - Spec field highlighting
│
└── Icons (lucide-react)
    ├── Pencil - Edit indicator
    ├── Check - Save confirmation (unused in current code)
    ├── X - Cancel editing (unused in current code)
    └── RefreshCw - Toggle parent/sub icon
```

### Data Flow Analysis

#### Props → State → API → Database

```
1. INITIALIZATION FLOW
   Props: { orderNumber, initialParts, taxName }
     ↓
   State: parts, partsRef, editingCell, editValue, saving, qbItems, taxRules, specRowCounts
     ↓
   useEffect: Fetch QB items & tax rules on mount
     ↓
   Backend API: GET /quickbooks/items, GET /customers/tax-rules
     ↓
   Database: qb_items table, tax_rules table
     ↓
   State Update: setQbItems(), setTaxRules()

2. PART DATA SYNCHRONIZATION
   initialParts prop changes (from parent OrderDetailsPage)
     ↓
   useEffect dependency trigger
     ↓
   State: setParts(initialParts), partsRef.current = initialParts
     ↓
   Row count calculation from specifications._row_count
     ↓
   State: setSpecRowCounts()

3. FIELD EDITING FLOW
   User Input (EditableTextarea/EditableInput/SpecFieldInput)
     ↓
   Local state in memoized component
     ↓
   onBlur → onSave callback
     ↓
   handleFieldSave / handleSpecFieldSave
     ↓
   partsRef.current (read fresh data to avoid stale closure)
     ↓
   Build updated part object
     ↓
   API: PUT /orders/{orderNumber}/parts (updateOrderParts)
     ↓
   Backend Controller: updateOrderParts
     ↓
   Database: UPDATE order_parts SET specifications = ?, invoice_description = ?, ...
     ↓
   Local state optimistic update: setParts()

4. TEMPLATE SELECTION FLOW
   User selects template in SpecTemplateDropdown
     ↓
   handleChange → onSave callback
     ↓
   handleTemplateSave(partId, rowNum, templateName)
     ↓
   Clear all rowN_* fields for that row
     ↓
   Set _template_{rowNum} = templateName
     ↓
   API: PUT /orders/{orderNumber}/parts
     ↓
   Database: UPDATE order_parts.specifications
     ↓
   State: setParts() (optimistic update)

5. SPECS DISPLAY NAME FLOW
   User selects name in ItemNameDropdown
     ↓
   handleChange
     ↓
   API: PUT /orders/{orderNumber}/parts/{partId}/specs-display-name
     ↓
   Backend: updateSpecsDisplayName
     ↓
   Database: UPDATE order_parts SET specs_display_name = ?
     ↓
   onUpdate callback → handleRefreshParts
     ↓
   API: GET /orders/{orderNumber} (getOrderWithParts)
     ↓
   State: setParts() (fresh data from server)

6. ROW MANAGEMENT FLOW
   User clicks +/- buttons
     ↓
   addSpecRow / removeSpecRow
     ↓
   Calculate new row count (1-20 range)
     ↓
   Update specifications._row_count
     ↓
   For removeSpecRow: Clear data from deleted rows
     ↓
   API: PUT /orders/{orderNumber}/parts
     ↓
   Database: UPDATE order_parts.specifications
     ↓
   State: setSpecRowCounts(), setParts()

7. QB ITEM SELECTION FLOW
   User selects QB item in dropdown
     ↓
   handleChange in renderQBItemDropdown
     ↓
   Find QB item to get description
     ↓
   Update both qb_item_name AND specifications._qb_description
     ↓
   API: PUT /orders/{orderNumber}/parts
     ↓
   Database: UPDATE order_parts
     ↓
   State: setParts()

8. INVOICE CALCULATION FLOW
   parts or taxName or taxRules change
     ↓
   useMemo dependency trigger
     ↓
   Calculate subtotal from all part.extended_price
     ↓
   Find tax rule by taxName
     ↓
   Calculate tax amount = subtotal × taxDecimal
     ↓
   Calculate total = subtotal + taxAmount
     ↓
   Return { subtotal, taxPercent, taxAmount, total }
     ↓
   Render in invoice summary footer
```

### State Management Breakdown

```typescript
// 8 State Variables + 1 Ref
const [parts, setParts] = useState<OrderPart[]>(initialParts);
const partsRef = React.useRef<OrderPart[]>(initialParts);  // Prevents stale closures
const [editingCell, setEditingCell] = useState<string | null>(null);
const [editValue, setEditValue] = useState<any>('');
const [saving, setSaving] = useState(false);
const [qbItems, setQbItems] = useState<QBItem[]>([]);
const [taxRules, setTaxRules] = useState<TaxRule[]>([]);
const [specRowCounts, setSpecRowCounts] = useState<Record<number, number>>({});
```

**State Grouping Opportunities**:
- **partsData**: parts, partsRef, specRowCounts
- **editingState**: editingCell, editValue, saving
- **referenceData**: qbItems, taxRules

### Critical Business Logic

#### 1. Specification Row Management (lines 820-934)
- Dynamic row count (1-20 rows per part)
- Row count sources (priority order):
  1. `specRowCounts[partId]` (user-controlled)
  2. Template count (number of `_template_*` keys)
  3. Default: 1
- Row addition: Increment count, save `_row_count` to specifications
- Row removal: Decrement count, clear all `rowN_*` and `_template_N` fields

#### 2. Field Save Handler (lines 661-714)
- Uses `partsRef.current` to avoid stale closure issues
- Auto-calculates `extended_price = quantity × unit_price`
- Nullifies pricing if either quantity or unit_price becomes empty/0
- Optimistic updates after successful API call

#### 3. Template Save Handler (lines 717-779)
- **Critical**: Clears ALL spec data for the row when template changes
- Pattern: Delete all `rowN_*` keys, then set `_template_N`
- Prevents orphaned spec data from previous template

#### 4. QB Item Auto-Fill (lines 1188-1259)
- Selecting QB item auto-fills `_qb_description` from QB item's description
- Single save updates both `qb_item_name` and `specifications._qb_description`

#### 5. Invoice Summary Calculation (lines 1580-1609)
- Memoized for performance
- Tax percent stored as decimal (0.13) in DB
- Converted to percentage (13%) for display
- Calculation: `taxAmount = subtotal × taxDecimal`

#### 6. Parent/Sub Toggle (lines 936-964)
- Validation: Cannot promote to Base Item without `specs_display_name`
- API endpoint: PATCH `/orders/{orderNumber}/parts/{partId}/toggle-parent`
- Affects styling (blue border for Base Items)

#### 7. Specs QTY vs Invoice Quantity (lines 503-590)
- `specs_qty`: Manufacturing quantity (can differ from invoice)
- `quantity`: Invoice quantity (billing amount)
- Visual indicator: Red bold text when different

---

## Refactoring Strategy

### Phase 1: Extract Memoized Components to Separate Files (30 mins)

**Goal**: Move all inline memoized components to dedicated files

#### 1.1 Create Components Directory (5 mins)
```
frontend/web/src/components/orders/details/
└── dualtable/
    ├── components/
    │   ├── EditableTextarea.tsx         ✅ Already extracted (86-160)
    │   ├── EditableInput.tsx            ✅ Already extracted (172-223)
    │   ├── SpecTemplateDropdown.tsx     ✅ Already extracted (238-287)
    │   ├── SpecFieldInput.tsx           ✅ Already extracted (299-409)
    │   ├── ItemNameDropdown.tsx         ✅ Already extracted (423-489)
    │   └── EditableSpecsQty.tsx         ✅ Already extracted (503-590)
    └── DualTableLayout.tsx
```

**Tasks**:
- ⬜ Create `/dualtable/components/` directory
- ⬜ Move EditableTextarea (86-160) → EditableTextarea.tsx
- ⬜ Move EditableInput (172-223) → EditableInput.tsx
- ⬜ Move SpecTemplateDropdown (238-287) → SpecTemplateDropdown.tsx
- ⬜ Move SpecFieldInput (299-409) → SpecFieldInput.tsx
- ⬜ Move ItemNameDropdown (423-489) → ItemNameDropdown.tsx
- ⬜ Move EditableSpecsQty (503-590) → EditableSpecsQty.tsx
- ⬜ Update imports in DualTableLayout.tsx
- ⬜ Test: All inline editing still works

**File Size Impact**: Main component 1703 → ~1200 lines (~500 lines extracted)

---

### Phase 2: Extract Constants and Types (10 mins)

**Goal**: Centralize constants and type definitions

#### 2.1 Create Constants File
```
dualtable/
└── constants/
    └── tableConstants.ts
```

**Content**:
```typescript
// SPECS_DISPLAY_NAMES (lines 9-50)
export const SPECS_DISPLAY_NAMES = [...];

// Interface exports
export interface QBItem {
  id: number;
  name: string;
  description: string | null;
  qbItemId: string;
  qbItemType: string | null;
}

export interface TaxRule {
  tax_rule_id: number;
  tax_name: string;
  tax_percent: number;
  is_active: number;
}

export interface DualTableLayoutProps {
  orderNumber: number;
  initialParts: OrderPart[];
  taxName?: string;
}
```

**Tasks**:
- ⬜ Create `constants/tableConstants.ts`
- ⬜ Move SPECS_DISPLAY_NAMES array
- ⬜ Move QBItem, TaxRule interfaces
- ⬜ Rename Props → DualTableLayoutProps (export)
- ⬜ Update imports in main component and sub-components
- ⬜ Test: TypeScript compilation succeeds

**File Size Impact**: Main component 1200 → ~1150 lines (~50 lines extracted)

---

### Phase 3: Extract Custom Hooks (60 mins)

**Goal**: Separate data fetching and state management logic

#### 3.1 useTableData Hook (20 mins)
```
dualtable/
└── hooks/
    └── useTableData.ts
```

**Responsibilities**:
- Fetch QB items on mount
- Fetch tax rules on mount
- Synchronize parts when initialParts changes
- Manage specRowCounts state
- Return: `{ qbItems, taxRules, parts, setParts, partsRef, specRowCounts, setSpecRowCounts }`

**Extracted Code**:
- Lines 601-609: State declarations
- Lines 611-655: useEffect for fetching and syncing

**Tasks**:
- ⬜ Create `useTableData.ts` hook
- ⬜ Move QB items fetching logic
- ⬜ Move tax rules fetching logic
- ⬜ Move parts synchronization logic
- ⬜ Move specRowCounts initialization
- ⬜ Return all necessary state and setters
- ⬜ Update DualTableLayout to use hook
- ⬜ Test: Parts load correctly, QB items populate, tax rules fetch

#### 3.2 useFieldEditing Hook (15 mins)
```
dualtable/
└── hooks/
    └── useFieldEditing.ts
```

**Responsibilities**:
- Manage inline editing state (editingCell, editValue, saving)
- Provide start/cancel/save/blur handlers
- Return: `{ editingCell, editValue, saving, handleEditStart, handleEditChange, handleEditCancel, handleCellSave, handleCellBlur }`

**Extracted Code**:
- Lines 603-605: editingCell, editValue, saving states
- Lines 966-978: handleEditStart, handleEditChange, handleEditCancel
- Lines 980-1063: handleCellSave
- Lines 1065-1070: handleCellBlur

**Tasks**:
- ⬜ Create `useFieldEditing.ts` hook
- ⬜ Move editing state management
- ⬜ Move cell editing handlers
- ⬜ Accept parts, setParts, orderNumber as params
- ⬜ Return editing state and handlers
- ⬜ Update DualTableLayout to use hook
- ⬜ Test: Cell editing still works (legacy pattern, used in renderSpecField)

#### 3.3 usePartUpdates Hook (25 mins)
```
dualtable/
└── hooks/
    └── usePartUpdates.ts
```

**Responsibilities**:
- Handle all part update operations
- Manage saving state
- Provide save handlers for fields, templates, specs
- Provide row add/remove handlers
- Provide toggle parent handler
- Provide refresh handler
- Return: All save/update functions

**Extracted Code**:
- Lines 661-818: Save handlers (field, template, spec)
- Lines 820-934: Row manipulation (add/remove)
- Lines 936-964: Toggle parent/sub
- Lines 1262-1285: Refresh parts

**Tasks**:
- ⬜ Create `usePartUpdates.ts` hook
- ⬜ Move handleFieldSave
- ⬜ Move handleTemplateSave
- ⬜ Move handleSpecFieldSave
- ⬜ Move addSpecRow / removeSpecRow
- ⬜ Move toggleIsParent
- ⬜ Move handleRefreshParts
- ⬜ Accept orderNumber, parts, setParts, partsRef, specRowCounts, setSpecRowCounts
- ⬜ Return all update functions
- ⬜ Update DualTableLayout to use hook
- ⬜ Test: All save operations work, row add/remove works, toggle works, refresh works

**File Size Impact**: Main component 1150 → ~850 lines (~300 lines extracted to hooks)

---

### Phase 4: Extract Utility Functions (15 mins)

**Goal**: Move helper functions to utilities

#### 4.1 Create Utilities File
```
dualtable/
└── utils/
    └── formatting.ts
```

**Content**:
```typescript
export const formatCurrency = (value: number | string | undefined | null): string => {
  // Lines 1072-1077
};

export const formatQuantity = (value: number | string | undefined | null): string => {
  // Lines 1079-1084
};
```

**Tasks**:
- ⬜ Create `utils/formatting.ts`
- ⬜ Move formatCurrency (1072-1077)
- ⬜ Move formatQuantity (1079-1084)
- ⬜ Export functions
- ⬜ Update imports in main component
- ⬜ Test: Currency and quantity display correctly

**File Size Impact**: Main component 850 → ~835 lines (~15 lines extracted)

---

### Phase 5: Extract Large Sub-Components (45 mins)

**Goal**: Break down the massive renderPartRow function and related rendering

#### 5.1 PartRow Component (20 mins)
```
dualtable/
└── components/
    └── PartRow.tsx
```

**Responsibilities**:
- Render entire part row (lines 1287-1577)
- Use all sub-components (ItemNameDropdown, EditableSpecsQty, etc.)
- Handle multi-row specification rendering
- Display QB Item, Description, Price fields

**Props**:
```typescript
interface PartRowProps {
  part: OrderPart;
  orderNumber: number;
  availableTemplates: string[];
  qbItems: QBItem[];
  rowCount: number;
  onFieldSave: (partId: number, field: string, value: string) => Promise<void>;
  onTemplateSave: (partId: number, rowNum: number, value: string) => Promise<void>;
  onSpecFieldSave: (partId: number, specKey: string, value: string) => Promise<void>;
  onAddRow: (partId: number) => void;
  onRemoveRow: (partId: number) => void;
  onToggleParent: (partId: number) => void;
  onUpdate: () => void;
}
```

**Tasks**:
- ⬜ Create `PartRow.tsx` component
- ⬜ Move renderPartRow logic (1287-1577)
- ⬜ Move renderQBItemDropdown logic (1188-1259) into PartRow or separate component
- ⬜ Accept all necessary props
- ⬜ Update DualTableLayout to use PartRow
- ⬜ Test: All part rows render correctly, all interactions work

#### 5.2 SpecificationRows Component (15 mins)
```
dualtable/
└── components/
    └── SpecificationRows.tsx
```

**Responsibilities**:
- Render specification columns (Template, Spec 1, Spec 2, Spec 3)
- Handle multi-row rendering for a single part
- Use SpecTemplateDropdown and SpecFieldInput

**Props**:
```typescript
interface SpecificationRowsProps {
  part: OrderPart;
  rowCount: number;
  availableTemplates: string[];
  onTemplateSave: (partId: number, rowNum: number, value: string) => Promise<void>;
  onSpecFieldSave: (partId: number, specKey: string, value: string) => Promise<void>;
}
```

**Extracted From**: Lines 1351-1481 (inside renderPartRow)

**Tasks**:
- ⬜ Create `SpecificationRows.tsx` component
- ⬜ Move template dropdown rendering
- ⬜ Move spec1, spec2, spec3 rendering
- ⬜ Use in PartRow component
- ⬜ Test: Specification fields render and save correctly

#### 5.3 InvoiceSummary Component (10 mins)
```
dualtable/
└── components/
    └── InvoiceSummary.tsx
```

**Responsibilities**:
- Display subtotal, tax, total
- Calculate summary from parts and tax rules

**Props**:
```typescript
interface InvoiceSummaryProps {
  parts: OrderPart[];
  taxName?: string;
  taxRules: TaxRule[];
}
```

**Extracted From**:
- Lines 1580-1609: Invoice calculation (move to useMemo inside component)
- Lines 1672-1697: Summary JSX

**Tasks**:
- ⬜ Create `InvoiceSummary.tsx` component
- ⬜ Move invoice calculation logic
- ⬜ Move summary rendering JSX
- ⬜ Use formatCurrency from utils
- ⬜ Update DualTableLayout to use InvoiceSummary
- ⬜ Test: Totals calculate correctly

**File Size Impact**: Main component 835 → ~300 lines (~535 lines extracted to components)

---

### Phase 6: Refactor Main Component (15 mins)

**Goal**: Simplify DualTableLayout to orchestration only

#### 6.1 Final Main Component Structure
```typescript
export const DualTableLayout: React.FC<DualTableLayoutProps> = ({
  orderNumber,
  initialParts,
  taxName
}) => {
  // Use custom hooks
  const {
    qbItems,
    taxRules,
    parts,
    setParts,
    partsRef,
    specRowCounts,
    setSpecRowCounts
  } = useTableData(initialParts);

  const {
    handleFieldSave,
    handleTemplateSave,
    handleSpecFieldSave,
    addSpecRow,
    removeSpecRow,
    toggleIsParent,
    handleRefreshParts
  } = usePartUpdates(orderNumber, parts, setParts, partsRef, specRowCounts, setSpecRowCounts);

  const availableTemplates = React.useMemo(() => getAllTemplateNames(), []);

  const rowCounts = React.useMemo(() => {
    // Calculate row counts for each part
    const counts: Record<number, number> = {};
    parts.forEach(part => {
      const templateCount = part.specifications
        ? Object.keys(part.specifications).filter(key => key.startsWith('_template_')).length
        : 0;
      counts[part.part_id] = specRowCounts[part.part_id] || templateCount || 1;
    });
    return counts;
  }, [parts, specRowCounts]);

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        {/* Header */}
        <TableHeader />

        {/* Body */}
        <div>
          {parts.length > 0 ? (
            parts.map(part => (
              <PartRow
                key={part.part_id}
                part={part}
                orderNumber={orderNumber}
                availableTemplates={availableTemplates}
                qbItems={qbItems}
                rowCount={rowCounts[part.part_id]}
                onFieldSave={handleFieldSave}
                onTemplateSave={handleTemplateSave}
                onSpecFieldSave={handleSpecFieldSave}
                onAddRow={addSpecRow}
                onRemoveRow={removeSpecRow}
                onToggleParent={toggleIsParent}
                onUpdate={handleRefreshParts}
              />
            ))
          ) : (
            <div className="p-6 text-center text-gray-500">
              No parts to display
            </div>
          )}
        </div>

        {/* Footer */}
        <InvoiceSummary
          parts={parts}
          taxName={taxName}
          taxRules={taxRules}
        />
      </div>
    </div>
  );
};
```

**Tasks**:
- ⬜ Import all custom hooks
- ⬜ Import all sub-components
- ⬜ Simplify main render to use sub-components
- ⬜ Remove all extracted code
- ⬜ Keep only orchestration logic
- ⬜ Test: Full component works end-to-end

#### 6.2 Create TableHeader Component (5 mins)
```
dualtable/
└── components/
    └── TableHeader.tsx
```

**Extracted From**: Lines 1615-1658

**Tasks**:
- ⬜ Create TableHeader component
- ⬜ Move header JSX
- ⬜ Use in DualTableLayout
- ⬜ Test: Header displays correctly

---

## Final File Structure

```
frontend/web/src/components/orders/details/
└── dualtable/
    ├── components/
    │   ├── EditableTextarea.tsx         (~75 lines)
    │   ├── EditableInput.tsx            (~52 lines)
    │   ├── SpecTemplateDropdown.tsx     (~50 lines)
    │   ├── SpecFieldInput.tsx           (~111 lines)
    │   ├── ItemNameDropdown.tsx         (~67 lines)
    │   ├── EditableSpecsQty.tsx         (~88 lines)
    │   ├── PartRow.tsx                  (~200 lines)
    │   ├── SpecificationRows.tsx        (~150 lines)
    │   ├── InvoiceSummary.tsx           (~50 lines)
    │   └── TableHeader.tsx              (~45 lines)
    │
    ├── hooks/
    │   ├── useTableData.ts              (~80 lines)
    │   ├── useFieldEditing.ts           (~120 lines) [Optional - used by legacy renderSpecField]
    │   └── usePartUpdates.ts            (~250 lines)
    │
    ├── utils/
    │   └── formatting.ts                (~15 lines)
    │
    ├── constants/
    │   └── tableConstants.ts            (~70 lines)
    │
    └── DualTableLayout.tsx              (~300 lines) ⭐ MAIN COMPONENT
```

**Total Files**: 15
**Line Count Reduction**: 1703 → ~300 (main) + ~1373 (organized modules) = 82% reduction in main file

---

## Testing Checklist

### Functionality Tests
- ⬜ Parts load and display correctly
- ⬜ QB items dropdown populates
- ⬜ Tax rules load for invoice calculation
- ⬜ Item name dropdown works (ItemNameDropdown)
- ⬜ Specification template selection works
- ⬜ Spec field editing saves correctly
- ⬜ Invoice description edits save
- ⬜ QB description edits save
- ⬜ Quantity/unit price edits calculate extended price
- ⬜ Add specification row works (+ button)
- ⬜ Remove specification row works (- button)
- ⬜ Remove row clears data from deleted rows
- ⬜ Toggle Base/Sub item works
- ⬜ Cannot promote to Base without Item Name selected
- ⬜ Specs QTY edit works and highlights when different from quantity
- ⬜ Invoice summary calculates correctly
- ⬜ Tax calculation uses correct percentage
- ⬜ QB item selection auto-fills description
- ⬜ Highlight styles apply correctly (green for valid, gray for templates, etc.)
- ⬜ Memoization prevents unnecessary re-renders

### Technical Tests
- ⬜ TypeScript compilation succeeds
- ⬜ No console errors or warnings
- ⬜ All imports resolve correctly
- ⬜ Hot module reload works
- ⬜ Build completes successfully
- ⬜ API calls use correct endpoints
- ⬜ Optimistic updates work (local state updates before API response)
- ⬜ partsRef prevents stale closure bugs
- ⬜ Loading states display during saves
- ⬜ Error handling works (alerts on failures)

### Performance Tests
- ⬜ React.memo optimization still effective
- ⬜ useMemo for templates and calculations
- ⬜ useCallback for save handlers
- ⬜ No performance regression with refactored code
- ⬜ Editing one field doesn't re-render all fields

---

## Risk Mitigation

### Before Starting
- ⬜ Create full backup of DualTableLayout.tsx
- ⬜ Commit current working state to git
- ⬜ Document any discovered edge cases

### During Refactoring
- ⬜ Test after each phase completion
- ⬜ Keep original file as reference until fully verified
- ⬜ Maintain all React.memo optimizations
- ⬜ Preserve all TypeScript types
- ⬜ Document any deviations from plan

### Critical Areas to Preserve

1. **partsRef Pattern** (lines 602, 654, 664, 722, 785)
   - MUST use `partsRef.current` in save handlers to avoid stale closures
   - Sync partsRef in useEffect whenever parts changes

2. **Template Change Behavior** (lines 736-743)
   - Clearing all `rowN_*` fields when template changes
   - Pattern: Delete all spec data, then set template

3. **Row Count Logic** (lines 820-934)
   - Fallback chain: specRowCounts → templateCount → 1
   - Range enforcement: 1-20 rows
   - Data clearing when removing rows

4. **Extended Price Calculation** (lines 679-685, 1016-1030)
   - Auto-calculate on quantity or unit_price change
   - Null all pricing if either is null/0

5. **Memoization Strategy** (All memo components)
   - Comparison functions must compare correct props
   - displayName for debugging

6. **Invoice Summary** (lines 1580-1609)
   - Tax decimal vs. percentage conversion
   - Memoization for performance

---

## Dependencies to Analyze Further

### Potential Shared Code with OrderDetailsPage
- EditableField component in OrderDetailsPage (lines 29-147)
  - May conflict with EditableInput/EditableTextarea
  - Assess: Can we use the same component?
  - Decision: Keep separate - DualTableLayout has different save patterns

### API Contract
- Ensure `updateOrderParts` accepts all fields being saved
- Verify `specifications` JSON structure matches backend expectations
- Check `specs_display_name` vs `product_type` precedence

---

## Time Estimates

| Phase | Description | Estimated Time | Complexity |
|-------|-------------|----------------|------------|
| Phase 1 | Extract Memoized Components | 30 mins | Low |
| Phase 2 | Extract Constants & Types | 10 mins | Low |
| Phase 3 | Extract Custom Hooks | 60 mins | High |
| Phase 4 | Extract Utilities | 15 mins | Low |
| Phase 5 | Extract Large Components | 45 mins | Medium |
| Phase 6 | Refactor Main Component | 15 mins | Medium |
| Testing | Full Functionality Validation | 30 mins | Medium |
| **Total** | **Complete Refactoring** | **205 mins (~3.5 hrs)** | - |

**Estimated vs Original**: 205 mins vs 120 mins (original estimate was too optimistic)

---

## Success Metrics

### Quantitative
- ✅ Main component: 1703 → ~300 lines (82% reduction)
- ✅ Number of new files: 15
- ✅ Largest new file: <250 lines (usePartUpdates hook)
- ✅ Test coverage: 100% functionality preserved

### Qualitative
- ✅ Code is more maintainable
- ✅ Components are reusable (EditableTextarea, etc. can be used elsewhere)
- ✅ Business logic is separated from UI
- ✅ File organization is logical
- ✅ Testing is easier (can test hooks independently)
- ✅ Performance optimizations preserved (React.memo, useMemo, useCallback)

---

## Notes & Observations

### Key Findings
- Component uses advanced React patterns (memo, ref for stale closures)
- Complex multi-row specification system requires careful state management
- Real-time API updates with optimistic UI updates
- Heavy use of dynamic field rendering based on template configuration
- QB integration auto-fills descriptions (tight coupling to QuickBooks data)

### Potential Challenges
- partsRef pattern must be preserved to prevent stale closure bugs
- Memoization must be maintained for performance (large tables can have 50+ parts)
- Row management logic has complex fallback chains
- Template switching must clear old data to prevent corruption
- QB description auto-fill depends on QB item selection order

### Improvement Opportunities Beyond Refactoring
- Consider using React Context for orderNumber to avoid prop drilling
- Could implement undo/redo for field edits
- Could add field-level validation before save
- Could batch API calls for multiple edits
- Could add loading skeleton while fetching QB items/tax rules
- Could add toast notifications instead of alerts

### Code Smells to Fix During Refactoring
- ❌ `handleCellSave` (lines 980-1063) is complex - will be removed with useFieldEditing
- ❌ `renderPartRow` (lines 1287-1577) is 290 lines - will be extracted to PartRow
- ❌ `renderQBItemDropdown` (lines 1188-1259) is 70 lines - will be in PartRow or separate component
- ❌ Duplicate QB item update logic (handleCellSave vs renderQBItemDropdown)
- ❌ Magic numbers (20 for max rows) - should be constant

---

## Recommended Execution Order

1. **Phase 2 First** (Constants) - Low risk, immediate clarification
2. **Phase 1 Second** (Components) - Low risk, big file reduction
3. **Phase 4 Third** (Utilities) - Low risk, easy wins
4. **Phase 3 Fourth** (Hooks) - High complexity, core logic
5. **Phase 5 Fifth** (Large Components) - Depends on hooks
6. **Phase 6 Last** (Main Component) - Final assembly
7. **Testing** (Comprehensive) - Validation

**Rationale**: Extract simple things first to reduce file size and complexity, then tackle complex hooks, then assemble large components.

---

## Alternative Approaches Considered

### Approach 1: Keep Everything Inline (Current State)
**Pros**: Single file, no import overhead
**Cons**: Unmaintainable, hard to test, violates SRP
**Verdict**: ❌ Rejected - 1703 lines is too large

### Approach 2: Split by Feature (Specs vs Invoice)
**Pros**: Clear domain separation
**Cons**: Parts span both domains, complex data flow
**Verdict**: ❌ Rejected - Parts are the core entity

### Approach 3: Component + Hooks (This Plan)
**Pros**: Separation of concerns, testability, reusability
**Cons**: More files, import overhead
**Verdict**: ✅ **Selected** - Best balance of maintainability and clarity

---

## Open Questions for User

1. **EditableField Reuse**: OrderDetailsPage has an EditableField component (lines 29-147). Should we consolidate with EditableInput/EditableTextarea, or keep separate?
   - **Recommendation**: Keep separate - different save patterns and use cases

2. **Component Placement**: Should extracted components go in `dualtable/` subfolder or top-level `details/`?
   - **Recommendation**: Use `dualtable/` subfolder for clear organization

3. **Hook Complexity**: usePartUpdates will be ~250 lines. Should we split further?
   - **Recommendation**: Start with single hook, split if needed after testing

4. **Testing Strategy**: Unit test hooks independently or integration test the whole component?
   - **Recommendation**: Both - unit test hooks, integration test DualTableLayout

5. **Migration Path**: Refactor all at once or incrementally ship phases?
   - **Recommendation**: All at once in a feature branch - too interdependent for incremental

---

*Last Updated: November 12, 2024*
*Analysis By: Claude Code Assistant*
*Document Version: 1.0 - Complete Analysis*
