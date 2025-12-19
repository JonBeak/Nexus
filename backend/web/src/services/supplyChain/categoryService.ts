// Phase 4.b: Material Categories Service
// Created: 2025-12-18
import { CategoryRepository, CategoryRow } from '../../repositories/supplyChain/categoryRepository';
import { ServiceResult } from '../../types/serviceResults';

export interface CreateCategoryData {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  sort_order?: number;
}

export interface UpdateCategoryData {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  sort_order?: number;
  is_active?: boolean;
}

export class CategoryService {
  private repository: CategoryRepository;

  constructor() {
    this.repository = new CategoryRepository();
  }

  /**
   * Get all categories
   */
  async getCategories(activeOnly: boolean = true): Promise<ServiceResult<CategoryRow[]>> {
    try {
      const categories = await this.repository.findAll(activeOnly);
      return { success: true, data: categories };
    } catch (error) {
      console.error('Error in CategoryService.getCategories:', error);
      return {
        success: false,
        error: 'Failed to fetch categories',
        code: 'FETCH_ERROR'
      };
    }
  }

  /**
   * Get single category by ID
   */
  async getCategoryById(id: number): Promise<ServiceResult<CategoryRow>> {
    try {
      const category = await this.repository.findById(id);

      if (!category) {
        return {
          success: false,
          error: 'Category not found',
          code: 'NOT_FOUND'
        };
      }

      return { success: true, data: category };
    } catch (error) {
      console.error('Error in CategoryService.getCategoryById:', error);
      return {
        success: false,
        error: 'Failed to fetch category',
        code: 'FETCH_ERROR'
      };
    }
  }

  /**
   * Create new category
   */
  async createCategory(data: CreateCategoryData): Promise<ServiceResult<number>> {
    try {
      // Validate required fields
      if (!data.name || data.name.trim().length === 0) {
        return {
          success: false,
          error: 'Category name is required',
          code: 'VALIDATION_ERROR'
        };
      }

      // Check for duplicate name
      const nameExists = await this.repository.nameExists(data.name.trim());
      if (nameExists) {
        return {
          success: false,
          error: 'A category with this name already exists',
          code: 'DUPLICATE_ENTRY'
        };
      }

      const categoryId = await this.repository.create({
        name: data.name.trim(),
        description: data.description?.trim(),
        icon: data.icon?.trim(),
        color: data.color?.trim(),
        sort_order: data.sort_order
      });

      return { success: true, data: categoryId };
    } catch (error) {
      console.error('Error in CategoryService.createCategory:', error);
      return {
        success: false,
        error: 'Failed to create category',
        code: 'CREATE_ERROR'
      };
    }
  }

  /**
   * Update category
   */
  async updateCategory(id: number, updates: UpdateCategoryData): Promise<ServiceResult<void>> {
    try {
      // Verify category exists
      const categoryResult = await this.getCategoryById(id);
      if (!categoryResult.success) {
        return categoryResult as ServiceResult<void>;
      }

      // Validate name if provided
      if (updates.name !== undefined && updates.name.trim().length === 0) {
        return {
          success: false,
          error: 'Category name cannot be empty',
          code: 'VALIDATION_ERROR'
        };
      }

      // Check for duplicate name if updating name
      if (updates.name) {
        const nameExists = await this.repository.nameExists(updates.name.trim(), id);
        if (nameExists) {
          return {
            success: false,
            error: 'A category with this name already exists',
            code: 'DUPLICATE_ENTRY'
          };
        }
      }

      // Trim string fields
      const cleanedUpdates: UpdateCategoryData = {};
      if (updates.name !== undefined) cleanedUpdates.name = updates.name.trim();
      if (updates.description !== undefined) cleanedUpdates.description = updates.description.trim();
      if (updates.icon !== undefined) cleanedUpdates.icon = updates.icon.trim();
      if (updates.color !== undefined) cleanedUpdates.color = updates.color.trim();
      if (updates.sort_order !== undefined) cleanedUpdates.sort_order = updates.sort_order;
      if (updates.is_active !== undefined) cleanedUpdates.is_active = updates.is_active;

      await this.repository.update(id, cleanedUpdates);

      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error in CategoryService.updateCategory:', error);
      return {
        success: false,
        error: 'Failed to update category',
        code: 'UPDATE_ERROR'
      };
    }
  }

  /**
   * Delete category (soft delete if has materials, error if in use)
   */
  async deleteCategory(id: number): Promise<ServiceResult<{ message: string }>> {
    try {
      // Verify category exists
      const categoryResult = await this.getCategoryById(id);
      if (!categoryResult.success) {
        return categoryResult as ServiceResult<{ message: string }>;
      }

      const category = categoryResult.data;

      // Check if category has materials
      const materialCount = await this.repository.getMaterialCount(category.name);
      if (materialCount > 0) {
        return {
          success: false,
          error: `Cannot delete category with ${materialCount} material(s). Remove or reassign materials first.`,
          code: 'VALIDATION_ERROR'
        };
      }

      // Soft delete
      await this.repository.softDelete(id);
      return {
        success: true,
        data: { message: 'Category deleted successfully' }
      };
    } catch (error) {
      console.error('Error in CategoryService.deleteCategory:', error);
      return {
        success: false,
        error: 'Failed to delete category',
        code: 'DELETE_ERROR'
      };
    }
  }

  /**
   * Reorder categories
   */
  async reorderCategories(orderedIds: number[]): Promise<ServiceResult<void>> {
    try {
      await this.repository.reorder(orderedIds);
      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error in CategoryService.reorderCategories:', error);
      return {
        success: false,
        error: 'Failed to reorder categories',
        code: 'UPDATE_ERROR'
      };
    }
  }
}
