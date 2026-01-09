/**
 * Vinyl Application Matrix Service
 * Business logic layer for vinyl application task mapping
 */

import { vinylMatrixRepository, VinylMatrixEntry, VinylMatrixProductType } from '../repositories/vinylMatrixRepository';
import { settingsRepository } from '../repositories/settingsRepository';
import { ServiceResult } from '../types/serviceResults';

// =============================================================================
// Helper: Generate key from display name
// =============================================================================
function generateKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

// =============================================================================
// Helper: Log audit entry
// =============================================================================
async function logAudit(
  tableName: string,
  recordId: number,
  action: 'create' | 'update' | 'delete' | 'restore',
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null,
  summary: string,
  userId: number
): Promise<void> {
  try {
    await settingsRepository.createAuditLogEntry({
      table_name: tableName,
      record_id: recordId,
      action,
      old_values: oldValues,
      new_values: newValues,
      change_summary: summary,
      changed_by: userId
    });
  } catch (error) {
    console.error('Failed to create audit log entry:', error);
    // Don't throw - audit logging should not fail the main operation
  }
}

// =============================================================================
// Service Methods
// =============================================================================

export const vinylMatrixService = {
  /**
   * Get all product types that have matrix entries
   */
  async getProductTypes(): Promise<ServiceResult<VinylMatrixProductType[]>> {
    try {
      const productTypes = await vinylMatrixRepository.getAllProductTypes();
      return { success: true, data: productTypes };
    } catch (error) {
      console.error('Error fetching vinyl matrix product types:', error);
      return { success: false, error: 'Failed to fetch product types' };
    }
  },

  /**
   * Get all matrix entries for a product type
   */
  async getMatrixForProductType(productTypeKey: string): Promise<ServiceResult<VinylMatrixEntry[]>> {
    try {
      const entries = await vinylMatrixRepository.getMatrixByProductType(productTypeKey);
      return { success: true, data: entries };
    } catch (error) {
      console.error('Error fetching vinyl matrix:', error);
      return { success: false, error: 'Failed to fetch matrix entries' };
    }
  },

  /**
   * Get tasks for a specific product type + application combination
   * Returns null if no matching entry found (triggers unknown application flow)
   */
  async getTasksForApplication(
    productTypeKey: string,
    applicationKey: string
  ): Promise<ServiceResult<string[] | null>> {
    try {
      const taskNames = await vinylMatrixRepository.getTasksForApplication(productTypeKey, applicationKey);
      return { success: true, data: taskNames };
    } catch (error) {
      console.error('Error fetching tasks for application:', error);
      return { success: false, error: 'Failed to fetch tasks' };
    }
  },

  /**
   * Update tasks for a matrix entry
   */
  async updateMatrixEntry(
    matrixId: number,
    taskNames: string[],
    userId: number
  ): Promise<ServiceResult<void>> {
    try {
      const existing = await vinylMatrixRepository.getMatrixEntryById(matrixId);
      if (!existing) {
        return { success: false, error: 'Matrix entry not found', code: 'NOT_FOUND' };
      }

      await vinylMatrixRepository.updateMatrixEntry(matrixId, taskNames, userId);

      await logAudit(
        'vinyl_application_matrix',
        matrixId,
        'update',
        { task_names: existing.task_names },
        { task_names: taskNames },
        `Updated ${existing.product_type} - ${existing.application}: ${taskNames.join(', ')}`,
        userId
      );

      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error updating vinyl matrix entry:', error);
      return { success: false, error: 'Failed to update matrix entry' };
    }
  },

  /**
   * Create a new matrix entry
   */
  async createMatrixEntry(
    productType: string,
    productTypeKey: string,
    application: string,
    applicationKey: string,
    taskNames: string[],
    userId: number
  ): Promise<ServiceResult<number>> {
    try {
      // Check if entry already exists
      const exists = await vinylMatrixRepository.entryExists(productTypeKey, applicationKey);
      if (exists) {
        return { success: false, error: 'Entry already exists for this combination', code: 'DUPLICATE' };
      }

      const matrixId = await vinylMatrixRepository.createMatrixEntry({
        product_type: productType,
        product_type_key: productTypeKey,
        application,
        application_key: applicationKey,
        task_names: taskNames,
        updated_by: userId
      });

      await logAudit(
        'vinyl_application_matrix',
        matrixId,
        'create',
        null,
        { product_type: productType, application, task_names: taskNames },
        `Created ${productType} - ${application}: ${taskNames.join(', ')}`,
        userId
      );

      return { success: true, data: matrixId };
    } catch (error) {
      console.error('Error creating vinyl matrix entry:', error);
      return { success: false, error: 'Failed to create matrix entry' };
    }
  },

  /**
   * Create a new application in specification_options AND create a matrix entry for it
   * Used when user resolves an unknown application and wants to save it
   */
  async createApplicationWithMatrixEntry(
    applicationValue: string,
    productType: string,
    productTypeKey: string,
    taskNames: string[],
    userId: number
  ): Promise<ServiceResult<{ optionId: number; matrixId: number }>> {
    try {
      const applicationKey = generateKey(applicationValue);

      // 1. Create the specification option (vinyl application)
      const maxOrder = await settingsRepository.getMaxOptionDisplayOrder('vinyl_applications');
      const optionId = await settingsRepository.createSpecificationOption({
        category: 'vinyl_applications',
        category_display_name: 'Vinyl Applications',
        option_value: applicationValue,
        option_key: applicationKey,
        display_order: maxOrder + 1,
        is_active: true,
        is_system: false
      });

      await logAudit(
        'specification_options',
        optionId,
        'create',
        null,
        { category: 'vinyl_applications', option_value: applicationValue },
        `Added vinyl application: ${applicationValue}`,
        userId
      );

      // 2. Create the matrix entry
      const matrixId = await vinylMatrixRepository.createMatrixEntry({
        product_type: productType,
        product_type_key: productTypeKey,
        application: applicationValue,
        application_key: applicationKey,
        task_names: taskNames,
        updated_by: userId
      });

      await logAudit(
        'vinyl_application_matrix',
        matrixId,
        'create',
        null,
        { product_type: productType, application: applicationValue, task_names: taskNames },
        `Created ${productType} - ${applicationValue}: ${taskNames.join(', ')}`,
        userId
      );

      return { success: true, data: { optionId, matrixId } };
    } catch (error) {
      console.error('Error creating application with matrix entry:', error);
      return { success: false, error: 'Failed to create application and matrix entry' };
    }
  },

  /**
   * Deactivate a matrix entry
   */
  async deactivateMatrixEntry(matrixId: number, userId: number): Promise<ServiceResult<void>> {
    try {
      const existing = await vinylMatrixRepository.getMatrixEntryById(matrixId);
      if (!existing) {
        return { success: false, error: 'Matrix entry not found', code: 'NOT_FOUND' };
      }

      await vinylMatrixRepository.deactivateMatrixEntry(matrixId, userId);

      await logAudit(
        'vinyl_application_matrix',
        matrixId,
        'delete',
        { is_active: true },
        { is_active: false },
        `Deactivated ${existing.product_type} - ${existing.application}`,
        userId
      );

      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error deactivating vinyl matrix entry:', error);
      return { success: false, error: 'Failed to deactivate matrix entry' };
    }
  }
};

export default vinylMatrixService;
