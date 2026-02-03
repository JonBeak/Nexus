/**
 * Expected Files Table Component
 * Displays comparison of expected vs actual AI files in order folder
 */

import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileType,
  Loader,
  RefreshCw,
  Info,
} from 'lucide-react';
import { PAGE_STYLES } from '../../../../constants/moduleColors';
import { aiFileValidationApi } from '../../../../services/api';
import {
  ExpectedFilesComparison,
  FileComparisonEntry,
  FileComparisonStatus,
} from '../../../../types/aiFileValidation';

interface ExpectedFilesTableProps {
  orderNumber: number;
  onRefresh?: () => void;
}

// Status icon component
const StatusIcon: React.FC<{ status: FileComparisonStatus; isRequired: boolean }> = ({
  status,
  isRequired,
}) => {
  switch (status) {
    case 'present':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'missing':
      return isRequired ? (
        <XCircle className="w-4 h-4 text-red-500" />
      ) : (
        <AlertTriangle className="w-4 h-4 text-orange-400" />
      );
    case 'unexpected':
      return <Info className="w-4 h-4 text-gray-400" />;
    default:
      return null;
  }
};

// Status badge component
const StatusBadge: React.FC<{ status: FileComparisonStatus; isRequired: boolean }> = ({
  status,
  isRequired,
}) => {
  const getColors = () => {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-800';
      case 'missing':
        return isRequired ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800';
      case 'unexpected':
        return 'bg-gray-100 text-gray-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'present':
        return 'Present';
      case 'missing':
        return isRequired ? 'Missing' : 'Optional';
      case 'unexpected':
        return 'Unexpected';
      default:
        return status;
    }
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getColors()}`}>
      {getLabel()}
    </span>
  );
};

// Summary badges component
const SummaryBadges: React.FC<{ summary: ExpectedFilesComparison['summary'] }> = ({ summary }) => {
  return (
    <div className="flex flex-wrap gap-2">
      {summary.total_expected > 0 && (
        <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
          {summary.total_expected} Expected
        </span>
      )}
      {summary.present > 0 && (
        <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
          {summary.present} Present
        </span>
      )}
      {summary.missing_required > 0 && (
        <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
          {summary.missing_required} Missing
        </span>
      )}
      {summary.missing_optional > 0 && (
        <span className="px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">
          {summary.missing_optional} Optional
        </span>
      )}
      {summary.unexpected > 0 && (
        <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
          {summary.unexpected} Unexpected
        </span>
      )}
    </div>
  );
};

// File row component
const FileRow: React.FC<{ file: FileComparisonEntry }> = ({ file }) => {
  const getRowBackground = () => {
    switch (file.status) {
      case 'present':
        return 'bg-green-50/50';
      case 'missing':
        return file.is_required ? 'bg-red-50/50' : 'bg-orange-50/30';
      case 'unexpected':
        return 'bg-gray-50/50';
      default:
        return '';
    }
  };

  return (
    <tr className={`${getRowBackground()} hover:bg-gray-50`}>
      <td className="px-3 py-2 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <FileType className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="font-medium text-gray-800 text-sm">{file.filename}</span>
        </div>
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600">
        {file.detected_ai_version || '-'}
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <StatusIcon status={file.status} isRequired={file.is_required} />
          <StatusBadge status={file.status} isRequired={file.is_required} />
        </div>
      </td>
      <td className="px-3 py-2 text-sm text-gray-500">
        {file.matched_rules.length > 0 ? file.matched_rules.join(', ') : '-'}
      </td>
    </tr>
  );
};

const ExpectedFilesTable: React.FC<ExpectedFilesTableProps> = ({ orderNumber, onRefresh }) => {
  const [data, setData] = useState<ExpectedFilesComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await aiFileValidationApi.getExpectedFilesComparison(orderNumber);
      setData(result);
    } catch (err) {
      console.error('Error loading expected files comparison:', err);
      setError('Failed to load expected files comparison');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [orderNumber]);

  const handleRefresh = () => {
    loadData();
    onRefresh?.();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader className="w-6 h-6 animate-spin text-indigo-500" />
        <span className="ml-2 text-gray-600">Loading expected files...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-700">
          <XCircle className="w-5 h-5" />
          <span className="font-medium">Error</span>
        </div>
        <p className="text-sm text-red-600 mt-1">{error}</p>
        <button
          onClick={handleRefresh}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const hasExpectedFiles = data.summary.total_expected > 0;
  const hasFiles = data.files.length > 0;
  const folderExists = data.folder_exists;

  return (
    <div className={`${PAGE_STYLES.panel.background} rounded-lg border ${PAGE_STYLES.border}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className={`font-medium ${PAGE_STYLES.panel.text}`}>Expected Files</h3>
          {hasExpectedFiles && (
            <div className="mt-2">
              <SummaryBadges summary={data.summary} />
            </div>
          )}
        </div>
        <button
          onClick={handleRefresh}
          className="p-1.5 rounded hover:bg-gray-100 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${PAGE_STYLES.panel.textMuted}`} />
        </button>
      </div>

      {/* Content */}
      {!folderExists ? (
        <div className="px-4 py-8 text-center">
          <AlertTriangle className="w-8 h-8 mx-auto text-orange-400" />
          <p className="text-gray-600 mt-2">Order folder not found</p>
          <p className="text-xs text-gray-400 mt-1">
            Create the order folder to enable file validation
          </p>
        </div>
      ) : !hasExpectedFiles && !hasFiles ? (
        <div className="px-4 py-8 text-center">
          <Info className="w-8 h-8 mx-auto text-gray-300" />
          <p className="text-gray-500 mt-2">No file expectation rules configured</p>
          <p className="text-xs text-gray-400 mt-1">
            Configure rules in the database to enable file checking
          </p>
        </div>
      ) : !hasFiles ? (
        <div className="px-4 py-8 text-center">
          <FileType className="w-8 h-8 mx-auto text-gray-300" />
          <p className="text-gray-500 mt-2">No AI files found in order folder</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-3 py-2">File</th>
                <th className="px-3 py-2">AI Version</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">From Rules</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.files.map((file, index) => (
                <FileRow key={`${file.filename}-${index}`} file={file} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Status summary at bottom if there are issues */}
      {data.summary.missing_required > 0 && (
        <div className="px-4 py-3 bg-red-50 border-t border-red-200">
          <div className="flex items-center gap-2 text-red-700 text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>
              {data.summary.missing_required} required file{data.summary.missing_required > 1 ? 's' : ''} missing
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpectedFilesTable;
