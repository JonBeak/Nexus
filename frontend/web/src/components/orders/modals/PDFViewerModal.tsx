/**
 * PDFViewerModal Component
 * Displays all order PDFs in a single scrollable modal window
 */

import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { X, FileText, Loader, AlertCircle, Expand } from 'lucide-react';
import { Order } from '../../../types/orders';
import { buildPdfUrls } from '../../../utils/pdfUrls';
import { qbInvoiceApi } from '../../../services/api';
import { PAGE_STYLES } from '../../../constants/moduleColors';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';
import ExpandedPDFModal from './ExpandedPDFModal';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker with HTTPS
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Memoize options outside component to prevent recreation
const pdfOptions = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
};

interface PDFViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
}

interface PDFSectionProps {
  url: string | null;
  label: string;
  isBase64?: boolean;
  isMobile?: boolean;
  onExpand?: () => void;
}

const PDFSection: React.FC<PDFSectionProps> = ({ url, label, isBase64 = false, isMobile = false, onExpand }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileNotFound, setFileNotFound] = useState(false);
  const [containerWidth, setContainerWidth] = useState(800);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset state when URL changes
  useEffect(() => {
    setFileNotFound(false);
    setLoading(true);
    setError(null);
    setNumPages(null);
  }, [url]);

  // Measure container width for responsive PDF sizing
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth - 32;
        // Lower minimum on mobile (280px) to fit narrow phones
        setContainerWidth(Math.max(isMobile ? 280 : 400, width));
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [isMobile]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const onDocumentLoadError = (error: Error & { status?: number; missing?: boolean }) => {
    console.error(`[PDFSection ${label}] Load error:`, error);
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

  // Prepare the file source
  const fileSource = isBase64 && url ? `data:application/pdf;base64,${url}` : url;

  if (!url || fileNotFound) {
    return (
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <div className={`${PAGE_STYLES.header.background} px-4 py-2 border-b border-gray-200`}>
          <h3 className={`text-sm font-semibold ${PAGE_STYLES.header.text} flex items-center`}>
            <FileText className="w-4 h-4 mr-2" />
            {label}
          </h3>
        </div>
        <div className="p-8 bg-gray-50 flex items-center justify-center">
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
      <div className={`${PAGE_STYLES.header.background} px-4 py-2 border-b border-gray-200 flex items-center justify-between`}>
        <h3 className={`text-sm font-semibold ${PAGE_STYLES.header.text} flex items-center`}>
          <FileText className="w-4 h-4 mr-2" />
          {label}
        </h3>
        {onExpand && (
          <button
            onClick={onExpand}
            className="p-2 hover:bg-gray-200 active:bg-gray-300 rounded-lg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
            title="Expand PDF"
          >
            <Expand className="w-4 h-4 text-gray-600" />
          </button>
        )}
      </div>
      <div className="p-2 bg-gray-100 cursor-pointer" onClick={onExpand}>
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="ml-2 text-sm text-gray-600">Loading...</span>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center py-12">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        {!error && !fileNotFound && (
          <Document
            key={fileSource}
            file={fileSource}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading=""
            error=""
            options={pdfOptions}
          >
            {!loading && numPages && numPages > 0 && (
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
        )}
      </div>
    </div>
  );
};

interface ExpandedPdf {
  url: string;
  label: string;
  isBase64?: boolean;
}

const PDFViewerModal: React.FC<PDFViewerModalProps> = ({ isOpen, onClose, order }) => {
  const [invoicePdf, setInvoicePdf] = useState<string | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [expandedPdf, setExpandedPdf] = useState<ExpandedPdf | null>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const mouseDownOutsideRef = useRef(false);
  const isMobile = useIsMobile();

  // Lock body scroll on mobile when modal is open
  useBodyScrollLock(isOpen && isMobile);

  // Fetch invoice PDF if order has an invoice
  useEffect(() => {
    const fetchInvoicePdf = async () => {
      if (!order?.qb_invoice_id) {
        setInvoicePdf(null);
        setInvoiceError(null);
        return;
      }

      try {
        setLoadingInvoice(true);
        setInvoiceError(null);
        const result = await qbInvoiceApi.getInvoicePdf(order.order_number);
        setInvoicePdf(result.pdf);
      } catch (err) {
        console.error('Error fetching invoice PDF:', err);
        setInvoicePdf(null);
        setInvoiceError('Failed to load invoice from QuickBooks');
      } finally {
        setLoadingInvoice(false);
      }
    };

    if (isOpen && order) {
      fetchInvoicePdf();
    }
  }, [isOpen, order?.order_number, order?.qb_invoice_id]);

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

  if (!isOpen || !order) return null;

  const pdfUrls = buildPdfUrls(order);

  const pdfSections = [
    { url: pdfUrls?.master || null, label: 'Master Order Form' },
    { url: pdfUrls?.shop || null, label: 'Shop Order Form' },
    { url: pdfUrls?.customer || null, label: 'Customer Specs' },
    { url: pdfUrls?.packing || null, label: 'Packing List' },
    { url: pdfUrls?.estimate || null, label: 'Estimate' },
  ];

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 z-[70] ${
        isMobile
          ? 'overflow-y-auto'
          : 'flex items-center justify-center p-2'
      }`}
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      {/* Wrapper for modal + external close button */}
      <div className={`relative w-full max-w-6xl ${
        isMobile
          ? 'min-h-full'
          : 'h-[96vh]'
      }`}>
        {/* Close Button - Outside modal on desktop, inside header on mobile */}
        <button
          onClick={onClose}
          className="hidden md:flex absolute top-0 -right-3 translate-x-full z-10 p-2 bg-white hover:bg-gray-100 rounded-lg transition-colors shadow-lg border border-gray-300 items-center justify-center"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>

        <div ref={modalContentRef} className={`${PAGE_STYLES.panel.background} rounded-lg shadow-2xl w-full ${isMobile ? '' : 'h-full'} flex flex-col`}>
          {/* Scrollable Content - Header scrolls with content */}
          <div className={`${isMobile ? '' : 'flex-1 overflow-y-auto'} ${PAGE_STYLES.page.background} rounded-lg`}>
            {/* Header inside scroll area */}
            <div className={`px-4 md:px-6 py-3 md:py-4 mb-4 ${PAGE_STYLES.panel.background} sticky top-0 z-10 flex items-start justify-between`}>
              <div>
                <h2 className={`text-lg md:text-xl font-semibold ${PAGE_STYLES.panel.text}`}>Order PDFs</h2>
                <p className={`text-xs md:text-sm ${PAGE_STYLES.panel.textMuted} mt-1`}>
                  #{order.order_number} - {order.order_name}
                </p>
              </div>
              {/* Mobile close button */}
              <button
                onClick={onClose}
                className="md:hidden p-2 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="px-2 md:px-6 pb-6">
          <div className="space-y-4 md:space-y-6">
            {pdfSections.map((section) => (
              <PDFSection
                key={section.label}
                url={section.url}
                label={section.label}
                isMobile={isMobile}
                onExpand={section.url ? () => setExpandedPdf({ url: section.url!, label: section.label }) : undefined}
              />
            ))}

            {/* Invoice Section - only show if invoice exists */}
            {order.qb_invoice_id && (
              loadingInvoice ? (
                <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                  <div className={`${PAGE_STYLES.header.background} px-4 py-2 border-b border-gray-200`}>
                    <h3 className={`text-sm font-semibold ${PAGE_STYLES.header.text} flex items-center`}>
                      <FileText className="w-4 h-4 mr-2" />
                      Invoice
                    </h3>
                  </div>
                  <div className="p-8 flex items-center justify-center">
                    <Loader className="w-6 h-6 animate-spin text-indigo-600" />
                    <span className="ml-2 text-sm text-gray-600">Loading invoice...</span>
                  </div>
                </div>
              ) : (
                <PDFSection
                  url={invoicePdf}
                  label="Invoice"
                  isBase64={true}
                  isMobile={isMobile}
                  onExpand={invoicePdf ? () => setExpandedPdf({ url: invoicePdf, label: 'Invoice', isBase64: true }) : undefined}
                />
              )
            )}
          </div>
          </div>
        </div>
      </div>
      </div>

      {/* Expanded PDF Modal */}
      {expandedPdf && (
        <ExpandedPDFModal
          isOpen={!!expandedPdf}
          onClose={() => setExpandedPdf(null)}
          pdfSource={expandedPdf.url}
          isBase64={expandedPdf.isBase64}
          title={expandedPdf.label}
        />
      )}
    </div>
  );
};

export default PDFViewerModal;
