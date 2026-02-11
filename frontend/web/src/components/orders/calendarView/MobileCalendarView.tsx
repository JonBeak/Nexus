/**
 * MobileCalendarView Component
 * Compact 3-day calendar view for mobile devices with button navigation
 */

import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, FileText, Send } from 'lucide-react';
import { CalendarOrder, DateColumn } from './types';
import { PAGE_STYLES, MODULE_COLORS } from '../../../constants/moduleColors';
import { getFolderPathSegment } from '../../../utils/pdfUrls';

interface MobileCalendarViewProps {
  dateColumns: DateColumn[];
  overdueOrders: CalendarOrder[];
  showOverdueColumn: boolean;
  viewStartDate: Date;
  showImages?: boolean;
  onNavigate: (direction: 'prev' | 'next' | 'today') => void;
  onCardClick: (order: CalendarOrder) => void;
}

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

// Compact mobile order card
const MobileOrderCard: React.FC<{
  order: CalendarOrder;
  showDaysLate?: boolean;
  showImages?: boolean;
  onClick: () => void;
}> = ({ order, showDaysLate = false, showImages = false, onClick }) => {
  const [imageError, setImageError] = React.useState(false);
  const daysLateDisplay = order.work_days_left !== null && order.work_days_left < 0
    ? `${Math.abs(order.work_days_left).toFixed(0)}d`
    : null;

  // Color based on urgency (blue when complete, orange/red only for incomplete jobs)
  // Hard due time takes highest priority (darker red styling)
  const isComplete = order.progress_percent === 100;
  const hasHardDueTime = !!order.hard_due_date_time;
  const borderColor = isComplete
    ? 'border-l-blue-500 bg-white'
    : hasHardDueTime
      ? 'border-l-red-700 bg-red-200'  // Darker red for hard due time
      : order.work_days_left !== null && order.work_days_left < 0
        ? 'border-l-red-500 bg-red-50'
        : order.work_days_left !== null && order.work_days_left <= 1
          ? 'border-l-orange-500 bg-orange-50'
          : 'border-l-blue-500 bg-white';

  // Get image URL if showing images
  const imageUrl = showImages ? getOrderImageUrl(order) : null;
  const hasImage = imageUrl && !imageError;

  return (
    <div
      className={`mb-1.5 rounded shadow-sm cursor-pointer active:bg-gray-100 border-l-4 ${borderColor} min-h-[48px] overflow-hidden`}
      onClick={onClick}
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
      <div className="p-2">
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <div className={`text-xs font-semibold ${PAGE_STYLES.panel.text} break-words leading-tight`}>
            {order.order_name}
          </div>
          <div className={`text-[10px] ${PAGE_STYLES.panel.textMuted} break-words leading-tight mt-0.5`}>
            {order.customer_name || '-'}
          </div>
        </div>
        <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
          <div className="flex items-center gap-1">
            {/* Invoice Status Icons */}
            {order.invoice_sent_at ? (
              <Send className="w-3 h-3 text-green-600" />
            ) : order.qb_invoice_id ? (
              <FileText className="w-3 h-3 text-green-600" />
            ) : null}
            <span className={`text-[10px] font-medium px-1 rounded ${
              order.shipping_required
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-blue-100 text-blue-700'
            }`}>
              {order.shipping_required ? 'Ship' : 'P/U'}
            </span>
          </div>
          {showDaysLate && daysLateDisplay && (
            <span className="text-[10px] text-red-600 font-medium">
              {daysLateDisplay}
            </span>
          )}
        </div>
      </div>
      {/* Progress bar */}
      <div className="mt-1.5 flex items-center gap-1">
        <div className="flex-1 bg-gray-200 rounded-full h-1">
          <div
            className={`h-1 rounded-full ${
              isComplete
                ? 'bg-blue-500'
                : hasHardDueTime
                  ? 'bg-red-700'  // Darker red for hard due time
                  : order.work_days_left !== null && order.work_days_left < 0
                    ? 'bg-red-500'
                    : order.work_days_left !== null && order.work_days_left <= 1
                      ? 'bg-orange-500'
                      : 'bg-blue-500'
            }`}
            style={{ width: `${order.progress_percent}%` }}
          />
        </div>
        <span className="text-[10px] text-gray-500 w-6 text-right">
          {order.progress_percent}%
        </span>
      </div>
      </div>
    </div>
  );
};

// Mobile column component
const MobileColumn: React.FC<{
  headerLabel: string;
  subLabel?: string;
  isToday?: boolean;
  isOverdue?: boolean;
  orders: CalendarOrder[];
  showDaysLate?: boolean;
  showImages?: boolean;
  onCardClick: (order: CalendarOrder) => void;
}> = ({ headerLabel, subLabel, isToday, isOverdue, orders, showDaysLate, showImages, onCardClick }) => {
  const headerClasses = isOverdue
    ? 'bg-red-600 text-white'
    : isToday
      ? `${MODULE_COLORS.orders.base} text-white`
      : `${PAGE_STYLES.header.background} ${PAGE_STYLES.header.text}`;

  return (
    <div className="flex flex-col h-full flex-1 min-w-0">
      {/* Header - fixed height for 3 rows */}
      <div className={`px-1 py-2 text-center border-b ${PAGE_STYLES.panel.border} ${headerClasses}`} style={{ minHeight: '68px' }}>
        <div className="font-semibold text-sm truncate">{headerLabel}</div>
        <div className={`text-xs ${isOverdue || isToday ? 'text-white/80' : PAGE_STYLES.panel.textMuted}`}>
          {subLabel || '\u00A0'}
        </div>
        <div className={`text-xs ${isOverdue || isToday ? 'text-white/70' : PAGE_STYLES.panel.textMuted}`}>
          {orders.length} order{orders.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Orders list */}
      <div className={`flex-1 px-1 py-1 overflow-y-auto ${PAGE_STYLES.panel.background}`}>
        {orders.length === 0 ? (
          <div className={`text-xs ${PAGE_STYLES.panel.textMuted} text-center py-4`}>
            No orders
          </div>
        ) : (
          orders.map(order => (
            <MobileOrderCard
              key={order.order_id}
              order={order}
              showDaysLate={showDaysLate}
              showImages={showImages}
              onClick={() => onCardClick(order)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export const MobileCalendarView: React.FC<MobileCalendarViewProps> = ({
  dateColumns,
  overdueOrders,
  showOverdueColumn,
  viewStartDate,
  showImages = false,
  onNavigate,
  onCardClick
}) => {
  // Get visible columns (max 3 including overdue if showing)
  const visibleColumns = useMemo(() => {
    const cols: Array<{
      key: string;
      headerLabel: string;
      subLabel?: string;
      isToday?: boolean;
      isOverdue?: boolean;
      orders: CalendarOrder[];
      showDaysLate?: boolean;
    }> = [];

    // Add overdue column if showing
    if (showOverdueColumn && overdueOrders.length > 0) {
      cols.push({
        key: 'overdue',
        headerLabel: 'OVERDUE',
        subLabel: undefined,
        isOverdue: true,
        orders: overdueOrders,
        showDaysLate: true
      });
    }

    // Fill remaining slots with date columns (up to 3 total, or 2 if overdue is showing)
    const maxDateCols = showOverdueColumn && overdueOrders.length > 0 ? 2 : 3;
    const dateCols = dateColumns.slice(0, maxDateCols);

    dateCols.forEach(col => {
      cols.push({
        key: col.dateKey,
        headerLabel: col.displayLabel,
        subLabel: col.dayOfWeek,
        isToday: col.isToday,
        orders: col.orders
      });
    });

    return cols;
  }, [dateColumns, overdueOrders, showOverdueColumn]);

  // Format date range for header
  const dateRangeText = useMemo(() => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return viewStartDate.toLocaleDateString('en-US', options);
  }, [viewStartDate]);

  return (
    <div className="flex flex-col h-full">
      {/* Calendar Grid - 3 columns */}
      <div className={`flex-1 flex ${PAGE_STYLES.panel.background} overflow-hidden`}>
        {visibleColumns.map((col, index) => (
          <div
            key={col.key}
            className={`flex-1 ${index < visibleColumns.length - 1 ? `border-r ${PAGE_STYLES.panel.border}` : ''} ${
              col.isOverdue ? 'bg-red-50' : ''
            }`}
          >
            <MobileColumn
              headerLabel={col.headerLabel}
              subLabel={col.subLabel}
              isToday={col.isToday}
              isOverdue={col.isOverdue}
              orders={col.orders}
              showDaysLate={col.showDaysLate}
              showImages={showImages}
              onCardClick={onCardClick}
            />
          </div>
        ))}

        {/* Empty state */}
        {visibleColumns.length === 0 && (
          <div className={`flex-1 flex items-center justify-center ${PAGE_STYLES.panel.textMuted} p-4 text-center`}>
            No upcoming dates with orders
          </div>
        )}
      </div>

      {/* Navigation Footer */}
      <div className={`${PAGE_STYLES.panel.background} border-t ${PAGE_STYLES.panel.border} px-3 py-2`}>
        <div className="flex items-center gap-2">
          {/* Date label */}
          <span className={`text-sm font-medium ${PAGE_STYLES.panel.text}`}>
            From {dateRangeText}
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Today button */}
          <button
            onClick={() => onNavigate('today')}
            className={`px-3 py-2 rounded-lg ${MODULE_COLORS.orders.base} text-white text-sm font-medium min-h-[44px] active:opacity-80`}
          >
            Today
          </button>

          {/* Prev button */}
          <button
            onClick={() => onNavigate('prev')}
            className={`p-2 rounded-lg ${PAGE_STYLES.header.background} hover:bg-gray-300 active:bg-gray-400 min-w-[44px] min-h-[44px] flex items-center justify-center`}
            aria-label="Previous days"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Next button */}
          <button
            onClick={() => onNavigate('next')}
            className={`p-2 rounded-lg ${PAGE_STYLES.header.background} hover:bg-gray-300 active:bg-gray-400 min-w-[44px] min-h-[44px] flex items-center justify-center`}
            aria-label="Next days"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileCalendarView;
