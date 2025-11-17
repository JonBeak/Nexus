import React from 'react';
import PrintFormsContent from './PrintFormsContent';

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
}

const PrintFormsModal: React.FC<PrintFormsModalProps> = ({
  isOpen,
  onClose,
  printConfig,
  onPrintConfigChange,
  onPrint,
  onPrintMasterEstimate,
  onPrintShopPacking,
  printing
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
        />
      </div>
    </div>
  );
};

export default PrintFormsModal;