/**
 * Live PDF Preview Panel Component
 *
 * Right panel showing live previews of generated PDFs.
 * Displays order form and QB estimate PDFs using react-pdf (same as Print Forms modal).
 */

import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { FileText, Loader } from 'lucide-react';
import { PreparationState } from '@/types/orderPreparation';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker with HTTPS
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Memoize options outside component to prevent recreation
const pdfOptions = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
};

interface LivePDFPreviewPanelProps {
  state: PreparationState;
}

interface PDFDocumentProps {
  url: string | null;
  label: string;
  emptyMessage: string;
  orientation?: 'landscape' | 'portrait';
}

const PDFDocument: React.FC<PDFDocumentProps> = ({ url, label, emptyMessage, orientation = 'landscape' }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileNotFound, setFileNotFound] = useState(false);

  // Adjust width and height based on orientation
  const pageWidth = orientation === 'landscape' ? 950 : 825;
  const minHeight = orientation === 'landscape' ? 'min-h-[700px]' : 'min-h-[1200px]';

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const onDocumentLoadError = (error: any) => {
    console.error(`[PDFDocument ${label}] Load error:`, error);

    // Treat 404 errors (file not found) as "not generated yet" instead of errors
    // This happens when PDFs haven't been generated yet (e.g., QB Estimate before Step 2)
    if (error.status === 404 || error.missing) {
      setFileNotFound(true);
      setError(null);
      setLoading(false);
      return;
    }

    // Handle worker null errors (modal reopen issues)
    if (error.message?.includes('sendWithPromise') || error.message?.includes('worker')) {
      setError(null);
      setFileNotFound(true);
      setLoading(false);
      return;
    }

    // For other errors (permissions, network, etc.), show error message
    setError('Failed to load PDF');
    setLoading(false);
  };

  // Reset fileNotFound when URL changes
  React.useEffect(() => {
    setFileNotFound(false);
    setLoading(true);
    setError(null);
  }, [url]);

  if (!url || fileNotFound) {
    return (
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center">
            <FileText className="w-4 h-4 mr-2" />
            {label}
          </h3>
        </div>
        <div className={`p-4 bg-gray-50 ${minHeight}`}>
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-sm font-medium">Not generated yet</p>
              <p className="text-xs mt-1">{emptyMessage}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center">
          <FileText className="w-4 h-4 mr-2" />
          {label}
        </h3>
      </div>
      <div className={`p-4 bg-gray-50 ${minHeight}`}>
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="ml-2 text-sm text-gray-600">Loading PDF...</span>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center py-8">
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
            <div className="space-y-4">
              {Array.from(new Array(numPages), (_, index) => (
                <div key={`page_${index + 1}`} className="flex justify-center">
                  <Page
                    pageNumber={index + 1}
                    width={pageWidth}
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

export const LivePDFPreviewPanel: React.FC<LivePDFPreviewPanelProps> = ({
  state
}) => {
  const pdfs = [
    {
      url: state.pdfs.orderForm?.url || null,
      label: 'Master Order Form',
      emptyMessage: 'Run Step 3 to generate order form PDFs',
      orientation: 'landscape' as const
    },
    {
      url: state.pdfs.packingList?.url || null,
      label: 'Packing List',
      emptyMessage: 'Run Step 3 to generate order form PDFs',
      orientation: 'landscape' as const
    },
    {
      url: state.pdfs.internalEstimate?.url || null,
      label: 'Internal Estimate Form',
      emptyMessage: 'Run Step 3 to generate order form PDFs',
      orientation: 'landscape' as const
    },
    {
      url: state.pdfs.qbEstimate?.url || null,
      label: 'QuickBooks Estimate',
      emptyMessage: 'Run Step 2 to create QB estimate (auto-downloads PDF)',
      orientation: 'portrait' as const
    }
  ];

  return (
    <div className="h-full overflow-y-auto space-y-4">
      {pdfs.map((pdf) => (
        <PDFDocument
          key={`${pdf.label}-${pdf.url || 'empty'}`}
          url={pdf.url}
          label={pdf.label}
          emptyMessage={pdf.emptyMessage}
          orientation={pdf.orientation}
        />
      ))}
    </div>
  );
};
