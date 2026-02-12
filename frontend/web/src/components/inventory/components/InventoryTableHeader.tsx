import React from 'react';
import { AutofillComboBox } from '../../common/AutofillComboBox';
import { InventoryUser } from '../types';
import { InventoryColumnFilters, InventorySortField } from '../hooks/useInventoryFiltering';
import { PAGE_STYLES } from '../../../constants/moduleColors';

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
  getDispositionOptions: string[];
  getJobOptions: string[];
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
  getColourNameOptions,
  getDispositionOptions,
  getJobOptions
}) => {
  const thClass = `px-3 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textMuted} uppercase tracking-wider cursor-pointer hover:bg-[var(--theme-hover-bg)]`;

  return (
    <thead className={PAGE_STYLES.header.background}>
      <tr>
        <th
          className={thClass}
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
                  handleColumnFilter('brand', value);
                }
              }}
              suggestions={getBrandOptions}
              placeholder="Filter brands..."
              className="w-full text-xs"
            />
          </div>
        </th>
        <th
          className={thClass}
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
                  handleColumnFilter('series', value);
                }
              }}
              suggestions={getSeriesOptions}
              placeholder="Filter series..."
              className="w-full text-xs"
            />
          </div>
        </th>
        <th
          className={`${thClass} w-44`}
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
                  handleColumnFilter('colour_number', value);
                }
              }}
              suggestions={getColourNumberOptions}
              placeholder="Filter numbers..."
              className="w-full text-xs"
            />
          </div>
        </th>
        <th
          className={`${thClass} flex-1`}
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
                  handleColumnFilter('colour_name', value);
                }
              }}
              suggestions={getColourNameOptions}
              placeholder="Filter names..."
              className="w-full text-xs"
            />
          </div>
        </th>
        <th
          className={thClass}
          style={{width: '30px'}}
          onClick={() => handleSort('width')}
        >
          Width (in) <span className="w-4 h-4 inline ml-1">{getSortIcon('width')}</span>
        </th>
        <th
          className={thClass}
          style={{width: '34px'}}
          onClick={() => handleSort('length_yards')}
        >
          Length (yds) <span className="w-4 h-4 inline ml-1">{getSortIcon('length_yards')}</span>
        </th>
        <th
          className={`${thClass} w-24`}
          onClick={() => handleSort('disposition')}
        >
          Status <span className="w-4 h-4 inline ml-1">{getSortIcon('disposition')}</span>
          <div className="mt-1" onClick={(e) => e.stopPropagation()}>
            <AutofillComboBox
              label=""
              value={columnFilters.disposition}
              onChange={(value) => {
                if (value === '---') {
                  handleColumnFilter('disposition', '');
                } else {
                  handleColumnFilter('disposition', value);
                }
              }}
              suggestions={getDispositionOptions}
              placeholder="Filter status..."
              className="w-full text-xs"
            />
          </div>
        </th>
        <th className={`${thClass} w-64`}>
          Associated Jobs
          <div className="mt-1" onClick={(e) => e.stopPropagation()}>
            <AutofillComboBox
              label=""
              value={columnFilters.jobs}
              onChange={(value) => {
                if (value === '---') {
                  handleColumnFilter('jobs', '');
                } else {
                  handleColumnFilter('jobs', value);
                }
              }}
              suggestions={getJobOptions}
              placeholder="Filter by job..."
              className="w-full text-xs"
            />
          </div>
        </th>
        {(user.role === 'manager' || user.role === 'owner') && (
          <th className={`px-3 py-3 text-left text-xs font-medium ${PAGE_STYLES.panel.textMuted} uppercase tracking-wider`}>Actions</th>
        )}
      </tr>
    </thead>
  );
};
