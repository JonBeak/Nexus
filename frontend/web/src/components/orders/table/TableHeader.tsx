import React from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { PAGE_STYLES, MODULE_COLORS } from '../../../constants/moduleColors';

interface Props {
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: any) => void;
}

export const TableHeader: React.FC<Props> = ({
  sortField,
  sortDirection,
  onSort
}) => {
  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) {
      return <Minus className={`w-4 h-4 ${PAGE_STYLES.panel.textMuted}`} />;
    }
    return sortDirection === 'asc' ?
      <ArrowUp className={`w-4 h-4 ${MODULE_COLORS.orders.text}`} /> :
      <ArrowDown className={`w-4 h-4 ${MODULE_COLORS.orders.text}`} />;
  };

  const HeaderCell = ({ field, label, sortable = true, className = '' }: { field: string; label: string; sortable?: boolean; className?: string }) => (
    <th
      scope="col"
      className={`px-4 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textMuted} uppercase tracking-wider ${className}`}
    >
      {sortable ? (
        <button
          onClick={() => onSort(field)}
          className={`flex items-center space-x-1 hover:text-orange-600`}
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
    <thead className={PAGE_STYLES.header.background}>
      <tr>
        <HeaderCell field="order_number" label="Order #" className="w-24" />
        <HeaderCell field="order_name" label="Order Name" className="w-80" />
        <HeaderCell field="customer_name" label="Customer" className="w-44" />
        <HeaderCell field="status" label="Status" className="w-28" />
        <HeaderCell field="due_date" label="Due Date" className="w-28" />
        <HeaderCell field="hard_due_date_time" label="Due Time" sortable={false} className="w-24" />
        <HeaderCell field="work_days_left" label="Days Left" className="w-20" />
        <HeaderCell field="progress_percent" label="Progress" />
        <HeaderCell field="created_at" label="Created" className="w-28" />
      </tr>
    </thead>
  );
};

export default TableHeader;
