/**
 * DualTableLayout Constants and Types
 * Extracted from DualTableLayout.tsx (Phase 2)
 */

import { OrderPart } from '@/types/orders';

/**
 * All available specs display names (from specsTypeMapper.ts)
 * Used in ItemNameDropdown for selecting part display names
 */
export const SPECS_DISPLAY_NAMES = [
  'Front Lit',
  'Halo Lit',
  'Front Lit Acrylic Face',
  'Dual Lit - Single Layer',
  'Dual Lit - Double Layer',
  'Vinyl',
  'LEDs',
  'Power Supplies',
  'Extra Wire',
  'UL',
  'Substrate Cut',
  'Painting',
  'Dual Lit',
  'Trimless Front Lit',
  'Trimless Halo Lit',
  'Trimless Dual Lit',
  '3D print',
  'Blade Sign',
  'Marquee Bulb',
  'Epoxy',
  'Push Thru',
  'Neon LED',
  'Stainless Steel Sign',
  'Return',
  'Trim Cap',
  'Front Lit Push Thru',
  'Acrylic MINI',
  'Halo Acrylic',
  'Vinyl Cut',
  'Backer',
  'Frame',
  'Custom',
  'Aluminum Raceway',
  'Extrusion Raceway',
  'Dual Lit Acrylic Face (Discontinued)',
  'Material Cut',
  'Channel Letter',
  'Reverse Channel',
  'Trimless Channel',
  'Knockout Box',
] as const;

/**
 * QuickBooks item from qb_items table
 */
export interface QBItem {
  id: number;
  name: string;
  description: string | null;
  qbItemId: string;
  qbItemType: string | null;
}

/**
 * Tax rule from tax_rules table
 */
export interface TaxRule {
  tax_rule_id: number;
  tax_name: string;
  tax_percent: number;
  is_active: number;
}

/**
 * Props for DualTableLayout component
 */
export interface DualTableLayoutProps {
  orderNumber: number;
  initialParts: OrderPart[];
  taxName?: string;
  cash?: boolean;
  onPartsChange?: (parts: OrderPart[]) => void;
}
