# Orders Page - Materials Integration (Future)

> **PHASE 1 IMPLEMENTATION: This entire feature is deferred to Phase 4. Phase 1 includes only stub endpoints that return 501 Not Implemented.**

## Phase 1: Stub Implementation

### Database Tables
Created but unused - ready for future implementation:
```sql
CREATE TABLE materials_breakdown (...);  -- Schema defined, not used
CREATE TABLE material_requirements (...); -- Schema defined, not used
```

### API Endpoints

All return 501 Not Implemented:

```javascript
// Stub endpoints for future implementation
router.get('/orders/:orderId/materials', async (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Materials integration not yet implemented - Phase 4'
  });
});

router.post('/orders/:orderId/materials/calculate', async (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Materials calculation not yet implemented - Phase 4'
  });
});

router.put('/orders/:orderId/materials/:materialId', async (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Materials update not yet implemented - Phase 4'
  });
});
```

---

## Phase 4: Full Implementation

## Purpose
Define how order parts are automatically translated into material requirements, how materials connect to inventory and supply chain, and the workflow for materials planning.

---

## Overview

**STATUS: Future Enhancement - To Be Implemented in Phase 4**

Materials integration bridges the gap between "what the customer ordered" and "what we need to buy/use to make it." This system will:

1. **Auto-calculate** material requirements from order part specifications
2. **Check inventory** for availability
3. **Generate shopping lists** for missing items
4. **Track material costs** for profitability analysis
5. **Reserve materials** for specific jobs (prevent double-booking)

---

## Order Landing Process with Materials

**NOTE**: This workflow is unclear and needs clarification. Here's the revised simplified workflow:

```
Order Created from Estimate
    ↓
Manager Builds Order Structure
    ↓
Parts Defined with Specifications
    ↓
[MATERIALS CALCULATION TRIGGERED]
    • Parse part specifications
    • Apply calculation formulas
    • Generate materials breakdown
    ↓
Materials List Created (Auto generated)
    ↓
[INVENTORY CHECK]
    • Check current stock levels
    • Include even materials that are slightly too small
    • List the next 3 biggest items that are too small
    • OR list all items and make it navigable
    ↓
Manager Adjusts (Manual)
    • Adjust sizes/quantities/materials to match what is actually required
    ↓
[AUTOMATIC INVENTORY CHECK AGAIN]
    • Re-check with new sizes/materials
    ↓
Manager Picks Usable Items (Manual - DO NOT auto-reserve)
    • Manager selects what is actually usable from inventory after checking stock
    ↓
Remaining Items Handling
    • Can mark as 'have in stock' if inventory catalog is missing some items
    • OR give suggestions to order from preferred supplier for that item
    ↓
Generate Purchase Orders / Shopping Cart
    • Can order materials for multiple jobs at a time
    ↓
Order Ready for Production
```

**IMPORTANT NOTE**: Most of the heavy lifting for materials should be done in the Materials Page instead of here. This section might need to be restructured in the future. This is just for rough planning for now.

---

## Materials Breakdown Structure

### TypeScript Interface

```typescript
interface MaterialsBreakdown {
  orderId: string;
  partId: string;

  // === STATUS ===
  status: 'calculated' | 'reviewed' | 'confirmed' | 'reserved';
  calculatedDate: Date;
  confirmedBy?: string;
  confirmedDate?: Date;

  // === MATERIALS LIST ===
  materials: MaterialRequirement[];

  // === SUMMARY ===
  totalEstimatedCost: number;
  totalActualCost?: number;           // Once materials purchased
  itemsNeedingPurchase: number;

  // === METADATA ===
  autoCalculated: boolean;
  notes?: string;
}

interface MaterialRequirement {
  id: string;
  breakdownId: string;

  // === MATERIAL IDENTIFICATION ===
  category: MaterialCategory;
  materialType: string;               // 'acrylic', 'aluminum', 'vinyl', etc.
  specification: string;              // 'White 1/8" acrylic', 'Black aluminum coil'

  // === QUANTITY ===
  quantityNeeded: number;
  unit: MaterialUnit;                 // 'sq_ft', 'linear_ft', 'pieces', etc.
  wasteFactorApplied: number;         // Percentage (e.g., 15% = 1.15 multiplier)
  quantityWithWaste: number;

  // === INVENTORY LINK ===
  inventoryItemId?: string;           // Separate from vinylId - can link to vinyl_inventory or other inventory
  vinylId?: string;                   // Link to vinyl_inventory specifically
  inStock: boolean;
  currentStockLevel?: number;

  // === SUPPLY CHAIN ===
  supplierId?: string;
  supplierProductCode?: string;
  estimatedUnitCost?: number;
  estimatedTotalCost?: number;

  // === USAGE ===
  purposeDescription: string;         // "Letter faces", "Returns", "Backing panel"
  linkedToSubItem?: string;           // Sub-item ID if applicable

  // === STATUS ===
  status: 'reservedOrOrdered' | 'received';  // Reserved in our inventory OR ordered
  purchaseOrderId?: string;
}

enum MaterialCategory {
  SHEET_MATERIAL = 'sheet_material',    // Acrylic, aluminum, ACM
  VINYL = 'vinyl',                      // All vinyl types
  METAL_COIL = 'metal_coil',            // Aluminum coil/sheet
  LIGHTING = 'lighting',                // LEDs, power supplies
  HARDWARE = 'hardware',                // Studs, screws, clips
  PAINT = 'paint',                      // All paints/finishes
  ADHESIVE = 'adhesive',                // Glues, tapes, VHB
  FABRICATION = 'fabrication',          // Router bits, blades (consumables)
  ELECTRICAL = 'electrical',            // Wire, connectors
  PACKAGING = 'packaging'               // Boxes, bubble wrap
}

enum MaterialUnit {
  SQUARE_FEET = 'sq_ft',
  LINEAR_FEET = 'linear_ft',
  PIECES = 'pieces',
  SHEETS = 'sheets',
  GALLONS = 'gallons',
  POUNDS = 'lbs',
  METERS = 'meters',
  ROLLS = 'rolls'
}

```

**NOTE**: Material templates and calculations will be discussed one by one in the future. Don't worry about these for now.

---

## Calculation Logic (Future Planning)

### Example: Channel Letters Material Calculation

```javascript
async function calculateChannelLetterMaterials(part) {
  const specs = part.specifications;
  const materials = [];

  // === FACES (ACRYLIC) ===
  if (specs.faceMaterial && specs.faceMaterial.includes('acrylic')) {
    // Calculate square footage needed for letter faces
    const letterCount = specs.text ? specs.text.replace(/\s/g, '').length : 4;
    const height = specs.dimensions.height;

    // Rough estimate: each letter ≈ height × (height * 0.7) sq inches
    const sqInchesPerLetter = height * (height * 0.7);
    const totalSqInches = sqInchesPerLetter * letterCount;
    const sqFeet = totalSqInches / 144;

    // Apply waste factor (typically 25% for irregular cuts)
    const wasteFactor = 1.25;
    const sqFeetWithWaste = sqFeet * wasteFactor;

    materials.push({
      category: 'sheet_material',
      materialType: 'acrylic',
      specification: specs.faceMaterial,
      quantityNeeded: sqFeet,
      unit: 'sq_ft',
      wasteFactorApplied: 25,
      quantityWithWaste: sqFeetWithWaste,
      purposeDescription: 'Letter faces',
      estimatedUnitCost: 8.50,  // Per sq ft (from supplier pricing)
      estimatedTotalCost: sqFeetWithWaste * 8.50
    });
  }

  // === RETURNS (ALUMINUM COIL) ===
  if (specs.returnMaterial && specs.returnMaterial.includes('aluminum')) {
    const letterCount = specs.text ? specs.text.replace(/\s/g, '').length : 4;
    const height = specs.dimensions.height;
    const depth = specs.dimensions.depth || 4;

    // Perimeter calculation (rough): each letter ≈ height * 3
    const perimeterPerLetter = height * 3;
    const totalPerimeter = perimeterPerLetter * letterCount;
    const linearFeet = totalPerimeter / 12;

    // Coil width needed = depth + extra for bending
    const coilWidth = depth + 1;

    // Calculate linear feet of coil needed
    const wasteFactor = 1.15;  // Less waste for linear material
    const linearFeetWithWaste = linearFeet * wasteFactor;

    materials.push({
      category: 'metal_coil',
      materialType: 'aluminum_coil',
      specification: `${coilWidth}" wide, ${specs.returnColor} aluminum`,
      quantityNeeded: linearFeet,
      unit: 'linear_ft',
      wasteFactorApplied: 15,
      quantityWithWaste: linearFeetWithWaste,
      purposeDescription: 'Letter returns',
      estimatedUnitCost: 3.75,  // Per linear foot
      estimatedTotalCost: linearFeetWithWaste * 3.75
    });
  }

  // === VINYL (if applicable) ===
  if (specs.requiresVinyl && specs.vinylColor) {
    // Use same square footage as faces (vinyl covers faces)
    const facesMaterial = materials.find(m => m.purposeDescription === 'Letter faces');

    if (facesMaterial) {
      // Check if this vinyl exists in inventory
      const vinylProduct = await findVinylByColor(specs.vinylColor);

      materials.push({
        category: 'vinyl',
        materialType: 'vinyl_film',
        specification: specs.vinylColor,
        quantityNeeded: facesMaterial.quantityNeeded,
        unit: 'sq_ft',
        wasteFactorApplied: 20,  // Vinyl waste
        quantityWithWaste: facesMaterial.quantityNeeded * 1.20,
        purposeDescription: 'Vinyl overlay on faces',
        inventoryItemId: vinylProduct?.id,
        inStock: vinylProduct ? vinylProduct.current_stock_sqft > (facesMaterial.quantityNeeded * 1.20) : false,
        currentStockLevel: vinylProduct?.current_stock_sqft,
        estimatedUnitCost: vinylProduct?.cost_per_sqft || 2.50,
        estimatedTotalCost: (facesMaterial.quantityNeeded * 1.20) * (vinylProduct?.cost_per_sqft || 2.50)
      });
    }
  }

  // === LEDS ===
  if (specs.hasLighting) {
    const letterCount = specs.text ? specs.text.replace(/\s/g, '').length : 4;
    const height = specs.dimensions.height;

    // Estimate LED modules needed (roughly 1 per 6" of height per letter)
    const modulesPerLetter = Math.ceil(height / 6);
    const totalModules = modulesPerLetter * letterCount;

    materials.push({
      category: 'lighting',
      materialType: 'led_modules',
      specification: `${specs.ledColor || 'White'} LED modules`,
      quantityNeeded: totalModules,
      unit: 'pieces',
      wasteFactorApplied: 10,  // Extra for failures
      quantityWithWaste: Math.ceil(totalModules * 1.10),
      purposeDescription: 'LED illumination',
      estimatedUnitCost: 3.50,
      estimatedTotalCost: Math.ceil(totalModules * 1.10) * 3.50
    });

    // Power supply (1 per set of letters)
    materials.push({
      category: 'lighting',
      materialType: 'power_supply',
      specification: 'UL-listed LED power supply',
      quantityNeeded: 1,
      unit: 'pieces',
      wasteFactorApplied: 0,
      quantityWithWaste: 1,
      purposeDescription: 'Power supply for LEDs',
      estimatedUnitCost: 45.00,
      estimatedTotalCost: 45.00
    });
  }

  // === MOUNTING HARDWARE ===
  materials.push({
    category: 'hardware',
    materialType: 'mounting_studs',
    specification: '1/2" threaded studs',
    quantityNeeded: (specs.text?.replace(/\s/g, '').length || 4) * 2,  // 2 per letter
    unit: 'pieces',
    wasteFactorApplied: 10,
    quantityWithWaste: Math.ceil((specs.text?.replace(/\s/g, '').length || 4) * 2 * 1.10),
    purposeDescription: 'Wall mounting',
    estimatedUnitCost: 2.50,
    estimatedTotalCost: Math.ceil((specs.text?.replace(/\s/g, '').length || 4) * 2 * 1.10) * 2.50
  });

  return materials;
}
```

### Example: ACM Panel Material Calculation

```javascript
async function calculateACMPanelMaterials(part) {
  const specs = part.specifications;
  const materials = [];

  // === ACM SHEET ===
  const height = specs.dimensions.height;  // inches
  const width = specs.dimensions.width;
  const sqInches = height * width;
  const sqFeet = sqInches / 144;

  // Minimal waste for rectangular cuts
  const wasteFactor = 1.05;
  const sqFeetWithWaste = sqFeet * wasteFactor;

  materials.push({
    category: 'sheet_material',
    materialType: 'acm',
    specification: `${specs.faceMaterial || 'Black ACM'} 3mm`,
    quantityNeeded: sqFeet,
    unit: 'sq_ft',
    wasteFactorApplied: 5,
    quantityWithWaste: sqFeetWithWaste,
    purposeDescription: 'Panel face',
    estimatedUnitCost: 4.25,
    estimatedTotalCost: sqFeetWithWaste * 4.25
  });

  // === PAINT (if needed) ===
  if (specs.requiresPainting) {
    // Calculate perimeter for edge painting
    const perimeter = (height + width) * 2 / 12;  // Linear feet

    materials.push({
      category: 'paint',
      materialType: 'edge_paint',
      specification: `${specs.paintColor} edge paint`,
      quantityNeeded: perimeter,
      unit: 'linear_ft',
      wasteFactorApplied: 0,
      quantityWithWaste: perimeter,
      purposeDescription: 'Edge painting',
      estimatedUnitCost: 0.50,  // Per linear foot (paint is cheap, mostly labor)
      estimatedTotalCost: perimeter * 0.50
    });
  }

  // === MOUNTING HARDWARE ===
  if (specs.mountingMethod === 'z_clips') {
    // Estimate Z-clips needed (roughly every 24")
    const clips = Math.ceil(width / 24) * 2;  // Top and bottom

    materials.push({
      category: 'hardware',
      materialType: 'z_clips',
      specification: 'Z-clips for ACM mounting',
      quantityNeeded: clips,
      unit: 'pieces',
      wasteFactorApplied: 10,
      quantityWithWaste: Math.ceil(clips * 1.10),
      purposeDescription: 'Panel mounting',
      estimatedUnitCost: 3.00,
      estimatedTotalCost: Math.ceil(clips * 1.10) * 3.00
    });
  }

  return materials;
}
```

---

## Material Calculation Template System

### Template Structure

```typescript
interface MaterialCalculationTemplate {
  productType: ProductType;
  calculationRules: MaterialCalculationRule[];
}

interface MaterialCalculationRule {
  condition: (specs: PartSpecifications) => boolean;
  calculate: (specs: PartSpecifications, part: OrderPart) => MaterialRequirement[];
}
```

### Centralized Template Registry

```javascript
const materialTemplates = {
  channel_letters: new ChannelLettersMaterialTemplate(),
  flat_cut_letters: new FlatCutLettersMaterialTemplate(),
  acm_panel: new ACMPanelMaterialTemplate(),
  // ... more templates
};

async function calculateMaterialsForPart(part) {
  const template = materialTemplates[part.specifications.productType];

  if (!template) {
    throw new Error(`No material template for product type: ${part.specifications.productType}`);
  }

  const materials = await template.calculate(part);

  // Check inventory availability for each material
  for (const material of materials) {
    await checkInventoryAvailability(material);
  }

  // Calculate total estimated cost
  const totalCost = materials.reduce((sum, m) => sum + (m.estimatedTotalCost || 0), 0);

  return {
    orderId: part.orderId,
    partId: part.id,
    status: 'calculated',
    calculatedDate: new Date(),
    materials,
    totalEstimatedCost: totalCost,
    availableInInventory: materials.every(m => m.inStock !== false),
    itemsNeedingPurchase: materials.filter(m => m.inStock === false).length,
    autoCalculated: true,
    manualAdjustments: []
  };
}
```

---

## Inventory Integration

### Check Stock Levels

```javascript
async function checkInventoryAvailability(material) {
  // For vinyl, check vinyl_inventory table
  if (material.category === 'vinyl' && material.inventoryItemId) {
    const vinylItem = await getVinylInventoryItem(material.inventoryItemId);

    material.inStock = vinylItem.current_stock_sqft >= material.quantityWithWaste;
    material.currentStockLevel = vinylItem.current_stock_sqft;
    material.estimatedUnitCost = vinylItem.cost_per_sqft;
    material.estimatedTotalCost = material.quantityWithWaste * vinylItem.cost_per_sqft;

    return;
  }

  // For other materials, check future materials_inventory table
  // TODO: Implement once materials inventory system is built

  // For now, mark as needs verification
  material.inStock = null;  // Unknown
  material.currentStockLevel = null;
}
```

### Reserve Materials

When order is approved for production, optionally reserve materials:

```javascript
async function reserveMaterialsForOrder(orderId) {
  const order = await getOrderById(orderId);
  const breakdown = await getMaterialsBreakdown(orderId);

  for (const material of breakdown.materials) {
    if (material.inventoryItemId && material.inStock) {
      // Create reservation record
      await createMaterialReservation({
        orderId: order.id,
        materialRequirementId: material.id,
        inventoryItemId: material.inventoryItemId,
        quantityReserved: material.quantityWithWaste,
        reservedDate: new Date(),
        expiresDate: addDays(new Date(), 30)  // Reservation expires if not used
      });

      material.isReserved = true;
    }
  }

  await saveMaterialsBreakdown(breakdown);
}
```

---

## Supply Chain Integration

### Generate Shopping Cart

```javascript
async function generateShoppingCart(orderId) {
  const breakdown = await getMaterialsBreakdown(orderId);

  // Get materials that need to be purchased
  const itemsToPurchase = breakdown.materials.filter(m =>
    m.inStock === false || m.inStock === null
  );

  // Group by supplier
  const itemsBySupplier = {};

  for (const material of itemsToPurchase) {
    // Find best supplier for this material
    const supplier = await findBestSupplier(material);

    if (!itemsBySupplier[supplier.id]) {
      itemsBySupplier[supplier.id] = {
        supplier,
        items: []
      };
    }

    itemsBySupplier[supplier.id].items.push({
      materialRequirementId: material.id,
      productCode: material.supplierProductCode || await lookupProductCode(supplier, material),
      description: material.specification,
      quantity: material.quantityWithWaste,
      unit: material.unit,
      estimatedCost: material.estimatedUnitCost
    });
  }

  return itemsBySupplier;
}
```

### Auto-Match Suppliers

```javascript
async function findBestSupplier(material) {
  // Query suppliers table with material type and specifications
  const suppliers = await findSuppliersForMaterial(material);

  if (suppliers.length === 0) {
    // No supplier found, return null and require manual selection
    return null;
  }

  // Rank suppliers by:
  // 1. Price (lowest)
  // 2. Lead time (shortest)
  // 3. Reliability score
  // 4. Preferred supplier flag

  const rankedSuppliers = suppliers.map(supplier => {
    const pricing = supplier.pricing.find(p =>
      p.materialType === material.materialType &&
      p.specification === material.specification
    );

    return {
      ...supplier,
      score: calculateSupplierScore(supplier, pricing)
    };
  }).sort((a, b) => b.score - a.score);

  return rankedSuppliers[0];
}
```

---

## Materials Review UI

### Materials Breakdown View

```
┌────────────────────────────────────────────────────────────────────────┐
│  MATERIALS BREAKDOWN - ORDER #200431                                    │
│  Part 1: Channel Letters 'OPEN' w/ LEDs                    [Edit] [✓]  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Status: ● Calculated (awaiting review)                                │
│  Auto-calculated: Nov 1, 2025 10:30 AM                                │
│  Estimated Total Cost: $425.50                                         │
│                                                                         │
├────────────────────────────────────────────────────────────────────────┤
│  MATERIALS REQUIRED                                                     │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Material               Qty Needed  +Waste  Total    In Stock?  Cost   │
│  ───────────────────────────────────────────────────────────────────── │
│  White Acrylic 1/8"     6.5 sq ft   +25%   8.1 sq ft  ✓ Yes   $68.85  │
│  Purpose: Letter faces                          Stock: 45.2 sq ft      │
│                                                                 [Edit]  │
│                                                                         │
│  Black Aluminum Coil    18.0 lin ft  +15%  20.7 lin ft ✓ Yes   $77.63 │
│  4" wide                                            Stock: 250 lin ft   │
│  Purpose: Letter returns                                        [Edit]  │
│                                                                         │
│  Red 3M Vinyl (100-13)  6.5 sq ft   +20%   7.8 sq ft  ✓ Yes   $19.50  │
│  Purpose: Vinyl overlay                         Stock: 52.3 sq ft      │
│                                                                 [Edit]  │
│                                                                         │
│  White LED Modules      28 pieces   +10%   31 pieces  ⚠ Low   $108.50 │
│  6500K                                              Stock: 35 pieces    │
│  Purpose: LED illumination                                      [Edit]  │
│                                                                         │
│  Power Supply           1 piece     +0%    1 piece   ❌ No     $45.00  │
│  UL-listed, LED                                     Stock: 0 pieces     │
│  Purpose: Power supply                       [Add to Cart]     [Edit]  │
│                                                                         │
│  Mounting Studs 1/2"    10 pieces   +10%   11 pieces  ✓ Yes   $27.50  │
│  Purpose: Wall mounting                             Stock: 200 pieces   │
│                                                                 [Edit]  │
│                                                                         │
│  Wire & Connectors      1 set       +0%    1 set     ✓ Yes   $15.00   │
│  Purpose: Electrical                                Stock: 12 sets      │
│                                                                 [Edit]  │
│                                                                         │
│  Adhesive (VHB tape)    20 lin ft   +10%   22 lin ft ✓ Yes    $11.00  │
│  Purpose: Bonding                                   Stock: 500 lin ft   │
│                                                                 [Edit]  │
│                                                                         │
├────────────────────────────────────────────────────────────────────────┤
│  SUMMARY                                                                │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Total Items: 8                                                         │
│  Available in Stock: 7                                                  │
│  Need to Purchase: 1 (Power Supply)                                    │
│                                                                         │
│  Estimated Total Cost: $425.50                                         │
│                                                                         │
│  [+ Add Custom Material]  [Recalculate]  [Confirm Breakdown]          │
│                                                                         │
│  [Create Purchase Order for Missing Items]                             │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Cost Tracking & Profitability

### Estimated vs Actual Costs

```typescript
interface MaterialCostTracking {
  orderId: string;
  partId: string;

  // Estimated (from breakdown)
  estimatedMaterialCost: number;

  // Actual (after purchase/usage)
  actualPurchaseCost?: number;
  actualUsageQuantity?: Record<string, number>;  // Material ID → qty used
  actualUsageCost?: number;

  // Variance
  costVariance?: number;                // actual - estimated
  costVariancePercent?: number;

  // Profitability
  sellingPrice: number;                 // From invoice
  profit: number;                       // sellingPrice - actualCost
  profitMargin: number;                 // profit / sellingPrice * 100
}
```

---

## Future Database Schema (Outline)

```sql
-- Materials breakdown for each part
CREATE TABLE materials_breakdown (
  id VARCHAR(50) PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL,
  part_id VARCHAR(50) NOT NULL,
  status ENUM('calculated', 'reviewed', 'confirmed', 'reserved'),
  calculated_date TIMESTAMP,
  confirmed_by VARCHAR(50),
  confirmed_date TIMESTAMP,
  total_estimated_cost DECIMAL(10,2),
  total_actual_cost DECIMAL(10,2),
  available_in_inventory BOOLEAN,
  items_needing_purchase INT,
  auto_calculated BOOLEAN,
  notes TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (part_id) REFERENCES order_parts(id)
);

-- Individual material requirements
CREATE TABLE material_requirements (
  id VARCHAR(50) PRIMARY KEY,
  breakdown_id VARCHAR(50) NOT NULL,
  category VARCHAR(50),
  material_type VARCHAR(100),
  specification TEXT,
  quantity_needed DECIMAL(10,2),
  unit VARCHAR(20),
  waste_factor_applied DECIMAL(5,2),
  quantity_with_waste DECIMAL(10,2),
  inventory_item_id VARCHAR(50),
  in_stock BOOLEAN,
  current_stock_level DECIMAL(10,2),
  supplier_id VARCHAR(50),
  supplier_product_code VARCHAR(100),
  estimated_unit_cost DECIMAL(10,2),
  estimated_total_cost DECIMAL(10,2),
  purpose_description TEXT,
  linked_to_sub_item VARCHAR(50),
  is_purchased BOOLEAN,
  is_reserved BOOLEAN,
  purchase_order_id VARCHAR(50),
  FOREIGN KEY (breakdown_id) REFERENCES materials_breakdown(id)
);

-- Manual adjustments audit trail
CREATE TABLE material_adjustments (
  id VARCHAR(50) PRIMARY KEY,
  material_requirement_id VARCHAR(50) NOT NULL,
  adjusted_by VARCHAR(50),
  adjusted_date TIMESTAMP,
  field_name VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  FOREIGN KEY (material_requirement_id) REFERENCES material_requirements(id)
);

-- Material reservations (prevent double-booking)
CREATE TABLE material_reservations (
  id VARCHAR(50) PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL,
  material_requirement_id VARCHAR(50) NOT NULL,
  inventory_item_id VARCHAR(50) NOT NULL,
  quantity_reserved DECIMAL(10,2),
  reserved_date TIMESTAMP,
  expires_date TIMESTAMP,
  released_date TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (material_requirement_id) REFERENCES material_requirements(id)
);
```

---

## Integration Points

### With Job Estimation
- Export format from estimate includes calculation data
- Material mappings can reference estimate line item calculations

### With Vinyl Inventory
- Direct integration with existing `vinyl_inventory` table
- Check stock, reserve, track usage

### With Supply Chain (To Be Rebuilt)
- Generate purchase orders from materials breakdown
- Auto-match suppliers
- Track material costs
- Receive inventory from POs and update stock

### With Progress Tracking
- Material availability can block tasks
- "Materials Confirmed" milestone before production starts

---

## Next Steps (When Ready to Implement)

1. Build material calculation templates for common product types
2. Create materials breakdown database tables
3. Implement auto-calculation on order landing
4. Build materials review UI
5. Integrate with vinyl inventory
6. Build material reservations system
7. Connect to supply chain for purchasing
8. Implement cost tracking and profitability reports

---

**Document Status**: Future Planning - Not Yet Implemented
**Last Updated**: 2025-10-31
**Dependencies**: Nexus_Orders_JobStructure.md, Nexus_SupplyChain.md (to be rebuilt)
**Priority**: Implement after core Orders Page features are complete
