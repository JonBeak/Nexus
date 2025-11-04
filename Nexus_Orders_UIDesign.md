# Orders Page - UI Design & User Workflows

## Purpose
Define the complete user interface structure, navigation patterns, tab organization, responsive layouts, and user workflows for the Orders Page system.

**IMPLEMENTATION APPROACH**: For UI, let's work on one component at a time. Let's make one md file at a time per tab/large feature. This is a lot to think about right now. Let's start with the landing page with tabs and go from there.

---

## Navigation Entry Points

### From Dashboard
```
Dashboard
  └─ [Orders] button in navigation sidebar
      ↓
  Orders Page (Dashboard Tab - Default)
```

### From Job Estimation
```
Job Estimation Page
  └─ Estimate Approved by Customer
      └─ [Convert to Order] button (this is the conversion trigger)
          ↓
      Orders Page (Order Landing Modal)
```

### From Customers Page
```
Customers Page (Main search page)
  └─ [View Orders] button (on main search page, NOT individual details page)
      ↓
  Orders Page (filtered by customer)
```

---

## Navigation Structure - Phased Implementation

### Phase 1 Tabs (MVP)
```
┌─────────────┬──────────┬────────────┐
│  Dashboard  │ Progress │ Jobs Table │
└─────────────┴──────────┴────────────┘
```

1. **Dashboard** - Landing page with:
   - Overdue jobs count + list
   - Today's tasks by role
   - Jobs needing attention
   - Quick actions

2. **Progress** - Task management:
   - Tasks grouped by role
   - All designers see all tasks (Phase 1)
   - Check off completion
   - Add/edit tasks

3. **Jobs Table** - Simple list view:
   - Search/filter
   - Click to open Order Details modal
   - Status dropdown (not Kanban)

### Phase 2 Tabs
[Previous tabs] + Calendar + Completed

4. **Calendar** - Horizontal timeline view
5. **Completed** - Archive and basic analytics

### Phase 3 Tabs
[Previous tabs] + Kanban + Settings

6. **Kanban** - Visual workflow board (moved from Phase 1)
7. **Settings** - Template management UI

### Deferred Features

**Create Order from Scratch:**
- Moved to Phase 3
- Phase 1 only supports conversion from estimates
- Add [+ Create Order] button in Phase 3

---

## Tab 1: Dashboard (Landing Page)

### Purpose
Immediate visibility into urgent tasks, today's priorities, and upcoming work.

### Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│  ORDERS DASHBOARD                                     🔔 3 Alerts       │
└────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  🚨 URGENT ATTENTION                                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  🔴 3 OVERDUE JOBS                                                       │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ #200380 | ABC Corp | Channel Letters | Due: Oct 25 (6d late)      │ │
│  │ Status: In Production | Progress: 75%               [View Details] │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│  [View All Overdue Jobs]                                                 │
│                                                                          │
│  ⚠️ 2 JOBS AWAITING CUSTOMER RESPONSE > 72 HOURS                        │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ #200428 | XYZ Co | Pending Confirmation | Sent: Oct 29            │ │
│  │ [Resend Request] [Call Customer] [Mark as Contacted]               │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  📋 TODAY'S PRIORITIES                                   Nov 3, 2025     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Design Tasks Due Today (Jane)                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ ✏️ #200431 | Create vector files | Channel Letters                │ │
│  │    Due: Today 5:00 PM | High Priority                 [Start Task] │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Production Tasks Available (Vinyl/CNC)                                 │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ ✂️ #200420 | Cut vinyl faces | Flat cut letters                   │ │
│  │    Due: Tomorrow | Ready to start                     [Start Task] │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Jobs Shipping Today                                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 📦 #200401 | ABC Sign Co | Ready for pickup                        │ │
│  │    [Generate Packing List] [Notify Customer]                       │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  [View All Today's Tasks (12 total)]                                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  📅 TOMORROW (Nov 4)                                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  8 tasks due | 3 jobs need attention                                    │
│  [Expand Details ▼]                                                     │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  📆 THIS WEEK (Nov 4 - Nov 10)                                          │
├─────────────────────────────────────────────────────────────────────────┤
│  • 15 jobs in production                                                 │
│  • 8 jobs in design phase                                                │
│  • 5 jobs awaiting customer approval                                     │
│  • 12 jobs ready to ship this week                                       │
│                                                                          │
│  [View Week Calendar] [View Gantt Chart (Future)]                       │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  📊 QUICK STATS                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│  Active Orders: 47  |  On-Time Rate: 87%  |  Avg Completion: 8.5 days  │
└─────────────────────────────────────────────────────────────────────────┘
```

### User Actions
- Click any job → Opens order details modal
- Click task → Opens task detail or starts task
- Click [Resend Request] → Sends email reminder to customer
- Click alerts → Filters to relevant jobs

---

## Tab 2: Kanban Board

*See Nexus_Orders_KanbanBoard.md for detailed Kanban UI design*

**Phase 1 Note**: Phase 1 uses a simple status dropdown (10 stages) in the Jobs Table view. Visual Kanban board is deferred to Phase 3.

### Quick Summary
- Horizontal swimlanes for each stage
- Drag-and-drop job cards
- Filterable by priority, customer, designer
- Real-time updates

```
[Initiated] [Pending Conf] [Details Conf] [Pending Appr] → ... → [Completed]
    (2)         (5)            (3)            (4)                    (28)
  ┌─────┐     ┌─────┐        ┌─────┐        ┌─────┐
  │ Job │     │ Job │        │ Job │        │ Job │
  │ Card│     │ Card│        │ Card│        │ Card│
  └─────┘     └─────┘        └─────┘        └─────┘
```

---

## Tab 3: Progress Tracking

*See Nexus_Orders_ProgressTracking.md for detailed Progress UI design*

**Phase 1 Note - Designer Assignment**: In Phase 1, there is NO assigned_designer field or designer assignment functionality. All designers can see and work on all orders in their task list. Phase 4+ may add designer assignment functionality with dropdown UI and role-based filtering.

### Quick Summary
- Swimlanes by production role
- Tasks grouped: Available, In Progress, Pending
- Sort by due date, priority
- One-click task completion

```
DESIGNER (Jane)    |  Available (5)  |  In Progress (1)  |  Pending (3)
VINYL/CNC          |  Available (8)  |  In Progress (2)  |  Pending (12)
CUT & BEND         |  Available (4)  |  In Progress (1)  |  Pending (8)
...
```

---

## Tab 4: Jobs Table

### Purpose
Comprehensive searchable/filterable table view of all orders.

### Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│  JOBS TABLE                                                             │
│  ───────────────────────────────────────────────────────────────────── │
│  Search: ⌕ _______________  Filters: [Stage ▼] [Priority ▼] [Designer ▼]│
│  Show: [● Active] [ ] All [ ] Overdue Only        Export: [CSV] [PDF]  │
└────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ Order #  │ Customer     │ Description      │ Stage        │ Progress│ Due│
├──────────┼──────────────┼──────────────────┼──────────────┼─────────┼────┤
│ SO-2025  │ ABC Sign Co  │ Channel Letters  │ In Prod      │ 35% ████│11/15│
│ -0431    │              │ + Backer         │              │         │     │
│ [View]   │              │                  │ 🔴 High Pri  │         │ 12d │
├──────────┼──────────────┼──────────────────┼──────────────┼─────────┼────┤
│ SO-2025  │ XYZ Corp     │ Flat Cut Letters │ Pending Conf │ 0%      │11/20│
│ -0428    │              │                  │ ⚠️ 72h no resp│         │     │
│ [View]   │              │                  │              │         │ 17d │
├──────────┼──────────────┼──────────────────┼──────────────┼─────────┼────┤
│ ...      │              │                  │              │         │     │
└─────────────────────────────────────────────────────────────────────────┘

Showing 1-25 of 47 active orders | [< Previous] [Next >]
```

### Column Options (Configurable)
- ✅ Order Number (always visible)
- ✅ Customer
- ✅ Description / Product Type
- ✅ Kanban Stage
- ✅ Progress %
- ✅ Due Date / Days Remaining
- ⚙️ Created Date
- ⚙️ Designer Assigned
- ⚙️ Total Value
- ⚙️ Invoice Status
- ⚙️ Last Updated

### Sorting
- Click column headers to sort
- Multi-column sort (Shift+Click)
- Default: Due Date ascending

### Filters
- **Stage**: Any, or specific stage(s)
- **Priority**: Any, High, Normal, Low
- **Designer**: Any, or specific designer
- **Customer**: Any, or specific customer
- **Due Date Range**: Custom date picker
- **Progress**: < 25%, 25-50%, 50-75%, > 75%
- **Invoice Status**: Draft, Sent, Paid, Overdue

---

## Tab 5: Calendar View

### Purpose
Visual representation of due dates and milestones.

### Layout

**NOTE**: Calendar view is a side-scrolling horizontal view like a table, with dates at the top and jobs flowing downward. This prioritizes visualizing upcoming jobs with more details per job. All overdue jobs will be in one column on the left, ordered by their due date.

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  ORDERS CALENDAR                            [< Oct 2025  Nov >]     Scroll → → →    │
│  ────────────────────────────────────────────────────────────────────────────────── │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌──────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│ OVERDUE  │ Nov 1   │ Nov 2   │ Nov 3   │ Nov 4   │ Nov 5   │ Nov 6   │  ...    │
│ (by date)│         │         │         │         │         │         │         │
├──────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ SO-0380  │         │ SO-0431 │ SO-0432 │         │ SO-0433 │ SO-0434 │         │
│ ABC Sign │         │ XYZ Corp│ DEF Co  │         │ GHI Inc │ JKL Ltd │         │
│ 6d late  │         │ Letters │ Panel   │         │ Cabinet │ Pylon   │         │
│ 🔴       │         │ 35%     │ 10%     │         │ 60%     │ 5%      │         │
├──────────┤         ├─────────┼─────────┤         ├─────────┼─────────┤         │
│ SO-0385  │         │ SO-0435 │         │         │ SO-0436 │         │         │
│ XYZ Inc  │         │ MNO Co  │         │         │ PQR Inc │         │         │
│ 3d late  │         │ Signs   │         │         │ Letters │         │         │
│ 🔴       │         │ 80%     │         │         │ 15%     │         │         │
└──────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘
```

**Details per job card**:
- Order number
- Customer name
- Product type (brief)
- Progress percentage
- Status indicator (color coded for overdue)

### Event Types
- 📅 **Due Date** (primary)
- 🎨 **Design Proof Due**
- 🏭 **Production Start Date**
- 📦 **Ship Date**
- 💰 **Payment Due Date**

### Color Coding
- 🟢 Green: On schedule, no issues
- 🟡 Yellow: Approaching due date (< 3 days)
- 🔴 Red: Overdue
- 🔵 Blue: Completed early

### Interactions
- Click event → View order details
- Drag event → Change due date (Manager only)
- Hover → Tooltip with quick info

---

## Tab 6: Completed Jobs

### Purpose
Archive of finished orders with analytics.

### Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│  COMPLETED JOBS                                                         │
│  ───────────────────────────────────────────────────────────────────── │
│  Filter by date: [Last 30 days ▼]  Customer: [All ▼]  Search: ⌕       │
└────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  📊 PERFORMANCE SUMMARY (Last 30 Days)                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  Jobs Completed: 28                                                      │
│  On-Time: 24 (86%)      Late: 4 (14%)                                   │
│  Avg Completion Time: 8.5 days                                           │
│  Total Revenue: $87,450                                                  │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ Order #  │ Customer   │ Completed │ On-Time? │ Revenue │ Profit │ Action│
├──────────┼────────────┼───────────┼──────────┼─────────┼────────┼───────┤
│ SO-2025  │ ABC Co     │ Oct 28    │ ✅ Yes   │ $3,277  │ 42%    │[View] │
│ -0401    │            │           │ (-2 days)│         │        │       │
├──────────┼────────────┼───────────┼──────────┼─────────┼────────┼───────┤
│ SO-2025  │ Demo Inc   │ Oct 25    │ ❌ No    │ $5,120  │ 38%    │[View] │
│ -0380    │            │           │ (+3 days)│         │        │       │
├──────────┼────────────┼───────────┼──────────┼─────────┼────────┼───────┤
│ ...      │            │           │          │         │        │       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Analytics Features (Future)
- Trend charts (completion time, on-time rate)
- Revenue by product type
- Most profitable customers
- Average profit margins

---

## Tab 7: Settings

### Purpose
Configure templates, preferences, and system settings.

### Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│  ORDERS SETTINGS                                                        │
│  ───────────────────────────────────────────────────────────────────── │
│  [Product Templates] [Task Templates] [Email Templates] [Preferences]  │
└────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  PRODUCT TEMPLATES                                                       │
├─────────────────────────────────────────────────────────────────────────┤
│  Define how different product types generate tasks and materials.       │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Channel Letters Template                              [Edit] [Copy]│ │
│  │ Auto-generates: 12 tasks | Materials: 8 types                      │ │
│  │ Last modified: Oct 15, 2025 by Jon                                 │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  [+ Create New Template]                                                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Modals & Drawers

### 1. Order Details Modal

The primary modal for viewing/editing complete order information.

```
┌────────────────────────────────────────────────────────────────────────┐
│  ORDER #200431 - ABC Sign Company                            [Edit] [X]│
├────────────────────────────────────────────────────────────────────────┤
│  [Overview] [Parts] [Tasks] [Timeline] [Invoice] [Forms] [Materials]  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  OVERVIEW TAB                                                           │
│  ───────────────────────────────────────────────────────────────────── │
│  Status: In Production (35% complete) ████░░░░░░░                       │
│  Created: Oct 31, 2025 | Due: Nov 15, 2025 (12 days remaining)        │
│  Priority: High | Designer: Jane Doe                                    │
│                                                                         │
│  CUSTOMER INFORMATION                                                   │
│  ABC Sign Company | John Smith | (555) 123-4567                       │
│  [View Full Customer Details]                                           │
│                                                                         │
│  PARTS (2)                                                              │
│  1. Channel Letters 'OPEN' w/ LEDs - $2,450                            │
│  2. ACM Backer Panel - $450                                             │
│  [View Part Details]                                                    │
│                                                                         │
│  QUICK ACTIONS                                                          │
│  [Generate Order Form] [Send to Customer] [Record Payment]             │
│  [Change Due Date] [Add Note]           (Phase 4+: [Assign Designer])  │
│                                                                         │
│  NOTES                                                                  │
│  Rush job - customer needs by Nov 16 for grand opening.                │
│  [+ Add Note]                                                           │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

### 2. Order Landing Modal (Convert Estimate to Order)

```
┌────────────────────────────────────────────────────────────────────────┐
│  CREATE ORDER FROM ESTIMATE EST-2025-0320                    [Save] [X]│
├────────────────────────────────────────────────────────────────────────┤
│  Step 1 of 3: Review Estimate Data                        [Next Step >]│
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Customer: ABC Sign Company ✓                                           │
│  Total: $3,277.00                                                       │
│  Estimated Line Items: 4                                                │
│                                                                         │
│  Due Date: [Nov 15, 2025 📅]                                           │
│  Priority: [● High] [ ] Normal [ ] Low                                  │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘

(Next step: Build parts structure)
(Final step: Review and create order)
```

### 3. Task Detail Drawer

Slides in from right side when clicking a task.

```
┌────────────────────────────────────────┐
│  TASK DETAILS                      [X] │
├────────────────────────────────────────┤
│  #200431 | ABC Sign Co                 │
│  Cut vinyl faces for channel letters   │
│                                        │
│  Role: Vinyl/CNC                       │
│  Status: Available                     │
│  Due: Nov 5, 2025 (2 days)            │
│                                        │
│  Dependencies:                         │
│  ✅ Designer: Create vector files      │
│                                        │
│  Description:                          │
│  Cut red 3M vinyl (100-13) for        │
│  letter faces. Approx 7.8 sq ft.      │
│                                        │
│  [Start Task] [View Full Order]       │
│                                        │
│  Time Tracking (Future):               │
│  [ ] Track time for this task          │
│                                        │
└────────────────────────────────────────┘
```

---

## Responsive Design Considerations

### Desktop (> 1280px)
- Full tab navigation visible
- Kanban board shows 4-5 stages at once
- Side-by-side panels for details

### Tablet (768px - 1280px)
- Tabs collapse to dropdown on smaller screens
- Kanban board scrolls horizontally
- Modals take 80% width

### Mobile (< 768px)
- Hamburger menu for navigation
- Single column layouts
- Simplified dashboard with collapsible sections
- Swipe gestures for Kanban

**Note**: Initial implementation can be desktop-first, mobile optimization in Phase 2.

---

## Color Scheme & Visual Design

### Status Colors
- 🔴 **Red (#DC3545)**: Overdue, urgent, errors
- 🟡 **Yellow (#FFC107)**: Warnings, approaching deadline
- 🟢 **Green (#28A745)**: On track, completed, success
- 🔵 **Blue (#007BFF)**: Info, in progress, active
- ⚫ **Gray (#6C757D)**: Inactive, pending, archived

### Kanban Stage Colors
- Initiated: Light blue
- Pending Confirmation: Orange
- Details Confirmed: Light green
- In Production: Blue
- Overdue: Red
- Completed: Green

### Typography
- **Headers**: Bold, 18-24px
- **Body**: Regular, 14-16px
- **NOTE**: Do NOT use monospace font. Make it beautiful and easy to read.

---

## Loading States & Empty States

### Loading State
```
┌────────────────────────────────────────┐
│         ⏳ Loading orders...           │
│                                        │
│         [Spinner animation]            │
└────────────────────────────────────────┘
```

### Empty State (No Orders)
```
┌────────────────────────────────────────────────────┐
│         📋 No orders yet                           │
│                                                    │
│  Convert an approved estimate to create your       │
│  first order.                                      │
│                                                    │
│         [Go to Job Estimation]                     │
└────────────────────────────────────────────────────┘
```

### Empty State (No Results)
```
┌────────────────────────────────────────────────────┐
│         🔍 No orders found                         │
│                                                    │
│  Try adjusting your filters or search term.       │
│                                                    │
│         [Clear Filters]                            │
└────────────────────────────────────────────────────┘
```

---

## Notifications & Alerts

### In-App Notifications
- Bell icon in header
- Badge count for unread
- Dropdown list of recent notifications

### Notification Types
- 🔔 Customer approved order
- 🔔 Task completed by team member
- 🔔 Order moved to new stage
- 🔔 Invoice paid
- ⚠️ Order overdue
- ⚠️ No customer response in 72 hours
- ⚠️ Materials needed for job

### Email Notifications (Optional Settings)
- Daily summary of priorities
- Overdue job alerts
- Customer approval received
- Payment received

---

## Keyboard Shortcuts (Future)

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Global search |
| `Ctrl+N` | New order |
| `Ctrl+F` | Filter current view |
| `/` | Focus search box |
| `Esc` | Close modal/drawer |
| `→` | Next Kanban stage (when job selected) |
| `←` | Previous Kanban stage |
| `1-7` | Switch tabs (1=Dashboard, 2=Kanban, etc.) |

---

## Accessibility

### WCAG 2.1 AA Compliance
- ✅ Sufficient color contrast (4.5:1 minimum)
- ✅ Keyboard navigation for all interactive elements
- ✅ Screen reader compatible (ARIA labels)
- ✅ Focus indicators visible
- ✅ Alt text for icons and images

### Semantic HTML
- Proper heading hierarchy (h1 → h2 → h3)
- `<button>` for actions, `<a>` for navigation
- Form labels associated with inputs
- Table headers (`<th>`) for data tables

---

## Performance Optimization

### Initial Load
- Load dashboard data first (< 1s)
- Lazy load other tabs on click
- Paginate large lists (25 items per page)

### Real-Time Updates
- Poll every 30 seconds for active views
- Use optimistic UI updates (instant feedback)
- Background sync for offline changes (future)

### Caching
- Cache order list for 5 minutes
- Invalidate on create/update/delete
- Use React Query or SWR for smart caching

---

## Next Steps

1. ✅ Define UI structure and workflows (this document)
2. Create wireframes/mockups in Figma (optional)
3. Build React component structure
4. Implement tab navigation and routing
5. Design reusable UI components (cards, modals, etc.)
6. Build dashboard landing page
7. Integrate with backend APIs

---

**Document Status**: Initial Planning - Complete
**Last Updated**: 2025-10-31
**Dependencies**: All other Orders Page documents
