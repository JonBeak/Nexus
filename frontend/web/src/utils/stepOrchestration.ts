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
 */
export function calculateProgress(steps: PrepareStep[]): number {
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  return Math.round((completedSteps / steps.length) * 100);
}

/**
 * Check if all required steps are complete
 * Required for "Send to Customer": ALL steps must be completed (100% progress)
 */
export function areRequiredStepsComplete(steps: PrepareStep[]): boolean {
  // All steps must be completed (100% progress)
  return steps.every(step => step.status === 'completed');
}

/**
 * Initialize steps with default configuration
 */
export function initializeSteps(): PrepareStep[] {
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
      description: 'Auto-generate production tasks (Phase 1.5.d)',
      status: 'pending',
      canRun: true,
      dependencies: ['validation'],
      canRunInParallel: true,
      order: 4
    }
  ];
}
