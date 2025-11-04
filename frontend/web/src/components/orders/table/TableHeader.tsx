import React from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface Props {
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: any) => void;
  isAllSelected: boolean;
  onSelectAll: (checked: boolean) => void;
}

export const TableHeader: React.FC<Props> = ({
  sortField,
  sortDirection,
  onSort,
  isAllSelected,
  onSelectAll
}) => {
  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) {
      return <Minus className="w-4 h-4 text-gray-300" />;
    }
    return sortDirection === 'asc' ?
      <ArrowUp className="w-4 h-4 text-indigo-600" /> :
      <ArrowDown className="w-4 h-4 text-indigo-600" />;
  };

  const HeaderCell = ({ field, label, sortable = true }: { field: string; label: string; sortable?: boolean }) => (
    <th
      scope="col"
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
    >
      {sortable ? (
        <button
          onClick={() => onSort(field)}
          className="flex items-center space-x-1 hover:text-gray-700"
        >
          <span>{label}</span>
          <SortIcon field={field} />
        </button>
      ) : (
        <span>{label}</span>
      )}
    </th>
  );

  return (
    <thead className="bg-gray-50">
      <tr>
        <th scope="col" className="px-6 py-3 w-12">
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={(e) => onSelectAll(e.target.checked)}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
        </th>
        <HeaderCell field="order_number" label="Order #" />
        <HeaderCell field="order_name" label="Order Name" />
        <HeaderCell field="customer_name" label="Customer" />
        <HeaderCell field="status" label="Status" />
        <HeaderCell field="due_date" label="Due Date" />
        <HeaderCell field="progress_percent" label="Progress" />
        <HeaderCell field="created_at" label="Created" />
        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
          Actions
        </th>
      </tr>
    </thead>
  );
};

export default TableHeader;
