# Orders Page - Job Structure & Data Model

## Purpose
Define the detailed structure of the **Master Order Object** and how orders, parts, tasks, and related entities are organized and related.

---

## Core Entities Hierarchy

```
ORDER (Master Object)
│
├── Order Metadata
│   ├── Identifiers & References
│   ├── Customer Information
│   ├── Dates & Deadlines
│   └── Workflow Status
│
├── PARTS (1 to many)
│   ├── Part Metadata
│   ├── Specifications
│   ├── Sub-Items (vinyl, painting, etc.)
│   ├── Materials Breakdown
│   └── Tasks (generated from template)
│
├── Progress Tracking
│   ├── Overall Progress
│   └── Role-Based Task Lists
│
├── Invoice Data
│   ├── Line Items (from parts)
│   ├── Custom Additions
│   └── Payment Status
│
├── Materials Breakdown (Future)
│   ├── Calculated Requirements
│   └── Supply Chain Links
│
└── Timeline & Audit
    ├── Customer Communications
    ├── Approvals & Changes
    └── Modification History
```

---

## Detailed TypeScript Interfaces

### 1. Master Order Object

```typescript
interface Order {
  // === IDENTIFIERS ===
  order_id: number;                    // INT UNSIGNED AUTO_INCREMENT PRIMARY KEY
  order_number: number;                // INT UNSIGNED - Sequential starting at 200000
  version_number: number;              // INT - Order version for tracking major changes
  order_name: string;                  // Customer project name (from estimate or manual)
  estimateId: number;                  // FK to estimates table
  linkedEstimateID: number;            // Link from Order to Estimate
  jobNumber?: string;                  // Customer's job reference number
  poNumber?: string;                   // Customer's PO reference number

  // === CUSTOMER ===
  customerId: string;                  // FK to customers table
  customerName: string;                // Denormalized for performance
  billingAddressId: string;
  shippingAddressId: string;
  pointPerson: string[];               // Array of point person names
  pointPersonEmail: string[];          // Array of point person emails

  // === WORKFLOW STATUS ===
  kanbanStage: KanbanStage;            // Phase 1: Simple dropdown, Phase 3: Visual board
  overallStatus: OrderStatus;
  priority: 'low' | 'normal' | 'high' | 'urgent';

  // === DATES ===
  createdDate: Date;
  dueDate: Date;
  estimatedStartDate?: Date;           // When production should begin
  actualStartDate?: Date;              // When production actually began
  completedDate?: Date;
  lastModifiedDate: Date;

  // === USERS ===
  createdBy: string;                   // User ID
  lastModifiedBy: string;

  // === PARTS (Core structure) ===
  parts: OrderPart[];

  // === PROGRESS ===
  progressSummary: {
    overallPercent: number;            // 0-100, calculated from tasks
    completedTasks: number;
    totalTasks: number;
  };

  // === NOTES & FILES ===
  production_notes?: string;           // Custom notes for whole job
  sign_image_path?: string;            // SMB path to uploaded preview
  customer_po?: string;

  // === FORM MANAGEMENT ===
  form_version: number;                // Current form version (1, 2, 3...)

  // === INVOICE ===
  invoiceId?: string;                  // FK to invoices table
  invoiceStatus: 'draft' | 'sent' | 'partially_paid' | 'paid';
  totalAmount: number;                 // Taken from invoiceID via QuickBooks API

  // === DELIVERY ===
  deliveryMethod: 'shipping' | 'pickup';
  trackingNumber?: string;
  estimatedShippingCost?: number;      // From estimate data
  estimatedTransitDays?: number;       // From estimate data
  actualShippingCost?: number;         // Set by QC & Packing role or Manager
  actualTransitDays?: number;          // Set by QC & Packing role or Manager

  // === FLAGS ===
  isOverdue: boolean;                  // Calculated: dueDate < now && !completed
  hasUnresolvedIssues: boolean;        // Flagged for manager attention

  // === METADATA ===
  version: number;                     // Incremented on major changes
  tags?: string[];                     // For filtering/categorization
  notes?: string;                      // General order notes
}
```

### 2. Order Part (Component)

This represents a distinct component of the job (e.g., "Channel Letters w/ LEDs", "ACM Backer").

```typescript
interface OrderPart {
  part_id: number;                     // INT UNSIGNED AUTO_INCREMENT PRIMARY KEY
  order_id: number;                    // FK to orders
  partNumber: number;                  // 1, 2, 3... for ordering

  // === BASIC INFO ===
  title: string;                       // "Channel Letters w/ LEDs, PS, UL"
  description?: string;                // Detailed specs
  quantity: number;                    // How many of this part

  // === PRODUCT INFORMATION (Dual-field approach) ===
  product_type: string;                // Human-readable: "Channel Letter - 3\" Front Lit"
  product_type_id: string;             // Machine-readable: "channel_letters_3_front_lit"

  // === SOURCE REFERENCES (One should be populated) ===
  channel_letter_type_id?: number;     // FK to channel_letter_types if applicable
  base_product_type_id?: number;       // FK to product_types if not channel letter

  // === SPECIFICATIONS (JSON column or separate table) ===
  specifications: PartSpecifications;

  // === TASKS (Auto-generated from template) ===
  tasks: PartTask[];                   // Role-based tasks for this part

  // === MATERIALS (Future) ===
  materialRequirements?: MaterialRequirement[];

  // === PROGRESS ===
  status: 'pending' | 'in_design' | 'in_production' | 'completed';
  percentComplete: number;             // 0-100, calculated from tasks

  // === FINANCIAL ===
  subtotal: number;                    // From estimate or manually adjusted

  // === NOTES ===
  production_notes?: string;           // Custom notes for this part

  // === METADATA ===
  createdDate: Date;
}
```

### 3. Part Specifications

Flexible structure to accommodate different product types.

```typescript
interface PartSpecifications {
  productType: ProductType;            // 'channel_letters', 'flat_cut_letters', etc. (Note: Changed from 'style')

  // === MATERIALS ===
  faceMaterial?: string;               // 'Acrylic', 'Aluminum', etc.
  returnMaterial?: string;
  backerMaterial?: string;
  substrateMaterial?: string;
  backingReinforcementMaterial?: string;

  // === COLORS ===
  faceVinylColor?: string;
  facePaintColor?: string;
  returnVinylColor?: string;
  returnPaintColor?: string;
  backingVinylColor?: string;
  backingPaintColor?: string;
  backerBoxVinylColor?: string;
  backerBoxPaintColor?: string;
  substrateVinylColor?: string;
  substratePaintColor?: string;

  // === LIGHTING ===
  hasLighting: boolean;
  lightingType?: 'front_lit' | 'back_lit' | 'edge_lit' | 'LED_neon' | string;  // Can be combination
  ledType?: string;                    // FK to LEDs database (includes color)
  ledCount?: number;
  hasPowerSupply: boolean;
  powerSupplyType?: string[];          // Array, can be multiple FK to power_supplies database
  powerSupplyCount?: number[];         // Array matching with Type
  powerSupplyAssembled?: boolean;      // true = we install, false = remote/provide separately
  powerSupplyLocation?: string;        // If assembled=true, installation details
  ulListed?: boolean;

  // === MOUNTING ===
  mountingHardware?: 'studs' | 'double_tape' | 'stand_offs';
  includesHardware?: boolean;

  // === DESIGN ===
  designFileUrl?: string;              // Can we open explorer through web app?

  // === CUSTOM FIELDS (Extensible) ===
  customFields?: Record<string, any>;
}
```

### 4. Part Task

Role-based tasks that need completion for each part.

```typescript
interface PartTask {
  task_id: number;                     // INT UNSIGNED AUTO_INCREMENT PRIMARY KEY
  part_id: number;                     // FK to order_parts
  order_id: number;                    // FK for easy querying

  // === TASK DEFINITION ===
  role: ProductionRole;                // Designer, Vinyl/CNC, etc.
  taskName: string;                    // "Cut vinyl faces"
  description?: string;

  // === SEQUENCING ===
  sequenceOrder: number;               // Order within role
  dependencies: string[];              // Task IDs that must complete first

  // === STATUS ===
  status: 'pending' | 'available' | 'in_progress' | 'completed' | 'blocked';
  isAvailable: boolean;                // Dependencies met

  // === TIMING ===
  dueDate?: Date;                      // Calculated suggested due date (from templates)
  estimatedDuration?: number;          // Minutes (for future Gantt predictions)

  // === COMPLETION TRACKING ===
  startedAt?: Date;                    // Optional: when user started the task
  completedAt?: Date;                  // Required when status='completed' - this is the END time
  actualDuration?: number;             // Optional: minutes (can be calculated or manually entered)
  completedBy?: string;                // User ID
  notes?: string;

  // === METADATA ===
  isAutogenerated: boolean;            // From template vs manually added
  createdDate: Date;
}
```

---

## Enums & Types

### Kanban Stages

```typescript
enum KanbanStage {
  INITIATED = 'initiated',                               // Order created, being built
  PENDING_CONFIRMATION = 'pending_confirmation',         // Details sent to customer
  PENDING_PRODUCTION_FILES_CREATION = 'pending_production_files_creation', // Ready for design/production files
  PENDING_PRODUCTION_FILES_APPROVAL = 'pending_production_files_approval', // Production files sent to manager
  PRODUCTION_QUEUE = 'production_queue',                 // Files approved, ready to make
  IN_PRODUCTION = 'in_production',                       // Actively being fabricated
  ON_HOLD = 'on_hold',                                   // Customer put order on hold
  OVERDUE = 'overdue',                                   // Past due date, not complete
  QC_PACKING = 'qc_packing',                            // Final checkup and packing
  SHIPPING = 'shipping',                                 // Ready for shipping or in transit
  PICK_UP = 'pick_up',                                  // Ready for customer pickup
  AWAITING_PAYMENT = 'awaiting_payment',                // Delivered, invoice open
  COMPLETED = 'completed',                               // Fully done and paid
  CANCELLED = 'cancelled',                               // Order cancelled
}
```

### Production Roles

```typescript
enum ProductionRole {
  DESIGNER = 'designer',
  VINYL_CNC = 'vinyl_cnc',
  CUT_AND_BEND = 'cut_bend',
  TRIM_FABRICATION = 'trim_fabrication',
  RETURN_FABRICATION = 'return_fabrication',
  RETURN_GLUING = 'return_gluing',
  PAINTING = 'painting',
  LEDS = 'leds',
  PINS_DTAPE_GLUING = 'pins_dtape_gluing',
  BACKERS = 'backers',
  PACKING = 'packing',
}
```

### Product Types

**NOTE**: Product types use a dual-field approach:
- **product_type** (string): Human-readable display name loaded from database
  - For Channel Letters: Use `channel_letter_types.type_name` (e.g., "Channel Letter - 3\" Front Lit")
  - For other products: Use `product_types.product_type_name` (e.g., "ACM Panel", "Flat Cut Letters")
- **product_type_id** (string): Machine-readable identifier for template matching
  - For Channel Letters: e.g., "channel_letters_3_front_lit"
  - For other products: e.g., "acm_panel", "flat_cut_letters"

```typescript
// Product type identifiers are strings, not enums (loaded dynamically)
// Examples:
type ProductTypeId =
  | 'channel_letters_3_front_lit'
  | 'channel_letters_4_front_lit'
  | 'channel_letters_reverse_lit'
  | 'flat_cut_letters'
  | 'acm_panel'
  | 'aluminum_panel'
  | 'backer'
  | 'monument_sign'
  | 'pylon_sign'
  | 'vinyl_graphics'
  | 'cabinet_sign'
  | 'post_panel'
  | 'dimensional_letters'
  | string;  // Allow custom types
```

### Order Status

```typescript
enum OrderStatus {
  ACTIVE = 'active',           // Currently being worked on
  OVERDUE = 'overdue',         // Past due date
  ON_HOLD = 'on_hold',         // Paused for some reason
  COMPLETED = 'completed',     // Finished
  CANCELLED = 'cancelled',     // Cancelled
}
```

---

## Example: Complete Order Structure

```json
{
  "id": "ord_abc123",
  "orderNumber": 200431,
  "estimateId": "est_xyz789",
  "customerId": "cust_001",
  "customerName": "ABC Sign Company",
  "kanbanStage": "in_production",
  "overallStatus": "active",
  "priority": "high",
  "dueDate": "2025-11-15T00:00:00Z",
  "createdDate": "2025-10-31T10:00:00Z",
  "createdBy": "user_jon",
  "projectManager": "user_jon",

  "parts": [
    {
      "id": "part_001",
      "orderId": "ord_abc123",
      "partNumber": 1,
      "title": "Channel Letters 'OPEN' w/ LEDs, PS, UL",
      "description": "4 letters: O-P-E-N, white acrylic faces, black returns",
      "quantity": 1,

      "specifications": {
        "productType": "channel_letters",
        "dimensions": {
          "height": 24,
          "depth": 4,
          "unit": "inches"
        },
        "faceMaterial": "White Acrylic 1/8\"",
        "returnMaterial": "Aluminum",
        "returnColor": "Black",
        "hasLighting": true,
        "lightingType": "LED_modules",
        "ledColor": "White 6500K",
        "powerSupplyIncluded": true,
        "ulListed": true,
        "mountingMethod": "studs",
        "requiresVinyl": true,
        "text": "OPEN"
      },

      "subItems": [
        {
          "id": "sub_001",
          "type": "vinyl",
          "description": "Red 3M vinyl on faces",
          "vinylProductId": "vinyl_123",
          "colorCode": "3M-100-13"
        }
      ],

      "tasks": [
        {
          "id": "task_001",
          "role": "designer",
          "taskName": "Create vector files for OPEN letters",
          "status": "completed",
          "sequenceOrder": 1,
          "completedBy": "user_designer1",
          "completedDate": "2025-11-01T14:30:00Z"
        },
        {
          "id": "task_002",
          "role": "vinyl_cnc",
          "taskName": "Cut red vinyl for letter faces",
          "status": "in_progress",
          "sequenceOrder": 1,
          "dependencies": ["task_001"]
        },
        {
          "id": "task_003",
          "role": "cut_bend",
          "taskName": "Fabricate aluminum returns",
          "status": "available",
          "sequenceOrder": 1,
          "dependencies": ["task_001"]
        }
        // ... more tasks
      ],

      "status": "in_progress",
      "percentComplete": 35,
      "subtotal": 2450.00
    },

    {
      "id": "part_002",
      "partNumber": 2,
      "title": "ACM Backer Panel",
      "description": "Black ACM panel, painted edges",
      "quantity": 1,

      "specifications": {
        "productType": "acm_panel",
        "dimensions": {
          "height": 36,
          "width": 60,
          "thickness": 0.125,
          "unit": "inches"
        },
        "faceMaterial": "Black ACM",
        "requiresPainting": true,
        "paintColor": "Black",
        "mountingMethod": "direct_mount"
      },

      "subItems": [
        {
          "id": "sub_002",
          "type": "painting",
          "description": "Paint edges black"
        }
      ],

      "tasks": [
        {
          "id": "task_010",
          "role": "designer",
          "taskName": "Create cutting template for backer",
          "status": "completed",
          "sequenceOrder": 1
        },
        {
          "id": "task_011",
          "role": "vinyl_cnc",
          "taskName": "CNC cut ACM panel",
          "status": "pending",
          "sequenceOrder": 1,
          "dependencies": ["task_010"]
        },
        {
          "id": "task_012",
          "role": "painting",
          "taskName": "Paint panel edges black",
          "status": "pending",
          "sequenceOrder": 2,
          "dependencies": ["task_011"]
        }
      ],

      "status": "pending",
      "percentComplete": 10,
      "subtotal": 450.00
    }
  ],

  "progressSummary": {
    "overallPercent": 28,
    "completedTasks": 2,
    "totalTasks": 15
  },

  "invoiceId": "inv_001",
  "invoiceStatus": "draft",
  "totalAmount": 2900.00,

  "deliveryMethod": "shipping",
  "isOverdue": false,
  "needsCustomerResponse": false,
  "version": 3
}
```

---

## Data Flow Examples

### 1. Estimate → Order Conversion

```
ESTIMATE
├── Line Item 1: "24\" Channel Letters (OPEN)"
│   └── calculationData: { letters: 4, height: 24, ... }
├── Line Item 2: "LED Installation"
└── Line Item 3: "Power Supply & UL Listing"

                    ↓ CONVERSION ↓

ORDER
└── Part 1: "Channel Letters 'OPEN' w/ LEDs, PS, UL"
    ├── estimateLineItems: [item_1, item_2, item_3]
    ├── specifications: { extracted from calculationData }
    └── tasks: [auto-generated from template]
```

### 2. Task Completion → Progress Update

```
User completes task →
  Update task.status = 'completed' →
    Recalculate part.percentComplete →
      Update dependent tasks (isAvailable = true) →
        Recalculate order.progressSummary.overallPercent →
          Check if stage should advance (e.g., all design tasks done)
```

### 3. Part Modification → Invoice Update

```
Manager edits part specifications →
  part.version++ →
    Timeline event logged →
      Invoice line item marked for review →
        Invoice.totalAmount recalculated →
          Notification to customer (if already sent)
```

---

## Template System for Task Generation

### Template Structure

```typescript
interface ProductTemplate {
  productType: ProductType;

  // Conditional task lists based on specifications
  taskRules: TaskGenerationRule[];
}

interface TaskGenerationRule {
  condition: (specs: PartSpecifications) => boolean;
  tasks: TemplateTask[];
}

interface TemplateTask {
  role: ProductionRole;
  taskName: string;
  description?: string;
  sequenceOrder: number;
  dependencies?: string[];  // Reference to other tasks in template
  estimatedDuration?: number;
}
```

### Example: Channel Letters Template

```typescript
const channelLettersTemplate: ProductTemplate = {
  productType: 'channel_letters',

  taskRules: [
    // Always required
    {
      condition: () => true,
      tasks: [
        { role: 'designer', taskName: 'Create vector files', sequenceOrder: 1 },
        { role: 'designer', taskName: 'Create proof for customer', sequenceOrder: 2 },
        { role: 'cut_bend', taskName: 'Fabricate returns', sequenceOrder: 1, dependencies: ['designer_1'] },
      ]
    },

    // If has vinyl
    {
      condition: (specs) => specs.requiresVinyl === true,
      tasks: [
        { role: 'vinyl_cnc', taskName: 'Cut vinyl for faces', sequenceOrder: 1, dependencies: ['designer_1'] },
        { role: 'pins_dtape_gluing', taskName: 'Apply vinyl to faces', sequenceOrder: 1, dependencies: ['vinyl_cnc_1'] },
      ]
    },

    // If has LEDs
    {
      condition: (specs) => specs.hasLighting === true,
      tasks: [
        { role: 'leds', taskName: 'Install LED modules', sequenceOrder: 1, dependencies: ['return_gluing_1'] },
        { role: 'leds', taskName: 'Test lighting and wiring', sequenceOrder: 2, dependencies: ['leds_1'] },
      ]
    },

    // Always last
    {
      condition: () => true,
      tasks: [
        { role: 'packing', taskName: 'Final QC and pack for shipping', sequenceOrder: 99, dependencies: ['all_previous'] },
      ]
    }
  ]
};
```

---

## Database Considerations

### Relational vs JSON Storage

| Data | Storage Method | Reasoning |
|------|----------------|-----------|
| Order core fields | Relational columns | Queryable, indexed, relational integrity |
| Part specifications | JSON column | Flexible schema per product type |
| Task list | Relational table | Queryable for progress views |
| Timeline events | Relational table | Auditing, filtering, chronological queries |
| Invoice line items | Relational table | Financial reporting, QuickBooks export |
| Materials breakdown | Relational table | Supply chain queries, inventory checks |

### Indexing Strategy
- `orders.orderNumber` (unique)
- `orders.customerId` + `orders.dueDate` (customer orders view)
- `orders.kanbanStage` + `orders.dueDate` (Kanban queries)
- `order_parts.orderId` (join optimization)
- `order_tasks.orderId` + `order_tasks.role` (progress tracking)
- `order_tasks.status` + `order_tasks.dueDate` (landing dashboard)

---

## Next Steps

1. ✅ Define overall structure (this document)
2. Create database schema with migrations → `Nexus_Orders_DatabaseSchema.md`
3. Design template system for auto-task generation
4. Plan estimate → order conversion algorithm
5. Design progress calculation logic
6. Map part specifications to materials requirements (for future integration)

---

**Document Status**: Initial Planning - Complete
**Last Updated**: 2025-10-31
**Dependencies**: Nexus_OrdersPage_Overview.md
