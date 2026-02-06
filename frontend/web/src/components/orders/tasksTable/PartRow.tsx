/**
 * PartRow Component
 * Renders a single order part row with selection, order/part info, due date, and task cells
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PartWithTasks, PartTask } from './types';
import TaskCell from './TaskCell';
import { OrderStatus } from '../../../types/orders';
import { PAGE_STYLES, MODULE_COLORS } from '../../../constants/moduleColors';
import { formatDate } from '../../../utils/dateUtils';

interface Props {
  part: PartWithTasks;
  taskColumns: string[];  // List of column keys: "TaskName" or "TaskName#1", "TaskName#2", etc.
  onTaskToggle: (taskId: number, completed: boolean) => void;
  onStatusClick: (orderNumber: number, orderName: string, currentStatus: OrderStatus) => void;
  isMobile: boolean;
}

// Parse column key to get base task name and optional index
// "TaskName" -> { baseName: "TaskName", index: 0 }
// "TaskName#2" -> { baseName: "TaskName", index: 1 } (0-indexed)
const parseColumnKey = (columnKey: string): { baseName: string; index: number } => {
  const hashIndex = columnKey.lastIndexOf('#');
  if (hashIndex > 0) {
    const suffix = columnKey.slice(hashIndex + 1);
    if (/^\d+$/.test(suffix)) {
      return {
        baseName: columnKey.slice(0, hashIndex),
        index: parseInt(suffix, 10) - 1  // Convert 1-indexed to 0-indexed
      };
    }
  }
  return { baseName: columnKey, index: 0 };
};

export const PartRow: React.FC<Props> = ({
  part,
  taskColumns,
  onTaskToggle,
  onStatusClick,
  isMobile
}) => {
  const navigate = useNavigate();

  const handleOrderClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/orders/${part.orderNumber}`);
  };

  // Format time from HH:MM:SS to 12-hour AM/PM format
  const formatTime = (timeString: string | null) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Format status for display
  const formatStatus = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      'production_queue': { label: 'Production Queue', color: 'bg-blue-100 text-blue-800' },
      'in_production': { label: 'In Production', color: 'bg-green-100 text-green-800' },
      'overdue': { label: 'Overdue', color: 'bg-red-100 text-red-800' },
      'qc_packing': { label: 'QC & Packing', color: 'bg-purple-100 text-purple-800' }
    };
    return statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
  };

  // Check if this is a hard due date (has time set)
  const isHardDue = !!part.hardDueTime;
  const statusInfo = formatStatus(part.orderStatus);

  // Build display text
  // Line 1: Order number: Order Name
  const line1 = `${part.orderNumber}: ${part.orderName}`;
  // Line 2: Part Type (: Scope, optional)
  const partType = part.specsDisplayName || part.productType;
  const line2 = part.scope ? `${partType}: ${part.scope}` : partType;
  // Line 3: Customer
  const line3 = part.customerName || '';

  // Group tasks by taskName for positional lookup
  // Each task type maps to an array of tasks (in order they appear)
  const tasksByName = new Map<string, PartTask[]>();
  for (const task of part.tasks) {
    if (task.taskName) {
      const existing = tasksByName.get(task.taskName) || [];
      existing.push(task);
      tasksByName.set(task.taskName, existing);
    }
  }

  return (
    <tr className={`border-b ${PAGE_STYLES.panel.border} group`}>
      {/* Order / Part - Three line display: Order#: Name / Part Type: Scope / Customer - always sticky */}
      <td
        className={`px-2 py-1 border-r ${PAGE_STYLES.panel.border} overflow-hidden sticky z-10 group-hover:!bg-gray-50`}
        style={{ left: 0, width: isMobile ? '140px' : '280px', backgroundColor: 'var(--theme-panel-bg)' }}
      >
        <div className={isMobile ? 'break-words whitespace-normal' : 'truncate'}>
          <a
            href={`/orders/${part.orderNumber}`}
            onClick={handleOrderClick}
            className={`text-sm font-medium ${PAGE_STYLES.panel.text} hover:text-orange-500 cursor-pointer`}
          >
            {line1}
          </a>
        </div>
        <div className={`text-xs ${PAGE_STYLES.panel.textMuted} ${isMobile ? 'break-words whitespace-normal' : 'truncate'}`}>
          {line2}
        </div>
        {line3 && (
          <div className={`text-xs ${PAGE_STYLES.panel.textMuted} ${isMobile ? 'break-words whitespace-normal' : 'truncate'} opacity-70`}>
            {line3}
          </div>
        )}
      </td>

      {/* Status column - clickable to change - sticky on desktop only */}
      <td
        className={`px-1 py-1 whitespace-nowrap text-center border-r ${PAGE_STYLES.panel.border} ${isMobile ? '' : 'sticky z-10'} group-hover:!bg-gray-50`}
        style={isMobile ? { width: '120px', backgroundColor: 'var(--theme-panel-bg)' } : { left: '280px', width: '120px', backgroundColor: 'var(--theme-panel-bg)' }}
      >
        <button
          onClick={() => onStatusClick(part.orderNumber, part.orderName, part.orderStatus)}
          className={`inline-block px-2 py-1 text-xs font-medium rounded cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-orange-400 transition-all ${statusInfo.color}`}
          title="Click to change status"
        >
          {statusInfo.label}
        </button>
      </td>

      {/* Due Date (Day, Mon d format) - red background if hard due - sticky on desktop only */}
      <td
        className={`px-1 py-1 whitespace-nowrap text-xs border-r ${PAGE_STYLES.panel.border} text-center ${isMobile ? '' : 'sticky z-10'} ${
          isHardDue ? 'text-red-800 font-semibold' : `group-hover:!bg-gray-50 ${PAGE_STYLES.panel.textMuted}`
        }`}
        style={isMobile
          ? { width: '80px', backgroundColor: isHardDue ? '#fee2e2' : 'var(--theme-panel-bg)' }
          : { left: '400px', width: '80px', backgroundColor: isHardDue ? '#fee2e2' : 'var(--theme-panel-bg)' }}
      >
        {formatDate(part.dueDate)}
      </td>

      {/* Hard Due Time - red background if set - sticky on desktop only */}
      <td
        className={`px-1 py-1 whitespace-nowrap text-xs text-center border-r ${PAGE_STYLES.panel.border} ${isMobile ? '' : 'sticky z-10'} ${
          isHardDue ? 'text-red-800 font-semibold' : `group-hover:!bg-gray-50 ${PAGE_STYLES.panel.textMuted}`
        }`}
        style={isMobile
          ? { width: '64px', backgroundColor: isHardDue ? '#fee2e2' : 'var(--theme-panel-bg)' }
          : { left: '480px', width: '64px', backgroundColor: isHardDue ? '#fee2e2' : 'var(--theme-panel-bg)' }}
      >
        {isHardDue ? formatTime(part.hardDueTime) : '-'}
      </td>

      {/* Task cells - one per visible task column (positional lookup) */}
      {taskColumns.map((columnKey) => {
        const { baseName, index } = parseColumnKey(columnKey);
        const tasksForType = tasksByName.get(baseName) || [];
        const task = tasksForType[index];  // undefined if index out of bounds (N/A)
        return (
          <TaskCell
            key={columnKey}
            task={task}
            onToggle={onTaskToggle}
          />
        );
      })}
    </tr>
  );
};

export default PartRow;
