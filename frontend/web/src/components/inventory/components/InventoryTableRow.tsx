import React from 'react';
import { Edit, Trash2, Settings } from 'lucide-react';
import { InventoryUser, VinylItem } from '../types';

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

  return (
    <tr key={item.id} className="hover:bg-gray-50">
      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
        {item.brand || '-'}
      </td>
      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
        {item.series || '-'}
      </td>
      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
        {item.colour_number || '-'}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">
          {item.colour_name || '-'}
        </div>
        {item.notes && (
          <div className="text-xs text-gray-400 mt-1">{item.notes}</div>
        )}
      </td>
      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
        {item.width || '-'}
      </td>
      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
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
      {(user.role === 'manager' || user.role === 'owner') && (
        <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
          <div className="flex space-x-2">
            <button
              onClick={() => onEditItem(item)}
              className="text-indigo-600 hover:text-indigo-900"
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
