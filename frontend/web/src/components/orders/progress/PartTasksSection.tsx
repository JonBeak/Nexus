import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Package } from 'lucide-react';
import TaskList from './TaskList';

interface Props {
  part: any;
  orderNumber: number;
  onTaskUpdated: () => void;
}

export const PartTasksSection: React.FC<Props> = ({ part, orderNumber, onTaskUpdated }) => {
  const [expanded, setExpanded] = useState(true);

  const completedTasks = part.completed_tasks || 0;
  const totalTasks = part.total_tasks || 0;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center space-x-3">
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
          <Package className="w-5 h-5 text-indigo-600" />
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">
              Part {part.part_number}: {part.product_type}
            </h3>
            <p className="text-sm text-gray-500">
              Quantity: {part.quantity}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900">
              {completedTasks} / {totalTasks} Tasks
            </div>
            <div className="text-xs text-gray-500">{progressPercent}% Complete</div>
          </div>
          <div className="w-32">
            <div className="bg-gray-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </button>

      {/* Task List */}
      {expanded && (
        <div className="border-t border-gray-200 px-6 py-4">
          <TaskList
            tasks={part.tasks || []}
            orderNumber={orderNumber}
            onTaskUpdated={onTaskUpdated}
          />
        </div>
      )}
    </div>
  );
};

export default PartTasksSection;
