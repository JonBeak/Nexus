import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Construction } from 'lucide-react';
import { PAGE_STYLES } from '../../constants/moduleColors';

/**
 * Placeholder page for order details
 * Phase 1.f will implement the full order details and progress tracking UI
 */
export const OrderDetailsPlaceholder: React.FC = () => {
  const navigate = useNavigate();
  const { orderId } = useParams();

  return (
    <div className={PAGE_STYLES.fullPage}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/orders')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Order Details</h1>
            <p className="text-sm text-gray-600 mt-1">Order ID: {orderId}</p>
          </div>
        </div>
      </div>

      {/* Coming Soon Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-12 text-center">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Construction className="w-10 h-10 text-yellow-600" />
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mb-4">Coming Soon</h2>
          <p className="text-lg text-gray-600 mb-6">
            Order details and progress tracking will be available in Phase 1.f
          </p>

          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-8">
            <h3 className="font-semibold text-blue-900 mb-3">Phase 1.f will include:</h3>
            <ul className="text-left text-blue-800 space-y-2 max-w-md mx-auto">
              <li>• Complete order information display</li>
              <li>• Task list organized by part</li>
              <li>• Progress tracking with checkboxes</li>
              <li>• Status updates</li>
              <li>• Timeline and history view</li>
              <li>• Production notes</li>
            </ul>
          </div>

          <button
            onClick={() => navigate('/orders')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors shadow-lg"
          >
            Back to Orders Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailsPlaceholder;
