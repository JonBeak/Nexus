/**
 * Send to Customer Panel
 * Phase 1.5.c.6.3: Send to Customer
 *
 * Main container for the "Send" phase of order preparation.
 * Responsibilities:
 * - Load point persons from API
 * - Manage recipient selection state
 * - Render PointPersonSelector and EmailPreview components
 * - Handle send/skip callbacks
 */

import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Loader2 } from 'lucide-react';
import { PointPersonSelector, PointPerson } from './PointPersonSelector';
import { EmailPreview } from './EmailPreview';
import { orderPreparationApi } from '../../../../services/api/orders/orderPreparationApi';

interface Props {
  orderNumber: number;
  orderName: string;
  pdfUrls: {
    specsOrderForm: string | null;
    qbEstimate: string | null;
  };
  qbEstimateNumber: string | null;
}

export interface SendToCustomerPanelRef {
  getSelectedRecipients: () => string[];
}

export const SendToCustomerPanel = forwardRef<SendToCustomerPanelRef, Props>(({
  orderNumber,
  orderName,
  pdfUrls,
  qbEstimateNumber
}, ref) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pointPersons, setPointPersons] = useState<PointPerson[]>([]);

  // Load point persons on mount
  useEffect(() => {
    loadPointPersons();
  }, [orderNumber]);

  const loadPointPersons = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[SendToCustomerPanel] Loading point persons for order:', orderNumber);
      const response = await orderPreparationApi.getPointPersons(orderNumber);

      console.log('[SendToCustomerPanel] Raw API response:', response);

      // API client already returns response.data, which is { success: true, data: { pointPersons: [...] } }
      // So response is actually the 'data' object, and we access response.data.pointPersons
      // Wait, the log shows response = { pointPersons: [...] } directly!
      // So the API client must be returning response.data.data
      const pointPersonsData = response.pointPersons || [];

      console.log('[SendToCustomerPanel] Point persons data:', pointPersonsData);
      console.log('[SendToCustomerPanel] Point persons count:', pointPersonsData.length);

      // Transform API response to component state
      // Default all point persons to selected
      const persons: PointPerson[] = pointPersonsData.map((pp: any) => ({
        id: pp.id,
        name: pp.contact_name,
        email: pp.contact_email,
        selected: true // Default all to selected
      }));

      console.log('[SendToCustomerPanel] Transformed persons:', persons);
      setPointPersons(persons);
    } catch (err) {
      console.error('[SendToCustomerPanel] Error loading point persons:', err);
      setError('Failed to load point persons');
    } finally {
      setLoading(false);
    }
  };

  // Toggle single point person selection
  const handleToggle = (personId: number) => {
    setPointPersons(prev =>
      prev.map(p =>
        p.id === personId ? { ...p, selected: !p.selected } : p
      )
    );
  };

  // Select all point persons
  const handleSelectAll = () => {
    setPointPersons(prev =>
      prev.map(p => ({ ...p, selected: true }))
    );
  };

  // Deselect all point persons
  const handleDeselectAll = () => {
    setPointPersons(prev =>
      prev.map(p => ({ ...p, selected: false }))
    );
  };

  // Get selected recipient emails
  const getSelectedRecipients = (): string[] => {
    return pointPersons
      .filter(p => p.selected)
      .map(p => p.email);
  };

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    getSelectedRecipients
  }));

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <span className="ml-3 text-sm text-gray-600">Loading point persons...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-800">{error}</p>
        <button
          onClick={loadPointPersons}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  const selectedRecipients = getSelectedRecipients();

  return (
    <div className="space-y-6">
      {/* Point Person Selector */}
      <div>
        <PointPersonSelector
          pointPersons={pointPersons}
          onToggle={handleToggle}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
        />
      </div>

      {/* Email Preview */}
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-3">Email Preview</h3>
        <EmailPreview
          orderNumber={orderNumber}
          orderName={orderName}
          recipients={selectedRecipients}
          specsOrderFormUrl={pdfUrls.specsOrderForm}
          qbEstimateUrl={pdfUrls.qbEstimate}
          qbEstimateNumber={qbEstimateNumber}
        />
      </div>
    </div>
  );
});
