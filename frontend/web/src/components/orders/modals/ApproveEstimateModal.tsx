/**
 * File Clean up Finished: Nov 13, 2025
 * Changes:
 * - Removed fallback to getPrimaryContacts() API call (is_primary feature removal)
 * - Added user-friendly error handling for duplicate email attempts (409 Conflict)
 */

import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, X, Plus, Trash2 } from 'lucide-react';
import { apiClient, ordersApi, customerApi, customerContactsApi } from '../../../services/api';
import type { EstimatePreviewData } from '../../jobEstimation/core/layers/CalculationLayer';
import type { PointPersonInput } from '../../../types/orders';
import { validateJobOrOrderName } from '../../../utils/folderNameValidation';

interface ApproveEstimateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (orderNumber: number) => void;
  estimateId: number;
  estimatePreviewData: EstimatePreviewData | null;
  defaultOrderName: string;
  customerId: number;
  jobName?: string;           // Job name for estimate summary
  estimateNotes?: string;     // Estimate version notes/description
  qbEstimateId?: string;      // QuickBooks estimate ID (if sent to QB)
}

interface PointPersonEntry {
  id: string;                 // Temporary ID for React key
  mode: 'existing' | 'custom'; // Mode: existing contact or custom entry
  contact_id?: number;
  contact_email: string;
  contact_name?: string;
  contact_phone?: string;
  contact_role?: string;
  saveToDatabase?: boolean;   // Only applicable for custom contacts
}

export const ApproveEstimateModal: React.FC<ApproveEstimateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  estimateId,
  estimatePreviewData,
  defaultOrderName,
  customerId,
  jobName,
  estimateNotes,
  qbEstimateId
}) => {
  // Existing state
  const [orderName, setOrderName] = useState(defaultOrderName);
  const [customerPo, setCustomerPo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Confirmation for approving without QB estimate
  const [confirmedNoQBEstimate, setConfirmedNoQBEstimate] = useState(false);

  // Phase 1.5.a.5: New state variables
  const [customerJobNumber, setCustomerJobNumber] = useState('');

  // Due Date Tracking
  const [autoCalculatedDate, setAutoCalculatedDate] = useState<string>('');
  const [dueDateManuallyChanged, setDueDateManuallyChanged] = useState(false);
  const [businessDaysFromToday, setBusinessDaysFromToday] = useState<number | null>(null);

  // Hard Due Date/Time (always visible, optional)
  const [hardDueTime, setHardDueTime] = useState('');

  // Special Instructions (modal-specific, appended to customer special_instructions)
  const [modalSpecialInstructions, setModalSpecialInstructions] = useState('');
  const specialInstructionsRef = React.useRef<HTMLTextAreaElement>(null);

  // Point Persons (NEW: Array-based)
  const [pointPersons, setPointPersons] = useState<PointPersonEntry[]>([]);
  const [contactEmails, setContactEmails] = useState<string[]>([]);
  const [allContacts, setAllContacts] = useState<any[]>([]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('🔍 ApproveEstimateModal opened with:', {
        jobName,
        estimateNotes,
        customerId,
        defaultOrderName,
        qbEstimateId
      });
      setOrderName(defaultOrderName);
      setCustomerPo('');
      setCustomerJobNumber('');
      setDueDate('');
      setAutoCalculatedDate('');
      setDueDateManuallyChanged(false);
      setBusinessDaysFromToday(null);
      setHardDueTime('');
      setModalSpecialInstructions('');
      // Don't reset pointPersons here - it will be set by the fetch contacts useEffect
      setContactEmails([]);
      setAllContacts([]);
      setError(null);
      setValidationError(null);
      setConfirmedNoQBEstimate(false);
    }
  }, [isOpen, defaultOrderName, qbEstimateId]);

  // Calculate default due date when modal opens
  useEffect(() => {
    if (isOpen && customerId && !dueDate) {
      customerApi.getCustomer(customerId)
        .then(customer => {
          const turnaroundDays = customer.default_turnaround || 10;

          const today = new Date();
          ordersApi.calculateDueDate(today.toISOString().split('T')[0], turnaroundDays)
            .then(calcResponse => {
              const calculatedDate = calcResponse.dueDate;
              setDueDate(calculatedDate);
              setAutoCalculatedDate(calculatedDate);
              setBusinessDaysFromToday(turnaroundDays);
              setDueDateManuallyChanged(false);
            })
            .catch(error => {
              console.error('Error calculating due date:', error);
              const fallback = new Date();
              fallback.setDate(fallback.getDate() + Math.ceil(turnaroundDays * 1.5));
              const fallbackDate = fallback.toISOString().split('T')[0];
              setDueDate(fallbackDate);
              setAutoCalculatedDate(fallbackDate);
            });
        })
        .catch(error => {
          console.error('Error fetching customer:', error);
        });
    }
  }, [isOpen, customerId]);

  // Calculate business days whenever due date changes
  useEffect(() => {
    if (dueDate) {
      const today = new Date();
      ordersApi.calculateBusinessDays(today.toISOString().split('T')[0], dueDate)
        .then(response => {
          setBusinessDaysFromToday(response.businessDays);
        })
        .catch(error => {
          console.error('Error calculating business days:', error);
          setBusinessDaysFromToday(null);
        });

      if (autoCalculatedDate && dueDate !== autoCalculatedDate) {
        setDueDateManuallyChanged(true);
      } else {
        setDueDateManuallyChanged(false);
      }
    } else {
      setBusinessDaysFromToday(null);
      setDueDateManuallyChanged(false);
    }
  }, [dueDate, autoCalculatedDate]);

  // Fetch customer contacts when modal opens
  useEffect(() => {
    if (isOpen && customerId) {
      // Try to fetch ALL contacts first (requires customers.view permission)
      // If that fails, fall back to just emails (requires orders.create permission)
      customerContactsApi.getContacts(customerId)
        .then(contacts => {
          // Success - we have all contacts
          setAllContacts(contacts || []);
          setContactEmails(contacts.map((c: any) => c.contact_email) || []);

          // Check if there are any contacts
          if (contacts && contacts.length > 0) {
            // Has contacts - start with existing contact mode but empty dropdown
            setPointPersons([{
              id: `empty-${Date.now()}`,
              mode: 'existing' as const,
              contact_email: ''
            }]);
          } else {
            // No contacts - start with custom mode and save enabled by default
            setPointPersons([{
              id: `empty-${Date.now()}`,
              mode: 'custom' as const,
              contact_email: '',
              saveToDatabase: true
            }]);
          }
        })
        .catch(error => {
          console.warn('Could not fetch all contacts (may lack customers.view permission), falling back to emails only:', error);

          // Fallback: Fetch emails only
          customerContactsApi.getEmails(customerId)
            .then(emails => {
              setContactEmails(emails || []);
              setAllContacts([]);

              // Check if there are any emails
              if (emails && emails.length > 0) {
                // Has emails - start with existing contact mode but empty dropdown
                setPointPersons([{
                  id: `empty-${Date.now()}`,
                  mode: 'existing' as const,
                  contact_email: ''
                }]);
              } else {
                // No emails - start with custom mode and save enabled by default
                setPointPersons([{
                  id: `empty-${Date.now()}`,
                  mode: 'custom' as const,
                  contact_email: '',
                  saveToDatabase: true
                }]);
              }
            })
            .catch(fallbackError => {
              console.error('Error fetching contacts (fallback):', fallbackError);
              setContactEmails([]);
              setAllContacts([]);
              // On error, still show one empty entry in custom mode with save enabled
              setPointPersons([{
                id: `empty-${Date.now()}`,
                mode: 'custom' as const,
                contact_email: '',
                saveToDatabase: true
              }]);
            });
        });
    }
  }, [isOpen, customerId]);

  // Validate order name uniqueness (debounced)
  useEffect(() => {
    if (!orderName.trim() || !isOpen) {
      setValidationError(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await apiClient.get(`/orders/validate-name`, {
          params: { orderName: orderName.trim(), customerId }
        });

        if (!response.data.unique) {
          setValidationError('An order with this name already exists for this customer');
        } else {
          setValidationError(null);
        }
      } catch (err) {
        console.error('Error validating order name:', err);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [orderName, customerId, isOpen]);

  // Auto-resize Special Instructions textarea based on content
  useEffect(() => {
    const textarea = specialInstructionsRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Set height to scrollHeight to fit content
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [modalSpecialInstructions]);

  if (!isOpen || !estimatePreviewData) return null;

  const handleAddPointPerson = () => {
    setPointPersons([
      ...pointPersons,
      {
        id: `new-${Date.now()}`,
        mode: 'custom' as const,
        contact_email: '',
        saveToDatabase: true
      }
    ]);
  };

  const handleRemovePointPerson = (id: string) => {
    setPointPersons(pointPersons.filter(p => p.id !== id));
  };

  const handleModeChange = (id: string, mode: 'existing' | 'custom') => {
    setPointPersons(pointPersons.map(person => {
      if (person.id === id) {
        if (mode === 'custom') {
          return {
            ...person,
            mode,
            contact_id: undefined,
            contact_email: '',
            contact_name: undefined,
            contact_phone: undefined,
            contact_role: undefined,
            saveToDatabase: true
          };
        } else {
          return {
            ...person,
            mode,
            contact_id: undefined,
            contact_email: '',
            contact_name: undefined,
            contact_phone: undefined,
            contact_role: undefined,
            saveToDatabase: undefined
          };
        }
      }
      return person;
    }));
  };

  const handleExistingContactChange = (id: string, contactId: number) => {
    const selectedContact = allContacts.find(c => c.contact_id === contactId);
    if (!selectedContact) return;

    setPointPersons(pointPersons.map(person => {
      if (person.id === id) {
        return {
          ...person,
          contact_id: selectedContact.contact_id,
          contact_email: selectedContact.contact_email,
          contact_name: selectedContact.contact_name,
          contact_phone: selectedContact.contact_phone,
          contact_role: selectedContact.contact_role
        };
      }
      return person;
    }));
  };

  const handleCustomFieldChange = (id: string, field: keyof PointPersonEntry, value: any) => {
    setPointPersons(pointPersons.map(person => {
      if (person.id === id) {
        return {
          ...person,
          [field]: value
        };
      }
      return person;
    }));
  };

  const handleApprove = async () => {
    if (!orderName.trim()) {
      setError('Order name is required');
      return;
    }

    // Validate Windows folder name compatibility
    const nameValidation = validateJobOrOrderName(orderName);
    if (!nameValidation.isValid) {
      setError(nameValidation.error);
      return;
    }

    if (validationError) {
      setError(validationError);
      return;
    }

    // Prepare hard due time (just the time, since database column is TIME type)
    // MySQL TIME format is "HH:mm:ss"
    let hardDueTimeFormatted = undefined;
    if (hardDueTime.trim()) {
      hardDueTimeFormatted = `${hardDueTime.trim()}:00`; // Convert "16:00" to "16:00:00"
    }

    // Filter out empty point persons and prepare data
    const pointPersonsData: PointPersonInput[] = pointPersons
      .filter(p => p.contact_email.trim())
      .map(p => ({
        contact_id: p.contact_id,
        contact_email: p.contact_email.trim(),
        contact_name: p.contact_name,
        contact_phone: p.contact_phone,
        contact_role: p.contact_role,
        saveToDatabase: p.mode === 'custom' ? p.saveToDatabase : undefined
      }));

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post('/orders/convert-estimate', {
        estimateId,
        orderName: orderName.trim(),
        customerPo: customerPo.trim() || undefined,
        customerJobNumber: customerJobNumber.trim() || undefined,
        dueDate: dueDate || undefined,
        hardDueDateTime: hardDueTimeFormatted, // Now just TIME format "HH:mm:ss"
        modalSpecialInstructions: modalSpecialInstructions.trim() || undefined,
        pointPersons: pointPersonsData.length > 0 ? pointPersonsData : undefined,
        estimatePreviewData
      });

      // Interceptor unwraps { success: true, data: T } to just T
      // So response.data directly contains { order_id, order_number }
      if (response.data.order_number) {
        onSuccess(response.data.order_number);
        handleClose();
      } else {
        setError('Failed to create order - no order number returned');
      }
    } catch (err: any) {
      console.error('Error creating order:', err);

      // Handle specific error cases
      if (err.response?.status === 409) {
        // Conflict error (duplicate email or already converted)
        const message = err.response?.data?.error || err.response?.data?.message || 'A conflict occurred';
        setError(message);
      } else {
        const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to create order';
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setOrderName(defaultOrderName);
      setCustomerPo('');
      setCustomerJobNumber('');
      setDueDate('');
      setAutoCalculatedDate('');
      setDueDateManuallyChanged(false);
      setBusinessDaysFromToday(null);
      setHardDueTime('');
      setModalSpecialInstructions('');
      setPointPersons([]);
      setContactEmails([]);
      setAllContacts([]);
      setError(null);
      setValidationError(null);
      setConfirmedNoQBEstimate(false);
      onClose();
    }
  };

  // Check if we need confirmation for no QB estimate
  const needsNoQBConfirmation = !qbEstimateId;
  const canApprove = !validationError && orderName.trim() && (!needsNoQBConfirmation || confirmedNoQBEstimate);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <h3 className="text-xl font-semibold">Approve Estimate & Create Order</h3>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body - Two Column Layout */}
        <div className="p-6 flex gap-6">
          {/* LEFT COLUMN: Estimate Summary */}
          <div className="flex-1 space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-gray-900">Estimate Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Customer:</span>
                  <span className="font-medium">{estimatePreviewData.customerName}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Job:</span>
                  <span className="font-medium text-right">
                    {jobName || 'N/A'}
                    {estimateNotes && <span className="text-gray-500"> ({estimateNotes})</span>}
                  </span>
                </div>

                <div className="border-t border-gray-200 my-2"></div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">{formatCurrency(estimatePreviewData.subtotal)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Tax:</span>
                  <span className="font-medium">{formatCurrency(estimatePreviewData.taxAmount)}</span>
                </div>

                <div className="flex justify-between font-semibold text-base pt-2 border-t border-gray-200">
                  <span>Total:</span>
                  <span className="text-lg">{formatCurrency(estimatePreviewData.total)}</span>
                </div>
              </div>
            </div>

            {/* Order Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Order Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={orderName}
                onChange={(e) => setOrderName(e.target.value)}
                disabled={loading}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed ${
                  validationError ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter unique order name"
              />
              {validationError && (
                <p className="mt-1 text-sm text-red-600">{validationError}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">Must be unique per customer</p>
            </div>

            {/* Customer Job # & PO# - Horizontal */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Job #
                </label>
                <input
                  type="text"
                  value={customerJobNumber}
                  onChange={(e) => setCustomerJobNumber(e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer PO#
                </label>
                <input
                  type="text"
                  value={customerPo}
                  onChange={(e) => setCustomerPo(e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Optional"
                />
              </div>
            </div>

            {/* Due Date & Hard Time - Horizontal */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                {businessDaysFromToday !== null && (
                  <p className="mt-1 text-xs text-gray-600">
                    {businessDaysFromToday} business days
                    {dueDateManuallyChanged && (
                      <span className="ml-1 text-amber-600 font-medium">(adjusted)</span>
                    )}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hard Due Time
                </label>
                <input
                  type="time"
                  value={hardDueTime}
                  onChange={(e) => setHardDueTime(e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="--:--"
                />
                <p className="mt-1 text-xs text-gray-500">Optional</p>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Special Instructions & Point Persons */}
          <div className="flex-1 space-y-4">
            {/* Special Instructions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Special Instructions
              </label>
              <textarea
                ref={specialInstructionsRef}
                value={modalSpecialInstructions}
                onChange={(e) => setModalSpecialInstructions(e.target.value)}
                disabled={loading}
                rows={1}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed resize-none overflow-hidden"
                placeholder="Additional instructions for this order (optional)"
              />
              <p className="mt-1 text-xs text-gray-500">
                Will be appended to customer's default special instructions
              </p>
            </div>

            {/* Point Persons */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Point Persons
              </label>
              <div className="space-y-4">
                {pointPersons.map((person, index) => (
                  <div key={person.id} className="border border-gray-200 rounded-lg p-3 space-y-3">
                    {/* Header with Mode Toggle and Remove Button */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`mode-${person.id}`}
                            checked={person.mode === 'existing'}
                            onChange={() => handleModeChange(person.id, 'existing')}
                            disabled={loading}
                            className="w-4 h-4 text-purple-600 focus:ring-purple-500 disabled:opacity-50"
                          />
                          <span className="text-sm text-gray-700">Existing Contact</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`mode-${person.id}`}
                            checked={person.mode === 'custom'}
                            onChange={() => handleModeChange(person.id, 'custom')}
                            disabled={loading}
                            className="w-4 h-4 text-purple-600 focus:ring-purple-500 disabled:opacity-50"
                          />
                          <span className="text-sm text-gray-700">New Contact</span>
                        </label>
                      </div>
                      {pointPersons.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePointPerson(person.id)}
                          disabled={loading}
                          className="px-2 py-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Existing Contact Mode */}
                    {person.mode === 'existing' && (
                      <div>
                        <select
                          value={person.contact_id || ''}
                          onChange={(e) => handleExistingContactChange(person.id, parseInt(e.target.value))}
                          disabled={loading}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          <option value="">Select a contact...</option>
                          {allContacts.map(contact => (
                            <option key={contact.contact_id} value={contact.contact_id}>
                              {contact.contact_name}
                              {contact.contact_role && ` (${contact.contact_role})`}
                              {' - '}
                              {contact.contact_email}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Custom Contact Mode */}
                    {person.mode === 'custom' && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-[65%_35%] gap-2">
                          <input
                            type="email"
                            value={person.contact_email}
                            onChange={(e) => handleCustomFieldChange(person.id, 'contact_email', e.target.value)}
                            disabled={loading}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                            placeholder="Email *"
                          />
                          <input
                            type="text"
                            value={person.contact_name || ''}
                            onChange={(e) => handleCustomFieldChange(person.id, 'contact_name', e.target.value)}
                            disabled={loading}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                            placeholder="Name (optional)"
                          />
                        </div>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={person.saveToDatabase || false}
                            onChange={(e) => handleCustomFieldChange(person.id, 'saveToDatabase', e.target.checked)}
                            disabled={loading}
                            className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 disabled:opacity-50"
                          />
                          <span className="text-sm text-gray-700">
                            Save this contact to database for future use
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddPointPerson}
                  disabled={loading}
                  className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  Add Another Point Person
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-4 p-6 border-t bg-gray-50">
          {/* QB Warning (if needed) - Left side */}
          {needsNoQBConfirmation ? (
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚠️</span>
              <div className="flex flex-col gap-1">
                <span className="text-base text-gray-700">
                  This Estimate has not been sent to QuickBooks.
                </span>
                <span className="text-sm text-gray-600">
                  Please confirm to proceed.
                </span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap ml-6">
                <input
                  type="checkbox"
                  checked={confirmedNoQBEstimate}
                  onChange={(e) => setConfirmedNoQBEstimate(e.target.checked)}
                  disabled={loading}
                  className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500 disabled:opacity-50"
                />
                <span className="text-base font-medium text-gray-700">
                  Confirm
                </span>
              </label>
            </div>
          ) : (
            <div></div>
          )}

          {/* Action Buttons - Right side */}
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleApprove}
              disabled={loading || !canApprove}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Creating Order...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Approve & Create Order</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
