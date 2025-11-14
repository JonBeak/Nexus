/**
 * Vacation Service
 * Business logic layer for vacation period operations
 *
 * Created: Nov 13, 2025
 * Part of accounts route refactoring - Phase 2
 */

import { vacationRepository } from '../repositories/vacationRepository';
import { RowDataPacket } from 'mysql2';

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
  async getVacations(): Promise<RowDataPacket[]> {
    return await vacationRepository.getAllVacations();
  }

  /**
   * Get vacation periods for a specific user
   * @param userId - User ID to fetch vacations for
   * @returns Array of vacation periods with user details
   */
  async getUserVacations(userId: number): Promise<RowDataPacket[]> {
    return await vacationRepository.getVacationsByUserId(userId);
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
  ): Promise<number> {
    // Validate required fields
    if (!vacationData.user_id || !vacationData.start_date || !vacationData.end_date) {
      throw new Error('Missing required fields');
    }

    // Business rule: Start date must be before or equal to end date
    const startDate = new Date(vacationData.start_date);
    const endDate = new Date(vacationData.end_date);

    if (startDate > endDate) {
      throw new Error('Start date must be before or equal to end date');
    }

    // Create vacation in database
    const vacationId = await vacationRepository.createVacation(vacationData);

    // Log audit trail
    await vacationRepository.createAuditEntry({
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

    return vacationId;
  }

  /**
   * Delete a vacation period
   * @param vacationId - Vacation ID to delete
   * @param deleterUserId - ID of the user deleting the vacation
   */
  async deleteVacation(
    vacationId: number,
    deleterUserId: number
  ): Promise<void> {
    // Business rule: Check if vacation exists before deleting
    const exists = await vacationRepository.vacationExists(vacationId);
    if (!exists) {
      throw new Error('Vacation period not found');
    }

    // Delete vacation
    await vacationRepository.deleteVacation(vacationId);

    // Log audit trail
    await vacationRepository.createAuditEntry({
      user_id: deleterUserId,
      action: 'delete',
      entity_type: 'vacation_period',
      entity_id: vacationId,
      details: JSON.stringify({ action: 'delete_vacation' })
    });
  }
}

// Export singleton instance
export const vacationService = new VacationService();
