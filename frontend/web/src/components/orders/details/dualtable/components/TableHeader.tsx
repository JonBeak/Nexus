/**
 * TableHeader Component
 * Extracted from DualTableLayout.tsx (Phase 5)
 *
 * Renders the table header row with column labels
 */

import React from 'react';
import { Download } from 'lucide-react';
import { PAGE_STYLES } from '../../../../../constants/moduleColors';

interface TableHeaderProps {
  onImportClick?: () => void;
}

export const TableHeader: React.FC<TableHeaderProps> = ({ onImportClick }) => {
  const headerCell = `text-xs font-semibold ${PAGE_STYLES.header.text} uppercase tracking-wider py-2`;
  const dividerBorder = `border-l-2 ${PAGE_STYLES.panel.border}`;

  return (
    <div
      className={`${PAGE_STYLES.header.background} border-b-2 ${PAGE_STYLES.panel.border} grid gap-2 px-2`}
      style={{
        gridTemplateColumns: '40px 165px 115px 123px 123px 123px 62px 140px 380px 270px 55px 75px 85px'
      }}
    >
      <div className={`${headerCell} text-center`}>
        Row
      </div>
      <div className={`${headerCell} ${dividerBorder} pl-2`}>
        Item Name
      </div>
      <div className={headerCell}>
        Specifications
      </div>
      <div className={headerCell}>
        Spec 1
      </div>
      <div className={headerCell}>
        Spec 2
      </div>
      <div className={headerCell}>
        Spec 3
      </div>
      <div className={`${headerCell} text-center`}>
        Specs
      </div>
      <div className={`${headerCell} ${dividerBorder} pl-2`}>
        QB Item
      </div>
      <div className={`${headerCell} flex items-center gap-1`}>
        QB Description
        {onImportClick && (
          <button
            onClick={onImportClick}
            className="ml-1 p-0.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
            title="Import QB descriptions from estimate"
          >
            <Download className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className={headerCell}>
        Price Calculation
      </div>
      <div className={headerCell}>
        Qty
      </div>
      <div className={`${headerCell} text-right`}>
        Unit Price
      </div>
      <div className={`${headerCell} text-right`}>
        Extended
      </div>
    </div>
  );
};
