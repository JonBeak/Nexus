import { useEffect } from 'react';
import { ordersApi } from '../../../../services/api';
import { Order } from '../../../../types/orders';
import { getTodayString } from '../../../../utils/dateUtils';

interface CalculatedValues {
  turnaroundDays: number | null;
  daysUntilDue: number | null;
  specsDataLoaded: boolean;
  leds: any[];
  powerSupplies: any[];
  materials: string[];
}

export function useOrderCalculations(
  order: Order | null,
  setCalculatedValues: (updater: (prev: CalculatedValues) => CalculatedValues) => void
) {
  const calculateTurnaround = async () => {
    if (!order || !order.due_date) return;

    try {
      const result = await ordersApi.calculateBusinessDays(
        order.order_date.split('T')[0], // Ensure YYYY-MM-DD format
        order.due_date.split('T')[0]
      );
      setCalculatedValues(prev => ({ ...prev, turnaroundDays: result.businessDays }));
    } catch (err) {
      console.error('Error calculating turnaround days:', err);
      setCalculatedValues(prev => ({ ...prev, turnaroundDays: null }));
    }
  };

  const calculateDaysUntil = async () => {
    if (!order || !order.due_date) return;

    try {
      const today = getTodayString();
      const result = await ordersApi.calculateBusinessDays(
        today,
        order.due_date.split('T')[0]
      );
      setCalculatedValues(prev => ({ ...prev, daysUntilDue: result.businessDays }));
    } catch (err) {
      console.error('Error calculating days until due:', err);
      setCalculatedValues(prev => ({ ...prev, daysUntilDue: null }));
    }
  };

  // Trigger calculations when order dates change
  useEffect(() => {
    if (order && order.due_date) {
      calculateTurnaround();
      calculateDaysUntil();
    }
  }, [order?.order_date, order?.due_date]);

  const recalculate = () => {
    if (order && order.due_date) {
      calculateTurnaround();
      calculateDaysUntil();
    }
  };

  return {
    turnaroundDays: null, // These will be in calculatedValues from parent
    daysUntilDue: null,   // These will be in calculatedValues from parent
    recalculate
  };
}