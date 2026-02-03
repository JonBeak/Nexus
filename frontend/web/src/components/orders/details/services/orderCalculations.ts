import { OrderPart } from '../../../../types/orders';
import { ordersApi } from '../../../../services/api';
import { getTodayString } from '../../../../utils/dateUtils';

/**
 * Helper function to check if any template in specs matches a given name
 */
const hasTemplate = (specs: any, templateName: string): boolean => {
  if (!specs) return false;

  // Check all _template_X keys for matching template name
  return Object.keys(specs).some(key =>
    key.startsWith('_template_') && specs[key] === templateName
  );
};

/**
 * Helper function to check if any of the given templates exist in any order part
 */
const hasAnyTemplate = (orderParts: OrderPart[], templateNames: string[]): boolean => {
  return orderParts.some(part =>
    templateNames.some(name => hasTemplate(part.specifications, name))
  );
};

/**
 * Result from shop count calculation
 */
export interface ShopCountResult {
  count: number;
  roles: string[];
}

/**
 * Calculates the number of shop forms needed based on order specifications
 * Returns both the count and the list of roles included
 */
export const calculateShopCount = (orderParts: OrderPart[]): ShopCountResult => {
  // Always included: Vinyl/CNC, QC & Packing
  const roles: string[] = ['Vinyl/CNC', 'QC & Packing'];

  // Detect part types
  const hasRegularReturn = hasAnyTemplate(orderParts, ['Return']);
  const has3DPReturn = hasAnyTemplate(orderParts, ['3DP Return']);
  const hasLEDs = hasAnyTemplate(orderParts, ['LEDs']);

  // Check for Return - adds 2 sheets (Return, Return 2) for front-lit
  if (hasRegularReturn) {
    roles.push('Return', 'Return 2');
  }

  // Check for Trim - adds 1 sheet
  if (hasAnyTemplate(orderParts, ['Trim'])) {
    roles.push('Trim');
  }

  // LEDs sheet: only for front-lit parts (Return without 3DP)
  // If order has front-lit AND LEDs → separate LEDs sheet
  if (hasRegularReturn && hasLEDs) {
    roles.push('LEDs');
  }

  // 3DP/Assembly sheet: for 3D print parts (LEDs bundled into this workflow)
  if (has3DPReturn || hasAnyTemplate(orderParts, ['Pins', 'D-Tape', 'Mounting'])) {
    roles.push('3DP/Assembly');
  }

  // Check for Painting - adds 1 sheet
  if (hasAnyTemplate(orderParts, ['Painting'])) {
    roles.push('Painting');
  }

  return { count: roles.length, roles };
};

/**
 * Calculates turnaround days between order date and due date
 */
export const calculateTurnaroundDays = async (
  orderDate: string,
  dueDate: string
): Promise<number | null> => {
  try {
    const response = await ordersApi.calculateBusinessDays(orderDate, dueDate);
    return response.businessDays;
  } catch (error) {
    console.error('Error calculating turnaround days:', error);
    return null;
  }
};

/**
 * Calculates business days until due date from today
 */
export const calculateDaysUntilDue = async (
  dueDate: string
): Promise<number | null> => {
  try {
    const today = getTodayString();
    const response = await ordersApi.calculateBusinessDays(today, dueDate);
    return response.businessDays;
  } catch (error) {
    console.error('Error calculating days until due:', error);
    return null;
  }
};

/**
 * Builds form URLs for viewing individual forms
 */
export const buildFormUrls = (orderNumber: number) => {
  const baseUrl = `${window.location.origin}/api/orders/${orderNumber}/forms`;

  return {
    master: `${baseUrl}/master`,
    shop: `${baseUrl}/shop`,
    customer: `${baseUrl}/customer`,
    packing: `${baseUrl}/packing`
  };
};

/**
 * Determines if specification data needs to be loaded
 */
export const needsSpecificationData = (orderParts: OrderPart[]): boolean => {
  return orderParts.some(part => {
    const specs = part.specifications || {};
    return specs.leds || specs.LEDs ||
           specs.power_supplies || specs['Power Supplies'] ||
           specs.material || specs.Material;
  });
};