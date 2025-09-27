import React, { useState } from 'react';
import { 
  ShoppingCart as CartIcon, 
  Trash2, 
  Send, 
  Plus,
  Building2,
  Mail,
  AlertCircle
} from 'lucide-react';
import { useShoppingCart } from '../../contexts/ShoppingCartContext';
import type { User as AccountUser } from '../accounts/hooks/useAccountAPI';

interface ShoppingCartProps {
  user?: AccountUser;
  showNotification: (message: string, type?: 'success' | 'error') => void;
}

export const ShoppingCartComponent: React.FC<ShoppingCartProps> = ({ 
  user, 
  showNotification 
}) => {
  void user;
  const { 
    currentCart, 
    carts, 
    createCart,
    removeItemFromCart 
  } = useShoppingCart();
  
  const [loading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCartName, setNewCartName] = useState('');

  const handleCreateCart = async () => {
    if (!newCartName.trim()) return;
    
    await createCart(newCartName);
    setShowCreateModal(false);
    setNewCartName('');
  };

  const handleRemoveItem = async (itemId: string) => {
    await removeItemFromCart(itemId);
  };

  const handleGenerateOrders = () => {
    if (!currentCart) return;
    
    // Mock the order generation process
    showNotification(
      `Generated ${currentCart.total_suppliers} supplier orders. Emails would be sent automatically.`,
      'success'
    );
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
        <p className="mt-2 text-sm text-gray-600">Loading shopping carts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Shopping Carts</h3>
          <p className="text-sm text-gray-500">Manage orders grouped by supplier</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 bg-purple-600 text-white px-3 py-2 rounded hover:bg-purple-700"
        >
          <Plus className="w-4 h-4" />
          <span>New Cart</span>
        </button>
      </div>

      {/* Cart Selection */}
      {carts.length > 1 && (
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {carts.map((cart) => (
              <button
                key={cart.id}
                onClick={() => {/* TODO: Implement cart selection */}}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  currentCart?.id === cart.id
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {cart.name}
                <span className="ml-2 bg-gray-100 text-gray-600 py-1 px-2 rounded-full text-xs">
                  {cart.total_items}
                </span>
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Cart Content */}
      {currentCart ? (
        <div className="space-y-6">
          {/* Cart Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-semibold text-gray-900">{currentCart.total_suppliers}</div>
                <div className="text-sm text-gray-500">Suppliers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-gray-900">{currentCart.total_items}</div>
                <div className="text-sm text-gray-500">Items</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-gray-900">
                  ${currentCart.total_estimated_cost.toFixed(2)}
                </div>
                <div className="text-sm text-gray-500">Est. Total</div>
              </div>
              <div className="text-center">
                <button
                  onClick={handleGenerateOrders}
                  className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 mx-auto"
                  disabled={currentCart.total_items === 0}
                >
                  <Send className="w-4 h-4" />
                  <span>Generate Orders</span>
                </button>
              </div>
            </div>
          </div>

          {/* Supplier Carts */}
          {currentCart.supplier_carts.map((supplierCart) => (
            <div key={supplierCart.supplier_id} className="border rounded-lg p-4">
              {/* Supplier Header */}
              <div className="flex justify-between items-center mb-4 pb-3 border-b">
                <div className="flex items-center space-x-3">
                  <Building2 className="w-5 h-5 text-gray-400" />
                  <div>
                    <h4 className="font-medium text-gray-900">{supplierCart.supplier_name}</h4>
                    <div className="text-sm text-gray-500">
                      {supplierCart.total_items} items • ${supplierCart.total_estimated_cost.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="text-right text-sm text-gray-500">
                  {supplierCart.contact_email && (
                    <div className="flex items-center space-x-1">
                      <Mail className="w-3 h-3" />
                      <span>{supplierCart.contact_email}</span>
                    </div>
                  )}
                  {supplierCart.preferred_payment_terms && (
                    <div className="mt-1">Terms: {supplierCart.preferred_payment_terms}</div>
                  )}
                  {supplierCart.minimum_order_amount && (
                    <div className="mt-1">
                      Min Order: ${supplierCart.minimum_order_amount.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>

              {/* Items */}
              <div className="space-y-3">
                {supplierCart.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center bg-gray-50 p-3 rounded">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{item.name}</div>
                      <div className="text-sm text-gray-500">
                        {item.category} • {item.quantity} {item.unit}
                        {item.job_number && ` • Job: ${item.job_number}`}
                      </div>
                      {item.material_specification && (
                        <div className="text-xs text-gray-400 mt-1">{item.material_specification}</div>
                      )}
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className="font-medium text-gray-900">
                          ${item.total_estimated_cost?.toFixed(2) || '0.00'}
                        </div>
                        {item.estimated_price && (
                          <div className="text-xs text-gray-500">
                            ${item.estimated_price.toFixed(2)}/{item.unit}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Minimum Order Warning */}
              {supplierCart.minimum_order_amount && supplierCart.total_estimated_cost < supplierCart.minimum_order_amount && (
                <div className="mt-4 flex items-center space-x-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm text-yellow-800">
                    Order total below minimum of ${supplierCart.minimum_order_amount.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          ))}

          {currentCart.supplier_carts.length === 0 && (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <CartIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No items in cart yet</p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <CartIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">No shopping carts found</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
          >
            Create Your First Cart
          </button>
        </div>
      )}

      {/* Create Cart Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Shopping Cart</h3>
            <input
              type="text"
              value={newCartName}
              onChange={(e) => setNewCartName(e.target.value)}
              placeholder="Enter cart name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
              onKeyPress={(e) => e.key === 'Enter' && handleCreateCart()}
            />
            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewCartName('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCart}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                disabled={!newCartName.trim()}
              >
                Create Cart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
