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
      className="bg-gray-200 border-b-2 border-gray-400 grid gap-2 px-2"
      style={{
        gridTemplateColumns: '40px 165px 115px 123px 123px 123px 62px 140px 380px 270px 55px 75px 85px'
      }}
    >
      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider text-center py-2">
        Row
      </div>
      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider border-l-2 border-gray-400 pl-2 py-2">
        Item Name
      </div>
      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider py-2">
        Specifications
      </div>
      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider py-2">
        Spec 1
      </div>
      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider py-2">
        Spec 2
      </div>
      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider py-2">
        Spec 3
      </div>
      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider text-center py-2">
        Specs
      </div>
      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider border-l-2 border-gray-400 pl-2 py-2">
        QB Item
      </div>
      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider py-2">
        QB Description
      </div>
      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider py-2">
        Price Calculation
      </div>
      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider py-2">
        Qty
      </div>
      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider text-right py-2">
        Unit Price
      </div>
      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider text-right py-2">
        Extended
      </div>
    </div>
  );
};
