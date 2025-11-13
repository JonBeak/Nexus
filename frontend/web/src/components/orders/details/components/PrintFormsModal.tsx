import React from 'react';
import { Printer, Plus, Minus } from 'lucide-react';

interface PrintConfig {
  master: number;
  estimate: number;
  shop: number;
  packing: number;
}

interface PrintFormsModalProps {
  isOpen: boolean;
  onClose: () => void;
  printConfig: PrintConfig;
  onPrintConfigChange: (config: PrintConfig) => void;
  onPrint: () => void;
  printing: boolean;
}

const PrintFormsModal: React.FC<PrintFormsModalProps> = ({
  isOpen,
  onClose,
  printConfig,
  onPrintConfigChange,
  onPrint,
  printing
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-[500px]">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Print Forms</h2>
        <p className="text-sm text-gray-600 mb-6">Select quantity for each form type</p>

        <div className="space-y-4 mb-6">
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

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onPrint}
            disabled={printing}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <Printer className="w-4 h-4" />
            <span>{printing ? 'Printing...' : 'Print'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrintFormsModal;