/**
 * Order Preparation Type Definitions (Frontend)
 * Phase 1.5.c.6: Order Finalization - Prepare & Send Workflow
 */

// =============================================
// STEP TYPES
// =============================================

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

// =============================================
// QB ESTIMATE TYPES
// =============================================

export interface QBEstimateInfo {
  exists: boolean;
  id: string | null;
  number: string | null;
  isStale: boolean;
  createdAt: Date | null;
  dataHash: string | null;
}

// =============================================
// PDF PREVIEW TYPES
// =============================================

export interface PDFPreview {
  url: string | null;
  loading: boolean;
  error: string | null;
}

// =============================================
// POINT PERSON TYPES
// =============================================

export interface PointPerson {
  id: number;
  name: string;
  email: string;
  selected: boolean;
}

// =============================================
// MAIN PREPARATION STATE
// =============================================

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
  pointPersons: PointPerson[];
  canProceedToSend: boolean;
  errors: string[];
}
