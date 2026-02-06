/**
 * PricingManager - Main page for pricing table management
 *
 * Collapsible accordion sections for 13 pricing groups.
 * Each section renders the appropriate editor component(s).
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, DollarSign } from 'lucide-react';
import { pricingSections, PricingSection, TableConfig } from './pricingConfig';
import { PricingTableEditor } from './editors/PricingTableEditor';
import { PricingFormEditor } from './editors/PricingFormEditor';
import { PricingKeyValueEditor } from './editors/PricingKeyValueEditor';
import { BackerPricingDisplay } from './editors/BackerPricingDisplay';

function renderEditor(tableConfig: TableConfig) {
  switch (tableConfig.editorType) {
    case 'table':
      return <PricingTableEditor key={tableConfig.tableKey} config={tableConfig} />;
    case 'form':
      return <PricingFormEditor key={tableConfig.tableKey} config={tableConfig} />;
    case 'keyvalue':
      return <PricingKeyValueEditor key={tableConfig.tableKey} config={tableConfig} />;
    case 'custom':
      if (tableConfig.customComponent === 'BackerPricingDisplay') {
        return <BackerPricingDisplay key={tableConfig.tableKey} />;
      }
      return null;
    default:
      return null;
  }
}

function SectionAccordion({ section, isOpen, onToggle }: {
  section: PricingSection;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden transition-all" data-section-id={section.id}>
      {/* Section Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-white hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isOpen ? (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-400" />
          )}
          <div className="text-left">
            <h3 className="text-sm font-semibold text-gray-800">{section.title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{section.description}</p>
          </div>
        </div>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
          {section.tables.length} table{section.tables.length !== 1 ? 's' : ''}
        </span>
      </button>

      {/* Section Content */}
      {isOpen && (
        <div className="border-t border-gray-200 bg-white px-5 py-4">
          <div className="space-y-6">
            {section.tables.map((tableConfig, idx) => (
              <div key={tableConfig.tableKey}>
                {section.tables.length > 1 && (
                  <h4 className="text-sm font-medium text-gray-700 mb-2 pb-1 border-b border-gray-100">
                    {tableConfig.title}
                  </h4>
                )}
                {renderEditor(tableConfig)}
                {idx < section.tables.length - 1 && <div className="mt-4" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export const PricingManager: React.FC = () => {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setOpenSections(new Set(pricingSections.map(s => s.id)));
  };

  const collapseAll = () => {
    setOpenSections(new Set());
  };

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Pricing Tables</h2>
            <p className="text-sm text-gray-500">
              View and edit all pricing rates and configuration ({pricingSections.length} sections, {pricingSections.reduce((acc, s) => acc + s.tables.length, 0)} tables)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={expandAll} className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg">
            Expand All
          </button>
          <button onClick={collapseAll} className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg">
            Collapse All
          </button>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {pricingSections.map(section => (
          <SectionAccordion
            key={section.id}
            section={section}
            isOpen={openSections.has(section.id)}
            onToggle={() => toggleSection(section.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default PricingManager;
