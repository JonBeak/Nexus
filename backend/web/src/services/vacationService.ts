// File Clean up Finished: 2025-11-15 (Second cleanup - Audit Trail Refactoring)
// Current Cleanup Changes (Nov 15, 2025):
// - Migrated from vacationRepository.createAuditEntry() to centralized auditRepository
// - Updated 2 audit trail calls to use auditRepository.createAuditEntry()
// - Added import for auditRepository
// - Part of Phase 2: Centralized Audit Repository implementation
//
// Previous Cleanup (Nov 14, 2025):
/**
 * Vacation Service
 * Business logic layer for vacation period operations
 *
 * Created: Nov 13, 2025
 * Part of accounts route refactoring - Phase 2
 *
 * Cleanup Summary (Nov 14, 2025):
 * - File is newly created (Nov 13, 2025) following proper 3-layer architecture
 * - Properly uses query() helper from database.ts
 * - Business logic validation (date validation, exists checks) in service layer
 * - Audit trail logging for all mutations
 * - Clean separation of concerns
 * - No cleanup needed - file follows all best practices
 */

import { vacationRepository } from '../repositories/vacationRepository';
import { auditRepository } from '../repositories/auditRepository';
import { RowDataPacket } from 'mysql2';
import { ServiceResult } from '../types/serviceResults';

export interface CreateVacationData {
  user_id: number;
  start_date: string;
  end_date: string;
  description?: string | null;
}

export class VacationService {
  /**
   * Get all vacation periods
   * @returns Array of vacation periods with user details
   */
  async getVacations(): Promise<ServiceResult<RowDataPacket[]>> {
    try {
      const vacations = await vacationRepository.getAllVacations();
      return { success: true, data: vacations };
    } catch (error) {
      console.error('Error in VacationService.getVacations:', error);
      return {
        success: false,
        error: 'Failed to fetch vacation periods',
        code: 'FETCH_ERROR'
      };
    }
  }

  /**
   * Get vacation periods for a specific user
   * @param userId - User ID to fetch vacations for
   * @returns Array of vacation periods with user details
   */
  async getUserVacations(userId: number): Promise<ServiceResult<RowDataPacket[]>> {
    try {
      const vacations = await vacationRepository.getVacationsByUserId(userId);
      return { success: true, data: vacations };
    } catch (error) {
      console.error('Error in VacationService.getUserVacations:', error);
      return {
        success: false,
        error: 'Failed to fetch user vacation periods',
        code: 'FETCH_ERROR'
      };
    }
  }

  /**
   * Create a new vacation period
   * @param vacationData - Vacation period data
   * @param creatorUserId - ID of the user creating the vacation
   * @returns Created vacation ID
   */
  async createVacation(
    vacationData: CreateVacationData,
    creatorUserId: number
  ): Promise<ServiceResult<number>> {
    try {
      // Validate required fields
      if (!vacationData.user_id || !vacationData.start_date || !vacationData.end_date) {
        return {
          success: false,
          error: 'Missing required fields',
          code: 'VALIDATION_ERROR'
        };
      }

      // Business rule: Start date must be before or equal to end date
      const startDate = new Date(vacationData.start_date);
      const endDate = new Date(vacationData.end_date);

      if (startDate > endDate) {
        return {
          success: false,
          error: 'Start date must be before or equal to end date',
          code: 'VALIDATION_ERROR'
        };
      }

      // Create vacation in database
      const vacationId = await vacationRepository.createVacation(vacationData);

      // Log audit trail
      await auditRepository.createAuditEntry({
        user_id: creatorUserId,
        action: 'create',
        entity_type: 'vacation_period',
        entity_id: vacationId,
        details: JSON.stringify({
          user_id: vacationData.user_id,
          start_date: vacationData.start_date,
          end_date: vacationData.end_date,
          description: vacationData.description
        })
      });

      return { success: true, data: vacationId };
    } catch (error) {
      console.error('Error in VacationService.createVacation:', error);
      return {
        success: false,
        error: 'Failed to create vacation period',
        code: 'CREATE_ERROR'
      };
    }
  }

  /**
   * Delete a vacation period
   * @param vacationId - Vacation ID to delete
   * @param deleterUserId - ID of the user deleting the vacation
   */
  async deleteVacation(
    vacationId: number,
    deleterUserId: number
  ): Promise<ServiceResult<void>> {
    try {
      // Business rule: Check if vacation exists before deleting
      const exists = await vacationRepository.vacationExists(vacationId);
      if (!exists) {
        return {
          success: false,
          error: 'Vacation period not found',
          code: 'NOT_FOUND'
        };
      }

      // Delete vacation
      await vacationRepository.deleteVacation(vacationId);

      // Log audit trail
      await auditRepository.createAuditEntry({
        user_id: deleterUserId,
        action: 'delete',
        entity_type: 'vacation_period',
        entity_id: vacationId,
        details: JSON.stringify({ action: 'delete_vacation' })
      });

      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error in VacationService.deleteVacation:', error);
      return {
        success: false,
        error: 'Failed to delete vacation period',
        code: 'DELETE_ERROR'
      };
    }
  }
}

// Export singleton instance
export const vacationService = new VacationService();
