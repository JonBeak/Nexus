import React, { useCallback, useEffect, useState } from 'react';
import { Package, AlertTriangle, CheckCircle, ShoppingCart, Plus, Calendar, User, FileText, Check } from 'lucide-react';
import type { User as AccountUser } from '../accounts/hooks/useAccountAPI';

interface MaterialRequirement {
  id: string;
  category: string;
  specification: string;
  quantity_needed: number;
  quantity_available: number;
  quantity_used?: number;
  unit: string;
  status: 'in_stock' | 'partial' | 'out_of_stock' | 'used';
  suggested_products?: {
    id: number;
    name: string;
    supplier_name: string;
    current_price?: number;
  }[];
}

interface JobMaterialRequirement {
  job_id: number;
  job_number: string;
  job_name: string;
  customer_name: string;
  start_date?: string;
  priority: 'high' | 'medium' | 'low';
  materials_planned: boolean;
  materials_needed: MaterialRequirement[];
  total_missing_items: number;
}

interface JobMaterialRequirementsProps {
  user?: AccountUser;
  onAddToCart?: (items: MaterialRequirement[]) => void;
  showNotification: (message: string, type?: 'success' | 'error') => void;
}

export const JobMaterialRequirements: React.FC<JobMaterialRequirementsProps> = ({
  user,
  onAddToCart,
  showNotification
}) => {
  void user;
  const [jobs, setJobs] = useState<JobMaterialRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<number | null>(null);
  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [, setEditingJobId] = useState<number | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<{jobId: number, materialId: string} | null>(null);
  const [usageQuantity, setUsageQuantity] = useState<number>(0);

  const loadJobsNeedingMaterials = useCallback(async () => {
    try {
      setLoading(true);
      
      // Mock data for now - will connect to real API later
      const mockJobs: JobMaterialRequirement[] = [
        {
          job_id: 1234,
          job_number: 'J-2025-001',
          job_name: '24"x36" Vinyl Sign - Main Street Store',
          customer_name: 'Acme Signage Co.',
          start_date: '2025-01-20',
          priority: 'high',
          materials_planned: true,
          total_missing_items: 2,
          materials_needed: [
            {
              id: '1',
              category: 'Vinyl',
              specification: '3M 180C Red, 24" width',
              quantity_needed: 5,
              quantity_available: 0,
              unit: 'yards',
              status: 'out_of_stock',
              suggested_products: [
                { id: 1, name: '3M 180C Red 24"', supplier_name: '3M Preferred', current_price: 12.50 }
              ]
            },
            {
              id: '2', 
              category: 'Vinyl',
              specification: '3M 180C White, 24" width',
              quantity_needed: 2,
              quantity_available: 8,
              unit: 'yards', 
              status: 'in_stock'
            },
            {
              id: '3',
              category: 'LED',
              specification: '12mm White LEDs',
              quantity_needed: 50,
              quantity_available: 12,
              unit: 'pieces',
              status: 'partial',
              suggested_products: [
                { id: 2, name: '12mm White LED Module', supplier_name: 'LED Supply Co', current_price: 2.75 }
              ]
            }
          ]
        },
        {
          job_id: 1235,
          job_number: 'J-2025-002', 
          job_name: 'LED Channel Letters - Downtown Restaurant',
          customer_name: 'Metro Signs Ltd.',
          start_date: '2025-01-22',
          priority: 'medium',
          materials_planned: false,
          total_missing_items: 0,
          materials_needed: []
        },
        {
          job_id: 1236,
          job_number: 'J-2025-003',
          job_name: 'Vehicle Wrap - Delivery Van',
          customer_name: 'QuickPrint Solutions',
          start_date: '2025-01-25', 
          priority: 'medium',
          materials_planned: true,
          total_missing_items: 3,
          materials_needed: [
            {
              id: '4',
              category: 'Vinyl',
              specification: 'Avery 1005 White, 54" width',
              quantity_needed: 15,
              quantity_available: 5,
              unit: 'yards',
              status: 'partial',
              suggested_products: [
                { id: 3, name: 'Avery 1005 White 54"', supplier_name: 'Avery Dennison', current_price: 8.95 }
              ]
            }
          ]
        }
      ];
      
      setJobs(mockJobs);
    } catch (error) {
      console.error('Error loading jobs:', error);
      showNotification('Failed to load jobs needing materials', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    void loadJobsNeedingMaterials();
  }, [loadJobsNeedingMaterials]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_stock': return 'text-green-600 bg-green-100';
      case 'partial': return 'text-yellow-600 bg-yellow-100';
      case 'out_of_stock': return 'text-red-600 bg-red-100';
      case 'used': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'in_stock': return <CheckCircle className="w-4 h-4" />;
      case 'partial': return <AlertTriangle className="w-4 h-4" />;
      case 'out_of_stock': return <AlertTriangle className="w-4 h-4" />;
      case 'used': return <Check className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-red-500';
      case 'medium': return 'border-l-yellow-500';
      case 'low': return 'border-l-green-500';
      default: return 'border-l-gray-500';
    }
  };

  const handleAddMissingToCart = (job: JobMaterialRequirement) => {
    const missingItems = job.materials_needed.filter(m => m.status !== 'in_stock');
    
    if (missingItems.length === 0) {
      showNotification('No missing materials to add to cart');
      return;
    }

    // For now, just show notification - will implement cart functionality later
    showNotification(`Would add ${missingItems.length} missing items from ${job.job_number} to cart`, 'success');
    
    if (onAddToCart) {
      onAddToCart(missingItems);
    }
  };

  const handlePlanMaterials = (jobId: number) => {
    setEditingJobId(jobId);
    setShowAddMaterialModal(true);
  };

  const handleMarkAsUsed = (jobId: number, materialId: string, quantityNeeded: number) => {
    setEditingMaterial({ jobId, materialId });
    setUsageQuantity(quantityNeeded); // Default to the needed quantity
  };

  const confirmUsage = () => {
    if (!editingMaterial) return;
    
    // Update the material status in the jobs array
    setJobs(prevJobs => 
      prevJobs.map(job => {
        if (job.job_id === editingMaterial.jobId) {
          return {
            ...job,
            materials_needed: job.materials_needed.map(material => {
              if (material.id === editingMaterial.materialId) {
                return {
                  ...material,
                  status: 'used' as const,
                  quantity_used: usageQuantity
                };
              }
              return material;
            })
          };
        }
        return job;
      })
    );
    
    showNotification(`Marked ${usageQuantity} units as used for this job`, 'success');
    setEditingMaterial(null);
    setUsageQuantity(0);
  };

  const cancelUsage = () => {
    setEditingMaterial(null);
    setUsageQuantity(0);
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
        <p className="mt-2 text-sm text-gray-600">Loading jobs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Jobs Needing Materials</h3>
        <div className="text-sm text-gray-500">
          {jobs.filter(j => j.total_missing_items > 0).length} jobs need materials
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <Calendar className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">No jobs currently need material planning</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div key={job.job_id} className={`bg-white rounded-lg border border-gray-200 shadow-sm ${getPriorityColor(job.priority)} border-l-4`}>
              <div className="p-4">
                {/* Job Header */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium text-gray-900">{job.job_number}</h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        job.priority === 'high' ? 'bg-red-100 text-red-800' :
                        job.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {job.priority} priority
                      </span>
                      {job.total_missing_items > 0 && (
                        <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                          {job.total_missing_items} missing
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{job.job_name}</p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                      <span className="flex items-center">
                        <User className="w-3 h-3 mr-1" />
                        {job.customer_name}
                      </span>
                      {job.start_date && (
                        <span className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          Start: {new Date(job.start_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {!job.materials_planned ? (
                      <button
                        onClick={() => handlePlanMaterials(job.job_id)}
                        className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Plan Materials</span>
                      </button>
                    ) : job.total_missing_items > 0 ? (
                      <button
                        onClick={() => handleAddMissingToCart(job)}
                        className="flex items-center space-x-1 px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        <ShoppingCart className="w-3 h-3" />
                        <span>Add Missing to Cart</span>
                      </button>
                    ) : (
                      <span className="flex items-center space-x-1 px-3 py-1 text-sm bg-green-100 text-green-700 rounded">
                        <CheckCircle className="w-3 h-3" />
                        <span>Materials Ready</span>
                      </span>
                    )}
                    
                    <button
                      onClick={() => setSelectedJob(selectedJob === job.job_id ? null : job.job_id)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Materials List (Expanded) */}
                {selectedJob === job.job_id && job.materials_needed.length > 0 && (
                  <div className="border-t border-gray-100 pt-4 mt-3">
                    <div className="space-y-3">
                      {job.materials_needed.map((material) => (
                        <div key={material.id} className="bg-gray-100 border border-gray-200 rounded-lg p-4 shadow-sm">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <span className={`px-3 py-1 text-sm rounded-full flex items-center space-x-2 font-medium ${getStatusColor(material.status)}`}>
                                  {getStatusIcon(material.status)}
                                  <span>{material.status === 'out_of_stock' ? 'Out of Stock' : material.status === 'in_stock' ? 'In Stock' : material.status.replace('_', ' ')}</span>
                                </span>
                                <span className="text-sm font-medium text-gray-700">{material.category}</span>
                              </div>
                              
                              <h4 className="text-base font-semibold text-gray-900 mb-2">{material.specification}</h4>
                              
                              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                                <div>
                                  <span className="font-medium">Required:</span> {material.quantity_needed} {material.unit}
                                </div>
                                <div>
                                  <span className="font-medium">Available:</span> {material.quantity_available} {material.unit}
                                </div>
                                {material.quantity_used && (
                                  <>
                                    <div>
                                      <span className="font-medium">Used:</span> {material.quantity_used} {material.unit}
                                    </div>
                                    <div className="text-green-600">
                                      <span className="font-medium">Status:</span> Complete
                                    </div>
                                  </>
                                )}
                              </div>
                              
                              {material.status === 'partial' && (
                                <div className="mt-2 p-2 bg-yellow-50 rounded border border-yellow-200">
                                  <span className="text-sm text-yellow-700 font-medium">
                                    ⚠️ Short by: {material.quantity_needed - material.quantity_available} {material.unit}
                                  </span>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex flex-col items-end space-y-2 ml-4">
                              {/* Action buttons */}
                              {material.status === 'in_stock' && !material.quantity_used && (
                                <button
                                  onClick={() => handleMarkAsUsed(job.job_id, material.id, material.quantity_needed)}
                                  className="flex items-center space-x-1 px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 border border-green-300"
                                >
                                  <Check className="w-4 h-4" />
                                  <span>Mark as Used</span>
                                </button>
                              )}
                              
                              {material.status !== 'in_stock' && material.status !== 'used' && material.suggested_products && (
                                <div className="text-right">
                                  <div className="text-xs text-gray-500 mb-1">
                                    {material.suggested_products[0].supplier_name}
                                  </div>
                                  <div className="text-sm font-medium text-gray-700 mb-2">
                                    ${material.suggested_products[0].current_price}/unit
                                  </div>
                                  <button className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 border border-blue-300">
                                    <ShoppingCart className="w-4 h-4" />
                                    <span>Add to Cart</span>
                                  </button>
                                </div>
                              )}
                              
                              {material.status === 'used' && (
                                <div className="text-right">
                                  <div className="text-sm text-blue-600 font-medium mb-1">✓ Complete</div>
                                  <div className="text-xs text-gray-500">Used: {material.quantity_used} {material.unit}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mark as Used Modal */}
      {editingMaterial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Mark Material as Used</h2>
              <div className="mb-4">
                <p className="text-gray-600 mb-3">
                  How much of this material was actually used for this job?
                </p>
                <div className="flex items-center space-x-3">
                  <label className="text-sm font-medium text-gray-700">Quantity Used:</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={usageQuantity}
                    onChange={(e) => setUsageQuantity(Number(e.target.value))}
                    className="w-24 px-3 py-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-sm text-gray-500">
                    {jobs.find(j => j.job_id === editingMaterial.jobId)?.materials_needed.find(m => m.id === editingMaterial.materialId)?.unit}
                  </span>
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={cancelUsage}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmUsage}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Mark as Used
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Material Planning Modal */}
      {showAddMaterialModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Plan Materials for Job</h2>
              <p className="text-gray-600 mb-4">
                Material planning functionality will be implemented next. For now, you can manually add material requirements.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowAddMaterialModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    showNotification('Material planning feature coming soon!');
                    setShowAddMaterialModal(false);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Coming Soon
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
