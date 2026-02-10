/**
 * Shopping Cart - Draft Purchase Orders (Live MR Query)
 * Shows MRs grouped by supplier (no DB draft rows). Each supplier group
 * can be submitted as a real PO (snapshot created on send).
 * Created: 2026-02-02 | Reworked: 2026-02-10 (live query, no draft rows)
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ShoppingCart as CartIcon,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { PAGE_STYLES, MODULE_COLORS } from '../../constants/moduleColors';
import { materialRequirementsApi, supplierOrdersApi } from '../../services/api';
import type { DraftPOGroup } from '../../types/materialRequirements';
import type { MaterialRequirement } from '../../types/materialRequirements';
import type { User as AccountUser } from '../accounts/hooks/useAccountAPI';
import { DraftPOCard, type POEmailFields } from './components/DraftPOCard';

interface ShoppingCartProps {
  user?: AccountUser | null;
  showNotification: (message: string, type?: 'success' | 'error') => void;
}

export const ShoppingCartComponent: React.FC<ShoppingCartProps> = ({
  user,
  showNotification,
}) => {
  void user;
  const [groups, setGroups] = useState<DraftPOGroup[]>([]);
  const [unassigned, setUnassigned] = useState<MaterialRequirement[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [draftGroups, unassignedReqs] = await Promise.all([
        materialRequirementsApi.getDraftPOGroups(),
        materialRequirementsApi.getUnassigned(),
      ]);
      setGroups(draftGroups);
      setUnassigned(unassignedReqs);
    } catch (error) {
      console.error('Error loading shopping cart data:', error);
      showNotification('Failed to load draft orders', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRemoveItem = async (requirementId: number) => {
    try {
      // "Remove from PO" = clear supplier_id on that MR
      await materialRequirementsApi.updateRequirement(requirementId, { supplier_id: null });
      showNotification('Item removed from draft PO');
      void loadData();
    } catch (error) {
      console.error('Error removing item:', error);
      showNotification('Failed to remove item', 'error');
    }
  };

  const handleSubmitOrder = async (
    supplierId: number,
    requirementIds: number[],
    deliveryMethod: 'shipping' | 'pickup',
    emailFields: POEmailFields
  ) => {
    try {
      await supplierOrdersApi.submitDraftPO(
        supplierId,
        requirementIds,
        deliveryMethod,
        undefined,
        emailFields
      );
      showNotification('Order submitted & PO email sent to supplier!');
      void loadData();
    } catch (error) {
      console.error('Error submitting order:', error);
      showNotification('Failed to submit order', 'error');
    }
  };

  // Company email for BCC default + company name for closing
  const companyEmail = import.meta.env.VITE_COMPANY_EMAIL || 'info@signhouse.ca';
  const companyName = import.meta.env.VITE_COMPANY_NAME || 'Sign House';

  const totalItems = groups.reduce((sum, g) => sum + g.requirements.length, 0);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className={`inline-block animate-spin rounded-full h-8 w-8 border-b-2 ${MODULE_COLORS.supplyChain.border}`}></div>
        <p className={`mt-2 ${PAGE_STYLES.page.text}`}>Loading draft orders...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className={`text-lg font-medium ${PAGE_STYLES.panel.text}`}>Draft Purchase Orders</h3>
          <p className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>
            {groups.length} supplier{groups.length !== 1 ? 's' : ''} &middot; {totalItems} item{totalItems !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => void loadData()}
          className={`p-2 rounded-md ${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.text} border ${PAGE_STYLES.panel.border}`}
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Unassigned Requirements Warning */}
      {unassigned.length > 0 && (
        <div className={`${PAGE_STYLES.composites.panelContainer} overflow-hidden`}>
          <div className={`px-4 py-3 ${PAGE_STYLES.panel.border} border-b flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20`}>
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <div>
              <span className={`font-medium ${PAGE_STYLES.panel.text}`}>
                {unassigned.length} Unassigned Requirement{unassigned.length !== 1 ? 's' : ''}
              </span>
              <span className={`ml-2 text-sm ${PAGE_STYLES.panel.textMuted}`}>
                Assign a supplier to add to a draft PO
              </span>
            </div>
          </div>
          <div className="divide-y divide-[var(--theme-border)]">
            {unassigned.map((req) => (
              <div key={req.requirement_id} className="px-4 py-2.5 flex items-center justify-between">
                <div className="flex-1">
                  <span className={`text-sm font-medium ${PAGE_STYLES.panel.text}`}>
                    {(req as any).archetype_name || req.custom_product_type || 'Unknown'}
                  </span>
                  <div className={`text-xs ${PAGE_STYLES.panel.textMuted}`}>
                    Qty: {req.quantity_ordered} {(req as any).unit || (req as any).unit_of_measure || 'each'}
                    {req.order_id && <span className="ml-2">Order #{(req as any).order_number}</span>}
                  </div>
                </div>
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800">
                  No Supplier
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Draft PO Cards */}
      {groups.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groups.map((group) => (
            <DraftPOCard
              key={group.supplier_id}
              group={group}
              companyEmail={companyEmail}
              companyName={companyName}
              onRemoveItem={handleRemoveItem}
              onSubmitOrder={handleSubmitOrder}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {groups.length === 0 && unassigned.length === 0 && (
        <div className={`text-center py-12 ${PAGE_STYLES.composites.panelContainer}`}>
          <CartIcon className={`w-12 h-12 ${PAGE_STYLES.panel.textMuted} mx-auto mb-3 opacity-50`} />
          <p className={`text-lg font-medium ${PAGE_STYLES.panel.text} mb-1`}>No Draft Purchase Orders</p>
          <p className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>
            Assign suppliers to material requirements to see draft POs here
          </p>
        </div>
      )}
    </div>
  );
};
