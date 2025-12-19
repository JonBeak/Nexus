// Phase 4.a: Supplier Contacts Repository
// Created: 2025-12-18
import { query } from '../../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export type ContactRole = 'sales' | 'accounts_payable' | 'customer_service' | 'technical' | 'general';

export interface SupplierContactRow extends RowDataPacket {
  contact_id: number;
  supplier_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  role: ContactRole;
  is_primary: boolean;
  notes: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  // Joined fields
  supplier_name?: string;
}

export interface CreateContactData {
  supplier_id: number;
  name: string;
  email?: string;
  phone?: string;
  role?: ContactRole;
  is_primary?: boolean;
  notes?: string;
}

export interface UpdateContactData {
  name?: string;
  email?: string;
  phone?: string;
  role?: ContactRole;
  is_primary?: boolean;
  notes?: string;
  is_active?: boolean;
}

export class SupplierContactRepository {
  /**
   * Get all contacts for a supplier
   */
  async findBySupplier(supplierId: number, activeOnly: boolean = true): Promise<SupplierContactRow[]> {
    let sql = `
      SELECT sc.*, s.name as supplier_name
      FROM supplier_contacts sc
      JOIN suppliers s ON sc.supplier_id = s.supplier_id
      WHERE sc.supplier_id = ?
    `;

    if (activeOnly) {
      sql += ' AND sc.is_active = TRUE';
    }

    sql += ' ORDER BY sc.is_primary DESC, sc.name';

    return await query(sql, [supplierId]) as SupplierContactRow[];
  }

  /**
   * Get single contact by ID
   */
  async findById(contactId: number): Promise<SupplierContactRow | null> {
    const sql = `
      SELECT sc.*, s.name as supplier_name
      FROM supplier_contacts sc
      JOIN suppliers s ON sc.supplier_id = s.supplier_id
      WHERE sc.contact_id = ?
    `;

    const rows = await query(sql, [contactId]) as SupplierContactRow[];
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get primary contact for a supplier
   */
  async findPrimaryBySupplier(supplierId: number): Promise<SupplierContactRow | null> {
    const sql = `
      SELECT sc.*, s.name as supplier_name
      FROM supplier_contacts sc
      JOIN suppliers s ON sc.supplier_id = s.supplier_id
      WHERE sc.supplier_id = ? AND sc.is_primary = TRUE AND sc.is_active = TRUE
      LIMIT 1
    `;

    const rows = await query(sql, [supplierId]) as SupplierContactRow[];
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Create new contact
   */
  async create(data: CreateContactData): Promise<number> {
    const result = await query(
      `INSERT INTO supplier_contacts (supplier_id, name, email, phone, role, is_primary, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.supplier_id,
        data.name,
        data.email || null,
        data.phone || null,
        data.role || 'general',
        data.is_primary || false,
        data.notes || null
      ]
    ) as ResultSetHeader;

    return result.insertId;
  }

  /**
   * Update contact
   */
  async update(contactId: number, updates: UpdateContactData): Promise<void> {
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    const allowedFields = ['name', 'email', 'phone', 'role', 'is_primary', 'notes', 'is_active'];

    for (const field of allowedFields) {
      if (updates[field as keyof UpdateContactData] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(updates[field as keyof UpdateContactData]);
      }
    }

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    updateValues.push(contactId);

    await query(
      `UPDATE supplier_contacts SET ${updateFields.join(', ')} WHERE contact_id = ?`,
      updateValues
    );
  }

  /**
   * Clear primary flag for all contacts of a supplier
   * (used before setting a new primary)
   */
  async clearPrimaryFlag(supplierId: number): Promise<void> {
    await query(
      'UPDATE supplier_contacts SET is_primary = FALSE WHERE supplier_id = ?',
      [supplierId]
    );
  }

  /**
   * Soft delete contact (deactivate)
   */
  async softDelete(contactId: number): Promise<void> {
    await query(
      'UPDATE supplier_contacts SET is_active = FALSE WHERE contact_id = ?',
      [contactId]
    );
  }

  /**
   * Hard delete contact
   */
  async hardDelete(contactId: number): Promise<void> {
    await query('DELETE FROM supplier_contacts WHERE contact_id = ?', [contactId]);
  }

  /**
   * Check if supplier exists
   */
  async supplierExists(supplierId: number): Promise<boolean> {
    const rows = await query(
      'SELECT 1 FROM suppliers WHERE supplier_id = ? AND is_active = TRUE',
      [supplierId]
    ) as RowDataPacket[];

    return rows.length > 0;
  }
}
