import React from 'react';
import { X } from 'lucide-react';
import PrintFormsContent, { PrintMode } from './PrintFormsContent';
import PDFPreviewPanel from './PDFPreviewPanel';

interface PrintConfig {
  master: number;
  estimate: number;
  shop: number;
  packing: number;
}

interface FormUrls {
  master: string;
  estimate: string;
  shop: string;
  customer: string;
  packing: string;
}

interface PrintFormsWithPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  printConfig: PrintConfig;
  onPrintConfigChange: (config: PrintConfig) => void;
  onPrint: () => void;
  onPrintMasterEstimate: () => void;
  onPrintShopPacking: () => void;
  printing: boolean;
  formUrls: FormUrls | null;
  mode?: PrintMode;
  onPrintAndMoveToProduction?: () => void;
  onMoveToProductionWithoutPrinting?: () => void;
  shopRoles?: string[];
}

const PrintFormsWithPreview: React.FC<PrintFormsWithPreviewProps> = ({
  isOpen,
  onClose,
  printConfig,
  onPrintConfigChange,
  onPrint,
  onPrintMasterEstimate,
  onPrintShopPacking,
  printing,
  formUrls,
  mode = 'full',
  onPrintAndMoveToProduction,
  onMoveToProductionWithoutPrinting,
  shopRoles
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-[75vw] h-[90vh] flex flex-col overflow-hidden">
        {/* Header with Close Button */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900">Print Forms & Preview</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Content: Side-by-Side Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel: Print Controls (30%) */}
          <div className="w-[30%] border-r border-gray-200 overflow-y-auto">
            <PrintFormsContent
              printConfig={printConfig}
              onPrintConfigChange={onPrintConfigChange}
              onPrint={onPrint}
              onPrintMasterEstimate={onPrintMasterEstimate}
              onPrintShopPacking={onPrintShopPacking}
              onClose={onClose}
              printing={printing}
              showCloseButton={false}
              mode={mode}
              onPrintAndMoveToProduction={onPrintAndMoveToProduction}
              onMoveToProductionWithoutPrinting={onMoveToProductionWithoutPrinting}
              shopRoles={shopRoles}
            />
          </div>

          {/* Right Panel: PDF Preview (70%) */}
          <div className="w-[70%] overflow-hidden">
            <PDFPreviewPanel formUrls={formUrls} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintFormsWithPreview;
