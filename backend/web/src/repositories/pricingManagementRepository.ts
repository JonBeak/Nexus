/**
 * Pricing Management Repository - Generic CRUD for pricing tables
 *
 * Uses column definitions from pricingTableDefinitions.ts to build
 * dynamic SQL. Only whitelisted columns are used in queries.
 */

import { query } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import {
  PricingTableDefinition,
  ColumnDefinition,
  quoteColumn,
  quotePrimaryKey
} from '../config/pricingTableDefinitions';

export class PricingManagementRepository {
  /**
   * Get all rows from a pricing table
   */
  async getAll(def: PricingTableDefinition, includeInactive: boolean): Promise<RowDataPacket[]> {
    const pk = quotePrimaryKey(def);
    const allCols = [pk, ...def.columns.map(c => quoteColumn(c))].join(', ');

    let sql = `SELECT ${allCols} FROM ${def.tableName}`;

    if (def.hasActiveFilter && !includeInactive) {
      sql += ' WHERE is_active = 1';
    }

    if (def.orderBy) {
      sql += ` ORDER BY ${def.orderBy}`;
    }

    return await query(sql) as RowDataPacket[];
  }

  /**
   * Get a single row by primary key
   */
  async getById(def: PricingTableDefinition, id: number | string): Promise<RowDataPacket | null> {
    const pk = quotePrimaryKey(def);
    const allCols = [pk, ...def.columns.map(c => quoteColumn(c))].join(', ');

    const sql = `SELECT ${allCols} FROM ${def.tableName} WHERE ${pk} = ?`;
    const rows = await query(sql, [id]) as RowDataPacket[];
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Create a new row
   */
  async create(def: PricingTableDefinition, data: Record<string, any>): Promise<number | string> {
    const columnsToInsert: string[] = [];
    const values: any[] = [];
    const placeholders: string[] = [];

    // For non-auto-increment tables, include the primary key
    if (!def.autoIncrement && data[def.primaryKey] !== undefined) {
      columnsToInsert.push(quotePrimaryKey(def));
      values.push(data[def.primaryKey]);
      placeholders.push('?');
    }

    for (const col of def.columns) {
      if (data[col.name] !== undefined) {
        columnsToInsert.push(quoteColumn(col));
        values.push(this.convertValue(col, data[col.name]));
        placeholders.push('?');
      }
    }

    const sql = `INSERT INTO ${def.tableName} (${columnsToInsert.join(', ')}) VALUES (${placeholders.join(', ')})`;
    const result = await query(sql, values) as ResultSetHeader;

    if (def.autoIncrement) {
      return result.insertId;
    }
    return data[def.primaryKey];
  }

  /**
   * Update an existing row
   */
  async update(def: PricingTableDefinition, id: number | string, data: Record<string, any>): Promise<boolean> {
    const setClauses: string[] = [];
    const values: any[] = [];

    for (const col of def.columns) {
      if (data[col.name] !== undefined) {
        setClauses.push(`${quoteColumn(col)} = ?`);
        values.push(this.convertValue(col, data[col.name]));
      }
    }

    if (setClauses.length === 0) {
      return false;
    }

    const pk = quotePrimaryKey(def);
    values.push(id);

    const sql = `UPDATE ${def.tableName} SET ${setClauses.join(', ')} WHERE ${pk} = ?`;
    const result = await query(sql, values) as ResultSetHeader;
    return result.affectedRows > 0;
  }

  /**
   * Soft delete (deactivate) a row
   */
  async deactivate(def: PricingTableDefinition, id: number | string): Promise<boolean> {
    const pk = quotePrimaryKey(def);
    const sql = `UPDATE ${def.tableName} SET is_active = 0 WHERE ${pk} = ?`;
    const result = await query(sql, [id]) as ResultSetHeader;
    return result.affectedRows > 0;
  }

  /**
   * Restore (reactivate) a row
   */
  async restore(def: PricingTableDefinition, id: number | string): Promise<boolean> {
    const pk = quotePrimaryKey(def);
    const sql = `UPDATE ${def.tableName} SET is_active = 1 WHERE ${pk} = ?`;
    const result = await query(sql, [id]) as ResultSetHeader;
    return result.affectedRows > 0;
  }

  /**
   * Convert a value to the appropriate type for the database column
   */
  private convertValue(col: ColumnDefinition, value: any): any {
    if (value === null || value === '' || value === undefined) {
      return null;
    }

    switch (col.type) {
      case 'decimal':
        return parseFloat(value);
      case 'integer':
        return parseInt(value, 10);
      case 'boolean':
        if (typeof value === 'boolean') return value ? 1 : 0;
        if (typeof value === 'string') return value === 'true' || value === '1' ? 1 : 0;
        return value ? 1 : 0;
      case 'json':
        return typeof value === 'string' ? value : JSON.stringify(value);
      case 'date':
      case 'string':
      case 'text':
      case 'enum':
      default:
        return value;
    }
  }
}

export const pricingManagementRepository = new PricingManagementRepository();
