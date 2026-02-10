/**
 * Vinyl Inventory Selector Types
 * Shared types for the unified vinyl selector modal
 */

import { VinylItemWithHolds } from '../../../types/materialRequirements';

/** Hold mode: used by Supply Chain to place holds on vinyl for material requirements */
export interface VinylSelectorHoldModeProps {
  mode: 'hold';
  vinylProductId: number;
  onSelect: (vinylId: number, quantity: string) => void;
  requirementSize?: string | null;
  requirementQty?: number;
}

/** Select mode: used by Bulk Entries to pick a specific vinyl piece */
export interface VinylSelectorSelectModeProps {
  mode: 'select';
  specifications: {
    brand: string;
    series: string;
    colour_number?: string;
    colour_name?: string;
  };
  onSelect: (item: VinylItemWithHolds) => void;
}

export type VinylSelectorModeProps = VinylSelectorHoldModeProps | VinylSelectorSelectModeProps;

export interface VinylInventorySelectorProps extends VinylSelectorModeProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}
