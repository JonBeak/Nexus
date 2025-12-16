import React from 'react';
import { BulkEntry } from '../../../hooks/useBulkEntries';
import { TypeButtonGroup } from './TypeButtonGroup';

interface BulkEntryHeaderProps {
  onBulkTypeChange?: (type: BulkEntry['type']) => void;
}

/**
 * Table header component for bulk entries
 */
export const BulkEntryHeader: React.FC<BulkEntryHeaderProps> = ({
  onBulkTypeChange
}) => {
  return (
    <thead className="bg-gray-50">
      <tr>
        <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
        <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '280px' }}>
          Vinyl Product<span className="text-red-500 ml-1">*</span>
        </th>
        <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Width (in)<span className="text-red-500 ml-1">*</span>
        </th>
        <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Length (yds)<span className="text-red-500 ml-1">*</span>
        </th>
        <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Location
        </th>
        <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ minWidth: '120px' }}>
          Jobs
        </th>
        <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Notes
        </th>
        <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Actions
        </th>
      </tr>
    </thead>
  );
};

export default BulkEntryHeader;