// File Clean up Finished: Nov 14, 2025
// Enhanced: Nov 14, 2025
//   - Added all CRUD methods from CustomerService (architecture migration)
//   - Methods: getCustomersWithPagination, getCustomerWithDetails, getManufacturingPreferences
//   - Methods: getCustomerAddresses, createCustomer, updateCustomer, deactivateCustomer, reactivateCustomer
//   - Full data access layer for customers table
/**
 * Customer Repository
 * Data Access Layer for Customers
 *
 * Handles all direct database operations for customer data
 * Created during orderPartCreationService cleanup to fix architecture violations
 * Enhanced during customerService cleanup to include all customer CRUD operations
 *
 * Part of Enhanced Three-Layer Architecture: Route → Controller → Service → Repository → Database
 */

import { query, pool } from '../config/database';
import { RowDataPacket, PoolConnection, ResultSetHeader } from 'mysql2/promise';

export interface CustomerPreferences {
  drain_holes_yes_or_no?: boolean;
  leds_yes_or_no?: boolean;
  led_id?: number;
  wire_length?: number;
  powersupply_yes_or_no?: boolean;
  power_supply_id?: number;
  ul_yes_or_no?: boolean;
  pattern_yes_or_no?: boolean;
  pattern_type?: string;
  wiring_diagram_yes_or_no?: boolean;
  wiring_diagram_type?: string;
  plug_n_play_yes_or_no?: boolean;
  shipping_yes_or_no?: boolean;
  shipping_multiplier?: number;
  shipping_flat?: number;
}

export class CustomerRepository {
  /**
   * Get customer preferences for order/estimate auto-fill
   * Used by specsAutoFill system for drain holes, LEDs, power supplies, etc.
   *
   * @param customerId - Customer ID
   * @param connection - Optional transaction connection
   * @returns Customer preferences or empty object if not found
   */
  async getCustomerPreferences(
    customerId: number,
    connection?: PoolConnection
  ): Promise<CustomerPreferences> {
    const conn = connection || pool;

    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT
        drain_holes_yes_or_no,
        leds_yes_or_no,
        led_id,
        wire_length,
        powersupply_yes_or_no,
        power_supply_id,
        ul_yes_or_no,
        pattern_yes_or_no,
        pattern_type,
        wiring_diagram_yes_or_no,
        wiring_diagram_type,
        plug_n_play_yes_or_no,
        shipping_yes_or_no,
        shipping_multiplier,
        shipping_flat
      FROM customers
      WHERE customer_id = ?`,
      [customerId]
    );

    return rows.length > 0 ? (rows[0] as CustomerPreferences) : {};
  }

  /**
   * Get basic customer information
   * Used for order conversion and invoice generation
   *
   * @param customerId - Customer ID
   * @param connection - Optional transaction connection
   * @returns Customer info or null if not found
   */
  async getCustomerById(
    customerId: number,
    connection?: PoolConnection
  ): Promise<RowDataPacket | null> {
    const conn = connection || pool;

    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT
        customer_id,
        company_name,
        quickbooks_name,
        contact_first_name,
        contact_last_name,
        email,
        invoice_email,
        invoice_email_preference,
        phone,
        cash_yes_or_no,
        discount,
        default_turnaround,
        payment_terms,
        deposit_required,
        special_instructions,
        comments,
        active,
        drain_holes_yes_or_no
      FROM customers
      WHERE customer_id = ?`,
      [customerId]
    );

    return rows.length > 0 ? rows[0] : null;
  }

  // =============================================
  // CUSTOMER QUERIES WITH JOINS
  // =============================================

  /**
   * Get customers with pagination, search, and filtering
   * Includes joins with addresses, LEDs, and power supplies
   */
  async getCustomersWithPagination(
    whereClause: string,
    queryParams: any[],
    limit: number,
    offset: number
  ): Promise<{ customers: RowDataPacket[]; total: number }> {
    // Get total count
    const countQuery = `SELECT COUNT(DISTINCT c.customer_id) as total FROM customers c
      LEFT JOIN customer_addresses ca ON c.customer_id = ca.customer_id AND ca.is_primary = 1 AND ca.is_active = 1
      LEFT JOIN leds l ON c.led_id = l.led_id
      LEFT JOIN power_supplies ps ON c.power_supply_id = ps.power_supply_id
      ${whereClause}`;

    const countResult = await query(countQuery, queryParams) as RowDataPacket[];
    const total = countResult[0].total;

    // Get paginated customers
    const customersQuery = `
      SELECT
        c.customer_id,
        c.company_name,
        c.quickbooks_name,
        c.contact_first_name,
        c.contact_last_name,
        c.email,
        c.invoice_email,
        c.invoice_email_preference,
        c.phone,
        c.tax_id,
        c.active,
        ca.city,
        ca.province_state_short as state,
        c.payment_terms,
        c.cash_yes_or_no,
        c.leds_yes_or_no,
        l.product_code as leds_default_type,
        c.powersupply_yes_or_no,
        ps.transformer_type as powersupply_default_type,
        c.ul_yes_or_no,
        c.drain_holes_yes_or_no,
        c.plug_n_play_yes_or_no,
        c.comments,
        c.special_instructions,
        c.created_date,
        c.updated_date
      FROM customers c
      LEFT JOIN customer_addresses ca ON c.customer_id = ca.customer_id
        AND ca.is_primary = 1 AND ca.is_active = 1
      LEFT JOIN leds l ON c.led_id = l.led_id
      LEFT JOIN power_supplies ps ON c.power_supply_id = ps.power_supply_id
      ${whereClause}
      ORDER BY c.company_name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const customers = await query(customersQuery, queryParams) as RowDataPacket[];

    return { customers, total };
  }

  /**
   * Get customer with full details including LED and power supply info
   */
  async getCustomerWithDetails(customerId: number): Promise<RowDataPacket | null> {
    const customerQuery = `
      SELECT c.*,
        l.product_code as led_product_code,
        l.brand as led_brand,
        l.colour as led_colour,
        l.watts as led_watts,
        l.price as led_price,
        ps.transformer_type as power_supply_type,
        ps.watts as power_supply_watts,
        ps.volts as power_supply_volts,
        ps.price as power_supply_price,
        ps.ul_listed as power_supply_ul_listed
      FROM customers c
      LEFT JOIN leds l ON c.led_id = l.led_id
      LEFT JOIN power_supplies ps ON c.power_supply_id = ps.power_supply_id
      WHERE c.customer_id = ?
    `;

    const customers = await query(customerQuery, [customerId]) as RowDataPacket[];

    return customers.length > 0 ? customers[0] : null;
  }

  /**
   * Get customer addresses
   */
  async getCustomerAddresses(customerId: number): Promise<RowDataPacket[]> {
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
      WHERE customer_id = ? AND is_active = 1
      ORDER BY customer_address_sequence ASC
    `;

    return await query(addressQuery, [customerId]) as RowDataPacket[];
  }

  /**
   * Get manufacturing preferences with LED and power supply details
   */
  async getManufacturingPreferences(customerId: number): Promise<RowDataPacket | null> {
    const preferencesQuery = `
      SELECT
        c.customer_id,
        c.leds_yes_or_no,
        c.led_id,
        c.wire_length,
        c.powersupply_yes_or_no,
        c.power_supply_id,
        c.ul_yes_or_no,
        c.drain_holes_yes_or_no,
        c.pattern_yes_or_no,
        c.pattern_type,
        c.wiring_diagram_yes_or_no,
        c.wiring_diagram_type,
        c.plug_n_play_yes_or_no,
        c.shipping_yes_or_no,
        c.shipping_multiplier,
        c.shipping_flat,
        c.comments,
        c.special_instructions,
        l.product_code AS led_product_code,
        l.brand AS led_brand,
        l.colour AS led_colour,
        l.watts AS led_watts,
        ps.transformer_type AS power_supply_type,
        ps.watts AS power_supply_watts,
        ps.volts AS power_supply_volts,
        ps.ul_listed AS power_supply_ul_listed
      FROM customers c
      LEFT JOIN leds l ON c.led_id = l.led_id
      LEFT JOIN power_supplies ps ON c.power_supply_id = ps.power_supply_id
      WHERE c.customer_id = ?
        AND c.active = 1
    `;

    const rows = await query(preferencesQuery, [customerId]) as RowDataPacket[];
    return rows.length > 0 ? rows[0] : null;
  }

  // =============================================
  // CUSTOMER MUTATIONS
  // =============================================

  /**
   * Create a new customer
   * Returns the new customer ID
   */
  async createCustomer(
    fields: string[],
    values: any[]
  ): Promise<number> {
    const placeholders = fields.map(field =>
      field === 'created_date' || field === 'updated_date' ? 'CURRENT_TIMESTAMP' : '?'
    ).join(', ');

    const insertQuery = `
      INSERT INTO customers (${fields.join(', ')}) VALUES (${placeholders})
    `;

    const queryValues = values.filter((_, index) => {
      const field = fields[index];
      return field !== 'created_date' && field !== 'updated_date';
    });

    const result = await query(insertQuery, queryValues) as ResultSetHeader;
    return result.insertId;
  }

  /**
   * Update customer data
   */
  async updateCustomer(
    customerId: number,
    updateData: any[],
    updatedBy: string
  ): Promise<void> {
    const updateQuery = `
      UPDATE customers SET
        company_name = ?,
        quickbooks_name = ?,
        contact_first_name = ?,
        contact_last_name = ?,
        email = ?,
        invoice_email = ?,
        invoice_email_preference = ?,
        phone = ?,
        payment_terms = ?,
        discount = ?,
        cash_yes_or_no = ?,
        leds_yes_or_no = ?,
        led_id = ?,
        wire_length = ?,
        powersupply_yes_or_no = ?,
        power_supply_id = ?,
        ul_yes_or_no = ?,
        default_turnaround = ?,
        drain_holes_yes_or_no = ?,
        pattern_yes_or_no = ?,
        pattern_type = ?,
        wiring_diagram_yes_or_no = ?,
        wiring_diagram_type = ?,
        plug_n_play_yes_or_no = ?,
        shipping_yes_or_no = ?,
        shipping_multiplier = ?,
        shipping_flat = ?,
        comments = ?,
        special_instructions = ?,
        updated_by = ?,
        updated_date = CURRENT_TIMESTAMP
      WHERE customer_id = ? AND active = 1
    `;

    await query(updateQuery, [...updateData, updatedBy, customerId]);
  }

  /**
   * Deactivate customer (soft delete)
   */
  async deactivateCustomer(customerId: number): Promise<number> {
    const deactivateQuery = `
      UPDATE customers SET
        active = 0,
        updated_date = CURRENT_TIMESTAMP
      WHERE customer_id = ? AND active = 1
    `;

    const result = await query(deactivateQuery, [customerId]) as ResultSetHeader;
    return result.affectedRows;
  }

  /**
   * Reactivate customer
   */
  async reactivateCustomer(customerId: number): Promise<number> {
    const reactivateQuery = `
      UPDATE customers SET
        active = 1,
        updated_date = CURRENT_TIMESTAMP
      WHERE customer_id = ? AND active = 0
    `;

    const result = await query(reactivateQuery, [customerId]) as ResultSetHeader;
    return result.affectedRows;
  }
}

export const customerRepository = new CustomerRepository();
