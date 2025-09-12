# Estimate Versioning System - Implementation Guide

## Overview
The Estimate Versioning System implements a **Customer → Jobs → Estimate Versions** hierarchy with immutable audit trail capabilities. Once estimates are finalized, they cannot be modified, ensuring complete audit compliance and preventing accidental overwrites.

## Architecture

### Database Schema

#### Core Tables
```sql
-- Jobs table - Container for estimate versions
CREATE TABLE jobs (
  job_id INT PRIMARY KEY AUTO_INCREMENT,
  job_number VARCHAR(50) UNIQUE NOT NULL,    -- Format: 2025-001
  customer_id INT NOT NULL,                  -- Links to customers table
  job_name VARCHAR(255),                     -- User-defined job name
  status ENUM('quote', 'active', 'production', 'completed', 'cancelled'),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

-- Enhanced job_estimates table with versioning
CREATE TABLE job_estimates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  job_code VARCHAR(20) UNIQUE NOT NULL,     -- Format: CH20250902007v1
  job_id INT NOT NULL,                      -- Links to jobs table
  customer_id INT,                          -- Denormalized for performance
  version_number INT NOT NULL DEFAULT 1,   -- Auto-incrementing per job
  parent_estimate_id INT NULL,              -- Which estimate this was copied from
  is_draft BOOLEAN DEFAULT TRUE,            -- Draft = editable, FALSE = immutable
  finalized_at TIMESTAMP NULL,              -- When estimate became immutable
  finalized_by_user_id INT NULL,            -- Who finalized the estimate
  status ENUM('draft', 'sent', 'approved', 'ordered', 'archived') DEFAULT 'draft',
  -- ... other existing fields
  FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON DELETE CASCADE,
  FOREIGN KEY (parent_estimate_id) REFERENCES job_estimates(id) ON DELETE SET NULL,
  UNIQUE KEY unique_job_version (job_id, version_number)
);
```

### Data Flow

```
Customer Selection
    ↓
Job Selection (Combobox: Existing jobs + "Create New")
    ↓
Version Action Selection:
  - Edit Draft (if exists)
  - Create New Version
  - Create New Version from Existing (duplicate)
    ↓
Estimate Builder Interface
    ↓
Save Action:
  - Save Draft (remains editable)
  - Save Final (becomes immutable: sent/approved/ordered)
```

## API Endpoints

### Job Management
```typescript
// Get all jobs for a customer
GET /api/job-estimation/customers/:customerId/jobs
Response: JobSummary[]

// Create a new job
POST /api/job-estimation/jobs
Body: { customer_id: number, job_name: string }
Response: { job_id: number }

// Get job details
GET /api/job-estimation/jobs/:jobId
Response: Job with customer info
```

### Estimate Version Management
```typescript
// Get all estimate versions for a job
GET /api/job-estimation/jobs/:jobId/estimates
Response: EstimateVersion[] (sorted by version_number)

// Create new estimate version
POST /api/job-estimation/jobs/:jobId/estimates
Body: { parent_estimate_id?: number, notes?: string }
Response: { estimate_id: number }

// Check if estimate can be edited
GET /api/job-estimation/estimates/:estimateId/can-edit
Response: { can_edit: boolean }
```

### Draft/Final Workflow
```typescript
// Save draft (keeps editable)
POST /api/job-estimation/estimates/:estimateId/save-draft
Response: { success: true, message: "Draft saved successfully" }

// Finalize estimate (make immutable)
POST /api/job-estimation/estimates/:estimateId/finalize
Body: { status: "sent" | "approved" | "ordered" | "archived" }
Response: { success: true, message: "Estimate finalized as sent" }

// Duplicate estimate as new version
POST /api/job-estimation/estimates/:estimateId/duplicate
Body: { target_job_id?: number, notes?: string }
Response: { estimate_id: number }
```

## Business Rules

### Version Control Rules
1. **Draft Estimates**: 
   - `is_draft = TRUE`
   - Fully editable (groups, items, addons)
   - Can be deleted
   - Auto-save enabled

2. **Finalized Estimates**:
   - `is_draft = FALSE` 
   - **Completely immutable** - cannot be modified
   - Cannot be deleted
   - Audit trail preserved forever

3. **Version Numbering**:
   - Auto-increments per job: v1, v2, v3...
   - Unique constraint prevents conflicts
   - Job codes include version: `CH20250902007v1`

4. **Parent Relationships**:
   - `parent_estimate_id` tracks estimate history
   - Enables "created from v2" audit trail
   - Supports branching: v1 → v2a, v1 → v2b

### Workflow States
```
Draft → Save Draft → (remains Draft)
Draft → Save Final → Sent → (immutable)
Draft → Save Final → Approved → (immutable, job status = active)
Draft → Save Final → Ordered → (immutable, job status = production)
```

## Frontend Integration Points

### Required UI Components

#### Job Selection Interface
```typescript
interface JobSelector {
  customerId: number;
  onJobSelected: (jobId: number) => void;
  onCreateNewJob: (jobName: string) => void;
}

// Features:
// - Combobox with existing job names
// - "Create New Job" option
// - Shows job status and estimate count
```

#### Version Management Interface  
```typescript
interface VersionManager {
  jobId: number;
  currentEstimateId?: number;
  onVersionSelected: (estimateId: number) => void;
  onCreateNewVersion: (parentId?: number) => void;
}

// Features:
// - Version list with status indicators
// - "Edit Draft" vs "View Final" buttons
// - "Create New Version" button
// - "Duplicate from v2" functionality
```

#### Draft/Final Action Buttons
```typescript
interface EstimateActions {
  estimateId: number;
  isDraft: boolean;
  onSaveDraft: () => void;
  onFinalize: (status: FinalStatus) => void;
}

// Features:
// - "Save Draft" button (always available for drafts)
// - "Save Final" dropdown (Send to Customer, Mark Approved, Mark Ordered)
// - Confirmation dialogs for finalization
// - Status indicators
```

## Implementation Examples

### Creating a Complete Workflow
```typescript
// 1. Customer selects job
const jobs = await api.getJobsByCustomer(customerId);

// 2. User creates new job or selects existing
const jobId = await api.createJob({
  customer_id: customerId,
  job_name: "Storefront Signage Project"
});

// 3. Create first estimate version
const estimateId = await api.createEstimateVersion(jobId, {
  notes: "Initial estimate"
});

// 4. User builds estimate in GridJobBuilder...

// 5. Save as draft (editable)
await api.saveDraft(estimateId);

// 6. Finalize when ready
await api.finalizeEstimate(estimateId, { status: "sent" });

// 7. Create revision if needed
const revisionId = await api.createEstimateVersion(jobId, {
  parent_estimate_id: estimateId,
  notes: "Revised pricing based on customer feedback"
});
```

### Status Checking and Protection
```typescript
// Check if estimate can be edited
const canEdit = await api.checkEditPermission(estimateId);

if (canEdit.can_edit) {
  // Show normal editing interface
  showEstimateBuilder(estimateId);
} else {
  // Show read-only view with "Create New Version" option
  showReadOnlyView(estimateId, {
    onCreateNewVersion: () => createVersionFromExisting(estimateId)
  });
}
```

## Database Views for Frontend

### Job Summary View
```sql
CREATE VIEW job_summary AS
SELECT 
  j.job_id,
  j.job_number,
  j.job_name,
  j.customer_id,
  c.company_name as customer_name,
  j.status as job_status,
  COUNT(e.id) as estimate_count,
  COUNT(CASE WHEN e.is_draft = TRUE THEN 1 END) as draft_count,
  COUNT(CASE WHEN e.is_draft = FALSE THEN 1 END) as finalized_count,
  MAX(e.version_number) as latest_version,
  MAX(e.updated_at) as last_activity
FROM jobs j
LEFT JOIN customers c ON j.customer_id = c.customer_id
LEFT JOIN job_estimates e ON j.job_id = e.job_id
GROUP BY j.job_id, j.job_number, j.job_name, j.customer_id, c.company_name, j.status;
```

### Estimate Version Summary View  
```sql
CREATE VIEW job_estimate_summary AS
SELECT 
  e.id,
  e.job_code,
  j.job_id,
  j.job_name,
  j.job_number,
  e.version_number,
  CONCAT('v', e.version_number) as version_label,
  e.customer_id,
  c.company_name as customer_name,
  e.status,
  e.is_draft,
  CASE WHEN e.is_draft THEN 'Draft' ELSE e.status END as display_status,
  e.subtotal,
  e.tax_rate,
  e.tax_amount, 
  e.total_amount,
  e.parent_estimate_id,
  pe.version_number as parent_version,
  e.finalized_at,
  fu.username as finalized_by,
  e.created_at,
  e.updated_at,
  cu.username as created_by_name
FROM job_estimates e
JOIN jobs j ON e.job_id = j.job_id
LEFT JOIN customers c ON e.customer_id = c.customer_id
LEFT JOIN job_estimates pe ON e.parent_estimate_id = pe.id
LEFT JOIN users fu ON e.finalized_by_user_id = fu.id
LEFT JOIN users cu ON e.created_by = cu.id;
```

## Benefits Achieved

### Audit Compliance
- ✅ **Immutable Records**: Finalized estimates cannot be changed
- ✅ **Complete History**: Every version preserved with timestamps
- ✅ **User Accountability**: Who created/modified/finalized each version
- ✅ **Parent Tracking**: Full lineage of estimate revisions

### Business Process Improvement
- ✅ **Version Control**: Like Git for estimates - no more confusion
- ✅ **Parallel Versions**: Multiple team members can work on different versions
- ✅ **Customer Communication**: Clear version references in quotes
- ✅ **Legal Protection**: Immutable record of what was quoted

### Technical Excellence
- ✅ **Conflict Prevention**: Unique constraints prevent version collisions
- ✅ **Performance**: Indexed queries and optimized views
- ✅ **Scalability**: Supports high-volume estimate creation
- ✅ **Data Integrity**: Foreign keys and referential integrity

## Migration Notes

The system was migrated from the old `estimate_name` approach to the new job-based versioning system. The migration:

1. Clears all existing estimate data for a fresh start
2. Adds versioning columns to `job_estimates` table
3. Creates foreign key relationships
4. Establishes unique constraints
5. Creates helper views for frontend queries

**All new estimates created use the versioning system by default.**

---

---

# Frontend Implementation Plan

## Database Schema Extensions Required

### Edit Lock System
```sql
ALTER TABLE job_estimates ADD COLUMN editing_user_id INT NULL;
ALTER TABLE job_estimates ADD COLUMN editing_started_at TIMESTAMP NULL;
ALTER TABLE job_estimates ADD COLUMN editing_expires_at TIMESTAMP NULL;
ALTER TABLE job_estimates ADD COLUMN editing_locked_by_override BOOLEAN DEFAULT FALSE;
ALTER TABLE job_estimates ADD FOREIGN KEY (editing_user_id) REFERENCES users(id);
```

### Enhanced Status Flag System
```sql
ALTER TABLE job_estimates ADD COLUMN is_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE job_estimates ADD COLUMN is_approved BOOLEAN DEFAULT FALSE; 
ALTER TABLE job_estimates ADD COLUMN is_retracted BOOLEAN DEFAULT FALSE;
ALTER TABLE job_estimates ADD COLUMN sent_count INT DEFAULT 0;
ALTER TABLE job_estimates ADD COLUMN last_sent_at TIMESTAMP NULL;
ALTER TABLE job_estimates ADD COLUMN approved_at TIMESTAMP NULL;
ALTER TABLE job_estimates ADD COLUMN retracted_at TIMESTAMP NULL;
```

## Frontend Components Architecture

### Component Implementation Order

#### **Phase 1: API Foundation**
**File**: `frontend/web/src/services/api.ts` (~100 additional lines)
- Job name validation endpoint
- Edit lock acquisition/release system  
- Enhanced status flag endpoints
- Auto-expire edit locks after 24 hours

#### **Phase 2: Core Workflow Components**

**A. JobSelector Component** (~180 lines)
**File**: `frontend/web/src/components/jobEstimation/JobSelector.tsx`
- Customer selection (reuse existing patterns)
- Job combobox with version counts
- Job creation modal with duplicate name validation
- Error suggestions: "Try: JobName - Location or JobName - Month/Year"

**B. VersionManager Component** (~250 lines)  
**File**: `frontend/web/src/components/jobEstimation/VersionManager.tsx`
- Table format: Version | Status Flags | Total | Created By | Date | Actions
- Edit lock detection: "User X is currently editing"
- Override edit lock (Manager+ only)
- Status badges: Draft, Sent x2, Approved, Retracted, Ordered

**C. EstimateActions Component** (~200 lines)
**File**: `frontend/web/src/components/jobEstimation/EstimateActions.tsx`

**Draft Actions**:
- Save Draft (keeps editable)
- Save Final Dropdown:
  - Send to Customer → `is_sent=true`, `sent_count++`
  - Mark Approved → `is_approved=true`
  - Convert to Order → Creates order workflow
  - Retract from Customer → `is_retracted=true`

**Final Actions**:
- Send Again (for sent estimates)
- Mark Not Approved (for approved)
- Retract from Customer
- Create New Version

#### **Phase 3: Supporting Components**

**D. EditLockManager Component** (~100 lines)
**File**: `frontend/web/src/components/jobEstimation/EditLockManager.tsx`
- Auto-acquire lock on edit mode entry
- Heartbeat system for active locks
- Auto-release on page leave
- Lock conflict resolution

**E. BreadcrumbNavigation Component** (~80 lines)
**File**: `frontend/web/src/components/jobEstimation/BreadcrumbNavigation.tsx`
- Format: "Job Estimation > Customer > Job Name > v3 (Draft)"

#### **Phase 4: Integration Updates**

**F. JobEstimationDashboard Updates** (+200 lines to existing)
- Multi-step workflow state management
- Customer → Job → Version → Builder flow
- Breadcrumb integration
- Back navigation handling

**G. GridJobBuilder Integration** (+50 lines)
- Version context in header
- Edit lock integration
- Read-only mode for finalized estimates
- EstimateActions component integration

## Business Logic Requirements

### Job Creation Rules
- **Uniqueness**: Block duplicate job names per customer
- **Error Handling**: Suggest "JobName - Location" or "JobName - Month/Year"
- **Auto-Creation**: Job created when first estimate is created

### Edit Lock System  
- **Duration**: 24-hour auto-expiry
- **Conflicts**: "User X is editing" with options: View Only, Duplicate, Override (Manager+)
- **Heartbeat**: Maintain lock during active editing
- **Auto-Release**: On page navigation or browser close

### Status Flag System
- **Multiple Flags**: Can be Sent AND Approved simultaneously  
- **Send Counter**: Track how many times estimate was sent
- **Workflow States**:
  - Draft → Sent → Approved → Ordered (main flow)
  - Any state → Retracted (error correction)
  - Approved → Not Approved (customer rejection)

### Version Management
- **Immutability**: Once finalized (`is_draft=false`), cannot edit
- **Version Numbers**: Auto-increment per job (v1, v2, v3...)
- **Parent Tracking**: New versions link to source via `parent_estimate_id`
- **Conflict Prevention**: Only one draft per job can be edited at a time

## User Experience Flow

### Complete Workflow
1. **Customer Selection** → Load customer jobs
2. **Job Selection/Creation** → Load estimate versions  
3. **Version Action Selection**:
   - Edit Draft → Acquire lock → GridJobBuilder (editable)
   - View Final → GridJobBuilder (read-only)
   - Create New → Create version → GridJobBuilder (editable)
4. **Estimate Building** → Work in GridJobBuilder with version context
5. **Save Actions**:
   - Save Draft → Release lock → Return to version manager
   - Save Final → Status selection → Release lock → Return to estimates list

### Error Prevention
- Job name uniqueness validation
- Edit lock conflicts resolution
- Finalization confirmation dialogs
- Auto-save during editing
- Lock expiry warnings

## Implementation Success Criteria

### Technical Requirements
- ✅ All components under 500 lines per CLAUDE.md rules
- ✅ Proper TypeScript interfaces and error handling
- ✅ Integration with existing authentication/RBAC system
- ✅ Database referential integrity maintained
- ✅ Edit locks prevent concurrent editing conflicts

### Business Requirements  
- ✅ Customer → Job → Version workflow implemented
- ✅ Draft estimates remain editable, finalized are immutable
- ✅ Version history preserved for audit compliance
- ✅ Status flags support complex business workflows
- ✅ Edit conflicts resolved gracefully
- ✅ Navigation breadcrumbs provide clear context

---

## Next Steps

1. **Frontend Implementation**: Execute the detailed component plan above
2. **Database Extensions**: Add edit lock and status flag columns
3. **API Extensions**: Implement edit lock and enhanced status endpoints  
4. **Integration Testing**: End-to-end workflow validation
5. **Material Integration**: Connect finalized estimates to material requirements
6. **Invoice Generation**: Auto-generate invoices from finalized estimates

The complete implementation plan is ready for immediate development execution.