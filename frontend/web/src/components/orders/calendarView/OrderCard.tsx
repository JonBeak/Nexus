/**
 * OrderCard Component
 * Displays a single order in the calendar view as a clickable card
 */

import React, { useState } from 'react';
import { FileText, Send } from 'lucide-react';
import { CalendarOrder, ProgressColor } from './types';
import { getProgressColor } from './utils';
import { PAGE_STYLES } from '../../../constants/moduleColors';
import { getFolderPathSegment } from '../../../utils/pdfUrls';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

type FolderLocation = 'active' | 'finished' | 'cancelled' | 'hold' | 'none';

/**
 * Get image URL for order
 */
const getOrderImageUrl = (order: {
  sign_image_path?: string;
  folder_name?: string;
  folder_location?: FolderLocation;
  is_migrated?: boolean;
}): string | null => {
  const { sign_image_path, folder_name, folder_location, is_migrated } = order;

  if (!sign_image_path || !folder_name || folder_location === 'none') return null;

  const serverUrl = API_BASE_URL.replace(/\/api$/, '');
  const basePath = `${serverUrl}/order-images`;
  const encodedFolder = encodeURIComponent(folder_name);
  const encodedFile = encodeURIComponent(sign_image_path);

  // Get folder path segment based on location (active, finished, cancelled, hold)
  const pathSegment = getFolderPathSegment(folder_location, is_migrated);
  return `${basePath}/${pathSegment}${encodedFolder}/${encodedFile}`;
};

interface OrderCardProps {
  order: CalendarOrder;
  showDaysLate?: boolean;
  showImages?: boolean;
  onCardClick: (order: CalendarOrder) => void;
}

const colorClasses: Record<ProgressColor, { border: string; bg: string; progress: string }> = {
  darkred: {
    border: 'border-l-red-700',
    bg: 'bg-red-200',
    progress: 'bg-red-700'
  },
  red: {
    border: 'border-l-red-500',
    bg: 'bg-red-100',
    progress: 'bg-red-500'
  },
  yellow: {
    border: 'border-l-orange-500',
    bg: 'bg-orange-50',
    progress: 'bg-orange-500'
  },
  green: {
    border: 'border-l-blue-500',
    bg: 'bg-white',
    progress: 'bg-blue-500'
  }
};

export const OrderCard: React.FC<OrderCardProps> = ({ order, showDaysLate = false, showImages = false, onCardClick }) => {
  const [imageError, setImageError] = useState(false);
  const hasHardDueTime = !!order.hard_due_date_time;
  const progressColor = getProgressColor(order.work_days_left, order.progress_percent, hasHardDueTime, order.status);
  const colors = colorClasses[progressColor];

  const handleClick = () => {
    onCardClick(order);
  };

  // Format days late display
  const daysLateDisplay = order.work_days_left !== null && order.work_days_left < 0
    ? `${Math.abs(order.work_days_left).toFixed(1)}d late`
    : null;

  // Get image URL if showing images
  const imageUrl = showImages ? getOrderImageUrl(order) : null;
  const hasImage = imageUrl && !imageError;

  return (
    <div
      className={`
        mb-1.5 md:mb-1 rounded shadow-sm cursor-pointer
        hover:shadow-md active:bg-gray-100 transition-shadow
        border-l-4 ${colors.border} ${colors.bg}
        min-h-[48px] md:min-h-0 overflow-hidden
      `}
      onClick={handleClick}
      title={`Order #${order.order_number} - ${order.customer_name || 'Unknown'}`}
    >
      {/* Order Image - only shown when showImages is true and image exists */}
      {hasImage && (
        <div className="w-full bg-gray-100 flex items-center justify-center">
          <img
            src={imageUrl}
            alt={order.order_name}
            className="w-full h-auto object-contain"
            style={{ maxHeight: '60px' }}
            onError={() => setImageError(true)}
            draggable={false}
          />
        </div>
      )}

      {/* Card Content */}
      <div className="p-2 md:p-1.5">
      {/* Order Name - Primary */}
      <div className={`text-sm font-bold ${PAGE_STYLES.panel.text} break-words flex items-center gap-1`}>
        {order.order_name}
        {hasHardDueTime && order.hard_due_date_time && (
          <span className="text-xs font-semibold text-red-700 bg-red-100 px-1 rounded">
            {(() => {
              const [h, m] = order.hard_due_date_time!.split(':').map(Number);
              const ampm = h >= 12 ? 'PM' : 'AM';
              const hour12 = h % 12 || 12;
              return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
            })()}
          </span>
        )}
      </div>

      {/* Customer Name + Icons */}
      <div className="flex items-center gap-1">
        <span className={`text-xs ${PAGE_STYLES.header.text} truncate flex-1`}>
          {order.customer_name || '-'}
        </span>
        {/* Invoice Status Icons */}
        {order.invoice_sent_at ? (
          <Send className="w-3 h-3 text-green-600 flex-shrink-0" title="Invoice Sent" />
        ) : order.qb_invoice_id ? (
          <FileText className="w-3 h-3 text-green-600 flex-shrink-0" title="Invoice Linked" />
        ) : null}
        <span className={`text-[10px] font-medium px-1 py-0.5 rounded ${
          order.shipping_required
            ? 'bg-yellow-100 text-yellow-700'
            : 'bg-blue-100 text-blue-700'
        }`}>
          {order.shipping_required ? 'Ship' : 'Pickup'}
        </span>
      </div>

      {/* Order Number */}
      <div className={`text-xs ${PAGE_STYLES.panel.textMuted}`}>
        #{order.order_number}
      </div>

      {/* Progress Bar */}
      <div className="mt-1 flex items-center space-x-1">
        <div className={`flex-1 ${PAGE_STYLES.header.background} rounded-full h-1`}>
          <div
            className={`h-1 rounded-full ${colors.progress}`}
            style={{ width: `${order.progress_percent}%` }}
          />
        </div>
        <span className={`text-xs ${PAGE_STYLES.panel.textMuted} w-7 text-right`}>
          {order.progress_percent}%
        </span>
      </div>

      {/* Days late (for overdue column) */}
      {showDaysLate && daysLateDisplay && (
        <div className="text-xs text-red-600 font-medium">
          {daysLateDisplay}
        </div>
      )}
      </div>
    </div>
  );
};

export default OrderCard;
