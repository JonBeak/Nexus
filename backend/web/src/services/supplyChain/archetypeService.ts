// Phase 4.b: Product Archetypes Service
// Created: 2025-12-18
import {
  ArchetypeRepository,
  ArchetypeRow,
  ArchetypeStatsRow,
  ArchetypeSearchParams,
  CategoryCountRow
} from '../../repositories/supplyChain/archetypeRepository';
import { CategoryRepository } from '../../repositories/supplyChain/categoryRepository';
import { ServiceResult } from '../../types/serviceResults';

// Valid units of measure
const VALID_UNITS = [
  'each', 'linear_ft', 'sq_ft', 'sheet', 'roll', 'gallon', 'lb', 'oz', 'box', 'pack'
];

export interface CreateArchetypeData {
  name: string;
  category: string;
  subcategory?: string;
  unit_of_measure: string;
  specifications?: Record<string, any>;
  description?: string;
  reorder_point?: number;
}

export interface UpdateArchetypeData {
  name?: string;
  category?: string;
  subcategory?: string;
  unit_of_measure?: string;
  specifications?: Record<string, any>;
  description?: string;
  reorder_point?: number;
  is_active?: boolean;
}

export class ArchetypeService {
  private repository: ArchetypeRepository;
  private categoryRepository: CategoryRepository;

  constructor() {
    this.repository = new ArchetypeRepository();
    this.categoryRepository = new CategoryRepository();
  }

  /**
   * Get valid category names from database
   */
  private async getValidCategories(): Promise<string[]> {
    const categories = await this.categoryRepository.findAll(true);
    return categories.map(c => c.name);
  }

  /**
   * Get all archetypes with optional filtering
   */
  async getArchetypes(params: ArchetypeSearchParams): Promise<ServiceResult<ArchetypeRow[]>> {
    try {
      const archetypes = await this.repository.findAll(params);
      return { success: true, data: archetypes };
    } catch (error) {
      console.error('Error in ArchetypeService.getArchetypes:', error);
      return {
        success: false,
        error: 'Failed to fetch archetypes',
        code: 'FETCH_ERROR'
      };
    }
  }

  /**
   * Get single archetype by ID
   */
  async getArchetypeById(id: number): Promise<ServiceResult<ArchetypeRow>> {
    try {
      const archetype = await this.repository.findById(id);

      if (!archetype) {
        return {
          success: false,
          error: 'Archetype not found',
          code: 'NOT_FOUND'
        };
      }

      return { success: true, data: archetype };
    } catch (error) {
      console.error('Error in ArchetypeService.getArchetypeById:', error);
      return {
        success: false,
        error: 'Failed to fetch archetype',
        code: 'FETCH_ERROR'
      };
    }
  }

  /**
   * Create new archetype
   */
  async createArchetype(data: CreateArchetypeData, userId?: number): Promise<ServiceResult<number>> {
    try {
      // Validate required fields
      if (!data.name || data.name.trim().length === 0) {
        return {
          success: false,
          error: 'Archetype name is required',
          code: 'VALIDATION_ERROR'
        };
      }

      // Validate category against database
      const validCategories = await this.getValidCategories();
      if (!data.category || !validCategories.includes(data.category)) {
        return {
          success: false,
          error: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
          code: 'VALIDATION_ERROR'
        };
      }

      // Validate unit of measure
      if (!data.unit_of_measure || data.unit_of_measure.trim().length === 0) {
        return {
          success: false,
          error: 'Unit of measure is required',
          code: 'VALIDATION_ERROR'
        };
      }

      // Check if name already exists
      const nameExists = await this.repository.nameExists(data.name.trim());
      if (nameExists) {
        return {
          success: false,
          error: 'An archetype with this name already exists',
          code: 'DUPLICATE_ENTRY'
        };
      }

      // Validate numeric fields
      if (data.reorder_point !== undefined && data.reorder_point < 0) {
        return {
          success: false,
          error: 'Reorder point cannot be negative',
          code: 'VALIDATION_ERROR'
        };
      }

      const archetypeId = await this.repository.create({
        name: data.name.trim(),
        category: data.category,
        subcategory: data.subcategory?.trim(),
        unit_of_measure: data.unit_of_measure.trim(),
        specifications: data.specifications,
        description: data.description?.trim(),
        reorder_point: data.reorder_point,
        created_by: userId
      });

      return { success: true, data: archetypeId };
    } catch (error) {
      console.error('Error in ArchetypeService.createArchetype:', error);
      return {
        success: false,
        error: 'Failed to create archetype',
        code: 'CREATE_ERROR'
      };
    }
  }

  /**
   * Update archetype
   */
  async updateArchetype(id: number, updates: UpdateArchetypeData, userId?: number): Promise<ServiceResult<void>> {
    try {
      // Verify archetype exists
      const archetypeResult = await this.getArchetypeById(id);
      if (!archetypeResult.success) {
        return archetypeResult as ServiceResult<void>;
      }

      // Validate name if provided
      if (updates.name !== undefined && updates.name.trim().length === 0) {
        return {
          success: false,
          error: 'Archetype name cannot be empty',
          code: 'VALIDATION_ERROR'
        };
      }

      // Check for duplicate name if updating name
      if (updates.name) {
        const nameExists = await this.repository.nameExists(updates.name.trim(), id);
        if (nameExists) {
          return {
            success: false,
            error: 'An archetype with this name already exists',
            code: 'DUPLICATE_ENTRY'
          };
        }
      }

      // Validate category if provided
      if (updates.category) {
        const validCategories = await this.getValidCategories();
        if (!validCategories.includes(updates.category)) {
          return {
            success: false,
            error: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
            code: 'VALIDATION_ERROR'
          };
        }
      }

      // Validate unit of measure if provided
      if (updates.unit_of_measure !== undefined && updates.unit_of_measure.trim().length === 0) {
        return {
          success: false,
          error: 'Unit of measure cannot be empty',
          code: 'VALIDATION_ERROR'
        };
      }

      // Validate numeric fields
      if (updates.reorder_point !== undefined && updates.reorder_point < 0) {
        return {
          success: false,
          error: 'Reorder point cannot be negative',
          code: 'VALIDATION_ERROR'
        };
      }

      // Trim string fields
      const cleanedUpdates: any = { updated_by: userId };

      const stringFields = ['name', 'subcategory', 'unit_of_measure', 'description'];
      for (const field of stringFields) {
        if (updates[field as keyof UpdateArchetypeData] !== undefined) {
          const value = updates[field as keyof UpdateArchetypeData];
          cleanedUpdates[field] = typeof value === 'string' ? value.trim() : value;
        }
      }

      // Handle non-string fields
      if (updates.category !== undefined) {
        cleanedUpdates.category = updates.category;
      }
      if (updates.specifications !== undefined) {
        cleanedUpdates.specifications = updates.specifications;
      }
      if (updates.reorder_point !== undefined) {
        cleanedUpdates.reorder_point = updates.reorder_point;
      }
      if (updates.is_active !== undefined) {
        cleanedUpdates.is_active = updates.is_active;
      }

      await this.repository.update(id, cleanedUpdates);

      return { success: true, data: undefined };
    } catch (error) {
      console.error('Error in ArchetypeService.updateArchetype:', error);
      return {
        success: false,
        error: 'Failed to update archetype',
        code: 'UPDATE_ERROR'
      };
    }
  }

  /**
   * Delete archetype (soft delete)
   */
  async deleteArchetype(id: number, userId?: number): Promise<ServiceResult<{ message: string }>> {
    try {
      // Verify archetype exists
      const archetypeResult = await this.getArchetypeById(id);
      if (!archetypeResult.success) {
        return archetypeResult as ServiceResult<{ message: string }>;
      }

      // Soft delete (deactivate)
      await this.repository.softDelete(id, userId);
      return {
        success: true,
        data: { message: 'Archetype deactivated successfully' }
      };
    } catch (error) {
      console.error('Error in ArchetypeService.deleteArchetype:', error);
      return {
        success: false,
        error: 'Failed to delete archetype',
        code: 'DELETE_ERROR'
      };
    }
  }

  /**
   * Get archetype statistics
   */
  async getStatistics(): Promise<ServiceResult<ArchetypeStatsRow>> {
    try {
      const stats = await this.repository.getStatistics();
      return { success: true, data: stats };
    } catch (error) {
      console.error('Error in ArchetypeService.getStatistics:', error);
      return {
        success: false,
        error: 'Failed to fetch archetype statistics',
        code: 'FETCH_ERROR'
      };
    }
  }

  /**
   * Get categories with counts
   */
  async getCategories(): Promise<ServiceResult<CategoryCountRow[]>> {
    try {
      const categories = await this.repository.getCategories();
      return { success: true, data: categories };
    } catch (error) {
      console.error('Error in ArchetypeService.getCategories:', error);
      return {
        success: false,
        error: 'Failed to fetch categories',
        code: 'FETCH_ERROR'
      };
    }
  }

  /**
   * Get subcategories for a category
   */
  async getSubcategories(category: string): Promise<ServiceResult<string[]>> {
    try {
      const validCategories = await this.getValidCategories();
      if (!validCategories.includes(category)) {
        return {
          success: false,
          error: `Invalid category: ${category}`,
          code: 'VALIDATION_ERROR'
        };
      }

      const subcategories = await this.repository.getSubcategories(category);
      return { success: true, data: subcategories };
    } catch (error) {
      console.error('Error in ArchetypeService.getSubcategories:', error);
      return {
        success: false,
        error: 'Failed to fetch subcategories',
        code: 'FETCH_ERROR'
      };
    }
  }
}
