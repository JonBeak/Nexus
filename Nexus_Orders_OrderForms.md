# Order Forms Specification - Simplified Phase 1

## Overview

Four types of order forms generated as PDFs, all created simultaneously when order is created or updated.

## General Specifications

- **Paper Size:** Letter (8.5" x 11")
- **Orientation:** Landscape
- **Branding:** Simple title only (no logo required)
- **Format:** Standard for all customers
- **Generation:** Auto-generated at order creation, manually regeneratable

## Form Types & Content

### 1. Master Order Form (Internal Reference)

**Purpose:** Complete internal reference document

**Contains:**
- Header:
  - Title: "Order Form"
  - Order Number: 200000 (incremental)
  - Order Name: [Customer project name]
  - Customer: [Company name]
  - PO Number: [If provided]
  - Point Person Email: [Customer email]
  - Order Date: [Creation date]
  - Due Date: [Target completion]

- Manufacturing Preferences:
  - Customer Manufacturing Preferences: [From customers.special_instructions]
  - Internal Notes: [From customers.comments]

- Job Information (per part):
  - Product Type: [e.g., "Channel Letters - Front Lit"]
  - Quantity: [Number and unit]
  - Specifications: [Dynamic fields based on product_type]
  - Production Notes: [Per-part custom notes]
  - Sign Image: [As large/clear as possible]

- Footer:
  - Overall Production Notes: [For whole job]
  - Shipping: [Yes/No indicator]

**Excludes:** Task progress, pricing/invoicing, timeline/audit trail

### 2. Shop Order Form (Production Instructions)

**Purpose:** Production floor reference

**Contains:** Same as Master Order Form

**Excludes:**
- Customer company name
- PO Number
- Point Person Email
- Internal Notes (from customers.comments)

### 3. Customer Order Form (Customer Confirmation)

**Purpose:** Customer approval and reference

**Contains:** Same as Master Order Form

**Excludes:**
- Due Date
- Point Person Email
- Internal Notes (from customers.comments)

**Special Changes:**
- LED counts shown as "Yes/No" instead of specific quantities
- Power supply counts shown as "Yes/No" instead of specific quantities

### 4. Packing List

**Purpose:** QC checklist and packing guide

**Contains:**
- Header:
  - Title: "Packing List"
  - Order Number: 200000
  - Order Name: [Customer project name]
  - Customer: [Company name only, no address]

- Per Product Type:
  - Product Type name and quantity
  - Packing checklist (auto-generated from template):
    ```
    □ [Item 1 description] _________
    □ [Item 2 description] _________
    □ [Item 3 description] _________
    ```
  - Items not needed shown as: `☐̶ [Item] No` (grayed out)
  - Production notes for this part
  - Sign image

- Color Coding:
  - **Yellow background:** Shipping orders
  - **Blue background:** Pickup orders
  - Applied to checklist items and borders

**Note:** Checkboxes are actually text fields allowing written notes

## Form Versioning

### Version Management

1. **Initial Generation:**
   - Version 1 auto-generated when order created
   - Editable until customer confirmation

2. **After Customer Confirmation:**
   - Manager chooses when updating:
     - [Update Current Version] - Overwrites existing files
     - [Create New Version] - Archives current, creates new

3. **Version Indication:**
   - Version 1: No suffix
   - Version 2+: "- v2" suffix added to Order Number on form
   - Background color changes to indicate new version
   - Version number stored in database, not in filename

4. **Archive Strategy:**
   - Old versions stored in order_form_versions table
   - Accessible for download/reference
   - Path: `/mnt/signfiles/orders/{orderNumber}/archive/v{version}/`

## Phase 1 Implementation Notes

- Forms will be simplified for initial launch
- Essential data only, can enhance formatting later
- All 4 forms generated simultaneously
- Manager can manually trigger regeneration
- Sign images uploaded via SMB mount (path TBD)

## Example Packing Checklist Templates

**Note: These are placeholders and not accurate. Actual items will be defined per product type.**

```typescript
// TEMPORARY - Phase 1 hard-coded example
const packingTemplates = {
  'channel_letters': [
    'Letter faces with vinyl',
    'Returns assembled',
    'LED modules (if applicable)',
    'Power supply (if applicable)',
    'Mounting hardware',
    'Installation template'
  ]
  // Actual templates TBD
};
```

---

**Document Status**: Phase 1 Simplified Specification
**Last Updated**: 2025-11-03
**Dependencies**: Nexus_Orders_JobStructure.md, Nexus_Orders_ProductTypeTemplates.md
