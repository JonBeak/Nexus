// File Clean up Finished: 2025-11-15
/**
 * Audit Repository
 * Centralized data access layer for audit_trail table
 *
 * Created: Nov 15, 2025
 * Purpose: Eliminate code duplication across multiple repositories
 *          and provide single source of truth for audit operations
 *
 * Consolidates audit methods previously scattered across:
 * - userRepository.createAuditEntry()
 * - vacationRepository.createAuditEntry()
 * - payrollRepository.logAuditTrail()
 * - Direct INSERT statements in service layers
 *
 * Database Schema:
 *   audit_trail (
 *     audit_id INT AUTO_INCREMENT PRIMARY KEY,
 *     user_id INT,
 *     action VARCHAR(50),
 *     entity_type VARCHAR(50),
 *     entity_id VARCHAR(255),  -- Supports both numeric and string IDs
 *     details TEXT,
 *     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 *   )
 */

import { query } from '../config/database';

export interface AuditEntryData {
  user_id: number;
  action: string;
  entity_type: string;
  entity_id: number | string;
  details: string;
}

export class AuditRepository {
  /**
   * Create audit trail entry
   *
   * Note: Errors are caught and logged but not thrown to avoid disrupting
   * main business operations if audit logging fails
   *
   * @param auditData - Audit entry data
   * @returns Promise<void>
   */
  async createAuditEntry(auditData: AuditEntryData): Promise<void> {
    try {
      await query(
        `INSERT INTO audit_trail (user_id, action, entity_type, entity_id, details)
         VALUES (?, ?, ?, ?, ?)`,
        [
          auditData.user_id,
          auditData.action,
          auditData.entity_type,
          auditData.entity_id.toString(), // Convert to string for varchar(255) column
          auditData.details
        ]
      );
    } catch (error) {
      console.error('Repository error logging audit trail:', error);
      // Don't throw error for audit logging to avoid disrupting main operations
    }
  }

  /**
   * Alias for createAuditEntry with positional parameters
   * Provided for backward compatibility with payrollRepository.logAuditTrail()
   *
   * @param userId - User performing the action
   * @param action - Action performed (create, update, delete, etc.)
   * @param entityType - Type of entity (user, time_entry, vacation_period, etc.)
   * @param entityId - ID of the entity
   * @param details - JSON string or description of changes
   */
  async logAuditTrail(
    userId: number,
    action: string,
    entityType: string,
    entityId: number | string,
    details: string
  ): Promise<void> {
    await this.createAuditEntry({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details
    });
  }
}

// Export singleton instance
export const auditRepository = new AuditRepository();
