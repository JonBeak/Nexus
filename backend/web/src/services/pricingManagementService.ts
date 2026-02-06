/**
 * Pricing Management Service - Validation + Cache Invalidation
 *
 * Business logic layer for generic pricing table CRUD.
 * Validates required fields, checks entity existence, and invalidates pricing cache.
 */

import { ServiceResult } from '../types/serviceResults';
import { pricingManagementRepository } from '../repositories/pricingManagementRepository';
import { getTableDefinition, PricingTableDefinition } from '../config/pricingTableDefinitions';
import { invalidatePricingCache } from '../websocket/taskBroadcast';
import { RowDataPacket } from 'mysql2';

export class PricingManagementService {
  /**
   * Get table definition, returning error if not found
   */
  private getDefinition(tableKey: string): ServiceResult<PricingTableDefinition> {
    const def = getTableDefinition(tableKey);
    if (!def) {
      return { success: false, error: `Unknown pricing table: ${tableKey}`, code: 'NOT_FOUND' };
    }
    return { success: true, data: def };
  }

  /**
   * Get all rows for a pricing table
   */
  async getRows(tableKey: string, includeInactive: boolean): Promise<ServiceResult<RowDataPacket[]>> {
    const defResult = this.getDefinition(tableKey);
    if (!defResult.success) return defResult;

    try {
      const rows = await pricingManagementRepository.getAll(defResult.data, includeInactive);
      return { success: true, data: rows };
    } catch (error) {
      console.error(`Error fetching rows for ${tableKey}:`, error);
      return { success: false, error: 'Failed to fetch pricing data', code: 'DATABASE_ERROR' };
    }
  }

  /**
   * Create a new row in a pricing table
   */
  async createRow(tableKey: string, data: Record<string, any>, userId?: number): Promise<ServiceResult<{ id: number | string }>> {
    const defResult = this.getDefinition(tableKey);
    if (!defResult.success) return defResult;

    const def = defResult.data;

    // Validate required fields
    const validationError = this.validateRequiredFields(def, data);
    if (validationError) {
      return { success: false, error: validationError, code: 'VALIDATION_ERROR' };
    }

    // Validate enum fields
    const enumError = this.validateEnumFields(def, data);
    if (enumError) {
      return { success: false, error: enumError, code: 'VALIDATION_ERROR' };
    }

    try {
      const id = await pricingManagementRepository.create(def, data);
      invalidatePricingCache(tableKey, userId);
      return { success: true, data: { id } };
    } catch (error: any) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return { success: false, error: 'A record with that value already exists', code: 'DUPLICATE_ENTRY' };
      }
      console.error(`Error creating row for ${tableKey}:`, error);
      return { success: false, error: 'Failed to create pricing record', code: 'DATABASE_ERROR' };
    }
  }

  /**
   * Update an existing row in a pricing table
   */
  async updateRow(tableKey: string, id: number | string, data: Record<string, any>, userId?: number): Promise<ServiceResult<void>> {
    const defResult = this.getDefinition(tableKey);
    if (!defResult.success) return defResult;

    const def = defResult.data;

    // Check entity exists
    const existing = await pricingManagementRepository.getById(def, id);
    if (!existing) {
      return { success: false, error: 'Record not found', code: 'NOT_FOUND' };
    }

    // Validate enum fields (only for fields being updated)
    const enumError = this.validateEnumFields(def, data);
    if (enumError) {
      return { success: false, error: enumError, code: 'VALIDATION_ERROR' };
    }

    try {
      const updated = await pricingManagementRepository.update(def, id, data);
      if (!updated) {
        return { success: false, error: 'No fields to update', code: 'VALIDATION_ERROR' };
      }
      invalidatePricingCache(tableKey, userId);
      return { success: true, data: undefined };
    } catch (error: any) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return { success: false, error: 'A record with that value already exists', code: 'DUPLICATE_ENTRY' };
      }
      console.error(`Error updating row for ${tableKey}:`, error);
      return { success: false, error: 'Failed to update pricing record', code: 'DATABASE_ERROR' };
    }
  }

  /**
   * Deactivate (soft delete) a row
   */
  async deactivateRow(tableKey: string, id: number | string, userId?: number): Promise<ServiceResult<void>> {
    const defResult = this.getDefinition(tableKey);
    if (!defResult.success) return defResult;

    const def = defResult.data;

    if (!def.hasActiveFilter) {
      return { success: false, error: 'This table does not support deactivation', code: 'VALIDATION_ERROR' };
    }

    const existing = await pricingManagementRepository.getById(def, id);
    if (!existing) {
      return { success: false, error: 'Record not found', code: 'NOT_FOUND' };
    }

    try {
      await pricingManagementRepository.deactivate(def, id);
      invalidatePricingCache(tableKey, userId);
      return { success: true, data: undefined };
    } catch (error) {
      console.error(`Error deactivating row for ${tableKey}:`, error);
      return { success: false, error: 'Failed to deactivate record', code: 'DATABASE_ERROR' };
    }
  }

  /**
   * Restore (reactivate) a row
   */
  async restoreRow(tableKey: string, id: number | string, userId?: number): Promise<ServiceResult<void>> {
    const defResult = this.getDefinition(tableKey);
    if (!defResult.success) return defResult;

    const def = defResult.data;

    if (!def.hasActiveFilter) {
      return { success: false, error: 'This table does not support reactivation', code: 'VALIDATION_ERROR' };
    }

    const existing = await pricingManagementRepository.getById(def, id);
    if (!existing) {
      return { success: false, error: 'Record not found', code: 'NOT_FOUND' };
    }

    try {
      await pricingManagementRepository.restore(def, id);
      invalidatePricingCache(tableKey, userId);
      return { success: true, data: undefined };
    } catch (error) {
      console.error(`Error restoring row for ${tableKey}:`, error);
      return { success: false, error: 'Failed to restore record', code: 'DATABASE_ERROR' };
    }
  }

  /**
   * Validate required fields are present in data
   */
  private validateRequiredFields(def: PricingTableDefinition, data: Record<string, any>): string | null {
    const missing: string[] = [];

    for (const col of def.columns) {
      if (col.required && (data[col.name] === undefined || data[col.name] === null || data[col.name] === '')) {
        // Skip is_active as it's usually defaulted
        if (col.name === 'is_active') continue;
        missing.push(col.name);
      }
    }

    // Check primary key for non-auto-increment tables
    if (!def.autoIncrement && (data[def.primaryKey] === undefined || data[def.primaryKey] === null)) {
      missing.push(def.primaryKey);
    }

    if (missing.length > 0) {
      return `Missing required fields: ${missing.join(', ')}`;
    }
    return null;
  }

  /**
   * Validate enum fields have valid values
   */
  private validateEnumFields(def: PricingTableDefinition, data: Record<string, any>): string | null {
    for (const col of def.columns) {
      if (col.type === 'enum' && col.enumValues && data[col.name] !== undefined) {
        if (!col.enumValues.includes(data[col.name])) {
          return `Invalid value for ${col.name}: ${data[col.name]}. Must be one of: ${col.enumValues.join(', ')}`;
        }
      }
    }
    return null;
  }
}

export const pricingManagementService = new PricingManagementService();
