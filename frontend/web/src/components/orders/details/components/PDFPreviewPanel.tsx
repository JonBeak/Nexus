import React, { useState, useEffect, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { FileText, Loader } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker with HTTPS
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Memoize options outside component to prevent recreation
const pdfOptions = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
};

interface FormUrls {
  master: string;
  estimate: string;
  shop: string;
  customer: string;
  packing: string;
}

interface PDFPreviewPanelProps {
  formUrls: FormUrls | null;
}

interface PDFDocumentProps {
  url: string;
  label: string;
}

const PDFDocument: React.FC<PDFDocumentProps> = ({ url, label }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset state when URL changes
  useEffect(() => {
    setNumPages(null);
    setLoading(true);
    setError(null);
  }, [url]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error(`Failed to load ${label}:`, error);
    setError('Failed to load PDF');
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center">
          <FileText className="w-4 h-4 mr-2" />
          {label}
        </h3>
      </div>
      <div className="p-4 bg-gray-50">
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
                    width={800}
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

const PDFPreviewPanel: React.FC<PDFPreviewPanelProps> = React.memo(({ formUrls }) => {
  if (!formUrls) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p>No forms available for preview</p>
        </div>
      </div>
    );
  }

  const forms = [
    { label: 'Master Form', url: formUrls.master },
    { label: 'Estimate', url: formUrls.estimate },
    { label: 'Shop Form', url: formUrls.shop },
    { label: 'Customer Specs', url: formUrls.customer },
    { label: 'Packing List', url: formUrls.packing }
  ];

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-4">
      <div className="space-y-4">
        {forms.map((form) => (
          <PDFDocument key={form.url} url={form.url} label={form.label} />
        ))}
      </div>
    </div>
  );
});

PDFPreviewPanel.displayName = 'PDFPreviewPanel';

export default PDFPreviewPanel;
