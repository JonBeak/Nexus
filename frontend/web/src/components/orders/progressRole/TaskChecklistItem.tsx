import React, { useState, useEffect } from 'react';
import { Play, Check } from 'lucide-react';
import { ordersApi } from '../../../services/api';
import type { UserRole } from '../../../types/user';

interface TaskUpdate {
  task_id: number;
  started?: boolean;
  completed?: boolean;
}

interface Props {
  task: any;
  stagedUpdate?: TaskUpdate;
  onUpdate: (taskId: number, field: 'started' | 'completed', value: boolean, originalStarted: boolean, originalCompleted: boolean) => void;
  onNotesUpdate: () => void;
  showCompleted: boolean;
  userRole: UserRole;
}

// Roles that can see customer name (Designer and up)
const ROLES_WITH_CUSTOMER_VIEW: UserRole[] = ['designer', 'manager', 'owner'];

export const TaskChecklistItem: React.FC<Props> = ({
  task,
  stagedUpdate,
  onUpdate,
  onNotesUpdate,
  showCompleted,
  userRole
}) => {
  const [notes, setNotes] = useState(task.task_notes || '');
  const [savingNotes, setSavingNotes] = useState(false);

  // Sync local notes state when task data updates from parent
  useEffect(() => {
    setNotes(task.task_notes || '');
  }, [task.task_notes]);

  // Original database values
  const originalStarted = !!task.started_at;
  const originalCompleted = !!task.completed;

  // Determine current state (staged changes override database values)
  const isStarted = stagedUpdate?.started !== undefined
    ? stagedUpdate.started
    : originalStarted;

  const isCompleted = stagedUpdate?.completed !== undefined
    ? stagedUpdate.completed
    : originalCompleted;

  const hasChanges = stagedUpdate !== undefined;
  const canViewCustomer = ROLES_WITH_CUSTOMER_VIEW.includes(userRole);

  const handleStartToggle = () => {
    if (isCompleted) {
      // Already complete - do nothing (use complete button to uncomplete)
      return;
    }
    if (isStarted) {
      // Started but not complete -> mark as complete
      onUpdate(task.task_id, 'completed', true, originalStarted, originalCompleted);
    } else {
      // Not started -> mark as started
      onUpdate(task.task_id, 'started', true, originalStarted, originalCompleted);
    }
  };

  const handleCompleteToggle = () => {
    // Complete button toggles completion state
    onUpdate(task.task_id, 'completed', !isCompleted, originalStarted, originalCompleted);
  };

  const handleNotesBlur = async () => {
    // Only save if notes have changed
    if (notes === (task.task_notes || '')) return;

    try {
      setSavingNotes(true);
      await ordersApi.updateTaskNotes(task.task_id, notes);
      onNotesUpdate();
    } catch (error) {
      console.error('Error saving notes:', error);
      // Revert to original notes on error
      setNotes(task.task_notes || '');
    } finally {
      setSavingNotes(false);
    }
  };

  // Build order display: "Order Name - Customer Name" (customer visible to Designer+)
  const orderDisplay = canViewCustomer && task.customer_name
    ? `${task.order_name} - ${task.customer_name}`
    : task.order_name;

  // Build product display: "Specs Display Name {Scope}"
  const productName = task.specs_display_name || 'Unknown';
  const productDisplay = task.part_scope
    ? `${productName} [${task.part_scope}]`
    : productName;

  return (
    <div
      className={`border rounded p-2 transition-all ${
        hasChanges
          ? 'border-indigo-400 bg-indigo-50'
          : 'border-gray-200 bg-white hover:bg-gray-50'
      }`}
    >
      {/* Top row: Order info + Start/Complete buttons */}
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-900 truncate" title={orderDisplay}>
            {orderDisplay}
          </div>
        </div>

        {/* Small icon-only buttons (top-right) */}
        <div className="flex items-center space-x-1 flex-shrink-0">
          {/* Start button */}
          <button
            onClick={handleStartToggle}
            title={isStarted ? 'Mark as not started' : 'Mark as started'}
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
              isStarted
                ? 'bg-blue-600 text-white'
                : 'bg-white border-2 border-blue-400 text-blue-400 hover:bg-blue-50'
            }`}
          >
            <Play className="w-3 h-3" style={{ marginLeft: '1px' }} />
          </button>

          {/* Complete button */}
          <button
            onClick={handleCompleteToggle}
            disabled={false}
            title={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
              isCompleted
                ? 'bg-green-600 text-white'
                : 'bg-white border-2 border-green-400 text-green-400 hover:bg-green-50'
            }`}
          >
            <Check className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Product Type [Scope] + Task name */}
      <div className="text-xs text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded mb-1 flex items-center justify-between gap-1">
        <span className="truncate" title={productDisplay}>{productDisplay}</span>
        <span className="text-gray-600 flex-shrink-0">{task.task_name}</span>
      </div>

      {/* Editable task notes */}
      <div className="relative">
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          placeholder="Add note..."
          disabled={savingNotes}
          className={`w-full text-xs px-2 py-1 border border-gray-200 rounded
            focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400
            placeholder:text-gray-400 ${savingNotes ? 'bg-gray-100' : 'bg-white'}`}
        />
        {savingNotes && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
            Saving...
          </span>
        )}
      </div>

      {/* Show timestamps if completed */}
      {showCompleted && task.completed_at && (
        <div className="mt-2 text-xs text-gray-500">
          Completed: {new Date(task.completed_at).toLocaleString()}
        </div>
      )}
    </div>
  );
};

export default TaskChecklistItem;
