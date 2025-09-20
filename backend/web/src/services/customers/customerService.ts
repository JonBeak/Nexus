import { query } from '../../config/database';
import { RowDataPacket } from 'mysql2';

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
  comments?: string;
  special_instructions?: string;
}

export class CustomerService {
  static async getCustomers(filters: CustomerFilters) {
    const page = filters.page || 1;
    const limit = filters.limit || 25;
    const search = filters.search || '';
    const includeInactive = filters.includeInactive || false;
    const offset = (page - 1) * limit;

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

    // Get total count for pagination  
    const countQuery = `SELECT COUNT(DISTINCT c.customer_id) as total FROM customers c
      LEFT JOIN customer_addresses ca ON c.customer_id = ca.customer_id AND ca.is_primary = 1 AND ca.is_active = 1
      LEFT JOIN leds l ON c.led_id = l.led_id
      LEFT JOIN power_supplies ps ON c.power_supply_id = ps.power_supply_id
      ${whereClause}`;
    const countResult = await query(countQuery, queryParams) as RowDataPacket[];
    const total = countResult[0].total;

    // Get customers with pagination
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
    
    const customers = await query(customersQuery, queryParams) as Customer[];

    return {
      customers,
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

  static async getCustomerById(customerId: number) {
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
    
    const customers = await query(customerQuery, [customerId]) as Customer[];
    
    if (customers.length === 0) {
      return null;
    }

    // Get customer addresses
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
        tax_type,
        tax_id,
        tax_override_reason,
        use_province_tax,
        comments,
        is_active,
        created_date,
        updated_date
      FROM customer_addresses 
      WHERE customer_id = ? AND is_active = 1
      ORDER BY customer_address_sequence ASC
    `;
    
    const addresses = await query(addressQuery, [customerId]);

    return {
      ...customers[0],
      addresses: addresses || []
    };
  }

  static async updateCustomer(customerId: number, customerData: CustomerData, updatedBy: string) {
    const {
      company_name,
      quickbooks_name,
      contact_first_name,
      contact_last_name,
      email,
      invoice_email,
      invoice_email_preference,
      phone,
      payment_terms,
      discount,
      cash_yes_or_no,
      leds_yes_or_no,
      led_id,
      wire_length,
      powersupply_yes_or_no,
      power_supply_id,
      ul_yes_or_no,
      default_turnaround,
      drain_holes_yes_or_no,
      pattern_yes_or_no,
      pattern_type,
      wiring_diagram_yes_or_no,
      wiring_diagram_type,
      plug_n_play_yes_or_no,
      shipping_yes_or_no,
      shipping_multiplier,
      shipping_flat,
      comments,
      special_instructions
    } = customerData;

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

    await query(updateQuery, [
      company_name || null,
      quickbooks_name || null,
      contact_first_name || null,
      contact_last_name || null,
      email || null,
      invoice_email || null,
      invoice_email_preference || null,
      phone || null,
      payment_terms || null,
      discount || 0,
      cash_yes_or_no ? 1 : 0,
      leds_yes_or_no ? 1 : 0,
      led_id || null,
      wire_length,
      powersupply_yes_or_no ? 1 : 0,
      power_supply_id || null,
      ul_yes_or_no ? 1 : 0,
      default_turnaround || 10,
      drain_holes_yes_or_no !== undefined ? (drain_holes_yes_or_no ? 1 : 0) : 1,
      pattern_yes_or_no !== undefined ? (pattern_yes_or_no ? 1 : 0) : 1,
      pattern_type || 'Paper',
      wiring_diagram_yes_or_no !== undefined ? (wiring_diagram_yes_or_no ? 1 : 0) : 1,
      wiring_diagram_type || 'Paper',
      plug_n_play_yes_or_no ? 1 : 0,
      shipping_yes_or_no ? 1 : 0,
      shipping_multiplier || 1.5,
      shipping_flat || null,
      comments || null,
      special_instructions || null,
      updatedBy,
      customerId
    ]);
  }

  static async createCustomer(customerData: CustomerData) {
    const {
      company_name,
      quickbooks_name,
      contact_first_name,
      contact_last_name,
      email,
      phone,
      invoice_email,
      invoice_email_preference,
      payment_terms,
      discount,
      cash_yes_or_no = false,
      leds_yes_or_no = false,
      led_id,
      wire_length,
      powersupply_yes_or_no = false,
      power_supply_id,
      ul_yes_or_no = false,
      default_turnaround,
      drain_holes_yes_or_no,
      pattern_yes_or_no,
      pattern_type,
      wiring_diagram_yes_or_no,
      wiring_diagram_type,
      plug_n_play_yes_or_no,
      shipping_yes_or_no,
      shipping_multiplier,
      shipping_flat,
      comments,
      special_instructions
    } = customerData;

    // Convert undefined to null for MySQL
    const safeData = {
      company_name: company_name || null,
      quickbooks_name: quickbooks_name || null,
      contact_first_name: contact_first_name || null,
      contact_last_name: contact_last_name || null,
      email: email || null,
      phone: phone || null,
      invoice_email: invoice_email || null,
      invoice_email_preference: invoice_email_preference || null,
      payment_terms: payment_terms || null,
      discount: discount || 0,
      cash_yes_or_no: Boolean(cash_yes_or_no),
      leds_yes_or_no: Boolean(leds_yes_or_no),
      led_id: led_id || null,
      wire_length: wire_length,
      powersupply_yes_or_no: Boolean(powersupply_yes_or_no),
      power_supply_id: power_supply_id || null,
      ul_yes_or_no: Boolean(ul_yes_or_no),
      default_turnaround: default_turnaround || 10,
      drain_holes_yes_or_no: drain_holes_yes_or_no !== undefined ? Boolean(drain_holes_yes_or_no) : true,
      pattern_yes_or_no: pattern_yes_or_no !== undefined ? Boolean(pattern_yes_or_no) : true,
      pattern_type: pattern_type || 'Paper',
      wiring_diagram_yes_or_no: wiring_diagram_yes_or_no !== undefined ? Boolean(wiring_diagram_yes_or_no) : true,
      wiring_diagram_type: wiring_diagram_type || 'Paper',
      plug_n_play_yes_or_no: Boolean(plug_n_play_yes_or_no),
      shipping_yes_or_no: Boolean(shipping_yes_or_no),
      shipping_multiplier: shipping_multiplier || 1.5,
      shipping_flat: shipping_flat || null,
      comments: comments || null,
      special_instructions: special_instructions || null
    };

    if (!safeData.company_name) {
      throw new Error('Company name is required');
    }

    // Build dynamic INSERT query - omit wire_length if undefined to use DB default
    const fields = [
      'company_name', 'quickbooks_name', 'quickbooks_name_search', 'contact_first_name', 'contact_last_name',
      'email', 'phone', 'invoice_email', 'invoice_email_preference', 'tax_id', 'payment_terms',
      'discount', 'cash_yes_or_no', 'leds_yes_or_no', 'led_id',
      'powersupply_yes_or_no', 'power_supply_id', 'ul_yes_or_no', 'default_turnaround',
      'drain_holes_yes_or_no', 'pattern_yes_or_no', 'pattern_type',
      'wiring_diagram_yes_or_no', 'wiring_diagram_type', 'plug_n_play_yes_or_no',
      'shipping_yes_or_no', 'shipping_multiplier', 'shipping_flat',
      'comments', 'special_instructions', 'created_by', 'updated_by', 'active', 'created_date', 'updated_date'
    ];
    
    const values = [
      safeData.company_name, safeData.quickbooks_name, safeData.quickbooks_name || safeData.company_name, safeData.contact_first_name, safeData.contact_last_name,
      safeData.email, safeData.phone, safeData.invoice_email, safeData.invoice_email_preference, null, safeData.payment_terms,
      safeData.discount, safeData.cash_yes_or_no, safeData.leds_yes_or_no, safeData.led_id,
      safeData.powersupply_yes_or_no, safeData.power_supply_id, safeData.ul_yes_or_no, safeData.default_turnaround,
      safeData.drain_holes_yes_or_no, safeData.pattern_yes_or_no, safeData.pattern_type,
      safeData.wiring_diagram_yes_or_no, safeData.wiring_diagram_type, safeData.plug_n_play_yes_or_no,
      safeData.shipping_yes_or_no, safeData.shipping_multiplier, safeData.shipping_flat,
      safeData.comments, safeData.special_instructions, null, null, 1, 'CURRENT_TIMESTAMP', 'CURRENT_TIMESTAMP'
    ];

    // Add wire_length only if it's defined
    if (wire_length !== undefined) {
      const wireIndex = fields.indexOf('powersupply_yes_or_no');
      fields.splice(wireIndex, 0, 'wire_length');
      values.splice(wireIndex, 0, safeData.wire_length ?? null);
    }

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

    const result = await query(insertQuery, queryValues);

    const newCustomerId = (result as any).insertId;
    
    // Get the created customer
    return await this.getCustomerById(newCustomerId);
  }

  static async deactivateCustomer(customerId: number) {
    const deactivateQuery = `
      UPDATE customers SET 
        active = 0,
        updated_date = CURRENT_TIMESTAMP
      WHERE customer_id = ? AND active = 1
    `;

    const result = await query(deactivateQuery, [customerId]);
    
    if ((result as any).affectedRows === 0) {
      throw new Error('Customer not found or already deactivated');
    }
  }

  static async reactivateCustomer(customerId: number) {
    const reactivateQuery = `
      UPDATE customers SET 
        active = 1,
        updated_date = CURRENT_TIMESTAMP
      WHERE customer_id = ? AND active = 0
    `;

    const result = await query(reactivateQuery, [customerId]);
    
    if ((result as any).affectedRows === 0) {
      throw new Error('Customer not found or already active');
    }
  }
}