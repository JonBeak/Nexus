import React from 'react';

/**
 * Table header component for bulk entries
 */
export const BulkEntryHeader: React.FC = () => {
  return (
    <thead className="bg-gray-50">
      <tr>
        <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Type<span className="text-red-500 ml-1">*</span>
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