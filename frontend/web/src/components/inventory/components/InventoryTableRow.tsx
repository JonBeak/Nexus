import React from 'react';
import { Edit, Trash2, Settings } from 'lucide-react';
import { InventoryUser, VinylItem } from '../types';
import { PAGE_STYLES, MODULE_COLORS } from '../../../constants/moduleColors';
import { JobChipsCell } from './JobChipsCell';

interface InventoryTableRowProps {
  item: VinylItem;
  user: InventoryUser;
  onEditItem: (item: VinylItem) => void;
  onDeleteItem: (id: number) => void;
  onChangeStatus: (item: VinylItem) => void;
  getDispositionStatus: (item: VinylItem) => { color: string; text: string };
}

export const InventoryTableRow: React.FC<InventoryTableRowProps> = ({
  item,
  user,
  onEditItem,
  onDeleteItem,
  onChangeStatus,
  getDispositionStatus
}) => {
  const statusInfo = getDispositionStatus(item);
  const tdClass = `px-3 py-4 whitespace-nowrap text-sm ${PAGE_STYLES.panel.text}`;

  return (
    <tr key={item.id} className="hover:bg-[var(--theme-hover-bg)]">
      <td className={tdClass}>
        {item.brand || '-'}
      </td>
      <td className={tdClass}>
        {item.series || '-'}
      </td>
      <td className={tdClass}>
        {item.colour_number || '-'}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className={`text-sm ${PAGE_STYLES.panel.text}`}>
          {item.colour_name || '-'}
        </div>
        {item.notes && (
          <div className={`text-xs ${PAGE_STYLES.panel.textMuted} mt-1`}>{item.notes}</div>
        )}
      </td>
      <td className={tdClass}>
        {item.width || '-'}
      </td>
      <td className={tdClass}>
        {item.length_yards || '-'}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
          item.disposition === 'in_stock'
            ? 'bg-green-100 text-green-800'
            : item.disposition === 'used'
            ? 'bg-blue-100 text-blue-800'
            : 'bg-red-100 text-red-800'
        }`}>
          {statusInfo.text}
        </span>
      </td>
      <td className="px-3 py-4">
        <JobChipsCell orderAssociations={item.order_associations} />
      </td>
      {(user.role === 'manager' || user.role === 'owner') && (
        <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
          <div className="flex space-x-2">
            <button
              onClick={() => onEditItem(item)}
              className={`${MODULE_COLORS.vinyls.text} hover:text-purple-700`}
              title="Edit"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={() => onChangeStatus(item)}
              className="text-blue-600 hover:text-blue-900"
              title="Change Status"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDeleteItem(item.id)}
              className="text-red-600 hover:text-red-900"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </td>
      )}
    </tr>
  );
};
