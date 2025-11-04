# Orders Page - System Overview

## Vision
A comprehensive order management system that transforms approved estimates into trackable, executable jobs with real-time progress monitoring, role-based task management, and automated materials planning.

---

## High-Level Architecture

### Core Philosophy
**Single Source of Truth**: All features read from and write to a centralized `Order Master Object` stored in the database. This ensures consistency across Kanban, progress tracking, invoicing, materials, and reporting.

### System Flow
```
┌─────────────────────────────────────────────────────────────────────┐
│                        ESTIMATE (Read-Only Link)                     │
│                     Customer approved, locked state                  │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ORDER INITIATION (Landing Zone)                   │
│  Manager converts estimate → builds order structure → generates      │
│  parts, tasks, materials list from templates                         │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         MASTER ORDER OBJECT                          │
│  Central JSON/relational structure containing:                       │
│  - Order metadata (customer, dates, status)                          │
│  - Parts breakdown (specifications, materials, tasks)                │
│  - Progress tracking (completion %, task status by role)             │
│  - Invoice data (line items, pricing, payment status)                │
│  - Audit trail (changes, approvals, communications)                  │
└─────────────┬───────────────────────────────────────────────────────┘
              │
              ├──────────────┬──────────────┬──────────────┬──────────────┬───────────┐
              ▼              ▼              ▼              ▼              ▼           ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
        │  Kanban  │  │ Progress │  │  Gantt   │  │ Order    │  │ Invoice  │  │Materials │
        │  Board   │  │ Tracking │  │  Chart   │  │ Forms    │  │ System   │  │ Planning │
        └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘
              │              │              │              │              │           │
              └──────────────┴──────────────┴──────────────┴──────────────┴───────────┘
                                        │
                                        ▼
                            Updates Master Order Object
                            (Real-time sync across all views)
```

---

## Technology Stack

### Backend
- **Framework**: Express + TypeScript (existing pattern)
- **Database**: MySQL 8.0
  - Primary tables: `orders`, `order_parts`, `order_tasks`, `order_materials`, `order_invoices`
  - JSON columns for flexible data storage where appropriate
- **Real-time Updates**: Consider WebSocket for live progress updates (future enhancement)
- **PDF Generation**: Existing library for order forms + packing lists

### Frontend
- **Framework**: React + TypeScript + Vite (existing)
- **State Management**:
  - React Context for order data
  - Local state for UI interactions
  - Consider React Query for server state caching
- **UI Components**:
  - Kanban: react-beautiful-dnd or @dnd-kit
  - Gantt Chart: react-gantt-chart or custom implementation
  - Calendar: react-big-calendar
  - Forms: Existing grid system from job estimation
- **Navigation**: Tab-based interface with persistent state

### Data Architecture
- **Primary Storage**: Relational (MySQL) for queryability, reporting, integrity
- **Flexible Data**: JSON columns for part specifications, custom fields, metadata
- **Caching Strategy**: Redis for frequently accessed order summaries (future)
- **File Storage**: Order form PDFs, customer proofs stored in filesystem with DB references

---

## Feature Overview Matrix

| Feature | Primary Input | Primary Output | Master Object Interaction |
|---------|--------------|----------------|---------------------------|
| **Order Landing** | Estimate data | Structured order with parts | CREATES master object |
| **Kanban Board** | Job status changes, card interactions | Stage position updates, component completion tracking | READS status, WRITES status + timestamps + task completions |
| **Progress Tracking** | Task completions by role | Overall % complete | READS tasks, WRITES completion data |
| **Order Forms** | Master object + templates | PDF documents (4 types) | READS all data, no writes |
| **Invoice System** | Pricing + modifications | Invoice JSON + QB export | READS pricing, WRITES invoice edits |
| **Materials Planning** | Parts specs + mappings | Materials list + quantities | READS parts, WRITES materials breakdown |
| **Landing Dashboard** | All orders + due dates | Prioritized task lists | READS for filtering/sorting |
| **Gantt Chart** | Task durations + dependencies | Timeline visualization | READS tasks + dates |
| **Jobs Table** | Filters + search | Tabular data view with all tasks | READS for display |
| **Calendar View** | Due dates + milestones | Calendar events | READS dates |

---

## Master Order Object - Conceptual Structure

```typescript
interface MasterOrderObject {
  // === CORE METADATA ===
  orderId: string;                    // Unique identifier
  estimateId: string;                 // Link to source estimate (read-only)
  customerId: string;
  customerName: string;
  orderNumber: number;                // Sequential number starting at 200000 (e.g., 200431)
  createdDate: Date;
  createdBy: string;                  // User ID

  // === STATUS & WORKFLOW ===
  kanbanStage: KanbanStage;          // Current stage in workflow
  overallStatus: 'active' | 'overdue' | 'completed' | 'cancelled';
  dueDate: Date;
  startDate?: Date;
  completedDate?: Date;

  // === PARTS BREAKDOWN ===
  parts: OrderPart[];                // Array of job components

  // === PROGRESS TRACKING ===
  progress: {
    overallPercent: number;          // 0-100
    tasksByRole: RoleTaskList[];     // Tasks organized by role
    completedTasks: number;
    totalTasks: number;
  };

  // === FINANCIAL ===
  invoice: InvoiceData;

  // === SHIPPING ===
  estimatedShippingCost?: number;        // From estimate data
  estimatedTransitDays?: number;         // From estimate data
  actualShippingCost?: number;           // Set by QC & Packing role or Manager
  actualTransitDays?: number;            // Set by QC & Packing role or Manager

  // === MATERIALS (Future) ===
  materials?: MaterialsBreakdown;

  // === COMMUNICATIONS ===
  timeline: TimelineEvent[];         // Customer approvals, changes, notes

  // === AUDIT ===
  lastModified: Date;
  modifiedBy: string;
  version: number;                   // For change tracking
}
```

See `Nexus_Orders_JobStructure.md` for detailed breakdown of nested objects.

---

## User Roles & Permissions

| Action | Owner | Manager | Designer | Production Staff |
|--------|-------|---------|----------|------------------|
| Create order from estimate | ✅ | ✅ | ❌ | ❌ |
| Build order structure | ✅ | ✅ | ❌ | ❌ |
| Modify parts/tasks | ✅ | ✅ | ❌ | ❌ |
| Move Kanban stages | ✅ | ✅ | ✅* | ❌ |
| Complete tasks | ✅ | ✅ | ✅** | ✅** |
| Edit invoice | ✅ | ✅ | ❌ | ❌ |
| Generate order forms | ✅ | ✅ | ✅ | ❌ |
| View materials list | ✅ | ✅ | ✅ | ✅ |

\* Designers can only move to/from design-related stages
\** Role-specific: can only complete tasks for their assigned role

---

## Navigation & UI Structure

### Primary Tabs
1. **Dashboard** (Landing page)
   - Urgent alerts
   - Today's priorities (detailed)
   - Tomorrow's priorities (detailed)
   - This week (summary)
   - Upcoming (summary)

2. **Kanban Board**
   - Drag-and-drop job cards across stages
   - Click card to see components breakdown and mark complete/incomplete (like Trello)
   - Quick actions: view details, add notes, send reminder

3. **Progress Tracking**
   - Role-based task lanes (swimlanes)
   - Filter by job, role, due date
   - Mark tasks complete
   - Shows task dependencies and availability

4. **Jobs Table**
   - Searchable, filterable, sortable
   - Columns: Order #, Customer, Stage, Progress %, Due Date, Days Remaining
   - Shows each Progress Tracking task detail

5. **Calendar View**
   - Due dates marked
   - Color-coded by stage
   - Click to view job details

6. **Gantt Chart** (Future)
   - Timeline visualization
   - Task dependencies
   - Resource allocation

7. **Completed Jobs**
   - Archive of finished work
   - Analytics: on-time %, average duration, revenue
   - Search/filter for reference
   - Each task includes start date/time, end date/time, and completion date/time
   - Ability to archive completed jobs to external SSD for scalability

### Modal/Drawer Views
- **Order Details**: Full job information, edit capabilities
- **Order Forms**: Generate/view PDF versions
- **Invoice Editor**: Modify line items, pricing, add custom items
- **Materials List**: View requirements, link to supply chain
- **Timeline/History**: Audit trail of changes and communications

---

## Integration with Existing Systems

### Leveraging Current Infrastructure
- **QuickBooks Integration:** Leverages existing QB integration from Job Estimation module
  - Location: `/backend/web/src/utils/quickbooks/`
  - Phase 1: Manual QB entry using existing connection
  - Phase 2: Automated invoice creation and sync
- **Customer Data:** Uses existing customers table fields
  - `special_instructions` field = Manufacturing Preferences
  - `comments` field = Internal Notes
  - NO NEW FIELDS needed in customers table
- **Employee System:** Extends existing employees table with production_roles JSON column
- **File Storage:** SMB mount to Windows PC for design files (configuration TBD)
  - Path format: `/mnt/signfiles/orders/{orderNumber}/`

## Key Integration Points

### With Existing Systems
1. **Job Estimation System**
   - **Input**: Approved estimate data (line items, pricing, specifications)
   - **Process**: Order Landing converts estimate structure → order structure
   - **Output**: Link maintained for reference

2. **Customer Management**
   - **Input**: Customer ID, billing/shipping addresses, preferences
   - **Output**: Used for order forms, invoicing, communications

3. **Supply Chain System** (Future rebuild)
   - **Input**: Materials breakdown from order
   - **Output**: Shopping cart, inventory reservations, cost tracking

4. **Time Management**
   - **Input**: Employee roles for task assignment
   - **Output**: Actual time spent for Gantt predictions (future)

5. **QuickBooks Integration**
   - **Input**: Invoice data from order
   - **Output**: QuickBooks estimate/invoice format export

---

## Development Phases (Updated)

### Phase 1: Core Foundation (4-6 weeks) - PRIORITY
- [ ] Database schema (orders, parts, tasks, invoices, timeline)
- [ ] Order Landing/Conversion wizard (estimate → order)
  - See Nexus_Orders_Landing_Conversion.md for detailed workflow (TBD)
- [ ] Order Details CRUD + view
- [ ] Progress Tracking (task management by role)
- [ ] Dashboard (priorities & alerts)
  - Overdue jobs count + list
  - Today's tasks by role
  - Jobs needing attention (no stats yet)
- [ ] All Order Forms + Packing List (simplified design)
- [ ] Basic Invoice (auto-create, manual QB entry using existing integration)
- [ ] Production roles in employees table (JSON column)
- [ ] Full timeline/audit trail tracking

### Phase 2: Essential Features (3-4 weeks)
- [ ] Jobs Table (searchable/filterable list)
- [ ] Calendar View (horizontal date view)
- [ ] Gmail API Integration (Workspace 2000/day limit sufficient)
  - Note: If volume exceeds 2,000/day in future, migrate to SendGrid/AWS SES
- [ ] QuickBooks API Automation (using existing integration)
- [ ] Completed Jobs archive
- [ ] Email notifications automation

### Phase 3: Visual Enhancements (2-3 weeks)
- [ ] Kanban Board (visual workflow with 7 core stages + 3 additional)
- [ ] Settings/Templates UI (migrate from hard-coded templates)
- [ ] Real-time updates (Server-Sent Events)
- [ ] Create Order from Scratch feature
- [ ] Advanced filters & search

### Phase 4+: Future Enhancements
- [ ] Materials Integration (full implementation)
- [ ] Gantt Chart
- [ ] Time Tracking integration
- [ ] Advanced analytics
- [ ] Mobile responsive design

---

## Success Metrics

### Operational Efficiency
- Time to convert estimate → order: < 5 minutes
- Task completion tracking accuracy: > 95%
- On-time delivery rate improvement
- Reduction in missed deadlines

### Data Quality
- Order information completeness
- Materials calculation accuracy
- Invoice accuracy (fewer manual corrections)

### User Adoption
- Manager usage: daily
- Designer/production usage: multiple times per day
- Customer approval response time

---

## Technical Considerations

### Performance
- Orders list should load < 500ms (pagination for 100+ orders)
- Kanban board drag-and-drop lag < 100ms
- PDF generation < 3 seconds

### Data Integrity
- Foreign key constraints on customer, estimate relationships
- Transaction support for multi-table updates
- Audit logging for all changes
- Backup strategy for order data

### Scalability
- Support for 500+ active orders
- 2000+ completed orders searchable
- Multi-user concurrent editing (optimistic locking)

### Security
- Role-based access control enforced at API level
- Sensitive pricing data only visible to Manager+
- Customer contact info protected
- Audit trail immutable

### Architecture Lessons Learned

#### MySQL Prepared Statements with Correlated Subqueries (2025-11-04)
**Issue:** MySQL prepared statements with `LIMIT ?` placeholders fail with error `ER_WRONG_ARGUMENTS` when query contains correlated subqueries in SELECT clause.

**Context:** Orders list endpoint uses correlated subqueries to aggregate task counts:
```sql
SELECT o.*,
  (SELECT COUNT(*) FROM order_tasks WHERE order_tasks.order_id = o.order_id) as total_tasks,
  (SELECT COUNT(*) FROM order_tasks WHERE order_tasks.order_id = o.order_id AND completed = 1) as completed_tasks
FROM orders o
LIMIT ?  -- Fails with correlated subqueries
```

**Solution:** Use validated literal values for LIMIT/OFFSET with integer validation to prevent SQL injection.

**Location:** `/backend/web/src/repositories/orderRepository.ts` (lines 103-119)

**Impact:** This pattern should be used for any repository methods that combine correlated subqueries with pagination.

---

## Next Steps

1. Review and finalize overall architecture ✅ (this document)
2. Define detailed job structure and data relationships → `Nexus_Orders_JobStructure.md`
3. Map out Kanban workflow and automation → `Nexus_Orders_KanbanBoard.md`
4. Design progress tracking system → `Nexus_Orders_ProgressTracking.md`
5. Plan order forms generation → `Nexus_Orders_OrderForms.md`
6. Architect invoice system → `Nexus_Orders_InvoiceSystem.md`
7. Design materials integration → `Nexus_Orders_MaterialsIntegration.md`
8. Plan UI/UX flows → `Nexus_Orders_UIDesign.md`
9. Create database schema → `Nexus_Orders_DatabaseSchema.md`

---

**Document Status**: Phase 1 Implementation - Backend Complete
**Last Updated**: 2025-11-04
**Owner**: Jon (with Claude Code assistance)
**Recent Updates**: MySQL prepared statement limitation documented, Phase 1.g backend API complete
