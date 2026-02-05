/**
 * OrderFormPdfPreview - Inline PDF preview for order forms
 * Used in MaterialRequirementsConfirmationModal to show master order form.
 * Reuses react-pdf pattern from PrintFormsModal.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Loader2, FileText } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const pdfOptions = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
};

const PDF_WIDTHS = [612, 765, 918, 1224]; // Clean multiples of LETTER page width

interface OrderFormPdfPreviewProps {
  url: string | null;
}

const OrderFormPdfPreview: React.FC<OrderFormPdfPreviewProps> = ({ url }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileNotFound, setFileNotFound] = useState(false);
  const [containerWidth, setContainerWidth] = useState(612);
  const containerRef = useRef<HTMLDivElement>(null);
  // Track whether the Document's internal proxy is still valid
  const documentReadyRef = useRef(false);

  useEffect(() => {
    documentReadyRef.current = false;
    setFileNotFound(false);
    setLoading(true);
    setError(null);
    setNumPages(null);
  }, [url]);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const availableWidth = containerRef.current.offsetWidth - 16;
        const cleanWidth = PDF_WIDTHS.filter(w => w <= availableWidth).pop() || 612;
        setContainerWidth(cleanWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const onDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    documentReadyRef.current = true;
    setNumPages(n);
    setLoading(false);
  }, []);

  const onDocumentLoadError = useCallback((err: any) => {
    documentReadyRef.current = false;
    if (err.status === 404 || err.missing || err.message?.includes('sendWithPromise') || err.message?.includes('worker')) {
      setFileNotFound(true);
      setError(null);
    } else {
      setError('Failed to load PDF');
    }
    setLoading(false);
  }, []);

  // Silently swallow Page-level errors (stale worker transport race condition)
  const onPageError = useCallback(() => {}, []);

  if (!url || fileNotFound) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
        <div className="text-center text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-2" />
          <p className="text-sm">Order form not available</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full overflow-y-auto bg-gray-100 rounded-lg">
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          <span className="ml-2 text-sm text-gray-600">Loading PDF...</span>
        </div>
      )}
      {error && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      <Document
        key={url}
        file={url}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={onDocumentLoadError}
        loading=""
        error=""
        options={pdfOptions}
      >
        {!loading && !error && numPages && documentReadyRef.current && (
          <div className="space-y-2 p-2">
            {Array.from(new Array(numPages), (_, index) => (
              <div key={`page_${index + 1}`} className="flex justify-center">
                <Page
                  pageNumber={index + 1}
                  width={containerWidth}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  error=""
                  onLoadError={onPageError}
                  onRenderError={onPageError}
                />
              </div>
            ))}
          </div>
        )}
      </Document>
    </div>
  );
};

export default React.memo(OrderFormPdfPreview);
