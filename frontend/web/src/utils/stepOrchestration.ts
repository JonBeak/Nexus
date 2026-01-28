/**
 * Step Orchestration Utilities
 * Phase 1.5.c.6: Manages step dependencies, progress, and execution order
 */

import { PrepareStep, PrepareStepId } from '../types/orderPreparation';

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
 * Counts both completed and skipped steps as "done"
 */
export function calculateProgress(steps: PrepareStep[]): number {
  const doneSteps = steps.filter(s => s.status === 'completed' || s.status === 'skipped').length;
  return Math.round((doneSteps / steps.length) * 100);
}

/**
 * Check if all required steps are complete
 * Required for "Send to Customer": ALL steps must be completed or skipped (100% progress)
 */
export function areRequiredStepsComplete(steps: PrepareStep[]): boolean {
  // All steps must be completed or skipped
  return steps.every(step => step.status === 'completed' || step.status === 'skipped');
}

/**
 * Initialize steps with default configuration
 * Note: Cash jobs now CREATE QB Estimates (for PDF generation/email) but skip QB Invoice creation.
 * The isCashJob parameter is no longer used to skip steps - all steps run for all jobs.
 */
export function initializeSteps(_options?: { isCashJob?: boolean }): PrepareStep[] {
  // Note: isCashJob parameter kept for backwards compatibility but no longer affects step status
  // Cash jobs still create QB Estimates for PDF generation, they just skip invoice creation later

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
      id: 'generate_tasks',
      name: 'Generate Production Tasks',
      description: 'Auto-generate production tasks from order specifications',
      status: 'pending',
      canRun: true,
      dependencies: ['validation'],
      canRunInParallel: true,
      order: 4
    }
  ];
}
