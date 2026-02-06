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
  estimateId?: number;  // Linked estimate for auto-navigation in import modal
  highStandards?: boolean;  // Gold treatment for high-standards customers
  onPartsChange?: (parts: OrderPart[]) => void;
}

/**
 * Get the grid template columns based on Price Calculation expand/collapse state
 * - Expanded: Spec columns at 123px each, Price Calculation at 270px
 * - Collapsed: Spec columns at 200px each, Price Calculation at 40px (icon only)
 * Space calculation: 270px - 40px = 230px freed → distributed to 3 spec columns
 */
export const getGridTemplate = (isPriceCalcExpanded: boolean): string => {
  if (isPriceCalcExpanded) {
    // Original: Spec1-3 at 123px, PriceCalc at 270px
    return '40px 165px 115px 123px 123px 123px 62px 140px 380px 270px 55px 75px 85px';
  } else {
    // Collapsed: Spec1-3 at 200px, PriceCalc at 40px
    return '40px 165px 115px 200px 200px 200px 62px 140px 380px 40px 55px 75px 85px';
  }
};
