// File Clean up Finished: 2025-11-15
/**
 * Customer Address Repository
 * Data Access Layer for Customer Addresses
 *
 * Handles all direct database operations for customer address data
 * Created during addressService cleanup to fix architecture violations
 *
 * Part of Enhanced Three-Layer Architecture: Route → Controller → Service → Repository → Database
 */

import { query } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export interface AddressData {
  is_primary?: boolean;
  is_billing?: boolean;
  is_shipping?: boolean;
  is_jobsite?: boolean;
  is_mailing?: boolean;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  province_state_long?: string;
  province_state_short?: string;
  postal_zip?: string;
  country?: string;
  tax_override_percent?: number;
  tax_override_reason?: string;
  comments?: string;
}

export class CustomerAddressRepository {
  /**
   * Get customer addresses with optional inactive records
   *
   * @param customerId - Customer ID
   * @param includeInactive - Whether to include inactive addresses
   * @returns Array of customer addresses
   */
  async getAddresses(customerId: number, includeInactive: boolean = false): Promise<RowDataPacket[]> {
    const whereClause = includeInactive
      ? 'WHERE customer_id = ?'
      : 'WHERE customer_id = ? AND is_active = 1';

    const addressQuery = `
      SELECT
        address_id,
        customer_address_sequence,
        is_primary,
        is_billing,
        is_shipping,
        is_jobsite,
        is_mailing,
        address_line1,
        address_line2,
        city,
        province_state_long,
        province_state_short,
        postal_zip,
        country,
        tax_override_percent,
        tax_override_reason,
        comments,
        is_active,
        created_date,
        updated_date
      FROM customer_addresses
      ${whereClause}
      ORDER BY customer_address_sequence ASC
    `;

    return await query(addressQuery, [customerId]) as RowDataPacket[];
  }

  /**
   * Get country code from province lookup table
   * Used to ensure country always comes from database, never user input
   *
   * @param provinceShort - Province/state short code
   * @returns Country code or null if province not found
   */
  async getProvinceCountry(provinceShort: string): Promise<string | null> {
    const provinceQuery = 'SELECT country FROM provinces_tax WHERE province_short = ? AND is_active = 1';
    const provinceResult = await query(provinceQuery, [provinceShort]) as RowDataPacket[];

    return provinceResult.length > 0 ? provinceResult[0].country : null;
  }

  /**
   * Get next sequence number for customer addresses
   *
   * @param customerId - Customer ID
   * @returns Next available sequence number
   */
  async getNextSequence(customerId: number): Promise<number> {
    const sequenceQuery = 'SELECT COALESCE(MAX(customer_address_sequence), 0) + 1 as next_sequence FROM customer_addresses WHERE customer_id = ?';
    const sequenceResult = await query(sequenceQuery, [customerId]) as RowDataPacket[];

    return sequenceResult[0].next_sequence;
  }

  /**
   * Unset primary flag for all addresses of a customer
   * Used when setting a new primary address
   *
   * @param customerId - Customer ID
   * @param excludeAddressId - Optional address ID to exclude from update
   */
  async unsetPrimaryAddresses(customerId: number, excludeAddressId?: number): Promise<void> {
    if (excludeAddressId) {
      await query(
        'UPDATE customer_addresses SET is_primary = 0 WHERE customer_id = ? AND is_active = 1 AND address_id != ?',
        [customerId, excludeAddressId]
      );
    } else {
      await query(
        'UPDATE customer_addresses SET is_primary = 0 WHERE customer_id = ? AND is_active = 1',
        [customerId]
      );
    }
  }

  /**
   * Insert new customer address
   *
   * @param customerId - Customer ID
   * @param addressData - Address data to insert
   * @param sequence - Address sequence number
   * @param country - Country code (from provinces_tax lookup)
   * @param createdBy - Username of creator
   */
  async addAddress(
    customerId: number,
    addressData: AddressData,
    sequence: number,
    country: string,
    createdBy: string
  ): Promise<void> {
    const {
      is_primary,
      is_billing,
      is_shipping,
      is_jobsite,
      is_mailing,
      address_line1,
      address_line2,
      city,
      province_state_long,
      province_state_short,
      postal_zip,
      tax_override_percent,
      tax_override_reason,
      comments
    } = addressData;

    const insertQuery = `
      INSERT INTO customer_addresses (
        customer_id, customer_address_sequence, is_primary, is_billing, is_shipping,
        is_jobsite, is_mailing, address_line1, address_line2, city, province_state_long,
        province_state_short, postal_zip, country, tax_override_percent,
        tax_override_reason, comments, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await query(insertQuery, [
      customerId,
      sequence,
      is_primary ? 1 : 0,
      is_billing ? 1 : 0,
      is_shipping ? 1 : 0,
      is_jobsite ? 1 : 0,
      is_mailing ? 1 : 0,
      address_line1 || null,
      address_line2 || null,
      city || null,
      province_state_long || null,
      province_state_short,
      postal_zip || null,
      country,
      tax_override_percent ?? null,
      tax_override_reason || null,
      comments || null,
      createdBy
    ]);
  }

  /**
   * Update existing customer address
   *
   * @param customerId - Customer ID
   * @param addressId - Address ID to update
   * @param addressData - Address data to update
   * @param country - Country code (from provinces_tax lookup, optional)
   * @param updatedBy - Username of updater
   */
  async updateAddress(
    customerId: number,
    addressId: number,
    addressData: AddressData,
    country: string | null,
    updatedBy: string
  ): Promise<void> {
    const {
      is_primary,
      is_billing,
      is_shipping,
      is_jobsite,
      is_mailing,
      address_line1,
      address_line2,
      city,
      province_state_long,
      province_state_short,
      postal_zip,
      tax_override_percent,
      tax_override_reason,
      comments
    } = addressData;

    const updateQuery = `
      UPDATE customer_addresses SET
        is_primary = ?,
        is_billing = ?,
        is_shipping = ?,
        is_jobsite = ?,
        is_mailing = ?,
        address_line1 = ?,
        address_line2 = ?,
        city = ?,
        province_state_long = ?,
        province_state_short = ?,
        postal_zip = ?,
        country = ?,
        tax_override_percent = ?,
        tax_override_reason = ?,
        comments = ?,
        updated_by = ?,
        updated_date = CURRENT_TIMESTAMP
      WHERE address_id = ? AND customer_id = ? AND is_active = 1
    `;

    await query(updateQuery, [
      is_primary ? 1 : 0,
      is_billing ? 1 : 0,
      is_shipping ? 1 : 0,
      is_jobsite ? 1 : 0,
      is_mailing ? 1 : 0,
      address_line1 || null,
      address_line2 || null,
      city || null,
      province_state_long || null,
      province_state_short || null,
      postal_zip || null,
      country,
      tax_override_percent || null,
      tax_override_reason || null,
      comments || null,
      updatedBy,
      addressId,
      customerId
    ]);
  }

  /**
   * Soft delete customer address
   *
   * @param customerId - Customer ID
   * @param addressId - Address ID to delete
   * @param deletedBy - Username of deleter
   */
  async deleteAddress(customerId: number, addressId: number, deletedBy: string): Promise<void> {
    const deleteQuery = `
      UPDATE customer_addresses SET
        is_active = 0,
        updated_by = ?,
        updated_date = CURRENT_TIMESTAMP
      WHERE address_id = ? AND customer_id = ? AND is_active = 1
    `;

    await query(deleteQuery, [deletedBy, addressId, customerId]);
  }

  /**
   * Set address as primary
   * Note: Caller must unset other primary addresses first
   *
   * @param customerId - Customer ID
   * @param addressId - Address ID to make primary
   */
  async makePrimaryAddress(customerId: number, addressId: number): Promise<void> {
    await query(
      'UPDATE customer_addresses SET is_primary = 1 WHERE address_id = ? AND customer_id = ? AND is_active = 1',
      [addressId, customerId]
    );
  }

  /**
   * Reactivate soft-deleted address
   *
   * @param customerId - Customer ID
   * @param addressId - Address ID to reactivate
   * @param reactivatedBy - Username of reactivator
   */
  async reactivateAddress(customerId: number, addressId: number, reactivatedBy: string): Promise<void> {
    const reactivateQuery = `
      UPDATE customer_addresses SET
        is_active = 1,
        updated_by = ?,
        updated_date = CURRENT_TIMESTAMP
      WHERE address_id = ? AND customer_id = ? AND is_active = 0
    `;

    await query(reactivateQuery, [reactivatedBy, addressId, customerId]);
  }
}

export const customerAddressRepository = new CustomerAddressRepository();
