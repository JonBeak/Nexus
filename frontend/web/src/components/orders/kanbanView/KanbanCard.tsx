/**
 * KanbanCard - Draggable order card for the Kanban board
 * Shows order image, info, progress bar, and expandable tasks
 *
 * Updated: 2025-01-15 - Added manager session modal support
 */

import React, { useState, useEffect, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Calendar, Paintbrush } from 'lucide-react';
import { KanbanCardProps, getProgressColor, PROGRESS_BAR_COLORS } from './types';
import { KanbanCardTasks } from './KanbanCardTasks';
import { ordersApi, orderTasksApi } from '../../../services/api';
import { staffTasksApi } from '../../../services/api/staff/staffTasksApi';
import { OrderTask, OrderPart } from '../../../types/orders';
import { PAGE_STYLES } from '../../../constants/moduleColors';
import SessionsModal from '../../staff/SessionsModal';
import { useAuth } from '../../../contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface ExtendedKanbanCardProps extends KanbanCardProps {
  isDragOverlay?: boolean;
  expanded?: boolean;
  onToggleExpanded: () => void;
}

/**
 * Get image URL for order
 */
const getOrderImageUrl = (order: {
  sign_image_path?: string;
  folder_name?: string;
  folder_location?: 'active' | 'finished' | 'none';
  is_migrated?: boolean;
}): string | null => {
  const { sign_image_path, folder_name, folder_location, is_migrated } = order;

  if (!sign_image_path || !folder_name || folder_location === 'none') return null;

  const serverUrl = API_BASE_URL.replace(/\/api$/, '');
  const basePath = `${serverUrl}/order-images`;
  const encodedFolder = encodeURIComponent(folder_name);
  const encodedFile = encodeURIComponent(sign_image_path);

  if (is_migrated) {
    return folder_location === 'active'
      ? `${basePath}/${encodedFolder}/${encodedFile}`
      : `${basePath}/1Finished/${encodedFolder}/${encodedFile}`;
  } else {
    return folder_location === 'active'
      ? `${basePath}/Orders/${encodedFolder}/${encodedFile}`
      : `${basePath}/Orders/1Finished/${encodedFolder}/${encodedFile}`;
  }
};

export const KanbanCard: React.FC<ExtendedKanbanCardProps> = ({
  order,
  onClick,
  onOrderUpdated,
  onToggleExpanded,
  isDragOverlay = false,
  expanded = false,
  disableDrag = false,
  showPaintingBadge = false
}) => {
  // Get user data from context (no API call needed!)
  const { userId: currentUserId, userRole, isManager } = useAuth();

  const [parts, setParts] = useState<OrderPart[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [tasksFetched, setTasksFetched] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageMaxHeight, setImageMaxHeight] = useState<number | undefined>(undefined);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Session modal state
  const [sessionsModalTask, setSessionsModalTask] = useState<{
    taskId: number;
    taskRole: string | null;
  } | null>(null);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `order-${order.order_id}`,
    data: {
      orderNumber: order.order_number,
      currentStatus: order.status
    },
    disabled: disableDrag
  });

  const style = transform && !isDragOverlay
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1
      }
    : undefined;

  // Fetch parts with tasks when expanded for the first time
  useEffect(() => {
    if (expanded && !tasksFetched && !loadingTasks) {
      const fetchTasks = async () => {
        setLoadingTasks(true);
        try {
          const result = await ordersApi.getOrderWithParts(order.order_number);
          // Filter to parent parts with tasks
          const partsWithTasks = (result.parts || []).filter(
            p => p.is_parent && p.tasks && p.tasks.length > 0
          );
          setParts(partsWithTasks);
          setTasksFetched(true);
        } catch (err) {
          console.error('Error fetching tasks:', err);
        } finally {
          setLoadingTasks(false);
        }
      };
      fetchTasks();
    }
  }, [expanded, tasksFetched, loadingTasks, order.order_number]);

  // Calculate max image height based on container width (golden ratio: height = width / 1.618)
  useEffect(() => {
    const container = imageContainerRef.current;
    if (!container) return;

    const updateMaxHeight = () => {
      const width = container.offsetWidth;
      if (width > 0) {
        setImageMaxHeight(width / 1.618);
      }
    };

    updateMaxHeight();

    const resizeObserver = new ResizeObserver(updateMaxHeight);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  // Calculate urgency color (blue if complete, orange/red only for incomplete jobs)
  const progressColor = getProgressColor(order.work_days_left, order.progress_percent);

  // Format due date
  const formatDueDate = () => {
    if (!order.due_date) return 'No date';
    // Parse as local date (avoid timezone shift by appending T00:00:00)
    const dateOnly = order.due_date.split('T')[0];
    const dueDate = new Date(dateOnly + 'T00:00:00');
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const dateStr = dueDate.toLocaleDateString('en-US', options);

    if (order.work_days_left === null) return dateStr;
    if (order.work_days_left === 0) return `${dateStr} (today)`;
    if (order.work_days_left < 0) return `${dateStr} (${order.work_days_left}d)`;
    return `${dateStr} (${order.work_days_left}d)`;
  };

  // Helper to update task in parts
  const updateTaskInParts = (taskId: number, updates: Partial<OrderTask>) => {
    setParts(prev => prev.map(part => ({
      ...part,
      tasks: part.tasks?.map(t =>
        t.task_id === taskId ? { ...t, ...updates } : t
      )
    })));
  };

  // Session modal handlers
  const handleOpenSessionsModal = (taskId: number, taskRole: string | null) => {
    setSessionsModalTask({ taskId, taskRole });
  };

  const handleCloseSessionsModal = () => {
    setSessionsModalTask(null);
  };

  const handleSessionChange = () => {
    // Refresh tasks when sessions change
    setTasksFetched(false);
    onOrderUpdated();
  };

  // Task action handlers
  const handleTaskStart = async (taskId: number) => {
    // For non-managers, use session-based start (via staffTasksApi)
    updateTaskInParts(taskId, { started_at: new Date().toISOString() });
    try {
      await staffTasksApi.startTask(taskId);
      onOrderUpdated();
    } catch (err) {
      console.error('Error starting task:', err);
      setTasksFetched(false);
    }
  };

  const handleTaskComplete = async (taskId: number) => {
    updateTaskInParts(taskId, { completed: true, completed_at: new Date().toISOString() });
    try {
      await orderTasksApi.batchUpdateTasks([{ task_id: taskId, completed: true }]);
      onOrderUpdated();
    } catch (err) {
      console.error('Error completing task:', err);
      setTasksFetched(false);
    }
  };

  const handleTaskUncomplete = async (taskId: number) => {
    updateTaskInParts(taskId, { completed: false, completed_at: undefined });
    try {
      await orderTasksApi.batchUpdateTasks([{ task_id: taskId, completed: false }]);
      onOrderUpdated();
    } catch (err) {
      console.error('Error uncompleting task:', err);
      setTasksFetched(false);
    }
  };

  const handleTaskUnstart = async (taskId: number) => {
    // For non-managers, use session-based stop (via staffTasksApi)
    updateTaskInParts(taskId, { started_at: undefined });
    try {
      await staffTasksApi.stopTask(taskId);
      onOrderUpdated();
    } catch (err) {
      console.error('Error un-starting task:', err);
      setTasksFetched(false);
    }
  };

  const imageUrl = getOrderImageUrl(order);
  const hasImage = imageUrl && !imageError;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      data-kanban-card
      onClick={(e) => {
        if (!isDragging && !(e.target as HTMLElement).closest('.task-controls')) {
          onClick();
        }
      }}
      className={`
        ${order.invoice_sent_at ? 'bg-emerald-300' : PAGE_STYLES.input.background}
        rounded-lg border ${order.invoice_sent_at ? 'border-emerald-500' : PAGE_STYLES.panel.border}
        shadow-sm hover:shadow-md transition-shadow select-none
        ${disableDrag ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'} overflow-hidden touch-manipulation
        ${isDragging ? 'ring-2 ring-orange-400' : ''}
        ${isDragOverlay ? 'shadow-lg rotate-2' : ''}
      `}
    >
      {/* Image at top - only if image exists */}
      {/* Max height is golden ratio of width (width / 1.618) calculated via ResizeObserver */}
      <div ref={imageContainerRef} className={`w-full bg-gray-100 flex items-center justify-center ${hasImage ? '' : 'hidden'}`}>
        {hasImage && (
          <img
            src={imageUrl}
            alt={order.order_name}
            className="max-w-full h-auto object-contain"
            style={imageMaxHeight ? { maxHeight: `${imageMaxHeight}px` } : undefined}
            onError={() => setImageError(true)}
            draggable={false}
          />
        )}
      </div>

      {/* Card Body */}
      <div className="px-3 py-2">
        {/* Job name */}
        <p className={`text-sm font-semibold ${PAGE_STYLES.panel.text} truncate`}>
          {order.order_name || `#${order.order_number}`}
        </p>

        {/* Customer name + Painting badge + Shipping/Pickup label */}
        <div className="flex items-center gap-1.5 mt-0.5">
          <p className={`text-xs ${PAGE_STYLES.panel.textMuted} truncate flex-1 min-w-0`}>
            {order.customer_name || 'Unknown Customer'}
          </p>
          {/* Painting badge - shown when card is in Painting column */}
          {showPaintingBadge && (order.incomplete_painting_tasks_count || 0) > 0 && (
            <span className="text-[10px] font-medium px-1 py-0.5 rounded flex-shrink-0 bg-purple-100 text-purple-700 flex items-center gap-0.5">
              <Paintbrush className="w-3 h-3" />
              {order.incomplete_painting_tasks_count}
            </span>
          )}
          <span className={`text-[10px] font-medium px-1 py-0.5 rounded flex-shrink-0 ${
            order.shipping_required
              ? 'bg-blue-100 text-blue-700'
              : 'bg-yellow-100 text-yellow-700'
          }`}>
            {order.shipping_required ? 'Ship' : 'Pickup'}
          </span>
        </div>

        {/* Progress & Due Date row */}
        <div className="flex items-center gap-2 pt-1.5">
          {/* Progress bar - clickable to toggle tasks for whole board */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpanded();
            }}
            className="flex items-center gap-1.5 hover:bg-gray-100 rounded px-1 -ml-1 py-0.5 transition-colors min-w-0 flex-shrink"
          >
            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
              <div
                className={`h-full rounded-full transition-all ${PROGRESS_BAR_COLORS[progressColor]}`}
                style={{ width: `${order.progress_percent}%` }}
              />
            </div>
            <span className={`text-xs ${PAGE_STYLES.panel.textMuted} whitespace-nowrap truncate`}>
              {order.progress_percent}% ({order.completed_tasks || 0}/{order.total_tasks || 0})
            </span>
          </button>

          {/* Due date badge */}
          <div className={`flex items-center gap-1 flex-shrink-0 ml-auto ${PAGE_STYLES.panel.background} rounded px-1.5 py-0.5`}>
            <Calendar className={`w-3 h-3 flex-shrink-0 ${
              progressColor === 'red' ? 'text-red-500' :
              progressColor === 'yellow' ? 'text-orange-600' :
              'text-gray-400'
            }`} />
            <span className={`text-xs whitespace-nowrap ${
              progressColor === 'red' ? 'text-red-600 font-medium' :
              progressColor === 'yellow' ? 'text-orange-600 font-medium' :
              PAGE_STYLES.panel.textMuted
            }`}>
              {formatDueDate()}
            </span>
          </div>
        </div>
      </div>

      {/* Expandable Tasks - only show if loading OR if there are tasks */}
      {expanded && (loadingTasks || parts.length > 0) && (
        <KanbanCardTasks
          parts={parts}
          loading={loadingTasks}
          onTaskStart={handleTaskStart}
          onTaskComplete={handleTaskComplete}
          onTaskUncomplete={handleTaskUncomplete}
          onTaskUnstart={handleTaskUnstart}
          isManager={isManager}
          onOpenSessionsModal={isManager ? handleOpenSessionsModal : undefined}
        />
      )}

      {/* Sessions Modal for managers */}
      {sessionsModalTask && currentUserId && (
        <SessionsModal
          taskId={sessionsModalTask.taskId}
          taskRole={sessionsModalTask.taskRole}
          isOpen={true}
          onClose={handleCloseSessionsModal}
          currentUserId={currentUserId}
          isManager={isManager}
          onSessionChange={handleSessionChange}
          taskCompleted={parts.flatMap(p => p.tasks || []).find(t => t.task_id === sessionsModalTask.taskId)?.completed}
          onComplete={(taskId) => handleTaskComplete(taskId)}
        />
      )}
    </div>
  );
};

export default KanbanCard;
