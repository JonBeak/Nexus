/**
 * Snapshot comparison utilities
 * Phase 1.5.c.3
 *
 * Compares current order part state with latest snapshot
 * to detect modifications after finalization.
 */

export interface PartSnapshot {
  snapshot_id: number;
  version_number: number;
  specifications: Record<string, any>;
  invoice_description?: string;
  quantity?: number;
  unit_price?: number;
  extended_price?: number;
  production_notes?: string;
  snapshot_type: 'finalization' | 'manual';
  notes?: string;
  created_at: string;
  created_by: number;
}

export interface OrderPartWithSnapshot {
  part_id: number;
  specifications?: Record<string, any>;
  invoice_description?: string;
  quantity?: number;
  unit_price?: number;
  extended_price?: number;
  production_notes?: string;
  latest_snapshot?: PartSnapshot;
}

export interface FieldComparison {
  field: string;
  snapshotValue: any;
  currentValue: any;
  isModified: boolean;
}

/**
 * Check if a part has been modified since latest snapshot
 */
export function isPartModified(part: OrderPartWithSnapshot): boolean {
  if (!part.latest_snapshot) return false;

  const snapshot = part.latest_snapshot;

  // Check specifications
  if (JSON.stringify(snapshot.specifications) !== JSON.stringify(part.specifications)) {
    return true;
  }

  // Check invoice fields
  if (
    snapshot.invoice_description !== part.invoice_description ||
    snapshot.quantity !== part.quantity ||
    snapshot.unit_price !== part.unit_price ||
    snapshot.extended_price !== part.extended_price
  ) {
    return true;
  }

  // Check production notes
  if (snapshot.production_notes !== part.production_notes) {
    return true;
  }

  return false;
}

/**
 * Check if a specific specification field has been modified
 */
export function isSpecFieldModified(
  part: OrderPartWithSnapshot,
  fieldKey: string
): boolean {
  if (!part.latest_snapshot?.specifications) return false;

  const snapshotValue = part.latest_snapshot.specifications[fieldKey];
  const currentValue = part.specifications?.[fieldKey];

  return snapshotValue !== currentValue;
}

/**
 * Check if an invoice field has been modified
 */
export function isInvoiceFieldModified(
  part: OrderPartWithSnapshot,
  field: 'invoice_description' | 'quantity' | 'unit_price' | 'extended_price'
): boolean {
  if (!part.latest_snapshot) return false;

  const snapshotValue = part.latest_snapshot[field];
  const currentValue = part[field];

  return snapshotValue !== currentValue;
}

/**
 * Check if production notes have been modified
 */
export function isProductionNotesModified(part: OrderPartWithSnapshot): boolean {
  if (!part.latest_snapshot) return false;

  return part.latest_snapshot.production_notes !== part.production_notes;
}

/**
 * Get all modified fields for a part
 */
export function getModifiedFields(part: OrderPartWithSnapshot): FieldComparison[] {
  if (!part.latest_snapshot) return [];

  const modifications: FieldComparison[] = [];

  // Check specifications
  if (part.latest_snapshot.specifications && part.specifications) {
    const snapshotSpecs = part.latest_snapshot.specifications;
    const currentSpecs = part.specifications;

    // Get all unique keys
    const allKeys = new Set([
      ...Object.keys(snapshotSpecs),
      ...Object.keys(currentSpecs)
    ]);

    for (const key of allKeys) {
      if (snapshotSpecs[key] !== currentSpecs[key]) {
        modifications.push({
          field: `spec_${key}`,
          snapshotValue: snapshotSpecs[key],
          currentValue: currentSpecs[key],
          isModified: true
        });
      }
    }
  }

  // Check invoice fields
  const invoiceFields: Array<'invoice_description' | 'quantity' | 'unit_price' | 'extended_price'> = [
    'invoice_description',
    'quantity',
    'unit_price',
    'extended_price'
  ];

  for (const field of invoiceFields) {
    if (isInvoiceFieldModified(part, field)) {
      modifications.push({
        field: `invoice_${field}`,
        snapshotValue: part.latest_snapshot[field],
        currentValue: part[field],
        isModified: true
      });
    }
  }

  // Check production notes
  if (isProductionNotesModified(part)) {
    modifications.push({
      field: 'production_notes',
      snapshotValue: part.latest_snapshot.production_notes,
      currentValue: part.production_notes,
      isModified: true
    });
  }

  return modifications;
}

/**
 * Format modification for display
 */
export function formatModification(comparison: FieldComparison): string {
  const oldValue = comparison.snapshotValue ?? '(empty)';
  const newValue = comparison.currentValue ?? '(empty)';
  return `Changed from "${oldValue}" to "${newValue}"`;
}

/**
 * Get modification summary for a part
 */
export function getModificationSummary(part: OrderPartWithSnapshot): string {
  if (!isPartModified(part)) {
    return 'No modifications';
  }

  const modifications = getModifiedFields(part);
  const count = modifications.length;

  if (count === 1) {
    return '1 field modified';
  }

  return `${count} fields modified`;
}

/**
 * Get snapshot version info
 */
export function getSnapshotVersion(part: OrderPartWithSnapshot): string | null {
  if (!part.latest_snapshot) return null;

  return `Version ${part.latest_snapshot.version_number}`;
}

/**
 * Format snapshot timestamp for display
 */
export function formatSnapshotDate(snapshot: PartSnapshot): string {
  const date = new Date(snapshot.created_at);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
