// File Clean up Finished: 2025-11-15
/**
 * Vinyl Label Generator Utility
 * Pure utility for generating unique vinyl inventory label IDs
 *
 * Created: 2025-11-15
 * Extracted from vinylInventoryRepository during refactoring to reduce file size
 *
 * Label Format: VIN-YYYY-### (e.g., VIN-2025-001, VIN-2025-002, etc.)
 * - VIN: Vinyl Inventory prefix
 * - YYYY: Current year
 * - ###: Sequential 3-digit number (001-999)
 *
 * Part of Enhanced Three-Layer Architecture
 * Used by: vinylInventoryRepository
 */

import { query } from '../../config/database';

/**
 * Generate next unique label ID for vinyl inventory
 *
 * Queries database for highest existing label in current year
 * and increments by 1 to create unique identifier
 *
 * @returns Promise<string> - Generated label ID (e.g., "VIN-2025-001")
 */
export async function generateVinylLabelId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `VIN-${year}-`;

  const sql = `
    SELECT label_id
    FROM vinyl_inventory
    WHERE label_id LIKE ?
    ORDER BY label_id DESC
    LIMIT 1
  `;

  const result = await query(sql, [`${prefix}%`]) as any[];

  let nextNumber = 1;
  if (result.length > 0) {
    const lastId = result[0].label_id;
    const match = lastId.match(/VIN-\d{4}-(\d{3})$/);
    if (match) {
      nextNumber = parseInt(match[1]) + 1;
    }
  }

  return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
}
