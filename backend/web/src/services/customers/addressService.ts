import { query } from '../../config/database';

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

export class AddressService {
  static async getCustomerAddresses(customerId: number, includeInactive: boolean = false) {
    const whereClause = includeInactive ? 'WHERE customer_id = ?' : 'WHERE customer_id = ? AND is_active = 1';
    
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
    
    const addresses = await query(addressQuery, [customerId]);
    return addresses || [];
  }

  static async addAddress(customerId: number, addressData: AddressData, createdBy: string) {
    const {
      is_primary = false,
      is_billing = false,
      is_shipping = true,
      is_jobsite = false,
      is_mailing = false,
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

    if (!province_state_short) {
      throw new Error('Province/state is required for tax purposes');
    }

    // Get country from provinces_tax (ALWAYS from database, never from user input)
    const provinceQuery = 'SELECT country FROM provinces_tax WHERE province_short = ? AND is_active = 1';
    const provinceResult = await query(provinceQuery, [province_state_short]) as any[];
    if (provinceResult.length === 0) {
      throw new Error(`Province/state code '${province_state_short}' not found in database`);
    }
    const finalCountry = provinceResult[0].country;

    // Get next sequence number
    const sequenceQuery = 'SELECT COALESCE(MAX(customer_address_sequence), 0) + 1 as next_sequence FROM customer_addresses WHERE customer_id = ?';
    const sequenceResult = await query(sequenceQuery, [customerId]) as any[];
    const nextSequence = sequenceResult[0].next_sequence;

    // If this is being set as primary, unset all other primary addresses for this customer
    if (is_primary) {
      await query(
        'UPDATE customer_addresses SET is_primary = 0 WHERE customer_id = ? AND is_active = 1',
        [customerId]
      );
    }

    const insertQuery = `
      INSERT INTO customer_addresses (
        customer_id, customer_address_sequence, is_primary, is_billing, is_shipping,
        is_jobsite, is_mailing, address_line1, address_line2, city, province_state_long,
        province_state_short, postal_zip, country, tax_override_percent,
        tax_override_reason, comments, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await query(insertQuery, [
      customerId, nextSequence, is_primary ? 1 : 0, is_billing ? 1 : 0,
      is_shipping ? 1 : 0, is_jobsite ? 1 : 0, is_mailing ? 1 : 0,
      address_line1, address_line2 || null, city, province_state_long || null,
      province_state_short, postal_zip || null, finalCountry,
      tax_override_percent || null,
      tax_override_reason || null, comments || null, createdBy
    ]);
  }

  static async updateAddress(customerId: number, addressId: number, addressData: AddressData, updatedBy: string) {
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

    // Get country from provinces_tax (ALWAYS from database, never from user input)
    let finalCountry: string | null = null;
    if (province_state_short) {
      const provinceQuery = 'SELECT country FROM provinces_tax WHERE province_short = ? AND is_active = 1';
      const provinceResult = await query(provinceQuery, [province_state_short]) as any[];
      if (provinceResult.length === 0) {
        throw new Error(`Province/state code '${province_state_short}' not found in database`);
      }
      finalCountry = provinceResult[0].country;
    }

    // If this is being set as primary, unset all other primary addresses for this customer
    if (is_primary) {
      await query(
        'UPDATE customer_addresses SET is_primary = 0 WHERE customer_id = ? AND is_active = 1 AND address_id != ?',
        [customerId, addressId]
      );
    }

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
      is_primary ? 1 : 0, is_billing ? 1 : 0, is_shipping ? 1 : 0,
      is_jobsite ? 1 : 0, is_mailing ? 1 : 0, address_line1 || null,
      address_line2 || null, city || null, province_state_long || null,
      province_state_short || null, postal_zip || null, finalCountry,
      tax_override_percent || null,
      tax_override_reason || null, comments || null, updatedBy,
      addressId, customerId
    ]);
  }

  static async deleteAddress(customerId: number, addressId: number, deletedBy: string) {
    // Soft delete by setting is_active = 0
    const deleteQuery = `
      UPDATE customer_addresses SET 
        is_active = 0,
        updated_by = ?,
        updated_date = CURRENT_TIMESTAMP
      WHERE address_id = ? AND customer_id = ? AND is_active = 1
    `;

    await query(deleteQuery, [deletedBy, addressId, customerId]);
  }

  static async makePrimaryAddress(customerId: number, addressId: number) {
    // First, unset all other primary addresses for this customer
    await query(
      'UPDATE customer_addresses SET is_primary = 0 WHERE customer_id = ? AND is_active = 1',
      [customerId]
    );

    // Then set this address as primary
    await query(
      'UPDATE customer_addresses SET is_primary = 1 WHERE address_id = ? AND customer_id = ? AND is_active = 1',
      [addressId, customerId]
    );
  }

  static async reactivateAddress(customerId: number, addressId: number, reactivatedBy: string) {
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