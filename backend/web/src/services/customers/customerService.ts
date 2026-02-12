// File Clean up Finished: Nov 14, 2025
// Changes:
//   - CRITICAL: Fixed architecture violation - service used query() directly
//   - Migrated all 7 methods to use CustomerRepository (full 3-layer compliance)
//   - Removed 9 direct database queries, replaced with repository methods
//   - File size reduced from 591 → 336 lines (43% reduction, 164 lines under limit)
//   - Service now focused on business logic: validation, data transformation, error handling
//   - Repository handles ALL database access
//   - Enhanced CustomerRepository with all CRUD operations during this cleanup
/**
 * Customer Service
 * Business Logic Layer for Customer Management
 *
 * Handles business rules, validation, and data transformation
 * All database operations delegated to CustomerRepository
 *
 * Part of Enhanced Three-Layer Architecture: Route → Controller → Service → Repository → Database
 */

import { customerRepository } from '../../repositories/customerRepository';
import { convertBooleanFieldsArray, convertBooleanFields } from '../../utils/databaseUtils';
import { RowDataPacket } from 'mysql2';
import { qbCustomerService, QBCustomerCreationResult } from '../qbCustomerService';

// Interface for customer data
export interface Customer extends RowDataPacket {
  customer_id: number;
  company_name: string;
  quickbooks_name?: string;
  contact_first_name?: string;
  contact_last_name?: string;
  email?: string;
  phone?: string;
  tax_id?: string;
  payment_terms?: string;
  discount: number;
  cash_yes_or_no: boolean;
  default_turnaround: number;
  created_date: Date;
  updated_date: Date;
  active: boolean;
}

export interface CustomerFilters {
  page?: number;
  limit?: number;
  search?: string;
  includeInactive?: boolean;
}

export interface CustomerData {
  company_name?: string;
  quickbooks_name?: string;
  contact_first_name?: string;
  contact_last_name?: string;
  email?: string;
  invoice_email?: string;
  invoice_email_preference?: string;
  phone?: string;
  tax_id?: string;
  payment_terms?: string;
  discount?: number;
  cash_yes_or_no?: boolean;
  leds_yes_or_no?: boolean;
  led_id?: number;
  wire_length?: number;
  powersupply_yes_or_no?: boolean;
  power_supply_id?: number;
  ul_yes_or_no?: boolean;
  default_turnaround?: number;
  drain_holes_yes_or_no?: boolean;
  pattern_yes_or_no?: boolean;
  pattern_type?: string;
  wiring_diagram_yes_or_no?: boolean;
  wiring_diagram_type?: string;
  plug_n_play_yes_or_no?: boolean;
  shipping_yes_or_no?: boolean;
  shipping_multiplier?: number;
  shipping_flat?: number;
  high_standards?: boolean;
  hide_company_name?: boolean;
  po_required?: boolean;
  comments?: string;
  special_instructions?: string;
}

export interface CreateCustomerOptions {
  createInQB?: boolean;
  primaryAddress?: {
    address_line1?: string;
    address_line2?: string;
    city?: string;
    province_state_short?: string;
    postal_zip?: string;
    country?: string;
    tax_type?: string; // Tax name for QB DefaultTaxCodeRef (e.g., "GST", "HST Ontario")
  };
}

export interface CreateCustomerResult {
  customer: (Customer & { addresses: any[] }) | null;
  qbResult?: QBCustomerCreationResult;
}

export class CustomerService {
  /**
   * Get customers with pagination and search
   * Business logic: Build search filters, convert boolean fields, calculate pagination
   */
  static async getCustomers(filters: CustomerFilters) {
    const page = filters.page || 1;
    const limit = filters.limit || 25;
    const search = filters.search || '';
    const includeInactive = filters.includeInactive || false;
    const offset = (page - 1) * limit;

    // Build WHERE clause for search filtering (business logic)
    let whereClause = includeInactive ? 'WHERE 1=1' : 'WHERE c.active = 1';
    let queryParams: any[] = [];

    if (search) {
      const searchTerm = `%${search}%`;
      whereClause += ` AND (
        c.company_name LIKE ? OR
        c.quickbooks_name LIKE ? OR
        c.contact_first_name LIKE ? OR
        c.contact_last_name LIKE ? OR
        c.email LIKE ? OR
        c.phone LIKE ? OR
        c.invoice_email LIKE ? OR
        c.invoice_email_preference LIKE ? OR
        c.comments LIKE ? OR
        c.special_instructions LIKE ? OR
        l.product_code LIKE ? OR
        l.brand LIKE ? OR
        ps.transformer_type LIKE ?
      )`;
      queryParams = Array(13).fill(searchTerm);
    }

    // Delegate database access to repository
    const { customers, total } = await customerRepository.getCustomersWithPagination(
      whereClause,
      queryParams,
      limit,
      offset
    );

    // Business logic: Convert MySQL boolean fields (TINYINT) to TypeScript booleans
    const booleanFields: (keyof Customer)[] = [
      'active',
      'cash_yes_or_no',
      'leds_yes_or_no',
      'powersupply_yes_or_no',
      'ul_yes_or_no',
      'drain_holes_yes_or_no',
      'plug_n_play_yes_or_no',
      'high_standards',
      'hide_company_name',
      'po_required'
    ];
    const convertedCustomers = convertBooleanFieldsArray(customers, booleanFields);

    // Business logic: Calculate pagination metadata
    return {
      customers: convertedCustomers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Get customer by ID with addresses
   * Business logic: Combine customer and address data, convert boolean fields
   */
  static async getCustomerById(customerId: number): Promise<(Customer & { addresses: any[] }) | null> {
    // Delegate database access to repository
    const customer = await customerRepository.getCustomerWithDetails(customerId);

    if (!customer) {
      return null;
    }

    // Get customer addresses
    const addresses = await customerRepository.getCustomerAddresses(customerId);

    // Business logic: Convert boolean fields for customer
    const customerBooleanFields: (keyof Customer)[] = [
      'active',
      'cash_yes_or_no',
      'leds_yes_or_no',
      'powersupply_yes_or_no',
      'ul_yes_or_no',
      'drain_holes_yes_or_no',
      'plug_n_play_yes_or_no',
      'high_standards',
      'hide_company_name',
      'po_required'
    ];
    const convertedCustomer = convertBooleanFields(customer, customerBooleanFields) as Customer;

    // Business logic: Convert boolean fields for addresses
    const addressBooleanFields = [
      'is_primary',
      'is_billing',
      'is_shipping',
      'is_jobsite',
      'is_mailing',
      'is_active'
    ];
    const convertedAddresses = convertBooleanFieldsArray(addresses as any[], addressBooleanFields);

    return {
      ...convertedCustomer,
      addresses: convertedAddresses || []
    };
  }

  /**
   * Get manufacturing preferences
   * Business logic: Transform raw data into prefixed, typed format
   */
  static async getManufacturingPreferences(customerId: number) {
    // Delegate database access to repository
    const row = await customerRepository.getManufacturingPreferences(customerId);

    if (!row) {
      return null;
    }

    // Business logic: Transform data into expected format with prefixes
    return {
      pref_customer_id: row.customer_id,
      pref_leds_enabled: Boolean(row.leds_yes_or_no),
      pref_led_id: row.led_id ?? null,
      pref_led_product_code: row.led_product_code ?? null,
      pref_led_brand: row.led_brand ?? null,
      pref_led_colour: row.led_colour ?? null,
      pref_led_watts: row.led_watts ?? null,
      pref_wire_length: row.wire_length ?? null,
      pref_power_supply_required: Boolean(row.powersupply_yes_or_no),
      pref_power_supply_id: row.power_supply_id ?? null,
      pref_power_supply_type: row.power_supply_type ?? null,
      pref_power_supply_watts: row.power_supply_watts ?? null,
      pref_power_supply_volts: row.power_supply_volts ?? null,
      pref_power_supply_is_ul_listed: row.power_supply_ul_listed === 1,
      pref_ul_required: Boolean(row.ul_yes_or_no),
      pref_drain_holes_required: row.drain_holes_yes_or_no === null ? null : Boolean(row.drain_holes_yes_or_no),
      pref_pattern_required: row.pattern_yes_or_no === null ? null : Boolean(row.pattern_yes_or_no),
      pref_pattern_type: row.pattern_type ?? null,
      pref_wiring_diagram_required: row.wiring_diagram_yes_or_no === null ? null : Boolean(row.wiring_diagram_yes_or_no),
      pref_wiring_diagram_type: row.wiring_diagram_type ?? null,
      pref_plug_and_play_required: row.plug_n_play_yes_or_no === null ? null : Boolean(row.plug_n_play_yes_or_no),
      pref_shipping_required: row.shipping_yes_or_no === null ? null : Boolean(row.shipping_yes_or_no),
      pref_shipping_multiplier: row.shipping_multiplier ?? null,
      pref_shipping_flat: row.shipping_flat ?? null,
      pref_manufacturing_comments: row.comments ?? null,
      pref_special_instructions: row.special_instructions ?? null
    };
  }

  /**
   * Update customer
   * Business logic: Validate data, apply defaults, convert booleans to TINYINT
   */
  static async updateCustomer(customerId: number, customerData: CustomerData, updatedBy: string) {
    // Business logic: Prepare data with defaults and type conversions
    const updateData = [
      customerData.company_name || null,
      customerData.quickbooks_name || null,
      customerData.contact_first_name || null,
      customerData.contact_last_name || null,
      customerData.email || null,
      customerData.invoice_email || null,
      customerData.invoice_email_preference || null,
      customerData.phone || null,
      customerData.payment_terms || null,
      customerData.discount || 0,
      customerData.cash_yes_or_no ? 1 : 0,
      customerData.leds_yes_or_no ? 1 : 0,
      customerData.led_id || null,
      customerData.wire_length,
      customerData.powersupply_yes_or_no ? 1 : 0,
      customerData.power_supply_id || null,
      customerData.ul_yes_or_no ? 1 : 0,
      customerData.default_turnaround || 10,
      customerData.drain_holes_yes_or_no !== undefined ? (customerData.drain_holes_yes_or_no ? 1 : 0) : 1,
      customerData.pattern_yes_or_no !== undefined ? (customerData.pattern_yes_or_no ? 1 : 0) : 1,
      customerData.pattern_type || 'Paper',
      customerData.wiring_diagram_yes_or_no !== undefined ? (customerData.wiring_diagram_yes_or_no ? 1 : 0) : 1,
      customerData.wiring_diagram_type || 'Paper',
      customerData.plug_n_play_yes_or_no ? 1 : 0,
      customerData.shipping_yes_or_no ? 1 : 0,
      customerData.shipping_multiplier || 1.5,
      customerData.shipping_flat || null,
      customerData.high_standards ? 1 : 0,
      customerData.hide_company_name ? 1 : 0,
      customerData.po_required ? 1 : 0,
      customerData.comments || null,
      customerData.special_instructions || null
    ];

    // Delegate database access to repository
    await customerRepository.updateCustomer(customerId, updateData, updatedBy);
  }

  /**
   * Create customer with optional QuickBooks sync
   * Business logic: Validate required fields, apply defaults, optionally sync to QB
   *
   * @param customerData - Customer fields
   * @param options.createInQB - Whether to create customer in QuickBooks
   * @param options.primaryAddress - Primary address for QB BillAddr
   */
  static async createCustomer(
    customerData: CustomerData,
    options?: CreateCustomerOptions
  ): Promise<CreateCustomerResult> {
    // Business logic: Apply defaults and validate
    const safeData = {
      company_name: customerData.company_name || null,
      quickbooks_name: customerData.quickbooks_name || null,
      contact_first_name: customerData.contact_first_name || null,
      contact_last_name: customerData.contact_last_name || null,
      email: customerData.email || null,
      phone: customerData.phone || null,
      invoice_email: customerData.invoice_email || null,
      invoice_email_preference: customerData.invoice_email_preference || null,
      payment_terms: customerData.payment_terms || null,
      discount: customerData.discount || 0,
      cash_yes_or_no: Boolean(customerData.cash_yes_or_no),
      leds_yes_or_no: Boolean(customerData.leds_yes_or_no),
      led_id: customerData.led_id || null,
      wire_length: customerData.wire_length,
      powersupply_yes_or_no: Boolean(customerData.powersupply_yes_or_no),
      power_supply_id: customerData.power_supply_id || null,
      ul_yes_or_no: Boolean(customerData.ul_yes_or_no),
      default_turnaround: customerData.default_turnaround || 10,
      drain_holes_yes_or_no: customerData.drain_holes_yes_or_no !== undefined ? Boolean(customerData.drain_holes_yes_or_no) : true,
      pattern_yes_or_no: customerData.pattern_yes_or_no !== undefined ? Boolean(customerData.pattern_yes_or_no) : true,
      pattern_type: customerData.pattern_type || 'Paper',
      wiring_diagram_yes_or_no: customerData.wiring_diagram_yes_or_no !== undefined ? Boolean(customerData.wiring_diagram_yes_or_no) : true,
      wiring_diagram_type: customerData.wiring_diagram_type || 'Paper',
      plug_n_play_yes_or_no: Boolean(customerData.plug_n_play_yes_or_no),
      shipping_yes_or_no: Boolean(customerData.shipping_yes_or_no),
      shipping_multiplier: customerData.shipping_multiplier || 1.5,
      shipping_flat: customerData.shipping_flat || null,
      high_standards: Boolean(customerData.high_standards),
      hide_company_name: Boolean(customerData.hide_company_name),
      po_required: Boolean(customerData.po_required),
      comments: customerData.comments || null,
      special_instructions: customerData.special_instructions || null
    };

    // Business logic: Validate required fields
    if (!safeData.company_name) {
      throw new Error('Company name is required');
    }

    // Check for duplicate company name
    const existingCustomer = await customerRepository.getCustomerByName(safeData.company_name);
    if (existingCustomer) {
      const error = new Error(`A customer with the name "${safeData.company_name}" already exists`);
      (error as any).code = 'DUPLICATE_ENTRY';
      throw error;
    }

    // Business logic: Build dynamic INSERT fields array
    const fields = [
      'company_name', 'quickbooks_name', 'quickbooks_name_search', 'contact_first_name', 'contact_last_name',
      'email', 'phone', 'invoice_email', 'invoice_email_preference', 'tax_id', 'payment_terms',
      'discount', 'cash_yes_or_no', 'leds_yes_or_no', 'led_id',
      'powersupply_yes_or_no', 'power_supply_id', 'ul_yes_or_no', 'default_turnaround',
      'drain_holes_yes_or_no', 'pattern_yes_or_no', 'pattern_type',
      'wiring_diagram_yes_or_no', 'wiring_diagram_type', 'plug_n_play_yes_or_no',
      'shipping_yes_or_no', 'shipping_multiplier', 'shipping_flat', 'high_standards', 'hide_company_name', 'po_required',
      'comments', 'special_instructions', 'created_by', 'updated_by', 'active', 'created_date', 'updated_date'
    ];

    const values = [
      safeData.company_name, safeData.quickbooks_name, safeData.quickbooks_name || safeData.company_name,
      safeData.contact_first_name, safeData.contact_last_name,
      safeData.email, safeData.phone, safeData.invoice_email, safeData.invoice_email_preference, null, safeData.payment_terms,
      safeData.discount, safeData.cash_yes_or_no, safeData.leds_yes_or_no, safeData.led_id,
      safeData.powersupply_yes_or_no, safeData.power_supply_id, safeData.ul_yes_or_no, safeData.default_turnaround,
      safeData.drain_holes_yes_or_no, safeData.pattern_yes_or_no, safeData.pattern_type,
      safeData.wiring_diagram_yes_or_no, safeData.wiring_diagram_type, safeData.plug_n_play_yes_or_no,
      safeData.shipping_yes_or_no, safeData.shipping_multiplier, safeData.shipping_flat, safeData.high_standards, safeData.hide_company_name, safeData.po_required,
      safeData.comments, safeData.special_instructions, null, null, 1, 'CURRENT_TIMESTAMP', 'CURRENT_TIMESTAMP'
    ];

    // Add wire_length only if it's defined (business logic for optional field)
    if (customerData.wire_length !== undefined) {
      const wireIndex = fields.indexOf('powersupply_yes_or_no');
      fields.splice(wireIndex, 0, 'wire_length');
      values.splice(wireIndex, 0, safeData.wire_length ?? null);
    }

    // Delegate database access to repository
    const newCustomerId = await customerRepository.createCustomer(fields, values);

    // Get the created customer
    const customer = await this.getCustomerById(newCustomerId);

    // If createInQB option is enabled, sync to QuickBooks
    let qbResult: QBCustomerCreationResult | undefined;
    if (options?.createInQB && customer) {
      console.log('[CustomerService] Creating customer in QuickBooks...');
      qbResult = await qbCustomerService.createCustomerInQuickBooks(
        {
          company_name: safeData.company_name!,
          quickbooks_name: safeData.quickbooks_name || undefined,
          contact_first_name: safeData.contact_first_name || undefined,
          contact_last_name: safeData.contact_last_name || undefined,
          email: safeData.email || undefined,
          phone: safeData.phone || undefined,
          address: options.primaryAddress,
          tax_type: options.primaryAddress?.tax_type
        },
        newCustomerId
      );

      if (qbResult.success) {
        console.log(`[CustomerService] Customer synced to QuickBooks: ${qbResult.qbCustomerId}`);
      } else {
        console.warn('[CustomerService] QuickBooks sync failed:', qbResult.error);
      }
    }

    return { customer, qbResult };
  }

  /**
   * Deactivate customer
   * Business logic: Validate result, throw error if customer not found
   */
  static async deactivateCustomer(customerId: number) {
    const affectedRows = await customerRepository.deactivateCustomer(customerId);

    if (affectedRows === 0) {
      throw new Error('Customer not found or already deactivated');
    }
  }

  /**
   * Reactivate customer
   * Business logic: Validate result, throw error if customer not found
   */
  static async reactivateCustomer(customerId: number) {
    const affectedRows = await customerRepository.reactivateCustomer(customerId);

    if (affectedRows === 0) {
      throw new Error('Customer not found or already active');
    }
  }
}
