import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import TaskList from './TaskList';
import TaskTemplateDropdown from './TaskTemplateDropdown';

interface Props {
  part: any;
  orderNumber: number;
  orderStatus: string;
  onTaskUpdated: () => void;
}

export const PartTasksSection: React.FC<Props> = ({ part, orderNumber, orderStatus, onTaskUpdated }) => {
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const completedTasks = part.completed_tasks || 0;
  const totalTasks = part.total_tasks || 0;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Can only edit tasks during job_details_setup
  const canEditTasks = orderStatus === 'job_details_setup';

  const handleTaskAdded = () => {
    setShowAddDropdown(false);
    onTaskUpdated();
  };

  return (
    <div className="bg-white rounded-lg shadow flex-shrink-0 w-[240px] flex flex-col relative">
      {/* Placeholder Image */}
      <div className="w-full h-32 bg-gray-200 rounded-t-lg flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-sm font-medium">Part Image</div>
          <div className="text-gray-400 text-xs mt-1">Placeholder</div>
        </div>
      </div>

      {/* Compact Header */}
      <div className="px-2 py-1.5 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-base text-gray-900 truncate">
            Part {part.part_number}: {part.product_type}
          </h3>

          {/* Add Task Button */}
          {canEditTasks && (
            <button
              onClick={() => setShowAddDropdown(!showAddDropdown)}
              className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
              title="Add task"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between text-base text-gray-500 mb-1.5">
          <span>Qty: {part.quantity}</span>
          <span className="font-medium">{completedTasks}/{totalTasks}</span>
        </div>
        {/* Progress Bar */}
        <div className="bg-gray-200 rounded-full h-1.5">
          <div
            className="bg-indigo-600 h-1.5 rounded-full transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Task Template Dropdown */}
      {showAddDropdown && (
        <TaskTemplateDropdown
          orderNumber={orderNumber}
          partId={part.part_id}
          existingTasks={part.tasks || []}
          onTaskAdded={handleTaskAdded}
          onClose={() => setShowAddDropdown(false)}
        />
      )}

      {/* Task List - Always Visible */}
      <div className="px-2 py-1.5 flex-1 overflow-y-auto max-h-96">
        <TaskList
          tasks={part.tasks || []}
          orderNumber={orderNumber}
          canRemove={canEditTasks}
          onTaskUpdated={onTaskUpdated}
        />
      </div>
    </div>
  );
};

export default PartTasksSection;
