import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { BreadcrumbNavigationProps } from './types';
import { getStatusColorClasses } from './utils/statusUtils';

export const BreadcrumbNavigation: React.FC<BreadcrumbNavigationProps> = ({
  customerName,
  jobName,
  version,
  status,
  onNavigateToHome,
  onNavigateToEstimates,
  onNavigateToCustomer,
  onNavigateToJob
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
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {/* Home button - leads to dashboard */}
        <button
          onClick={onNavigateToHome}
          className="p-1 text-gray-500 hover:text-purple-600 transition-colors"
          title="Back to Dashboard"
        >
          <Home className="w-5 h-5" />
        </button>

        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />

        {/* Job Estimation - leads to navigation page */}
        <span
          className="cursor-pointer text-gray-500 hover:text-purple-600 transition-colors"
          onClick={onNavigateToEstimates}
        >
          Job Estimation
        </span>

        {/* Customer - leads to customer's jobs */}
        {customerName && (
          <>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span
              className={`truncate max-w-[150px] md:max-w-xs ${
                jobName
                  ? 'cursor-pointer text-gray-500 hover:text-purple-600 transition-colors'
                  : `font-medium ${status ? getStatusColor(status) : 'text-purple-600'}`
              }`}
              onClick={jobName ? onNavigateToCustomer : undefined}
            >
              {customerName}
            </span>
          </>
        )}

        {/* Job - leads to job's versions */}
        {jobName && (
          <>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span
              className={`truncate max-w-[150px] md:max-w-xs ${
                version
                  ? 'cursor-pointer text-gray-500 hover:text-purple-600 transition-colors'
                  : `font-medium ${status ? getStatusColor(status) : 'text-purple-600'}`
              }`}
              onClick={version ? onNavigateToJob : undefined}
            >
              {jobName}
            </span>
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
