# Order Specifications Mapping System

**Purpose:** Maps Item Names (specs_display_name) to Specification Types
**Status:** 🚧 In Progress
**Last Updated:** 2025-11-07

---

## How It Works

When an Item Name is selected (either manually or during order conversion):
1. System looks up the Item Name in the mapping table
2. Auto-generates SPECIFICATION rows with the appropriate names
3. Spec1, Spec2, Spec3 values start empty (filled manually or via auto-population)

---

## Mapping Table

### ✅ MAPPED (23 items)

| Item Name | Specification Types | Status |
|-----------|-------------------|--------|
| Front Lit | Return, Trim, Face, Drain Holes | ✅ Mapped |
| Halo Lit | Return, Face, Pins, Drain Holes | ✅ Mapped |
| Front Lit Acrylic Face | Return, Face, Drain Holes | ✅ Mapped |
| Dual Lit - Single Layer | Return, Trim, Face, Drain Holes | ✅ Mapped |
| Dual Lit - Double Layer | Return, Trim, Face, Drain Holes | ✅ Mapped |
| Vinyl | Vinyl | ✅ Mapped |
| LEDs | LEDs, Wire Length | ✅ Mapped |
| Power Supplies | Power Supply | ✅ Mapped |
| UL | UL | ✅ Mapped |
| 3D print | Return, Face, Pins | ✅ Mapped |
| Blade Sign | Return, Trim, Face | ✅ Mapped |
| Marquee Bulb | Return, Face | ✅ Mapped |
| Neon LED | Neon Base, Neon LED, Mounting | ✅ Mapped |
| Vinyl Cut | Cut, Peel, Mask | ✅ Mapped |
| Material Cut | Return, Trim, Face, Back | ✅ Mapped |
| Backer | Material, Cutting, Assembly | ✅ Mapped |
| Frame | Material, Assembly | ✅ Mapped |
| Aluminum Raceway | Material, Assembly | ✅ Mapped |
| Extrusion Raceway | Extr. Colour, Assembly | ✅ Mapped |
| Push Thru | Box Material, Push Thru Acrylic | ✅ Mapped |
| Knockout Box | Box Material, Push Thru Acrylic | ✅ Mapped |
| Substrate Cut | Material, Cutting, Mounting | ✅ Mapped |
| Painting | Painting | ✅ Mapped |

### 🔲 UNMAPPED (16 items - To Be Defined)

| Item Name | Specification Types | Status | Notes |
|-----------|-------------------|--------|-------|
| Dual Lit | ? | 🔲 Pending | Same as "Dual Lit - Single Layer"? |
| Trimless Front Lit | ? | 🔲 Pending | |
| Trimless Halo Lit | ? | 🔲 Pending | |
| Trimless Dual Lit | ? | 🔲 Pending | |
| Epoxy | ? | 🔲 Pending | |
| Stainless Steel Sign | ? | 🔲 Pending | |
| Return | ? | 🔲 Pending | Standalone product or component? |
| Trim Cap | ? | 🔲 Pending | |
| Front Lit Push Thru | ? | 🔲 Pending | |
| Acrylic MINI | ? | 🔲 Pending | |
| Halo Acrylic | ? | 🔲 Pending | |
| Custom | ? | 🔲 Pending | |
| Dual Lit Acrylic Face (Discontinued) | ? | 🔲 Pending | |
| Channel Letter | ? | 🔲 Pending | |
| Reverse Channel | ? | 🔲 Pending | |
| Trimless Channel | ? | 🔲 Pending | |

---

## Implementation Status

**Utility File:** `/backend/web/src/utils/specsTypeMapper.ts`

**Current Behavior:**
- ✅ Returns spec types for mapped items
- ✅ Returns empty array for unmapped items
- ✅ Console warning for unmapped items
- ⏳ Phase 2: Auto-populate Spec1, Spec2, Spec3 from estimate/customer data

---

## Usage

### Backend (Order Conversion)
```typescript
import { mapSpecsDisplayNameToTypes } from '../utils/specsTypeMapper';

const specTypes = mapSpecsDisplayNameToTypes('Front Lit');
// Returns: [
//   { name: "Return", spec1: "", spec2: "", spec3: "" },
//   { name: "Trim", spec1: "", spec2: "", spec3: "" },
//   { name: "Face", spec1: "", spec2: "", spec3: "" },
//   { name: "Drain Holes", spec1: "", spec2: "", spec3: "" }
// ]
```

### Frontend (Manual Dropdown Selection)
```typescript
// User selects "Front Lit" from dropdown
// → API call to update order_parts.specs_display_name
// → System auto-generates SPECIFICATION rows
// → User manually fills Spec1, Spec2, Spec3 values
```

---

## Next Steps

1. Define specification types for remaining 28 unmapped items
2. Update `specsTypeMapper.ts` as mappings are defined
3. Phase 2: Implement auto-population of Spec1/2/3 values from estimate data
4. Phase 3: Integrate with Order Details Page dropdown UI

---

## Notes

- Unmapped items will show console warning and return empty specs array
- Specs are stored in `order_parts.specifications` JSON column
- Item Name is stored in `order_parts.specs_display_name` column
- This is separate from `order_parts.qb_item_name` (used for QuickBooks sync)
