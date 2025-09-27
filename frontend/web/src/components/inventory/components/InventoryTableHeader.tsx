import React from 'react';
import { AutofillComboBox } from '../../common/AutofillComboBox';
import { InventoryUser } from '../types';
import { InventoryColumnFilters, InventorySortField } from '../hooks/useInventoryFiltering';

interface InventoryTableHeaderProps {
  user: InventoryUser;
  columnFilters: InventoryColumnFilters;
  handleSort: (field: InventorySortField) => void;
  handleColumnFilter: (column: keyof InventoryColumnFilters, value: string) => void;
  getSortIcon: (field: InventorySortField) => string;
  getBrandOptions: string[];
  getSeriesOptions: string[];
  getColourNumberOptions: string[];
  getColourNameOptions: string[];
}

export const InventoryTableHeader: React.FC<InventoryTableHeaderProps> = ({
  user,
  columnFilters,
  handleSort,
  handleColumnFilter,
  getSortIcon,
  getBrandOptions,
  getSeriesOptions,
  getColourNumberOptions,
  getColourNameOptions
}) => {
  return (
    <thead className="bg-gray-50">
      <tr>
        <th 
          className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
          style={{width: '166px'}}
          onClick={() => handleSort('brand')}
        >
          Brand <span className="w-4 h-4 inline ml-1">{getSortIcon('brand')}</span>
          <div className="mt-1" onClick={(e) => e.stopPropagation()}>
            <AutofillComboBox
              label=""
              value={columnFilters.brand}
              onChange={(value) => {
                if (value === '---') {
                  handleColumnFilter('brand', '');
                } else {
                  handleColumnFilter('brand', value.split(' (')[0]);
                }
              }}
              suggestions={getBrandOptions}
              placeholder="Filter brands..."
              className="w-full text-xs"
            />
          </div>
        </th>
        <th 
          className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
          style={{width: '166px'}}
          onClick={() => handleSort('series')}
        >
          Series <span className="w-4 h-4 inline ml-1">{getSortIcon('series')}</span>
          <div className="mt-1" onClick={(e) => e.stopPropagation()}>
            <AutofillComboBox
              label=""
              value={columnFilters.series}
              onChange={(value) => {
                if (value === '---') {
                  handleColumnFilter('series', '');
                } else {
                  handleColumnFilter('series', value.split(' (')[0]);
                }
              }}
              suggestions={getSeriesOptions}
              placeholder="Filter series..."
              className="w-full text-xs"
            />
          </div>
        </th>
        <th 
          className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-44"
          onClick={() => handleSort('colour_number')}
        >
          Colour# <span className="w-4 h-4 inline ml-1">{getSortIcon('colour_number')}</span>
          <div className="mt-1" onClick={(e) => e.stopPropagation()}>
            <AutofillComboBox
              label=""
              value={columnFilters.colour_number}
              onChange={(value) => {
                if (value === '---') {
                  handleColumnFilter('colour_number', '');
                } else {
                  handleColumnFilter('colour_number', value.split(' (')[0]);
                }
              }}
              suggestions={getColourNumberOptions}
              placeholder="Filter numbers..."
              className="w-full text-xs"
            />
          </div>
        </th>
        <th 
          className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 flex-1"
          onClick={() => handleSort('colour_name')}
        >
          Colour Name <span className="w-4 h-4 inline ml-1">{getSortIcon('colour_name')}</span>
          <div className="mt-1" onClick={(e) => e.stopPropagation()}>
            <AutofillComboBox
              label=""
              value={columnFilters.colour_name}
              onChange={(value) => {
                if (value === '---') {
                  handleColumnFilter('colour_name', '');
                } else {
                  handleColumnFilter('colour_name', value.split(' (')[0]);
                }
              }}
              suggestions={getColourNameOptions}
              placeholder="Filter names..."
              className="w-full text-xs"
            />
          </div>
        </th>
        <th 
          className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
          style={{width: '30px'}}
          onClick={() => handleSort('width')}
        >
          Width (in) <span className="w-4 h-4 inline ml-1">{getSortIcon('width')}</span>
        </th>
        <th 
          className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
          style={{width: '34px'}}
          onClick={() => handleSort('length_yards')}
        >
          Length (yds) <span className="w-4 h-4 inline ml-1">{getSortIcon('length_yards')}</span>
        </th>
        <th 
          className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-24"
          onClick={() => handleSort('disposition')}
        >
          Status <span className="w-4 h-4 inline ml-1">{getSortIcon('disposition')}</span>
        </th>
        {(user.role === 'manager' || user.role === 'owner') && (
          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
        )}
      </tr>
    </thead>
  );
};
