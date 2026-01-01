import React from 'react';
import { BulkEntry } from '../../../hooks/useBulkEntries';
import { TypeButtonGroup } from './TypeButtonGroup';
import { PAGE_STYLES } from '../../../constants/moduleColors';

interface BulkEntryHeaderProps {
  onBulkTypeChange?: (type: BulkEntry['type']) => void;
}

/**
 * Table header component for bulk entries
 */
export const BulkEntryHeader: React.FC<BulkEntryHeaderProps> = ({
  onBulkTypeChange
}) => {
  const thClass = `px-2 py-1 text-left text-xs font-medium ${PAGE_STYLES.panel.textMuted} uppercase tracking-wider`;

  return (
    <thead className={PAGE_STYLES.header.background}>
      <tr>
        <th className={thClass}>
          <div className="flex flex-col gap-1">
            <span>Type<span className="text-red-500 ml-1">*</span></span>
            {onBulkTypeChange && (
              <div className="normal-case">
                <TypeButtonGroup
                  selectedType=""
                  onTypeChange={onBulkTypeChange}
                  variant="header"
                />
              </div>
            )}
          </div>
        </th>
        <th className={thClass} style={{ minWidth: '280px' }}>
          Vinyl Product<span className="text-red-500 ml-1">*</span>
        </th>
        <th className={thClass}>
          Width (in)<span className="text-red-500 ml-1">*</span>
        </th>
        <th className={thClass}>
          Length (yds)<span className="text-red-500 ml-1">*</span>
        </th>
        <th className={thClass}>
          Location
        </th>
        <th className={thClass} style={{ minWidth: '120px' }}>
          Jobs
        </th>
        <th className={thClass}>
          Notes
        </th>
        <th className={thClass}>
          Actions
        </th>
      </tr>
    </thead>
  );
};

export default BulkEntryHeader;