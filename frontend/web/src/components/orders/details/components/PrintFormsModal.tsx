import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { FileText, Loader, X } from 'lucide-react';
import PrintFormsContent, { PrintMode } from './PrintFormsContent';
import { Order } from '../../../../types/orders';
import { buildPdfUrls } from '../../../../utils/pdfUrls';
import { PAGE_STYLES } from '../../../../constants/moduleColors';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker with HTTPS
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Memoize options outside component to prevent recreation
const pdfOptions = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
};

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
  order?: Order | null;
  defaultConfig?: PrintConfig;
}

interface PDFPreviewProps {
  url: string | null;
  label: string;
}

const PDFPreview: React.FC<PDFPreviewProps> = ({ url, label }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileNotFound, setFileNotFound] = useState(false);
  const [containerWidth, setContainerWidth] = useState(900);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Reset state when URL changes
  useEffect(() => {
    setFileNotFound(false);
    setLoading(true);
    setError(null);
    setNumPages(null);
  }, [url]);

  // Clean PDF widths that scale well from 612pt native size (LETTER format)
  // Using clean multiples avoids subpixel rendering artifacts in preview
  const PDF_WIDTHS = [612, 765, 918, 1224]; // 1x, 1.25x, 1.5x, 2x

  // Measure container width for responsive PDF sizing
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const availableWidth = containerRef.current.offsetWidth - 16; // Account for padding
        // Find largest clean width that fits to avoid subpixel scaling artifacts
        const cleanWidth = PDF_WIDTHS.filter(w => w <= availableWidth).pop() || 612;
        setContainerWidth(cleanWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const onDocumentLoadError = (error: any) => {
    console.error(`[PDFPreview ${label}] Load error:`, error);
    if (error.status === 404 || error.missing) {
      setFileNotFound(true);
      setError(null);
    } else if (error.message?.includes('sendWithPromise') || error.message?.includes('worker')) {
      setFileNotFound(true);
      setError(null);
    } else {
      setError('Failed to load PDF');
    }
    setLoading(false);
  };

  if (!url || fileNotFound) {
    return (
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center">
            <FileText className="w-4 h-4 mr-2" />
            {label}
          </h3>
        </div>
        <div className="p-4 bg-gray-50 min-h-[300px] flex items-center justify-center">
          <div className="text-center text-gray-500">
            <FileText className="w-10 h-10 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">Not available</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="bg-gray-50 px-3 py-1 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center">
          <FileText className="w-4 h-4 mr-2" />
          {label}
        </h3>
      </div>
      <div className="p-2 bg-gray-100">
        {loading && (
          <div className="flex items-center justify-center py-12 min-h-[300px]">
            <Loader className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="ml-2 text-sm text-gray-600">Loading...</span>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center py-12 min-h-[300px]">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading=""
          error=""
          options={pdfOptions}
        >
          {!loading && !error && numPages && (
            <div className="space-y-2">
              {Array.from(new Array(numPages), (_, index) => (
                <div key={`page_${index + 1}`} className="flex justify-center">
                  <Page
                    pageNumber={index + 1}
                    width={containerWidth}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                </div>
              ))}
            </div>
          )}
        </Document>
      </div>
    </div>
  );
};

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
  onMoveToProductionWithoutPrinting,
  order,
  defaultConfig
}) => {
  const modalContentRef = useRef<HTMLDivElement>(null);
  const mouseDownOutsideRef = useRef(false);

  // Handle ESC key - stop propagation to prevent parent modals from closing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle backdrop click - only close if both mousedown and mouseup are outside modal content
  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    mouseDownOutsideRef.current = modalContentRef.current ? !modalContentRef.current.contains(e.target as Node) : false;
  };

  const handleBackdropMouseUp = (e: React.MouseEvent) => {
    if (mouseDownOutsideRef.current && modalContentRef.current && !modalContentRef.current.contains(e.target as Node)) {
      onClose();
    }
    mouseDownOutsideRef.current = false;
  };

  if (!isOpen) return null;

  // Build PDF URLs from order
  const pdfUrls = order ? buildPdfUrls(order) : null;

  // Determine which PDFs to show based on mode
  const getPdfsToShow = () => {
    if (!pdfUrls) return [];

    const pdfs: { url: string; label: string }[] = [];

    if (mode === 'full' || mode === 'master_estimate') {
      pdfs.push({ url: pdfUrls.master, label: 'Master Order Form' });
      pdfs.push({ url: pdfUrls.estimate, label: 'Estimate Form' });
    }

    if (mode === 'full' || mode === 'shop_packing_production') {
      pdfs.push({ url: pdfUrls.shop, label: 'Shop Form' });
      pdfs.push({ url: pdfUrls.packing, label: 'Packing List' });
    }

    return pdfs;
  };

  const pdfsToShow = getPdfsToShow();
  const hasPreview = pdfUrls && pdfsToShow.length > 0;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div ref={modalContentRef} className={`${PAGE_STYLES.panel.background} rounded-lg shadow-2xl ${hasPreview ? 'w-[1400px]' : 'w-[500px]'} h-[90vh] flex`}>
        {/* Left Panel - Print Controls */}
        <div className={`${hasPreview ? 'w-[350px]' : 'w-full'} flex-shrink-0 flex flex-col`}>
          {/* Header */}
          <div className={`px-6 py-4 border-b ${PAGE_STYLES.border} flex items-center justify-between`}>
            <div>
              <h2 className={`text-xl font-semibold ${PAGE_STYLES.panel.text}`}>Print Forms</h2>
              {order && (
                <p className={`text-sm ${PAGE_STYLES.panel.textMuted} mt-1`}>
                  #{order.order_number} - {order.order_name}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className={`p-2 ${PAGE_STYLES.interactive.hover} rounded-lg transition-colors`}
            >
              <X className={`w-5 h-5 ${PAGE_STYLES.panel.textMuted}`} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
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
              defaultConfig={defaultConfig}
            />
          </div>
        </div>

        {/* Right Panel - PDF Preview */}
        {hasPreview && (
          <div className={`flex-1 border-l ${PAGE_STYLES.border} overflow-y-auto ${PAGE_STYLES.page.background} p-3`}>
            <div className="space-y-3">
              {pdfsToShow.map((pdf) => (
                <PDFPreview
                  key={pdf.label}
                  url={pdf.url}
                  label={pdf.label}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrintFormsModal;
