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
import { OrderConfirmationDialog } from './OrderConfirmationDialog';
import { OrderItemTooltip, type GroupedLineItem } from './OrderItemTooltip';
import { RemoveDropdown } from './RemoveDropdown';
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

/** Format a grouped line item for the PO email preview */
function formatGroupedLine(g: GroupedLineItem): string {
  const skuSuffix = g.sku ? ` (${g.sku})` : '';
  return `${g.totalQuantity} ${g.unit} — ${g.description}${skuSuffix}`;
}

/** Format currency for display */
function formatCurrency(amount: number | null): string {
  if (amount === null || isNaN(amount)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
  }).format(amount);
}

/** Calculate subtotal from grouped items */
function calculateSubtotal(items: GroupedLineItem[]): number {
  return items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
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
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [removeDropdown, setRemoveDropdown] = useState<{
    groupKey: string;
    anchorRect: DOMRect;
  } | null>(null);
  const [tooltipGroup, setTooltipGroup] = useState<{
    groupKey: string;
    anchorRect: DOMRect;
  } | null>(null);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs to store default chip state for dirty tracking
  const defaultToRef = useRef<string>('');
  const defaultCcRef = useRef<string>('');
  const defaultBccRef = useRef<string>('');

  // Group identical products (same description + sku + unit) into consolidated lines
  const groupedItems = useMemo<GroupedLineItem[]>(() => {
    const map = new Map<string, GroupedLineItem>();
    for (const req of group.requirements) {
      const productName = [req.supplier_product_brand?.trim(), req.supplier_product_name?.trim()].filter(Boolean).join(' ');
      const desc = productName || req.archetype_name || req.custom_product_type || 'Unknown Product';
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
        // Recalculate line total based on new quantity
        if (existing.unitPrice !== null) {
          existing.lineTotal = existing.unitPrice * existing.totalQuantity;
        }
      } else {
        const orderRefs: string[] = [];
        if (req.order_number) orderRefs.push(`Order #${req.order_number}`);
        const unitPrice = req.supplier_product_current_price;
        const currency = req.supplier_product_currency || 'CAD';
        map.set(key, {
          groupKey: key,
          description: desc,
          totalQuantity: Number(req.quantity_ordered),
          unit,
          sku: req.supplier_product_sku || null,
          orderRefs,
          items: [req],
          unitPrice,
          lineTotal: unitPrice ? unitPrice * Number(req.quantity_ordered) : null,
          currency,
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
  const defaultDeliveryMethod = group.default_delivery_method || 'shipping';
  const [deliveryMethod, setDeliveryMethod] = useState<'shipping' | 'pickup'>(defaultDeliveryMethod);
  const [emailSubject, setEmailSubject] = useState(`{PO#} - Order for ${defaultDeliveryMethod === 'pickup' ? 'Pickup' : 'Shipping'} - Sign House Inc.`);

  const supplierName = group.supplier_name || 'Supplier';
  const defaultOpening = `Hi ${supplierName},\nPlease find our purchase order details below.`;
  const defaultClosing = `Thank you for your prompt attention to this order. Please don't hesitate to reach out if you have any questions.\n\nBest regards,\n${companyName}`;

  const [opening, setOpening] = useState(defaultOpening);
  const [closing, setClosing] = useState(defaultClosing);

  // Track dirty (edited) fields — these reset on page refresh
  const defaultSubjectForMethod = `{PO#} - Order for ${deliveryMethod === 'pickup' ? 'Pickup' : 'Shipping'} - Sign House Inc.`;
  const isSubjectDirty = emailSubject !== defaultSubjectForMethod;
  const isOpeningDirty = opening !== defaultOpening;
  const isClosingDirty = closing !== defaultClosing;
  const isToChipsDirty = !loadingContacts && toChips.map(c => c.email).sort().join(',') !== defaultToRef.current;
  const isCcChipsDirty = ccChips.map(c => c.email).sort().join(',') !== defaultCcRef.current;
  const isBccChipsDirty = bccChips.map(c => c.email).sort().join(',') !== defaultBccRef.current;
  const isDeliveryDirty = deliveryMethod !== defaultDeliveryMethod;
  const hasUnsavedEdits = isSubjectDirty || isOpeningDirty || isClosingDirty || isToChipsDirty || isCcChipsDirty || isBccChipsDirty || isDeliveryDirty;
  const dirtyBorder = 'border-orange-400 dark:border-orange-500';

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

  // Snapshot default To/CC chips after contacts finish loading
  useEffect(() => {
    if (!loadingContacts) {
      defaultToRef.current = toChips.map(c => c.email).sort().join(',');
      defaultCcRef.current = ccChips.map(c => c.email).sort().join(',');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingContacts]);

  // BCC starts empty — user can add recipients manually
  // (company email is handled automatically by the internal copy email)
  useEffect(() => {
    defaultBccRef.current = '';
  }, []);

  const handleDeliveryChange = (method: 'shipping' | 'pickup') => {
    setDeliveryMethod(method);
    setEmailSubject(`{PO#} - Order for ${method === 'pickup' ? 'Pickup' : 'Shipping'} - Sign House Inc.`);
  };

  const handleConfirmAndSend = async () => {
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
      setShowConfirmation(false);
    } finally {
      setSubmitting(false);
    }
  };

  const itemCount = group.requirements.length;
  const canSubmit = toChips.length > 0 && itemCount > 0 && !submitting;

  // Tooltip hover handlers
  const handleItemMouseEnter = useCallback((groupKey: string, e: React.MouseEvent) => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    tooltipTimeoutRef.current = setTimeout(() => {
      setTooltipGroup({ groupKey, anchorRect: rect });
    }, 300);
  }, []);

  const handleItemMouseLeave = useCallback(() => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    tooltipTimeoutRef.current = setTimeout(() => {
      setTooltipGroup(null);
    }, 150);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    };
  }, []);

  // Find the active dropdown group (if any)
  const activeDropdownGroup = removeDropdown
    ? groupedItems.find(gi => gi.groupKey === removeDropdown.groupKey)
    : null;

  // Find the active tooltip group (if any)
  const activeTooltipGroup = tooltipGroup
    ? groupedItems.find(gi => gi.groupKey === tooltipGroup.groupKey)
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
              <div className={`rounded-md ${isToChipsDirty ? `border ${dirtyBorder}` : ''}`}>
                <ContactChipSelector
                  label="To:"
                  contacts={contacts}
                  selected={toChips}
                  onAdd={(chip) => setToChips(prev => [...prev, chip])}
                  onRemove={(id) => setToChips(prev => prev.filter(c => c.id !== id))}
                />
              </div>
              <div className={`rounded-md ${isCcChipsDirty ? `border ${dirtyBorder}` : ''}`}>
                <ContactChipSelector
                  label="CC:"
                  contacts={contacts}
                  selected={ccChips}
                  onAdd={(chip) => setCcChips(prev => [...prev, chip])}
                  onRemove={(id) => setCcChips(prev => prev.filter(c => c.id !== id))}
                />
              </div>
              <div className={`rounded-md ${isBccChipsDirty ? `border ${dirtyBorder}` : ''}`}>
                <ContactChipSelector
                  label="BCC:"
                  contacts={contacts}
                  selected={bccChips}
                  onAdd={(chip) => setBccChips(prev => [...prev, chip])}
                  onRemove={(id) => setBccChips(prev => prev.filter(c => c.id !== id))}
                />
              </div>
            </>
          )}

          {/* Subject */}
          <div className="flex items-center gap-1.5">
            <label className={`text-xs font-medium ${PAGE_STYLES.panel.textSecondary} w-8 shrink-0`}>Subj:</label>
            <div className="flex-1">
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className={`w-full px-1.5 py-1 text-xs ${PAGE_STYLES.input.background} ${isSubjectDirty ? dirtyBorder : PAGE_STYLES.input.border} border rounded-md ${PAGE_STYLES.panel.text}`}
              />
              <p className={`text-[10px] ${PAGE_STYLES.panel.textMuted} mt-0.5 ml-0.5`}>
                <span className="font-mono bg-gray-100 dark:bg-gray-700/50 px-0.5 rounded">{'{PO#}'}</span> will be replaced with the generated PO number
              </p>
            </div>
          </div>

          {/* Delivery Toggle */}
          <div className="flex items-center gap-1.5">
            <label className={`text-xs font-medium ${PAGE_STYLES.panel.textSecondary} w-8 shrink-0`}>&nbsp;</label>
            <div className="flex gap-1.5">
              <button
                onClick={() => handleDeliveryChange('shipping')}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors ${
                  deliveryMethod === 'shipping'
                    ? isDeliveryDirty
                      ? 'bg-yellow-200 dark:bg-yellow-900/30 border-orange-400 dark:border-orange-500 text-yellow-900 dark:text-yellow-300'
                      : 'bg-yellow-200 dark:bg-yellow-900/30 border-yellow-900 dark:border-yellow-600 text-yellow-900 dark:text-yellow-300'
                    : `${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} ${PAGE_STYLES.panel.textMuted}`
                }`}
              >
                <Truck className="w-3 h-3" /> Ship
              </button>
              <button
                onClick={() => handleDeliveryChange('pickup')}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors ${
                  deliveryMethod === 'pickup'
                    ? isDeliveryDirty
                      ? 'bg-blue-200 dark:bg-blue-900/30 border-orange-400 dark:border-orange-500 text-blue-900 dark:text-blue-300'
                      : 'bg-blue-200 dark:bg-blue-900/30 border-blue-900 dark:border-blue-600 text-blue-900 dark:text-blue-300'
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
              className={`w-full px-2 py-1.5 text-xs ${PAGE_STYLES.input.background} ${isOpeningDirty ? dirtyBorder : PAGE_STYLES.input.border} border rounded-md ${PAGE_STYLES.panel.text} resize-none leading-relaxed overflow-hidden`}
            />
          </div>

          {/* Order Items (read-only, removable) */}
          <div>
            <label className={`text-[10px] uppercase tracking-wide font-semibold ${PAGE_STYLES.panel.textMuted} mb-0.5 block`}>
              Order Items
            </label>
            <div className={`${PAGE_STYLES.input.background} border ${PAGE_STYLES.input.border} rounded-md px-2 py-1.5`}>
              {groupedItems.length > 0 ? (
                <div className="space-y-1">
                  {/* Column headers */}
                  <div className="flex items-center gap-1 pb-1 border-b text-[10px] font-medium uppercase tracking-wide"
                       style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-muted)' }}>
                    <span className="flex-1">Description</span>
                    <span className="text-right" style={{ minWidth: '70px' }}>Unit Price</span>
                    <span className="text-right" style={{ minWidth: '80px' }}>Ext Price</span>
                    <span style={{ width: '20px' }}></span> {/* Remove button space */}
                  </div>

                  {/* Items */}
                  <ul className={`divide-y divide-[var(--theme-border)]`}>
                    {groupedItems.map((gi) => (
                      <li
                        key={gi.groupKey}
                        className="flex items-start gap-1 group py-1 first:pt-0 last:pb-0 cursor-default"
                        onMouseEnter={(e) => handleItemMouseEnter(gi.groupKey, e)}
                        onMouseLeave={handleItemMouseLeave}
                      >
                        <span className={`text-xs ${PAGE_STYLES.panel.text} flex-1 leading-snug flex items-center gap-1`}>
                          {formatGroupedLine(gi)}
                          {gi.items.length > 1 && (
                            <span className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[9px] font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 shrink-0`}>
                              {gi.items.length}
                            </span>
                          )}
                        </span>

                        {/* Unit Price */}
                        <span className="text-xs text-right" style={{ minWidth: '70px', color: 'var(--theme-text-muted)' }}>
                          {formatCurrency(gi.unitPrice)}
                        </span>

                        {/* Extended Price */}
                        <span className="text-xs font-medium text-right" style={{ minWidth: '80px' }}>
                          {formatCurrency(gi.lineTotal)}
                        </span>

                        {/* Remove button */}
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

                  {/* Totals Section */}
                  <div className="mt-3 pt-2 border-t text-xs" style={{ borderColor: 'var(--theme-border)' }}>
                    <div className="flex justify-between items-center">
                      <span className="font-medium" style={{ color: 'var(--theme-text-muted)' }}>
                        Subtotal:
                      </span>
                      <span className="text-sm font-semibold">
                        {formatCurrency(calculateSubtotal(groupedItems))}
                      </span>
                    </div>
                  </div>
                </div>
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
              className={`w-full px-2 py-1.5 text-xs ${PAGE_STYLES.input.background} ${isClosingDirty ? dirtyBorder : PAGE_STYLES.input.border} border rounded-md ${PAGE_STYLES.panel.text} resize-none leading-relaxed overflow-hidden`}
            />
          </div>

          {/* Unsaved edits warning */}
          {hasUnsavedEdits && (
            <p className="text-[10px] text-orange-600 dark:text-orange-400">
              Edited fields will reset on page refresh
            </p>
          )}
        </div>

        {/* Footer: Place Order */}
        <div className={`px-4 py-2.5 border-t ${PAGE_STYLES.panel.border} flex items-center justify-end`}>
          <button
            onClick={() => setShowConfirmation(true)}
            disabled={!canSubmit}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-colors"
          >
            <Send className="w-3 h-3" />
            Place Order
          </button>
        </div>
      </div>

      {/* Order Confirmation Dialog */}
      <OrderConfirmationDialog
        open={showConfirmation}
        submitting={submitting}
        supplierName={supplierName}
        deliveryMethod={deliveryMethod}
        toChips={toChips}
        ccChips={ccChips}
        bccChips={bccChips}
        companyEmail={companyEmail}
        subject={emailSubject}
        opening={opening}
        closing={closing}
        items={groupedItems.map(gi => ({
          description: gi.description,
          totalQuantity: gi.totalQuantity,
          unit: gi.unit,
          sku: gi.sku,
          unitPrice: gi.unitPrice,
          lineTotal: gi.lineTotal,
          currency: gi.currency,
        }))}
        onConfirm={() => void handleConfirmAndSend()}
        onCancel={() => setShowConfirmation(false)}
      />

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

      {/* Order Item Tooltip Portal */}
      {tooltipGroup && activeTooltipGroup && createPortal(
        <OrderItemTooltip
          group={activeTooltipGroup}
          anchorRect={tooltipGroup.anchorRect}
          onMouseEnter={() => {
            if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
          }}
          onMouseLeave={handleItemMouseLeave}
        />,
        document.body
      )}
    </>
  );
};
