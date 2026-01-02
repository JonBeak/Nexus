import React, { useState, useRef, useEffect } from 'react';
import { X, PlayCircle, CheckCircle2 } from 'lucide-react';
import { OrderTask } from '../../../types/orders';
import ConfirmModal from '../progress/ConfirmModal';
import { PAGE_STYLES, MODULE_COLORS } from '../../../constants/moduleColors';

interface TaskRowProps {
  task: OrderTask;

  // Action handlers - called after optimistic UI update
  onStart: () => void;
  onComplete: () => void;
  onUncomplete: () => void;
  onUnstart: () => void;
  onNotesChange: (notes: string) => void;
  onRemove?: () => void;  // Optional - if not provided, no remove button
}

export const TaskRow: React.FC<TaskRowProps> = ({
  task,
  onStart,
  onComplete,
  onUncomplete,
  onUnstart,
  onNotesChange,
  onRemove
}) => {
  // Local optimistic state - mirrors task prop but updates immediately on user action
  const [localTask, setLocalTask] = useState(task);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(task.notes || '');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const notesInputRef = useRef<HTMLInputElement>(null);

  // Sync local state with prop (when parent updates after API response)
  useEffect(() => {
    setLocalTask(task);
  }, [task]);

  // Update local notes value when task.notes changes externally
  useEffect(() => {
    if (!editingNotes) {
      setNotesValue(task.notes || '');
    }
  }, [task.notes, editingNotes]);

  // Optimistic handlers - update local state immediately, then call parent handler
  const handleStart = () => {
    setLocalTask(prev => ({ ...prev, started_at: new Date().toISOString() }));
    onStart();
  };

  const handleComplete = () => {
    setLocalTask(prev => ({ ...prev, completed: true, completed_at: new Date().toISOString() }));
    onComplete();
  };

  const handleUncomplete = () => {
    setLocalTask(prev => ({ ...prev, completed: false, completed_at: undefined }));
    onUncomplete();
  };

  const handleUnstart = () => {
    setLocalTask(prev => ({ ...prev, started_at: undefined }));
    onUnstart();
  };

  // Auto-focus and select notes input when entering edit mode
  useEffect(() => {
    if (editingNotes && notesInputRef.current) {
      notesInputRef.current.focus();
      notesInputRef.current.select();
    }
  }, [editingNotes]);

  const handleSaveNotes = () => {
    setEditingNotes(false);
    // Only call onNotesChange if the value actually changed
    if (notesValue !== (task.notes || '')) {
      onNotesChange(notesValue);
    }
  };

  const handleNotesKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveNotes();
    } else if (e.key === 'Escape') {
      setNotesValue(task.notes || '');
      setEditingNotes(false);
    }
  };

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirmModal(true);
  };

  const handleConfirmRemove = () => {
    setShowConfirmModal(false);
    onRemove?.();
  };

  return (
    <>
      {onRemove && (
        <ConfirmModal
          show={showConfirmModal}
          title="Remove Task"
          message={`Are you sure you want to remove the task "${task.task_name}"?`}
          onConfirm={handleConfirmRemove}
          onCancel={() => setShowConfirmModal(false)}
          confirmText="Remove"
          type="warning"
        />
      )}
      <div className="group relative flex items-center gap-2 px-2 py-1.5 pr-14 rounded text-sm">
        {/* Status icon - clickable to toggle state */}
        <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
          {localTask.completed ? (
            <button
              onClick={handleUncomplete}
              className="hover:opacity-70 transition-opacity"
              title="Mark as not completed"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </button>
          ) : localTask.started_at ? (
            <button
              onClick={handleUnstart}
              className="hover:opacity-70 transition-opacity"
              title="Mark as not started"
            >
              <PlayCircle className="w-5 h-5 text-blue-500" />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              className="hover:opacity-70 transition-opacity"
              title="Mark as completed"
            >
              <div className={`w-5 h-5 rounded-full border-2 ${PAGE_STYLES.panel.border} hover:border-emerald-400`} />
            </button>
          )}
        </div>

        {/* Task name */}
        <span className={`
          flex-shrink-0
          ${localTask.completed ? `${PAGE_STYLES.panel.textMuted} line-through` : localTask.started_at ? 'text-blue-700 font-medium' : PAGE_STYLES.header.text}
        `}>
          {localTask.task_name}
        </span>

        {/* Notes area */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {editingNotes ? (
            <input
              ref={notesInputRef}
              type="text"
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              onBlur={handleSaveNotes}
              onKeyDown={handleNotesKeyDown}
              className={`flex-1 text-xs px-1.5 py-0.5 border border-orange-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 ${PAGE_STYLES.panel.background}`}
              placeholder="Add notes..."
            />
          ) : (
            <span
              onClick={(e) => { e.stopPropagation(); setEditingNotes(true); }}
              className={`
                text-xs italic cursor-pointer ${PAGE_STYLES.interactive.hover} px-1 rounded truncate
                ${task.notes ? PAGE_STYLES.panel.textMuted : `${PAGE_STYLES.panel.textMuted} opacity-0 group-hover:opacity-100 transition-opacity`}
              `}
              title={task.notes ? task.notes : 'Click to add notes'}
            >
              {task.notes || 'Add notes...'}
            </span>
          )}
        </div>

        {/* Action buttons - absolute positioned to not affect row layout */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {/* Start button - always visible when task is incomplete */}
          {!localTask.completed && !localTask.started_at && (
            <button
              onClick={handleStart}
              className="p-0.5 text-blue-600 hover:bg-blue-100 rounded"
              title="Start task"
            >
              <PlayCircle className="w-5 h-5" />
            </button>
          )}

          {/* Remove button - hover only */}
          {onRemove && (
            <button
              onClick={handleRemoveClick}
              className={`opacity-0 group-hover:opacity-100 transition-opacity p-0.5 ${PAGE_STYLES.panel.textMuted} hover:text-red-600 hover:bg-red-50 rounded`}
              title="Remove task"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default TaskRow;
