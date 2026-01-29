import React from 'react';
import { Printer, Plus, Minus, CheckCircle } from 'lucide-react';

interface PrintConfig {
  master: number;
  estimate: number;
  shop: number;
  packing: number;
}

export type PrintMode = 'full' | 'master_estimate' | 'shop_packing_production';

interface PrintFormsContentProps {
  printConfig: PrintConfig;
  onPrintConfigChange: (config: PrintConfig) => void;
  onPrint: () => void;
  onPrintMasterEstimate: () => void;
  onPrintShopPacking: () => void;
  onClose: () => void;
  printing: boolean;
  showCloseButton?: boolean;
  mode?: PrintMode;
  onPrintAndMoveToProduction?: () => void;
  onMoveToProductionWithoutPrinting?: () => void;
  defaultConfig?: PrintConfig;
}

const PrintFormsContent: React.FC<PrintFormsContentProps> = ({
  printConfig,
  onPrintConfigChange,
  onPrintMasterEstimate,
  onPrintShopPacking,
  printing,
  mode = 'full',
  defaultConfig,
  onPrintAndMoveToProduction,
  onMoveToProductionWithoutPrinting
}) => {
  // Default values if no defaultConfig provided
  const defaults = defaultConfig || { master: 1, estimate: 1, shop: 2, packing: 2 };

  const handleClearMasterEstimate = () => {
    onPrintConfigChange({ ...printConfig, master: 0, estimate: 0 });
  };

  const handleResetMasterEstimate = () => {
    onPrintConfigChange({ ...printConfig, master: defaults.master, estimate: defaults.estimate });
  };

  const handleClearShopPacking = () => {
    onPrintConfigChange({ ...printConfig, shop: 0, packing: 0 });
  };

  const handleResetShopPacking = () => {
    onPrintConfigChange({ ...printConfig, shop: defaults.shop, packing: defaults.packing });
  };

  const showMasterEstimate = mode === 'full' || mode === 'master_estimate';
  const showShopPacking = mode === 'full' || mode === 'shop_packing_production';

  return (
    <div className="bg-white rounded-lg shadow-xl p-6 h-full flex flex-col">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Print Forms</h2>
      <p className="text-sm text-gray-600 mb-6">Select quantity for each form type</p>

      <div className="flex-1 overflow-y-auto">
        {/* MASTER & ESTIMATE GROUP */}
        {showMasterEstimate && (
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

          {/* Clear / Reset buttons */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={handleClearMasterEstimate}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Clear All
            </button>
            <button
              onClick={handleResetMasterEstimate}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Reset
            </button>
          </div>

          {/* Print Master & Estimate Button */}
          <button
            onClick={onPrintMasterEstimate}
            disabled={printing || (printConfig.master === 0 && printConfig.estimate === 0)}
            className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>{printing ? 'Printing...' : 'Print Master & Estimate'}</span>
          </button>
        </div>
        )}

        {/* SHOP & PACKING GROUP */}
        {showShopPacking && (
        <div className={`mb-6 ${showMasterEstimate ? 'pt-6 border-t border-gray-200' : ''}`}>
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

          {/* Clear / Reset buttons */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={handleClearShopPacking}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Clear All
            </button>
            <button
              onClick={handleResetShopPacking}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Reset
            </button>
          </div>

          {/* Print Shop & Packing Button */}
          <button
            onClick={onPrintShopPacking}
            disabled={printing || (printConfig.shop === 0 && printConfig.packing === 0)}
            className="w-full px-3 py-2 text-sm font-medium text-green-700 bg-green-100 border border-green-300 rounded-lg hover:bg-green-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-300 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>{printing ? 'Printing...' : 'Print Only - Shop & Packing'}</span>
          </button>
        </div>
        )}
      </div>

      {/* Footer section for approval actions - only in shop_packing_production mode */}
      {mode === 'shop_packing_production' && (
        <div className="mt-auto pt-4 border-t border-gray-300 bg-gray-50 -mx-6 -mb-6 px-6 pb-6 space-y-2">
          <button
            onClick={onPrintAndMoveToProduction}
            disabled={printing || (printConfig.shop === 0 && printConfig.packing === 0)}
            className="w-full px-3 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>{printing ? 'Printing...' : 'Print & Move to Production'}</span>
          </button>
          <button
            onClick={onMoveToProductionWithoutPrinting}
            disabled={printing}
            className="w-full px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Approve without Printing</span>
          </button>
        </div>
      )}

    </div>
  );
};

export default PrintFormsContent;
