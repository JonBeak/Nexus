import React from 'react';
import PrintFormsContent, { PrintMode } from './PrintFormsContent';

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
  onPrintMasterEstimate: () => void;
  onPrintShopPacking: () => void;
  printing: boolean;
  mode?: PrintMode;
  onPrintAndMoveToProduction?: () => void;
  onMoveToProductionWithoutPrinting?: () => void;
}

const PrintFormsModal: React.FC<PrintFormsModalProps> = ({
  isOpen,
  onClose,
  printConfig,
  onPrintConfigChange,
  onPrint,
  onPrintMasterEstimate,
  onPrintShopPacking,
  printing,
  mode = 'full',
  onPrintAndMoveToProduction,
  onMoveToProductionWithoutPrinting
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="w-[500px] h-auto max-h-[90vh]">
        <PrintFormsContent
          printConfig={printConfig}
          onPrintConfigChange={onPrintConfigChange}
          onPrint={onPrint}
          onPrintMasterEstimate={onPrintMasterEstimate}
          onPrintShopPacking={onPrintShopPacking}
          onClose={onClose}
          printing={printing}
          showCloseButton={true}
          mode={mode}
          onPrintAndMoveToProduction={onPrintAndMoveToProduction}
          onMoveToProductionWithoutPrinting={onMoveToProductionWithoutPrinting}
        />
      </div>
    </div>
  );
};

export default PrintFormsModal;