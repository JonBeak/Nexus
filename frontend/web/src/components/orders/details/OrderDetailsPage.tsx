import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { Order } from '../../../types/orders';
import { ordersApi } from '../../../services/api';
import ProgressView from '../progress/ProgressView';
import StatusBadge from '../common/StatusBadge';

export const OrderDetailsPage: React.FC = () => {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orderNumber) {
      fetchOrder(parseInt(orderNumber));
    }
  }, [orderNumber]);

  const fetchOrder = async (orderNum: number) => {
    try {
      setLoading(true);
      setError(null);
      const data = await ordersApi.getOrderById(orderNum);
      setOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch order');
      console.error('Error fetching order:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/orders');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading order...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error || 'Order not found'}</p>
          <button
            onClick={handleBack}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Back to orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold text-gray-900">
                  Order #{order.order_number}
                </h1>
                <StatusBadge status={order.status} />
              </div>
              <p className="text-gray-600 mt-1">{order.order_name}</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center space-x-3">
            <button className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700">
              <FileText className="w-4 h-4" />
              <span>View Forms</span>
            </button>
            <button className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* Order Info Summary */}
        <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Customer:</span>
            <p className="font-medium text-gray-900">{order.customer_name}</p>
          </div>
          <div>
            <span className="text-gray-500">Order Date:</span>
            <p className="font-medium text-gray-900">
              {new Date(order.order_date).toLocaleDateString()}
            </p>
          </div>
          <div>
            <span className="text-gray-500">Due Date:</span>
            <p className="font-medium text-gray-900">
              {order.due_date ? new Date(order.due_date).toLocaleDateString() : 'N/A'}
            </p>
          </div>
          {order.customer_po && (
            <div>
              <span className="text-gray-500">Customer PO:</span>
              <p className="font-medium text-gray-900">{order.customer_po}</p>
            </div>
          )}
        </div>
      </div>

      {/* Progress View */}
      <div className="flex-1 overflow-auto">
        <ProgressView
          orderNumber={order.order_number}
          currentStatus={order.status}
          productionNotes={order.production_notes}
        />
      </div>
    </div>
  );
};

export default OrderDetailsPage;
