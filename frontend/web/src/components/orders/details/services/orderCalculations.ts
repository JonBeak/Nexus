import { OrderPart } from '../../../../types/orders';
import { ordersApi } from '../../../../services/api';

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
 * Calculates the number of shop forms needed based on order specifications
 */
export const calculateShopCount = (orderParts: OrderPart[]): number => {
  // Start with base count of 2 (Vinyl/CNC, QC & Packing)
  let count = 2;

  // Check for Return - adds 2 sheets
  if (hasAnyTemplate(orderParts, ['Return'])) {
    count += 2;
  }

  // Check for Trim - adds 1 sheet
  if (hasAnyTemplate(orderParts, ['Trim'])) {
    count += 1;
  }

  // Check for 3DP / LEDs / Pins / D-Tape / Mounting - adds 1 sheet (combined)
  // For 3D Print orders, these tasks are done together so only 1 sheet needed
  if (hasAnyTemplate(orderParts, ['3DP Return', 'LEDs', 'Pins', 'D-Tape', 'Mounting'])) {
    count += 1;
  }

  // Check for Painting - adds 1 sheet
  if (hasAnyTemplate(orderParts, ['Painting'])) {
    count += 1;
  }

  return count;
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
    const today = new Date().toISOString().split('T')[0];
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