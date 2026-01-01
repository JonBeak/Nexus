/**
 * Estimate PDF Preview Component
 * Phase 4.c - PDF Preview in Send to Customer Modal
 *
 * Displays QuickBooks estimate PDF in the send modal.
 * Uses react-pdf for rendering.
 */

import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { FileText, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { jobVersioningApi } from '../../../services/jobVersioningApi';
import { PAGE_STYLES } from '../../../constants/moduleColors';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker with HTTPS
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// PDF options for react-pdf
const pdfOptions = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
};

// Simple in-memory cache for PDFs (keyed by estimateId)
// Persists across modal open/close within the same session
const pdfCache = new Map<number, { dataUrl: string; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface Props {
  estimateId: number;
  onLoadError?: () => void;
}

export const EstimatePdfPreview: React.FC<Props> = ({
  estimateId,
  onLoadError
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Load PDF from backend (with caching)
  const loadPdf = async () => {
    try {
      setLoading(true);
      setError(null);
      setPdfData(null);

      // Check cache first
      const cached = pdfCache.get(estimateId);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
        console.log('Using cached PDF for estimate', estimateId);
        setPdfData(cached.dataUrl);
        setLoading(false);
        return;
      }

      // Fetch from backend
      const response = await jobVersioningApi.getEstimatePdf(estimateId);

      // Handle both wrapped and unwrapped response formats
      const pdfBase64 = response.data?.pdf || response.pdf;

      if (pdfBase64) {
        // Convert base64 to data URL for react-pdf
        const dataUrl = `data:application/pdf;base64,${pdfBase64}`;

        // Cache it
        pdfCache.set(estimateId, { dataUrl, timestamp: Date.now() });
        console.log('Cached PDF for estimate', estimateId);

        setPdfData(dataUrl);
      } else {
        console.error('PDF response structure:', JSON.stringify(response, null, 2));
        throw new Error('Invalid PDF response');
      }
    } catch (err: any) {
      console.error('Error loading estimate PDF:', err);
      const message = err.response?.data?.message || err.message || 'Failed to load PDF';
      setError(message);
      onLoadError?.();
    } finally {
      setLoading(false);
    }
  };

  // Load PDF on mount
  useEffect(() => {
    loadPdf();
  }, [estimateId]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPdfLoading(false);
  };

  const onDocumentLoadError = (error: any) => {
    console.error('PDF document load error:', error);
    setError('Failed to render PDF');
    setPdfLoading(false);
  };

  // Loading state - fetching from backend
  if (loading) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 ${PAGE_STYLES.panel.textMuted}`}>
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
        <p className="text-sm">Loading PDF from QuickBooks...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
          <div className="flex items-center gap-2 text-amber-700">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm font-medium">PDF Preview Unavailable</p>
          </div>
          <p className="text-xs text-amber-600 mt-1">{error}</p>
        </div>
        <button
          onClick={loadPdf}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
        <p className={`text-xs ${PAGE_STYLES.panel.textMuted} mt-4 max-w-xs`}>
          You can still send the email. The customer will receive a link to view the estimate in QuickBooks.
        </p>
      </div>
    );
  }

  // PDF loaded - render it
  return (
    <div className="h-full">
      {pdfLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span className={`ml-2 text-sm ${PAGE_STYLES.panel.textMuted}`}>Rendering PDF...</span>
        </div>
      )}
      <Document
        file={pdfData}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={onDocumentLoadError}
        loading=""
        error=""
        options={pdfOptions}
      >
        {numPages && (
          <div className="space-y-3">
            {Array.from(new Array(numPages), (_, index) => (
              <div key={`page_${index + 1}`} className="bg-white shadow-lg">
                <Page
                  pageNumber={index + 1}
                  width={850}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </div>
            ))}
          </div>
        )}
      </Document>
    </div>
  );
};
