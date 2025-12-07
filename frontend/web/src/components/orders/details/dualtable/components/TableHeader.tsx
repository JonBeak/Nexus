/**
 * TableHeader Component
 * Extracted from DualTableLayout.tsx (Phase 5)
 *
 * Renders the table header row with column labels
 */

import React from 'react';

export const TableHeader: React.FC = () => {
  return (
    <div
      className="bg-gray-100 border-b-2 border-gray-400 grid gap-2 px-2 py-2"
      style={{
        gridTemplateColumns: '75px 165px 120px 110px 110px 110px 60px 140px 380px 270px 55px 75px 85px'
      }}
    >
      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider text-center">
        Controls
      </div>
      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
        Item Name
      </div>
      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
        Specifications
      </div>
      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
        Spec 1
      </div>
      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
        Spec 2
      </div>
      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
        Spec 3
      </div>
      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider text-center">
        Actions
      </div>
      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider border-l-2 border-gray-400 pl-2">
        QB Item
      </div>
      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
        QB Description
      </div>
      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
        Price Calculation
      </div>
      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
        Qty
      </div>
      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider text-right">
        Unit Price
      </div>
      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider text-right">
        Extended
      </div>
    </div>
  );
};
