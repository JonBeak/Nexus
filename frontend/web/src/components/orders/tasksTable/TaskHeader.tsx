/**
 * TaskHeader Component
 * Renders a horizontal column header with text wrapping and role-based coloring
 * Notes are displayed in cells, not headers - headers show only task name
 */

import React from 'react';
import { getRoleColors, ProductionRole } from './roleColors';

interface Props {
  taskKey: string;  // Column key: "TaskName" or "TaskName#1" - only task name is displayed
  role: ProductionRole | string;
}

export const TaskHeader: React.FC<Props> = ({ taskKey, role }) => {
  const colors = getRoleColors(role);

  // Extract just the task name from column key (strip #N suffix if present)
  const hashIndex = taskKey.lastIndexOf('#');
  const taskName = (hashIndex > 0 && /^\d+$/.test(taskKey.slice(hashIndex + 1)))
    ? taskKey.slice(0, hashIndex)
    : taskKey;

  return (
    <th
      className={`px-1 py-2 ${colors.headerBg} border-b border-r ${colors.border} text-center align-top`}
      style={{ minHeight: '50px', height: '50px' }}
    >
      <div
        style={{
          fontSize: '11px',
          lineHeight: '1.2',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          height: '100%'
        }}
      >
        <span
          className={`font-medium ${colors.headerText}`}
          style={{
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
            display: 'block'
          }}
        >
          {taskName}
        </span>
      </div>
    </th>
  );
};

export default TaskHeader;
