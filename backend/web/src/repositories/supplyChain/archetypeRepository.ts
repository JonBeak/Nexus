// Phase 4.b: Product Archetypes Repository
// Created: 2025-12-18
import { query } from '../../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface ArchetypeRow extends RowDataPacket {
  archetype_id: number;
  name: string;
  category_id: number;
  category_name: string;  // Joined from material_categories
  subcategory: string | null;
  unit_of_measure: string;
  specifications: Record<string, any> | null;
  description: string | null;
  reorder_point: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  created_by: number | null;
  updated_by: number | null;
  created_by_name?: string;
  updated_by_name?: string;
  // Category metadata from JOIN
  category_color?: string | null;
  category_icon?: string | null;
}

export interface ArchetypeStatsRow extends RowDataPacket {
  total_archetypes: number;
  active_archetypes: number;
  categories_in_use: number;
}

export interface CategoryCountRow extends RowDataPacket {
  category_id: number;
  category_name: string;
  count: number;
}

export interface ArchetypeSearchParams {
  search?: string;
  category_id?: number;
  category?: string;  // Legacy: search by category name (will lookup category_id)
  subcategory?: string;
  active_only?: boolean;
}

export class ArchetypeRepository {
  /**
   * Build enriched archetype query with user names and category data
   */
  private buildArchetypeQuery(whereClause: string = '1=1'): string {
    return `
      SELECT
        a.archetype_id,
        a.name,
        a.category_id,
        mc.name as category_name,
        mc.color as category_color,
        mc.icon as category_icon,
        a.subcategory,
        a.unit_of_measure,
        a.specifications,
        a.description,
        a.reorder_point,
        a.is_active,
        a.created_at,
        a.updated_at,
        a.created_by,
        a.updated_by,
        CONCAT(cu.first_name, ' ', cu.last_name) as created_by_name,
        CONCAT(uu.first_name, ' ', uu.last_name) as updated_by_name
      FROM product_archetypes a
      JOIN material_categories mc ON a.category_id = mc.id
      LEFT JOIN users cu ON a.created_by = cu.user_id
      LEFT JOIN users uu ON a.updated_by = uu.user_id
      WHERE ${whereClause}
    `;
  }

  /**
   * Get all archetypes with optional filtering
   */
  async findAll(params: ArchetypeSearchParams): Promise<ArchetypeRow[]> {
    const conditions: string[] = ['1=1'];
    const queryParams: any[] = [];

    // Filter by active status (default to active only)
    if (params.active_only !== false) {
      conditions.push('a.is_active = TRUE');
    }

    // Filter by category_id (preferred)
    if (params.category_id) {
      conditions.push('a.category_id = ?');
      queryParams.push(params.category_id);
    }
    // Legacy: Filter by category name
    else if (params.category) {
      conditions.push('mc.name = ?');
      queryParams.push(params.category);
    }

    // Filter by subcategory
    if (params.subcategory) {
      conditions.push('a.subcategory = ?');
      queryParams.push(params.subcategory);
    }

    // Search filter
    if (params.search) {
      conditions.push(`(
        a.name LIKE ? OR
        a.description LIKE ? OR
        a.subcategory LIKE ? OR
        mc.name LIKE ?
      )`);
      const searchTerm = `%${params.search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const sql = this.buildArchetypeQuery(conditions.join(' AND ')) + ' ORDER BY mc.sort_order, mc.name, a.name';

    return await query(sql, queryParams) as ArchetypeRow[];
  }

  /**
   * Get single archetype by ID
   */
  async findById(id: number): Promise<ArchetypeRow | null> {
    const sql = this.buildArchetypeQuery('a.archetype_id = ?');
    const rows = await query(sql, [id]) as ArchetypeRow[];
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Check if archetype name already exists
   */
  async nameExists(name: string, excludeId?: number): Promise<boolean> {
    let sql = 'SELECT COUNT(*) as count FROM product_archetypes WHERE name = ?';
    const params: any[] = [name];

    if (excludeId) {
      sql += ' AND archetype_id != ?';
      params.push(excludeId);
    }

    const rows = await query(sql, params) as RowDataPacket[];
    return rows[0].count > 0;
  }

  /**
   * Create new archetype
   */
  async create(data: {
    name: string;
    category_id: number;
    subcategory?: string;
    unit_of_measure: string;
    specifications?: Record<string, any>;
    description?: string;
    reorder_point?: number;
    created_by?: number;
  }): Promise<number> {
    const result = await query(
      `INSERT INTO product_archetypes (
        name, category_id, subcategory, unit_of_measure, specifications,
        description, reorder_point,
        created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.category_id,
        data.subcategory || null,
        data.unit_of_measure,
        data.specifications ? JSON.stringify(data.specifications) : null,
        data.description || null,
        data.reorder_point || 0,
        data.created_by || null,
        data.created_by || null
      ]
    ) as ResultSetHeader;

    return result.insertId;
  }

  /**
   * Update archetype
   */
  async update(id: number, updates: {
    name?: string;
    category_id?: number;
    subcategory?: string;
    unit_of_measure?: string;
    specifications?: Record<string, any>;
    description?: string;
    reorder_point?: number;
    is_active?: boolean;
    updated_by?: number;
  }): Promise<void> {
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    const allowedFields = [
      'name', 'category_id', 'subcategory', 'unit_of_measure',
      'description', 'reorder_point', 'is_active'
    ];

    for (const field of allowedFields) {
      if (updates[field as keyof typeof updates] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(updates[field as keyof typeof updates]);
      }
    }

    // Handle specifications separately (needs JSON stringify)
    if (updates.specifications !== undefined) {
      updateFields.push('specifications = ?');
      updateValues.push(JSON.stringify(updates.specifications));
    }

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    // Add updated_by
    if (updates.updated_by) {
      updateFields.push('updated_by = ?');
      updateValues.push(updates.updated_by);
    }

    // Add id for WHERE clause
    updateValues.push(id);

    await query(
      `UPDATE product_archetypes SET ${updateFields.join(', ')} WHERE archetype_id = ?`,
      updateValues
    );
  }

  /**
   * Soft delete archetype (deactivate)
   */
  async softDelete(id: number, updated_by?: number): Promise<void> {
    await query(
      'UPDATE product_archetypes SET is_active = FALSE, updated_by = ? WHERE archetype_id = ?',
      [updated_by || null, id]
    );
  }

  /**
   * Hard delete archetype
   */
  async hardDelete(id: number): Promise<void> {
    await query('DELETE FROM product_archetypes WHERE archetype_id = ?', [id]);
  }

  /**
   * Get categories with counts (from material_categories joined with archetypes)
   */
  async getCategories(): Promise<CategoryCountRow[]> {
    return await query(`
      SELECT
        mc.id as category_id,
        mc.name as category_name,
        COUNT(pa.archetype_id) as count
      FROM material_categories mc
      LEFT JOIN product_archetypes pa ON pa.category_id = mc.id AND pa.is_active = TRUE
      WHERE mc.is_active = TRUE
      GROUP BY mc.id, mc.name
      ORDER BY mc.sort_order, mc.name
    `) as CategoryCountRow[];
  }

  /**
   * Get archetype statistics
   */
  async getStatistics(): Promise<ArchetypeStatsRow> {
    const rows = await query(`
      SELECT
        COUNT(*) as total_archetypes,
        COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_archetypes,
        COUNT(DISTINCT category) as categories_in_use
      FROM product_archetypes
    `) as ArchetypeStatsRow[];

    return rows[0];
  }

  /**
   * Get unique subcategories for a category (by category_id)
   */
  async getSubcategoriesById(categoryId: number): Promise<string[]> {
    const rows = await query(`
      SELECT DISTINCT subcategory
      FROM product_archetypes
      WHERE category_id = ? AND subcategory IS NOT NULL AND is_active = TRUE
      ORDER BY subcategory
    `, [categoryId]) as RowDataPacket[];

    return rows.map(r => r.subcategory);
  }

  /**
   * Get unique subcategories for a category (by category name - legacy support)
   */
  async getSubcategories(categoryName: string): Promise<string[]> {
    const rows = await query(`
      SELECT DISTINCT pa.subcategory
      FROM product_archetypes pa
      JOIN material_categories mc ON pa.category_id = mc.id
      WHERE mc.name = ? AND pa.subcategory IS NOT NULL AND pa.is_active = TRUE
      ORDER BY pa.subcategory
    `, [categoryName]) as RowDataPacket[];

    return rows.map(r => r.subcategory);
  }

  /**
   * Find category_id by category name
   */
  async findCategoryIdByName(categoryName: string): Promise<number | null> {
    const rows = await query(
      'SELECT id FROM material_categories WHERE name = ? AND is_active = TRUE',
      [categoryName]
    ) as RowDataPacket[];
    return rows.length > 0 ? rows[0].id : null;
  }
}
