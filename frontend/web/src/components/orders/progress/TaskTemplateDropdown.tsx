import React, { useState, useEffect } from 'react';
import { ordersApi } from '../../../services/api';

interface Props {
  orderNumber: number;
  partId: number;
  existingTasks: Array<{ task_name: string }>;
  onTaskAdded: () => void;
  onClose: () => void;
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
  onClose
}) => {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await ordersApi.getTaskTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Error loading task templates:', error);
      alert('Failed to load task templates. Please try again.');
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
      alert('Failed to add task. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  // Filter out tasks that already exist on this part
  const existingTaskNames = new Set(existingTasks.map(t => t.task_name));
  const availableTemplates = templates.filter(
    t => !existingTaskNames.has(t.task_name)
  );

  // Group by role, preserving production order (order of first appearance)
  const groupedTemplates: Record<string, TaskTemplate[]> = {};
  const roleOrder: string[] = [];
  availableTemplates.forEach(template => {
    const role = template.assigned_role || 'General';
    if (!groupedTemplates[role]) {
      groupedTemplates[role] = [];
      roleOrder.push(role); // Track order of first appearance
    }
    groupedTemplates[role].push(template);
  });

  const roles = roleOrder; // Use production order, not alphabetical

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Dropdown */}
      <div className="absolute top-12 left-full right-auto w-72 bg-white border-2 border-gray-300 rounded-lg shadow-xl ring-1 ring-black/5 z-50 max-h-[500px] overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-sm text-gray-500">
            Loading tasks...
          </div>
        ) : availableTemplates.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            All tasks already added
          </div>
        ) : (
          <div>
            {roles.map((role, index) => (
              <div key={role}>
                <div className={`sticky top-0 px-3 py-1.5 text-xs font-bold text-gray-600 uppercase tracking-wide bg-gray-100 border-b border-gray-200 ${index > 0 ? 'border-t mt-1' : ''}`}>
                  {role.replace(/_/g, ' ')}
                </div>
                {groupedTemplates[role].map(template => (
                  <button
                    key={template.task_name}
                    onClick={() => handleAddTask(template)}
                    disabled={adding}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {template.task_name}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default TaskTemplateDropdown;
