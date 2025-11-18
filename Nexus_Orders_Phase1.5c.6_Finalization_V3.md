# Phase 1.5.c.6 V3: Order Finalization - Prepare & Send Workflow

**Status:** 📋 Ready to Implement
**Priority:** HIGH (Final integration)
**Duration:** 3-4 days (~24-32 hours total, split into 3 sub-phases)
**Dependencies:**
- All previous subphases (1.5.c.1-1.5.c.5)
- QuickBooks OAuth configured (Phase 1)
- Gmail API setup (deferred - placeholder only)
**Last Updated:** 2025-11-17
**Version:** 3.0 (Simplified two-phase workflow)

---

## Overview

Phase 1.5.c.6 V3 implements a streamlined two-phase finalization workflow:
1. **Prepare Order** - Create QB estimate, generate PDFs, save to folder, generate tasks
2. **Send to Customer** - Select recipients, send email (placeholder), update status

**Key Design Principles:**
- Single modal that transitions between phases
- Manual QB estimate creation with staleness detection
- Parallel step execution where possible
- Individual step buttons + "Do All Steps" option
- Live PDF previews as they generate
- No intermediate status (stays `job_details_setup` until final send)

---

## Architecture: Split into 3 Sub-Phases

### **Phase 1.5.c.6.1: Core Infrastructure** (8-10 hours)
- PrepareOrderModal component with step orchestration
- Step state management system
- Database schema updates (QB estimate tracking)
- Modal transition logic (Prepare → Send)

### **Phase 1.5.c.6.2: Prepare Steps Implementation** (10-12 hours)
- Validation step (placeholder)
- QB estimate creation with staleness detection
- PDF generation (Order Form + QB Estimate)
- PDF storage to SMB folder
- Task generation (placeholder)
- Live PDF preview panel

### **Phase 1.5.c.6.3: Send to Customer** (6-10 hours)
- Point person selection UI
- Email sending (placeholder with Gmail structure)
- Status update to `pending_confirmation`
- Final integration testing

---

## Visual Design Reference

### 1. OrderHeader with Prepare Button

```
┌────────────────────────────────────────────────────────────────────┐
│  ← Order #200001 - Channel Letters                    Status: ●    │
│                                                                     │
│  [Specs & Invoice]  [Job Progress]                                 │
│                                                                     │
│  [Generate Order Forms] [Print Forms] [View Forms ▼]               │
│  [Prepare Order] ← NEW                                             │
└────────────────────────────────────────────────────────────────────┘
```

---

### 2. Prepare Order Modal (Phase 1)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Prepare Order #200001 - Channel Letters                       [×] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────── LEFT: Steps & Controls ──────┬──── RIGHT: PDF Previews ──┐│
│  │                                     │                           ││
│  │  Preparation Steps:                │ ┌───────────────────────┐ ││
│  │                                     │ │ Order Form - Specs    │ ││
│  │  1. [✓] Validation                  │ │                       │ ││
│  │     Status: All checks passed       │ │ [PDF Preview]         │ ││
│  │     [Re-run Validation]             │ │ Loading...            │ ││
│  │                                     │ │                       │ ││
│  │  2. [ ] Create QuickBooks Estimate │ │                       │ ││
│  │     ⚠ Estimate not created yet     │ └───────────────────────┘ ││
│  │     [Create QB Estimate]            │                           ││
│  │                                     │ ┌───────────────────────┐ ││
│  │  3. [ ] Generate Order Form PDFs   │ │ QB Estimate           │ ││
│  │     Status: Pending                 │ │                       │ ││
│  │     [Generate PDFs]                 │ │ [PDF Preview]         │ ││
│  │                                     │ │ Not created yet       │ ││
│  │  4. [ ] Download QB Estimate PDF   │ │                       │ ││
│  │     Status: Pending (requires #2)   │ └───────────────────────┘ ││
│  │     [Download PDF]                  │                           ││
│  │                                     │ (Scrollable)              ││
│  │  5. [ ] Save PDFs to Folder         │                           ││
│  │     Folder: Job Name ----- Customer │                           ││
│  │     [Save to Folder]                │                           ││
│  │                                     │                           ││
│  │  6. [ ] Generate Production Tasks  │                           ││
│  │     Status: Pending (Phase 1.5.d)   │                           ││
│  │     [Generate Tasks]                │                           ││
│  │                                     │                           ││
│  │  ─────────────────────────────────  │                           ││
│  │                                     │                           ││
│  │  Quick Actions:                     │                           ││
│  │  [Do All Steps]                     │                           ││
│  │  [Skip to Step...]                  │                           ││
│  │                                     │                           ││
│  │  Progress: 1/6 complete (17%)       │                           ││
│  └─────────────────────────────────────┴───────────────────────────┘│
│                                                                     │
│  [Cancel]              [Next: Send to Customer] (disabled until 2-5│
│                                                            complete)│
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3. Send to Customer Modal (Phase 2 - Same Modal Transitioned)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Send to Customer #200001 - Channel Letters                    [×] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────── LEFT: Recipients & Preview ──┬──── RIGHT: PDF Previews ──┐│
│  │                                     │                           ││
│  │  Select Recipients:                │ ┌───────────────────────┐ ││
│  │  ☑ John Smith (john@customer.com)  │ │ Order Form - Specs    │ ││
│  │  ☑ Jane Doe (jane@customer.com)    │ │                       │ ││
│  │  ☐ Bob Wilson (bob@customer.com)   │ │ [PDF Ready]           │ ││
│  │                                     │ │                       │ ││
│  │  ─────────────────────────────────  │ │                       │ ││
│  │                                     │ └───────────────────────┘ ││
│  │  Email Preview:                     │                           ││
│  │  Subject: Order #200001 Ready       │ ┌───────────────────────┐ ││
│  │                                     │ │ QB Estimate           │ ││
│  │  Body:                              │ │                       │ ││
│  │  ┌─────────────────────────────┐   │ │ [PDF Ready]           │ ││
│  │  │ Dear Customer,               │   │ │                       │ ││
│  │  │                              │   │ │                       │ ││
│  │  │ Your order is ready for      │   │ └───────────────────────┘ ││
│  │  │ approval...                  │   │                           ││
│  │  │                              │   │                           ││
│  │  │ [Attachments]                │   │                           ││
│  │  │ - Order Form - Specs.pdf     │   │                           ││
│  │  │ - QB Estimate EST-12345.pdf  │   │                           ││
│  │  └─────────────────────────────┘   │                           ││
│  │                                     │                           ││
│  │  ⚠ Note: Email sending is          │                           ││
│  │  placeholder (Gmail API integration │                           ││
│  │  pending)                           │                           ││
│  └─────────────────────────────────────┴───────────────────────────┘│
│                                                                     │
│  [← Back to Prepare]        [Skip Email] [Send Email & Finalize]   │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 4. Step Status Visual States

```
┌─ Step States ────────────────────────────────────┐
│                                                   │
│  [ ] Pending     - White background, black text  │
│  [⏳] Running    - Blue background, spinner       │
│  [✓] Complete   - Gray background, green check  │
│  [✗] Failed     - Red background, X icon         │
│                                                   │
│  Buttons:                                         │
│  [Run Step]      - Blue (pending)                │
│  [Running...]    - Blue + spinner (in progress)  │
│  [✓ Complete]    - Gray (completed, can re-run)  │
│  [⚠ Retry]       - Orange (failed)               │
└───────────────────────────────────────────────────┘
```

---

## Component Architecture

### Frontend Component Hierarchy

```
OrderHeader.tsx (Modified)
├── [Existing buttons...]
└── PrepareOrderButton.tsx (~40 lines) [NEW]
    └── Opens PrepareOrderModal

PrepareOrderModal.tsx (~500 lines) [NEW - PHASE 1.5.c.6.1]
├── Phase state: 'prepare' | 'send'
├── Step state management
└── Phase-specific content

  ┌─ PHASE 1: PREPARE ──────────────────────────────┐
  │                                                  │
  ├── Left Panel: PrepareStepsPanel.tsx (~300 lines) [PHASE 1.5.c.6.2]
  │   ├── StepList.tsx (~200 lines)
  │   │   ├── ValidationStep.tsx (~60 lines)
  │   │   ├── QBEstimateStep.tsx (~100 lines)
  │   │   ├── GeneratePDFsStep.tsx (~80 lines)
  │   │   ├── DownloadQBPDFStep.tsx (~60 lines)
  │   │   ├── SaveToFolderStep.tsx (~60 lines)
  │   │   └── GenerateTasksStep.tsx (~60 lines)
  │   │
  │   └── QuickActions.tsx (~100 lines)
  │       ├── DoAllStepsButton
  │       └── SkipToStepDropdown
  │
  └── Right Panel: LivePDFPreviewPanel.tsx (~250 lines) [PHASE 1.5.c.6.2]
      ├── OrderFormPreview.tsx (~100 lines)
      └── QBEstimatePreview.tsx (~100 lines)

  ┌─ PHASE 2: SEND ─────────────────────────────────┐
  │                                                  │
  ├── Left Panel: SendToCustomerPanel.tsx (~200 lines) [PHASE 1.5.c.6.3]
  │   ├── PointPersonSelector.tsx (~100 lines)
  │   │   └── Checkbox list of point persons
  │   │
  │   └── EmailPreview.tsx (~100 lines)
  │       └── Shows email template with attachments
  │
  └── Right Panel: (Same LivePDFPreviewPanel)

Common Components:
├── StepStatusBadge.tsx (~40 lines)
├── ProgressBar.tsx (~30 lines)
└── StepButton.tsx (~60 lines)
```

### Backend Service Architecture

```
Backend Services

orderPreparationService.ts (~400 lines) [PHASE 1.5.c.6.1 + 1.5.c.6.2]
├── orchestratePrepareSteps(orderId, steps[])
├── runStepsInParallel(steps[])
├── validateStepDependencies(steps[])
└── getPreparationProgress(orderId)

qbEstimateService.ts (~300 lines) [PHASE 1.5.c.6.2]
├── checkEstimateStaleness(orderId)
├── createEstimateFromOrder(orderId)
├── downloadEstimatePDF(qbEstimateId, savePath)
├── mapOrderToQBEstimate(order, parts)
└── storeEstimateRecord(orderId, qbEstimateId)

pdfGenerationService.ts (~200 lines) [PHASE 1.5.c.6.2]
├── generateOrderFormPDFs(orderId)
├── savePDFsToFolder(orderId, pdfBuffers)
└── getOrderFolderPath(order)

orderFinalizationService.ts (~250 lines) [PHASE 1.5.c.6.3]
├── sendToCustomer(orderId, recipients, options)
├── updateStatusToPendingConfirmation(orderId)
└── createFinalizationHistory(orderId)

gmailService.ts (~150 lines) [PHASE 1.5.c.6.3 - PLACEHOLDER]
├── sendFinalizationEmail() // Placeholder
└── buildEmailTemplate() // Placeholder

validationService.ts (~100 lines) [PHASE 1.5.c.6.2 - PLACEHOLDER]
└── validateOrder() // Placeholder, returns { valid: true }

taskGenerationService.ts [FROM Phase 1.5.d - PLACEHOLDER]
└── generateTasksForOrder() // Placeholder
```

---

## Data Structures

### Step Configuration

```typescript
interface PrepareStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  canRun: boolean;  // Based on dependencies
  dependencies: string[];  // Step IDs this depends on
  canRunInParallel: boolean;
  order: number;
}

const PREPARE_STEPS: PrepareStep[] = [
  {
    id: 'validation',
    name: 'Validation',
    status: 'pending',
    canRun: true,
    dependencies: [],
    canRunInParallel: true,
    order: 1
  },
  {
    id: 'create_qb_estimate',
    name: 'Create QuickBooks Estimate',
    status: 'pending',
    canRun: true,
    dependencies: ['validation'],
    canRunInParallel: false,  // Must complete before PDF download
    order: 2
  },
  {
    id: 'generate_pdfs',
    name: 'Generate Order Form PDFs',
    status: 'pending',
    canRun: true,
    dependencies: ['validation'],
    canRunInParallel: true,  // Can run parallel with QB estimate
    order: 3
  },
  {
    id: 'download_qb_pdf',
    name: 'Download QB Estimate PDF',
    status: 'pending',
    canRun: false,
    dependencies: ['create_qb_estimate'],
    canRunInParallel: true,  // Can run parallel with generate_pdfs
    order: 4
  },
  {
    id: 'save_to_folder',
    name: 'Save PDFs to Folder',
    status: 'pending',
    canRun: false,
    dependencies: ['generate_pdfs', 'download_qb_pdf'],
    canRunInParallel: false,
    order: 5
  },
  {
    id: 'generate_tasks',
    name: 'Generate Production Tasks',
    status: 'pending',
    canRun: true,
    dependencies: ['validation'],
    canRunInParallel: true,
    order: 6
  }
];
```

### QB Estimate Staleness Tracking

```typescript
interface QBEstimateRecord {
  id: number;
  order_id: number;
  qb_estimate_id: string;
  qb_estimate_number: string;
  created_at: Date;
  created_by: number;
  is_current: boolean;
  estimate_data_hash: string;  // Hash of order parts for staleness detection
}

interface StalenessCheck {
  hasEstimate: boolean;
  estimateId?: string;
  estimateCreatedAt?: Date;
  isStale: boolean;
  lastOrderUpdate: Date;
  message: string;
}
```

### Preparation Progress State

```typescript
interface PreparationState {
  orderId: number;
  phase: 'prepare' | 'send';
  steps: PrepareStep[];
  pdfs: {
    orderForm: { url: string | null; loading: boolean };
    qbEstimate: { url: string | null; loading: boolean };
  };
  qbEstimate: {
    exists: boolean;
    id: string | null;
    isStale: boolean;
    createdAt: Date | null;
  };
  canProceedToSend: boolean;
  errors: string[];
}
```

---

## Database Schema Updates

### Track QB Estimates (Option 1: Simple)

```sql
-- Add columns to orders table
ALTER TABLE orders
ADD COLUMN qb_estimate_id VARCHAR(50),
ADD COLUMN qb_estimate_number VARCHAR(50),
ADD COLUMN qb_estimate_created_at DATETIME,
ADD COLUMN qb_estimate_created_by INT,
ADD COLUMN qb_estimate_data_hash VARCHAR(64),  -- SHA256 hash for staleness
ADD INDEX idx_qb_estimate_id (qb_estimate_id);
```

### Track QB Estimates (Option 2: Separate Table - Recommended for History)

```sql
-- Create QB estimate history table
CREATE TABLE order_qb_estimates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  qb_estimate_id VARCHAR(50) NOT NULL,
  qb_estimate_number VARCHAR(50) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by INT NOT NULL,
  is_current BOOLEAN DEFAULT TRUE,
  estimate_data_hash VARCHAR(64) NOT NULL,
  qb_estimate_url VARCHAR(500),

  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(user_id),
  INDEX idx_order_current (order_id, is_current),
  INDEX idx_qb_estimate (qb_estimate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- When new estimate created, mark previous as not current
UPDATE order_qb_estimates
SET is_current = FALSE
WHERE order_id = ? AND is_current = TRUE;
```

### Track Preparation Progress (Optional)

```sql
-- Store preparation state (optional - can use frontend state only)
CREATE TABLE order_preparation_state (
  order_id INT PRIMARY KEY,
  phase ENUM('prepare', 'send') DEFAULT 'prepare',
  steps_completed JSON,  -- Array of completed step IDs
  pdf_order_form_path VARCHAR(500),
  pdf_qb_estimate_path VARCHAR(500),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## Implementation Guide

### Phase 1.5.c.6.1: Core Infrastructure (8-10 hours)

**Goal:** Create modal shell, step orchestration, database schema

#### Task 1.1: Database Schema (1 hour)

**File:** `/database/migrations/2025-11-17-order-preparation-qb-estimates.sql` (NEW)

```sql
-- QuickBooks Estimate Tracking
CREATE TABLE order_qb_estimates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  qb_estimate_id VARCHAR(50) NOT NULL,
  qb_estimate_number VARCHAR(50) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by INT NOT NULL,
  is_current BOOLEAN DEFAULT TRUE,
  estimate_data_hash VARCHAR(64) NOT NULL COMMENT 'SHA256 hash of order parts for staleness detection',
  qb_estimate_url VARCHAR(500),

  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(user_id),
  INDEX idx_order_current (order_id, is_current),
  INDEX idx_qb_estimate (qb_estimate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

#### Task 1.2: TypeScript Type Definitions (1 hour)

**File:** `/frontend/web/src/types/orderPreparation.ts` (NEW)

```typescript
export type PrepareStepId =
  | 'validation'
  | 'create_qb_estimate'
  | 'generate_pdfs'
  | 'download_qb_pdf'
  | 'save_to_folder'
  | 'generate_tasks';

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed';
export type PreparationPhase = 'prepare' | 'send';

export interface PrepareStep {
  id: PrepareStepId;
  name: string;
  description: string;
  status: StepStatus;
  canRun: boolean;
  dependencies: PrepareStepId[];
  canRunInParallel: boolean;
  order: number;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface QBEstimateInfo {
  exists: boolean;
  id: string | null;
  number: string | null;
  isStale: boolean;
  createdAt: Date | null;
  dataHash: string | null;
}

export interface PDFPreview {
  url: string | null;
  loading: boolean;
  error: string | null;
}

export interface PreparationState {
  orderId: number;
  orderNumber: number;
  phase: PreparationPhase;
  steps: PrepareStep[];
  pdfs: {
    orderForm: PDFPreview;
    qbEstimate: PDFPreview;
  };
  qbEstimate: QBEstimateInfo;
  pointPersons: Array<{
    id: number;
    name: string;
    email: string;
    selected: boolean;
  }>;
  canProceedToSend: boolean;
  errors: string[];
}
```

**File:** `/backend/web/src/types/orderPreparation.ts` (NEW)

```typescript
export interface QBEstimateRecord {
  id: number;
  order_id: number;
  qb_estimate_id: string;
  qb_estimate_number: string;
  created_at: Date;
  created_by: number;
  is_current: boolean;
  estimate_data_hash: string;
  qb_estimate_url: string | null;
}

export interface StalenessCheckResult {
  hasEstimate: boolean;
  estimateId: string | null;
  estimateNumber: string | null;
  estimateCreatedAt: Date | null;
  isStale: boolean;
  lastOrderUpdate: Date;
  dataHash: string;
  message: string;
}

export interface StepResult {
  success: boolean;
  stepId: string;
  message: string;
  data?: any;
  error?: string;
}
```

---

#### Task 1.3: PrepareOrderModal Shell (3-4 hours)

**File:** `/frontend/web/src/components/orders/preparation/PrepareOrderModal.tsx` (NEW)

```typescript
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { PreparationState, PreparationPhase, PrepareStep } from '@/types/orderPreparation';
import { Order } from '@/types/orders';
import PrepareStepsPanel from './PrepareStepsPanel';
import SendToCustomerPanel from './SendToCustomerPanel';
import LivePDFPreviewPanel from './LivePDFPreviewPanel';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  onComplete: () => void;
}

export const PrepareOrderModal: React.FC<Props> = ({
  isOpen,
  onClose,
  order,
  onComplete
}) => {
  const [phase, setPhase] = useState<PreparationPhase>('prepare');
  const [preparationState, setPreparationState] = useState<PreparationState>({
    orderId: order.order_id,
    orderNumber: order.order_number,
    phase: 'prepare',
    steps: initializeSteps(),
    pdfs: {
      orderForm: { url: null, loading: false, error: null },
      qbEstimate: { url: null, loading: false, error: null }
    },
    qbEstimate: {
      exists: false,
      id: null,
      number: null,
      isStale: false,
      createdAt: null,
      dataHash: null
    },
    pointPersons: [],
    canProceedToSend: false,
    errors: []
  });

  // Initialize on mount
  useEffect(() => {
    if (isOpen) {
      initializePreparation();
    }
  }, [isOpen]);

  // Check if can proceed to send (required steps: 2-5)
  useEffect(() => {
    const requiredSteps = ['create_qb_estimate', 'generate_pdfs', 'download_qb_pdf', 'save_to_folder'];
    const allRequiredComplete = requiredSteps.every(stepId =>
      preparationState.steps.find(s => s.id === stepId)?.status === 'completed'
    );

    setPreparationState(prev => ({
      ...prev,
      canProceedToSend: allRequiredComplete
    }));
  }, [preparationState.steps]);

  const initializePreparation = async () => {
    // Load QB estimate info
    // Load point persons
    // Check existing preparation state
    // ... (implemented in Phase 1.5.c.6.2)
  };

  const handleNextToSend = () => {
    if (!preparationState.canProceedToSend) {
      alert('Please complete required preparation steps first');
      return;
    }
    setPhase('send');
  };

  const handleBackToPrepare = () => {
    setPhase('prepare');
  };

  const handleSendAndFinalize = async () => {
    // Send email (placeholder)
    // Update status to pending_confirmation
    // ... (implemented in Phase 1.5.c.6.3)
    onComplete();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-[90%] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {phase === 'prepare' ? 'Prepare Order' : 'Send to Customer'} #{order.order_number}
            </h2>
            <p className="text-sm text-gray-600">{order.order_name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Main Content: Split View */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT PANEL (40%) */}
          <div className="w-[40%] border-r border-gray-200 overflow-y-auto p-6">
            {phase === 'prepare' ? (
              <PrepareStepsPanel
                preparationState={preparationState}
                onStateChange={setPreparationState}
              />
            ) : (
              <SendToCustomerPanel
                preparationState={preparationState}
                onStateChange={setPreparationState}
              />
            )}
          </div>

          {/* RIGHT PANEL (60%) - PDF Previews */}
          <div className="w-[60%] overflow-y-auto bg-gray-50 p-6">
            <LivePDFPreviewPanel
              orderFormPdf={preparationState.pdfs.orderForm}
              qbEstimatePdf={preparationState.pdfs.qbEstimate}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          {phase === 'prepare' ? (
            <>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleNextToSend}
                disabled={!preparationState.canProceedToSend}
                className={`px-6 py-2 rounded-lg font-medium ${
                  preparationState.canProceedToSend
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Next: Send to Customer →
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleBackToPrepare}
                className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                ← Back to Prepare
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    // Skip email, just finalize
                    handleSendAndFinalize();
                  }}
                  className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Skip Email
                </button>
                <button
                  onClick={handleSendAndFinalize}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  Send Email & Finalize
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper function to initialize steps
function initializeSteps(): PrepareStep[] {
  return [
    {
      id: 'validation',
      name: 'Validation',
      description: 'Validate order data before processing',
      status: 'pending',
      canRun: true,
      dependencies: [],
      canRunInParallel: true,
      order: 1
    },
    {
      id: 'create_qb_estimate',
      name: 'Create QuickBooks Estimate',
      description: 'Create estimate in QuickBooks',
      status: 'pending',
      canRun: true,
      dependencies: ['validation'],
      canRunInParallel: false,
      order: 2
    },
    {
      id: 'generate_pdfs',
      name: 'Generate Order Form PDFs',
      description: 'Generate order form PDF documents',
      status: 'pending',
      canRun: true,
      dependencies: ['validation'],
      canRunInParallel: true,
      order: 3
    },
    {
      id: 'download_qb_pdf',
      name: 'Download QB Estimate PDF',
      description: 'Download PDF from QuickBooks',
      status: 'pending',
      canRun: false,
      dependencies: ['create_qb_estimate'],
      canRunInParallel: true,
      order: 4
    },
    {
      id: 'save_to_folder',
      name: 'Save PDFs to Folder',
      description: 'Save PDFs to order SMB folder',
      status: 'pending',
      canRun: false,
      dependencies: ['generate_pdfs', 'download_qb_pdf'],
      canRunInParallel: false,
      order: 5
    },
    {
      id: 'generate_tasks',
      name: 'Generate Production Tasks',
      description: 'Auto-generate production tasks (Phase 1.5.d)',
      status: 'pending',
      canRun: true,
      dependencies: ['validation'],
      canRunInParallel: true,
      order: 6
    }
  ];
}

export default PrepareOrderModal;
```

---

#### Task 1.4: Add Button to OrderHeader (0.5 hours)

**File:** `/frontend/web/src/components/orders/details/components/OrderHeader.tsx` (MODIFY)

```typescript
// Add to props interface:
interface OrderHeaderProps {
  // ... existing props
  onPrepareOrder: () => void;  // NEW
}

// Add button after View Forms dropdown (around line 172):
{order.status === 'job_details_setup' && (
  <button
    onClick={onPrepareOrder}
    className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium shadow-sm"
  >
    <Settings className="w-4 h-4" />
    <span>Prepare Order</span>
  </button>
)}
```

**File:** `/frontend/web/src/components/orders/details/OrderDetailsPage.tsx` (MODIFY)

```typescript
// Add state for preparation modal
const [showPrepareModal, setShowPrepareModal] = useState(false);

// Add handler
const handlePrepareOrder = () => {
  setShowPrepareModal(true);
};

// Pass to OrderHeader
<OrderHeader
  // ... existing props
  onPrepareOrder={handlePrepareOrder}
/>

// Add modal at bottom
<PrepareOrderModal
  isOpen={showPrepareModal}
  onClose={() => setShowPrepareModal(false)}
  order={orderData.order}
  onComplete={() => {
    setShowPrepareModal(false);
    refetch();
  }}
/>
```

---

#### Task 1.5: Step Orchestration Utility (2-3 hours)

**File:** `/frontend/web/src/utils/stepOrchestration.ts` (NEW)

```typescript
import { PrepareStep, PrepareStepId } from '@/types/orderPreparation';

/**
 * Check if step can run based on dependencies
 */
export function canRunStep(step: PrepareStep, allSteps: PrepareStep[]): boolean {
  // If already running or completed, cannot run again
  if (step.status === 'running') return false;

  // Check all dependencies are completed
  return step.dependencies.every(depId => {
    const depStep = allSteps.find(s => s.id === depId);
    return depStep?.status === 'completed';
  });
}

/**
 * Get steps that can run in parallel
 */
export function getParallelizableSteps(steps: PrepareStep[]): PrepareStep[] {
  return steps.filter(step =>
    step.status === 'pending' &&
    step.canRunInParallel &&
    canRunStep(step, steps)
  );
}

/**
 * Get next sequential step to run
 */
export function getNextStep(steps: PrepareStep[]): PrepareStep | null {
  const runnableSteps = steps.filter(step =>
    step.status === 'pending' &&
    canRunStep(step, steps)
  );

  // Return step with lowest order number
  return runnableSteps.sort((a, b) => a.order - b.order)[0] || null;
}

/**
 * Update step status
 */
export function updateStepStatus(
  steps: PrepareStep[],
  stepId: PrepareStepId,
  status: PrepareStep['status'],
  error?: string
): PrepareStep[] {
  return steps.map(step =>
    step.id === stepId
      ? {
          ...step,
          status,
          error,
          startedAt: status === 'running' ? new Date() : step.startedAt,
          completedAt: status === 'completed' || status === 'failed' ? new Date() : step.completedAt
        }
      : step
  );
}

/**
 * Calculate overall progress percentage
 */
export function calculateProgress(steps: PrepareStep[]): number {
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  return Math.round((completedSteps / steps.length) * 100);
}

/**
 * Check if all required steps are complete
 * Required steps: create_qb_estimate, generate_pdfs, download_qb_pdf, save_to_folder
 */
export function areRequiredStepsComplete(steps: PrepareStep[]): boolean {
  const requiredStepIds: PrepareStepId[] = [
    'create_qb_estimate',
    'generate_pdfs',
    'download_qb_pdf',
    'save_to_folder'
  ];

  return requiredStepIds.every(stepId => {
    const step = steps.find(s => s.id === stepId);
    return step?.status === 'completed';
  });
}
```

---

### Phase 1.5.c.6.2: Prepare Steps Implementation (10-12 hours)

Coming in next document section...

---

### Phase 1.5.c.6.3: Send to Customer (6-10 hours)

Coming in next document section...

---

## Success Criteria

Phase 1.5.c.6.1 (Core Infrastructure) is COMPLETE when:

1. ✅ Database schema created (`order_qb_estimates` table)
2. ✅ TypeScript types defined (frontend + backend)
3. ✅ PrepareOrderModal shell created with phase transitions
4. ✅ "Prepare Order" button added to OrderHeader
5. ✅ Step orchestration utilities implemented
6. ✅ Modal opens/closes properly
7. ✅ Phase transition (Prepare → Send) works
8. ✅ "Next: Send to Customer" button disabled until required steps complete
9. ✅ No TypeScript errors
10. ✅ Modal integrates with OrderDetailsPage

---

## Files Summary - Phase 1.5.c.6.1

### New Files (6 files, ~1,000 lines)
- `/database/migrations/2025-11-17-order-preparation-qb-estimates.sql` (~30 lines)
- `/frontend/web/src/types/orderPreparation.ts` (~120 lines)
- `/backend/web/src/types/orderPreparation.ts` (~60 lines)
- `/frontend/web/src/components/orders/preparation/PrepareOrderModal.tsx` (~250 lines)
- `/frontend/web/src/utils/stepOrchestration.ts` (~150 lines)

### Modified Files (2 files)
- `/frontend/web/src/components/orders/details/components/OrderHeader.tsx` (+10 lines)
- `/frontend/web/src/components/orders/details/OrderDetailsPage.tsx` (+20 lines)

**Total New Lines:** ~640 lines
**Complexity:** Medium (foundational work)

---

**Document Status:** ✅ Phase 1.5.c.6.1 Ready for Implementation
**Next:** Phase 1.5.c.6.2 (Prepare Steps Implementation)
**Last Updated:** 2025-11-17

---

## Next Steps

After Phase 1.5.c.6.1 is complete:
1. Implement Phase 1.5.c.6.2 (all individual prepare steps)
2. Implement Phase 1.5.c.6.3 (send to customer workflow)
3. Full integration testing
4. Production deployment

Would you like me to create the Phase 1.5.c.6.2 and 1.5.c.6.3 documents next?
