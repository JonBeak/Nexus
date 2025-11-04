# Orders Page - Kanban Board System

> **NOTE: Kanban Board implementation moved to Phase 3. Phase 1 uses simple status dropdown in Order Details view. This document describes the future visual Kanban implementation.**

## Phase 1 Implementation (Status Dropdown)

**IMPORTANT Phase 1 Notes:**
- All status changes are MANUAL by manager
- NO invoice system (invoicing done directly in QuickBooks)
- NO payment tracking (manager tracks externally)
- Manager manually moves orders to 'awaiting_payment' after delivery
- Manager manually moves to 'completed' when payment received

In Phase 1, order status is managed through a simple dropdown with these options:

### 14 Stages:
1. **Initiated** - Order created, awaiting processing
2. **Pending Confirmation** - Sent to customer, awaiting approval
3. **Pending Production Files Creation** - Waiting for design/production files to be created
4. **Pending Production Files Approval** - Production files awaiting approval
5. **Production Queue** - Approved and waiting to start production
6. **In Production** - Manufacturing/fabrication
7. **On Hold** - Temporarily paused (manual)
8. **Overdue** - Automatically calculated when past due_date
9. **QC Packing** - Quality check and packaging
10. **Shipping** - Ready for shipping or in transit
11. **Pick Up** - Ready for customer pickup
12. **Awaiting Payment** - Delivered but payment pending
13. **Completed** - Order complete and closed
14. **Cancelled** - Order cancelled (manual)

---

## Phase 3 Implementation (Visual Kanban)

The visual Kanban board will be implemented in Phase 3 with drag-and-drop functionality.

## Purpose
Define the Kanban workflow stages, movement rules, automation triggers, and visual design for the job tracking board.

---

## Kanban Stages Definition

### 1. Initiated
**Description**: Order has been created from an estimate but is still being structured/built by the manager.

**Typical Activities**:
- Manager converts estimate line items into order parts
- Defines specifications for each part
- Generates task lists from templates
- Reviews and adjusts auto-generated order forms
- Prepares to send to customer for approval

**Entry Conditions**:
- Estimate is approved by customer
- Manager clicks "Convert to Order"

**Exit Conditions**:
- Manager sends order form to customer for approval
- Moves to → **Pending Confirmation From Customer**

**Automation**:
- Auto-create invoice in draft status
- Auto-generate tasks from product templates
- Phase 4+: Send internal notification to assigned designer (when assignment feature added)

**Who Can Move Jobs Here**: Manager/Owner only

---

### 2. Pending Confirmation
**Description**: Order details have been sent to customer for review and confirmation.

**Typical Activities**:
- Email notification to customer with order form PDF (manually executed)
- Customer reviews order form (Customer version)
- Customer confirms or requests changes (via email/phone)
- Manager handles change requests

**Entry Conditions**:
- Order structure is complete
- Manager manually sends customer order form

**Exit Conditions**:
- Manager manually confirms that order is confirmed
- Moves to → **Pending Production Files Creation**

**Automation**:
- **Alert if > 24 hours**: Show "Resend Request" button
- **Urgent alert if > 72 hours**: Red flag, escalate to manager
- **NOTE**: Emails are NEVER automatically sent - all emails must be manually executed
- **NOTE**: App does not have ability to read emails and gather confirmation data
- Auto-log timeline event when manager confirms

**Who Can Move Jobs Here**: Manager/Owner, Designer

**Manual Overrides**: Manager can force-confirm if verbal approval received

---

### 3. Pending Production Files Creation
**Description**: Customer has confirmed order details, job is ready for design/production files to be created.

**Typical Activities**:
- Designer creates vector files
- Designer creates production files

**Entry Conditions**:
- Customer confirmation received
- All specifications are clear

**Exit Conditions**:
- Production files are ready for approval from Manager
- Moves to → **Pending Production Files Approval**

**Automation**:
- Mark "Designer" tasks as available
- Calculate suggested design completion date
- Phase 4+: Assign to designer (when assignment feature added)

**Who Can Move Jobs Here**: Manager/Owner, Designer

---

### 4. Pending Production Files Approval
**Description**: Production files have been created and sent to manager for approval.

**Typical Activities**:
- Manager reviews production files
- Manager approves or requests revisions from designer

**Entry Conditions**:
- Production files sent to manager for approval

**Exit Conditions**:
- Manager approves production files
- Moves to → **Production Queue**
- OR if revisions needed → back to **Pending Production Files Creation**

**Automation**:
- **Alert if production file not approved within 2 hours**
- **Urgent alert if > 24 hours**
- Auto-log timeline event when approved
- **NOTE**: Production files are NOT emailed to customer

**Who Can Move Jobs Here**: Manager/Owner, Designer

**Backward Movement**: Yes, can return to "Pending Production Files Creation" for revisions

---

### 5. Production Queue
**Description**: Design is approved, job is ready to start fabrication. Waiting for production slot.

**Typical Activities**:
- Manager schedules production start (sorted by due date)
- Double check all tasks and mark all production tasks as available
- Materials procured (marked as ordered)

**Entry Conditions**:
- Design approved by manager
- All design tasks completed

**Exit Conditions**:
- Materials procured
- Production begins (automatically detected when any tasks are marked started or completed)
- Moves to → **In Production**

**Automation**:
- Mark all production tasks as "available" within this step
- Calculate production schedule based on due date
- **NOTE**: Automatic materials availability check and shopping cart placement are future implementations

**Who Can Move Jobs Here**: Manager/Owner, Designer

---

### 6. In Production
**Description**: Job is actively being fabricated. This is the longest stage with most task activity.

**Typical Activities**:
- Vinyl cutting
- Vinyl application
- CNC Routing (PC, ACM, Aluminum, Other)
- Cut & Bend (Return, Trim)
- Return Fabrication
- Trim Fabrication
- Return Gluing
- Pins/DTape/Face Gluing
- LEDs
- Backer Fabrication
- Painting
- Assembly
- Multiple roles working simultaneously or sequentially

**Entry Conditions**:
- Production has started
- At least one production task is in progress

**Exit Conditions**:
- All production tasks completed (except QC Packing)
- Auto-move to → **QC Packing**
- OR if past due date → Auto-move to **Overdue**

**Automation**:
- Track task completions for progress %
- Daily check: if currentDate > dueDate → move to "Overdue"

**Who Can Move Jobs Here**: Manager/Owner, Production Staff, Designer

**Backward Movement**: Yes, can return to "Pending Production Files Approval" or "Pending Production Files Creation" if customer changes specs mid-production

---

### 7. Overdue
**Description**: Job has passed its due date and is not yet in final stages. Less of an activities stage, more of a visual indicator of lateness.

**Typical Activities**:
- Manager reviews status
- Prioritizes completion
- Option to alert customer of updated estimated completion date
- Adjusts resources to expedite

**Entry Conditions**:
- currentDate > dueDate
- Job is not in "QC Packing", "Shipping", "Pick Up", or "Completed"

**Exit Conditions**:
- Job is completed and moves to appropriate stage
- OR due date is extended (returns to previous stage)

**Automation**:
- **Auto-move**: Any job that crosses due date while in earlier stages
- **Cannot manually move here** (except to force-flag)
- Display in red on all views
- Daily notification to manager with overdue job list

**Who Can Move Jobs Here**: System automated (or Manager override)

**Backward Movement**: Yes, if manager extends due date, returns to stage it was in before becoming overdue

---

### 9. QC Packing
**Description**: Final quality check and preparation for delivery.

**Typical Activities**:
- Final inspection for defects
- Lighting test (if applicable)
- QC passed, packed and ready
- Pack according to packing list
- Create shipping label if required
- Packing List auto-generated and revised if needed with Order Forms

**Entry Conditions**:
- All production tasks except QC Packing are completed

**Exit Conditions**:
- QC Packing task is marked as completed
- Auto-move to → **Shipping** if deliveryMethod='shipping'
- Auto-move to → **Pick Up** if deliveryMethod='pickup'

**Automation**:
- Generate/update packing list PDF
- Mark "Packing" role tasks as available
- Auto-move to Shipping or Pickup accordingly
- Button to send notification email (with confirmation dialogue and option to list times previously sent)

**Who Can Move Jobs Here**: Manager/Owner, Production Staff

---

### 10. Shipping
**Description**: Job is ready to be shipped (awaiting shipping company to pick up or for us to drop off).

**Typical Activities**:
- Shipping label already created in QC Packing
- Tracking Number recorded (optional)
- Invoice Sent with Order is Ready for Pickup/Shipping Notice (button to send)

**Entry Conditions**:
- QC Packing completed
- Delivery method is 'shipping'

**Exit Conditions**:
- Delivery has been delivered / Shipment has been picked up
- Phase 1: Manager manually moves to **Awaiting Payment** or **Completed**
- Phase 2+: Check invoice status to determine next stage:
  - If invoice unpaid → **Awaiting Payment**
  - If invoice paid → **Completed**

**Automation**:
- Phase 1: Manual status updates only
- Phase 2+: Button to send invoice, check invoice status
- Auto-log timeline event

**Who Can Move Jobs Here**: Manager/Owner

---

### 11. Pick Up
**Description**: Job is ready for customer pickup.

**Typical Activities**:
- Notify customer that order is ready for pickup
- Coordinate pickup time
- Invoice Sent with Order is Ready for Pickup Notice (button to send)

**Entry Conditions**:
- QC Packing completed
- Delivery method is 'pickup'

**Exit Conditions**:
- Order has been picked up by customer
- Phase 1: Manager manually moves to **Awaiting Payment** or **Completed**
- Phase 2+: Check invoice status to determine next stage:
  - If invoice unpaid → **Awaiting Payment**
  - If invoice paid → **Completed**

**Automation**:
- Phase 1: Manual status updates only
- Phase 2+: Button to send invoice, check invoice status
- Auto-log timeline event

**Who Can Move Jobs Here**: Manager/Owner

---

### 12. Awaiting Payment
**Description**: Job is delivered but payment is not yet received.

**Phase 1 Implementation**:
- Manual status update by manager after delivery
- NO invoice creation or tracking in Phase 1
- All invoicing done directly in QuickBooks outside the system

**Typical Activities**:
- Phase 1: Manager tracks payment externally
- Phase 2+: Send invoice, track payment, follow up

**Entry Conditions**:
- Phase 1: Manager manually moves here after delivery
- Phase 2+: Job delivered/picked up with unpaid invoice

**Exit Conditions**:
- Phase 1: Manager manually moves to **Completed** when paid
- Phase 2+: Invoice fully paid (automatic)

**Automation**:
- Phase 1: NONE - all manual status updates
- Phase 2+: Invoice creation, payment tracking, alerts

**Who Can Move Jobs Here**: Manager/Owner

---

### 13. Completed
**Description**: Job is finished, delivered, and paid. Archived for reference.

**Typical Activities**:
- Final revenue recorded
- Data available for analytics
- Can be referenced for future similar jobs

**Entry Conditions**:
- Job delivered
- Invoice fully paid (or cash job marked paid)

**Exit Conditions**:
- None (terminal state)

**Automation**:
- Move to "Completed Jobs" archive view
- Calculate actual vs estimated time/cost (future)
- Flag for review if significantly over/under estimate

**Who Can Move Jobs Here**: Manager/Owner

---

### 14. Cancelled
**Description**: Job was cancelled before completion.

**Typical Activities**:
- Document cancellation reason
- Handle any deposits/refunds
- Archive for records

**Entry Conditions**:
- Customer cancels
- Internal cancellation (duplicate, error, etc.)

**Exit Conditions**:
- None (terminal state)

**Automation**:
- Require cancellation reason
- Log timeline event
- Mark invoice as void/cancelled
- Release reserved materials (future)

**Who Can Move Jobs Here**: Manager/Owner only

---

## Stage Transition Rules

### Valid Transitions

```
Initiated → Pending Confirmation
Pending Confirmation → Pending Production Files Creation
Pending Confirmation → Initiated (if major changes needed)

Pending Production Files Creation → Pending Production Files Approval
Pending Production Files Creation → Initiated (if specs unclear, need rebuild)

Pending Production Files Approval → Production Queue
Pending Production Files Approval → Pending Production Files Creation (revisions needed)

Production Queue → In Production
Production Queue → Pending Production Files Creation (customer changes mind)

In Production → QC Packing
In Production → Overdue (automated)
In Production → Pending Production Files Approval (major customer changes)

Overdue → QC Packing (caught up)
Overdue → [previous stage] (if due date extended)

QC Packing → Shipping (if delivery method is shipping)
QC Packing → Pick Up (if delivery method is pickup)
QC Packing → In Production (failed QC)

Shipping → Awaiting Payment
Shipping → Completed (if prepaid)

Pick Up → Awaiting Payment
Pick Up → Completed (if prepaid)

Awaiting Payment → Completed

[Any Stage] → Cancelled (Manager only)
```

### Forbidden Transitions
- Cannot skip stages unless Manager override
- Cannot move from Completed back to any stage
- Cannot move from Cancelled back to any stage
- Production staff cannot move jobs out of Production stage

---

## Kanban Board UI Design

### Visual Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│  ORDERS KANBAN BOARD                                    [+ New Order]       │
│  ───────────────────────────────────────────────────────────────────────── │
│  Filters: [All] [Overdue Only] [By Designer ▼] [By Customer ▼]  Search: ⌕ │
└────────────────────────────────────────────────────────────────────────────┘

┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│  Initiated   │ Pending Conf.│Prod Files Cr │Prod Files App│ Prod Queue   │
│     (2)      │     (5)      │     (3)      │     (4)      │     (6)      │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│              │              │              │              │              │
│ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │
│ │ #200431  │ │ │ #200428  │ │ │ #200420  │ │ │ #200415  │ │ │ #200410  │ │
│ │          │ │ │          │ │ │          │ │ │          │ │ │          │ │
│ │──────────│ │ │──────────│ │ │──────────│ │ │──────────│ │ │──────────│ │
│ │ ABC Sign │ │ │ XYZ Co   │ │ │ 123 Corp │ │ │ Demo Inc │ │ │ Test Ltd │ │
│ │ Co       │ │ │──────────│ │ │──────────│ │ │──────────│ │ │──────────│ │
│ │──────────│ │ │ Channel  │ │ │ Flat Cut │ │ │ Monument │ │ │ Cabinet  │ │
│ │ Channel  │ │ │ Letters  │ │ │ Letters  │ │ │ Sign     │ │ │ Sign     │ │
│ │ Letters  │ │ │──────────│ │ │──────────│ │ │──────────│ │ │──────────│ │
│ │ + Backer │ │ │🔴72h     │ │ │ Due 11/8 │ │ │ Due 11/5 │ │ │ Due 11/3 │ │
│ │──────────│ │ │          │ │ │          │ │ │          │ │ │          │ │
│ │ Due 11/15│ │ │ [Resend] │ │ │ Designer │ │ │ 60% Done │ │ │ Ready    │ │
│ └──────────┘ │ └──────────┘ │ │ Jane     │ │ └──────────┘ │ └──────────┘ │
│              │              │ └──────────┘ │              │              │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘

┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│In Production │   Overdue    │ QC Packing   │Shipping/Pick Up│Awaiting Pay  │
│    (12)      │  ⚠️ (3)      │     (4)      │     (2)      │     (5)      │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│              │              │              │              │              │
│ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │
│ │Multiple  │ │ │🔴#200380 │ │ │ #200405  │ │ │ #200401  │ │ │ #200395  │ │
│ │Cards...  │ │ │          │ │ │          │ │ │          │ │ │          │ │
│ └──────────┘ │ │──────────│ │ └──────────┘ │ │──────────│ │ │──────────│ │
│              │ │ Due 10/25│ │              │ │ Shipped  │ │ │ 15 days  │ │
│              │ │ 6d late! │ │              │ │ 10/29    │ │ │ overdue  │ │
│              │ └──────────┘ │              │ └──────────┘ │ └──────────┘ │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

**Board Layout**: Kanban board is left-to-right scrollable, with all lists arranged horizontally from left to right.

### Card Design

```
┌─────────────────────────────┐
│ #200431              [⋮ Menu]│  ← Order number + actions menu
├─────────────────────────────┤
│ ABC Sign Company             │  ← Customer name (click to view details)
├─────────────────────────────┤
│ Channel Letters 'OPEN'       │  ← Primary part title
│ + ACM Backer                 │  ← Additional parts (if multiple)
├─────────────────────────────┤
│ 📅 Due: Nov 15 (14 days)     │  ← Due date with days remaining
│ 👤 Phase 4+: Designer Field  │  ← (Not in Phase 1)
│ ◷ Progress: 35% ████░░░░░░   │  ← Visual progress bar
├─────────────────────────────┤
│ 🔴 Customer: No response 72h │  ← Alerts/flags
├─────────────────────────────┤
│ [View Details] [Send Form]   │  ← Quick actions
└─────────────────────────────┘
```

### Color Coding

- **Red**: Overdue or urgent alerts
- **Gray**: Completed/Cancelled

### Card Display Modes

- **Compact Mode**: Text-based, shows essential info only
- **Visual Mode**: Includes image of sign (toggle option)
- Toggle between modes for different workflow preferences

### Card Actions Menu (⋮)
- View Full Details
- Edit Order
- Send to Customer (email order form/proof)
- Add Note
- Change Due Date
- Phase 4+: Assign Designer
- View Timeline
- Mark as Priority
- Cancel Order

---

## Automation Rules

### Automatic Stage Movements

```javascript
// Pseudo-code for automation logic

// Daily cron job: Check for overdue jobs
function checkOverdueJobs() {
  const activeStages = [
    'initiated',
    'pending_confirmation',
    'pending_production_files_creation',
    'pending_production_files_approval',
    'production_queue',
    'in_production'
  ];

  const overdueJobs = findJobs({
    dueDate: { lessThan: now() },
    kanbanStage: { in: activeStages }
  });

  overdueJobs.forEach(job => {
    moveJobToStage(job, 'overdue');
    notifyManager(job);
  });
}

// Trigger when all design tasks complete
function onDesignTasksComplete(orderId) {
  const order = getOrder(orderId);

  if (order.kanbanStage === 'pending_production_files_creation') {
    const allDesignTasksDone = order.parts.every(part =>
      part.tasks.filter(t => t.role === 'designer').every(t => t.status === 'completed')
    );

    if (allDesignTasksDone) {
      // Don't auto-move, but suggest to designer
      suggestStageMove(order, 'pending_production_files_approval');
    }
  }
}

// Trigger when customer confirms details
function onCustomerConfirmation(orderId) {
  const order = getOrder(orderId);

  if (order.kanbanStage === 'pending_confirmation') {
    moveJobToStage(order, 'pending_production_files_creation');
    logTimelineEvent(order, 'Customer confirmed order details');
    // Phase 4+: notifyDesigner(order) - when designer assignment added
  }
}

// Trigger when all production tasks complete
function onProductionTasksComplete(orderId) {
  const order = getOrder(orderId);

  if (order.kanbanStage === 'in_production') {
    const allProductionTasksDone = calculateOverallProgress(order) === 100;

    if (allProductionTasksDone) {
      suggestStageMove(order, 'qc_packing');
    }
  }
}
```

### Alert Triggers

```javascript
// Customer response alerts
function checkCustomerResponseAlerts() {
  // 24 hour alert
  const pendingConfirmation24h = findJobs({
    kanbanStage: 'pending_confirmation',
    lastCustomerContact: { olderThan: hours(24) }
  });

  pendingConfirmation24h.forEach(job => {
    showAlert(job, 'warning', 'No customer response in 24h', {
      action: 'resendRequest'
    });
  });

  // 72 hour urgent alert
  const pendingConfirmation72h = findJobs({
    kanbanStage: ['pending_confirmation', 'pending_production_files_approval'],
    lastCustomerContact: { olderThan: hours(72) }
  });

  pendingConfirmation72h.forEach(job => {
    showAlert(job, 'urgent', 'No customer response in 72h!', {
      action: 'escalateToManager'
    });
  });
}

// Stalled production alert
function checkStalledProduction() {
  const stalledJobs = findJobs({
    kanbanStage: 'in_production',
    lastTaskCompletedAt: { olderThan: days(2) }
  });

  stalledJobs.forEach(job => {
    notifyManager(job, 'Production stalled: No tasks completed in 2 days');
  });
}
```

---

## Performance Considerations

### Optimizations
- **Pagination**: Load 20 cards per stage initially, infinite scroll for more
- **Lazy Loading**: Only fetch full order details when card is clicked
- **Caching**: Cache Kanban state in frontend for 5 minutes
- **Real-time Updates**: Use polling (every 30s) or WebSocket for live updates
- **Database Indexes**: Index on `kanbanStage` + `dueDate` for fast filtering

### Expected Data Volume
- Active orders at any time: 50-150
- Cards per stage: 5-30
- Total DOM elements: ~500-1000 (manageable)

---

## Integration with Other Features

### Progress Tracking
- Card shows progress % from task completion
- Click card → open progress detail view (like Trello)
- In card detail view, see components breakdown and mark tasks as completed/incomplete
- When progress tasks are marked completed, may trigger automations in Kanban view (e.g., auto-move stages)

### Timeline
- Each stage movement logs timeline event
- Visible in order details modal

### Invoice
- "Awaiting Payment" stage checks invoice status
- Alert if invoice overdue

### Materials (Future)
- "Approved for Production" stage checks material availability
- Alert if materials missing

---

## User Permissions

| Action | Owner | Manager | Designer | Production |
|--------|-------|---------|----------|------------|
| View Kanban | ✅ | ✅ | ✅ | ✅ |
| Drag/drop any card | ✅ | ✅ | ❌ | ❌ |
| Move design-related stages | ✅ | ✅ | ✅ | ❌ |
| Mark overdue back on track | ✅ | ✅ | ❌ | ❌ |
| Cancel orders | ✅ | ✅ | ❌ | ❌ |
| Edit due dates | ✅ | ✅ | ❌ | ❌ |

---

## Next Steps

1. ✅ Define Kanban stages and rules (this document)
2. Design database queries for efficient stage filtering
3. Create React component structure for Kanban board
4. Implement drag-and-drop with validation
5. Build automation cron jobs
6. Design alert notification system

---

**Document Status**: Initial Planning - Complete
**Last Updated**: 2025-10-31
**Dependencies**: Nexus_Orders_JobStructure.md
