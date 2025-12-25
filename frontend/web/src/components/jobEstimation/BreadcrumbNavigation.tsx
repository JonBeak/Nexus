import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home, Copy, Check, CheckCircle } from 'lucide-react';
import { BreadcrumbNavigationProps } from './types';
import { getStatusColorClasses } from './utils/statusUtils';

export const BreadcrumbNavigation: React.FC<BreadcrumbNavigationProps> = ({
  customerName,
  jobName,
  version,
  status,
  customerId,
  jobId,
  onNavigateToHome,
  onNavigateToEstimates,
  onNavigateToCustomer,
  onNavigateToJob,
  showCopySvg,
  copySvgSuccess,
  onCopySvg,
  showConvertToOrder,
  onConvertToOrder
}) => {
  const getStatusColor = (status?: string) => {
    if (!status) return 'text-gray-700';

    const colorClasses = getStatusColorClasses(status);
    const textColorMatch = colorClasses.match(/text-([a-z]+)-([0-9]+)/);

    if (textColorMatch) {
      const [, color] = textColorMatch;
      return `text-${color}-600`;
    }

    return 'text-gray-700';
  };

  const getStatusBadge = (status?: string) => {
    if (!status || status === 'Draft') return null;

    const colorClass = getStatusColorClasses(status);

    return (
      <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
        {status}
      </span>
    );
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-4">
      <div className="flex items-center justify-between mb-2 sm:mb-0">
        {/* LEFT: Breadcrumb navigation */}
        <div className="flex flex-wrap items-center gap-2 text-sm flex-1">
        {/* Home button - leads to dashboard */}
        <Link
          to="/dashboard"
          onClick={(e) => {
            if (onNavigateToHome) {
              e.preventDefault();
              onNavigateToHome();
            }
          }}
          className="p-1 text-gray-500 hover:text-purple-600 transition-colors"
          title="Back to Dashboard"
        >
          <Home className="w-5 h-5" />
        </Link>

        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />

        {/* Job Estimation - leads to navigation page */}
        <Link
          to="/estimates"
          onClick={(e) => {
            if (onNavigateToEstimates) {
              e.preventDefault();
              onNavigateToEstimates();
            }
          }}
          className="text-gray-500 hover:text-purple-600 transition-colors"
        >
          Job Estimation
        </Link>

        {/* Customer - leads to customer's jobs */}
        {customerName && (
          <>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            {jobName && customerId ? (
              <Link
                to={`/estimates?cid=${customerId}`}
                onClick={(e) => {
                  if (onNavigateToCustomer) {
                    e.preventDefault();
                    onNavigateToCustomer();
                  }
                }}
                className="truncate max-w-[150px] md:max-w-xs text-gray-500 hover:text-purple-600 transition-colors"
              >
                {customerName}
              </Link>
            ) : (
              <span className={`truncate max-w-[150px] md:max-w-xs font-medium ${status ? getStatusColor(status) : 'text-purple-600'}`}>
                {customerName}
              </span>
            )}
          </>
        )}

        {/* Job - leads to job's versions */}
        {jobName && (
          <>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            {version && customerId && jobId ? (
              <Link
                to={`/estimates?cid=${customerId}&jid=${jobId}`}
                onClick={(e) => {
                  if (onNavigateToJob) {
                    e.preventDefault();
                    onNavigateToJob();
                  }
                }}
                className="truncate max-w-[150px] md:max-w-xs text-gray-500 hover:text-purple-600 transition-colors"
              >
                {jobName}
              </Link>
            ) : (
              <span className={`truncate max-w-[150px] md:max-w-xs font-medium ${status ? getStatusColor(status) : 'text-purple-600'}`}>
                {jobName}
              </span>
            )}
          </>
        )}

        {/* Version - current page, no click */}
        {version && (
          <>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className={`font-medium ${status ? getStatusColor(status) : 'text-purple-600'}`}>
              {version}
            </span>
            {status && getStatusBadge(status)}
          </>
        )}
        </div>

        {/* RIGHT: Action buttons */}
        {(onCopySvg || onConvertToOrder) && (
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            {/* Copy SVG Button */}
            {showCopySvg && (
              <button
                onClick={onCopySvg}
                className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded transition-colors flex-shrink-0 ${
                  copySvgSuccess
                    ? 'bg-green-100 text-green-700'
                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                }`}
              >
                {copySvgSuccess ? (
                  <>
                    <Check className="w-4 h-4 flex-shrink-0" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 flex-shrink-0" />
                    Copy SVG
                  </>
                )}
              </button>
            )}

            {/* Convert to Order Button */}
            {showConvertToOrder && (
              <button
                onClick={onConvertToOrder}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors flex-shrink-0"
              >
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                Convert to Order
              </button>
            )}
          </div>
        )}
      </div>

      {/* Additional context information */}
      {version && status && (
        <div className="mt-2 text-xs text-gray-500">
          {status === 'Draft' && (
            <span className="flex items-center">
              <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></div>
              This estimate can be edited
            </span>
          )}
          {status !== 'Draft' && (
            <span className="flex items-center">
              <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
              This estimate is finalized and cannot be edited
            </span>
          )}
        </div>
      )}
    </nav>
  );
};
