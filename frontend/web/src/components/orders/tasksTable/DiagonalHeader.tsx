/**
 * TaskHeader Component
 * Renders a horizontal column header with text wrapping and role-based coloring
 * Supports composite task keys (taskName|notes) with two-line display
 */

import React from 'react';
import { getRoleColors, ProductionRole } from './roleColors';

interface Props {
  taskKey: string;  // Composite key: "TaskName" or "TaskName|notes"
  role: ProductionRole | string;
}

export const DiagonalHeader: React.FC<Props> = ({ taskKey, role }) => {
  const colors = getRoleColors(role);

  // Parse taskKey: "TaskName|notes" or just "TaskName"
  const [taskName, notes] = taskKey.includes('|')
    ? [taskKey.split('|')[0], taskKey.split('|').slice(1).join('|')]
    : [taskKey, null];

  return (
    <th
      className={`px-1 py-2 ${colors.headerBg} border-b border-r ${colors.border} text-center align-top`}
      style={{ minHeight: '70px', height: '70px' }}
    >
      <div
        style={{
          fontSize: '11px',
          lineHeight: '1.2',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
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
        {notes && (
          <div
            className={`${colors.headerText} opacity-75`}
            style={{
              fontSize: '9px',
              maxWidth: '100px',
              lineHeight: '1.2',
              maxHeight: '36px',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical'
            }}
            title={notes}
          >
            {notes}
          </div>
        )}
      </div>
    </th>
  );
};

export default DiagonalHeader;
