import { pool } from '../../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface MaterialCategoryData {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  sort_order?: number;
  is_active?: boolean;
  created_by?: number;
  updated_by?: number;
}

export interface CategoryFieldData {
  category_id: number;
  field_name: string;
  field_label: string;
  field_type: string;
  field_options?: string; // JSON string
  default_value?: string;
  is_required?: boolean;
  validation_rules?: string; // JSON string
  help_text?: string;
  sort_order?: number;
}

export class MaterialCategoryRepository {
  /**
   * Get all material categories
   */
  static async getAllCategories(): Promise<RowDataPacket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        id, name, description, icon, color, sort_order, is_active,
        created_at, updated_at
      FROM material_categories 
      WHERE is_active = TRUE 
      ORDER BY sort_order, name`
    );
    return rows;
  }

  /**
   * Create a new material category
   */
  static async createCategory(data: MaterialCategoryData): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO material_categories 
       (name, description, icon, color, sort_order, created_by, updated_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.description || null,
        data.icon || 'Package',
        data.color || 'purple',
        data.sort_order || 0,
        data.created_by,
        data.updated_by
      ]
    );
    return result.insertId;
  }

  /**
   * Update an existing material category
   */
  static async updateCategory(id: number, data: MaterialCategoryData): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE material_categories 
       SET name = ?, description = ?, icon = ?, color = ?, 
           sort_order = ?, is_active = ?, updated_by = ?
       WHERE id = ?`,
      [
        data.name,
        data.description,
        data.icon,
        data.color,
        data.sort_order,
        data.is_active,
        data.updated_by,
        id
      ]
    );
    return result.affectedRows;
  }

  /**
   * Check if category has active products
   */
  static async getCategoryProductCount(id: number): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM product_standards WHERE category_id = ? AND is_active = TRUE',
      [id]
    );
    return rows[0].count;
  }

  /**
   * Soft delete a category
   */
  static async deleteCategory(id: number): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      'UPDATE material_categories SET is_active = FALSE WHERE id = ?',
      [id]
    );
    return result.affectedRows;
  }

  /**
   * Get category fields
   */
  static async getCategoryFields(categoryId: number): Promise<RowDataPacket[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        id, field_name, field_label, field_type, field_options, default_value,
        is_required, validation_rules, help_text, sort_order, is_active
      FROM category_fields 
      WHERE category_id = ? AND is_active = TRUE 
      ORDER BY sort_order, field_label`,
      [categoryId]
    );
    return rows;
  }

  /**
   * Create category field
   */
  static async createCategoryField(data: CategoryFieldData): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO category_fields 
       (category_id, field_name, field_label, field_type, field_options, default_value,
        is_required, validation_rules, help_text, sort_order) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.category_id,
        data.field_name,
        data.field_label,
        data.field_type,
        data.field_options,
        data.default_value,
        data.is_required || false,
        data.validation_rules,
        data.help_text,
        data.sort_order || 0
      ]
    );
    return result.insertId;
  }

  /**
   * Update category field
   */
  static async updateCategoryField(
    categoryId: number,
    fieldId: number,
    data: Partial<CategoryFieldData & { is_active?: boolean }>
  ): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE category_fields 
       SET field_label = ?, field_type = ?, field_options = ?, default_value = ?,
           is_required = ?, validation_rules = ?, help_text = ?, sort_order = ?, is_active = ?
       WHERE id = ? AND category_id = ?`,
      [
        data.field_label,
        data.field_type,
        data.field_options,
        data.default_value,
        data.is_required,
        data.validation_rules,
        data.help_text,
        data.sort_order,
        data.is_active,
        fieldId,
        categoryId
      ]
    );
    return result.affectedRows;
  }

  /**
   * Soft delete category field
   */
  static async deleteCategoryField(categoryId: number, fieldId: number): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      'UPDATE category_fields SET is_active = FALSE WHERE id = ? AND category_id = ?',
      [fieldId, categoryId]
    );
    return result.affectedRows;
  }
}