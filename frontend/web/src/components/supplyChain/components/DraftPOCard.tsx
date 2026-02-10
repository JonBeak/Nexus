/**
 * Draft PO Card — Always-Visible Email Composer
 * Shows supplier info, contact chip selectors (To/CC/BCC), subject, delivery toggle,
 * editable opening/closing text, read-only item list, and Place Order button.
 * Now operates on DraftPOGroup (live MR query) instead of SupplierOrderWithItems.
 * Created: 2026-02-10 | Reworked: 2026-02-10 (live MR data)
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
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

/** A grouped line item combining identical products across MRs */
interface GroupedLineItem {
  groupKey: string;
  description: string;
  totalQuantity: number;
  unit: string;
  sku: string | null;
  orderRefs: string[];
  items: DraftPORequirement[];
}

/** Format a grouped line item for the PO email preview */
function formatGroupedLine(g: GroupedLineItem): string {
  const skuSuffix = g.sku ? ` (${g.sku})` : '';
  return `${g.totalQuantity} ${g.unit} — ${g.description}${skuSuffix}`;
}

/** Format a single MR for the remove dropdown — shows qty, order/job name, and notes */
function formatDropdownItem(req: DraftPORequirement): { primary: string; secondary: string | null } {
  const unit = req.unit || req.unit_of_measure || 'each';
  const parts: string[] = [`${req.quantity_ordered} ${unit}`];
  if (req.order_number) parts.push(`Order #${req.order_number}`);
  if (req.order_name) parts.push(req.order_name);
  else if (req.is_stock_item) parts.push('Stock');
  return { primary: parts.join(' — '), secondary: req.notes || null };
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
  const [removeDropdown, setRemoveDropdown] = useState<{
    groupKey: string;
    anchorRect: DOMRect;
  } | null>(null);

  // Group identical products (same description + sku + unit) into consolidated lines
  const groupedItems = useMemo<GroupedLineItem[]>(() => {
    const map = new Map<string, GroupedLineItem>();
    for (const req of group.requirements) {
      const desc = req.archetype_name || req.custom_product_type || 'Unknown Product';
      const sku = req.supplier_product_sku || '';
      const unit = req.unit || req.unit_of_measure || 'each';
      const key = `${desc.toLowerCase()}|${sku.toLowerCase()}|${unit.toLowerCase()}`;

      const existing = map.get(key);
      if (existing) {
        existing.totalQuantity += Number(req.quantity_ordered);
        existing.items.push(req);
        if (req.order_number) {
          const ref = `Order #${req.order_number}`;
          if (!existing.orderRefs.includes(ref)) existing.orderRefs.push(ref);
        }
      } else {
        const orderRefs: string[] = [];
        if (req.order_number) orderRefs.push(`Order #${req.order_number}`);
        map.set(key, {
          groupKey: key,
          description: desc,
          totalQuantity: Number(req.quantity_ordered),
          unit,
          sku: req.supplier_product_sku || null,
          orderRefs,
          items: [req],
        });
      }
    }
    return Array.from(map.values());
  }, [group.requirements]);

  // Contact chip state
  const [toChips, setToChips] = useState<ContactChip[]>([]);
  const [ccChips, setCcChips] = useState<ContactChip[]>([]);
  const [bccChips, setBccChips] = useState<ContactChip[]>([]);

  // Email fields
  const [deliveryMethod, setDeliveryMethod] = useState<'shipping' | 'pickup'>('shipping');
  const [emailSubject, setEmailSubject] = useState('PO #_____ — Order for Shipping — Sign House Inc.');

  const supplierName = group.supplier_name || 'Supplier';
  const defaultOpening = `Hi ${supplierName},\nPlease find our purchase order details below.`;
  const defaultClosing = `Thank you for your prompt attention to this order. Please don't hesitate to reach out if you have any questions.\n\nBest regards,\n${companyName}`;

  const [opening, setOpening] = useState(defaultOpening);
  const [closing, setClosing] = useState(defaultClosing);

  // Auto-resize textarea refs
  const openingRef = useRef<HTMLTextAreaElement>(null);
  const closingRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => { autoResize(openingRef.current); }, [opening]);
  useEffect(() => { autoResize(closingRef.current); }, [closing]);

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
    setEmailSubject(`PO #_____ — Order for ${method === 'pickup' ? 'Pickup' : 'Shipping'} — Sign House Inc.`);
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

  // Find the active dropdown group (if any)
  const activeDropdownGroup = removeDropdown
    ? groupedItems.find(gi => gi.groupKey === removeDropdown.groupKey)
    : null;

  return (
    <>
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
              ref={openingRef}
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
              rows={1}
              className={`w-full px-2 py-1.5 text-xs ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-md ${PAGE_STYLES.panel.text} resize-none leading-relaxed overflow-hidden`}
            />
          </div>

          {/* Order Items (read-only, removable) */}
          <div>
            <label className={`text-[10px] uppercase tracking-wide font-semibold ${PAGE_STYLES.panel.textMuted} mb-0.5 block`}>
              Order Items
            </label>
            <div className={`${PAGE_STYLES.input.background} border ${PAGE_STYLES.input.border} rounded-md px-2 py-1.5`}>
              {groupedItems.length > 0 ? (
                <ul className={`divide-y divide-[var(--theme-border)]`}>
                  {groupedItems.map((gi) => (
                    <li key={gi.groupKey} className="flex items-start gap-1 group py-1 first:pt-0 last:pb-0">
                      <span className={`text-xs ${PAGE_STYLES.panel.text} flex-1 leading-snug`}>
                        {formatGroupedLine(gi)}
                      </span>
                      {gi.items.length === 1 ? (
                        <button
                          onClick={() => onRemoveItem(gi.items[0].requirement_id)}
                          className="p-0.5 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          title="Remove item"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                            setRemoveDropdown(prev =>
                              prev?.groupKey === gi.groupKey ? null : { groupKey: gi.groupKey, anchorRect: rect }
                            );
                          }}
                          className="p-0.5 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          title="Remove item(s)"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
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
              ref={closingRef}
              value={closing}
              onChange={(e) => setClosing(e.target.value)}
              rows={1}
              className={`w-full px-2 py-1.5 text-xs ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-md ${PAGE_STYLES.panel.text} resize-none leading-relaxed overflow-hidden`}
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

      {/* Remove Dropdown Portal */}
      {removeDropdown && activeDropdownGroup && createPortal(
        <RemoveDropdown
          group={activeDropdownGroup}
          anchorRect={removeDropdown.anchorRect}
          onRemoveItem={(id) => {
            onRemoveItem(id);
            setRemoveDropdown(null);
          }}
          onRemoveAll={() => {
            activeDropdownGroup.items.forEach(item => onRemoveItem(item.requirement_id));
            setRemoveDropdown(null);
          }}
          onClose={() => setRemoveDropdown(null)}
        />,
        document.body
      )}
    </>
  );
};

/** Portal-rendered dropdown for removing individual items from a grouped line */
const RemoveDropdown: React.FC<{
  group: GroupedLineItem; anchorRect: DOMRect;
  onRemoveItem: (id: number) => void; onRemoveAll: () => void; onClose: () => void;
}> = ({ group, anchorRect, onRemoveItem, onRemoveAll, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div ref={menuRef} className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-lg z-[9999] py-1 min-w-[180px]"
      style={{ top: anchorRect.bottom + 4, left: anchorRect.right - 180 }}>
      <div className={`px-3 py-1.5 text-[10px] uppercase tracking-wide font-semibold ${PAGE_STYLES.panel.textMuted}`}>
        Remove which item?
      </div>
      {group.items.map((req) => {
        const { primary, secondary } = formatDropdownItem(req);
        return (
          <button key={req.requirement_id} onClick={() => onRemoveItem(req.requirement_id)}
            className="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-700 flex items-start gap-2">
            <X className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className={PAGE_STYLES.panel.text}>{primary}</div>
              {secondary && (
                <div className={`${PAGE_STYLES.panel.textMuted} text-[10px] truncate`}>{secondary}</div>
              )}
            </div>
          </button>
        );
      })}
      <div className={`border-t ${PAGE_STYLES.panel.border} mt-1 pt-1`}>
        <button onClick={onRemoveAll}
          className="w-full px-3 py-1.5 text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 font-medium">
          <X className="h-3 w-3 shrink-0" />
          Remove All ({group.items.length})
        </button>
      </div>
    </div>
  );
};
