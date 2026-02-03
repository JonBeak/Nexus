// Phase 4.b: Material Categories Repository
// Created: 2025-12-18
import { query } from '../../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface CategoryRow extends RowDataPacket {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  material_count?: number;
}

export class CategoryRepository {
  /**
   * Get all categories with material counts
   */
  async findAll(activeOnly: boolean = true): Promise<CategoryRow[]> {
    let sql = `
      SELECT
        c.*,
        (SELECT COUNT(*) FROM product_archetypes pa
         WHERE pa.category_id = c.id AND pa.is_active = TRUE) as material_count
      FROM material_categories c
    `;

    if (activeOnly) {
      sql += ' WHERE c.is_active = TRUE';
    }

    sql += ' ORDER BY c.sort_order, c.name';

    return await query(sql) as CategoryRow[];
  }

  /**
   * Get single category by ID
   */
  async findById(id: number): Promise<CategoryRow | null> {
    const rows = await query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM product_archetypes pa
         WHERE pa.category_id = c.id AND pa.is_active = TRUE) as material_count
       FROM material_categories c WHERE c.id = ?`,
      [id]
    ) as CategoryRow[];
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Check if category name exists
   */
  async nameExists(name: string, excludeId?: number): Promise<boolean> {
    let sql = 'SELECT COUNT(*) as count FROM material_categories WHERE name = ?';
    const params: any[] = [name];

    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }

    const rows = await query(sql, params) as RowDataPacket[];
    return rows[0].count > 0;
  }

  /**
   * Create new category
   */
  async create(data: {
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    sort_order?: number;
  }): Promise<number> {
    // Get max sort_order if not provided
    let sortOrder = data.sort_order;
    if (sortOrder === undefined) {
      const maxRows = await query(
        'SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM material_categories'
      ) as RowDataPacket[];
      sortOrder = maxRows[0].next_order;
    }

    const result = await query(
      `INSERT INTO material_categories (name, description, icon, color, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [
        data.name,
        data.description || null,
        data.icon || 'box',
        data.color || 'bg-gray-100 text-gray-700',
        sortOrder
      ]
    ) as ResultSetHeader;

    return result.insertId;
  }

  /**
   * Update category
   */
  async update(id: number, updates: {
    name?: string;
    description?: string;
    icon?: string;
    color?: string;
    sort_order?: number;
    is_active?: boolean;
  }): Promise<string | null> {
    // Get old name for updating product_archetypes
    const oldCategory = await this.findById(id);
    if (!oldCategory) return null;

    const updateFields: string[] = [];
    const updateValues: any[] = [];

    const allowedFields = ['name', 'description', 'icon', 'color', 'sort_order', 'is_active'];

    for (const field of allowedFields) {
      if (updates[field as keyof typeof updates] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(updates[field as keyof typeof updates]);
      }
    }

    if (updateFields.length === 0) return oldCategory.name;

    updateValues.push(id);

    await query(
      `UPDATE material_categories SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Note: With FK relationship, product_archetypes.category_id stays linked automatically
    // No need to update product_archetypes when category name changes

    return oldCategory.name;
  }

  /**
   * Delete category (soft delete)
   */
  async softDelete(id: number): Promise<void> {
    await query('UPDATE material_categories SET is_active = FALSE WHERE id = ?', [id]);
  }

  /**
   * Get material count for category by ID
   */
  async getMaterialCount(categoryId: number): Promise<number> {
    const rows = await query(
      'SELECT COUNT(*) as count FROM product_archetypes WHERE category_id = ? AND is_active = TRUE',
      [categoryId]
    ) as RowDataPacket[];
    return rows[0].count;
  }

  /**
   * Get material count for category by name (legacy support)
   */
  async getMaterialCountByName(categoryName: string): Promise<number> {
    const rows = await query(
      `SELECT COUNT(*) as count
       FROM product_archetypes pa
       JOIN material_categories mc ON pa.category_id = mc.id
       WHERE mc.name = ? AND pa.is_active = TRUE`,
      [categoryName]
    ) as RowDataPacket[];
    return rows[0].count;
  }

  /**
   * Reorder categories
   */
  async reorder(orderedIds: number[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await query(
        'UPDATE material_categories SET sort_order = ? WHERE id = ?',
        [i + 1, orderedIds[i]]
      );
    }
  }
}
