import React, { useState, useEffect } from 'react';
import { Play, Check } from 'lucide-react';
import { ordersApi } from '../../../services/api';
import type { UserRole } from '../../../types/user';
import { PAGE_STYLES, MODULE_COLORS } from '../../../constants/moduleColors';

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
    // Toggle started state (independent of completed)
    onUpdate(task.task_id, 'started', !isStarted, originalStarted, originalCompleted);
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
      className={`border rounded p-2 transition-all relative ${
        hasChanges
          ? 'border-orange-400 bg-orange-50'
          : `${PAGE_STYLES.panel.border} ${PAGE_STYLES.panel.background} ${PAGE_STYLES.interactive.hover}`
      }`}
    >
      {/* Small icon-only buttons (top-right corner of card) */}
      <div className="absolute top-1.5 right-1 flex items-center space-x-1">
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

      {/* Order info row */}
      <div className={`text-sm ${PAGE_STYLES.panel.text} truncate pr-14 mb-1`} title={orderDisplay}>
        {orderDisplay}
      </div>

      {/* Product Type [Scope] + Task name */}
      <div className={`text-xs ${PAGE_STYLES.panel.text} ${PAGE_STYLES.header.background} px-1.5 py-0.5 rounded mb-1 flex items-center justify-between gap-1`}>
        <span className="truncate" title={productDisplay}>{productDisplay}</span>
        <span className={`${PAGE_STYLES.header.text} flex-shrink-0`}>{task.task_name}</span>
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
          className={`w-full text-xs px-2 py-1 border ${PAGE_STYLES.panel.border} rounded
            focus:outline-none focus:ring-1 focus:ring-orange-400 focus:border-orange-400
            ${PAGE_STYLES.input.placeholder} ${savingNotes ? PAGE_STYLES.header.background : PAGE_STYLES.panel.background}`}
        />
        {savingNotes && (
          <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs ${PAGE_STYLES.panel.textMuted}`}>
            Saving...
          </span>
        )}
      </div>

      {/* Show timestamps if completed */}
      {showCompleted && task.completed_at && (
        <div className={`mt-2 text-xs ${PAGE_STYLES.panel.textMuted}`}>
          Completed: {new Date(task.completed_at).toLocaleString()}
        </div>
      )}
    </div>
  );
};

export default TaskChecklistItem;
