/**
 * Draft PO Card — Always-Visible Email Composer
 * Shows supplier info, contact chip selectors (To/CC/BCC), subject, delivery toggle,
 * editable opening/closing text, read-only item list, and Place Order button.
 * Now operates on DraftPOGroup (live MR query) instead of SupplierOrderWithItems.
 * Created: 2026-02-10 | Reworked: 2026-02-10 (live MR data)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Send,
  Building2,
  Package,
  Truck,
  MapPin,
  X,
  Loader2,
} from 'lucide-react';
import { PAGE_STYLES } from '../../../constants/moduleColors';
import { suppliersApi, type SupplierContact } from '../../../services/api/suppliersApi';
import { ContactChipSelector, type ContactChip } from './ContactChipSelector';
import type { DraftPOGroup, DraftPORequirement } from '../../../types/materialRequirements';

export interface POEmailFields {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  opening: string;
  closing: string;
}

interface DraftPOCardProps {
  group: DraftPOGroup;
  companyEmail: string;
  companyName: string;
  onRemoveItem: (requirementId: number) => void;
  onSubmitOrder: (
    supplierId: number,
    requirementIds: number[],
    deliveryMethod: 'shipping' | 'pickup',
    emailFields: POEmailFields
  ) => void;
}

/** Format a single requirement as an email-style line string */
function formatItemLine(req: DraftPORequirement): string {
  const qty = req.quantity_ordered;
  const unit = req.unit_of_measure || 'each';
  const desc = req.archetype_name || req.custom_product_type || 'Unknown Product';
  const ref = req.supplier_product_sku
    ? req.supplier_product_sku
    : req.order_number
      ? `Order #${req.order_number}`
      : null;
  return ref ? `${qty} ${unit} — ${desc} (${ref})` : `${qty} ${unit} — ${desc}`;
}

export const DraftPOCard: React.FC<DraftPOCardProps> = ({
  group,
  companyEmail,
  companyName,
  onRemoveItem,
  onSubmitOrder,
}) => {
  const [contacts, setContacts] = useState<SupplierContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Contact chip state
  const [toChips, setToChips] = useState<ContactChip[]>([]);
  const [ccChips, setCcChips] = useState<ContactChip[]>([]);
  const [bccChips, setBccChips] = useState<ContactChip[]>([]);

  // Email fields
  const [deliveryMethod, setDeliveryMethod] = useState<'shipping' | 'pickup'>('shipping');
  const [emailSubject, setEmailSubject] = useState('Order for Shipping');

  const supplierName = group.supplier_name || 'Supplier';
  const defaultOpening = `Hi ${supplierName},\nPlease find our purchase order details below.`;
  const defaultClosing = `Thank you for your prompt attention to this order. Please don't hesitate to reach out if you have any questions.\n\nBest regards,\n${companyName}`;

  const [opening, setOpening] = useState(defaultOpening);
  const [closing, setClosing] = useState(defaultClosing);

  // Fetch contacts on mount
  const fetchContacts = useCallback(async () => {
    try {
      setLoadingContacts(true);
      const data = await suppliersApi.getSupplierContacts(group.supplier_id);
      setContacts(data);

      // Auto-select primary contact as To
      const primary = data.find(c => c.is_primary && c.email && c.is_active);
      if (primary && primary.email) {
        setToChips([{
          id: `contact-${primary.contact_id}`,
          name: primary.name,
          email: primary.email,
          isManual: false,
        }]);
      } else if (group.contact_email) {
        setToChips([{
          id: `manual-fallback`,
          name: group.contact_email.split('@')[0],
          email: group.contact_email,
          isManual: true,
        }]);
      }
    } catch (err) {
      console.error('Error fetching supplier contacts:', err);
      if (group.contact_email) {
        setToChips([{
          id: `manual-fallback`,
          name: group.contact_email.split('@')[0],
          email: group.contact_email,
          isManual: true,
        }]);
      }
    } finally {
      setLoadingContacts(false);
    }
  }, [group.supplier_id, group.contact_email]);

  useEffect(() => {
    void fetchContacts();
  }, [fetchContacts]);

  // Auto-set BCC to company email
  useEffect(() => {
    if (companyEmail) {
      setBccChips([{
        id: `bcc-company`,
        name: companyEmail.split('@')[0],
        email: companyEmail,
        isManual: true,
      }]);
    }
  }, [companyEmail]);

  const handleDeliveryChange = (method: 'shipping' | 'pickup') => {
    setDeliveryMethod(method);
    setEmailSubject(`Order for ${method === 'pickup' ? 'Pickup' : 'Shipping'}`);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const emailFields: POEmailFields = {
        to: toChips.map(c => c.email).join(', '),
        cc: ccChips.map(c => c.email).join(', '),
        bcc: bccChips.map(c => c.email).join(', '),
        subject: emailSubject,
        opening,
        closing,
      };
      const requirementIds = group.requirements.map(r => r.requirement_id);
      await onSubmitOrder(group.supplier_id, requirementIds, deliveryMethod, emailFields);
    } finally {
      setSubmitting(false);
    }
  };

  const itemCount = group.requirements.length;
  const canSubmit = toChips.length > 0 && itemCount > 0 && !submitting;

  return (
    <div className={`${PAGE_STYLES.composites.panelContainer} overflow-hidden flex flex-col`}>
      {/* Header */}
      <div className={`px-4 py-3 ${PAGE_STYLES.panel.border} border-b ${PAGE_STYLES.header.background}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className={`w-4 h-4 ${PAGE_STYLES.panel.textMuted} shrink-0`} />
            <span className={`font-medium ${PAGE_STYLES.panel.text} truncate`}>
              {supplierName}
            </span>
          </div>
        </div>
        <div className={`text-xs ${PAGE_STYLES.panel.textMuted} mt-0.5 ml-6`}>
          {itemCount} item{itemCount !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Email Metadata */}
      <div className={`px-4 py-2.5 space-y-1.5 border-b ${PAGE_STYLES.panel.border}`}>
        {loadingContacts ? (
          <div className="flex items-center gap-2 py-1">
            <Loader2 className={`w-3 h-3 animate-spin ${PAGE_STYLES.panel.textMuted}`} />
            <span className={`text-xs ${PAGE_STYLES.panel.textMuted}`}>Loading contacts...</span>
          </div>
        ) : (
          <>
            <ContactChipSelector
              label="To:"
              contacts={contacts}
              selected={toChips}
              onAdd={(chip) => setToChips(prev => [...prev, chip])}
              onRemove={(id) => setToChips(prev => prev.filter(c => c.id !== id))}
            />
            <ContactChipSelector
              label="CC:"
              contacts={contacts}
              selected={ccChips}
              onAdd={(chip) => setCcChips(prev => [...prev, chip])}
              onRemove={(id) => setCcChips(prev => prev.filter(c => c.id !== id))}
            />
            <ContactChipSelector
              label="BCC:"
              contacts={contacts}
              selected={bccChips}
              onAdd={(chip) => setBccChips(prev => [...prev, chip])}
              onRemove={(id) => setBccChips(prev => prev.filter(c => c.id !== id))}
            />
          </>
        )}

        {/* Subject */}
        <div className="flex items-center gap-1.5">
          <label className={`text-xs font-medium ${PAGE_STYLES.panel.textSecondary} w-8 shrink-0`}>Subj:</label>
          <input
            type="text"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            className={`flex-1 px-1.5 py-1 text-xs ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-md ${PAGE_STYLES.panel.text}`}
          />
        </div>

        {/* Delivery Toggle */}
        <div className="flex items-center gap-1.5">
          <label className={`text-xs font-medium ${PAGE_STYLES.panel.textSecondary} w-8 shrink-0`}>&nbsp;</label>
          <div className="flex gap-1.5">
            <button
              onClick={() => handleDeliveryChange('shipping')}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors ${
                deliveryMethod === 'shipping'
                  ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                  : `${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} ${PAGE_STYLES.panel.textMuted}`
              }`}
            >
              <Truck className="w-3 h-3" /> Ship
            </button>
            <button
              onClick={() => handleDeliveryChange('pickup')}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors ${
                deliveryMethod === 'pickup'
                  ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                  : `${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} ${PAGE_STYLES.panel.textMuted}`
              }`}
            >
              <MapPin className="w-3 h-3" /> Pickup
            </button>
          </div>
        </div>
      </div>

      {/* Email Body Preview */}
      <div className="flex-1 px-4 py-2.5 space-y-2 overflow-y-auto">
        {/* Opening (editable) */}
        <div>
          <label className={`text-[10px] uppercase tracking-wide font-semibold ${PAGE_STYLES.panel.textMuted} mb-0.5 block`}>
            Opening
          </label>
          <textarea
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
            rows={2}
            className={`w-full px-2 py-1.5 text-xs ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-md ${PAGE_STYLES.panel.text} resize-none leading-relaxed`}
          />
        </div>

        {/* Order Items (read-only, removable) */}
        <div>
          <label className={`text-[10px] uppercase tracking-wide font-semibold ${PAGE_STYLES.panel.textMuted} mb-0.5 block`}>
            Order Items
          </label>
          <div className={`${PAGE_STYLES.input.background} border ${PAGE_STYLES.input.border} rounded-md px-2 py-1.5`}>
            {group.requirements.length > 0 ? (
              <ul className="space-y-0.5">
                {group.requirements.map((req) => (
                  <li key={req.requirement_id} className="flex items-start gap-1 group">
                    <span className={`text-xs ${PAGE_STYLES.panel.text} flex-1 leading-snug`}>
                      {formatItemLine(req)}
                    </span>
                    <button
                      onClick={() => onRemoveItem(req.requirement_id)}
                      className="p-0.5 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      title="Remove item"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={`text-center py-3 ${PAGE_STYLES.panel.textMuted}`}>
                <Package className="w-4 h-4 mx-auto mb-0.5 opacity-50" />
                <p className="text-xs">No items</p>
              </div>
            )}
          </div>
        </div>

        {/* Closing (editable) */}
        <div>
          <label className={`text-[10px] uppercase tracking-wide font-semibold ${PAGE_STYLES.panel.textMuted} mb-0.5 block`}>
            Closing
          </label>
          <textarea
            value={closing}
            onChange={(e) => setClosing(e.target.value)}
            rows={3}
            className={`w-full px-2 py-1.5 text-xs ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-md ${PAGE_STYLES.panel.text} resize-none leading-relaxed`}
          />
        </div>
      </div>

      {/* Footer: Place Order */}
      <div className={`px-4 py-2.5 border-t ${PAGE_STYLES.panel.border} flex items-center justify-end`}>
        <button
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-colors"
        >
          {submitting ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Send className="w-3 h-3" />
          )}
          Place Order
        </button>
      </div>
    </div>
  );
};
