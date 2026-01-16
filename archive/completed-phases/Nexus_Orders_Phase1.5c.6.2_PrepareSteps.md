# Phase 1.5.c.6.2: Prepare Steps Implementation

**Status:** 📋 Ready to Implement
**Priority:** HIGH
**Duration:** 10-12 hours
**Dependencies:** Phase 1.5.c.6.1 (Core Infrastructure)
**Last Updated:** 2025-11-17

---

## Overview

Phase 1.5.c.6.2 implements all individual preparation steps:
1. Validation (placeholder)
2. QuickBooks Estimate Creation (with staleness detection)
3. Order Form PDF Generation
4. QB Estimate PDF Download
5. Save PDFs to SMB Folder
6. Task Generation (placeholder)
7. Live PDF Preview Panel

---

## Component Implementation

### Task 2.1: PrepareStepsPanel Component (2 hours)

**File:** `/frontend/web/src/components/orders/preparation/PrepareStepsPanel.tsx` (NEW)

```typescript
import React from 'react';
import { PreparationState } from '@/types/orderPreparation';
import { StepList } from './StepList';
import { QuickActions } from './QuickActions';
import { ProgressBar } from './common/ProgressBar';
import { calculateProgress } from '@/utils/stepOrchestration';

interface Props {
  preparationState: PreparationState;
  onStateChange: (state: PreparationState) => void;
}

export const PrepareStepsPanel: React.FC<Props> = ({
  preparationState,
  onStateChange
}) => {
  const progress = calculateProgress(preparationState.steps);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Preparation Steps
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Complete the steps below to prepare this order for customer approval.
        </p>
        <ProgressBar progress={progress} total={preparationState.steps.length} />
      </div>

      <StepList
        steps={preparationState.steps}
        qbEstimate={preparationState.qbEstimate}
        orderId={preparationState.orderId}
        orderNumber={preparationState.orderNumber}
        onStateChange={onStateChange}
        preparationState={preparationState}
      />

      <QuickActions
        steps={preparationState.steps}
        onRunAll={() => handleRunAllSteps(preparationState, onStateChange)}
      />
    </div>
  );
};

async function handleRunAllSteps(
  state: PreparationState,
  onStateChange: (state: PreparationState) => void
) {
  // Run all pending steps in optimal order (respecting dependencies)
  // This will be implemented in individual step handlers
  console.log('Running all steps...');
}

export default PrepareStepsPanel;
```

---

### Task 2.2: StepList Component (2 hours)

**File:** `/frontend/web/src/components/orders/preparation/StepList.tsx` (NEW)

```typescript
import React from 'react';
import { PrepareStep, PreparationState, QBEstimateInfo } from '@/types/orderPreparation';
import { ValidationStep } from './steps/ValidationStep';
import { QBEstimateStep } from './steps/QBEstimateStep';
import { GeneratePDFsStep } from './steps/GeneratePDFsStep';
import { DownloadQBPDFStep } from './steps/DownloadQBPDFStep';
import { SaveToFolderStep } from './steps/SaveToFolderStep';
import { GenerateTasksStep } from './steps/GenerateTasksStep';

interface Props {
  steps: PrepareStep[];
  qbEstimate: QBEstimateInfo;
  orderId: number;
  orderNumber: number;
  preparationState: PreparationState;
  onStateChange: (state: PreparationState) => void;
}

export const StepList: React.FC<Props> = ({
  steps,
  qbEstimate,
  orderId,
  orderNumber,
  preparationState,
  onStateChange
}) => {
  const getStepComponent = (step: PrepareStep) => {
    const commonProps = {
      step,
      orderId,
      orderNumber,
      preparationState,
      onStateChange
    };

    switch (step.id) {
      case 'validation':
        return <ValidationStep {...commonProps} />;

      case 'create_qb_estimate':
        return (
          <QBEstimateStep
            {...commonProps}
            qbEstimate={qbEstimate}
          />
        );

      case 'generate_pdfs':
        return <GeneratePDFsStep {...commonProps} />;

      case 'download_qb_pdf':
        return (
          <DownloadQBPDFStep
            {...commonProps}
            qbEstimate={qbEstimate}
          />
        );

      case 'save_to_folder':
        return <SaveToFolderStep {...commonProps} />;

      case 'generate_tasks':
        return <GenerateTasksStep {...commonProps} />;

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {steps.map((step) => (
        <div key={step.id}>
          {getStepComponent(step)}
        </div>
      ))}
    </div>
  );
};

export default StepList;
```

---

### Task 2.3: Individual Step Components

#### Step 1: ValidationStep (✅ Fully Implemented)

**Status:** ✅ COMPLETE - 2025-11-20
**Documentation:** See `/VALIDATION_RULES_SPECIFICATION.md` for comprehensive validation rules

**File:** `/frontend/web/src/components/orders/preparation/steps/ValidationStep.tsx` (IMPLEMENTED)

**Features:**
- Validates all 25 specification templates with comprehensive rules
- Supports simple required fields, conditional fields, and OR logic
- Displays detailed error messages with part number and template name
- Auto-runs when PrepareOrderModal opens
- Blocks progression to Step 2 if validation fails

**Validation Coverage:**
- Construction Specs (7 templates): Face, Back, Material, Neon Base, Box Material, Return, Trim
- Fabrication Specs (3 templates): Extr. Colour, Cutting, Acrylic
- Graphics/Finishing Specs (3 templates): Vinyl, Digital Print, Painting
- Assembly Specs (6 templates): D-Tape, Pins, Cut, Peel, Mask, Assembly
- Electrical Specs (5 templates): LEDs, Neon LED, Power Supply, Wire Length, UL
- Other (2 templates): Drain Holes (conditional), Notes (optional)

**Implementation:**

```typescript
import React, { useState, useEffect } from 'react';
import { PrepareStep, PreparationState } from '@/types/orderPreparation';
import { CompactStepRow } from '../common/CompactStepRow';
import { CompactStepButton } from '../common/CompactStepButton';
import { ordersApi } from '@/services/api';
import { updateStepStatus, canRunStep } from '@/utils/stepOrchestration';
import { AlertCircle } from 'lucide-react';

interface ValidationError {
  field: string;
  message: string;
  partNumber?: number;
  templateName?: string;
}

export const ValidationStep: React.FC<Props> = ({
  step,
  steps,
  state,
  onStateChange,
  order,
  isOpen
}) => {
  const orderNumber = order.order_number;
  const [message, setMessage] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  const handleValidate = async () => {
    try {
      onStateChange(prev => ({
        ...prev,
        steps: updateStepStatus(prev.steps, step.id, 'running')
      }));
      setMessage('Validating order data...');
      setValidationErrors([]);

      await ordersApi.validateForPreparation(orderNumber);

      onStateChange(prev => ({
        ...prev,
        steps: updateStepStatus(prev.steps, step.id, 'completed')
      }));
      setMessage('✓ Order validation successful');
    } catch (error: any) {
      const errors = error?.response?.data?.details?.errors || [];
      setValidationErrors(errors);

      onStateChange(prev => ({
        ...prev,
        steps: updateStepStatus(prev.steps, step.id, 'failed', undefined)
      }));
      setMessage('');
    }
  };

  // Auto-run validation when modal opens
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      handleValidate();
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  return (
    <div className="border-b border-gray-200">
      <CompactStepRow
        stepNumber={step.order}
        name={step.name}
        description={step.description}
        status={step.status}
        message={message}
        error={step.error}
        disabled={!canRunStep(step, steps)}
        button={
          <CompactStepButton
            status={step.status}
            onClick={handleValidate}
            disabled={!canRunStep(step, steps)}
            label="Run Validation"
          />
        }
      />

      {/* Detailed validation errors */}
      {validationErrors.length > 0 && (
        <div className="px-4 pb-3">
          <div className="ml-9 bg-red-50 border border-red-200 rounded-md p-3">
            <div className="flex items-start gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm font-medium text-red-900">
                Found {validationErrors.length} validation error{validationErrors.length > 1 ? 's' : ''}
              </div>
            </div>
            <div className="ml-6 space-y-1.5">
              {validationErrors.map((error, index) => (
                <div key={index} className="text-xs text-red-800">
                  <span className="font-medium">
                    Part {error.partNumber}
                    {error.templateName && ` - ${error.templateName}`}:
                  </span>{' '}
                  <span>{error.message}</span>
                </div>
              ))}
            </div>
            <div className="ml-6 mt-3 pt-2 border-t border-red-200 text-xs text-red-700 italic">
              Please fix these issues in the order details before proceeding with preparation.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

---

#### Step 2: QBEstimateStep (Full Implementation)

**File:** `/frontend/web/src/components/orders/preparation/steps/QBEstimateStep.tsx` (NEW)

```typescript
import React from 'react';
import { PrepareStep, PreparationState, QBEstimateInfo } from '@/types/orderPreparation';
import { StepCard } from '../common/StepCard';
import { StepButton } from '../common/StepButton';
import { AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import { ordersApi } from '@/services/api';
import { updateStepStatus } from '@/utils/stepOrchestration';

interface Props {
  step: PrepareStep;
  qbEstimate: QBEstimateInfo;
  orderId: number;
  orderNumber: number;
  preparationState: PreparationState;
  onStateChange: (state: PreparationState) => void;
}

export const QBEstimateStep: React.FC<Props> = ({
  step,
  qbEstimate,
  orderId,
  orderNumber,
  preparationState,
  onStateChange
}) => {
  const handleCreate = async () => {
    try {
      // Update to running
      onStateChange({
        ...preparationState,
        steps: updateStepStatus(preparationState.steps, 'create_qb_estimate', 'running')
      });

      // Call QB estimate creation API
      const result = await ordersApi.createQBEstimate(orderNumber);

      // Update state with QB estimate info
      onStateChange({
        ...preparationState,
        steps: updateStepStatus(preparationState.steps, 'create_qb_estimate', 'completed'),
        qbEstimate: {
          exists: true,
          id: result.estimateId,
          number: result.estimateNumber,
          isStale: false,
          createdAt: new Date(),
          dataHash: result.dataHash
        }
      });
    } catch (error) {
      onStateChange({
        ...preparationState,
        steps: updateStepStatus(
          preparationState.steps,
          'create_qb_estimate',
          'failed',
          (error as Error).message
        )
      });
    }
  };

  const handleOpenInQB = () => {
    if (qbEstimate.id) {
      // Open QB estimate in new tab
      const qbUrl = `https://app.qbo.intuit.com/app/estimate?txnId=${qbEstimate.id}`;
      window.open(qbUrl, '_blank');
    }
  };

  return (
    <StepCard
      step={step}
      stepNumber={2}
      title="Create QuickBooks Estimate"
      description="Create estimate in QuickBooks Online"
    >
      <div className="mt-3 space-y-3">
        {/* QB Estimate Status */}
        {qbEstimate.exists ? (
          <div className={`p-3 rounded-lg border ${
            qbEstimate.isStale
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-start gap-2">
              {qbEstimate.isStale ? (
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`font-medium text-sm ${
                  qbEstimate.isStale ? 'text-yellow-900' : 'text-green-900'
                }`}>
                  {qbEstimate.isStale
                    ? 'Estimate exists but is out of date'
                    : 'Estimate created successfully'}
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  QB Estimate #{qbEstimate.number}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Created {qbEstimate.createdAt ? new Date(qbEstimate.createdAt).toLocaleString() : 'N/A'}
                </p>
                {qbEstimate.isStale && (
                  <p className="text-sm text-yellow-700 mt-2">
                    ⚠️ Order specs or invoice data have changed since this estimate was created.
                    Consider recreating the estimate.
                  </p>
                )}
              </div>
              <button
                onClick={handleOpenInQB}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Open in QuickBooks"
              >
                <ExternalLink className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-700">
              ⚠️ No QuickBooks estimate created yet
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Create an estimate to generate customer-facing documents
            </p>
          </div>
        )}

        {/* Action Button */}
        <StepButton
          step={step}
          onClick={handleCreate}
          label={qbEstimate.exists ? 'Recreate QB Estimate' : 'Create QB Estimate'}
        />
      </div>
    </StepCard>
  );
};
```

---

#### Step 3: GeneratePDFsStep

**File:** `/frontend/web/src/components/orders/preparation/steps/GeneratePDFsStep.tsx` (NEW)

```typescript
import React from 'react';
import { PrepareStep, PreparationState } from '@/types/orderPreparation';
import { StepCard } from '../common/StepCard';
import { StepButton } from '../common/StepButton';
import { ordersApi } from '@/services/api';
import { updateStepStatus } from '@/utils/stepOrchestration';

interface Props {
  step: PrepareStep;
  orderId: number;
  orderNumber: number;
  preparationState: PreparationState;
  onStateChange: (state: PreparationState) => void;
}

export const GeneratePDFsStep: React.FC<Props> = ({
  step,
  orderId,
  orderNumber,
  preparationState,
  onStateChange
}) => {
  const handleGenerate = async () => {
    try {
      // Update to running
      onStateChange({
        ...preparationState,
        steps: updateStepStatus(preparationState.steps, 'generate_pdfs', 'running'),
        pdfs: {
          ...preparationState.pdfs,
          orderForm: { ...preparationState.pdfs.orderForm, loading: true }
        }
      });

      // Call PDF generation API
      const result = await ordersApi.generateOrderFormPDF(orderNumber);

      // Update state with PDF URL
      onStateChange({
        ...preparationState,
        steps: updateStepStatus(preparationState.steps, 'generate_pdfs', 'completed'),
        pdfs: {
          ...preparationState.pdfs,
          orderForm: { url: result.pdfUrl, loading: false, error: null }
        }
      });
    } catch (error) {
      onStateChange({
        ...preparationState,
        steps: updateStepStatus(
          preparationState.steps,
          'generate_pdfs',
          'failed',
          (error as Error).message
        ),
        pdfs: {
          ...preparationState.pdfs,
          orderForm: {
            url: null,
            loading: false,
            error: (error as Error).message
          }
        }
      });
    }
  };

  return (
    <StepCard
      step={step}
      stepNumber={3}
      title="Generate Order Form PDFs"
      description="Generate order form PDF documents"
    >
      <div className="mt-3 space-y-2">
        {preparationState.pdfs.orderForm.url && (
          <p className="text-sm text-green-700">
            ✓ PDF generated successfully (visible in preview panel →)
          </p>
        )}
        {preparationState.pdfs.orderForm.error && (
          <p className="text-sm text-red-700">
            ✗ Error: {preparationState.pdfs.orderForm.error}
          </p>
        )}
        <StepButton
          step={step}
          onClick={handleGenerate}
          label="Generate PDFs"
        />
      </div>
    </StepCard>
  );
};
```

---

#### Step 4: DownloadQBPDFStep

**File:** `/frontend/web/src/components/orders/preparation/steps/DownloadQBPDFStep.tsx` (NEW)

```typescript
import React from 'react';
import { PrepareStep, PreparationState, QBEstimateInfo } from '@/types/orderPreparation';
import { StepCard } from '../common/StepCard';
import { StepButton } from '../common/StepButton';
import { ordersApi } from '@/services/api';
import { updateStepStatus, canRunStep } from '@/utils/stepOrchestration';

interface Props {
  step: PrepareStep;
  qbEstimate: QBEstimateInfo;
  orderId: number;
  orderNumber: number;
  preparationState: PreparationState;
  onStateChange: (state: PreparationState) => void;
}

export const DownloadQBPDFStep: React.FC<Props> = ({
  step,
  qbEstimate,
  orderId,
  orderNumber,
  preparationState,
  onStateChange
}) => {
  const canRun = canRunStep(step, preparationState.steps) && qbEstimate.exists;

  const handleDownload = async () => {
    try {
      if (!qbEstimate.id) {
        throw new Error('No QB estimate created yet');
      }

      // Update to running
      onStateChange({
        ...preparationState,
        steps: updateStepStatus(preparationState.steps, 'download_qb_pdf', 'running'),
        pdfs: {
          ...preparationState.pdfs,
          qbEstimate: { ...preparationState.pdfs.qbEstimate, loading: true }
        }
      });

      // Call QB PDF download API
      const result = await ordersApi.downloadQBEstimatePDF(qbEstimate.id, orderNumber);

      // Update state with PDF URL
      onStateChange({
        ...preparationState,
        steps: updateStepStatus(preparationState.steps, 'download_qb_pdf', 'completed'),
        pdfs: {
          ...preparationState.pdfs,
          qbEstimate: { url: result.pdfUrl, loading: false, error: null }
        }
      });
    } catch (error) {
      onStateChange({
        ...preparationState,
        steps: updateStepStatus(
          preparationState.steps,
          'download_qb_pdf',
          'failed',
          (error as Error).message
        ),
        pdfs: {
          ...preparationState.pdfs,
          qbEstimate: {
            url: null,
            loading: false,
            error: (error as Error).message
          }
        }
      });
    }
  };

  return (
    <StepCard
      step={step}
      stepNumber={4}
      title="Download QB Estimate PDF"
      description="Download PDF from QuickBooks"
    >
      <div className="mt-3 space-y-2">
        {!qbEstimate.exists && (
          <p className="text-sm text-gray-600">
            ⚠️ Requires QB estimate to be created first (Step 2)
          </p>
        )}
        {preparationState.pdfs.qbEstimate.url && (
          <p className="text-sm text-green-700">
            ✓ PDF downloaded successfully (visible in preview panel →)
          </p>
        )}
        {preparationState.pdfs.qbEstimate.error && (
          <p className="text-sm text-red-700">
            ✗ Error: {preparationState.pdfs.qbEstimate.error}
          </p>
        )}
        <StepButton
          step={step}
          onClick={handleDownload}
          label="Download PDF"
          disabled={!canRun}
        />
      </div>
    </StepCard>
  );
};
```

---

#### Step 5: SaveToFolderStep

**File:** `/frontend/web/src/components/orders/preparation/steps/SaveToFolderStep.tsx` (NEW)

```typescript
import React from 'react';
import { PrepareStep, PreparationState } from '@/types/orderPreparation';
import { StepCard } from '../common/StepCard';
import { StepButton } from '../common/StepButton';
import { Folder } from 'lucide-react';
import { ordersApi } from '@/services/api';
import { updateStepStatus, canRunStep } from '@/utils/stepOrchestration';

interface Props {
  step: PrepareStep;
  orderId: number;
  orderNumber: number;
  preparationState: PreparationState;
  onStateChange: (state: PreparationState) => void;
}

export const SaveToFolderStep: React.FC<Props> = ({
  step,
  orderId,
  orderNumber,
  preparationState,
  onStateChange
}) => {
  const canRun = canRunStep(step, preparationState.steps);
  const hasPDFs = preparationState.pdfs.orderForm.url && preparationState.pdfs.qbEstimate.url;

  const handleSave = async () => {
    try {
      if (!hasPDFs) {
        throw new Error('PDFs must be generated first');
      }

      // Update to running
      onStateChange({
        ...preparationState,
        steps: updateStepStatus(preparationState.steps, 'save_to_folder', 'running')
      });

      // Call save to folder API
      const result = await ordersApi.savePDFsToFolder(orderNumber);

      // Update to completed
      onStateChange({
        ...preparationState,
        steps: updateStepStatus(preparationState.steps, 'save_to_folder', 'completed')
      });
    } catch (error) {
      onStateChange({
        ...preparationState,
        steps: updateStepStatus(
          preparationState.steps,
          'save_to_folder',
          'failed',
          (error as Error).message
        )
      });
    }
  };

  return (
    <StepCard
      step={step}
      stepNumber={5}
      title="Save PDFs to Folder"
      description="Save PDFs to order SMB folder"
    >
      <div className="mt-3 space-y-2">
        {!hasPDFs && (
          <p className="text-sm text-gray-600">
            ⚠️ Requires PDFs to be generated first (Steps 3 & 4)
          </p>
        )}
        {step.status === 'completed' && (
          <div className="flex items-start gap-2 text-sm text-green-700">
            <Folder className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>PDFs saved successfully to order folder</p>
          </div>
        )}
        <StepButton
          step={step}
          onClick={handleSave}
          label="Save to Folder"
          disabled={!canRun || !hasPDFs}
        />
      </div>
    </StepCard>
  );
};
```

---

#### Step 6: GenerateTasksStep (Placeholder)

**File:** `/frontend/web/src/components/orders/preparation/steps/GenerateTasksStep.tsx` (NEW)

```typescript
import React from 'react';
import { PrepareStep, PreparationState } from '@/types/orderPreparation';
import { StepCard } from '../common/StepCard';
import { StepButton } from '../common/StepButton';
import { ordersApi } from '@/services/api';
import { updateStepStatus } from '@/utils/stepOrchestration';

interface Props {
  step: PrepareStep;
  orderId: number;
  orderNumber: number;
  preparationState: PreparationState;
  onStateChange: (state: PreparationState) => void;
}

export const GenerateTasksStep: React.FC<Props> = ({
  step,
  orderId,
  orderNumber,
  preparationState,
  onStateChange
}) => {
  const handleGenerate = async () => {
    try {
      // Update to running
      onStateChange({
        ...preparationState,
        steps: updateStepStatus(preparationState.steps, 'generate_tasks', 'running')
      });

      // PLACEHOLDER: Call task generation API
      // const result = await ordersApi.generateProductionTasks(orderNumber);

      // For now, simulate success
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Update to completed
      onStateChange({
        ...preparationState,
        steps: updateStepStatus(preparationState.steps, 'generate_tasks', 'completed')
      });
    } catch (error) {
      onStateChange({
        ...preparationState,
        steps: updateStepStatus(
          preparationState.steps,
          'generate_tasks',
          'failed',
          (error as Error).message
        )
      });
    }
  };

  return (
    <StepCard
      step={step}
      stepNumber={6}
      title="Generate Production Tasks"
      description="Auto-generate tasks from specifications (Phase 1.5.d)"
    >
      <div className="mt-3 space-y-2">
        <p className="text-sm text-gray-600">
          ⚠️ Placeholder: Task generation from Phase 1.5.d will be integrated later
        </p>
        <StepButton
          step={step}
          onClick={handleGenerate}
          label="Generate Tasks"
        />
      </div>
    </StepCard>
  );
};
```

---

### Task 2.4: Common UI Components (1 hour)

#### StepCard Component

**File:** `/frontend/web/src/components/orders/preparation/common/StepCard.tsx` (NEW)

```typescript
import React from 'react';
import { PrepareStep } from '@/types/orderPreparation';
import { StepStatusBadge } from './StepStatusBadge';

interface Props {
  step: PrepareStep;
  stepNumber: number;
  title: string;
  description: string;
  children: React.ReactNode;
}

export const StepCard: React.FC<Props> = ({
  step,
  stepNumber,
  title,
  description,
  children
}) => {
  return (
    <div className={`border rounded-lg p-4 ${
      step.status === 'completed'
        ? 'bg-gray-50 border-gray-300'
        : step.status === 'running'
        ? 'bg-blue-50 border-blue-300'
        : step.status === 'failed'
        ? 'bg-red-50 border-red-300'
        : 'bg-white border-gray-200'
    }`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-500">
              Step {stepNumber}
            </span>
            <StepStatusBadge status={step.status} />
          </div>
          <h4 className="text-base font-semibold text-gray-900 mt-1">
            {title}
          </h4>
          <p className="text-sm text-gray-600 mt-0.5">
            {description}
          </p>
        </div>
      </div>

      {step.error && (
        <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-sm text-red-700">
          Error: {step.error}
        </div>
      )}

      {children}
    </div>
  );
};
```

#### StepButton Component

**File:** `/frontend/web/src/components/orders/preparation/common/StepButton.tsx` (NEW)

```typescript
import React from 'react';
import { PrepareStep } from '@/types/orderPreparation';
import { RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';

interface Props {
  step: PrepareStep;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}

export const StepButton: React.FC<Props> = ({
  step,
  onClick,
  label,
  disabled = false
}) => {
  const getButtonStyle = () => {
    if (disabled || (step.status === 'running')) {
      return 'bg-gray-300 text-gray-500 cursor-not-allowed';
    }

    if (step.status === 'completed') {
      return 'bg-gray-200 text-gray-700 hover:bg-gray-300';
    }

    if (step.status === 'failed') {
      return 'bg-orange-500 text-white hover:bg-orange-600';
    }

    return 'bg-indigo-600 text-white hover:bg-indigo-700';
  };

  const getIcon = () => {
    if (step.status === 'running') {
      return <RefreshCw className="w-4 h-4 animate-spin" />;
    }
    if (step.status === 'completed') {
      return <CheckCircle className="w-4 h-4" />;
    }
    if (step.status === 'failed') {
      return <AlertTriangle className="w-4 h-4" />;
    }
    return null;
  };

  const getLabel = () => {
    if (step.status === 'running') return 'Running...';
    if (step.status === 'completed') return `✓ ${label}`;
    if (step.status === 'failed') return `⚠ Retry ${label}`;
    return label;
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || step.status === 'running'}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${getButtonStyle()}`}
    >
      {getIcon()}
      <span>{getLabel()}</span>
    </button>
  );
};
```

#### StepStatusBadge Component

**File:** `/frontend/web/src/components/orders/preparation/common/StepStatusBadge.tsx` (NEW)

```typescript
import React from 'react';
import { StepStatus } from '@/types/orderPreparation';
import { Circle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface Props {
  status: StepStatus;
}

export const StepStatusBadge: React.FC<Props> = ({ status }) => {
  const config = {
    pending: {
      icon: Circle,
      label: 'Pending',
      className: 'text-gray-400 bg-gray-100'
    },
    running: {
      icon: RefreshCw,
      label: 'Running',
      className: 'text-blue-600 bg-blue-100',
      animate: true
    },
    completed: {
      icon: CheckCircle,
      label: 'Complete',
      className: 'text-green-600 bg-green-100'
    },
    failed: {
      icon: XCircle,
      label: 'Failed',
      className: 'text-red-600 bg-red-100'
    }
  };

  const { icon: Icon, label, className, animate } = config[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      <Icon className={`w-3 h-3 ${animate ? 'animate-spin' : ''}`} />
      {label}
    </span>
  );
};
```

#### ProgressBar Component

**File:** `/frontend/web/src/components/orders/preparation/common/ProgressBar.tsx` (NEW)

```typescript
import React from 'react';

interface Props {
  progress: number;  // Percentage 0-100
  total: number;     // Total number of steps
}

export const ProgressBar: React.FC<Props> = ({ progress, total }) => {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">Progress</span>
        <span className="font-medium text-gray-900">{progress}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
```

---

### Task 2.5: LivePDFPreviewPanel Component (1 hour)

**File:** `/frontend/web/src/components/orders/preparation/LivePDFPreviewPanel.tsx` (NEW)

```typescript
import React from 'react';
import { PDFPreview } from '@/types/orderPreparation';
import { FileText, RefreshCw } from 'lucide-react';

interface Props {
  orderFormPdf: PDFPreview;
  qbEstimatePdf: PDFPreview;
}

export const LivePDFPreviewPanel: React.FC<Props> = ({
  orderFormPdf,
  qbEstimatePdf
}) => {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">
        Document Previews
      </h3>

      {/* Order Form Preview */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-5 h-5 text-indigo-600" />
          <h4 className="font-semibold text-gray-900">Order Form - Specs</h4>
          <span className="text-xs text-gray-500">(Landscape)</span>
        </div>
        <div className="border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm">
          {orderFormPdf.loading ? (
            <div className="h-[500px] flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-3" />
                <p className="text-gray-500">Generating PDF...</p>
              </div>
            </div>
          ) : orderFormPdf.error ? (
            <div className="h-[500px] flex items-center justify-center bg-red-50">
              <div className="text-center">
                <p className="text-red-700 font-medium">Error loading PDF</p>
                <p className="text-sm text-red-600 mt-1">{orderFormPdf.error}</p>
              </div>
            </div>
          ) : orderFormPdf.url ? (
            <iframe
              src={orderFormPdf.url}
              className="w-full h-[500px]"
              title="Order Form - Specs Preview"
            />
          ) : (
            <div className="h-[500px] flex items-center justify-center bg-gray-50">
              <p className="text-gray-400">PDF not generated yet (Run Step 3)</p>
            </div>
          )}
        </div>
      </div>

      {/* QB Estimate Preview */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-5 h-5 text-green-600" />
          <h4 className="font-semibold text-gray-900">QuickBooks Estimate</h4>
          <span className="text-xs text-gray-500">(Portrait)</span>
        </div>
        <div className="border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm">
          {qbEstimatePdf.loading ? (
            <div className="h-[600px] flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-3" />
                <p className="text-gray-500">Downloading PDF from QuickBooks...</p>
              </div>
            </div>
          ) : qbEstimatePdf.error ? (
            <div className="h-[600px] flex items-center justify-center bg-red-50">
              <div className="text-center">
                <p className="text-red-700 font-medium">Error loading PDF</p>
                <p className="text-sm text-red-600 mt-1">{qbEstimatePdf.error}</p>
              </div>
            </div>
          ) : qbEstimatePdf.url ? (
            <iframe
              src={qbEstimatePdf.url}
              className="w-full h-[600px]"
              title="QuickBooks Estimate Preview"
            />
          ) : (
            <div className="h-[600px] flex items-center justify-center bg-gray-50">
              <p className="text-gray-400">PDF not downloaded yet (Run Steps 2 & 4)</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LivePDFPreviewPanel;
```

---

### Task 2.6: QuickActions Component (0.5 hours)

**File:** `/frontend/web/src/components/orders/preparation/QuickActions.tsx` (NEW)

```typescript
import React from 'react';
import { PrepareStep } from '@/types/orderPreparation';
import { Play } from 'lucide-react';

interface Props {
  steps: PrepareStep[];
  onRunAll: () => void;
}

export const QuickActions: React.FC<Props> = ({ steps, onRunAll }) => {
  const allComplete = steps.every(s => s.status === 'completed');
  const someRunning = steps.some(s => s.status === 'running');

  return (
    <div className="pt-4 border-t border-gray-200">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h4>
      <button
        onClick={onRunAll}
        disabled={allComplete || someRunning}
        className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium w-full justify-center ${
          allComplete || someRunning
            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
            : 'bg-indigo-600 text-white hover:bg-indigo-700'
        }`}
      >
        <Play className="w-4 h-4" />
        {allComplete ? 'All Steps Complete' : someRunning ? 'Steps Running...' : 'Do All Steps'}
      </button>
      <p className="text-xs text-gray-500 mt-2 text-center">
        Runs all pending steps in optimal order (respecting dependencies)
      </p>
    </div>
  );
};

export default QuickActions;
```

---

## Backend Service Implementation

### Task 2.7: QB Estimate Service (3-4 hours)

**File:** `/backend/web/src/services/qbEstimateService.ts` (NEW)

```typescript
import { query } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { qbApiClient } from '../utils/quickbooks/apiClient';
import { quickbooksRepository } from '../repositories/quickbooksRepository';
import crypto from 'crypto';

export class QBEstimateService {
  /**
   * Check if QB estimate is stale (order data changed since estimate created)
   */
  async checkEstimateStaleness(orderId: number): Promise<{
    hasEstimate: boolean;
    estimateId: string | null;
    estimateNumber: string | null;
    isStale: boolean;
    createdAt: Date | null;
    message: string;
  }> {
    // Get current estimate
    const [estimates] = await query(
      `SELECT qb_estimate_id, qb_estimate_number, created_at, estimate_data_hash
       FROM order_qb_estimates
       WHERE order_id = ? AND is_current = TRUE
       LIMIT 1`,
      [orderId]
    ) as RowDataPacket[];

    if (estimates.length === 0) {
      return {
        hasEstimate: false,
        estimateId: null,
        estimateNumber: null,
        isStale: false,
        createdAt: null,
        message: 'No QB estimate created yet'
      };
    }

    const estimate = estimates[0];

    // Calculate current order data hash
    const currentHash = await this.calculateOrderDataHash(orderId);

    // Compare hashes
    const isStale = currentHash !== estimate.estimate_data_hash;

    return {
      hasEstimate: true,
      estimateId: estimate.qb_estimate_id,
      estimateNumber: estimate.qb_estimate_number,
      isStale,
      createdAt: estimate.created_at,
      message: isStale
        ? 'Estimate is out of date - order data has changed'
        : 'Estimate is up to date'
    };
  }

  /**
   * Create QB estimate from order
   */
  async createEstimateFromOrder(
    orderId: number,
    userId: number
  ): Promise<{
    estimateId: string;
    estimateNumber: string;
    dataHash: string;
  }> {
    // Get order and parts data
    const order = await this.getOrderData(orderId);
    const parts = await this.getOrderParts(orderId);

    // Get QB customer ID
    const qbCustomerId = await quickbooksRepository.getCustomerIdByNexusId(order.customer_id);
    if (!qbCustomerId) {
      throw new Error('Customer not found in QuickBooks. Please sync customers first.');
    }

    // Map order to QB estimate payload
    const estimatePayload = await this.mapOrderToQBEstimate(order, parts, qbCustomerId);

    // Create estimate in QuickBooks
    const qbEstimate = await qbApiClient.createEstimate(estimatePayload);

    // Calculate data hash
    const dataHash = await this.calculateOrderDataHash(orderId);

    // Mark previous estimates as not current
    await query(
      `UPDATE order_qb_estimates
       SET is_current = FALSE
       WHERE order_id = ? AND is_current = TRUE`,
      [orderId]
    );

    // Store new estimate record
    await query(
      `INSERT INTO order_qb_estimates
       (order_id, qb_estimate_id, qb_estimate_number, created_by, estimate_data_hash, is_current)
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [orderId, qbEstimate.Id, qbEstimate.DocNumber, userId, dataHash]
    );

    return {
      estimateId: qbEstimate.Id,
      estimateNumber: qbEstimate.DocNumber,
      dataHash
    };
  }

  /**
   * Download QB estimate PDF
   */
  async downloadEstimatePDF(
    qbEstimateId: string,
    orderNumber: number
  ): Promise<{
    pdfUrl: string;
    pdfBuffer: Buffer;
  }> {
    // Get PDF from QuickBooks
    const pdfUrl = await qbApiClient.getEstimatePDF(qbEstimateId);

    // Download PDF as buffer
    const axios = require('axios');
    const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
    const pdfBuffer = Buffer.from(response.data);

    // Return both URL and buffer
    return {
      pdfUrl,
      pdfBuffer
    };
  }

  /**
   * Map order to QuickBooks estimate format
   */
  private async mapOrderToQBEstimate(
    order: any,
    parts: any[],
    qbCustomerId: string
  ): Promise<any> {
    // Filter invoice parts only
    const invoiceParts = parts.filter(part =>
      part.invoice_description || part.unit_price
    );

    // Get QB item mappings for all products
    const productTypes = invoiceParts.map(p => p.product_type);
    const itemMappings = await quickbooksRepository.getBatchQBItemMappings(productTypes);

    // Build line items
    const lineItems = invoiceParts.map((part, index) => {
      const qbItemId = itemMappings.get(part.product_type) || 'DEFAULT_ITEM_ID';

      return {
        DetailType: 'SalesItemLineDetail',
        Amount: part.extended_price || 0,
        Description: part.invoice_description || part.product_type,
        LineNum: index + 1,
        SalesItemLineDetail: {
          ItemRef: {
            value: qbItemId,
            name: part.product_type
          },
          Qty: part.quantity || 1,
          UnitPrice: part.unit_price || 0
        }
      };
    });

    return {
      Line: lineItems,
      CustomerRef: {
        value: qbCustomerId
      },
      TxnDate: new Date().toISOString().split('T')[0],
      DueDate: order.due_date ? new Date(order.due_date).toISOString().split('T')[0] : undefined,
      DocNumber: `ORD-${order.order_number}`,
      CustomerMemo: {
        value: order.manufacturing_note || 'Thank you for your business!'
      }
    };
  }

  /**
   * Calculate hash of order data for staleness detection
   */
  private async calculateOrderDataHash(orderId: number): Promise<string> {
    // Get order parts data (what affects QB estimate)
    const [parts] = await query(
      `SELECT part_id, invoice_description, quantity, unit_price, extended_price
       FROM order_parts
       WHERE order_id = ?
       ORDER BY part_number`,
      [orderId]
    ) as RowDataPacket[];

    // Create deterministic string representation
    const dataString = JSON.stringify(parts);

    // Calculate SHA256 hash
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Get order data
   */
  private async getOrderData(orderId: number): Promise<any> {
    const [orders] = await query(
      `SELECT o.*, c.company_name as customer_name
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.customer_id
       WHERE o.order_id = ?`,
      [orderId]
    ) as RowDataPacket[];

    if (orders.length === 0) {
      throw new Error('Order not found');
    }

    return orders[0];
  }

  /**
   * Get order parts
   */
  private async getOrderParts(orderId: number): Promise<any[]> {
    const [parts] = await query(
      `SELECT * FROM order_parts
       WHERE order_id = ?
       ORDER BY part_number`,
      [orderId]
    ) as RowDataPacket[];

    return parts;
  }
}

export const qbEstimateService = new QBEstimateService();
```

---

### Task 2.8: Frontend API Methods (1 hour)

**File:** `/frontend/web/src/services/api/orders/orderPreparationApi.ts` (NEW)

```typescript
import { apiClient } from '../apiClient';

export const orderPreparationApi = {
  /**
   * Check QB estimate staleness
   */
  async checkQBEstimateStaleness(orderNumber: number) {
    const response = await apiClient.get(`/orders/${orderNumber}/qb-estimate/staleness`);
    return response.data;
  },

  /**
   * Create QB estimate
   */
  async createQBEstimate(orderNumber: number) {
    const response = await apiClient.post(`/orders/${orderNumber}/qb-estimate`);
    return response.data;
  },

  /**
   * Generate Order Form PDF
   */
  async generateOrderFormPDF(orderNumber: number) {
    const response = await apiClient.post(`/orders/${orderNumber}/generate-order-form-pdf`);
    return response.data;
  },

  /**
   * Download QB Estimate PDF
   */
  async downloadQBEstimatePDF(qbEstimateId: string, orderNumber: number) {
    const response = await apiClient.post(`/orders/${orderNumber}/download-qb-estimate-pdf`, {
      qbEstimateId
    });
    return response.data;
  },

  /**
   * Save PDFs to folder
   */
  async savePDFsToFolder(orderNumber: number) {
    const response = await apiClient.post(`/orders/${orderNumber}/save-pdfs-to-folder`);
    return response.data;
  },

  /**
   * Validate for preparation (placeholder)
   */
  async validateForPreparation(orderNumber: number) {
    const response = await apiClient.get(`/orders/${orderNumber}/validate-preparation`);
    return response.data;
  },

  /**
   * Generate production tasks (placeholder)
   */
  async generateProductionTasks(orderNumber: number) {
    const response = await apiClient.post(`/orders/${orderNumber}/generate-tasks`);
    return response.data;
  }
};

// Export for use in main ordersApi
export default orderPreparationApi;
```

**File:** `/frontend/web/src/services/api/index.ts` (MODIFY)

```typescript
// Add to existing ordersApi
import orderPreparationApi from './orders/orderPreparationApi';

export const ordersApi = {
  // ... existing methods
  ...orderPreparationApi
};
```

---

## Success Criteria

Phase 1.5.c.6.2 is COMPLETE when:

1. ✅ All 6 step components implemented
2. ✅ QB estimate creation works with staleness detection
3. ✅ PDF generation (Order Form) works
4. ✅ QB PDF download works
5. ✅ Save to folder works
6. ✅ Live PDF preview panel displays PDFs as generated
7. ✅ Step orchestration works (dependencies respected)
8. ✅ Individual step buttons work (run, re-run, gray out)
9. ✅ "Do All Steps" button runs steps in optimal order
10. ✅ Parallel execution works where applicable
11. ✅ All TypeScript types match
12. ✅ No console errors

---

## Files Summary - Phase 1.5.c.6.2

### New Frontend Files (18 files, ~2,200 lines)
- PrepareStepsPanel.tsx (~100 lines)
- StepList.tsx (~80 lines)
- steps/ValidationStep.tsx (~60 lines)
- steps/QBEstimateStep.tsx (~150 lines)
- steps/GeneratePDFsStep.tsx (~80 lines)
- steps/DownloadQBPDFStep.tsx (~100 lines)
- steps/SaveToFolderStep.tsx (~80 lines)
- steps/GenerateTasksStep.tsx (~60 lines)
- common/StepCard.tsx (~60 lines)
- common/StepButton.tsx (~70 lines)
- common/StepStatusBadge.tsx (~50 lines)
- common/ProgressBar.tsx (~30 lines)
- LivePDFPreviewPanel.tsx (~120 lines)
- QuickActions.tsx (~50 lines)

### New Backend Files (2 files, ~400 lines)
- services/qbEstimateService.ts (~300 lines)
- services/api/orders/orderPreparationApi.ts (~100 lines)

**Total New Lines:** ~2,600 lines
**Complexity:** High (QB integration, PDF handling)

---

**Document Status:** ✅ Ready for Implementation
**Next:** Phase 1.5.c.6.3 (Send to Customer)
**Last Updated:** 2025-11-17
