# Painting Tasks Matrix - 3D Structure

**Purpose:** Defines which painting-related tasks are auto-generated based on Item Name (Product Type), Component, and Painting Timing
**Status:** Design Document (For Future Implementation)
**Last Updated:** 2025-11-24
**Related:** `Nexus_Orders_TaskGeneration.md`, `Nexus_Orders_SpecsMapping.md`

---

## Task Legend

| # | Task Name | Role | When Used |
|---|-----------|------|-----------|
| 1 | Sanding (320) before cutting | painter | Surface prep before CNC/laser cutting (metal surfaces) |
| 2 | Scuffing before cutting | painter | Surface prep before cutting (plastic/acrylic surfaces) |
| 3 | Paint before cutting | painter | Paint applied before cutting (full sheet) |
| 4 | Sanding (320) after cutting | painter | Surface prep after cutting (metal surfaces) |
| 5 | Scuffing after cutting | painter | Surface prep after cutting (plastic/acrylic surfaces) |
| 6 | Paint After Cutting | painter | Paint applied after CNC/laser cutting |
| 7 | Paint After Bending | painter | Paint applied after return/trim bending |
| 8 | Paint after Fabrication | painter | Paint applied after full assembly |

---

## Component Options

Based on `frontend/web/src/config/specificationConstants.ts`:

- **Face** - Front face of the part
- **Return** - Side return of the part
- **Trim** - Trim cap component
- **Return & Trim** - Combined return and trim painting
- **Face & Return** - Combined face and return painting
- **Frame** - Frame component
- **All Sides** - All sides of the part

---

## Timing Field Values

The Painting spec template has a `Timing` field with these options:
- **Before Cutting** - Paint is applied before CNC/laser operations
- **After Cutting** - Paint is applied after CNC/laser cutting
- **After Bending** - Paint is applied after cut & bend operations
- **After Fabrication** - Paint is applied at the end of fabrication

---

## Product Type × Component × Timing Matrices

### Front Lit

| Component | Before Cutting | After Cutting | After Bending | After Fabrication |
|-----------|----------------|---------------|---------------|-------------------|
| Face | 2,3 | 2,6 | - | - |
| Return | 2,3 | - | - | 2,8 |
| Trim | 2,3 | - | - | 2,8 |
| Return & Trim | 2,3 | - | - | 2,8 |
| Face & Return | 2,3 | 2,3,6 | - | 2,8 |
| Frame | - | - | - | - |
| All Sides | - | - | - | - |

---

### Halo Lit

| Component | Before Cutting | After Cutting | After Bending | After Fabrication |
|-----------|----------------|---------------|---------------|-------------------|
| Face | 2,3 | 1,6 | - | 1,8 |
| Return | 2,3 | - | - | - |
| Trim | - | - | - | - |
| Return & Trim | - | - | - | - |
| Face & Return | 2,3 | 1,2,3,6 | - | 1,8 |
| Frame | - | - | - | - |
| All Sides | - | - | - | - |

---

### Front Lit Acrylic Face

| Component | Before Cutting | After Cutting | After Bending | After Fabrication |
|-----------|----------------|---------------|---------------|-------------------|
| Face | - | - | - | - |
| Return | 2,3 | - | - | 1,8 |
| Trim | - | - | - | - |
| Return & Trim | - | - | - | - |
| Face & Return | - | - | - | - |
| Frame | - | - | - | - |
| All Sides | - | - | - | - |

---

### Dual Lit - Single Layer

**Same as Front Lit for all components and timings.**

| Component | Before Cutting | After Cutting | After Bending | After Fabrication |
|-----------|----------------|---------------|---------------|-------------------|
| Face | 2,3 | 2,6 | - | - |
| Return | 2,3 | - | - | 2,8 |
| Trim | 2,3 | - | - | 2,8 |
| Return & Trim | 2,3 | - | - | 2,8 |
| Face & Return | 2,3 | 2,3,6 | - | 2,8 |
| Frame | - | - | - | - |
| All Sides | - | - | - | - |

---

### Dual Lit - Double Layer

**Same as Front Lit for all components and timings.**

| Component | Before Cutting | After Cutting | After Bending | After Fabrication |
|-----------|----------------|---------------|---------------|-------------------|
| Face | 2,3 | 2,6 | - | - |
| Return | 2,3 | - | - | 2,8 |
| Trim | 2,3 | - | - | 2,8 |
| Return & Trim | 2,3 | - | - | 2,8 |
| Face & Return | 2,3 | 2,3,6 | - | 2,8 |
| Frame | - | - | - | - |
| All Sides | - | - | - | - |

---

### Blade Sign

| Component | Before Cutting | After Cutting | After Bending | After Fabrication |
|-----------|----------------|---------------|---------------|-------------------|
| Face | 2,3 | 2,6 | - | - |
| Return | 2,3 | - | - | - |
| Trim | 2,3 | - | - | - |
| Return & Trim | 2,3 | - | - | - |
| Face & Return | 2,3 | - | - | 2,8 |
| Frame | - | - | - | 8 |
| All Sides | 2,3 | 2,6 | - | 2,8 |

---

### Marquee Bulb

| Component | Before Cutting | After Cutting | After Bending | After Fabrication |
|-----------|----------------|---------------|---------------|-------------------|
| Face | 2,3 | 2,6 | - | - |
| Return | 2,3 | - | - | 2,8 |
| Trim | - | - | - | - |
| Return & Trim | - | - | - | - |
| Face & Return | 2,3 | - | - | 2,8 |
| Frame | - | - | - | - |
| All Sides | 2,3 | - | - | 2,8 |

---

### Material Cut

| Component | Before Cutting | After Cutting | After Bending | After Fabrication |
|-----------|----------------|---------------|---------------|-------------------|
| Face | 2,3 | 5,6 | - | - |
| Return | 2,3 | - | - | - |
| Trim | 2,3 | - | - | - |
| Return & Trim | 2,3 | - | - | - |
| Face & Return | 2,3 | 2,3,5,6 | - | - |
| Frame | - | - | - | - |
| All Sides | 2,3 | - | - | - |

---

### Substrate Cut

**Material-Dependent Matrix**

This product has different task requirements based on the material type specified in the Face or Return spec.

#### Substrate Cut - ACM / Aluminum Material

| Component | Before Cutting | After Cutting | After Bending | After Fabrication |
|-----------|----------------|---------------|---------------|-------------------|
| Face | 2,3 | 2,6 | 1,8 | 1,8 |
| Return | - | - | - | - |
| Trim | - | - | - | - |
| Return & Trim | - | - | - | - |
| Face & Return | - | 1,6 | 2,6 | 2,8 |
| Frame | - | - | - | - |
| All Sides | - | 4,6 | 4,7 | 4,8 |

#### Substrate Cut - Acrylic / PVC Material

| Component | Before Cutting | After Cutting | After Bending | After Fabrication |
|-----------|----------------|---------------|---------------|-------------------|
| Face | 3 | 6 | - | 8 |
| Return | - | 6 | - | 8 |
| Trim | - | - | - | - |
| Return & Trim | - | - | - | - |
| Face & Return | - | 6 | - | 8 |
| Frame | - | - | - | - |
| All Sides | - | 6 | 7 | 8 |

---

### Return

| Component | Before Cutting | After Cutting | After Bending | After Fabrication |
|-----------|----------------|---------------|---------------|-------------------|
| Face | 2,3 | 2,6 | - | 2,8 |
| Return | 2,3 | - | - | 2,8 |
| Trim | - | - | - | - |
| Return & Trim | - | - | - | - |
| Face & Return | 2,3 | 2,3,6 | - | 2,8 |
| Frame | - | - | - | - |
| All Sides | 2,3 | 2,6 | - | 2,8 |

---

### Trim Cap

| Component | Before Cutting | After Cutting | After Bending | After Fabrication |
|-----------|----------------|---------------|---------------|-------------------|
| Face | 2,3 | 2,6 | - | 2,8 |
| Return | - | - | - | - |
| Trim | 2,3 | - | - | 2,8 |
| Return & Trim | - | - | - | - |
| Face & Return | 2,3 | 2,6 | - | 2,8 |
| Frame | - | - | - | - |
| All Sides | 2,3 | 2,6 | - | 2,8 |

---

### 3D Print

| Component | Before Cutting | After Cutting | After Bending | After Fabrication |
|-----------|----------------|---------------|---------------|-------------------|
| Face | 3 | 6 | - | - |
| Return | - | - | - | 8 |
| Trim | - | - | - | - |
| Return & Trim | - | - | - | - |
| Face & Return | 3 | 6 | - | 8 |
| Frame | - | - | - | - |
| All Sides | - | - | - | 8 |

---

### Backer

**Material-Dependent Matrix**

This product has different task requirements based on the backer type:
- **ACM Backer** - Flat ACM backer (no folding)
- **Folded Backers** - ACM Folded Backer or Aluminum Backer (both involve bending)

#### Backer - ACM Backer (Flat)

| Component | Before Cutting | After Cutting | After Bending | After Fabrication |
|-----------|----------------|---------------|---------------|-------------------|
| Face | 2,3 | 2,6 | 2,7 | 2,8 |
| Return | 1,3 | 4,6 | - | 4,8 |
| Trim | - | - | - | - |
| Return & Trim | - | - | - | - |
| Face & Return | 1,2,3 | 2,4,6 | - | 4,8 |
| Frame | - | - | - | - |
| All Sides | 1,2,3 | 2,4,6 | - | 4,8 |

#### Backer - Folded Backers (ACM Folded / Aluminum)

| Component | Before Cutting | After Cutting | After Bending | After Fabrication |
|-----------|----------------|---------------|---------------|-------------------|
| Face | 2,3 | 2,6 | 2,7 | 2,8 |
| Return | 2,3 | - | 2,7 | 2,8 |
| Trim | - | - | - | - |
| Return & Trim | - | - | - | - |
| Face & Return | 2,3 | - | 5,7 | 5,8 |
| Frame | - | - | - | - |
| All Sides | 2,3 | - | 5,7 | 5,8 |

---

### Frame

| Component | Before Cutting | After Cutting | After Bending | After Fabrication |
|-----------|----------------|---------------|---------------|-------------------|
| Face | 1,3 | 4,6 | - | 4,8 |
| Return | 1,3 | 4,6 | - | 4,8 |
| Trim | - | - | - | - |
| Return & Trim | - | - | - | - |
| Face & Return | 1,3 | 4,6 | - | 4,8 |
| Frame | 1,3 | 4,6 | - | 4,8 |
| All Sides | 1,3 | 4,6 | - | 4,8 |

---

### Aluminum Raceway

| Component | Before Cutting | After Cutting | After Bending | After Fabrication |
|-----------|----------------|---------------|---------------|-------------------|
| Face | 2,3 | 5,6 | 5,7 | 5,8 |
| Return | 2,3 | 5,6 | 5,7 | 5,8 |
| Trim | - | - | - | - |
| Return & Trim | - | - | - | - |
| Face & Return | 2,3 | 5,6 | 5,7 | 5,8 |
| Frame | - | - | - | - |
| All Sides | 2,3 | 5,6 | 5,7 | 5,8 |

---

### Extrusion Raceway

**Same as Aluminum Raceway for all components and timings.**

| Component | Before Cutting | After Cutting | After Bending | After Fabrication |
|-----------|----------------|---------------|---------------|-------------------|
| Face | 2,3 | 5,6 | 5,7 | 5,8 |
| Return | 2,3 | 5,6 | 5,7 | 5,8 |
| Trim | - | - | - | - |
| Return & Trim | - | - | - | - |
| Face & Return | 2,3 | 5,6 | 5,7 | 5,8 |
| Frame | - | - | - | - |
| All Sides | 2,3 | 5,6 | 5,7 | 5,8 |

---

### Push Thru

| Component | Before Cutting | After Cutting | After Bending | After Fabrication |
|-----------|----------------|---------------|---------------|-------------------|
| Face | 2,3 | 5,6 | 5,7 | 5,8 |
| Return | 1,3 | 4,6 | 4,7 | 4,8 |
| Trim | - | - | - | - |
| Return & Trim | - | - | - | - |
| Face & Return | 1,3 | 4,6 | 4,7 | 4,8 |
| Frame | - | - | - | - |
| All Sides | 1,3 | 4,6 | 4,7 | 4,8 |

---

### Knockout Box

**Same as Push Thru for all components and timings.**

| Component | Before Cutting | After Cutting | After Bending | After Fabrication |
|-----------|----------------|---------------|---------------|-------------------|
| Face | 2,3 | 5,6 | 5,7 | 5,8 |
| Return | 1,3 | 4,6 | 4,7 | 4,8 |
| Trim | - | - | - | - |
| Return & Trim | - | - | - | - |
| Face & Return | 1,3 | 4,6 | 4,7 | 4,8 |
| Frame | - | - | - | - |
| All Sides | 1,3 | 4,6 | 4,7 | 4,8 |

---

### Neon LED

| Component | Before Cutting | After Cutting | After Bending | After Fabrication |
|-----------|----------------|---------------|---------------|-------------------|
| Face | 3 | 6 | - | - |
| Return | - | 6 | - | - |
| Trim | - | - | - | - |
| Return & Trim | - | - | - | - |
| Face & Return | - | 6 | - | - |
| Frame | - | - | - | - |
| All Sides | - | 6 | - | - |

---

### Painting

**Note:** This is the standalone "Painting" item type. All components return no tasks (handled separately).

| Component | Before Cutting | After Cutting | After Bending | After Fabrication |
|-----------|----------------|---------------|---------------|-------------------|
| Face | - | - | - | - |
| Return | - | - | - | - |
| Trim | - | - | - | - |
| Return & Trim | - | - | - | - |
| Face & Return | - | - | - | - |
| Frame | - | - | - | - |
| All Sides | - | - | - | - |

---

## Sub-Part Items (No Painting)

The following item types have no painting tasks:

| Item Name | Notes |
|-----------|-------|
| Vinyl | Sub-part - no painting tasks |
| LEDs | Sub-part - no painting tasks |
| Power Supplies | Sub-part - no painting tasks |
| Extra Wire | Sub-part - no painting tasks |
| UL | Sub-part - no painting tasks |
| Vinyl Cut | Graphics item - no painting tasks |

---

## Implementation Notes

### Material Detection Logic

For products with material-dependent tasks (**Substrate Cut** and **Backer**), the system must:

1. Check the Face or Return spec for material information
2. Determine if the material is:
   - **Metal** (ACM, Aluminum) → Use sanding tasks (1, 4)
   - **Plastic** (Acrylic, PVC) → Use scuffing tasks (2, 5) or no prep
3. Apply the appropriate task matrix based on material type

```typescript
// Material detection pseudocode
function getMaterialCategory(spec: Spec): 'metal' | 'plastic' {
  const material = spec.values.material?.toLowerCase() || '';

  if (material.includes('acm') ||
      material.includes('aluminum') ||
      material.includes('metal')) {
    return 'metal';
  }

  if (material.includes('acrylic') ||
      material.includes('pvc') ||
      material.includes('plastic')) {
    return 'plastic';
  }

  return 'metal'; // Default to metal if unknown
}
```

### Backer Type Detection

For **Backer** products, detect the backer type:

```typescript
function getBackerType(itemName: string): 'flat' | 'folded' {
  const normalized = itemName.toLowerCase();

  if (normalized.includes('folded') ||
      normalized.includes('aluminum backer')) {
    return 'folded';
  }

  return 'flat'; // ACM Backer (default)
}
```

### Task Generation Logic

```typescript
function generatePaintingTasks(orderId: number, partId: number, group: SpecGroup) {
  const paintingSpec = findSpec(group, 'Painting');
  if (!paintingSpec || !paintingSpec.values.component || !paintingSpec.values.timing) {
    return [];
  }

  const itemName = group.itemName;
  const component = paintingSpec.values.component;
  const timing = paintingSpec.values.timing;
  const colour = paintingSpec.values.colour;

  // Get material category if needed
  let materialCategory: 'metal' | 'plastic' | null = null;
  if (itemName === 'Substrate Cut') {
    const faceSpec = findSpec(group, 'Face');
    materialCategory = faceSpec ? getMaterialCategory(faceSpec) : 'metal';
  }

  // Get backer type if needed
  let backerType: 'flat' | 'folded' | null = null;
  if (itemName === 'Backer') {
    backerType = getBackerType(itemName);
  }

  // Look up tasks from matrix
  const taskNumbers = lookupTasksFromMatrix(
    itemName,
    component,
    timing,
    materialCategory,
    backerType
  );

  // Convert task numbers to task objects
  return taskNumbers.map(taskNum => {
    const taskName = TASK_LEGEND[taskNum];
    return {
      taskName,
      assignedRole: 'painter',
      notes: colour ? `Colour: ${colour}` : null,
      partId,
      orderId
    };
  });
}
```

### Sanding vs Scuffing

**Task Selection Rules:**
- **Sanding (320 grit)** (Tasks 1, 4) - Used for aluminum and metal surfaces
- **Scuffing** (Tasks 2, 5) - Used for plastic/acrylic surfaces
- Selection based on material type from Face/Return spec, not Timing field

---

## TASK_ROLE_MAP Updates Required

Add to `/backend/web/src/services/taskGeneration/taskRules.ts`:

```typescript
const TASK_ROLE_MAP: Record<string, ProductionRole> = {
  // ... existing mappings ...

  // Painting tasks
  'Sanding (320) before cutting': 'painter',
  'Scuffing before cutting': 'painter',
  'Paint before cutting': 'painter',
  'Sanding (320) after cutting': 'painter',
  'Scuffing after cutting': 'painter',
  'Paint After Cutting': 'painter',
  'Paint After Bending': 'painter',
  'Paint after Fabrication': 'painter',
};
```

---

## User Workflow: Painting Task Configuration Modal

### When Modal Appears

The Painting Task Configuration Modal appears **during Order Finalization**, after the user clicks the **"Generate Tasks"** button.

**Trigger Conditions:**
- User has completed Order Preparation with specs
- At least one part has a Painting spec (component, timing, colour filled)
- User clicks "Generate Tasks" to finalize the order

**Modal Flow:**
1. System generates all standard tasks (cutting, bending, fabrication, QC)
2. System detects parts with Painting specs
3. **For each part with a Painting spec:** Modal opens (required interaction)
4. User must review and confirm/customize painting tasks
5. Once all painting task modals are completed, order is finalized

### Modal Behavior

#### Scenario A: Matrix Returns Tasks

When the combination (Item + Component + Timing) has defined tasks in the matrix:

**Modal Shows:**
- Part information (name, ID, item type, quantity)
- Painting specification (component, timing, colour)
- ✅ **Auto-generated tasks** (pre-checked checkboxes)
- All available painting tasks (checkboxes for adding more)
- Custom notes field
- **[Cancel Order]** and **[Confirm Tasks →]** buttons

**User Can:**
- ✅ Accept auto-generated tasks as-is (just click Confirm)
- ✅ **Remove** auto-generated tasks (uncheck them)
- ✅ **Add** additional custom tasks (check more boxes)
- ✅ **Edit** the task selection completely
- ✅ Add custom notes for special instructions
- ❌ Cannot proceed without at least 1 task selected

**Example:**
```
Auto-Generated Tasks:
☑ Scuffing before cutting         ← Can uncheck to remove
☑ Paint before cutting             ← Can uncheck to remove

Add Additional Tasks:
☐ Sanding (320) before cutting     ← Can check to add
☐ Paint After Cutting              ← Can check to add
```

---

#### Scenario B: Matrix Returns "-" (No Tasks)

When the combination (Item + Component + Timing) has **no defined tasks** in the matrix:

**Modal Shows:**
- Part information (name, ID, item type, quantity)
- Painting specification (component, timing, colour)
- ⚠️ **Warning banner** explaining no standard tasks exist
- All available painting tasks (unchecked checkboxes)
- Custom notes field
- **[Cancel Order]** and **[Confirm Tasks →]** buttons

**User Can:**
- ✅ Select custom tasks manually (required - must pick at least 1)
- ✅ Add custom notes for context
- ❌ Cannot proceed without selecting at least 1 task

**Example:**
```
⚠️  NO STANDARD TASKS FOR THIS CONFIGURATION

The selected combination (Halo Lit + Trim + After Fabrication)
does not have standard painting tasks defined. Please select
custom tasks below.

Select Required Tasks:
☐ Sanding (320) before cutting     ← Must select at least 1
☐ Scuffing before cutting
☐ Paint before cutting
...
```

---

### Multi-Part Orders

If multiple parts have Painting specs, handle **sequentially**:

```
🎨 Configure Painting Tasks - Part 1 of 3
[Letter "A" - Front Lit (Face)]
[User confirms tasks]
→

🎨 Configure Painting Tasks - Part 2 of 3
[Letter "B" - Halo Lit (Return)]
[User confirms tasks]
→

🎨 Configure Painting Tasks - Part 3 of 3
[Letter "C" - Blade Sign (All Sides)]
[User confirms tasks]
→

✅ All painting tasks configured
[Finalize Order]
```

---

### Validation Rules

**Before Opening Modal:**
1. **Painting spec exists** - Part must have a Painting spec
2. **Component field filled** - Must specify which component to paint
3. **Timing field filled** - Must specify when to paint
4. **Colour field filled** - Required for task notes

**During Modal Interaction:**
5. **At least 1 task selected** - User cannot confirm with zero tasks
6. **Task compatibility** - Warn if incompatible tasks selected (e.g., "Sanding before cutting" + "Scuffing before cutting")

**After Confirmation:**
7. **Task creation** - Create order_part_tasks records for selected tasks
8. **Task notes** - Populate task notes with colour and custom notes
9. **Task assignment** - Assign all painting tasks to 'painter' role

---

### Available Task Options in Modal

All 8 painting tasks should be available as checkboxes:

**Surface Preparation:**
- ☐ Sanding (320) before cutting
- ☐ Scuffing before cutting
- ☐ Sanding (320) after cutting
- ☐ Scuffing after cutting

**Paint Application:**
- ☐ Paint before cutting
- ☐ Paint After Cutting
- ☐ Paint After Bending
- ☐ Paint after Fabrication

**Note:** System may pre-check tasks based on matrix, but user has full control to modify the selection.

---

## Implementation Notes - Modal Component

### Component Location
`/frontend/web/src/components/orders/preparation/PaintingTaskModal.tsx`

### Key Requirements

1. **Required Interaction** - Modal cannot be dismissed/skipped
2. **Full Editing Control** - User can add, remove, edit any task selection
3. **Clear Visual Distinction** - Different UI for auto-generated vs manual selection scenarios
4. **Part Context** - Show complete part information for informed decisions
5. **Sequential Processing** - Handle one part at a time for multi-part orders
6. **Validation** - Prevent confirmation with zero tasks selected
7. **Integration** - Called from Order Preparation after "Generate Tasks" button

### Data Flow

```typescript
// When "Generate Tasks" clicked:
1. Generate standard tasks (cutting, bending, etc.)
2. For each part with painting spec:
   a. Query matrix for auto-tasks
   b. Open modal with:
      - Part details
      - Painting spec
      - Auto-generated task list (or empty if "-")
      - All available task checkboxes
   c. Wait for user confirmation
   d. Create selected tasks in order_part_tasks
3. Continue to next part or finalize order
```

### Modal Props Interface

```typescript
interface PaintingTaskModalProps {
  partId: number;
  partName: string;
  itemType: string;
  quantity: number;
  paintingSpec: {
    component: string;
    timing: string;
    colour: string;
  };
  autoGeneratedTasks: string[]; // Task names from matrix
  availableTasks: string[]; // All 8 painting tasks
  currentPartIndex: number;
  totalParts: number;
  onConfirm: (selectedTasks: string[], customNotes?: string) => void;
  onCancel: () => void;
}
```

---

## Future Features

### Future Feature A: Matrix Customization (Manager+ Only)

**Description:** Allow power users (Manager+ role) to customize the painting task matrix rules via UI instead of code changes.

**Use Case:**
- Business rules change (e.g., "We now sand all Halo Lit faces before cutting")
- Regional variations (different facilities have different processes)
- Customer-specific requirements (premium customers get extra prep)

**Implementation Concept:**
```
┌────────────────────────────────────────────────────────┐
│  ⚙️  Painting Task Matrix Configuration                │
├────────────────────────────────────────────────────────┤
│                                                         │
│  Item Type: [Front Lit ▼]                              │
│  Component: [Face ▼]                                   │
│  Timing: [Before Cutting ▼]                            │
│                                                         │
│  Current Configuration:                                │
│  ☑ Scuffing before cutting                             │
│  ☑ Paint before cutting                                │
│                                                         │
│  [Edit Configuration]                                  │
│                                                         │
│  History:                                              │
│  • Modified by John Smith on 2025-11-20                │
│  • Original: "2,3" → Current: "1,2,3"                  │
│                                                         │
└────────────────────────────────────────────────────────┘
```

**Database Schema:**
```sql
CREATE TABLE painting_task_matrix_overrides (
  override_id INT PRIMARY KEY AUTO_INCREMENT,
  item_type VARCHAR(100) NOT NULL,
  component VARCHAR(50) NOT NULL,
  timing VARCHAR(50) NOT NULL,
  task_list TEXT NOT NULL, -- JSON array of task names
  modified_by INT NOT NULL,
  modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  FOREIGN KEY (modified_by) REFERENCES users(user_id),
  UNIQUE KEY (item_type, component, timing)
);
```

**Benefits:**
- No code deployments needed for business rule changes
- Audit trail of who changed what and when
- Can revert to defaults if needed
- Facility-specific or customer-specific rules

---

### Future Feature B: Task Pattern Learning & Suggestions

**Description:** System learns from custom task selections and suggests them for similar scenarios in the future.

**Use Case:**
- Last 5 orders for "Halo Lit + Trim + After Fabrication" all added "Scuffing after cutting"
- System suggests this task next time this combination appears
- User can accept suggestion or modify

**Implementation Concept:**
```
┌────────────────────────────────────────────────────────┐
│  🎨 Configure Painting Tasks                           │
├────────────────────────────────────────────────────────┤
│                                                         │
│  💡 Suggested Based on Previous Orders:                │
│                                                         │
│  Users typically add these tasks for this              │
│  configuration (Halo Lit + Trim + After Fabrication):  │
│                                                         │
│  ☐ Scuffing after cutting (added in 5/5 recent orders) │
│  ☐ Paint After Cutting (added in 3/5 recent orders)    │
│                                                         │
│  [Apply Suggestions]  [Ignore]                         │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  Auto-Generated Tasks:                                 │
│  (none - manual selection required)                    │
│  ...                                                   │
└────────────────────────────────────────────────────────┘
```

**Database Schema:**
```sql
CREATE TABLE painting_task_patterns (
  pattern_id INT PRIMARY KEY AUTO_INCREMENT,
  item_type VARCHAR(100) NOT NULL,
  component VARCHAR(50) NOT NULL,
  timing VARCHAR(50) NOT NULL,
  custom_task VARCHAR(100) NOT NULL,
  frequency INT DEFAULT 1, -- How many times this combination was used
  last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY (item_type, component, timing)
);

-- Track each time a custom task is added
INSERT INTO painting_task_patterns
  (item_type, component, timing, custom_task)
VALUES
  ('Halo Lit', 'Trim', 'After Fabrication', 'Scuffing after cutting')
ON DUPLICATE KEY UPDATE
  frequency = frequency + 1,
  last_used = CURRENT_TIMESTAMP;
```

**Suggestion Algorithm:**
```typescript
// When modal opens, check for patterns
const patterns = await query(`
  SELECT custom_task, frequency
  FROM painting_task_patterns
  WHERE item_type = ? AND component = ? AND timing = ?
  AND frequency >= 3
  ORDER BY frequency DESC, last_used DESC
  LIMIT 5
`, [itemType, component, timing]);

if (patterns.length > 0) {
  showSuggestionBanner(patterns);
}
```

**Benefits:**
- Reduces manual work for common exceptions
- Learns from user behavior over time
- Improves consistency across orders
- Optional - user can always ignore suggestions

---

## Open Questions

1. **Multiple painting specs per part:** Can a single part have multiple Painting specs for different components? (e.g., Face painted before cutting, Return painted after fabrication)
   - **Answer:** Currently one Painting spec per part. If multiple components need different timing, create multiple parts or use "Face & Return" component with After Fabrication timing.

2. **Material field location:** For material-dependent products, should we always check Face spec first, then Return spec if Face is missing?
   - **Answer:** Check Face first, fallback to Return if Face not present, default to 'metal' if neither exists.

3. **Primer vs Paint:** Should primer application be tracked as separate tasks, or combined with paint tasks?
   - **Answer:** Combined for now. Primer is implicit in "Paint" tasks. Can add explicit primer tasks in future if needed.

4. **Task dependencies:** Should painting tasks have dependencies on cutting/bending/fabrication tasks?
   - **Answer:** Future enhancement. For now, task order is logical (tasks sorted by timing) but not enforced with hard dependencies.

---

**Document Status:** Design Complete with User Workflow Specified
**Next Step:** Implement painting task generation + PaintingTaskModal component
**Implementation Priority:** Phase 1 (Core matrix + modal), Phase 2 (Future features A & B)
