import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, X, Plus, Trash2 } from 'lucide-react';
import { apiClient, ordersApi, customerApi, customerContactsApi } from '../../../services/api';
import type { EstimatePreviewData } from '../../jobEstimation/core/layers/CalculationLayer';
import type { PointPersonInput } from '../../../types/orders';

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
  contact_id?: number;
  contact_email: string;
  contact_name?: string;
  contact_phone?: string;
  contact_role?: string;
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

  // Fetch customer contacts and auto-fill primary contacts when modal opens
  useEffect(() => {
    if (isOpen && customerId) {
      // Fetch emails and primary contacts (both require orders.create permission)
      // Note: We skip getContacts() since it requires customers.view permission
      Promise.all([
        customerContactsApi.getEmails(customerId),
        customerContactsApi.getPrimaryContacts(customerId)
      ])
        .then(([emails, primaryContacts]) => {
          setContactEmails(emails || []);

          // Auto-fill from primary contacts
          if (primaryContacts && primaryContacts.length > 0) {
            const primaryEntries: PointPersonEntry[] = primaryContacts.map((contact: any) => ({
              id: `primary-${contact.contact_id}`,
              contact_id: contact.contact_id,
              contact_email: contact.contact_email,
              contact_name: contact.contact_name,
              contact_phone: contact.contact_phone,
              contact_role: contact.contact_role
            }));
            setPointPersons(primaryEntries);
            // Store primary contacts as allContacts for lookup
            setAllContacts(primaryContacts || []);
          } else {
            // No primary contacts - initialize with one empty entry so user can type custom email
            setPointPersons([{
              id: `empty-${Date.now()}`,
              contact_email: ''
            }]);
            setAllContacts([]);
          }
        })
        .catch(error => {
          console.error('Error fetching contacts:', error);
          setContactEmails([]);
          setAllContacts([]);
          // On error, still show one empty entry
          setPointPersons([{
            id: `empty-${Date.now()}`,
            contact_email: ''
          }]);
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

  if (!isOpen || !estimatePreviewData) return null;

  const handleAddPointPerson = () => {
    setPointPersons([
      ...pointPersons,
      {
        id: `new-${Date.now()}`,
        contact_email: ''
      }
    ]);
  };

  const handleRemovePointPerson = (id: string) => {
    setPointPersons(pointPersons.filter(p => p.id !== id));
  };

  const handlePointPersonChange = (id: string, email: string) => {
    const selectedContact = allContacts.find(c => c.contact_email === email);

    setPointPersons(pointPersons.map(person => {
      if (person.id === id) {
        if (selectedContact) {
          return {
            ...person,
            contact_id: selectedContact.contact_id,
            contact_email: selectedContact.contact_email,
            contact_name: selectedContact.contact_name,
            contact_phone: selectedContact.contact_phone,
            contact_role: selectedContact.contact_role
          };
        } else {
          return {
            ...person,
            contact_id: undefined,
            contact_email: email,
            contact_name: undefined,
            contact_phone: undefined,
            contact_role: undefined
          };
        }
      }
      return person;
    }));
  };

  const handleApprove = async () => {
    if (!orderName.trim()) {
      setError('Order name is required');
      return;
    }

    if (validationError) {
      setError(validationError);
      return;
    }

    // Prepare hard due date time (combine date + time if user entered a time)
    // Send as simple datetime string - backend will format for MySQL without timezone conversion
    let hardDueDateTime = undefined;
    if (dueDate && hardDueTime.trim()) {
      hardDueDateTime = `${dueDate}T${hardDueTime}:00`;
    }

    // Filter out empty point persons and prepare data
    const pointPersonsData: PointPersonInput[] = pointPersons
      .filter(p => p.contact_email.trim())
      .map(p => ({
        contact_id: p.contact_id,
        contact_email: p.contact_email.trim(),
        contact_name: p.contact_name,
        contact_phone: p.contact_phone,
        contact_role: p.contact_role
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
        hardDueDateTime: hardDueDateTime,
        pointPersons: pointPersonsData.length > 0 ? pointPersonsData : undefined,
        estimatePreviewData
      });

      if (response.data.success) {
        onSuccess(response.data.data.order_number);
        handleClose();
      } else {
        setError(response.data.message || 'Failed to create order');
      }
    } catch (err: any) {
      console.error('Error creating order:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to create order';
      setError(errorMessage);
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

        {/* Warning Banner - No QB Estimate */}
        {needsNoQBConfirmation && (
          <div className="mx-6 mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900 mb-2">
                  ⚠️ This estimate has not been created in QuickBooks
                </p>
                <p className="text-sm text-amber-800 mb-3">
                  This estimate has not been sent to QuickBooks and therefore has not been sent to the customer.
                  Are you sure you want to convert this to an order?
                </p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmedNoQBEstimate}
                    onChange={(e) => setConfirmedNoQBEstimate(e.target.checked)}
                    disabled={loading}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 disabled:opacity-50"
                  />
                  <span className="text-sm font-medium text-amber-900">
                    I understand this estimate hasn't been sent to the customer
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

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
          </div>

          {/* RIGHT COLUMN: Order Details */}
          <div className="flex-1 space-y-4">
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

            {/* Customer Job Number & PO# - Horizontal */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Job Number
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

            {/* Point Persons */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Point Persons
              </label>
              <div className="space-y-2">
                {pointPersons.map((person, index) => (
                  <div key={person.id} className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="email"
                        list={`contact-emails-${person.id}`}
                        value={person.contact_email}
                        onChange={(e) => handlePointPersonChange(person.id, e.target.value)}
                        disabled={loading}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="Select or type email..."
                      />
                      <datalist id={`contact-emails-${person.id}`}>
                        {contactEmails.map(email => (
                          <option key={email} value={email} />
                        ))}
                      </datalist>
                    </div>
                    {pointPersons.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePointPerson(person.id)}
                        disabled={loading}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
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
  );
};
