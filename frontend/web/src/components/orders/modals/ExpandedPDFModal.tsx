/**
 * ExpandedPDFModal Component
 * Fullscreen PDF viewer with pinch-zoom on mobile and wheel zoom on desktop.
 * Opens at z-[80] to overlay parent modals.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { X, ZoomIn, ZoomOut, RotateCcw, Loader, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePinchZoom } from '../../../hooks/usePinchZoom';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const pdfOptions = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
};

interface ExpandedPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfSource: string;      // URL or base64 data
  isBase64?: boolean;
  title?: string;
}

const ExpandedPDFModal: React.FC<ExpandedPDFModalProps> = ({
  isOpen,
  onClose,
  pdfSource,
  isBase64 = false,
  title = 'PDF Viewer',
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Lock body scroll when modal is open
  useBodyScrollLock(isOpen);

  // Pinch-zoom hook
  const { state: zoomState, handlers: zoomHandlers, reset: resetZoom, zoomIn, zoomOut } = usePinchZoom({
    minScale: 1,
    maxScale: 4,
    doubleTapZoom: 2,
  });

  // Measure container size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({
          width: rect.width,
          height: rect.height,
        });
      }
    };

    if (isOpen) {
      // Small delay to ensure container is rendered
      setTimeout(updateSize, 50);
      window.addEventListener('resize', updateSize);
    }

    return () => window.removeEventListener('resize', updateSize);
  }, [isOpen]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(1);
      setLoading(true);
      setError(null);
      resetZoom();
    }
  }, [isOpen, pdfSource, resetZoom]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      } else if (e.key === 'ArrowLeft' && numPages && currentPage > 1) {
        setCurrentPage(prev => prev - 1);
      } else if (e.key === 'ArrowRight' && numPages && currentPage < numPages) {
        setCurrentPage(prev => prev + 1);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, numPages, currentPage]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const onDocumentLoadError = (err: Error) => {
    console.error('PDF load error:', err);
    setError('Failed to load PDF');
    setLoading(false);
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      resetZoom();
    }
  };

  const goToNextPage = () => {
    if (numPages && currentPage < numPages) {
      setCurrentPage(prev => prev + 1);
      resetZoom();
    }
  };

  if (!isOpen) return null;

  // Prepare the file source
  const fileSource = isBase64 ? `data:application/pdf;base64,${pdfSource}` : pdfSource;

  // Calculate PDF page width to fit container (with padding)
  const pageWidth = Math.max(280, containerSize.width - 32);

  // Transform style for zoom/pan
  const transformStyle: React.CSSProperties = {
    transform: `scale(${zoomState.scale}) translate(${zoomState.translateX / zoomState.scale}px, ${zoomState.translateY / zoomState.scale}px)`,
    transformOrigin: 'center center',
    cursor: zoomState.scale > 1 ? 'grab' : 'default',
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-black bg-opacity-80 border-b border-gray-800">
        <h2 className="text-white font-medium text-sm truncate flex-1 mr-4">
          {title}
        </h2>
        <button
          onClick={onClose}
          className="p-2 text-white hover:bg-white hover:bg-opacity-10 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* PDF Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden flex items-center justify-center bg-gray-900"
        {...zoomHandlers}
        style={{ touchAction: 'none' }}
      >
        {loading && (
          <div className="flex items-center justify-center text-white">
            <Loader className="w-8 h-8 animate-spin" />
            <span className="ml-3">Loading PDF...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center text-red-400">
            <AlertCircle className="w-6 h-6 mr-2" />
            <span>{error}</span>
          </div>
        )}

        {!error && containerSize.width > 0 && (
          <div style={transformStyle}>
            <Document
              file={fileSource}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading=""
              error=""
              options={pdfOptions}
            >
              <Page
                pageNumber={currentPage}
                width={pageWidth}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="flex-shrink-0 bg-black bg-opacity-80 border-t border-gray-800 px-4 py-2">
        <div className="flex items-center justify-between">
          {/* Page Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={goToPrevPage}
              disabled={currentPage <= 1}
              className="p-2 text-white hover:bg-white hover:bg-opacity-10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-white text-sm px-2 min-w-[80px] text-center">
              {numPages ? `${currentPage} / ${numPages}` : '-'}
            </span>
            <button
              onClick={goToNextPage}
              disabled={!numPages || currentPage >= numPages}
              className="p-2 text-white hover:bg-white hover:bg-opacity-10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Next page"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={zoomOut}
              disabled={zoomState.scale <= 1}
              className="p-2 text-white hover:bg-white hover:bg-opacity-10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <span className="text-white text-sm px-2 min-w-[60px] text-center">
              {Math.round(zoomState.scale * 100)}%
            </span>
            <button
              onClick={zoomIn}
              disabled={zoomState.scale >= 4}
              className="p-2 text-white hover:bg-white hover:bg-opacity-10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            <button
              onClick={resetZoom}
              disabled={zoomState.scale === 1 && zoomState.translateX === 0 && zoomState.translateY === 0}
              className="p-2 text-white hover:bg-white hover:bg-opacity-10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center ml-1"
              aria-label="Reset zoom"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Zoom hint on mobile */}
        {isMobile && zoomState.scale === 1 && (
          <p className="text-gray-400 text-xs text-center mt-2">
            Pinch to zoom or double-tap
          </p>
        )}
      </div>
    </div>
  );
};

export default ExpandedPDFModal;
