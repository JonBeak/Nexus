import { useState, useEffect } from 'react';
import api from '../../../services/api';

export interface ProductType {
  id: number;
  name: string;
  category: 'normal' | 'sub_item' | 'special';
  display_order: number;
  default_unit: string;
  is_active: boolean;
  input_template?: any;
  pricing_rules?: any;
}

export interface GroupedProductTypes {
  normal: ProductType[];
  sub_item: ProductType[];
  special: ProductType[];
}

/**
 * Hook to fetch and organize product types from unified database
 */
export const useProductTypes = () => {
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProductTypes = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch from our unified product_types table
        const response = await api.get('/job-estimation/product-types');
        
        if (response.data.success) {
          // Filter active products and sort by ID (database insertion order)
          const activeProducts = response.data.data
            .filter((pt: ProductType) => pt.is_active)
            .sort((a: ProductType, b: ProductType) => a.id - b.id);
          
          setProductTypes(activeProducts);
        } else {
          setError('Failed to load product types');
        }
      } catch (err) {
        console.error('Error fetching product types:', err);
        setError('Error loading product types');
      } finally {
        setLoading(false);
      }
    };

    fetchProductTypes();
  }, []);

  // Group products by category for dropdown organization
  const groupedProductTypes: GroupedProductTypes = {
    normal: productTypes.filter(pt => pt.category === 'normal'),
    sub_item: productTypes.filter(pt => pt.category === 'sub_item'),
    special: productTypes.filter(pt => pt.category === 'special')
  };

  return {
    productTypes,
    groupedProductTypes,
    loading,
    error,
    refetch: () => {
      setLoading(true);
      // Re-trigger useEffect
      setProductTypes([]);
    }
  };
};