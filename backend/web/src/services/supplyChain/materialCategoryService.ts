import { SupplyChainPermissions } from '../../utils/supplyChain/permissions';
import { User } from '../../types';
import { MaterialCategoryRepository, MaterialCategoryData, CategoryFieldData } from '../../repositories/supplyChain/materialCategoryRepository';

export class MaterialCategoryService {
  /**
   * Get all categories with permission check
   */
  static async getAllCategories(user: User) {
    // Check view permission using hybrid RBAC/legacy system
    const canView = await SupplyChainPermissions.canViewSupplyChainHybrid(user);
    if (!canView) {
      throw new Error('Insufficient permissions to view supply chain');
    }

    const categories = await MaterialCategoryRepository.getAllCategories();
    return { success: true, data: categories };
  }

  /**
   * Create new category with validation
   */
  static async createCategory(user: User, data: any) {
    // Check permissions
    const canManage = await SupplyChainPermissions.canManageCategoriesHybrid(user);
    if (!canManage) {
      throw new Error('Insufficient permissions to manage categories');
    }

    // Validate required fields
    if (!data.name || !data.name.trim()) {
      throw new Error('Category name is required');
    }

    const categoryData: MaterialCategoryData = {
      name: data.name.trim(),
      description: data.description || undefined,
      icon: data.icon || 'Package',
      color: data.color || 'purple',
      sort_order: data.sort_order || 0,
      created_by: user.user_id,
      updated_by: user.user_id
    };

    try {
      const insertId = await MaterialCategoryRepository.createCategory(categoryData);
      return {
        success: true,
        data: {
          id: insertId,
          name: categoryData.name,
          description: categoryData.description,
          icon: categoryData.icon,
          color: categoryData.color,
          sort_order: categoryData.sort_order
        }
      };
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('Category name already exists');
      }
      throw error;
    }
  }

  /**
   * Update category with validation
   */
  static async updateCategory(user: User, id: number, data: any) {
    // Check permissions
    const canManage = await SupplyChainPermissions.canManageCategoriesHybrid(user);
    if (!canManage) {
      throw new Error('Insufficient permissions to manage categories');
    }

    const categoryData: MaterialCategoryData = {
      name: data.name,
      description: data.description,
      icon: data.icon,
      color: data.color,
      sort_order: data.sort_order,
      is_active: data.is_active,
      updated_by: user.user_id
    };

    try {
      const affectedRows = await MaterialCategoryRepository.updateCategory(id, categoryData);
      if (affectedRows === 0) {
        throw new Error('Category not found');
      }
      return { success: true, message: 'Category updated successfully' };
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('Category name already exists');
      }
      throw error;
    }
  }

  /**
   * Delete category with dependency check
   */
  static async deleteCategory(user: User, id: number) {
    // Check permissions
    const canManage = await SupplyChainPermissions.canManageCategoriesHybrid(user);
    if (!canManage) {
      throw new Error('Insufficient permissions to manage categories');
    }

    // Check if category has products
    const productCount = await MaterialCategoryRepository.getCategoryProductCount(id);
    if (productCount > 0) {
      throw new Error('Cannot delete category with active products');
    }

    const affectedRows = await MaterialCategoryRepository.deleteCategory(id);
    if (affectedRows === 0) {
      throw new Error('Category not found');
    }

    return { success: true, message: 'Category deleted successfully' };
  }

  /**
   * Get category fields
   */
  static async getCategoryFields(user: User, categoryId: number) {
    // Check permissions
    const canView = await SupplyChainPermissions.canViewSupplyChainHybrid(user);
    if (!canView) {
      throw new Error('Insufficient permissions to view supply chain');
    }

    const fields = await MaterialCategoryRepository.getCategoryFields(categoryId);
    
    // Parse JSON fields
    const parsedFields = fields.map(field => ({
      ...field,
      field_options: field.field_options ? JSON.parse(field.field_options) : null,
      validation_rules: field.validation_rules ? JSON.parse(field.validation_rules) : null
    }));

    return { success: true, data: parsedFields };
  }

  /**
   * Create category field
   */
  static async createCategoryField(user: User, categoryId: number, data: any) {
    // Check permissions
    const canManage = await SupplyChainPermissions.canManageCategoryFieldsHybrid(user);
    if (!canManage) {
      throw new Error('Insufficient permissions to manage category fields');
    }

    // Validate required fields
    if (!data.field_name || !data.field_label || !data.field_type) {
      throw new Error('Field name, label, and type are required');
    }

    const fieldData: CategoryFieldData = {
      category_id: categoryId,
      field_name: data.field_name,
      field_label: data.field_label,
      field_type: data.field_type,
      field_options: data.field_options ? JSON.stringify(data.field_options) : undefined,
      default_value: data.default_value,
      is_required: data.is_required || false,
      validation_rules: data.validation_rules ? JSON.stringify(data.validation_rules) : undefined,
      help_text: data.help_text,
      sort_order: data.sort_order || 0
    };

    try {
      const insertId = await MaterialCategoryRepository.createCategoryField(fieldData);
      return {
        success: true,
        data: {
          id: insertId,
          field_name: fieldData.field_name,
          field_label: fieldData.field_label,
          field_type: fieldData.field_type
        }
      };
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('Field name already exists for this category');
      }
      throw error;
    }
  }

  /**
   * Update category field
   */
  static async updateCategoryField(user: User, categoryId: number, fieldId: number, data: any) {
    // Check permissions
    const canManage = await SupplyChainPermissions.canManageCategoryFieldsHybrid(user);
    if (!canManage) {
      throw new Error('Insufficient permissions to manage category fields');
    }

    const fieldData = {
      field_label: data.field_label,
      field_type: data.field_type,
      field_options: data.field_options ? JSON.stringify(data.field_options) : undefined,
      default_value: data.default_value,
      is_required: data.is_required,
      validation_rules: data.validation_rules ? JSON.stringify(data.validation_rules) : undefined,
      help_text: data.help_text,
      sort_order: data.sort_order,
      is_active: data.is_active
    };

    const affectedRows = await MaterialCategoryRepository.updateCategoryField(categoryId, fieldId, fieldData);
    if (affectedRows === 0) {
      throw new Error('Category field not found');
    }

    return { success: true, message: 'Category field updated successfully' };
  }

  /**
   * Delete category field
   */
  static async deleteCategoryField(user: User, categoryId: number, fieldId: number) {
    // Check permissions
    const canManage = await SupplyChainPermissions.canManageCategoryFieldsHybrid(user);
    if (!canManage) {
      throw new Error('Insufficient permissions to manage category fields');
    }

    const affectedRows = await MaterialCategoryRepository.deleteCategoryField(categoryId, fieldId);
    if (affectedRows === 0) {
      throw new Error('Category field not found');
    }

    return { success: true, message: 'Category field deleted successfully' };
  }
}