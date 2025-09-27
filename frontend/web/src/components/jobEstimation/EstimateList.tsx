import React, { useState, useEffect, useCallback } from 'react';
import { Search, Edit, Trash2, FileText, Calendar, User, Plus } from 'lucide-react';
import { jobEstimationApi } from '../../services/jobEstimationApi';

interface EstimateListProps {
  onCreateNew?: () => void;
  onEditEstimate: (estimate: EstimatePayload) => void;
  showNotification: (message: string, type?: 'success' | 'error') => void;
}

interface EstimateSummary {
  id: number;
  job_code: string;
  estimate_name: string;
  customer_name: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  group_count: number;
  item_count: number;
  created_at: string;
  updated_at: string;
}

type EstimatePayload = EstimateSummary | Record<string, unknown>;

export const EstimateList: React.FC<EstimateListProps> = ({
  onCreateNew,
  onEditEstimate,
  showNotification
}) => {
  const [estimates, setEstimates] = useState<EstimateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const loadEstimates = useCallback(async () => {
    try {
      setLoading(true);
      const response = await jobEstimationApi.getEstimates({
        search: searchTerm || undefined,
        status: statusFilter || undefined,
        limit: 50
      });
      
      // Ensure we have a valid array from the API response
      if (response?.data && Array.isArray(response.data)) {
        setEstimates(response.data);
      } else {
        // If API returns unexpected format, default to empty array
        setEstimates([]);
      }
    } catch (error) {
      console.error('Error loading estimates:', error);
      showNotification('Failed to load estimates', 'error');
      
      // Set mock data for development - don't try to access failed response
      const mockEstimates: EstimateSummary[] = [
        {
          id: 1,
          job_code: 'CH20250830001',
          estimate_name: 'Storefront Channel Letters',
          customer_name: 'Acme Signage Co.',
          status: 'draft',
          subtotal: 750.00,
          tax_amount: 97.50,
          total_amount: 847.50,
          group_count: 1,
          item_count: 3,
          created_at: '2025-01-30T10:00:00Z',
          updated_at: '2025-01-30T14:30:00Z'
        },
        {
          id: 2,
          job_code: 'CH20250830002',
          estimate_name: 'Vehicle Wrap Package',
          customer_name: 'Metro Signs Ltd.',
          status: 'sent',
          subtotal: 1250.00,
          tax_amount: 162.50,
          total_amount: 1412.50,
          group_count: 2,
          item_count: 5,
          created_at: '2025-01-30T09:15:00Z',
          updated_at: '2025-01-30T13:45:00Z'
        }
      ];
      
      setEstimates(mockEstimates);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, showNotification]);

  useEffect(() => {
    loadEstimates();
  }, [loadEstimates]);

  const handleEditEstimate = async (estimate: EstimateSummary) => {
    try {
      const response = await jobEstimationApi.getEstimateById(estimate.id);
      onEditEstimate(response.data);
    } catch (error) {
      console.error('Error loading estimate details:', error);
      showNotification('Failed to load estimate details', 'error');
      // For development, pass the summary data
      onEditEstimate(estimate);
    }
  };

  const handleDeleteEstimate = async (estimateId: number) => {
    if (!confirm('Are you sure you want to delete this estimate?')) {
      return;
    }

    try {
      await jobEstimationApi.deleteEstimate(estimateId);
      setEstimates(prev => prev.filter(est => est.id !== estimateId));
      showNotification('Estimate deleted successfully');
    } catch (error) {
      console.error('Error deleting estimate:', error);
      showNotification('Failed to delete estimate', 'error');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'ordered':
        return 'bg-purple-100 text-purple-800';
      case 'deactivated':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        <p className="mt-2 text-gray-600">Loading estimates...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search estimates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
          
          {/* Status Filter */}
          <div className="w-full sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="approved">Approved</option>
              <option value="ordered">Ordered</option>
              <option value="deactivated">Deactivated</option>
            </select>
          </div>
          
          {onCreateNew && (
            <button
              type="button"
              onClick={onCreateNew}
              className="flex items-center justify-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">New Estimate</span>
            </button>
          )}
        </div>
      </div>

      {/* Estimates List */}
      <div className="bg-white rounded-lg shadow">
        {estimates.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No estimates found</h3>
            <p className="text-gray-500">
              {searchTerm || statusFilter
                ? 'Try adjusting your search criteria'
                : 'Get started by creating your first estimate'}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estimate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Updated
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {estimates.map((estimate) => (
                  <tr key={estimate.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {estimate.estimate_name}
                        </div>
                        <div className="text-sm text-gray-500 font-mono">
                          {estimate.job_code}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {estimate.group_count} groups • {estimate.item_count} items
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <User className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900">
                          {estimate.customer_name || 'No customer'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                          estimate.status
                        )}`}
                      >
                        {estimate.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-sm font-medium text-gray-900">
                        ${estimate.total_amount.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">
                        +${estimate.tax_amount.toFixed(2)} tax
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-sm text-gray-500">
                        <Calendar className="w-4 h-4 mr-1" />
                        {formatDate(estimate.updated_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleEditEstimate(estimate)}
                          className="text-purple-600 hover:text-purple-900 p-1"
                          title="Edit estimate"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteEstimate(estimate.id)}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="Delete estimate"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
