import { OrderPart } from '../../../../types/orders';
import { ordersApi } from '../../../../services/api';

/**
 * Calculates the number of shop forms needed based on order specifications
 */
export const calculateShopCount = (orderParts: OrderPart[]): number => {
  // Start with base count of 2 (Vinyl/CNC, QC & Packing)
  let count = 2;

  // Define specification checks - each adds 1 to shop count if found
  const specChecks = [
    // Check for Return
    (specs: any) => specs.return || specs.Return,

    // Check for Trim
    (specs: any) => specs.trim || specs.Trim,

    // Check for Pins with count OR D-Tape/Mounting
    (specs: any) => {
      const hasPins = specs.pins || specs.Pins;
      const hasPinCount = specs.pin_count || specs['Pin Count'];
      const hasDTape = specs.dtape || specs['D-Tape'];
      const hasMounting = specs.mounting || specs.Mounting;

      return (hasPins && hasPinCount > 0) || hasDTape || hasMounting;
    },

    // Check for LED installation
    (specs: any) => specs.leds || specs.LEDs || specs.led || specs.LED,

    // Check for Painting
    (specs: any) => specs.painting || specs.Painting
  ];

  // Apply each check - add 1 to count if any part matches
  for (const check of specChecks) {
    if (orderParts.some(part => check(part.specifications || {}))) {
      count++;
    }
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