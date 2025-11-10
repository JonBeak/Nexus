# Phase 1 Implementation Guide - Orders Page

## Overview

Phase 1 focuses on core order management functionality with minimal complexity. This guide outlines the implementation approach for the essential features needed to convert estimates to orders and manage them through production.

## Implementation Strategy

### Core Principle: Simple & Functional

- Hard-coded templates and configurations (migrate to database in Phase 3)
- Manual processes where automation is complex (automate in Phase 2+)
- Leverage existing systems (QuickBooks integration, customer fields)
- Focus on data structure and core workflows

## Phase 1 Scope

### INCLUDED in Phase 1

1. **Estimate to Order Conversion**
   - Convert approved estimates to orders
   - Capture order metadata (name, PO number, due date)
   - Generate order forms (4 types: Master, Shop, Customer, Packing List)
   - Sequential order numbering starting at 200000

2. **Order Management Dashboard**
   - View all active orders
   - Filter and search orders
   - Quick status updates
   - Basic order details view

3. **Progress Tracking (Simplified)**
   - Status dropdown with 14 predefined statuses (including awaiting_payment, completed)
   - Manual status updates by manager (no automatic invoice tracking)
   - Task lists (hard-coded templates by product type)
   - Manual task completion tracking
   - Production notes per order and per part

4. **Jobs Table**
   - Comprehensive table view of all orders
   - Sortable, filterable columns
   - Export to CSV
   - Batch status updates

### Phase 1.5 Additions (COMPLETED)

**Enhanced Order Creation:**
- Business days calculation with holiday awareness
- Customer contact management (customer_contacts table)
- Hard due date/time support
- Auto-calculated due dates from customer defaults
- Manual override detection and warnings
- Only ApproveEstimateModal exists (no edit/delete/clone modals - inline editing used)

**Database Enhancements:**
- customer_job_number field added to orders table
- hard_due_date_time field added (DATETIME with time component)
- point_person_email linked to customer_contacts
- finalized_at, finalized_by, modified_after_finalization fields
- display_number and is_parent fields in order_parts

### DEFERRED to Later Phases

- **Phase 2:** Invoice system, payment tracking, automated QuickBooks sync, Gmail integration, email notifications
- **Phase 3:** Visual Kanban board, database-driven templates, create order from scratch
- **Phase 4+:** Materials calculation, real-time inventory updates, advanced analytics

## Database Implementation

### New Tables Required

```sql
-- Core orders table
CREATE TABLE orders (
  order_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_number INT UNSIGNED NOT NULL UNIQUE COMMENT 'Sequential starting at 200000',
  version_number INT DEFAULT 1 COMMENT 'Order version for tracking major changes',
  order_name VARCHAR(255) NOT NULL,
  estimate_id INT UNSIGNED,
  customer_id INT UNSIGNED NOT NULL,
  customer_po VARCHAR(100),
  point_person_email VARCHAR(255),
  order_date DATE NOT NULL,
  due_date DATE,
  customer_job_number VARCHAR(100) COMMENT 'Customer''s internal job reference',
  hard_due_date_time DATETIME COMMENT 'Hard deadline with time component',
  production_notes TEXT,
  manufacturing_note TEXT COMMENT 'Manufacturing-specific notes',
  internal_note TEXT COMMENT 'Internal notes not visible on forms',
  finalized_at TIMESTAMP NULL COMMENT 'When order was finalized',
  finalized_by INT UNSIGNED COMMENT 'Who finalized the order',
  modified_after_finalization BOOLEAN DEFAULT false COMMENT 'Flag if modified post-finalization',
  sign_image_path VARCHAR(500),
  form_version TINYINT UNSIGNED DEFAULT 1,
  shipping_required BOOLEAN DEFAULT false,
  status ENUM(
    'job_details_setup',
    'pending_confirmation',
    'pending_production_files_creation',
    'pending_production_files_approval',
    'production_queue',
    'in_production',
    'on_hold',
    'overdue',
    'qc_packing',
    'shipping',
    'pick_up',
    'awaiting_payment',
    'completed',
    'cancelled'
  ) DEFAULT 'job_details_setup',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED,
  FOREIGN KEY (estimate_id) REFERENCES estimates(estimate_id),
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
  FOREIGN KEY (created_by) REFERENCES employees(employee_id),
  INDEX idx_order_number (order_number),
  INDEX idx_customer (customer_id),
  INDEX idx_status (status)
);

-- Order parts (products/jobs in the order)
CREATE TABLE order_parts (
  part_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  part_number TINYINT UNSIGNED NOT NULL,
  display_number VARCHAR(10) COMMENT 'Display number like "1", "1a", "1b" for hierarchy',
  is_parent BOOLEAN DEFAULT false COMMENT 'Whether this is a parent row with children',

  -- Dual-field approach for product types
  product_type VARCHAR(100) NOT NULL COMMENT 'Human-readable: "Channel Letter - 3\" Front Lit"',
  product_type_id VARCHAR(100) NOT NULL COMMENT 'Machine-readable: "channel_letters_3_front_lit"',

  -- Source references (one should be populated)
  channel_letter_type_id INT UNSIGNED COMMENT 'FK to channel_letter_types if applicable',
  base_product_type_id INT UNSIGNED COMMENT 'FK to product_types if not channel letter',

  quantity DECIMAL(10,2) NOT NULL,
  specifications JSON,
  production_notes TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (channel_letter_type_id) REFERENCES channel_letter_types(type_id) ON DELETE SET NULL,
  FOREIGN KEY (base_product_type_id) REFERENCES product_types(product_type_id) ON DELETE SET NULL,
  INDEX idx_order (order_id),
  INDEX idx_product_type (product_type_id)
);

-- Task tracking
CREATE TABLE order_tasks (
  task_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  part_id INT UNSIGNED,
  task_name VARCHAR(255) NOT NULL,
  task_order TINYINT UNSIGNED NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP NULL,
  completed_by INT UNSIGNED,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (part_id) REFERENCES order_parts(part_id) ON DELETE CASCADE,
  FOREIGN KEY (completed_by) REFERENCES employees(employee_id),
  INDEX idx_order (order_id),
  INDEX idx_part (part_id)
);

-- Form versioning
CREATE TABLE order_form_versions (
  version_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  version_number TINYINT UNSIGNED NOT NULL,
  master_form_path VARCHAR(500),
  shop_form_path VARCHAR(500),
  customer_form_path VARCHAR(500),
  packing_list_path VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES employees(employee_id),
  UNIQUE KEY unique_version (order_id, version_number)
);

-- Status history for audit trail
CREATE TABLE order_status_history (
  history_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  status VARCHAR(50) NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  changed_by INT UNSIGNED,
  notes TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES employees(employee_id),
  INDEX idx_order (order_id)
);

-- Customer contacts (added in Phase 1.5)
CREATE TABLE customer_contacts (
  contact_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id INT UNSIGNED NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(50),
  contact_role VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES employees(employee_id),
  FOREIGN KEY (updated_by) REFERENCES employees(employee_id),
  INDEX idx_customer (customer_id),
  INDEX idx_email (contact_email),
  INDEX idx_active (is_active)
);
```

### Existing Table Modifications

```sql
-- Add production_roles to employees table
ALTER TABLE employees
ADD COLUMN production_roles JSON
COMMENT 'Array of production roles: ["designer", "vinyl_cnc", "painting", "cut_bend", "leds", "packing"]';

-- Example production_roles data:
-- {"roles": ["designer"]}
-- {"roles": ["vinyl_cnc", "cut_bend", "painting"]}
-- {"roles": ["designer", "vinyl_cnc", "leds", "packing"]}
```

**Phase 1 Note**: In Phase 1, there is NO assigned_designer field. All designers can see and work on all orders. The `production_roles` field is populated but not enforced for filtering. Phase 4+ may add designer assignment functionality with an assigned_designer field and role-based task filtering.

## Backend Implementation

### File Structure

```
/backend/web/src/
├── routes/
│   └── orders.ts                    # Order management routes
├── controllers/
│   ├── orderController.ts           # Order CRUD operations
│   ├── orderConversionController.ts # Estimate → Order conversion
│   └── orderFormController.ts       # PDF form generation
├── services/
│   ├── orderService.ts              # Business logic
│   ├── orderTaskService.ts          # Task generation & tracking
│   └── pdfGenerationService.ts      # PDF creation
└── types/
    └── orders.ts                    # TypeScript interfaces
```

### Key Endpoints

```typescript
// Order Management
POST   /api/orders/convert-estimate      // Convert estimate to order
GET    /api/orders                       // List all orders
GET    /api/orders/:orderId              // Get order details
PUT    /api/orders/:orderId              // Update order
DELETE /api/orders/:orderId              // Delete order (pre-confirmation only)

// Order Forms
POST   /api/orders/:orderId/forms        // Generate/regenerate forms
GET    /api/orders/:orderId/forms        // Download form PDFs

// Progress Tracking
GET    /api/orders/:orderId/tasks        // Get task list
PUT    /api/orders/:orderId/tasks/:taskId // Update task status
PUT    /api/orders/:orderId/status       // Update order status

// Order Parts
GET    /api/orders/:orderId/parts        // Get all parts
PUT    /api/orders/:orderId/parts/:partId // Update part details

// Phase 1.5 Additions
GET    /api/orders/validate-name            // Validate order name uniqueness
GET    /api/orders/by-estimate/:estimateId  // Get order by estimate ID
POST   /api/orders/calculate-due-date       // Calculate due date from turnaround days
POST   /api/orders/calculate-business-days  // Calculate business days between dates
GET    /api/customers/:id/contacts/emails   // Get customer contact emails
POST   /api/customers/:id/contacts          // Create new contact
```

### Estimate Conversion Logic

```typescript
// Pseudo-code for conversion process
async function convertEstimateToOrder(estimateId: number, orderData: {
  orderName: string;
  customerPo?: string;
  dueDate?: string;
  pointPersonEmail?: string;
}) {
  // 1. Fetch estimate data
  const estimate = await getEstimate(estimateId);

  // 2. Get next order number (simple increment, starting at 200000)
  const orderNumber = await getNextOrderNumber(); // SELECT MAX(order_number) + 1 (or 200000 if none)

  // 3. Create order record
  const order = await createOrder({
    order_number: orderNumber,
    version_number: 1,
    order_name: orderData.orderName,
    estimate_id: estimateId,
    customer_id: estimate.customer_id,
    customer_po: orderData.customerPo,
    point_person_email: orderData.pointPersonEmail,
    order_date: new Date(),
    due_date: orderData.dueDate,
    status: 'job_details_setup'
  });

  // 4. Copy estimate jobs to order_parts with dual product_type approach
  for (const job of estimate.jobs) {
    // Determine if this is a channel letter or other product type
    const isChannelLetter = job.product_type_id.startsWith('channel_letters_');

    await createOrderPart({
      order_id: order.order_id,
      part_number: job.part_number,
      product_type: job.product_type,              // Human-readable
      product_type_id: job.product_type_id,        // Machine-readable
      channel_letter_type_id: isChannelLetter ? job.source_type_id : null,
      base_product_type_id: !isChannelLetter ? job.source_type_id : null,
      quantity: job.quantity,
      specifications: job.specifications
    });
  }

  // 5. Generate task list from templates - REMOVED: Tasks now manually added by users
  // await generateTasksForOrder(order.order_id);

  // 6. Generate PDF forms (all 4 types)
  await generateOrderForms(order.order_id);

  // 7. Create directory structure on SMB mount
  await createOrderDirectory(orderNumber);

  return order;
}
```

### Task Generation (Hard-coded Phase 1)

**⚠️ UPDATE 2025-11-07: This automatic task generation has been REMOVED.**
**Tasks are now manually added by users via the Order Details UI during job_details_setup status.**

```typescript
// DEPRECATED - Hard-coded templates - migrate to database in Phase 3
const taskTemplates = {
  'channel_letters_front_lit': [
    'Design approval',
    'Cut returns',
    'Cut faces',
    'Weld returns',
    'Apply vinyl to faces',
    'Install LED modules',
    'Wire power supply',
    'Quality check',
    'Package for shipping'
  ],
  'dimensional_letters': [
    'Design approval',
    'Cut material',
    'Route/finish edges',
    'Paint/finish',
    'Quality check',
    'Package for shipping'
  ],
  // ... more templates
};

async function generateTasksForOrder(orderId: number) {
  const parts = await getOrderParts(orderId);

  for (const part of parts) {
    const template = taskTemplates[part.product_type_id] || taskTemplates.default;

    for (let i = 0; i < template.length; i++) {
      await createTask({
        order_id: orderId,
        part_id: part.part_id,
        task_name: template[i],
        task_order: i + 1,
        completed: false
      });
    }
  }
}
```

## Frontend Implementation

### File Structure

```
/frontend/web/src/components/orders/
├── OrdersPage.tsx                   # Main container
├── dashboard/
│   ├── OrderDashboard.tsx           # Dashboard view
│   ├── OrderCard.tsx                # Individual order card
│   └── StatusFilter.tsx             # Filter controls
├── progress/
│   ├── ProgressView.tsx             # Progress tracking view
│   ├── TaskList.tsx                 # Task list component
│   └── StatusDropdown.tsx           # Status selector
├── table/
│   ├── OrdersTable.tsx              # Jobs table view
│   └── TableFilters.tsx             # Advanced filters
├── conversion/
│   ├── ConvertEstimateModal.tsx     # Estimate → Order modal
│   └── OrderMetadataForm.tsx        # Order details form
└── forms/
    └── FormDownloadSection.tsx      # PDF download links
```

### Navigation Structure

```typescript
// Phase 1 tabs
const orderTabs = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard /> },
  { id: 'progress', label: 'Progress', icon: <ListChecks /> },
  { id: 'table', label: 'Jobs Table', icon: <Table /> }
];

// Phase 3 will add: 'kanban', 'create'
```

### Key Components

```typescript
// OrderDashboard.tsx - Main dashboard view
export const OrderDashboard = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filters, setFilters] = useState({
    status: 'all',
    search: ''
  });

  // Fetch orders with filters
  // Display as cards
  // Quick actions: View, Update Status, Download Forms
};

// ProgressView.tsx - Task tracking
export const ProgressView = ({ orderId }: { orderId: number }) => {
  const [tasks, setTasks] = useState<Task[]>([]);

  // Fetch tasks for order
  // Display with checkboxes
  // Update on completion
  // Show progress percentage
};

// OrdersTable.tsx - Comprehensive table
export const OrdersTable = () => {
  // Sortable columns: Order #, Name, Customer, Status, Due Date, Created
  // Filters: Status, Date range, Customer
  // Actions: Batch status update, Export CSV
  // Pagination
};
```

## PDF Form Generation

### Technology Stack

**Phase 1 Option:** Use `pdfkit` or `pdf-lib` for server-side generation

```typescript
// Basic structure using pdfkit
import PDFDocument from 'pdfkit';

async function generateMasterOrderForm(orderId: number) {
  const order = await getOrderWithDetails(orderId);
  const doc = new PDFDocument({ size: 'LETTER', layout: 'landscape' });

  // Header
  doc.fontSize(20).text('Order Form', { align: 'center' });
  doc.fontSize(12);
  doc.text(`Order Number: ${order.order_number}`);
  doc.text(`Order Name: ${order.order_name}`);
  doc.text(`Customer: ${order.customer_name}`);
  // ... more fields

  // Parts/Jobs section
  for (const part of order.parts) {
    doc.fontSize(14).text(`Part ${part.part_number}: ${part.product_type}`);
    doc.fontSize(10).text(`Quantity: ${part.quantity}`);
    // Specifications from JSON
    // Sign image if available
    doc.moveDown();
  }

  // Save to SMB mount
  const path = `/mnt/channelletter/NexusTesting/Order-${order.order_number}/master_form_v${order.form_version}.pdf`;
  doc.pipe(fs.createWriteStream(path));
  doc.end();

  return path;
}
```

### Form Variations

Each form type uses the same base but excludes certain fields:

```typescript
const formConfigurations = {
  master: {
    excludes: []  // Everything
  },
  shop: {
    excludes: ['customer_name', 'customer_po', 'point_person_email', 'internal_notes']
  },
  customer: {
    excludes: ['due_date', 'point_person_email', 'internal_notes'],
    transformations: {
      led_count: (value) => value > 0 ? 'Yes' : 'No',
      power_supply_count: (value) => value > 0 ? 'Yes' : 'No'
    }
  },
  packing: {
    includes: ['order_number', 'order_name', 'customer_name', 'parts'],
    special: 'checklist_format'
  }
};
```

## File Storage Strategy

### SMB Mount Structure

```
/mnt/channelletter/NexusTesting/Order-
├── 200000/
│   ├── master_form_v1.pdf
│   ├── shop_form_v1.pdf
│   ├── customer_form_v1.pdf
│   ├── packing_list_v1.pdf
│   ├── sign_images/
│   │   ├── part1.png
│   │   └── part2.png
│   └── archive/
│       └── v1/
│           ├── master_form_v1.pdf
│           └── ...
├── 200001/
│   └── ...
```

### Form Versioning Logic

```typescript
async function updateOrderForms(orderId: number, createNewVersion: boolean) {
  const order = await getOrder(orderId);

  if (createNewVersion) {
    // Archive current version
    await archiveCurrentVersion(order.order_id, order.form_version);

    // Increment version
    await updateOrder(order.order_id, {
      form_version: order.form_version + 1
    });
  }

  // Generate new forms
  await generateAllForms(order.order_id);
}
```

## Integration with Existing Systems

### Invoice & Payment Management

**Phase 1:** Manual status updates only
- Manager manually updates kanban stage to 'awaiting_payment' after delivery
- Manager manually updates to 'completed' when payment received
- NO invoice creation in the system
- NO payment tracking in the system
- All invoicing done directly in QuickBooks outside the system

**Phase 2+:** Invoice system integration
- Create invoices in the system
- Sync with QuickBooks
- Track payments
- Automatic status updates based on payment status

```typescript
// Phase 1: Manual status management only
function updateOrderStatus(orderId: number, newStatus: string) {
  // Manager manually changes status
  // No invoice or payment tracking
}

// Phase 2+: Future automated integration
async function syncOrderToQuickBooks(orderId: number) {
  // Future: Create invoice, track payments, etc.
}
```

### Customer Fields

Leverage existing customer table fields:

```sql
-- Already available:
customers.special_instructions  -- Manufacturing preferences
customers.comments             -- Internal notes
customers.preferred_contact    -- Contact method
customers.sales_tax_exempt     -- Tax handling
```

## Testing Checklist

### Before Phase 1 Launch

- [ ] Order creation from estimate works correctly
- [ ] Order numbering increments properly (200000, 200001, ...)
- [ ] All 4 PDF forms generate correctly
- [ ] Forms exclude proper fields per type
- [ ] Task lists generate from templates
- [ ] Task completion tracking works
- [ ] Status updates save correctly
- [ ] Status history tracked
- [ ] File storage on SMB mount works
- [ ] Form versioning logic works
- [ ] Order deletion (pre-confirmation only)
- [ ] Search and filter functionality
- [ ] CSV export works
- [ ] All tables have proper indexes
- [ ] Permissions/RBAC applied (Manager+ only)

### Manual Test Cases

1. Convert estimate #5001 to order
2. Verify order #200000 created
3. Download all 4 forms, verify content
4. Update production notes
5. Complete 3 tasks
6. Change status to "in_production"
7. Update order details
8. Choose "Create New Version"
9. Verify v2 forms generated
10. Verify v1 forms archived

## Performance Considerations

### Database Indexes

Already included in schema:
- `idx_order_number` on orders
- `idx_customer` on orders
- `idx_status` on orders
- `idx_order` on order_parts, order_tasks
- `idx_product_type` on order_parts

### Query Optimization

```sql
-- Dashboard query: Active orders with customer info
SELECT
  o.*,
  c.company_name,
  c.city,
  c.province,
  COUNT(DISTINCT op.part_id) as part_count,
  SUM(CASE WHEN ot.completed THEN 1 ELSE 0 END) as completed_tasks,
  COUNT(ot.task_id) as total_tasks
FROM orders o
JOIN customers c ON o.customer_id = c.customer_id
LEFT JOIN order_parts op ON o.order_id = op.order_id
LEFT JOIN order_tasks ot ON o.order_id = ot.order_id
WHERE o.status NOT IN ('completed', 'shipped')
GROUP BY o.order_id
ORDER BY o.due_date ASC;
```

## Security & Permissions

### RBAC Requirements

- **View Orders:** Manager, Designer, Production Staff
- **Create Orders:** Manager only
- **Update Orders:** Manager, Designer (limited)
- **Delete Orders:** Manager only (pre-confirmation)
- **Download Forms:** Manager, Designer, Production Staff
- **Update Tasks:** Manager, Designer, Production Staff

### Implementation

```typescript
// Use existing permission system
const permissions = {
  'orders.view': ['manager', 'designer', 'production_staff'],
  'orders.create': ['manager'],
  'orders.update': ['manager', 'designer'],
  'orders.delete': ['manager'],
  'orders.forms': ['manager', 'designer', 'production_staff']
};
```

## Migration from Estimates

### Data Mapping

```typescript
// Estimate → Order field mapping
const estimateToOrderMapping = {
  // Direct copies
  customer_id: 'customer_id',

  // User inputs
  orderName: 'order_name',
  customerPo: 'customer_po',
  dueDate: 'due_date',
  pointPersonEmail: 'point_person_email',

  // Jobs → Parts
  jobs: 'order_parts',  // Array mapping

  // New fields
  order_number: 'AUTO_INCREMENT',
  order_date: 'CURRENT_DATE',
  status: 'job_details_setup',
  form_version: 1
};
```

## Future Enhancements (Phase 2+)

### Phase 2 Additions
- Complete invoice system (create, track, manage)
- Payment recording and tracking
- Automated QuickBooks invoice creation and sync
- Automatic kanban status updates based on invoice status
- Gmail API integration for order notifications
- Customer email confirmations
- Due date reminders

### Phase 3 Additions
- Visual Kanban board
- Database-driven task templates
- Designer assignment system (Phase 4+)
- Create order from scratch (no estimate)

### Phase 4+ Considerations
- Designer assignment system:
  - Add assigned_designer field to orders table
  - UI for assigning specific designers to orders
  - Task filtering by assigned designer
  - Workload balancing views
  - Designer notifications
- Materials calculation and reservation
- Real-time inventory updates
- Advanced analytics and reporting
- Mobile app for production floor

---

**Document Status:** Phase 1: 85% Complete, Phase 1.5: 35% Complete (1.5.a-b done)
**Last Updated:** 2025-11-06
**Dependencies:** All Nexus_Orders_*.md files
**Recent Updates:**
- Phase 1.5.a & 1.5.a.5: ApproveEstimateModal fully functional
- Phase 1.5.b: Database schema updates applied
- Only ApproveEstimateModal exists (no edit/delete modals - using inline editing)
- Status enum uses 'job_details_setup' as initial status
**Next Steps:** Complete Phase 1.h testing, then implement Phase 1.5.c (Dual-Table UI)
