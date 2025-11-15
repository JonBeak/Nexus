// File Clean up Finished: Nov 14, 2025

/**
 * Vinyl Products Repository
 * Data access layer for vinyl products catalog operations
 */

import { query, pool } from '../../config/database';
import {
  VinylProduct,
  VinylProductData,
  VinylProductsFilters,
  ProductSupplier,
  Supplier
} from '../../types/vinyl';

export class VinylProductsRepository {
  /**
   * Get vinyl products with filters and computed fields
   */
  static async getVinylProducts(filters: VinylProductsFilters = {}): Promise<VinylProduct[]> {
    const {
      search,
      brand,
      series,
      is_active,
      has_inventory
    } = filters;

    let sql = `
      SELECT
        vp.*,
        COUNT(vi.id) as inventory_count,
        SUM(CASE WHEN vi.disposition = 'in_stock' THEN vi.length_yards ELSE 0 END) as total_yards
      FROM vinyl_products vp
      LEFT JOIN vinyl_inventory vi ON (
        vp.brand = vi.brand AND
        vp.series = vi.series AND
        (vp.colour_number = vi.colour_number OR (vp.colour_number IS NULL AND vi.colour_number IS NULL))
      )
      WHERE 1=1
    `;

    const params: any[] = [];

    if (search) {
      sql += ` AND (
        vp.brand LIKE ? OR
        vp.series LIKE ? OR
        vp.colour_number LIKE ? OR
        vp.colour_name LIKE ?
      )`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (brand) {
      sql += ' AND vp.brand = ?';
      params.push(brand);
    }

    if (series) {
      sql += ' AND vp.series = ?';
      params.push(series);
    }

    if (is_active !== undefined) {
      sql += ' AND vp.is_active = ?';
      params.push(is_active);
    }

    sql += ' GROUP BY vp.product_id';

    if (has_inventory !== undefined) {
      if (has_inventory) {
        sql += ' HAVING inventory_count > 0';
      } else {
        sql += ' HAVING inventory_count = 0';
      }
    }

    sql += ' ORDER BY vp.brand, vp.series, vp.colour_number';

    const products = await query(sql, params) as VinylProduct[];

    // Get supplier information for all products (fix N+1 problem)
    if (products.length > 0) {
      const productIds = products.map(p => p.product_id);
      const suppliersMap = await this.getSuppliersForProducts(productIds);

      products.forEach(product => {
        product.suppliers = suppliersMap[product.product_id] || [];

        // Create display_colour
        product.display_colour = product.colour_number && product.colour_name
          ? `${product.colour_number} ${product.colour_name}`
          : (product.colour_number || product.colour_name || '');

        // Ensure numeric values are properly typed
        product.inventory_count = Number(product.inventory_count) || 0;
        product.total_yards = Number(product.total_yards) || 0;
      });
    }

    return products;
  }

  /**
   * Get single vinyl product by ID
   */
  static async getVinylProductById(productId: number): Promise<VinylProduct | null> {
    const sql = `
      SELECT
        vp.*,
        COUNT(vi.id) as inventory_count,
        SUM(CASE WHEN vi.disposition = 'in_stock' THEN vi.length_yards ELSE 0 END) as total_yards
      FROM vinyl_products vp
      LEFT JOIN vinyl_inventory vi ON (
        vp.brand = vi.brand AND
        vp.series = vi.series AND
        (vp.colour_number = vi.colour_number OR (vp.colour_number IS NULL AND vi.colour_number IS NULL))
      )
      WHERE vp.product_id = ?
      GROUP BY vp.product_id
    `;

    const products = await query(sql, [productId]) as VinylProduct[];

    if (products.length === 0) {
      return null;
    }

    const product = products[0];

    // Get suppliers
    const suppliersMap = await this.getSuppliersForProducts([product.product_id]);
    product.suppliers = suppliersMap[product.product_id] || [];

    // Create display_colour and format numbers
    product.display_colour = product.colour_number && product.colour_name
      ? `${product.colour_number} ${product.colour_name}`
      : (product.colour_number || product.colour_name || '');

    product.inventory_count = Number(product.inventory_count) || 0;
    product.total_yards = Number(product.total_yards) || 0;

    return product;
  }

  /**
   * Create new vinyl product
   */
  static async createVinylProduct(data: VinylProductData, supplierIds?: number[]): Promise<number> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const sql = `
        INSERT INTO vinyl_products (
          brand, series, colour_number, colour_name, default_width,
          is_active, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        data.brand,
        data.series,
        data.colour_number || null,
        data.colour_name || null,
        data.default_width || null,
        data.is_active !== undefined ? data.is_active : true,
        data.created_by || null,
        data.updated_by || null
      ];

      const [result] = await connection.execute(sql, params) as any;
      const productId = result.insertId;

      // Add supplier associations if provided
      if (supplierIds && supplierIds.length > 0) {
        // Delete any existing associations (shouldn't be any for new product, but for consistency)
        await connection.execute('DELETE FROM product_suppliers WHERE product_id = ?', [productId]);

        // Insert new associations one by one
        for (let index = 0; index < supplierIds.length; index++) {
          const supplierId = supplierIds[index];
          await connection.execute(
            'INSERT INTO product_suppliers (product_id, supplier_id, is_primary) VALUES (?, ?, ?)',
            [productId, supplierId, index === 0 ? 1 : 0] // First supplier is primary
          );
        }
      }

      await connection.commit();
      return productId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Update vinyl product
   */
  static async updateVinylProduct(
    productId: number,
    data: Partial<VinylProductData>,
    supplierIds?: number[]
  ): Promise<boolean> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Update product data if provided
      const fields: string[] = [];
      const params: any[] = [];

      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          fields.push(`${key} = ?`);
          params.push(value);
        }
      });

      if (fields.length > 0) {
        fields.push('updated_at = NOW()');
        params.push(productId);

        const sql = `UPDATE vinyl_products SET ${fields.join(', ')} WHERE product_id = ?`;
        await connection.execute(sql, params);
      }

      // Update supplier associations if provided
      if (supplierIds !== undefined) {
        // Delete existing associations
        await connection.execute('DELETE FROM product_suppliers WHERE product_id = ?', [productId]);

        // Insert new associations if provided
        if (supplierIds.length > 0) {
          for (let index = 0; index < supplierIds.length; index++) {
            const supplierId = supplierIds[index];
            await connection.execute(
              'INSERT INTO product_suppliers (product_id, supplier_id, is_primary) VALUES (?, ?, ?)',
              [productId, supplierId, index === 0 ? 1 : 0] // First supplier is primary
            );
          }
        }
      }

      // If the product was updated, sync changes to related inventory items
      if (fields.length > 0) {
        // Get the current product to know what to sync
        const [productRows] = await connection.execute(
          'SELECT brand, series, colour_number FROM vinyl_products WHERE product_id = ?',
          [productId]
        ) as any;

        if (productRows.length > 0) {
          const product = productRows[0];

          // Build update query for matching inventory items
          const syncFields: string[] = [];
          const syncParams: any[] = [];

          if (data.colour_number !== undefined) {
            syncFields.push('colour_number = ?');
            syncParams.push(data.colour_number);
          }

          if (data.colour_name !== undefined) {
            syncFields.push('colour_name = ?');
            syncParams.push(data.colour_name);
          }

          if (syncFields.length > 0) {
            syncFields.push('updated_at = NOW()');
            syncParams.push(product.brand, product.series, product.colour_number || null, product.colour_number || null);

            const syncSql = `
              UPDATE vinyl_inventory
              SET ${syncFields.join(', ')}
              WHERE brand = ? AND series = ?
                AND (colour_number = ? OR (colour_number IS NULL AND ? IS NULL))
            `;

            await connection.execute(syncSql, syncParams);
          }
        }
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Soft delete vinyl product (mark as inactive)
   */
  static async deleteVinylProduct(productId: number): Promise<boolean> {
    const sql = 'UPDATE vinyl_products SET is_active = 0, updated_at = NOW() WHERE product_id = ?';
    const result = await query(sql, [productId]) as any;
    return result.affectedRows > 0;
  }

  /**
   * Hard delete vinyl product (only if no inventory references)
   */
  static async hardDeleteVinylProduct(productId: number): Promise<boolean> {
    // Check if there are any inventory items that reference this product
    const product = await this.getVinylProductById(productId);
    if (!product) {
      return false;
    }

    if ((product.inventory_count ?? 0) > 0) {
      throw new Error('Cannot delete product with existing inventory items');
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Delete supplier associations
      await connection.execute('DELETE FROM product_suppliers WHERE product_id = ?', [productId]);

      // Delete the product
      const [result] = await connection.execute('DELETE FROM vinyl_products WHERE product_id = ?', [productId]) as any;

      await connection.commit();
      return result.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get suppliers for multiple products (optimized to fix N+1 problem)
   */
  static async getSuppliersForProducts(productIds: number[]): Promise<{ [productId: number]: ProductSupplier[] }> {
    if (productIds.length === 0) {
      return {};
    }

    const placeholders = productIds.map(() => '?').join(',');
    const sql = `
      SELECT
        ps.*,
        s.name as supplier_name
      FROM product_suppliers ps
      JOIN suppliers s ON ps.supplier_id = s.supplier_id
      WHERE ps.product_id IN (${placeholders})
        AND s.is_active = 1
      ORDER BY ps.product_id, ps.is_primary DESC, s.name
    `;

    const suppliers = await query(sql, productIds) as ProductSupplier[];

    // Group by product_id
    const groupedSuppliers: { [productId: number]: ProductSupplier[] } = {};
    suppliers.forEach(supplier => {
      if (!groupedSuppliers[supplier.product_id]) {
        groupedSuppliers[supplier.product_id] = [];
      }
      groupedSuppliers[supplier.product_id].push(supplier);
    });

    return groupedSuppliers;
  }


  /**
   * Get vinyl product statistics
   */
  static async getVinylProductStats(): Promise<any> {
    const sql = `
      SELECT
        COUNT(*) as total_products,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_products,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive_products,
        COUNT(DISTINCT brand) as brands_count,
        COUNT(DISTINCT CONCAT(brand, '-', series)) as series_count
      FROM vinyl_products
    `;

    const stats = await query(sql) as any[];
    return stats[0] || {};
  }

  /**
   * Get autofill suggestions for product forms
   */
  static async getAutofillSuggestions(): Promise<any> {
    // Get all distinct combinations with all fields needed for CombinedVinylDropdown
    const combinationsQuery = `
      SELECT DISTINCT
        vp.brand,
        vp.series,
        vp.colour_number,
        vp.colour_name,
        vp.default_width,
        GROUP_CONCAT(DISTINCT s.name SEPARATOR ', ') as suppliers
      FROM vinyl_products vp
      LEFT JOIN product_suppliers ps ON vp.product_id = ps.product_id
      LEFT JOIN suppliers s ON ps.supplier_id = s.supplier_id AND s.is_active = TRUE
      WHERE vp.is_active = TRUE
      GROUP BY vp.brand, vp.series, vp.colour_number, vp.colour_name, vp.default_width
      ORDER BY vp.brand, vp.series, vp.colour_number, vp.colour_name
    `;

    const combinations = await query(combinationsQuery) as any[];

    // Extract unique values for individual field dropdowns
    const brands = [...new Set(combinations.map(c => c.brand).filter(Boolean))];
    const series = [...new Set(combinations.map(c => c.series).filter(Boolean))];
    const colour_numbers = [...new Set(combinations.map(c => c.colour_number).filter(Boolean))];
    const colour_names = [...new Set(combinations.map(c => c.colour_name).filter(Boolean))];

    return {
      brands,
      series,
      colour_numbers,
      colour_names,
      combinations // This is what CombinedVinylDropdown needs!
    };
  }

  /**
   * Find or create product from inventory data
   * Returns both the product ID and whether it was newly created
   */
  static async findOrCreateProductFromInventory(inventoryData: {
    brand: string;
    series: string;
    colour_number?: string;
    colour_name?: string;
    width?: number;
    created_by?: number;
  }): Promise<{ productId: number; created: boolean }> {
    // Try to find existing product
    let sql = `
      SELECT product_id
      FROM vinyl_products
      WHERE brand = ? AND series = ?
        AND (colour_number = ? OR (colour_number IS NULL AND ? IS NULL))
        AND (colour_name = ? OR (colour_name IS NULL AND ? IS NULL))
      LIMIT 1
    `;

    const searchParams = [
      inventoryData.brand,
      inventoryData.series,
      inventoryData.colour_number || null,
      inventoryData.colour_number || null,
      inventoryData.colour_name || null,
      inventoryData.colour_name || null
    ];

    const existing = await query(sql, searchParams) as any[];

    if (existing.length > 0) {
      return { productId: existing[0].product_id, created: false };
    }

    // Create new product
    const productData: VinylProductData = {
      brand: inventoryData.brand,
      series: inventoryData.series,
      colour_number: inventoryData.colour_number || undefined,
      colour_name: inventoryData.colour_name || undefined,
      default_width: inventoryData.width || undefined,
      is_active: true,
      created_by: inventoryData.created_by || undefined,
      updated_by: inventoryData.created_by || undefined
    };

    const newProductId = await this.createVinylProduct(productData);
    return { productId: newProductId, created: true };
  }


  /**
   * Check if vinyl product exists
   */
  static async vinylProductExists(productId: number): Promise<boolean> {
    const sql = 'SELECT 1 FROM vinyl_products WHERE product_id = ? LIMIT 1';
    const result = await query(sql, [productId]) as any[];
    return result.length > 0;
  }
}