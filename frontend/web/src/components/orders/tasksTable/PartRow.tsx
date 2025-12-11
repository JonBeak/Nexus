/**
 * PartRow Component
 * Renders a single order part row with selection, order/part info, due date, and task cells
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PartWithTasks, PartTask } from './types';
import TaskCell from './TaskCell';
import { OrderStatus } from '../../../types/orders';

interface Props {
  part: PartWithTasks;
  taskColumns: string[];  // List of all visible task keys (taskName or taskName|notes) in order
  taskTypesNeedingSplit: Set<string>;  // Task types that need composite keys
  onTaskToggle: (taskId: number, completed: boolean) => void;
  onStatusClick: (orderNumber: number, orderName: string, currentStatus: OrderStatus) => void;
}

export const PartRow: React.FC<Props> = ({
  part,
  taskColumns,
  taskTypesNeedingSplit,
  onTaskToggle,
  onStatusClick
}) => {
  const navigate = useNavigate();

  const handleOrderClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/orders/${part.orderNumber}`);
  };

  // Format date as 'Day, Mon d' (e.g., "Mon, Dec 15")
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
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

  // Create a map for task lookup
  // For task types that need splitting: use composite key (taskKey)
  // For task types that don't need splitting: use just taskName
  const taskMap = new Map<string, PartTask>();
  for (const task of part.tasks) {
    if (taskTypesNeedingSplit.has(task.taskName)) {
      // This task type needs splitting - use composite key
      const key = task.taskKey || task.taskName;
      if (key) taskMap.set(key, task);
    } else {
      // This task type doesn't need splitting - use just task name
      if (task.taskName) taskMap.set(task.taskName, task);
    }
  }

  return (
    <tr className="border-b border-gray-300 group">
      {/* Order / Part - Three line display: Order#: Name / Part Type: Scope / Customer - sticky, fixed width */}
      <td
        className="px-2 py-1 border-r border-gray-300 overflow-hidden sticky z-10 group-hover:!bg-gray-50"
        style={{ left: 0, width: '280px', backgroundColor: '#ffffff' }}
      >
        <div className="truncate">
          <a
            href={`/orders/${part.orderNumber}`}
            onClick={handleOrderClick}
            className="text-sm font-medium text-gray-900 hover:text-blue-400 cursor-pointer"
          >
            {line1}
          </a>
        </div>
        <div className="text-xs text-gray-600 truncate">
          {line2}
        </div>
        {line3 && (
          <div className="text-xs text-gray-400 truncate">
            {line3}
          </div>
        )}
      </td>

      {/* Status column - clickable to change - sticky, fixed width */}
      <td
        className="px-1 py-1 whitespace-nowrap text-center border-r border-gray-300 sticky z-10 group-hover:!bg-gray-50"
        style={{ left: '280px', width: '120px', backgroundColor: '#ffffff' }}
      >
        <button
          onClick={() => onStatusClick(part.orderNumber, part.orderName, part.orderStatus)}
          className={`inline-block px-2 py-1 text-xs font-medium rounded cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-gray-400 transition-all ${statusInfo.color}`}
          title="Click to change status"
        >
          {statusInfo.label}
        </button>
      </td>

      {/* Due Date (Day, Mon d format) - red background if hard due - sticky, fixed width */}
      <td
        className={`px-1 py-1 whitespace-nowrap text-xs border-r border-gray-300 text-center sticky z-10 ${
          isHardDue ? 'text-red-800 font-semibold' : 'group-hover:!bg-gray-50 text-gray-600'
        }`}
        style={{ left: '400px', width: '80px', backgroundColor: isHardDue ? '#fee2e2' : '#ffffff' }}
      >
        {formatDate(part.dueDate)}
      </td>

      {/* Hard Due Time - red background if set - sticky, fixed width */}
      <td
        className={`px-1 py-1 whitespace-nowrap text-xs text-center border-r border-gray-300 sticky z-10 ${
          isHardDue ? 'text-red-800 font-semibold' : 'group-hover:!bg-gray-50 text-gray-400'
        }`}
        style={{ left: '480px', width: '64px', backgroundColor: isHardDue ? '#fee2e2' : '#ffffff' }}
      >
        {isHardDue ? formatTime(part.hardDueTime) : '-'}
      </td>

      {/* Task cells - one per visible task column (using taskKey for lookup) */}
      {taskColumns.map((taskKey) => {
        const task = taskMap.get(taskKey);
        return (
          <TaskCell
            key={taskKey}
            task={task}
            onToggle={onTaskToggle}
          />
        );
      })}
    </tr>
  );
};

export default PartRow;
