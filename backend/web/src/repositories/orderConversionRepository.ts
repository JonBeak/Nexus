/**
 * Order Conversion Repository
 * Data Access Layer for Estimate-to-Order Conversion
 *
 * Extracted from orderRepository.ts - 2025-11-21
 * Handles all direct database operations for:
 * - Estimate validation and conversion
 * - Product type lookups
 * - Order point persons management
 */

import { query, pool } from '../config/database';
import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';
import { EstimateLineItem, CreateOrderPointPersonData, OrderPointPerson } from '../types/orders';

export class OrderConversionRepository {

  // =============================================
  // ESTIMATE OPERATIONS
  // =============================================

  /**
   * Get estimate for conversion with validation
   * Returns customer_id, status, and version info
   */
  async getEstimateForConversion(
    estimateId: number,
    connection?: PoolConnection
  ): Promise<{
    estimate_id: number;
    customer_id: number;
    status: string;
    version_number: number;
  } | null> {
    const conn = connection || pool;

    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT id as estimate_id, customer_id, status, version_number
       FROM job_estimates
       WHERE id = ?`,
      [estimateId]
    );

    if (rows.length === 0) {
      return null;
    }

    return rows[0] as {
      estimate_id: number;
      customer_id: number;
      status: string;
      version_number: number;
    };
  }

  /**
   * Get estimate line items for order part creation
   */
  async getEstimateItems(
    estimateId: number,
    connection?: PoolConnection
  ): Promise<EstimateLineItem[]> {
    const conn = connection || pool;

    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT *
       FROM job_estimate_items
       WHERE estimate_id = ?
       ORDER BY item_order`,
      [estimateId]
    );

    return rows as EstimateLineItem[];
  }

  /**
   * Update estimate status (deprecated - use updateEstimateStatusAndApproval)
   */
  async updateEstimateStatus(
    estimateId: number,
    status: string,
    connection?: PoolConnection
  ): Promise<void> {
    const conn = connection || pool;

    await conn.execute(
      `UPDATE job_estimates SET status = ? WHERE id = ?`,
      [status, estimateId]
    );
  }

  /**
   * Update estimate status and approval flag
   * Used during order conversion to mark estimate as approved
   */
  async updateEstimateStatusAndApproval(
    estimateId: number,
    status: string,
    approved: boolean,
    connection?: PoolConnection
  ): Promise<void> {
    const conn = connection || pool;

    await conn.execute(
      `UPDATE job_estimates SET status = ?, is_approved = ? WHERE id = ?`,
      [status, approved, estimateId]
    );
  }

  /**
   * Get product type info for part creation
   * Returns product type details including channel letter flag (derived from name)
   */
  async getProductTypeInfo(
    productTypeId: number,
    connection?: PoolConnection
  ): Promise<{
    id: number;
    name: string;
    category: string | null;
    is_channel_letter: boolean;
  } | null> {
    const conn = connection || pool;

    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT id, name, category
       FROM product_types
       WHERE id = ?`,
      [productTypeId]
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      // Derive is_channel_letter from product type name (id=1 is "Channel Letters")
      is_channel_letter: row.name.toLowerCase().includes('channel letter')
    };
  }

  // =============================================
  // ORDER POINT PERSONS
  // =============================================

  /**
   * Create order point person
   * Used during order conversion to assign customer contacts
   */
  async createOrderPointPerson(
    data: CreateOrderPointPersonData,
    connection?: PoolConnection
  ): Promise<number> {
    const conn = connection || pool;

    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO order_point_persons (
        order_id, contact_id, contact_email, contact_name,
        contact_phone, contact_role, display_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.order_id,
        data.contact_id || null,
        data.contact_email || null,
        data.contact_name || null,
        data.contact_phone || null,
        data.contact_role || null,
        data.display_order || 0
      ]
    );

    return result.insertId;
  }

  /**
   * Get point persons for an order
   * Returns array of contact info in display_order
   */
  async getOrderPointPersons(orderId: number): Promise<OrderPointPerson[]> {
    const rows = await query(
      `SELECT *
       FROM order_point_persons
       WHERE order_id = ?
       ORDER BY display_order`,
      [orderId]
    ) as RowDataPacket[];

    return rows as OrderPointPerson[];
  }

  /**
   * Delete all point persons for an order
   * Used when updating point persons (delete and recreate)
   */
  async deleteOrderPointPersons(
    orderId: number,
    connection?: PoolConnection
  ): Promise<void> {
    const conn = connection || pool;

    await conn.execute(
      `DELETE FROM order_point_persons WHERE order_id = ?`,
      [orderId]
    );
  }
}

export const orderConversionRepository = new OrderConversionRepository();
