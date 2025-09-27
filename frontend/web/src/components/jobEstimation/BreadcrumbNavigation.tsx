import React from 'react';
import { ChevronRight, Building, Calendar, FileText, Home } from 'lucide-react';
import { BreadcrumbNavigationProps } from './types';
import { getStatusColorClasses } from './utils/statusUtils';

export const BreadcrumbNavigation: React.FC<BreadcrumbNavigationProps> = ({
  customerName,
  jobName,
  version,
  status,
  onNavigateToCustomerSelection,
  onNavigateToJobSelection,
  onNavigateToVersionSelection
}) => {
  const breadcrumbs = [];

  // Job Estimation root
  breadcrumbs.push({
    label: 'Job Estimation',
    icon: Home,
    onClick: onNavigateToCustomerSelection,
    active: !customerName
  });

  // Customer level - only show if we actually have a customer name
  if (customerName) {
    breadcrumbs.push({
      label: customerName,
      icon: Building,
      onClick: onNavigateToCustomerSelection,
      active: !jobName
    });
  }

  // Job level
  if (jobName) {
    breadcrumbs.push({
      label: jobName,
      icon: Calendar,
      onClick: onNavigateToJobSelection,
      active: !version
    });
  }

  // Version level
  if (version) {
    const versionLabel = status ? `${version} (${status})` : version;
    breadcrumbs.push({
      label: versionLabel,
      icon: FileText,
      onClick: onNavigateToVersionSelection,
      active: true
    });
  }

  const getStatusColor = (status?: string) => {
    if (!status) return 'text-gray-700';
    
    // Extract text color from standard color classes
    const colorClasses = getStatusColorClasses(status);
    const textColorMatch = colorClasses.match(/text-([a-z]+)-([0-9]+)/);
    
    if (textColorMatch) {
      const [, color] = textColorMatch;
      return `text-${color}-600`; // Use 600 shade for text
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
    <nav className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center space-x-3 text-base">
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={index}>
            <div
              className={`flex items-center space-x-2 ${
                crumb.onClick 
                  ? 'cursor-pointer hover:text-purple-600 transition-colors' 
                  : ''
              } ${
                crumb.active 
                  ? `font-medium ${status ? getStatusColor(status) : 'text-purple-600'}` 
                  : 'text-gray-500'
              }`}
              onClick={crumb.onClick}
            >
              <crumb.icon className="w-5 h-5 flex-shrink-0" />
              <span className="truncate max-w-xs">{crumb.label}</span>
              
              {/* Status badge for version breadcrumb */}
              {index === breadcrumbs.length - 1 && status && getStatusBadge(status)}
            </div>
            
            {/* Separator */}
            {index < breadcrumbs.length - 1 && (
              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
            )}
          </React.Fragment>
        ))}
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
