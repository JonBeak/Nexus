/**
 * All Orders Material Requirements
 * Inline-editable table tracking all material requirements across orders and stock
 * Created: 2025-01-27
 * Updated: 2026-02-02 - Redesign with Product Type, cascading Product, Ordered date,
 *          Receiving Status dropdown, and computed Auto Status badge
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Package,
  Truck,
  CheckCircle,
  Clock,
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  Trash2,
  ShoppingCart,
  HandMetal,
  XCircle,
} from 'lucide-react';
import { PAGE_STYLES, MODULE_COLORS } from '../../constants/moduleColors';
import { materialRequirementsApi, ordersApi, supplierProductsApi, archetypesApi, vinylProductsApi, suppliersApi } from '../../services/api';
import { InlineEditableCell } from './components/InlineEditableCell';
import { SupplierDropdown, SUPPLIER_IN_STOCK } from './components/SupplierDropdown';
import { OrderDropdown } from './components/OrderDropdown';
import { ProductTypeDropdown } from './components/ProductTypeDropdown';
import { ProductDropdown } from './components/ProductDropdown';
import { CheckStockButton } from './components/CheckStockButton';
import { HeldItemButton } from './components/HeldItemButton';
import { VinylInventorySelector } from '../common/VinylInventorySelector';
import { GeneralInventorySelectorModal } from './components/GeneralInventorySelectorModal';
import { MultiHoldReceiveModal } from './components/MultiHoldReceiveModal';
import { getTodayString } from '../../utils/dateUtils';
import type {
  MaterialRequirement,
  MaterialRequirementStatus,
  MaterialRequirementFilters,
  CreateMaterialRequirementRequest,
  OrderDropdownOption,
  ComputedRequirementStatus,
  VinylHold,
} from '../../types/materialRequirements';
import type { User as AccountUser } from '../accounts/hooks/useAccountAPI';

interface SupplierProduct {
  supplier_product_id: number;
  product_name: string | null;
  sku: string | null;
  supplier_id: number;
  supplier_name?: string;
  archetype_id?: number;
}

interface AllOrdersMaterialRequirementsProps {
  user?: AccountUser;
  showNotification: (message: string, type?: 'success' | 'error') => void;
}


const ALL_STATUSES: MaterialRequirementStatus[] = [
  'pending', 'ordered', 'backordered', 'partial_received', 'received', 'cancelled',
];

const ALL_COMPUTED_STATUSES: ComputedRequirementStatus[] = [
  'pending', 'ordered_pickup', 'ordered_shipping', 'to_be_picked',
  'backordered', 'partial_received', 'fulfilled', 'cancelled',
];

/** Default: everything except fulfilled/cancelled */
const DEFAULT_ACTIVE_COMPUTED_STATUSES: ComputedRequirementStatus[] = [
  'pending', 'ordered_pickup', 'ordered_shipping', 'to_be_picked',
  'backordered', 'partial_received',
];

const COMPUTED_STATUS_TOGGLES: {
  value: ComputedRequirementStatus;
  label: string;
  icon: React.FC<{ className?: string }>;
  activeBg: string;
  activeBorder: string;
  activeText: string;
}[] = [
  { value: 'pending',           label: 'Pending',      icon: Clock,        activeBg: 'bg-gray-300',   activeBorder: 'border-gray-700',   activeText: 'text-gray-700' },
  { value: 'ordered_pickup',    label: 'Pickup',       icon: ShoppingCart,  activeBg: 'bg-blue-200',   activeBorder: 'border-blue-900',   activeText: 'text-blue-900' },
  { value: 'ordered_shipping',  label: 'Shipping',     icon: Truck,         activeBg: 'bg-yellow-200', activeBorder: 'border-yellow-900', activeText: 'text-yellow-900' },
  { value: 'to_be_picked',      label: 'To Pick',      icon: HandMetal,     activeBg: 'bg-purple-200', activeBorder: 'border-purple-900', activeText: 'text-purple-900' },
  { value: 'backordered',       label: 'Backordered',  icon: Package,       activeBg: 'bg-orange-200', activeBorder: 'border-orange-800', activeText: 'text-orange-800' },
  { value: 'partial_received',  label: 'Partial',      icon: RefreshCw,     activeBg: 'bg-amber-200',  activeBorder: 'border-amber-800',  activeText: 'text-amber-800' },
  { value: 'fulfilled',         label: 'Fulfilled',    icon: CheckCircle,   activeBg: 'bg-green-200',  activeBorder: 'border-green-900',  activeText: 'text-green-900' },
  { value: 'cancelled',         label: 'Cancelled',    icon: XCircle,       activeBg: 'bg-red-200',    activeBorder: 'border-red-900',    activeText: 'text-red-900' },
];

const DELIVERY_OPTIONS = [
  { value: 'shipping', label: 'Ship' },
  { value: 'pickup', label: 'Pickup' },
];


// Receiving Status dropdown options (replaces old status editing)
// When "Select..." (empty) is chosen, it maps to 'pending' status
const RECEIVING_STATUS_OPTIONS = [
  { value: 'received', label: 'Received' },
  { value: 'backordered', label: 'Backordered' },
  { value: 'partial_received', label: 'Partial' },
  { value: 'cancelled', label: 'Cancelled' },
];


/**
 * Compute auto status based on ORDERED (ordered_date) x RECEIVING (status)
 *
 * | Ordered Date | Receiving     | Auto Status           |
 * |--------------|---------------|-----------------------|
 * | No           | Select...     | Pending               |
 * | Yes          | Select...     | Ordered (Pickup/Ship) |
 * | Yes          | Backordered   | Backordered           |
 * | Yes          | Partial       | Partial               |
 * | Any          | Received      | Fulfilled             |
 * | Any          | Cancelled     | Cancelled             |
 * | In Stock     | Select...     | To Pick               |
 */
const computeAutoStatus = (req: MaterialRequirement): ComputedRequirementStatus => {
  // Fulfilled: received (require received_date to be set)
  if (req.status === 'received' && req.received_date) {
    return 'fulfilled';
  }

  // Cancelled (require received_date to be set)
  if (req.status === 'cancelled' && req.received_date) {
    return 'cancelled';
  }

  // Backordered
  if (req.status === 'backordered') {
    return 'backordered';
  }

  // Partial received
  if (req.status === 'partial_received') {
    return 'partial_received';
  }

  // Not received yet (pending/ordered status) - check ordered_date and supplier
  // In Stock items → To Pick
  if (req.supplier_id === SUPPLIER_IN_STOCK) {
    return 'to_be_picked';
  }

  // Has ordered_date + delivery_method → Ordered for pickup/shipping
  if (req.ordered_date && req.delivery_method) {
    return req.delivery_method === 'pickup' ? 'ordered_pickup' : 'ordered_shipping';
  }

  // Default: pending (not ordered yet)
  return 'pending';
};

/**
 * Get badge for computed auto status
 */
const getAutoStatusBadge = (status: ComputedRequirementStatus) => {
  switch (status) {
    case 'pending':
      return (
        <span className="px-1.5 py-1 text-[11px] font-medium rounded-full justify-center bg-gray-300 text-gray-700 border border-gray-700 flex items-center gap-1 whitespace-nowrap">
          <Clock className="w-3 h-3" />
          Pending
        </span>
      );
    case 'ordered_pickup':
      return (
        <span className="px-1.5 py-1 text-[11px] font-medium rounded-full justify-center bg-blue-200 text-blue-900 border border-blue-900 flex items-center gap-1 whitespace-nowrap">
          <ShoppingCart className="w-3 h-3" />
          Pickup
        </span>
      );
    case 'ordered_shipping':
      return (
        <span className="px-1.5 py-1 text-[11px] font-medium rounded-full justify-center bg-yellow-200 text-yellow-900 border border-yellow-900 flex items-center gap-1 whitespace-nowrap">
          <Truck className="w-3 h-3" />
          Shipping
        </span>
      );
    case 'to_be_picked':
      return (
        <span className="px-1.5 py-1 text-[11px] font-medium rounded-full justify-center bg-purple-200 text-purple-900 border border-purple-900 flex items-center gap-1 whitespace-nowrap">
          <HandMetal className="w-3 h-3" />
          To Pick
        </span>
      );
    case 'backordered':
      return (
        <span className="px-1.5 py-1 text-[11px] font-medium rounded-full justify-center bg-orange-200 text-orange-800 border border-orange-800 flex items-center gap-1 whitespace-nowrap">
          <Package className="w-3 h-3" />
          Backordered
        </span>
      );
    case 'partial_received':
      return (
        <span className="px-1.5 py-1 text-[11px] font-medium rounded-full justify-center bg-amber-200 text-amber-800 border border-amber-800 flex items-center gap-1 whitespace-nowrap">
          <RefreshCw className="w-3 h-3" />
          Partial
        </span>
      );
    case 'fulfilled':
      return (
        <span className="px-1.5 py-1 text-[11px] font-medium rounded-full justify-center bg-green-200 text-green-900 border border-green-900 flex items-center gap-1 whitespace-nowrap">
          <CheckCircle className="w-3 h-3" />
          Fulfilled
        </span>
      );
    case 'cancelled':
      return (
        <span className="px-1.5 py-1 text-[11px] font-medium rounded-full justify-center bg-red-200 text-red-900 border border-red-900 flex items-center gap-1 whitespace-nowrap">
          <XCircle className="w-3 h-3" />
          Cancelled
        </span>
      );
    default:
      return null;
  }
};


/** Color palette for PO# border matching (same PO# = same color) */
const PO_BORDER_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
];
const getPOBorderColor = (poNumber: string): string => {
  let hash = 0;
  for (let i = 0; i < poNumber.length; i++) {
    hash = ((hash << 5) - hash) + poNumber.charCodeAt(i);
    hash |= 0;
  }
  return PO_BORDER_COLORS[Math.abs(hash) % PO_BORDER_COLORS.length];
};

/** Row background color based on computed auto status */
const getRowBgClass = (status: ComputedRequirementStatus): string => {
  switch (status) {
    case 'ordered_pickup': return 'bg-blue-400';
    case 'ordered_shipping': return 'bg-yellow-400';
    case 'to_be_picked': return 'bg-purple-400';
    case 'backordered': return '';
    case 'partial_received': return '';
    case 'fulfilled': return 'bg-green-400';
    case 'cancelled': return 'bg-red-400';
    default: return '';
  }
};

export const AllOrdersMaterialRequirements: React.FC<AllOrdersMaterialRequirementsProps> = ({
  user,
  showNotification,
}) => {
  void user;
  const [requirements, setRequirements] = useState<MaterialRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<MaterialRequirementFilters>({
    status: [...ALL_STATUSES], // Fetch all from API; filtering is done client-side by computedStatus
    computedStatus: [...DEFAULT_ACTIVE_COMPUTED_STATUSES],
    isStockItem: 'all',
    supplierId: null,
    search: '',
    dateRange: { from: null, to: null },
  });
  const [showFilters, setShowFilters] = useState(false);

  // Client-side filter by computed status toggles
  // Also hide fulfilled/cancelled rows older than 14 days unless explicitly toggled on
  const { visibleRequirements, hiddenCompletedCount } = useMemo(() => {
    const hasFulfilled = filters.computedStatus.includes('fulfilled');
    const hasCancelled = filters.computedStatus.includes('cancelled');

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    const cutoffTime = cutoff.getTime();

    let hiddenCount = 0;
    const visible = requirements.filter((req) => {
      const autoStatus = computeAutoStatus(req);

      // Filter by computed status toggles
      if (!filters.computedStatus.includes(autoStatus)) {
        return false;
      }

      // Auto-hide old fulfilled/cancelled unless explicitly toggled on alongside the other
      if (hasFulfilled && hasCancelled) return true;

      if (autoStatus === 'fulfilled' || autoStatus === 'cancelled') {
        const dateStr = req.received_date || req.updated_at;
        if (!dateStr) return true;

        const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!match) return true;

        const rowDate = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        if (rowDate.getTime() <= cutoffTime) {
          hiddenCount++;
          return false;
        }
      }

      return true;
    });

    return { visibleRequirements: visible, hiddenCompletedCount: hiddenCount };
  }, [requirements, filters.computedStatus]);


  // Orders for dropdown
  const [availableOrders, setAvailableOrders] = useState<OrderDropdownOption[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Supplier products for vendor filtering
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([]);

  // Load all dropdown data ONCE in parent (prevents API spam)
  // Initialize as undefined so dropdowns know data hasn't loaded yet
  const [archetypes, setArchetypes] = useState<any[] | undefined>(undefined);
  const [vinylProducts, setVinylProducts] = useState<any[] | undefined>(undefined);
  const [suppliers, setSuppliers] = useState<any[] | undefined>(undefined);

  // Inventory Hold Modal State
  const [showVinylSelector, setShowVinylSelector] = useState(false);
  const [showGeneralInventorySelector, setShowGeneralInventorySelector] = useState(false);
  const [showMultiHoldModal, setShowMultiHoldModal] = useState(false);
  const [selectedRequirementForHold, setSelectedRequirementForHold] = useState<MaterialRequirement | null>(null);
  const [multiHoldData, setMultiHoldData] = useState<{
    requirement: MaterialRequirement;
    otherHolds: VinylHold[];
  } | null>(null);

  const loadRequirements = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};

      // Always fetch all statuses from API — filtering is done client-side by computed status
      if (filters.isStockItem !== 'all') {
        params.is_stock_item = filters.isStockItem;
      }
      if (filters.supplierId) {
        params.supplier_id = filters.supplierId;
      }
      if (filters.search) {
        params.search = filters.search;
      }
      if (filters.dateRange.from) {
        params.entry_date_from = filters.dateRange.from;
      }
      if (filters.dateRange.to) {
        params.entry_date_to = filters.dateRange.to;
      }

      const data = await materialRequirementsApi.getRequirements(params);
      setRequirements(data);
    } catch (error) {
      console.error('Error loading requirements:', error);
      showNotification('Failed to load material requirements', 'error');
    } finally {
      setLoading(false);
    }
  // Only re-fetch when API-relevant filters change (not computedStatus which is client-side)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.isStockItem, filters.supplierId, filters.search, filters.dateRange.from, filters.dateRange.to, showNotification]);

  useEffect(() => {
    void loadRequirements();
  }, [loadRequirements]);

  // Load all orders for dropdown
  useEffect(() => {
    const loadOrders = async () => {
      try {
        setLoadingOrders(true);
        const orders = await ordersApi.getOrders({}); // Load all orders
        setAvailableOrders(orders.map((o: any) => ({
          order_id: o.order_id,
          order_number: String(o.order_number),
          order_name: o.order_name || '',
          customer_name: o.customer_name || ''
        })));
      } catch (error) {
        console.error('Failed to load orders:', error);
      } finally {
        setLoadingOrders(false);
      }
    };
    void loadOrders();
  }, []);

  // Load supplier products for vendor filtering
  useEffect(() => {
    const loadSupplierProducts = async () => {
      try {
        const products = await supplierProductsApi.getSupplierProducts({ active_only: true });
        setSupplierProducts(products);
      } catch (error) {
        console.error('Failed to load supplier products:', error);
      }
    };
    void loadSupplierProducts();
  }, []);

  // Load archetypes ONCE for all ProductTypeDropdowns
  useEffect(() => {
    const loadArchetypes = async () => {
      try {
        const data = await archetypesApi.getArchetypes({ active_only: true });
        setArchetypes(data);
      } catch (error) {
        console.error('Failed to load archetypes:', error);
      }
    };
    void loadArchetypes();
  }, []);

  // Load vinyl products ONCE for all ProductDropdowns
  useEffect(() => {
    const loadVinylProducts = async () => {
      try {
        const data = await vinylProductsApi.getVinylProducts({ active_only: true });
        setVinylProducts(data);
      } catch (error) {
        console.error('Failed to load vinyl products:', error);
      }
    };
    void loadVinylProducts();
  }, []);

  // Load suppliers ONCE for all SupplierDropdowns
  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const data = await suppliersApi.getSuppliers({ active_only: true });
        setSuppliers(data);
      } catch (error) {
        console.error('Failed to load suppliers:', error);
      }
    };
    void loadSuppliers();
  }, []);



  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this requirement?')) return;

    try {
      await materialRequirementsApi.deleteRequirement(id);
      showNotification('Requirement deleted', 'success');
      void loadRequirements();
    } catch (error) {
      console.error('Error deleting requirement:', error);
      showNotification('Failed to delete requirement', 'error');
    }
  };

  const handleInlineEdit = async (id: number, field: string, value: any) => {
    console.log('handleInlineEdit called:', { id, field, value });
    try {
      await materialRequirementsApi.updateRequirement(id, { [field]: value });
      console.log('API call succeeded, updating local state');
      // Update local state without full reload for smoother UX
      const stateUpdate: Record<string, any> = { [field]: value };

      // Mirror backend cascading: clearing ordered_date also clears PO link and reverts status
      if (field === 'ordered_date' && !value) {
        stateUpdate.supplier_order_number = null;
        stateUpdate.supplier_order_id = null;
        stateUpdate.status = 'pending';
      }

      setRequirements(prev => prev.map(req =>
        req.requirement_id === id ? { ...req, ...stateUpdate } : req
      ));
    } catch (error) {
      console.error('Error updating requirement:', error);
      showNotification('Failed to update', 'error');
      void loadRequirements();
    }
  };

  // Handle multiple field updates at once (for cascading dropdowns)
  const handleMultiFieldEdit = async (id: number, updates: Record<string, any>) => {
    try {
      await materialRequirementsApi.updateRequirement(id, updates);
      setRequirements(prev => prev.map(req =>
        req.requirement_id === id ? { ...req, ...updates } : req
      ));
    } catch (error) {
      console.error('Error updating requirement:', error);
      showNotification('Failed to update', 'error');
      void loadRequirements();
    }
  };

  /**
   * Vinyl product selection - no auto-assignment, no clearing
   * Just update vinyl product field independently
   */
  const handleVinylProductSelect = async (requirementId: number, productId: number | null) => {
    // Just update vinyl product - don't auto-assign vendor, don't clear supplier product
    await handleInlineEdit(requirementId, 'vinyl_product_id', productId);
  };

  /**
   * Supplier product selection with auto-vendor assignment
   * Keeps auto-assignment for convenience, but doesn't clear vinyl product
   */
  const handleSupplierProductSelect = async (requirementId: number, productId: number | null) => {
    if (productId === null) {
      // Just clear supplier product - don't auto-clear vendor
      await handleInlineEdit(requirementId, 'supplier_product_id', null);
      return;
    }

    const selectedProduct = supplierProducts.find(p => p.supplier_product_id === productId);
    const autoSupplierId = selectedProduct?.supplier_id ?? null;

    // Update supplier product AND auto-assign vendor (but don't clear vinyl product)
    await handleMultiFieldEdit(requirementId, {
      supplier_product_id: productId,
      supplier_id: autoSupplierId,  // ✓ Keep auto-assignment for convenience
    });
  };

  /**
   * Custom product type text change (non-vinyl combobox)
   * Saves custom text and clears supplier_product_id if needed
   */
  const handleCustomProductTypeChange = async (requirementId: number, text: string) => {
    const updates: Record<string, any> = { custom_product_type: text };
    const req = requirements.find(r => r.requirement_id === requirementId);
    if (text.trim() && req?.supplier_product_id !== null) {
      updates.supplier_product_id = null;
    }
    await handleMultiFieldEdit(requirementId, updates);
  };

  // ===========================================================================
  // INVENTORY HOLD HANDLERS
  // ===========================================================================

  /**
   * Handle "Check Stock" button click
   * Opens appropriate selector modal based on stock type
   */
  const handleCheckStock = (requirement: MaterialRequirement, stockType: 'vinyl' | 'general') => {
    setSelectedRequirementForHold(requirement);
    if (stockType === 'vinyl') {
      setShowVinylSelector(true);
    } else {
      setShowGeneralInventorySelector(true);
    }
  };

  /**
   * Handle vinyl selection from the selector modal
   * Creates a hold on the vinyl piece
   */
  const handleVinylHoldSelect = async (vinylId: number, quantity: string) => {
    if (!selectedRequirementForHold) return;

    try {
      await materialRequirementsApi.createVinylHold(selectedRequirementForHold.requirement_id, {
        vinyl_id: vinylId,
        quantity,
      });
      showNotification('Hold placed successfully', 'success');
      setShowVinylSelector(false);
      setSelectedRequirementForHold(null);
      void loadRequirements();
    } catch (error: any) {
      console.error('Error creating vinyl hold:', error);
      showNotification(error.response?.data?.error || 'Failed to create hold', 'error');
    }
  };

  /**
   * Handle general inventory selection from the selector modal
   * Creates a hold on the supplier product
   */
  const handleGeneralInventoryHoldSelect = async (supplierProductId: number, quantity: string) => {
    if (!selectedRequirementForHold) return;

    try {
      await materialRequirementsApi.createGeneralInventoryHold(selectedRequirementForHold.requirement_id, {
        supplier_product_id: supplierProductId,
        quantity,
      });
      showNotification('Hold placed successfully', 'success');
      setShowGeneralInventorySelector(false);
      setSelectedRequirementForHold(null);
      void loadRequirements();
    } catch (error: any) {
      console.error('Error creating general inventory hold:', error);
      showNotification(error.response?.data?.error || 'Failed to create hold', 'error');
    }
  };

  /**
   * Handle edit hold button click
   * Re-opens the selector modal with current item pre-selected
   */
  const handleEditHold = (requirement: MaterialRequirement) => {
    setSelectedRequirementForHold(requirement);
    if (requirement.held_vinyl_id) {
      setShowVinylSelector(true);
    } else if (requirement.held_supplier_product_id) {
      setShowGeneralInventorySelector(true);
    }
  };

  /**
   * Handle release hold button click
   * Removes the hold and clears vendor fields
   */
  const handleReleaseHold = async (requirement: MaterialRequirement) => {
    if (!confirm('Release this hold? The item will become available again.')) return;

    try {
      await materialRequirementsApi.releaseHold(requirement.requirement_id);
      showNotification('Hold released', 'success');
      void loadRequirements();
    } catch (error: any) {
      console.error('Error releasing hold:', error);
      showNotification(error.response?.data?.error || 'Failed to release hold', 'error');
    }
  };

  /**
   * Handle status change to "received" for held items
   * Checks for other holds and shows multi-hold modal if needed
   */
  const handleReceiveWithHold = async (requirement: MaterialRequirement) => {
    if (!requirement.held_vinyl_id) {
      // No vinyl hold - just do normal receive
      await handleInlineEdit(requirement.requirement_id, 'status', 'received');
      return;
    }

    try {
      // Check for other holds on the same vinyl
      const otherHolds = await materialRequirementsApi.getOtherHoldsOnVinyl(
        requirement.requirement_id,
        requirement.held_vinyl_id
      );

      if (otherHolds.length > 0) {
        // Show multi-hold modal
        setMultiHoldData({ requirement, otherHolds });
        setShowMultiHoldModal(true);
      } else {
        // No other holds - receive directly
        await materialRequirementsApi.receiveRequirementWithHold(requirement.requirement_id);
        showNotification('Requirement received, vinyl marked as used', 'success');
        void loadRequirements();
      }
    } catch (error: any) {
      console.error('Error receiving with hold:', error);
      showNotification(error.response?.data?.error || 'Failed to receive', 'error');
    }
  };

  /**
   * Handle confirmation from multi-hold receive modal
   */
  const handleMultiHoldConfirm = async (alsoReceiveIds: number[]) => {
    if (!multiHoldData) return;

    try {
      const result = await materialRequirementsApi.receiveRequirementWithHold(
        multiHoldData.requirement.requirement_id,
        { also_receive_requirement_ids: alsoReceiveIds }
      );

      const releasedCount = multiHoldData.otherHolds.length - alsoReceiveIds.length;
      if (releasedCount > 0) {
        showNotification(
          `Received ${result.received_count} requirements. ${releasedCount} holds released.`,
          'success'
        );
      } else {
        showNotification('All requirements marked as received', 'success');
      }

      setShowMultiHoldModal(false);
      setMultiHoldData(null);
      void loadRequirements();
    } catch (error: any) {
      console.error('Error processing multi-hold receive:', error);
      showNotification(error.response?.data?.error || 'Failed to process', 'error');
    }
  };

  // Add new requirement handler
  const handleAddNewRequirement = async () => {
    try {
      const createData: CreateMaterialRequirementRequest = {
        is_stock_item: true,  // Default to Stock
        order_id: null,
        archetype_id: null,
        vinyl_product_id: null,
        supplier_product_id: null,
        custom_product_type: undefined,
        unit: 'each',
        quantity_ordered: 0,  // Start with 0 to bypass validation until product type is selected
        supplier_id: null,
        delivery_method: undefined,
        notes: undefined,
        entry_date: getTodayString(),
      };

      const newRequirement = await materialRequirementsApi.createRequirement(createData);
      showNotification('Requirement added', 'success');
      // Add new row to local state instead of full reload
      setRequirements(prev => [newRequirement, ...prev]);
    } catch (error) {
      console.error('Error creating requirement:', error);
      showNotification('Failed to add requirement', 'error');
    }
  };


  const thClass = `px-1 py-1 text-left text-[10px] font-medium ${PAGE_STYLES.panel.textSecondary} uppercase tracking-wider`;

  if (loading && requirements.length === 0) {
    return (
      <div className="text-center py-8">
        <div className={`inline-block animate-spin rounded-full h-6 w-6 border-b-2 ${MODULE_COLORS.supplyChain.border}`}></div>
        <p className={`mt-2 text-sm ${PAGE_STYLES.panel.textMuted}`}>Loading requirements...</p>
      </div>
    );
  }

  return (
    <div className={`${PAGE_STYLES.composites.panelContainer} overflow-hidden`}>
      {/* Header */}
      <div className={`px-4 py-3 ${PAGE_STYLES.panel.border} border-b flex items-center justify-between ${PAGE_STYLES.header.background}`}>
        <div>
          <h3 className={`text-lg font-medium ${PAGE_STYLES.panel.text}`}>All Material Requirements</h3>
          <div className={`text-sm ${PAGE_STYLES.panel.textMuted}`}>
            {visibleRequirements.length} requirements{hiddenCompletedCount > 0 && ` (${hiddenCompletedCount} old fulfilled/cancelled hidden)`}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${PAGE_STYLES.panel.textMuted}`} />
            <input
              type="text"
              placeholder="Search..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className={`pl-9 pr-3 py-1.5 text-sm ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-md focus:ring-red-500 focus:border-red-500 w-48`}
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.text} border ${PAGE_STYLES.panel.border} flex items-center gap-1`}
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {/* Refresh */}
          <button
            onClick={() => void loadRequirements()}
            className={`p-1.5 rounded-md ${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.text} border ${PAGE_STYLES.panel.border}`}
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Add Button */}
          <button
            onClick={handleAddNewRequirement}
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${MODULE_COLORS.supplyChain.base} text-white ${MODULE_COLORS.supplyChain.hover} flex items-center gap-1`}
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* Status Toggle Pills */}
      <div className={`px-4 py-2 ${PAGE_STYLES.panel.border} border-b ${PAGE_STYLES.header.background} flex items-center gap-1.5 flex-wrap`}>
        {/* Select All / Deselect All */}
        <button
          onClick={() => {
            const allSelected = filters.computedStatus.length === ALL_COMPUTED_STATUSES.length;
            setFilters(prev => ({
              ...prev,
              computedStatus: allSelected ? [] : [...ALL_COMPUTED_STATUSES],
            }));
          }}
          className={`px-2 py-1 text-[11px] font-medium rounded-full border flex items-center gap-1 whitespace-nowrap transition-all ${
            filters.computedStatus.length === ALL_COMPUTED_STATUSES.length
              ? 'bg-white text-gray-800 border-gray-400'
              : filters.computedStatus.length === 0
                ? 'bg-gray-700 text-gray-400 border-gray-600 hover:bg-gray-600'
                : 'bg-gray-500 text-gray-200 border-gray-400 hover:bg-gray-400'
          }`}
          title={filters.computedStatus.length === ALL_COMPUTED_STATUSES.length ? 'Deselect All' : 'Select All'}
        >
          {filters.computedStatus.length === ALL_COMPUTED_STATUSES.length ? 'Deselect All' : 'Select All'}
        </button>

        <span className="w-px h-5 bg-gray-600" />

        {COMPUTED_STATUS_TOGGLES.map((toggle) => {
          const Icon = toggle.icon;
          const isActive = filters.computedStatus.includes(toggle.value);
          return (
            <button
              key={toggle.value}
              onClick={() => {
                setFilters(prev => ({
                  ...prev,
                  computedStatus: isActive
                    ? prev.computedStatus.filter(s => s !== toggle.value)
                    : [...prev.computedStatus, toggle.value],
                }));
              }}
              className={`px-2 py-1 text-[11px] font-medium rounded-full border flex items-center gap-1 whitespace-nowrap transition-all ${
                isActive
                  ? `${toggle.activeBg} ${toggle.activeText} ${toggle.activeBorder}`
                  : 'bg-gray-700 text-gray-400 border-gray-600 hover:bg-gray-600'
              }`}
            >
              <Icon className="w-3 h-3" />
              {toggle.label}
            </button>
          );
        })}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className={`px-4 py-3 ${PAGE_STYLES.header.background} border-b ${PAGE_STYLES.panel.border} flex flex-wrap gap-4`}>
          <div>
            <label className={`block text-xs font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>Type</label>
            <select
              value={filters.isStockItem === 'all' ? 'all' : filters.isStockItem ? 'stock' : 'order'}
              onChange={(e) => setFilters({
                ...filters,
                isStockItem: e.target.value === 'all' ? 'all' : e.target.value === 'stock'
              })}
              className={`text-sm ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-md px-2 py-1`}
            >
              <option value="all">All Types</option>
              <option value="order">Orders Only</option>
              <option value="stock">Stock Only</option>
            </select>
          </div>
          <div>
            <label className={`block text-xs font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>From Date</label>
            <input
              type="date"
              value={filters.dateRange.from || ''}
              onChange={(e) => setFilters({ ...filters, dateRange: { ...filters.dateRange, from: e.target.value || null } })}
              className={`text-sm ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-md px-2 py-1`}
            />
          </div>
          <div>
            <label className={`block text-xs font-medium ${PAGE_STYLES.panel.textSecondary} mb-1`}>To Date</label>
            <input
              type="date"
              value={filters.dateRange.to || ''}
              onChange={(e) => setFilters({ ...filters, dateRange: { ...filters.dateRange, to: e.target.value || null } })}
              className={`text-sm ${PAGE_STYLES.input.background} ${PAGE_STYLES.input.border} border rounded-md px-2 py-1`}
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs [&_input::placeholder]:!text-gray-300 [&_textarea::placeholder]:!text-gray-300">
          <thead className={`${PAGE_STYLES.header.background} ${PAGE_STYLES.panel.border} border-b`}>
            <tr>
              <th className={thClass} style={{ width: '95px' }}>Date</th>
              <th className={thClass} style={{ width: '170px' }}>Order Ref</th>
              <th className={thClass} style={{ width: '130px' }}>Product Type</th>
              <th className={thClass} style={{ width: '160px' }}>Product</th>
              <th className={thClass} style={{ width: '90px' }}>Unit</th>
              <th className={`${thClass} text-right`} style={{ width: '65px' }}>Qty</th>
              <th className={thClass} style={{ width: '130px' }}>Vendor</th>
              <th className={thClass} style={{ width: '70px' }}>Delivery</th>
              <th className={thClass} style={{ width: '85px' }}>Ordered</th>
              <th className={thClass} style={{ width: '90px' }}>Receiving</th>
              <th className={thClass} style={{ width: '85px' }}>Received</th>
              <th className={thClass} style={{ width: '90px' }}>PO#</th>
              <th className={thClass} style={{ width: '160px' }}>Notes</th>
              <th className={`${thClass} text-center`} style={{ width: '60px' }}>Actions</th>
              <th className={`${thClass} text-center`} style={{ width: '80px' }}>Status</th>
            </tr>
          </thead>
          <tbody className={PAGE_STYLES.panel.divider}>
            {/* All Rows */}
            {visibleRequirements.map((req) => {
              const autoStatus = computeAutoStatus(req);
              return (
                <tr
                  key={req.requirement_id}
                  className={`hover:shadow-[inset_0_0_0_9999px_rgba(0,0,0,0.07)] border-b border-gray-100 ${getRowBgClass(autoStatus)}`}
                  style={req.supplier_order_number ? {
                    borderLeft: `3px solid ${getPOBorderColor(req.supplier_order_number)}`,
                    borderRight: `3px solid ${getPOBorderColor(req.supplier_order_number)}`,
                  } : undefined}
                >
                  {/* Date */}
                  <td className="px-1 py-0.5">
                    <InlineEditableCell
                      value={req.entry_date}
                      onChange={(val) => handleInlineEdit(req.requirement_id, 'entry_date', val)}
                      type="date"
                    />
                  </td>

                  {/* Order Ref */}
                  <td className="px-1 py-0.5">
                    <OrderDropdown
                      value={req.order_id}
                      onChange={(orderId) => {
                        handleMultiFieldEdit(req.requirement_id, {
                          is_stock_item: false,
                          order_id: orderId
                        });
                      }}
                      orders={availableOrders}
                      loading={loadingOrders}
                      placeholder="Select..."
                      showClear={false}
                      includeStockOption={true}
                      isStockSelected={req.is_stock_item}
                      onStockSelect={() => {
                        handleMultiFieldEdit(req.requirement_id, {
                          is_stock_item: true,
                          order_id: null
                        });
                      }}
                    />
                  </td>

                  {/* Product Type */}
                  <td className="px-1 py-0.5">
                    <ProductTypeDropdown
                      value={req.archetype_id}
                      onChange={(val) => {
                        const arch = archetypes.find(a => a.archetype_id === val);
                        handleMultiFieldEdit(req.requirement_id, {
                          archetype_id: val,
                          vinyl_product_id: null,
                          supplier_product_id: null,
                          supplier_id: null,
                          custom_product_type: null,
                          unit: arch?.unit_of_measure || 'each',
                        });
                      }}
                      archetypes={archetypes}
                      placeholder="Type..."
                    />
                  </td>

                  {/* Product */}
                  <td className="px-1 py-0.5">
                    {req.archetype_id !== null ? (
                      <ProductDropdown
                        archetypeId={req.archetype_id}
                        vinylProductId={req.vinyl_product_id}
                        supplierProductId={req.supplier_product_id}
                        supplierId={req.supplier_id}
                        supplierProducts={supplierProducts}
                        vinylProducts={vinylProducts}
                        onVinylProductChange={(val) => handleVinylProductSelect(req.requirement_id, val)}
                        onSupplierProductChange={(val) => handleSupplierProductSelect(req.requirement_id, val)}
                        customProductType={req.custom_product_type}
                        onCustomProductTypeChange={(text) => handleCustomProductTypeChange(req.requirement_id, text)}
                        placeholder="Product..."
                      />
                    ) : (
                      <InlineEditableCell
                        value={req.custom_product_type || ''}
                        onChange={(val) => handleInlineEdit(req.requirement_id, 'custom_product_type', val)}
                        type="text"
                        placeholder="Custom..."
                      />
                    )}
                  </td>

                  {/* Unit */}
                  <td className="px-1 py-0.5">
                    <InlineEditableCell
                      value={req.unit || ''}
                      onChange={(val) => handleInlineEdit(req.requirement_id, 'unit', val)}
                      type="text"
                      placeholder="Unit"
                    />
                  </td>

                  {/* Qty */}
                  <td className="px-1 py-0.5 text-right font-medium">
                    <InlineEditableCell
                      value={req.quantity_ordered}
                      onChange={(val) => handleInlineEdit(req.requirement_id, 'quantity_ordered', Number(val))}
                      type="number"
                      min={0}
                      step={1}
                      className="text-right"
                    />
                  </td>

                  {/* Vendor */}
                  <td className="px-1 py-0.5">
                    <div className="flex flex-col gap-0.5">
                      {/* Show HeldItemButton if item has a hold, otherwise show SupplierDropdown */}
                      {(req.held_vinyl_id || req.held_supplier_product_id) ? (
                        <HeldItemButton
                            requirement={req}
                            onEditHold={() => handleEditHold(req)}
                            onReleaseHold={() => handleReleaseHold(req)}
                          />
                      ) : (
                        <SupplierDropdown
                          value={req.supplier_id}
                          onChange={(val) => handleInlineEdit(req.requirement_id, 'supplier_id', val)}
                          suppliers={suppliers}
                          placeholder="Vendor..."
                        />
                      )}
                      {/* Show CheckStockButton below when no vendor selected and no hold */}
                      {!req.supplier_id && !req.held_vinyl_id && !req.held_supplier_product_id && (
                        <CheckStockButton
                          requirement={req}
                          onCheckStock={(stockType) => handleCheckStock(req, stockType)}
                        />
                      )}
                    </div>
                  </td>

                  {/* Delivery */}
                  <td className="px-1 py-0.5">
                    <InlineEditableCell
                      value={req.delivery_method || ''}
                      onChange={(val) => handleInlineEdit(req.requirement_id, 'delivery_method', val || null)}
                      type="select"
                      options={DELIVERY_OPTIONS}
                      placeholder="Delivery..."
                      className={
                        req.delivery_method === 'pickup' ? '!bg-blue-100 !text-blue-700 !border-blue-300 font-medium' :
                        req.delivery_method === 'shipping' ? '!bg-yellow-100 !text-yellow-700 !border-yellow-300 font-medium' :
                        'text-gray-300'
                      }
                    />
                  </td>

                  {/* Ordered Date */}
                  <td className="px-1 py-0.5">
                    <InlineEditableCell
                      value={req.ordered_date || ''}
                      onChange={(val) => handleInlineEdit(req.requirement_id, 'ordered_date', val || null)}
                      type="date"
                      placeholder="-"
                      defaultToToday
                    />
                  </td>

                  {/* Receiving Status */}
                  <td className="px-1 py-0.5">
                    <InlineEditableCell
                      value={req.status === 'pending' || req.status === 'ordered' ? '' : req.status}
                      onChange={(val) => {
                        // If setting to received and has a vinyl hold, use special handler
                        if (val === 'received' && req.held_vinyl_id) {
                          handleReceiveWithHold(req);
                        } else if ((val === 'received' || val === 'cancelled') && !req.received_date && (req.status === 'pending' || req.status === 'ordered')) {
                          // Auto-fill received date with today when marking as received or cancelled
                          const today = new Date().toISOString().split('T')[0];
                          handleMultiFieldEdit(req.requirement_id, { status: val, received_date: today });
                        } else {
                          handleInlineEdit(req.requirement_id, 'status', val || 'pending');
                        }
                      }}
                      type="select"
                      options={RECEIVING_STATUS_OPTIONS}
                      className={
                        req.status === 'pending' || req.status === 'ordered' ? 'text-gray-300 [&>option]:text-black' : ''
                      }
                    />
                  </td>

                  {/* Received Date */}
                  <td className="px-1 py-0.5">
                    <InlineEditableCell
                      value={req.received_date || ''}
                      onChange={(val) => handleInlineEdit(req.requirement_id, 'received_date', val || null)}
                      type="date"
                      placeholder="-"
                      defaultToToday
                    />
                  </td>

                  {/* PO# */}
                  <td className="px-1 py-0.5">
                    {req.supplier_order_number ? (
                      <span className="text-xs font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                        {req.supplier_order_number}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>

                  {/* Notes */}
                  <td className="px-1 py-0.5">
                    <InlineEditableCell
                      value={req.notes || ''}
                      onChange={(val) => handleInlineEdit(req.requirement_id, 'notes', val)}
                      type="textarea"
                      placeholder="Notes"
                    />
                  </td>

                  {/* Actions */}
                  <td className="px-1 py-0.5">
                    <div className="flex items-center justify-center">
                      {req.status !== 'received' && (
                        <button
                          onClick={() => handleDelete(req.requirement_id)}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Auto Status Badge */}
                  <td className="px-1 py-0.5">
                    {getAutoStatusBadge(autoStatus)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {requirements.length === 0 && !loading && (
        <div className={`text-center py-12 ${PAGE_STYLES.panel.textMuted}`}>
          <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium mb-1">No material requirements found</p>
          <p className="text-sm">Click "Add" to create one</p>
        </div>
      )}

      {/* Vinyl Selector Modal */}
      {selectedRequirementForHold?.vinyl_product_id && (
        <VinylInventorySelector
          mode="hold"
          isOpen={showVinylSelector}
          onClose={() => {
            setShowVinylSelector(false);
            setSelectedRequirementForHold(null);
          }}
          onSelect={handleVinylHoldSelect}
          vinylProductId={selectedRequirementForHold.vinyl_product_id}
          title="Select Vinyl from Inventory"
          requirementSize={selectedRequirementForHold.unit}
          requirementQty={selectedRequirementForHold.quantity_ordered}
        />
      )}

      {/* General Inventory Selector Modal */}
      {selectedRequirementForHold?.archetype_id && !selectedRequirementForHold?.vinyl_product_id && (
        <GeneralInventorySelectorModal
          isOpen={showGeneralInventorySelector}
          onClose={() => {
            setShowGeneralInventorySelector(false);
            setSelectedRequirementForHold(null);
          }}
          onSelect={handleGeneralInventoryHoldSelect}
          archetypeId={selectedRequirementForHold.archetype_id}
          archetypeName={selectedRequirementForHold.archetype_name || undefined}
          title="Select from Inventory"
        />
      )}

      {/* Multi-Hold Receive Modal */}
      {multiHoldData && (
        <MultiHoldReceiveModal
          isOpen={showMultiHoldModal}
          onClose={() => {
            setShowMultiHoldModal(false);
            setMultiHoldData(null);
          }}
          onConfirm={handleMultiHoldConfirm}
          primaryRequirement={multiHoldData.requirement}
          otherHolds={multiHoldData.otherHolds}
        />
      )}
    </div>
  );
};

export default AllOrdersMaterialRequirements;
