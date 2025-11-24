# Task Generation Specification

**Status:** Design Document
**Priority:** HIGH
**Last Updated:** 2025-11-21
**Related:** `Nexus_Orders_SpecsMapping.md`, `VALIDATION_RULES_SPECIFICATION.md`

---

## Overview

Task generation in the Prepare Order modal uses **Standardized Specs** from order parts to automatically determine production tasks. The system supports auto-generation with manual input fallback for edge cases.

**Integration Flow:**
1. Item Name (specs_display_name) → Specs Mapping → Spec Types generated
2. Spec Types filled with values → Validation ensures completeness
3. Spec Types + Values → **Task Generation** → Production tasks created

---

## Core Concepts

### Part Structure
- A **Part** = Parent part + all its Sub-parts (e.g., Part 2 + 2a, 2b, 2c)
- Parts are identified by `display_number` (e.g., "2", "2a", "2b")
- `is_parent = true` marks the main part row
- `is_parent = false` marks sub-parts (LEDs, Power Supplies, UL, etc.)

### Task Generation Scope
- Tasks are generated per **Part group** (parent + sub-parts together)
- Specs from ALL rows in the Part group are considered
- Task notes auto-populate from relevant spec values

---

## Standardized Spec Templates

These spec templates drive both Validation and Task Generation:

### Construction Specs
| Template | Fields | Task Relevance |
|----------|--------|----------------|
| Return | Colour, Size, Material | Cut & Bend Return, Return Fabrication, Return Gluing |
| Trim | Colour, Material | Cut & Bend Trim, Trim Fabrication |
| Face | Material, Colour | CNC Router Cut (Face) |
| Back | Material | CNC Router Cut (Back) |
| Neon Base | Material, Size | Backer/Raceway tasks |
| Box Material | Material, Size | Box fabrication tasks |

### Graphics/Finishing Specs
| Template | Key Fields | Task Relevance |
|----------|------------|----------------|
| Vinyl | Application, Colour | Vinyl tasks (see Vinyl section) |
| Digital Print | Application, Colour | Same as Vinyl |
| Painting | Timing, Colour | Paint tasks (see Painting section) |

### Assembly Specs
| Template | Key Fields | Task Relevance |
|----------|------------|----------------|
| D-Tape | Thickness | Mounting Hardware task |
| Mounting | Pin Type, Spacer Type | Mounting Hardware task |
| Assembly | Notes | Assembly task |

### Electrical Specs
| Template | Key Fields | Task Relevance |
|----------|------------|----------------|
| LEDs | Type, Colour, Count | LEDs task |
| Power Supply | Type, Count | (Part of LEDs workflow) |
| Wire Length | Length | (Part of LEDs workflow) |
| UL | Required | (Compliance tracking) |

---

## Order-Wide Tasks (Tracked via Order Status)

These tasks are tracked at the **order level** via the `orders.status` field, NOT as individual part tasks:

| Order Status | Description | Equivalent Old Task |
|--------------|-------------|---------------------|
| `pending_production_files_creation` | Design files being created | Design Files |
| `pending_production_files_approval` | Design files awaiting approval | Design Approval |
| `qc_packing` | Quality control and packing phase | QC & Packing |

**Why order-wide?** These tasks apply to the entire order, not individual parts. Tracking them as part-specific tasks created unnecessary duplication (8 parts = 24 redundant tasks).

---

## Part-Specific Tasks

The following tasks are generated per **Part group** (parent + sub-parts) based on specifications:

---

## Product-Type Specific Rules

### Front Lit Channel Letters

**Specs Mapping generates:** Return, Trim, Face, Drain Holes

#### Component-Based Tasks

| Spec Present | Tasks Generated | Roles | Auto-Note Sources |
|--------------|-----------------|-------|-------------------|
| **Return** | Cut & Bend Return | Cut & Bender Operator | Size from Return spec |
| | Return Fabrication | Return Fabricator | Colour from Return spec |
| | Return Gluing | Return Gluer | Vinyl wrap/paint if applicable |
| **Trim** | Cut & Bend Trim | Cut & Bender Operator | Colour from Trim spec |
| | Trim Fabrication | Trim Fabricator | Vinyl wrap/paint if applicable |
| **Face** | CNC Router Cut (Face) | CNC Router Operator | Material, Colour from Face spec |
| **Back** | CNC Router Cut (Back) | CNC Router Operator | Material from Back spec |

**Note:** Face and Back generate **separate** CNC Router Cut tasks.

---

## Spec-Driven Conditional Tasks

These tasks are added based on specs present in the Part group (parent + sub-parts):

### LEDs
**Condition:** Part group has LEDs sub-part OR LEDs spec template

| Task | Role |
|------|------|
| LEDs | LED Installer |

---

### Painting
**Condition:** Part has Painting spec template
**Determining Field:** `Timing` value in Painting spec

| Timing Value | Task Generated | Role |
|--------------|----------------|------|
| Before Cutting | Paint before cutting | Painter |
| After Cutting | Paint After Cutting | Painter |
| After Bending | Paint After Bending | Painter |
| After Fabrication | Paint after Fabrication | Painter |

**Auto-Note:** Colour from Painting spec

---

### Vinyl Application
**Condition:** Part has Vinyl spec template
**Determining Field:** `Application` value in Vinyl spec

| Application Value | Tasks Generated | Roles | Auto-Note |
|-------------------|-----------------|-------|-----------|
| Face, Full | Vinyl Face Before Cutting | Vinyl Applicator | Colour |
| Face, White Keyline | Vinyl Plotting, Vinyl Face After Cutting | Designer, Vinyl Applicator | Colour |
| Face, Custom Cut | Vinyl Plotting, Vinyl Face After Cutting | Designer, Vinyl Applicator | Colour |
| Return Wrap | Vinyl Plotting, Vinyl Wrap Return/Trim | Designer, Vinyl Applicator | Colour |
| Trim Wrap | Vinyl Plotting, Vinyl Wrap Return/Trim | Designer, Vinyl Applicator | Colour |
| Return & Trim Wrap | Vinyl Plotting, Vinyl Wrap Return/Trim | Designer, Vinyl Applicator | Colour |
| Face & Return Wrap | **MANUAL INPUT REQUIRED** | - | Colour |

---

### Digital Print
**Condition:** Part has Digital Print spec template
**Note:** Uses identical logic to Vinyl Application

| Application Value | Tasks Generated | Roles | Auto-Note |
|-------------------|-----------------|-------|-----------|
| Face, Full | Vinyl Face Before Cutting | Vinyl Applicator | Colour |
| Face, White Keyline | Vinyl Plotting, Vinyl Face After Cutting | Designer, Vinyl Applicator | Colour |
| Face, Custom Cut | Vinyl Plotting, Vinyl Face After Cutting | Designer, Vinyl Applicator | Colour |
| Return Wrap | Vinyl Plotting, Vinyl Wrap Return/Trim | Designer, Vinyl Applicator | Colour |
| Trim Wrap | Vinyl Plotting, Vinyl Wrap Return/Trim | Designer, Vinyl Applicator | Colour |
| Return & Trim Wrap | Vinyl Plotting, Vinyl Wrap Return/Trim | Designer, Vinyl Applicator | Colour |
| Face & Return Wrap | **MANUAL INPUT REQUIRED** | - | Colour |

---

### Mounting Hardware (from Mounting spec)
**Condition:** Part has Mounting spec template

| Task | Role | Auto-Note |
|------|------|-----------|
| Mounting Hardware | Mounting Assembler | Pin Type, Spacer Type |

---

### Mounting Hardware (from D-Tape spec)
**Condition:** Part has D-Tape spec template

| Task | Role | Auto-Note |
|------|------|-----------|
| Mounting Hardware | Mounting Assembler | Tape Thickness |

**Note:** If BOTH Mounting AND D-Tape specs exist, TWO Mounting Hardware tasks are created.

---

## Manual Input Triggers

The system prompts for manual input when:

1. **Vinyl/Digital Print Application = "Face & Return Wrap"**
   - Reason: Uncommon for Front Lit, needs verification
   - User must confirm or adjust task selection

2. **Unrecognized spec values**
   - System alerts user to review and manually add tasks

3. **Missing required specs**
   - System highlights missing data before task generation

---

## Task Generation Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ User clicks "Generate Tasks" in Prepare Order modal                │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 1. Load all parts in Part group (parent + sub-parts)               │
│    - Query order_parts WHERE order_id = X                          │
│    - Group by display_number base (e.g., "2", "2a", "2b" → "2")    │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. Collect ALL specs from Part group                               │
│    - Parse specifications JSON from each part                       │
│    - Merge into unified spec list                                   │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. Add COMPONENT TASKS based on spec presence                      │
│    - Return spec? → Cut & Bend Return, Return Fabrication,         │
│                     Return Gluing                                   │
│    - Trim spec? → Cut & Bend Trim, Trim Fabrication                │
│    - Face spec? → CNC Router Cut (Face)                            │
│    - Back spec? → CNC Router Cut (Back)                            │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. Add CONDITIONAL TASKS based on spec VALUES                      │
│    - LEDs spec/sub-part? → LEDs task                               │
│    - Painting spec? → Check Timing → Add paint task                │
│    - Vinyl spec? → Check Application → Add vinyl task(s)           │
│    - Digital Print? → Same as Vinyl                                │
│    - Mounting? → Mounting Hardware task                            │
│    - D-Tape? → Mounting Hardware task (can be 2nd one)             │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. Check for MANUAL INPUT triggers                                 │
│    - Face & Return Wrap application?                               │
│    - Unrecognized values?                                          │
│    → If found: Show modal for user confirmation                    │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 6. Populate task NOTES from spec values                            │
│    - Return tasks: Colour, Size from Return spec                   │
│    - Face task: Material, Colour from Face spec                    │
│    - Vinyl tasks: Colour from Vinyl spec                           │
│    - etc.                                                          │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 7. Save tasks to order_tasks table                                 │
│    - part_id = parent part's part_id                               │
│    - notes = auto-generated from specs                             │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Note: Order-wide tasks (Design, Approval, QC) tracked via          │
│       order status, not as individual part tasks                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Role Reference

| Role ID | Display Name |
|---------|--------------|
| designer | Designer |
| manager | Manager |
| vinyl_applicator | Vinyl Applicator |
| cnc_router_operator | CNC Router Operator |
| cut_bender_operator | Cut & Bender Operator |
| return_fabricator | Return Fabricator |
| trim_fabricator | Trim Fabricator |
| painter | Painter |
| return_gluer | Return Gluer |
| mounting_assembler | Mounting Assembler |
| face_assembler | Face Assembler |
| led_installer | LED Installer |
| backer_raceway_fabricator | Backer/Raceway Fabricator |
| backer_raceway_assembler | Backer/Raceway Assembler |
| qc_packer | Quality Control/Packer |

---

## Task Reference

**Note:** Order-wide tasks (Design Files, Design Approval, QC & Packing) are tracked via order status and are NOT generated as part tasks.

| Task Name | Default Role |
|-----------|--------------|
| Vinyl Plotting | designer |
| Sanding (320) before cutting | painter |
| Scuffing before cutting | painter |
| Paint before cutting | painter |
| Vinyl Face Before Cutting | vinyl_applicator |
| Vinyl Wrap Return/Trim | vinyl_applicator |
| CNC Router Cut | cnc_router_operator |
| Laser Cut | manager |
| Cut & Bend Return | cut_bender_operator |
| Cut & Bend Trim | cut_bender_operator |
| Sanding (320) after cutting | painter |
| Scuffing after cutting | painter |
| Paint After Cutting | painter |
| Backer/Raceway Bending | backer_raceway_fabricator |
| Paint After Bending | painter |
| Vinyl Face After Cutting | vinyl_applicator |
| Trim Fabrication | trim_fabricator |
| Return Fabrication | return_fabricator |
| Return Gluing | return_gluer |
| Mounting Hardware | mounting_assembler |
| Face Assembling | face_assembler |
| LEDs | led_installer |
| Backer/Raceway Fabrication | backer_raceway_fabricator |
| Vinyl after Fabrication | vinyl_applicator |
| Paint after Fabrication | painter |
| Assembly | backer_raceway_assembler |

---

## Data Model

### Spec Structure (from order_parts.specifications JSON)

```typescript
interface PartSpecifications {
  specs: StandardizedSpec[];
}

interface StandardizedSpec {
  template_name: string;  // e.g., "Return", "Vinyl", "Painting"

  // Common fields (vary by template):
  colour?: string;
  material?: string;
  size?: string;
  application?: string;   // For Vinyl/Digital Print
  timing?: string;        // For Painting
  pin_type?: string;      // For Mounting
  spacer_type?: string;   // For Mounting
  thickness?: string;     // For D-Tape
  // ... other template-specific fields
}
```

### Generated Task Structure

```typescript
interface GeneratedTask {
  task_name: string;
  assigned_role: ProductionRole;
  notes: string | null;           // Auto-populated from specs
  part_id: number;                // Links to parent part
  order_id: number;
  requires_manual_input?: boolean; // Flag for user review
}
```

---

## Specs Mapping Reference

From `Nexus_Orders_SpecsMapping.md`:

| Item Name | Generated Spec Types | Default Values |
|-----------|---------------------|----------------|
| Front Lit | Return, Trim, Face, Back, Drain Holes | Back: 2mm ACM |
| Halo Lit | Return, Face, Back, Mounting, Drain Holes | Back: 2mm White PC |
| Front Lit Acrylic Face | Return, Face, Back, Drain Holes | Back: 2mm ACM |
| Dual Lit - Single Layer | Return, Trim, Face, Back, Drain Holes | Back: 2mm White PC |
| Dual Lit - Double Layer | Return, Trim, Face, Back, Drain Holes | Back: 2mm White PC |
| Vinyl | Vinyl | - |
| LEDs | LEDs, Wire Length | - |
| Power Supplies | Power Supply | - |
| UL | UL | - |
| Blade Sign | Return, Trim, Face, Back | Back: 2mm ACM |
| Marquee Bulb | Return, Face, Back | Back: 2mm ACM |
| Material Cut | Return, Trim, Face, Back | Back: 2mm ACM |
| Return | Return, Back, Drain Holes | Back: 2mm ACM |
| Trim Cap | Trim, Face | Face: 2mm PC White |
| Backer | Material, Cutting, Assembly | - |
| Push Thru | Box Material, Acrylic | - |
| Substrate Cut | Material, Cutting, Mounting, D-Tape | - |
| Painting | Painting | - |

---

## Future Product Types

This document currently specifies **Front Lit** channel letters. Additional product types will follow the same pattern:

- [ ] Reverse Lit / Halo Lit Channel Letters
- [ ] Push Thru Channel Letters
- [ ] Dual Lit Channel Letters
- [ ] Open Face Channel Letters
- [ ] Neon Channel Letters
- [ ] Dimensional Letters
- [ ] ACM Panels
- [ ] Cabinet Signs
- [ ] Monument Signs
- [ ] Blade Signs

Each product type will have its own component-based task rules.

---

## Implementation Notes

1. **Spec Template Detection**: Check `template_name` field in each spec to identify type
2. **Note Generation**: Concatenate relevant spec values into concise task notes
3. **Manual Input UI**: When required, show modal with:
   - The detected issue (e.g., "Face & Return Wrap needs clarification")
   - Suggested tasks
   - Option to add/remove/modify tasks before saving
4. **Validation Integration**: Run validation BEFORE task generation to ensure all required spec fields are filled

---

**Document Status:** Design Complete
**Next Step:** Implementation in `taskGenerationService.ts`
