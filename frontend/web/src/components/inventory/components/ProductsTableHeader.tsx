import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { AutofillComboBox } from '../../common/AutofillComboBox';

interface ProductsTableHeaderProps {
  user: any;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  columnFilters: {
    brand: string;
    series: string;
    colour_number: string;
    colour_name: string;
    suppliers: string;
  };
  onSort: (field: string) => void;
  onColumnFilter: (column: string, value: string) => void;
  getBrandOptions: string[];
  getSeriesOptions: string[];
  getColourNumberOptions: string[];
  getColourNameOptions: string[];
  getSupplierOptions: string[];
}

export const ProductsTableHeader: React.FC<ProductsTableHeaderProps> = ({
  user,
  sortField,
  sortDirection,
  columnFilters,
  onSort,
  onColumnFilter,
  getBrandOptions,
  getSeriesOptions,
  getColourNumberOptions,
  getColourNameOptions,
  getSupplierOptions
}) => {
  const getSortIcon = (field: string) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUp className="w-3 h-3 inline ml-1" /> : 
      <ChevronDown className="w-3 h-3 inline ml-1" />;
  };

  const handleFilterChange = (column: string) => (value: string) => {
    if (value === '---') {
      onColumnFilter(column, '');
    } else {
      onColumnFilter(column, value.split(' (')[0]);
    }
  };

  return (
    <thead className="bg-gray-50">
      <tr>
        <th 
          className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
          style={{width: '166px'}}
          onClick={() => onSort('brand')}
        >
          Brand {getSortIcon('brand')}
          <div className="mt-1" onClick={(e) => e.stopPropagation()}>
            <AutofillComboBox
              label=""
              value={columnFilters.brand}
              onChange={handleFilterChange('brand')}
              suggestions={getBrandOptions}
              placeholder="Filter brands..."
              className="text-xs"
            />
          </div>
        </th>
        <th 
          className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
          style={{width: '166px'}}
          onClick={() => onSort('series')}
        >
          Series {getSortIcon('series')}
          <div className="mt-1" onClick={(e) => e.stopPropagation()}>
            <AutofillComboBox
              label=""
              value={columnFilters.series}
              onChange={handleFilterChange('series')}
              suggestions={getSeriesOptions}
              placeholder="Filter series..."
              className="text-xs"
            />
          </div>
        </th>
        <th 
          className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-44"
          onClick={() => onSort('colour_number')}
        >
          Colour # {getSortIcon('colour_number')}
          <div className="mt-1" onClick={(e) => e.stopPropagation()}>
            <AutofillComboBox
              label=""
              value={columnFilters.colour_number}
              onChange={handleFilterChange('colour_number')}
              suggestions={getColourNumberOptions}
              placeholder="Filter..."
              className="text-xs"
            />
          </div>
        </th>
        <th 
          className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 flex-1"
          onClick={() => onSort('colour_name')}
        >
          Colour Name {getSortIcon('colour_name')}
          <div className="mt-1" onClick={(e) => e.stopPropagation()}>
            <AutofillComboBox
              label=""
              value={columnFilters.colour_name}
              onChange={handleFilterChange('colour_name')}
              suggestions={getColourNameOptions}
              placeholder="Filter..."
              className="text-xs"
            />
          </div>
        </th>
        <th 
          className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
          style={{width: '90px'}}
          onClick={() => onSort('default_width')}
        >
          Default Width {getSortIcon('default_width')}
        </th>
        <th 
          className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
          style={{width: '180px'}}
          onClick={() => onSort('suppliers')}
        >
          Suppliers {getSortIcon('suppliers')}
          <div className="mt-1" onClick={(e) => e.stopPropagation()}>
            <AutofillComboBox
              label=""
              value={columnFilters.suppliers}
              onChange={handleFilterChange('suppliers')}
              suggestions={getSupplierOptions}
              placeholder="Filter..."
              className="text-xs"
            />
          </div>
        </th>
        <th 
          className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-24"
          onClick={() => onSort('status')}
        >
          Status {getSortIcon('status')}
        </th>
        {(user.role === 'manager' || user.role === 'owner') && (
          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
        )}
      </tr>
    </thead>
  );
};