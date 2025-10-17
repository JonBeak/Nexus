import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2';

export interface FieldOption {
  value: string;
  label: string;
}

export interface DynamicField {
  name: string;
  type: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  data_source?: string;
  value_field?: string;
  display_field?: string;
  filter?: Record<string, any>;
  order_by?: string;
  validation?: {
    min?: number;
    max?: number;
    maxLength?: number;
  };
  options?: FieldOption[] | string[];
}

export interface FieldPrompts {
  [key: string]: string | boolean;  // field1: "Label", field1_enabled: true, etc.
}

export interface ProductTemplate {
  rows: DynamicField[][];  // Multi-row support - all templates use this format
}

export interface SimpleProductTemplate {
  field_prompts: FieldPrompts;
  static_options: Record<string, string[]>;
}

export interface DynamicFieldConfig {
  type: 'dynamic';
  source: string;
  value_field: string;
  display_field: string;
  where?: string;
  order_by?: string;
}

export class DynamicTemplateService {
  // Cache for dropdown options with expiry
  private optionsCache = new Map<string, { data: FieldOption[]; timestamp: number }>();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes

  /**
   * Get field prompts for all product types with populated dynamic dropdowns
   */
  async getAllFieldPrompts(): Promise<Record<number, SimpleProductTemplate>> {
    try {
      // Get all product types with their templates
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT id, field_prompts, static_options FROM product_types'
      );

      // Collect all unique dynamic sources across all product types
      const uniqueSources = new Set<string>();
      const dynamicConfigs: Record<string, DynamicFieldConfig> = {};

      for (const row of rows) {
        const staticOptions = row.static_options || {};
        Object.entries(staticOptions).forEach(([fieldName, config]: [string, any]) => {
          if (config && config.type === 'dynamic' && config.source) {
            const cacheKey = this.buildCacheKey(config);
            uniqueSources.add(cacheKey);
            dynamicConfigs[cacheKey] = config;
          }
        });
      }

      // Batch query all unique sources
      const dynamicOptionsData: Record<string, FieldOption[]> = {};
      for (const cacheKey of uniqueSources) {
        dynamicOptionsData[cacheKey] = await this.getOptionsFromDynamicConfig(dynamicConfigs[cacheKey]);
      }

      // Build final templates with populated options
      const allTemplates: Record<number, SimpleProductTemplate> = {};

      for (const row of rows) {
        const staticOptions: Record<string, string[]> = {};
        const rowStaticOptions = row.static_options || {};

        // Process each field's configuration
        Object.entries(rowStaticOptions).forEach(([fieldName, config]: [string, any]) => {
          if (config && config.type === 'dynamic') {
            // Get options from our batch-loaded data
            const cacheKey = this.buildCacheKey(config);
            const options = dynamicOptionsData[cacheKey] || [];
            staticOptions[fieldName] = options.map(opt => opt.label);
          } else if (Array.isArray(config)) {
            // Handle static string arrays
            staticOptions[fieldName] = config;
          }
        });

        allTemplates[row.id] = {
          field_prompts: row.field_prompts || {},
          static_options: staticOptions
        };
      }

      return allTemplates;
    } catch (error) {
      console.error('DynamicTemplateService.getAllFieldPrompts error:', error);
      throw error;
    }
  }

  /**
   * Get simplified field prompts for the new grid system
   */
  async getFieldPrompts(productTypeId: number): Promise<SimpleProductTemplate> {
    try {
      // Get field_prompts and static_options from product_types
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT field_prompts, static_options FROM product_types WHERE id = ?',
        [productTypeId]
      );

      if (!rows || rows.length === 0) {
        throw new Error(`Product type ${productTypeId} not found`);
      }

      const row = rows[0];

      return {
        field_prompts: row.field_prompts || {},
        static_options: row.static_options || {}
      };
    } catch (error) {
      console.error('DynamicTemplateService.getFieldPrompts error:', error);
      throw error;
    }
  }
  /**
   * Get product template with populated dynamic field options
   */
  async getProductTemplate(productTypeId: number): Promise<ProductTemplate> {
    try {
      // Get template config from product_types
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT input_template FROM product_types WHERE id = ?',
        [productTypeId]
      );
      
      if (!rows || rows.length === 0) {
        throw new Error(`Product type ${productTypeId} not found`);
      }
      
      let template: ProductTemplate;
      
      try {
        // Check if input_template is already an object or needs parsing
        template = typeof rows[0].input_template === 'string' 
          ? JSON.parse(rows[0].input_template)
          : rows[0].input_template;
      } catch (parseError) {
        console.error(`DynamicTemplateService: JSON parse error for product type ${productTypeId}:`, parseError);
        console.error(`Raw input_template:`, rows[0].input_template);
        throw new Error(`Invalid input_template JSON for product type ${productTypeId}`);
      }
      
      // Populate dynamic fields with database options
      const allFields = template.rows.flat();
        
      for (let field of allFields) {
        if (field.data_source && field.value_field && field.display_field) {
          field.options = await this.getOptionsFromDatabase(field);
        }
      }
      
      return template;
    } catch (error) {
      console.error('DynamicTemplateService.getProductTemplate error:', error);
      throw error;
    }
  }

  /**
   * Build cache key for dynamic field configuration
   */
  private buildCacheKey(config: DynamicFieldConfig): string {
    const where = config.where || 'is_active = 1';
    const orderBy = config.order_by || config.display_field;
    return `${config.source}:${config.value_field}:${config.display_field}:${where}:${orderBy}`;
  }

  /**
   * Get options from database using dynamic field configuration with caching
   */
  private async getOptionsFromDynamicConfig(config: DynamicFieldConfig): Promise<FieldOption[]> {
    const cacheKey = this.buildCacheKey(config);
    const now = Date.now();

    // Check cache first
    const cached = this.optionsCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < this.cacheExpiry) {
      console.log(`✅ Cache hit for ${config.source}`);
      return cached.data;
    }

    try {
      // Build WHERE clause
      const whereClause = config.where ? `WHERE ${config.where}` : 'WHERE is_active = 1';

      // Use custom order_by if provided, otherwise order by display field
      const orderBy = config.order_by || config.display_field;

      const query = `
        SELECT ${config.value_field} as value,
               ${config.display_field} as label
        FROM ${config.source}
        ${whereClause}
        ORDER BY ${orderBy}
      `;

      console.log(`🔄 Querying ${config.source}:`, query);

      const [rows] = await pool.execute<RowDataPacket[]>(query);

      const options: FieldOption[] = rows.map(row => ({
        value: String(row.value),
        label: String(row.label)
      }));

      // Cache the results
      this.optionsCache.set(cacheKey, { data: options, timestamp: now });
      console.log(`💾 Cached ${options.length} options for ${config.source}`);

      return options;

    } catch (error) {
      console.error(`❌ Error querying ${config.source}:`, error);
      // Return empty options on error rather than breaking the whole template
      return [];
    }
  }

  /**
   * Get options from database based on field configuration
   */
  private async getOptionsFromDatabase(field: DynamicField): Promise<FieldOption[]> {
    try {
      // Build WHERE clause from filter
      const whereClause = field.filter 
        ? 'WHERE ' + Object.entries(field.filter).map(([key, value]) => {
            if (typeof value === 'string') {
              return `${key} = '${value}'`;
            }
            return `${key} = ${value}`;
          }).join(' AND ')
        : '';
      
      // Handle display_field with SQL functions (like CONCAT)
      const displayField = field.display_field;
      const valueField = field.value_field;
      
      // Use custom order_by if provided, otherwise order by display field
      const orderBy = field.order_by || displayField;
      
      const query = `
        SELECT ${valueField} as value, 
               ${displayField} as label 
        FROM ${field.data_source} 
        ${whereClause}
        ORDER BY ${orderBy}
      `;
      
      console.log(`DynamicTemplateService query for field ${field.name}:`, query);
      
      const [rows] = await pool.execute<RowDataPacket[]>(query);
      
      return rows.map(row => ({ 
        value: String(row.value), 
        label: String(row.label) 
      }));
      
    } catch (error) {
      console.error(`DynamicTemplateService.getOptionsFromDatabase error for field ${field.name}:`, error);
      // Return empty options on error rather than breaking the whole template
      return [];
    }
  }

  /**
   * Validate field value against field configuration
   */
  validateField(field: DynamicField, value: any): string[] {
    const errors: string[] = [];
    
    // Required field validation
    if (field.required && (!value || value === '')) {
      errors.push(`${field.label} is required`);
    }
    
    // Skip other validations if field is empty and not required
    if (!value || value === '') {
      return errors;
    }
    
    // Number validation  
    if (field.type === 'number') {
      const num = parseFloat(value);
      if (isNaN(num)) {
        errors.push(`${field.label} must be a valid number`);
      } else {
        if (field.validation?.min !== undefined && num < field.validation.min) {
          errors.push(`${field.label} must be at least ${field.validation.min}`);
        }
        if (field.validation?.max !== undefined && num > field.validation.max) {
          errors.push(`${field.label} must be at most ${field.validation.max}`);
        }
      }
    }
    
    // Text length validation
    if (field.type === 'text' && field.validation?.maxLength) {
      if (String(value).length > field.validation.maxLength) {
        errors.push(`${field.label} must be at most ${field.validation.maxLength} characters`);
      }
    }
    
    // Select field validation - check if value exists in options
    if (field.type === 'select' && field.options) {
      const validValues = Array.isArray(field.options) 
        ? field.options.map(opt => typeof opt === 'string' ? opt : opt.value)
        : [];
      
      if (validValues.length > 0 && !validValues.includes(String(value))) {
        errors.push(`${field.label} contains an invalid selection`);
      }
    }
    
    return errors;
  }

  /**
   * Validate all fields in a row
   */
  validateRow(template: ProductTemplate, rowData: Record<string, any>): Record<string, string[]> {
    const errors: Record<string, string[]> = {};

    const allFields = template.rows.flat();

    for (const field of allFields) {
      const fieldErrors = this.validateField(field, rowData[field.name]);
      if (fieldErrors.length > 0) {
        errors[field.name] = fieldErrors;
      }
    }

    return errors;
  }

}

// Export singleton instance
export const dynamicTemplateService = new DynamicTemplateService();