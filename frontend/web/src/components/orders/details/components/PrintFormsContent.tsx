import React from 'react';
import { Printer, Plus, Minus } from 'lucide-react';

interface PrintConfig {
  master: number;
  estimate: number;
  shop: number;
  packing: number;
}

interface PrintFormsContentProps {
  printConfig: PrintConfig;
  onPrintConfigChange: (config: PrintConfig) => void;
  onPrint: () => void;
  onPrintMasterEstimate: () => void;
  onPrintShopPacking: () => void;
  onClose: () => void;
  printing: boolean;
  showCloseButton?: boolean;
}

const PrintFormsContent: React.FC<PrintFormsContentProps> = ({
  printConfig,
  onPrintConfigChange,
  onPrint,
  onPrintMasterEstimate,
  onPrintShopPacking,
  onClose,
  printing,
  showCloseButton = true
}) => {
  const handleClearAll = () => {
    onPrintConfigChange({ master: 0, estimate: 0, shop: 0, packing: 0 });
  };

  return (
    <div className="bg-white rounded-lg shadow-xl p-6 h-full flex flex-col">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Print Forms</h2>
      <p className="text-sm text-gray-600 mb-6">Select quantity for each form type</p>

      <div className="flex-1 overflow-y-auto">
        {/* MASTER & ESTIMATE GROUP */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Master & Estimate</h3>
          <div className="space-y-3 mb-4">
            {/* Master Form */}
            <div className="flex items-center justify-between">
              <span className="text-base font-medium text-gray-700">Master Form</span>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => onPrintConfigChange({ ...printConfig, master: Math.max(0, printConfig.master - 1) })}
                  className="p-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-12 text-center text-lg font-semibold text-gray-900">{printConfig.master}</span>
                <button
                  onClick={() => onPrintConfigChange({ ...printConfig, master: printConfig.master + 1 })}
                  className="p-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Estimate Form */}
            <div className="flex items-center justify-between">
              <span className="text-base font-medium text-gray-700">Estimate Form</span>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => onPrintConfigChange({ ...printConfig, estimate: Math.max(0, printConfig.estimate - 1) })}
                  className="p-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-12 text-center text-lg font-semibold text-gray-900">{printConfig.estimate}</span>
                <button
                  onClick={() => onPrintConfigChange({ ...printConfig, estimate: printConfig.estimate + 1 })}
                  className="p-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Print Master & Estimate Button */}
          <button
            onClick={onPrintMasterEstimate}
            disabled={printing || (printConfig.master === 0 && printConfig.estimate === 0)}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            <Printer className="w-4 h-4" />
            <span>{printing ? 'Printing...' : 'Print Master & Estimate'}</span>
          </button>
        </div>

        {/* SHOP & PACKING GROUP */}
        <div className="mb-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Shop & Packing</h3>
          <div className="space-y-3 mb-4">
            {/* Shop Form */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-base font-medium text-gray-700">Shop Form</span>
                <p className="text-xs text-gray-500 mt-0.5">Auto-calculated from specs</p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => onPrintConfigChange({ ...printConfig, shop: Math.max(0, printConfig.shop - 1) })}
                  className="p-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-12 text-center text-lg font-semibold text-gray-900">{printConfig.shop}</span>
                <button
                  onClick={() => onPrintConfigChange({ ...printConfig, shop: printConfig.shop + 1 })}
                  className="p-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Packing List */}
            <div className="flex items-center justify-between">
              <span className="text-base font-medium text-gray-700">Packing List</span>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => onPrintConfigChange({ ...printConfig, packing: Math.max(0, printConfig.packing - 1) })}
                  className="p-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-12 text-center text-lg font-semibold text-gray-900">{printConfig.packing}</span>
                <button
                  onClick={() => onPrintConfigChange({ ...printConfig, packing: printConfig.packing + 1 })}
                  className="p-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Print Shop & Packing Button */}
          <button
            onClick={onPrintShopPacking}
            disabled={printing || (printConfig.shop === 0 && printConfig.packing === 0)}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            <Printer className="w-4 h-4" />
            <span>{printing ? 'Printing...' : 'Print Shop & Packing'}</span>
          </button>
        </div>
      </div>

      {/* Bottom Action Buttons */}
      <div className="flex items-center justify-between space-x-3 pt-6 border-t border-gray-200">
        <button
          onClick={handleClearAll}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Clear All
        </button>
        <div className="flex items-center space-x-3">
          {showCloseButton && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
          <button
            onClick={onPrint}
            disabled={printing}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <Printer className="w-4 h-4" />
            <span>{printing ? 'Printing...' : 'Print All'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrintFormsContent;
