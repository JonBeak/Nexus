import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ordersApi } from '../../../services/api';
import { PAGE_STYLES, MODULE_COLORS } from '../../../constants/moduleColors';
import { useAlert } from '../../../contexts/AlertContext';

interface Props {
  orderNumber: number;
  partId: number;
  existingTasks: Array<{ task_name: string }>;
  onTaskAdded: () => void;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement>;
  centered?: boolean; // Force center positioning
}

interface TaskTemplate {
  task_name: string;
  assigned_role: string | null;
}

export const TaskTemplateDropdown: React.FC<Props> = ({
  orderNumber,
  partId,
  existingTasks,
  onTaskAdded,
  onClose,
  triggerRef,
  centered = false
}) => {
  const { showError } = useAlert();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  // Position dropdown to the right of trigger element, vertically centered
  useEffect(() => {
    if (triggerRef?.current && dropdownRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const dropdownHeight = dropdownRef.current.offsetHeight || 400;

      // Position to the right of button, centered vertically
      setPosition({
        top: rect.top + window.scrollY + (rect.height / 2) - (dropdownHeight / 2),
        left: rect.right + window.scrollX + 8
      });
    } else if (triggerRef?.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top + window.scrollY - 200, // Approximate center
        left: rect.right + window.scrollX + 8
      });
    }
  }, [triggerRef, loading]); // Re-calculate when loading changes (content loaded)

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await ordersApi.getTaskTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Error loading task templates:', error);
      showError('Failed to load task templates. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async (template: TaskTemplate) => {
    try {
      setAdding(true);
      await ordersApi.addTaskToPart(orderNumber, partId, {
        task_name: template.task_name,
        assigned_role: template.assigned_role || undefined
      });
      onTaskAdded();
    } catch (error) {
      console.error('Error adding task:', error);
      showError('Failed to add task. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  // Track existing task names for highlighting
  const existingTaskNames = new Set(existingTasks.map(t => t.task_name));

  // Group by role, preserving production order (order of first appearance)
  const groupedTemplates: Record<string, TaskTemplate[]> = {};
  const roleOrder: string[] = [];
  templates.forEach(template => {
    const role = template.assigned_role || 'General';
    if (!groupedTemplates[role]) {
      groupedTemplates[role] = [];
      roleOrder.push(role); // Track order of first appearance
    }
    groupedTemplates[role].push(template);
  });

  const roles = roleOrder; // Use production order, not alphabetical

  const dropdownContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998]"
        onClick={onClose}
      />

      {/* Dropdown - rendered via portal at document body level */}
      <div
        ref={dropdownRef}
        className={`fixed w-72 ${PAGE_STYLES.panel.background} border-2 ${PAGE_STYLES.panel.border} rounded-lg shadow-xl ring-1 ring-black/5 z-[9999] max-h-[500px] overflow-y-auto`}
        style={centered || !triggerRef?.current ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' } : { top: position.top, left: position.left }}
      >
        {loading ? null : templates.length === 0 ? (
          <div className={`p-4 text-center text-sm ${PAGE_STYLES.panel.textMuted}`}>
            No task templates available
          </div>
        ) : (
          <div>
            {roles.map((role, index) => (
              <div key={role}>
                <div className={`sticky top-0 px-3 py-1.5 text-xs font-bold ${PAGE_STYLES.header.text} uppercase tracking-wide ${PAGE_STYLES.header.background} border-b ${PAGE_STYLES.panel.border} ${index > 0 ? 'border-t mt-1' : ''}`}>
                  {role.replace(/_/g, ' ')}
                </div>
                {groupedTemplates[role].map(template => {
                  const alreadyExists = existingTaskNames.has(template.task_name);
                  return (
                    <button
                      key={template.task_name}
                      onClick={() => handleAddTask(template)}
                      disabled={adding}
                      className={`w-full text-left px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                        alreadyExists
                          ? 'bg-red-50 text-red-700 hover:bg-red-100'
                          : `${PAGE_STYLES.header.text} hover:bg-orange-50 hover:text-orange-900`
                      }`}
                    >
                      {template.task_name}
                      {alreadyExists && <span className="ml-2 text-xs text-red-500">(exists)</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );

  // Render via portal to document.body to avoid clipping
  return createPortal(dropdownContent, document.body);
};

export default TaskTemplateDropdown;
