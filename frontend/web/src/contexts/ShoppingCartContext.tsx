import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Cart types - defined locally (moved from deprecated shoppingCartApi.ts)
export interface CartItem {
  id: string;
  product_standard_id?: number;
  archetype_id?: number;
  name: string;
  category: string;
  supplier_id?: number;
  supplier_name: string;
  quantity: number;
  unit: string;
  estimated_price?: number;
  total_estimated_cost?: number;
  job_id?: number;
  job_number?: string;
  order_id?: number;
  order_number?: string;
  material_specification?: string;
  notes?: string;
  created_at: string;
}

export interface SupplierCart {
  supplier_id: number;
  supplier_name: string;
  items: CartItem[];
  total_items: number;
  total_estimated_cost: number;
  contact_email?: string;
  preferred_payment_terms?: string;
  minimum_order_amount?: number;
  estimated_shipping?: number;
}

export interface ShoppingCart {
  id: string;
  user_id: number;
  name: string;
  status: 'draft' | 'sent' | 'approved' | 'ordered' | 'received';
  supplier_carts: SupplierCart[];
  total_suppliers: number;
  total_items: number;
  total_estimated_cost: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface ShoppingCartContextType {
  currentCart: ShoppingCart | null;
  carts: ShoppingCart[];
  isCartOpen: boolean;
  
  // Cart operations
  createCart: (name: string) => Promise<void>;
  selectCart: (cartId: string) => void;
  setCartOpen: (open: boolean) => void;
  
  // Item operations
  addItemsToCart: (items: Partial<CartItem>[]) => Promise<void>;
  removeItemFromCart: (itemId: string) => Promise<void>;
  updateCartItem: (itemId: string, updates: Partial<CartItem>) => Promise<void>;
  
  // Bulk operations
  addJobMaterialsToCart: (jobData: {
    job_id: number;
    job_number: string;
    materials: Array<{
      name: string;
      category: string;
      quantity: number;
      unit: string;
      supplier_name: string;
      estimated_price?: number;
    }>;
  }) => Promise<void>;
  
  addLowStockItemToCart: (item: {
    id: number;
    name: string;
    category: string;
    supplier_name: string;
    reorder_quantity: number;
    unit: string;
    current_price?: number;
  }) => Promise<void>;
  
  // Notifications
  showNotification: (message: string, type?: 'success' | 'error') => void;
}

const ShoppingCartContext = createContext<ShoppingCartContextType | undefined>(undefined);

interface ShoppingCartProviderProps {
  children: ReactNode;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
}

export const ShoppingCartProvider: React.FC<ShoppingCartProviderProps> = ({ 
  children, 
  showNotification = () => {} 
}) => {
  const [currentCart, setCurrentCart] = useState<ShoppingCart | null>(null);
  const [carts, setCarts] = useState<ShoppingCart[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Load or create default cart on mount
  React.useEffect(() => {
    // Initialize with a default cart for demo purposes
    const defaultCart: ShoppingCart = {
      id: 'default-cart',
      user_id: 1,
      name: 'Current Orders',
      status: 'draft',
      total_suppliers: 0,
      total_items: 0,
      total_estimated_cost: 0,
      supplier_carts: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    setCarts([defaultCart]);
    setCurrentCart(defaultCart);
  }, []);

  const createCart = useCallback(async (name: string) => {
    const newCart: ShoppingCart = {
      id: `cart-${Date.now()}`,
      user_id: 1,
      name,
      status: 'draft',
      total_suppliers: 0,
      total_items: 0,
      total_estimated_cost: 0,
      supplier_carts: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    setCarts(prev => [...prev, newCart]);
    setCurrentCart(newCart);
    showNotification(`Created new cart: ${name}`, 'success');
  }, [showNotification]);

  const selectCart = useCallback((cartId: string) => {
    const cart = carts.find(c => c.id === cartId);
    if (cart) {
      setCurrentCart(cart);
    }
  }, [carts]);

  const setCartOpen = useCallback((open: boolean) => {
    setIsCartOpen(open);
  }, []);

  const addItemsToCart = useCallback(async (items: Partial<CartItem>[]) => {
    if (!currentCart) {
      showNotification('No cart selected', 'error');
      return;
    }

    // Group items by supplier
    const itemsBySupplier = items.reduce((acc, item) => {
      const supplierId = item.supplier_name || 'Unknown';
      if (!acc[supplierId]) {
        acc[supplierId] = [];
      }
      acc[supplierId].push({
        ...item,
        id: `item-${Date.now()}-${Math.random()}`,
        created_at: new Date().toISOString(),
        total_estimated_cost: (item.quantity || 1) * (item.estimated_price || 0)
      } as CartItem);
      return acc;
    }, {} as Record<string, CartItem[]>);

    // Update cart with new items
    const updatedSupplierCarts = [...currentCart.supplier_carts];
    
    Object.entries(itemsBySupplier).forEach(([supplierName, newItems]) => {
      const existingSupplierIndex = updatedSupplierCarts.findIndex(
        sc => sc.supplier_name === supplierName
      );
      
      if (existingSupplierIndex >= 0) {
        // Add to existing supplier cart
        updatedSupplierCarts[existingSupplierIndex] = {
          ...updatedSupplierCarts[existingSupplierIndex],
          items: [...updatedSupplierCarts[existingSupplierIndex].items, ...newItems],
          total_items: updatedSupplierCarts[existingSupplierIndex].items.length + newItems.length,
          total_estimated_cost: updatedSupplierCarts[existingSupplierIndex].total_estimated_cost + 
            newItems.reduce((sum, item) => sum + (item.total_estimated_cost || 0), 0)
        };
      } else {
        // Create new supplier cart
        updatedSupplierCarts.push({
          supplier_id: Date.now(), // Mock supplier ID
          supplier_name: supplierName,
          items: newItems,
          total_items: newItems.length,
          total_estimated_cost: newItems.reduce((sum, item) => sum + (item.total_estimated_cost || 0), 0),
          contact_email: `orders@${supplierName.toLowerCase().replace(/\s+/g, '')}.com`
        });
      }
    });

    const updatedCart = {
      ...currentCart,
      supplier_carts: updatedSupplierCarts,
      total_suppliers: updatedSupplierCarts.length,
      total_items: updatedSupplierCarts.reduce((sum, sc) => sum + sc.total_items, 0),
      total_estimated_cost: updatedSupplierCarts.reduce((sum, sc) => sum + sc.total_estimated_cost, 0),
      updated_at: new Date().toISOString()
    };

    setCurrentCart(updatedCart);
    setCarts(prev => prev.map(cart => cart.id === updatedCart.id ? updatedCart : cart));
    
    showNotification(`Added ${items.length} item(s) to cart`, 'success');
  }, [currentCart, showNotification]);

  const removeItemFromCart = useCallback(async (itemId: string) => {
    if (!currentCart) return;

    const updatedSupplierCarts = currentCart.supplier_carts.map(supplierCart => ({
      ...supplierCart,
      items: supplierCart.items.filter(item => item.id !== itemId),
      total_items: supplierCart.items.filter(item => item.id !== itemId).length,
      total_estimated_cost: supplierCart.items
        .filter(item => item.id !== itemId)
        .reduce((sum, item) => sum + (item.total_estimated_cost || 0), 0)
    })).filter(supplierCart => supplierCart.items.length > 0);

    const updatedCart = {
      ...currentCart,
      supplier_carts: updatedSupplierCarts,
      total_suppliers: updatedSupplierCarts.length,
      total_items: updatedSupplierCarts.reduce((sum, sc) => sum + sc.total_items, 0),
      total_estimated_cost: updatedSupplierCarts.reduce((sum, sc) => sum + sc.total_estimated_cost, 0),
      updated_at: new Date().toISOString()
    };

    setCurrentCart(updatedCart);
    setCarts(prev => prev.map(cart => cart.id === updatedCart.id ? updatedCart : cart));
    
    showNotification('Item removed from cart', 'success');
  }, [currentCart, showNotification]);

  const updateCartItem = useCallback(async (itemId: string, updates: Partial<CartItem>) => {
    if (!currentCart) return;

    const updatedSupplierCarts = currentCart.supplier_carts.map(supplierCart => ({
      ...supplierCart,
      items: supplierCart.items.map(item => 
        item.id === itemId 
          ? { 
              ...item, 
              ...updates,
              total_estimated_cost: (updates.quantity || item.quantity) * (updates.estimated_price || item.estimated_price || 0)
            }
          : item
      )
    }));

    // Recalculate totals
    updatedSupplierCarts.forEach(supplierCart => {
      supplierCart.total_estimated_cost = supplierCart.items.reduce(
        (sum, item) => sum + (item.total_estimated_cost || 0), 0
      );
    });

    const updatedCart = {
      ...currentCart,
      supplier_carts: updatedSupplierCarts,
      total_estimated_cost: updatedSupplierCarts.reduce((sum, sc) => sum + sc.total_estimated_cost, 0),
      updated_at: new Date().toISOString()
    };

    setCurrentCart(updatedCart);
    setCarts(prev => prev.map(cart => cart.id === updatedCart.id ? updatedCart : cart));
    
    showNotification('Cart item updated', 'success');
  }, [currentCart, showNotification]);

  const addJobMaterialsToCart = useCallback(async (jobData: {
    job_id: number;
    job_number: string;
    materials: Array<{
      name: string;
      category: string;
      quantity: number;
      unit: string;
      supplier_name: string;
      estimated_price?: number;
    }>;
  }) => {
    const cartItems: Partial<CartItem>[] = jobData.materials.map(material => ({
      name: material.name,
      category: material.category,
      supplier_name: material.supplier_name,
      quantity: material.quantity,
      unit: material.unit,
      estimated_price: material.estimated_price,
      job_id: jobData.job_id,
      job_number: jobData.job_number,
      material_specification: `Required for job ${jobData.job_number}`
    }));

    await addItemsToCart(cartItems);
  }, [addItemsToCart]);

  const addLowStockItemToCart = useCallback(async (item: {
    id: number;
    name: string;
    category: string;
    supplier_name: string;
    reorder_quantity: number;
    unit: string;
    current_price?: number;
  }) => {
    const cartItems: Partial<CartItem>[] = [{
      name: item.name,
      category: item.category,
      supplier_name: item.supplier_name,
      quantity: item.reorder_quantity,
      unit: item.unit,
      estimated_price: item.current_price,
      notes: 'Low stock reorder'
    }];

    await addItemsToCart(cartItems);
  }, [addItemsToCart]);

  const value: ShoppingCartContextType = {
    currentCart,
    carts,
    isCartOpen,
    createCart,
    selectCart,
    setCartOpen,
    addItemsToCart,
    removeItemFromCart,
    updateCartItem,
    addJobMaterialsToCart,
    addLowStockItemToCart,
    showNotification
  };

  return (
    <ShoppingCartContext.Provider value={value}>
      {children}
    </ShoppingCartContext.Provider>
  );
};

export const useShoppingCart = (): ShoppingCartContextType => {
  const context = useContext(ShoppingCartContext);
  if (!context) {
    throw new Error('useShoppingCart must be used within a ShoppingCartProvider');
  }
  return context;
};