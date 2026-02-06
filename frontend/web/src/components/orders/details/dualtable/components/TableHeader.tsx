/**
 * TableHeader Component
 * Extracted from DualTableLayout.tsx (Phase 5)
 *
 * Renders the table header row with column labels
 */

import React from 'react';
import { Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { PAGE_STYLES } from '../../../../../constants/moduleColors';
import { getGridTemplate } from '../constants/tableConstants';

interface TableHeaderProps {
  onImportClick?: () => void;
  isPriceCalcExpanded?: boolean;
  onTogglePriceCalc?: () => void;
  highStandards?: boolean;
}

export const TableHeader: React.FC<TableHeaderProps> = ({
  onImportClick,
  isPriceCalcExpanded = true,
  onTogglePriceCalc,
  highStandards
}) => {
  const headerTextClass = highStandards ? 'text-amber-900' : PAGE_STYLES.header.text;
  const headerCell = `text-xs font-semibold ${headerTextClass} uppercase tracking-wider py-2`;
  const dividerBorder = `border-l-2 ${PAGE_STYLES.panel.border}`;
  const headerBg = highStandards ? 'bg-gradient-to-r from-amber-300 to-yellow-300' : PAGE_STYLES.header.background;

  return (
    <div
      className={`${headerBg} border-b-2 ${PAGE_STYLES.panel.border} grid gap-2 px-2`}
      style={{
        gridTemplateColumns: getGridTemplate(isPriceCalcExpanded)
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
      <div className={`${headerCell} flex items-center gap-1`}>
        {isPriceCalcExpanded ? (
          <>
            Price Calculation
            {onTogglePriceCalc && (
              <button
                onClick={onTogglePriceCalc}
                className="ml-1 p-0.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
                title="Collapse Price Calculation column"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
            )}
          </>
        ) : (
          onTogglePriceCalc && (
            <button
              onClick={onTogglePriceCalc}
              className="p-0.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
              title="Expand Price Calculation column"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          )
        )}
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
