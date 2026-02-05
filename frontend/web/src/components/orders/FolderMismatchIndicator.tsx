import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FolderSync, AlertTriangle, Check, X, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { ordersApi } from '../../services/api';
import { PAGE_STYLES } from '../../constants/moduleColors';
import { onOrderStatus, initializeSocket } from '../../services/socketClient';

interface FolderMismatch {
  order_id: number;
  order_number: number;
  order_name: string;
  status: string;
  folder_name: string;
  folder_location: string;
  expected_location: string;
  customer_name: string;
}

export const FolderMismatchIndicator: React.FC = () => {
  const [mismatches, setMismatches] = useState<FolderMismatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [retrying, setRetrying] = useState<number | 'all' | null>(null);
  const [retryResults, setRetryResults] = useState<Record<number, { success: boolean; message: string }>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch mismatches on mount, poll every 30 seconds, and refresh on order status changes
  useEffect(() => {
    fetchMismatches();

    // Poll for mismatches periodically (catches failed folder moves)
    const interval = setInterval(fetchMismatches, 30000);

    // Subscribe to WebSocket order status changes for immediate refresh
    initializeSocket().catch(() => {}); // Ensure socket is connected
    const unsubscribe = onOrderStatus(() => {
      // Small delay to let backend finish folder move attempt
      setTimeout(fetchMismatches, 1000);
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const fetchMismatches = async () => {
    try {
      setLoading(true);
      const mismatches = await ordersApi.getFolderMismatches();
      setMismatches(mismatches || []);
      setRetryResults({});
    } catch (error) {
      console.error('Failed to fetch folder mismatches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryOne = async (orderNumber: number) => {
    setRetrying(orderNumber);
    try {
      const result = await ordersApi.retryFolderMove(orderNumber);
      setRetryResults(prev => ({
        ...prev,
        [orderNumber]: { success: result.success, message: result.message }
      }));
      if (result.success) {
        // Remove from list after short delay to show success
        setTimeout(() => {
          setMismatches(prev => prev.filter(m => m.order_number !== orderNumber));
        }, 1500);
      }
    } catch (error) {
      setRetryResults(prev => ({
        ...prev,
        [orderNumber]: { success: false, message: 'Request failed' }
      }));
    } finally {
      setRetrying(null);
    }
  };

  const handleRetryAll = async () => {
    setRetrying('all');
    try {
      const result = await ordersApi.retryAllFolderMoves();
      // Update results for each order
      const newResults: Record<number, { success: boolean; message: string }> = {};
      result.results.forEach(r => {
        newResults[r.order_number] = { success: r.success, message: r.message };
      });
      setRetryResults(newResults);
      // Refresh the list after a delay
      setTimeout(() => {
        fetchMismatches();
      }, 2000);
    } catch (error) {
      console.error('Failed to retry all folder moves:', error);
    } finally {
      setRetrying(null);
    }
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const formatLocation = (location: string) => {
    if (location === 'active') return 'Orders/';
    if (location === 'finished') return '1Finished/';
    if (location === 'cancelled') return '1Cancelled/';
    if (location === 'hold') return '1Hold/';
    return location;
  };

  // Don't render anything if no mismatches and not loading
  if (!loading && mismatches.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Indicator Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={loading}
        className={`
          flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors
          ${loading ? 'opacity-50 cursor-wait' : ''}
          ${mismatches.length > 0
            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-300'
            : `${PAGE_STYLES.panel.background} ${PAGE_STYLES.panel.textMuted}`
          }
        `}
        title={mismatches.length > 0 ? `${mismatches.length} folder(s) need attention` : 'Checking folders...'}
      >
        <FolderSync className="w-4 h-4" />
        {loading ? (
          <RefreshCw className="w-3 h-3 animate-spin" />
        ) : (
          <>
            <span className="hidden sm:inline">Folders</span>
            {mismatches.length > 0 && (
              <span className="bg-amber-600 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {mismatches.length}
              </span>
            )}
            {showDropdown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </>
        )}
      </button>

      {/* Dropdown Panel */}
      {showDropdown && mismatches.length > 0 && (
        <div className={`
          absolute left-0 top-full mt-2 z-50 w-[420px] max-h-[400px]
          ${PAGE_STYLES.panel.background} rounded-lg shadow-xl border ${PAGE_STYLES.panel.border}
          overflow-hidden
        `}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-amber-50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="font-medium text-amber-800">Folder Location Mismatches</span>
            </div>
            <button
              onClick={handleRetryAll}
              disabled={retrying !== null}
              className={`
                flex items-center gap-1 px-2 py-1 text-xs font-medium rounded
                bg-amber-600 text-white hover:bg-amber-700 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {retrying === 'all' ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              Retry All
            </button>
          </div>

          {/* Mismatch List */}
          <div className="overflow-y-auto max-h-[320px]">
            {mismatches.map(mismatch => {
              const result = retryResults[mismatch.order_number];
              const isRetrying = retrying === mismatch.order_number;

              return (
                <div
                  key={mismatch.order_id}
                  className={`
                    px-4 py-3 border-b border-gray-100 last:border-b-0
                    ${result?.success ? 'bg-green-50' : result ? 'bg-red-50' : ''}
                  `}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium text-gray-700">
                          #{mismatch.order_number}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${PAGE_STYLES.panel.backgroundMuted} ${PAGE_STYLES.panel.textMuted}`}>
                          {formatStatus(mismatch.status)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 truncate" title={mismatch.order_name}>
                        {mismatch.order_name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        <span className="text-red-600">{formatLocation(mismatch.folder_location)}</span>
                        {' → '}
                        <span className="text-green-600">{formatLocation(mismatch.expected_location)}</span>
                      </div>
                    </div>

                    {/* Action/Status */}
                    <div className="flex-shrink-0">
                      {result ? (
                        result.success ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <Check className="w-4 h-4" />
                            <span className="text-xs">Moved</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-red-600" title={result.message}>
                            <X className="w-4 h-4" />
                            <span className="text-xs">Failed</span>
                          </div>
                        )
                      ) : (
                        <button
                          onClick={() => handleRetryOne(mismatch.order_number)}
                          disabled={retrying !== null}
                          className={`
                            p-1.5 rounded hover:bg-gray-100 transition-colors
                            disabled:opacity-50 disabled:cursor-not-allowed
                          `}
                          title="Retry folder move"
                        >
                          {isRetrying ? (
                            <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4 text-gray-500 hover:text-gray-700" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500">
              These orders have folders in the wrong location based on their status.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FolderMismatchIndicator;
